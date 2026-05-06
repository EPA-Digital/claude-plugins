# BigQuery — Patrones avanzados en epa-turing

Proyecto: `epa-turing` · Región default: `US` (multiregional) · Convenciones de
naming en epa-naming. Este documento es referencia técnica — abrir cuando se
vaya a escribir SQL serio o configurar costos.

---

## Particionamiento — obligatorio para tablas con tiempo

Toda tabla con histórico debe estar particionada. Sin partición, cada query
escanea la tabla entera y dispara facturación.

### Partición por fecha (caso típico)

```sql
CREATE TABLE `epa-turing.coppel_performance.campaigns_daily` (
  date DATE NOT NULL,
  campaign_id STRING,
  impressions INT64,
  clicks INT64,
  spend NUMERIC
)
PARTITION BY date
CLUSTER BY campaign_id
OPTIONS (
  partition_expiration_days = 730,           -- 2 años; ajustar al cliente
  require_partition_filter  = true            -- BLOQUEA queries sin filtro de fecha
);
```

`require_partition_filter = true` evita que un `SELECT *` accidental escanee
todo el histórico.

### Partición por timestamp con granularidad

```sql
PARTITION BY TIMESTAMP_TRUNC(event_timestamp, DAY)
```

Usar `DAY` por default. `HOUR` solo si los volúmenes diarios superan 10M filas.

### Partición por ingestion time (tablas de logs)

```sql
PARTITION BY DATE(_PARTITIONTIME)
```

Útil para append-only de eventos sin un campo de fecha lógica claro.

---

## Clustering — siempre que se filtre por una columna alta-cardinalidad

```sql
CLUSTER BY campaign_id, ad_set_id
```

Hasta 4 columnas, en orden de selectividad. Reduce bytes escaneados cuando se
filtra o agrupa por esas columnas. El costo de mantenimiento es cero porque BQ
re-clusteriza automáticamente.

---

## Control de costo — patrones obligatorios

### 1. Limitar bytes facturados por job

Toda query que se ejecuta desde Cloud Run o n8n debe declarar máximo de bytes:

```python
from google.cloud import bigquery

client = bigquery.Client(project="epa-turing")

job_config = bigquery.QueryJobConfig(
    maximum_bytes_billed = 100 * 1024 * 1024  # 100 MB
)
results = client.query(sql, job_config=job_config).result()
```

Si la query supera el tope, falla en vez de cobrar. Mejor un error que una
factura inesperada.

### 2. Dry run antes de queries pesadas

```python
job_config = bigquery.QueryJobConfig(dry_run=True, use_query_cache=False)
job = client.query(sql, job_config=job_config)
print(f"Procesará {job.total_bytes_processed / 1e9:.2f} GB")
```

Si el dry run reporta >5 GB, revisar antes de ejecutar.

### 3. Filtrar por partición SIEMPRE

```sql
-- ✗ Escanea toda la tabla
SELECT campaign_id, SUM(spend)
FROM `epa-turing.coppel_performance.campaigns_daily`
GROUP BY 1;

-- ✓ Solo lee la partición necesaria
SELECT campaign_id, SUM(spend)
FROM `epa-turing.coppel_performance.campaigns_daily`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1;
```

### 4. Evitar `SELECT *`

`SELECT *` lee todas las columnas. BigQuery cobra por columna leída. Listar
explícitamente las columnas necesarias reduce costo 5–20× en tablas anchas.

---

## Patrón ELT estándar EPA

```
1. RAW   →  coppel_raw.{plataforma}_{entidad}
            Datos sin transformar desde Pitágoras u otra fuente.
            Append-only, particionado por ingestion time.

2. STAGING → coppel_staging.{entidad}_normalized
            Tipos casteados, columnas renombradas a snake_case,
            sin lógica de negocio.

3. MART  →  coppel_performance.{entidad}_{granularidad}
            Tabla final lista para consumo (dashboards, reportes).
            Particionada por fecha de negocio, clusterizada por dimensiones.
```

Cada paso es una scheduled query o un Cloud Run job. Nunca leer directo de RAW
desde un dashboard de cliente.

---

