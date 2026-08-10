# Meta, TikTok, DV360, Bing — schemas comunes

Generalizado de los datasets `{cliente}_reporting` reales de la agencia. El
sufijo de estas vistas es siempre el **account_id** de la plataforma (no un
MCC como en Google Ads) — cada cuenta tiene su propia vista.

El catálogo de cuentas por cliente (qué account_id existe, en qué
plataforma, con qué vertical, si tiene datos o está vacía) vive en
`dim_clients_accounts` — ver `epa-bq/SKILL.md` para el bloque de resolución
de dataset y `schema-google-transfer.md` para los gotchas de ese catálogo.

---

## Meta Ads — `facebook_ads_<account_id>`

Grano: **fecha × ad × país**.

```
date, account_name, campaign_id, campaign_name, ad_group_id, ad_group_name,
ad_id, ad_name, country, impressions, clicks, spend, actions:JSON
```

- ⚠️ **`impressions`, `clicks`, `spend` llegan como STRING** — castear antes
  de agregar:
  ```sql
  SELECT
    date,
    SAFE_CAST(impressions AS INT64)  AS impressions,
    SAFE_CAST(clicks AS INT64)       AS clicks,
    SAFE_CAST(spend AS FLOAT64)      AS spend
  FROM `bdd-epa-digital.{cliente}_reporting.facebook_ads_{account_id}`
  ```
- **`actions`** es un array JSON de conversiones:
  `[{type, count, value}, ...]` con tipos estándar de Meta (`purchase`,
  `omni_purchase`, `add_to_cart`, `initiate_checkout`, `view_content`,
  `link_click`, `landing_page_view`, `mobile_app_install`, más tipos
  custom). Extraer con `JSON_EXTRACT_ARRAY` + `UNNEST`:
  ```sql
  SELECT
    date,
    ad_id,
    action.type  AS action_type,
    SAFE_CAST(JSON_EXTRACT_SCALAR(action, '$.value') AS FLOAT64) AS value
  FROM `bdd-epa-digital.{cliente}_reporting.facebook_ads_{account_id}`,
    UNNEST(JSON_EXTRACT_ARRAY(actions)) AS action
  WHERE JSON_EXTRACT_SCALAR(action, '$.type') IN ('purchase', 'omni_purchase')
  ```

---

## TikTok — `tiktok_ads_<advertiser_id>` + `tiktok_conversions_<advertiser_id>`

```
tiktok_ads_*:
  date, campaign_id, campaign_name, ad_group_id, ad_group_name, ad_id,
  ad_name, country, audience_type, creative_format, impressions:INT,
  clicks:INT, spend:FLOAT, video_views:INT, conversion_count:FLOAT,
  conversion_value:FLOAT, ingested_at

tiktok_conversions_*:
  date, ad_id, custom_event_type, conversion, cost_per_conversion,
  value_per_complete_payment, total_purchase, total_purchase_value,
  ingested_at
```

Métricas de TikTok ya vienen tipadas (no hace falta cast). Join entre las
dos tablas por `ad_id` + `date`:

```sql
SELECT
  ads.date,
  ads.ad_id,
  ads.spend,
  conv.custom_event_type,
  conv.total_purchase_value
FROM `bdd-epa-digital.{cliente}_reporting.tiktok_ads_{advertiser_id}` AS ads
LEFT JOIN `bdd-epa-digital.{cliente}_reporting.tiktok_conversions_{advertiser_id}` AS conv
  ON ads.ad_id = conv.ad_id AND ads.date = conv.date
WHERE ads.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
```

---

## DV360 — `dv360_ads_<partner_id_or_advertiser>`

Grano: **fecha × line item × creative × país**.

```
date, partner_id, advertiser_name, insertion_order_id, insertion_order_name,
line_item_id, line_item_name, creative_id, creative_name, country,
impressions, clicks, cost
```

Métricas ya numéricas — sin cast necesario en la mayoría de los casos;
verificar el tipo real en `INFORMATION_SCHEMA.COLUMNS` del dataset del
cliente antes de asumir.

---

## Bing Ads — `bing_ads_<account_id>`

```
date, account_name, campaign_id, campaign_name, ad_group_id, ad_group_name,
ad_id, ad_name, device, impressions, clicks, spend, video_views
```

- ⚠️ **Métricas en STRING** — mismo patrón de cast que Meta.
- Bing es la plataforma más propensa a pipelines caídos en la agencia —
  **siempre verificar `data_freshness` antes de reportar** (ver
  `query-recipes.md`, receta 10).

---

## Regla general — antes de escribir cualquier query sobre estas vistas

1. Confirmar el `account_id`/`advertiser_id` real desde `dim_clients_accounts`
   (con `DISTINCT`, por si hay filas duplicadas) — no adivinar el sufijo.
2. Castear toda métrica que venga como STRING (Meta, Bing) con `SAFE_CAST`,
   nunca `CAST` a secas (evita que un valor corrupto tumbe la query entera).
3. Filtrar por fecha siempre — estas vistas crecen sin límite superior.
