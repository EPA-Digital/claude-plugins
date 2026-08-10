# Google Ads / GA4 — convenciones del BigQuery Data Transfer

Generalizado de los datasets `{cliente}_reporting` reales de la agencia.
Los nombres de vista y columnas son los del transfer nativo de Google — no
son un invento de EPA, salvo donde se indica "vista custom EPA".

---

## Google Ads — Data Transfer nativo

### Convención de sufijo

Las vistas `ads_*` llevan como sufijo el **MCC** (cuenta administradora) que
agrupa las cuentas `customer_id` del cliente — no el `account_id` de cada
cuenta individual. Un cliente con varias cuentas de Google Ads las ve todas
en las mismas vistas `ads_*_{mcc}`, distinguidas por `customer_id`.

### Deduplicación — regla #1 de todo el dataset

Toda tabla `p_ads_*` es la tabla física particionada detrás de la vista
homónima sin el prefijo `p_`. **Usar siempre la vista `ads_*`, ignorar la
`p_ads_*`.**

### Vistas de entidad vs. vistas de métricas

- **Vistas de entidad** (`ads_Campaign_`, `ads_AdGroup_`, `ads_Ad_`,
  `ads_Keyword_`, `ads_Customer_`, `ads_Asset_`, `ads_Audience_`...): son
  **snapshots diarios** — cada fila representa el estado del objeto en un
  día dado, no un evento. Para el estado actual, filtrar siempre:
  ```sql
  WHERE _DATA_DATE = _LATEST_DATE
  ```
  Sin ese filtro, una entidad con 500 días de historial aparece 500 veces.

- **Vistas de métricas** (`*Stats`, `*BasicStats`, `*ConversionStats`): usar
  `segments_date` como la fecha del dato (no `_DATA_DATE`). Costo en
  `metrics_cost_micros` — **dividir entre 1,000,000** para obtener la
  moneda de cuenta.

### Vistas más usadas

```
ads_CampaignBasicStats_{mcc}   ← clicks, impressions, cost_micros,
                                  conversions, conversions_value por
                                  campaña/fecha/device/network
ads_Campaign_{mcc}              ← nombres, presupuestos, canal, estado
                                  (entidad — filtrar _LATEST_DATE)
ads_AdGroupStats_{mcc}
ads_KeywordStats_{mcc}
ads_SearchQueryStats_{mcc}
ads_GeoStats_{mcc}
ads_ShoppingProductStats_{mcc}
ads_Hourly*Stats_{mcc}          ← métricas por hora
ads_VideoStats_{mcc}
ads_AgeRange*_{mcc}              ← demográficos
ads_Gender*_{mcc}
ads_ParentalStatus*_{mcc}
ads_AssetGroup*_{mcc}            ← Performance Max
```

### Join canónico stats ↔ entidad

```sql
SELECT
  stats.campaign_id,
  stats.segments_date AS date,
  SUM(stats.metrics_cost_micros) / 1e6 AS cost,
  SUM(stats.metrics_clicks)            AS clicks,
  campaign.campaign_name,
  campaign.campaign_status
FROM `bdd-epa-digital.{cliente}_reporting.ads_CampaignBasicStats_{mcc}` AS stats
JOIN `bdd-epa-digital.{cliente}_reporting.ads_Campaign_{mcc}` AS campaign
  ON stats.campaign_id = campaign.campaign_id
 AND stats.customer_id = campaign.customer_id
WHERE campaign._DATA_DATE = campaign._LATEST_DATE
  AND stats.segments_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1, 2, 5, 6;
```

### ⚠️ Volumen — nunca escanear sin filtro

Algunas vistas de Google Ads Data Transfer llegan a cientos de millones de
filas (`ClickStats` y `Ad` en particular pueden superar los 500M–800M filas
en cuentas con historial largo). Siempre filtrar por `segments_date` /
`_DATA_DATE` y usar `LIMIT` en exploración — ver `epa-stack/references/
bigquery-patterns.md` para los patrones de control de costo.

### ⚠️ Impression Share

Las métricas de Impression Share (`metrics_search_impression_share`, etc.)
solo son válidas para campañas de Search. Filtrar siempre:
```sql
WHERE campaign_advertising_channel_type = 'SEARCH'
```
Sin ese filtro, el promedio incluye campañas de Shopping/Display/PMax donde
la métrica no aplica y el número queda distorsionado.

---

## GA4 — dos familias de vistas, no confundirlas

### Vistas custom EPA (minúsculas, con `ingested_at`)

Curadas por el equipo de dev, con historial más largo. Patrón de nombre:
`ga4_sessions_{property_id}`, `ga4_events_{property_id}`,
`ga4_items_{property_id}`, `ga4_pages_{property_id}`,
`ga4_users_{property_id}`. Cada una tiene su propio grano (ej. `sessions` es
date × sourceMedium × campaign × channelGroup × device; `items` es
date × item × sourceMedium × device). Usar `ingested_at` para dedup de
reprocesos, no para filtrar por fecha del dato.

### Vistas del transfer nativo GA4 (CamelCase)

Reportes estándar de Google: `ga4_TrafficAcquisition_`,
`ga4_UserAcquisition_`, `ga4_EcommercePurchases_`, `ga4_Events_`,
`ga4_PagesAndScreens_`, `ga4_LandingPage_`, `ga4_Promotions_`,
`ga4_Audiences_`, `ga4_DemographicDetails_`, `ga4_TechDetails_`. Usan
`_DATA_DATE`/`_LATEST_DATE` igual que las entidades de Google Ads. Suelen
tener **menos historial** que las vistas custom (el transfer nativo se
activa después).

### Cuándo usar cada set

- **Histórico largo o dashboards existentes:** vistas custom (minúsculas).
- **Reportes estándar de Google (adquisición, ecommerce detallado por
  item):** vistas del transfer nativo, siempre filtrando `_LATEST_DATE`
  para evitar duplicados por snapshot.
- Se solapan en el rango donde ambas tienen datos — no las sumes ni las
  promedies juntas sin decidir cuál es la fuente de verdad para ese módulo.

---

## Gotchas de catálogo (`dim_clients_accounts`)

- Puede tener **filas duplicadas** para la misma cuenta — usar `DISTINCT` o
  agregar antes de un `JOIN` de catálogo, o el join multiplica filas.
- El campo `vertical` llega sucio en la práctica: espacios extra
  (`"Branding  "`), inconsistencia de capitalización (`ecommerce` vs
  `eCommerce`). Normalizar con `TRIM(LOWER(vertical))` antes de agrupar por
  vertical.
