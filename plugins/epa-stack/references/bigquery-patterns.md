# BigQuery — Patrones y datasets canónicos en EPA

EPA usa BigQuery en **varios proyectos GCP**. Saber dónde vive cada cosa antes
de escribir SQL evita queries cross-project caras y duplicación de pipelines.

```
bdd-epa-digital     ← canonical: data warehouse de la agencia (todos los clientes)
                      Vistas reportables ya consolidadas con costos + resultados.
epa-turing          ← runtime: datasets ad-hoc por producto, datos crudos
                      (e.g. chedraui_raw, pitagoras_logs), staging temporal.
ga360-250517        ← excepción Coppel: dataset Epa_dataset con resultados de
                      campaña que provienen de Domo. NO usar salvo necesidad
                      explícita (ver sección al final).
```

Región default para queries: `US` (multiregional). Convenciones de naming en
epa-naming. Este documento es referencia técnica — abrir cuando se vaya a
escribir SQL serio o configurar costos.

---

## Dataset canónico: `bdd-epa-digital.epa_agency_reports`

**Esta es la fuente de verdad para reporting cross-cliente en EPA.** Si lo que
necesitas son métricas de gasto, sesiones, transacciones o revenue por cliente
y por canal, **empieza aquí** antes de tocar otra cosa.

### Vista 1 — `account_metrics_daily`

Métricas diarias por cliente, medio y campaña, **incluye orgánico + paid**.
Buena para visiones de funnel y atribución de canal.

| Columna | Tipo | Notas |
|---|---|---|
| `client_name` | STRING | Nombre del cliente (Coppel, Chedraui, Innovasport, …) |
| `medios` | STRING | Canal/medio (Google Ads, Meta, GA4, organic, …) |
| `client_id` | INTEGER | ID interno EPA del cliente |
| `date` | DATE | Día del registro |
| `campaign` | STRING | Nombre de campaña (si aplica) |
| `cost` | FLOAT | Inversión del día (paid; 0 para organic) |
| `impressions` | INTEGER | — |
| `clicks` | INTEGER | — |
| `default_channel_grouping` | STRING | Channel grouping default de GA |
| `primary_channel_grouping` | STRING | Channel grouping primario EPA |
| `sessions` | INTEGER | — |
| `transactions` | INTEGER | — |
| `revenue` | FLOAT | — |

### Vista 2 — `paid_media_metrics`

Igual que la anterior pero **filtrada a paid media** y con un campo extra de
tipo de campaña. Buena para análisis de inversión y eficiencia.

| Columna | Tipo | Notas |
|---|---|---|
| (todas las anteriores) | | Mismos tipos y semántica |
| `campaign_type` | STRING | Tipo de campaña (Search, PMax, Shopping, Awareness, …) |

### Patrón de query típico

```sql
SELECT
  client_name,
  medios,
  date,
  SUM(cost)         AS cost,
  SUM(sessions)     AS sessions,
  SUM(transactions) AS transactions,
  SUM(revenue)      AS revenue,
  SAFE_DIVIDE(SUM(revenue), SUM(cost)) AS roas
FROM `bdd-epa-digital.epa_agency_reports.account_metrics_daily`
WHERE client_name = 'Innovasport'
  AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY client_name, medios, date
ORDER BY date DESC, cost DESC;
```

### Acceso

`bdd-epa-digital` es proyecto separado de `epa-turing`. El service account del
runtime que vaya a leer esta vista necesita `roles/bigquery.dataViewer` sobre
`bdd-epa-digital.epa_agency_reports` (solicitar al área de Datos e IA con
caso de uso explícito). Las vistas son **read-only** para todos los runtimes
— escribir aquí va por el área de Datos e IA exclusivamente.

---

## La excepción Coppel — `ga360-250517.Epa_dataset`

Coppel mantiene sus **resultados de campaña** en un dataset propio que viene
poblado desde **Domo**, con un esquema distinto al canónico de EPA. Tablas
del tipo `PMBF_DetalleFMCampaign`, `PMBF_DetalleFunnelXBuildingBlock`,
`PMBF_DetalleTransaccionesPorProducto`, etc.

Reglas:
1. **Los costos de Coppel SÍ están en `bdd-epa-digital.epa_agency_reports`**
   con el resto de los clientes — preferir ese dataset cuando solo necesitas
   inversión.
2. **Los resultados (transacciones, revenue por SKU, funnel, etc.) sólo están
   en `ga360-250517.Epa_dataset`** porque el cliente los provee así desde Domo.
3. **Petición explícita del cliente:** no consultar este dataset salvo que sea
   estrictamente necesario.
4. Si el usuario lo pide, primero confirma:
   > "El reporte que estás armando, ¿realmente requiere las tablas
   > `PMBF_*` del dataset Coppel-Domo, o nos sirven los costos en
   > `bdd-epa-digital.epa_agency_reports`? El cliente pidió no usar Domo a
   > menos que sea necesario."
5. Solo proceder si la respuesta confirma que se necesitan los resultados
   específicos que solo están ahí (ej. detalle por SKU, building blocks de
   funnel custom). El usuario debe saber lo que hace.
6. Las queries contra `ga360-250517` deben tener `maximum_bytes_billed`
   ajustado bajo (50 MB) durante exploración — el dataset es grande y el
   cliente paga el storage.
