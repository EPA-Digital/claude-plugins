# BigQuery — Patrones y datasets canónicos en EPA

EPA usa BigQuery en **varios proyectos GCP**. Saber dónde vive cada cosa antes
de escribir SQL evita queries cross-project caras y duplicación de pipelines.

```
bdd-epa-digital     ← canonical: data warehouse de la agencia
                      Un dataset granular por cliente: {cliente}_reporting
                      (medios pagados + analytics, vistas por plataforma).
epa-turing          ← runtime: tablas del ETL centralizado en construcción
                      ({cliente}_etl.{tabla}), datasets ad-hoc por producto,
                      staging temporal.
ga360-250517        ← excepción Coppel: dataset Epa_dataset con resultados de
                      campaña que provienen de Domo. NO usar salvo necesidad
                      explícita (ver sección al final).
```

> **DEPRECADO:** `bdd-epa-digital.epa_agency_reports` (dataset cross-cliente
> consolidado, vistas `account_metrics_daily` / `paid_media_metrics`). Ya no es
> la fuente de verdad de nada — no lo consultes ni lo dupliques. El modelo
> vigente es granular por cliente (`{cliente}_reporting`) + lo que vaya
> produciendo el ETL centralizado. Hoy no hay un dataset agregador
> cross-cliente — si necesitas un rollup entre varios clientes, escala a
> datos@epa.digital.

Región default para queries: `US` (multiregional). Convenciones de naming en
epa-naming. Este documento es referencia técnica — abrir cuando se vaya a
escribir SQL serio o configurar costos.

---

## Datasets canónicos: `bdd-epa-digital.{cliente}_reporting`

**Esta es la fuente de verdad para datos de medios y analytics por cliente en
EPA.** Cada cliente activo tiene su propio dataset en `bdd-epa-digital`, con
una vista por plataforma y cuenta (Google Ads, GA4, Meta, TikTok, Bing,
DV360…). No es un dataset único cross-cliente — es uno por cliente.

### Resolver el dataset — nunca asumir el sufijo

`_reporting` es el sufijo más común, pero no es universal. Resolver siempre
por lookup antes de escribir la primera query:

```sql
SELECT schema_name
FROM `bdd-epa-digital`.INFORMATION_SCHEMA.SCHEMATA
WHERE LOWER(schema_name) LIKE '%{cliente}%';
```

Si hay más de un candidato, confirmar con el usuario cuál es el correcto antes
de continuar.

### Forma del dataset

Dentro de `{cliente}_reporting` las vistas siguen convenciones por plataforma
(sufijo de cuenta/MCC, `_DATA_DATE`/`_LATEST_DATE` para entidades del transfer
de Google, métricas en STRING para Meta/Bing que hay que castear, etc.) — el
detalle completo de esquemas y recetas de query vive en el skill `epa-bq` del
plugin `epa-dashboards`. Si no tienes ese plugin instalado, pide al área de
Datos e IA el catálogo de vistas del cliente antes de escribir SQL contra su
dataset.

Regla universal de deduplicación: toda tabla `p_*` es la tabla física detrás
de la vista homónima sin prefijo — **usar siempre la vista, ignorar la `p_*`**.

### Patrón de query típico

```sql
-- Ejemplo sobre una vista de métricas de Google Ads (nombres reales varían
-- por cliente — confirmar el catálogo antes de copiar esto literal)
SELECT
  campaign_id,
  segments_date AS date,
  SUM(metrics_cost_micros) / 1e6      AS cost,
  SUM(metrics_impressions)            AS impressions,
  SUM(metrics_clicks)                 AS clicks,
  SUM(metrics_conversions)            AS conversions,
  SUM(metrics_conversions_value)      AS conversions_value
FROM `bdd-epa-digital.{cliente}_reporting.ads_CampaignBasicStats_{mcc}`
WHERE segments_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY campaign_id, segments_date
ORDER BY date DESC, cost DESC;
```

