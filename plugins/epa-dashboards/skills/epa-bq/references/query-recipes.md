# Recetas de query — parametrizadas por `{cliente}`

10 recetas listas para adaptar. Reemplazar `{cliente}`, `{mcc}`,
`{account_id}`, `{advertiser_id}`, `{property_id}` por los valores reales
del cliente (resueltos con `/client-context {cliente}` o por lookup manual
— ver `epa-bq/SKILL.md`). Todas incluyen filtro de fecha y `LIMIT` en el
patrón de exploración; en el service Go que corre en el contenedor `api`,
el `LIMIT` se vuelve un query parameter (`@limit`) con default y máximo —
nunca se quita, se reemplaza por un valor validado (ver
`epa-backend/references/bigquery-repository.md`, capa
`service/campaignmetrics/service.go`) — y siempre con `q.MaxBytesBilled`
configurado.

> La receta 1 (inversión/clicks/impresiones de Google Ads por campaña) es
> justo la que implementa `CampaignMetrics` en
> `epa-backend/references/bigquery-repository.md` — si cambia el SQL de
> una, cambia la otra.

---

## 1. Inversión/clicks/impresiones diarias de Google Ads por campaña

```sql
SELECT
  campaign_id,
  campaign.campaign_name,
  stats.segments_date AS date,
  SUM(stats.metrics_cost_micros) / 1e6 AS cost,
  SUM(stats.metrics_clicks)            AS clicks,
  SUM(stats.metrics_impressions)       AS impressions
FROM `bdd-epa-digital.{cliente}_reporting.ads_CampaignBasicStats_{mcc}` AS stats
JOIN `bdd-epa-digital.{cliente}_reporting.ads_Campaign_{mcc}` AS campaign
  ON stats.campaign_id = campaign.campaign_id
WHERE campaign._DATA_DATE = campaign._LATEST_DATE
  AND stats.segments_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1, 2, 3
ORDER BY date DESC
LIMIT 1000;
```

## 2. Conversiones y valor por campaña de Google Ads

```sql
SELECT
  campaign_id,
  segments_date AS date,
  SUM(metrics_conversions)       AS conversions,
  SUM(metrics_conversions_value) AS conversions_value
FROM `bdd-epa-digital.{cliente}_reporting.ads_CampaignBasicStats_{mcc}`
WHERE segments_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1, 2
ORDER BY date DESC
LIMIT 1000;
```

## 3. Spend + purchases de Meta (cast + UNNEST de `actions`)

```sql
WITH casted AS (
  SELECT
    date,
    ad_id,
    campaign_name,
    SAFE_CAST(spend AS FLOAT64) AS spend,
    actions
  FROM `bdd-epa-digital.{cliente}_reporting.facebook_ads_{account_id}`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
)
SELECT
  c.date,
  c.campaign_name,
  SUM(c.spend) AS spend,
  SUM(SAFE_CAST(JSON_EXTRACT_SCALAR(action, '$.value') AS FLOAT64)) AS purchase_value
FROM casted c,
  UNNEST(JSON_EXTRACT_ARRAY(c.actions)) AS action
WHERE JSON_EXTRACT_SCALAR(action, '$.type') IN ('purchase', 'omni_purchase')
GROUP BY 1, 2
ORDER BY date DESC
LIMIT 1000;
```

## 4. TikTok ads + conversions joineadas

```sql
SELECT
  ads.date,
  ads.campaign_name,
  SUM(ads.spend)              AS spend,
  SUM(ads.conversion_value)   AS conversion_value,
  SUM(conv.total_purchase)    AS total_purchase,
  SUM(conv.total_purchase_value) AS total_purchase_value
FROM `bdd-epa-digital.{cliente}_reporting.tiktok_ads_{advertiser_id}` AS ads
LEFT JOIN `bdd-epa-digital.{cliente}_reporting.tiktok_conversions_{advertiser_id}` AS conv
  ON ads.ad_id = conv.ad_id AND ads.date = conv.date
WHERE ads.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1, 2
ORDER BY date DESC
LIMIT 1000;
```