## Scheduled queries — para transformaciones recurrentes

Cuando la transformación es 100% SQL y diaria/horaria, no escribir Cloud Run job.
Usar scheduled query directamente:

```sql
-- name: coppel_campaigns_daily_refresh
-- schedule: every day 06:00
-- destination: epa-turing.coppel_performance.campaigns_daily
-- write_disposition: WRITE_APPEND
INSERT INTO `epa-turing.coppel_performance.campaigns_daily`
SELECT
  date,
  campaign_id,
  SUM(impressions) AS impressions,
  SUM(clicks)      AS clicks,
  SUM(spend)       AS spend
FROM `epa-turing.coppel_staging.campaigns_normalized`
WHERE date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
GROUP BY 1, 2;
```

---

## Idempotencia — patrón MERGE

Las re-ejecuciones nunca deben duplicar. Usar `MERGE`:

```sql
MERGE `epa-turing.coppel_performance.campaigns_daily` T
USING (
  SELECT date, campaign_id, SUM(impressions) AS impressions, SUM(spend) AS spend
  FROM `epa-turing.coppel_staging.campaigns_normalized`
  WHERE date = @run_date
  GROUP BY 1, 2
) S
ON T.date = S.date AND T.campaign_id = S.campaign_id
WHEN MATCHED THEN UPDATE SET
  impressions = S.impressions,
  spend       = S.spend
WHEN NOT MATCHED THEN INSERT (date, campaign_id, impressions, spend)
VALUES (S.date, S.campaign_id, S.impressions, S.spend);
```

---

## Streaming inserts — solo para eventos en tiempo real

```python
errors = client.insert_rows_json(
    "epa-turing.pitagoras_logs.api_calls",
    [{"timestamp": "2025-05-05T12:00:00Z", "endpoint": "/v1/campaigns", ...}]
)
```

Para batch (lotes de >100 filas), preferir load jobs desde GCS — son gratis.
Streaming inserts cuestan $0.01 por 200 MB.

---

## Vistas y vistas materializadas

### Vista regular
Bueno para abstraer JOINs frecuentes. No precomputa: cada query reejecuta.
```sql
CREATE OR REPLACE VIEW `epa-turing.coppel_performance.campaigns_with_meta` AS
SELECT c.*, m.account_name, m.market
FROM `epa-turing.coppel_performance.campaigns_daily` c
LEFT JOIN `epa-turing.coppel_staging.accounts` m
  ON c.account_id = m.account_id;
```

### Vista materializada
Para queries lentas y repetidas. BigQuery la mantiene en background.
```sql
CREATE MATERIALIZED VIEW `epa-turing.coppel_performance.campaigns_30d` AS
SELECT campaign_id, SUM(impressions) AS impressions, SUM(spend) AS spend
FROM `epa-turing.coppel_performance.campaigns_daily`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1;
```

---

## Permisos y aislamiento por cliente

Cada dataset de cliente debe tener IAM aislado:
```bash
# Solo el equipo asignado al cliente puede leer
gcloud projects add-iam-policy-binding epa-turing \
  --member="group:coppel-team@epa.digital" \
  --role="roles/bigquery.dataViewer" \
  --condition='expression=resource.name.startsWith("projects/epa-turing/datasets/coppel_")'
```

---

## Anti-patrones bloqueados

```
✗ Crear tablas sin partición en datasets *_performance o *_raw
✗ SELECT * en código de producción
✗ Queries sin filtro de fecha en tablas con require_partition_filter
✗ Streaming inserts para batches grandes (usar load jobs)
✗ Crosss-project queries sin alias de proyecto explícito
✗ Tablas con nombres tipo `temp_`, `test_`, `_v2` en datasets de producción
✗ DELETE / UPDATE masivos sin WHERE filtrado por partición
✗ Datasets sin prefijo de cliente o producto
```

---

## Recursos compartidos críticos

Estos datasets los consume Pitágoras y otros productos. NO modificar esquema
sin coordinar con el área de Datos:

```
pitagoras_logs           ← logs operativos de Pitágoras
epa_internal             ← datos cross-cliente (clientes activos, pricing)
```