7. **Nunca escribir** en `ga360-250517.Epa_dataset`. Es del cliente.

```sql
-- Solo cuando es estrictamente necesario y el usuario confirmó
SELECT *
FROM `ga360-250517.Epa_dataset.PMBF_DetalleFMCampaign`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
LIMIT 100;
```

---

## Particionamiento — obligatorio para tablas con tiempo

Toda tabla con histórico debe estar particionada. Sin partición, cada query
escanea la tabla entera y dispara facturación.

### Partición por fecha (caso típico)

Estos ejemplos aplican cuando estás creando tablas en `epa-turing` (datasets
ad-hoc por producto o cliente, ej. `chedraui_raw`). Las vistas canónicas de
`bdd-epa-digital.epa_agency_reports` ya están particionadas y no requieres
crearlas.

```sql
CREATE TABLE `epa-turing.chedraui_raw.campaigns_daily` (
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
SELECT campaign, SUM(cost)
FROM `bdd-epa-digital.epa_agency_reports.paid_media_metrics`
GROUP BY 1;

-- ✓ Solo lee la partición necesaria
SELECT campaign, SUM(cost)
FROM `bdd-epa-digital.epa_agency_reports.paid_media_metrics`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND client_name = 'Innovasport'
GROUP BY 1;
```

### 4. Evitar `SELECT *`

`SELECT *` lee todas las columnas. BigQuery cobra por columna leída. Listar
explícitamente las columnas necesarias reduce costo 5–20× en tablas anchas.

---

## Patrón ELT estándar EPA (cuando NECESITAS construir uno)

> **Antes de construir un ELT propio**, validar si el dato ya está en
> `bdd-epa-digital.epa_agency_reports`. La mayoría de los reportes cross-cliente
> pueden resolverse leyendo de ese dataset directamente. Construir un ELT
> nuevo solo cuando:
> - El cliente requiere granularidad o dimensiones que no están en las vistas
>   canónicas.
> - Es un producto interno con dominio propio (ej. logs de Pitágoras).
> - El área de Datos e IA aprobó la duplicación.

Cuando sí construyes un ELT propio en `epa-turing`:

```
1. RAW   →  {cliente}_raw.{plataforma}_{entidad}
            Datos sin transformar desde Pitágoras u otra fuente.
            Append-only, particionado por ingestion time.

2. STAGING → {cliente}_staging.{entidad}_normalized
            Tipos casteados, columnas renombradas a snake_case,
            sin lógica de negocio.

3. MART  →  {cliente}_performance.{entidad}_{granularidad}
            Tabla final lista para consumo (dashboards, reportes).
            Particionada por fecha de negocio, clusterizada por dimensiones.
```

Cada paso es una scheduled query o un Cloud Run job. Nunca leer directo de RAW
desde un dashboard de cliente.

> Las **vistas canónicas** (`bdd-epa-digital.epa_agency_reports.*`) ya son el
> equivalente al MART para casos comunes — el área de Datos e IA mantiene la
> ingesta y normalización. No dupliques esa lógica en `epa-turing`.

---

## Scheduled queries — para transformaciones recurrentes

Cuando la transformación es 100% SQL y diaria/horaria, no escribir Cloud Run job.
Usar scheduled query directamente:

```sql
-- name: chedraui_campaigns_daily_refresh
-- schedule: every day 06:00
-- destination: epa-turing.chedraui_performance.campaigns_daily
-- write_disposition: WRITE_APPEND
INSERT INTO `epa-turing.chedraui_performance.campaigns_daily`
SELECT
  date,
  campaign_id,
  SUM(impressions) AS impressions,
  SUM(clicks)      AS clicks,
  SUM(spend)       AS spend
FROM `epa-turing.chedraui_staging.campaigns_normalized`
WHERE date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
GROUP BY 1, 2;
```

---

## Idempotencia — patrón MERGE

Las re-ejecuciones nunca deben duplicar. Usar `MERGE`:

```sql
MERGE `epa-turing.chedraui_performance.campaigns_daily` T
USING (
  SELECT date, campaign_id, SUM(impressions) AS impressions, SUM(spend) AS spend
  FROM `epa-turing.chedraui_staging.campaigns_normalized`
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
CREATE OR REPLACE VIEW `epa-turing.chedraui_performance.campaigns_with_meta` AS
SELECT c.*, m.account_name, m.market
FROM `epa-turing.chedraui_performance.campaigns_daily` c
LEFT JOIN `epa-turing.chedraui_staging.accounts` m
  ON c.account_id = m.account_id;
```

### Vista materializada
Para queries lentas y repetidas. BigQuery la mantiene en background.
```sql
CREATE MATERIALIZED VIEW `epa-turing.chedraui_performance.campaigns_30d` AS
SELECT campaign_id, SUM(impressions) AS impressions, SUM(spend) AS spend
FROM `epa-turing.chedraui_performance.campaigns_daily`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1;
```

---

## Permisos y aislamiento por cliente

Cada dataset de cliente debe tener IAM aislado:
```bash
# Solo el equipo asignado al cliente puede leer
gcloud projects add-iam-policy-binding epa-turing \
  --member="group:chedraui-team@epa.digital" \
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