## 5. Sesiones/ingresos GA4 por canal por día (vistas custom)

```sql
SELECT
  date,
  channelGroup,
  SUM(sessions)        AS sessions,
  SUM(engagedSessions)  AS engaged_sessions
FROM `bdd-epa-digital.{cliente}_reporting.ga4_sessions_{property_id}`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1, 2
ORDER BY date DESC
LIMIT 1000;
```

## 6. Items / productos GA4 con más revenue

```sql
SELECT
  item_name,
  item_brand,
  SUM(itemRevenue)       AS item_revenue,
  SUM(itemsPurchased)    AS items_purchased
FROM `bdd-epa-digital.{cliente}_reporting.ga4_items_{property_id}`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1, 2
ORDER BY item_revenue DESC
LIMIT 50;
```

## 7. Blended: inversión total multi-plataforma vs. ingresos GA4 por día

Requiere unir varias fuentes con `UNION ALL` porque no existe una vista
consolidada cross-plataforma (ver `SKILL.md` — regla de dataset).

```sql
WITH inversion AS (
  SELECT segments_date AS date, SUM(metrics_cost_micros) / 1e6 AS cost, 'google_ads' AS canal
  FROM `bdd-epa-digital.{cliente}_reporting.ads_CampaignBasicStats_{mcc}`
  WHERE segments_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1

  UNION ALL

  SELECT date, SUM(SAFE_CAST(spend AS FLOAT64)) AS cost, 'meta' AS canal
  FROM `bdd-epa-digital.{cliente}_reporting.facebook_ads_{account_id}`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1
),
ingresos AS (
  SELECT date, SUM(itemRevenue) AS revenue
  FROM `bdd-epa-digital.{cliente}_reporting.ga4_items_{property_id}`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1
)
SELECT
  i.date,
  SUM(i.cost)     AS cost_total,
  ANY_VALUE(g.revenue) AS revenue,
  SAFE_DIVIDE(ANY_VALUE(g.revenue), SUM(i.cost)) AS roas
FROM inversion i
LEFT JOIN ingresos g ON i.date = g.date
GROUP BY 1
ORDER BY date DESC
LIMIT 1000;
```

## 8. Métricas por hora (Google Ads `Hourly*Stats`)

```sql
SELECT
  segments_date          AS date,
  segments_hour          AS hour,
  SUM(metrics_cost_micros) / 1e6 AS cost,
  SUM(metrics_clicks)     AS clicks
FROM `bdd-epa-digital.{cliente}_reporting.ads_HourlyCampaignStats_{mcc}`
WHERE segments_date = CURRENT_DATE()
GROUP BY 1, 2
ORDER BY hour
LIMIT 24;
```

## 9. Estado de cuentas activas del cliente

```sql
SELECT DISTINCT
  platform,
  account_id,
  account_name,
  client_status,
  vertical
FROM `bdd-epa-digital.{cliente}_reporting.dim_clients_accounts`
WHERE LOWER(TRIM(client_status)) = 'active'
ORDER BY platform;
```

Usar `DISTINCT` siempre — `dim_clients_accounts` puede tener filas
duplicadas para la misma cuenta (ver `schema-google-transfer.md`).

## 10. Frescura de pipelines

```sql
SELECT
  platform,
  account_id,
  last_successful_date,
  last_run_at,
  DATE_DIFF(CURRENT_DATE(), last_successful_date, DAY) AS dias_de_atraso
FROM `bdd-epa-digital.{cliente}_reporting.data_freshness`
ORDER BY dias_de_atraso DESC;
```

Correr esta receta **antes** de cualquier reporte — un pipeline caído
(frecuente en Bing) produce números de "cero" que se ven como caída real de
performance si no se detectan a tiempo. El dashboard debe mostrar
"Datos al {fecha}" usando `last_successful_date` de aquí.