### Acceso

`bdd-epa-digital` es proyecto separado de `epa-turing`. El service account del
runtime que vaya a leer estas vistas necesita `roles/bigquery.dataViewer` sobre
`bdd-epa-digital.{cliente}_reporting` (solicitar al área de Datos e IA con
caso de uso explícito). Las vistas son **read-only** para todos los runtimes
— escribir aquí va por el área de Datos e IA exclusivamente. Las puebla el
equipo de dev hoy; a futuro, también el ETL centralizado en construcción.

---

## La excepción Coppel — `ga360-250517.Epa_dataset`

Coppel mantiene sus **resultados de campaña** en un dataset propio que viene
poblado desde **Domo**, con un esquema distinto al canónico de EPA. Tablas
del tipo `PMBF_DetalleFMCampaign`, `PMBF_DetalleFunnelXBuildingBlock`,
`PMBF_DetalleTransaccionesPorProducto`, etc.

Reglas:
1. **Costos de Coppel:** verificar primero si existe
   `bdd-epa-digital.coppel_reporting` (lookup por `INFORMATION_SCHEMA.SCHEMATA`,
   igual que con cualquier otro cliente) — si existe, preferir ese dataset
   cuando solo necesitas inversión.
2. **Los resultados (transacciones, revenue por SKU, funnel, etc.) sólo están
   en `ga360-250517.Epa_dataset`** porque el cliente los provee así desde Domo.
3. **Petición explícita del cliente:** no consultar este dataset salvo que sea
   estrictamente necesario.
4. Si el usuario lo pide, primero confirma:
   > "El reporte que estás armando, ¿realmente requiere las tablas
   > `PMBF_*` del dataset Coppel-Domo, o nos sirven los costos de
   > `bdd-epa-digital.coppel_reporting`? El cliente pidió no usar Domo a
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
ad-hoc por producto o cliente, ej. `{cliente}_etl`). Las vistas de
`bdd-epa-digital.{cliente}_reporting` ya están particionadas/gestionadas por
quien las puebla — no las recrees.

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
-- ✗ Escanea toda la tabla (vistas de Google Ads pueden tener cientos de
--    millones de filas — ver epa-bq para volúmenes reales por vista)
SELECT campaign_id, SUM(metrics_cost_micros) / 1e6 AS cost
FROM `bdd-epa-digital.{cliente}_reporting.ads_CampaignBasicStats_{mcc}`
GROUP BY 1;

-- ✓ Solo lee el rango necesario
SELECT campaign_id, SUM(metrics_cost_micros) / 1e6 AS cost
FROM `bdd-epa-digital.{cliente}_reporting.ads_CampaignBasicStats_{mcc}`
WHERE segments_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1;
```

### 4. Evitar `SELECT *`

`SELECT *` lee todas las columnas. BigQuery cobra por columna leída. Listar
explícitamente las columnas necesarias reduce costo 5–20× en tablas anchas.

---

## Patrón ELT estándar EPA (cuando NECESITAS construir uno)

> **Antes de construir un ELT propio**, validar si el dato ya está en
> `bdd-epa-digital.{cliente}_reporting`. La mayoría de los reportes de cliente
> pueden resolverse leyendo de ahí directamente. Construir un ELT nuevo solo
> cuando:
> - El cliente requiere granularidad o dimensiones que no están en esas vistas
>   — y entonces es candidato al ETL centralizado en construcción, no a un
>   pipeline propio (evita duplicación; consultar con el área de Datos e IA).
> - Es un producto interno con dominio propio (ej. logs de Pitágoras).
> - El área de Datos e IA aprobó la duplicación explícitamente.

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

> Las **vistas de `bdd-epa-digital.{cliente}_reporting`** ya son el equivalente
> al MART para casos comunes — el equipo de dev mantiene la ingesta y
> normalización (y a futuro, el ETL centralizado). No dupliques esa lógica en
> `epa-turing`.

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
