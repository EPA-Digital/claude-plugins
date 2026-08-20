---
name: epa-bq
description: >
  Convenciones de los datasets de reporting {cliente}_reporting en
  bdd-epa-digital. Activar cuando el usuario escribe SQL contra BigQuery,
  pregunta qué datos hay de un cliente, construye datasources de un
  dashboard, o menciona tablas ads_*, ga4_*, facebook_ads_*, tiktok_ads_*.
---

# EPA BQ — Convenciones de datos para dashboards

## Regla 0 — Qué dataset usar

```
bdd-epa-digital.{cliente}_reporting   ← EMPEZAR AQUÍ. Datos de medios y
                                         analytics de un cliente, granular
                                         por plataforma y cuenta. Fuente
                                         principal de módulos de dashboard.

bdd-epa-digital.{cliente}_etl.{tabla} ← tablas que produzca el ETL
                                         centralizado (pitagoras-etl). NO es
                                         epa-turing — mismo proyecto que el
                                         reporting, dataset propio por
                                         cliente. Úsalo cuando el dato que
                                         necesitas no está en
                                         {cliente}_reporting.

ga360-250517.Epa_dataset              ← excepción Coppel (Domo). Solo si es
                                         estrictamente necesario — ver
                                         epa-safe-vibe.
```

> ⚠️ **`{cliente}_etl` está en construcción — fases 4-6 del ETL sin
> empezar.** Hoy solo existen datasets `{cliente}_etl_dev`, no hay endpoint
> para crear un config, y ningún dashboard puede leer esto en producción
> todavía. No construyas un dashboard sobre `_etl` sin confirmar el estado
> real con `datos@epa.digital` primero. Cómo se **lee** una vez que exista:
> `references/etl-tables.md`. Qué hacer cuando el dato que falta no está en
> ningún dataset (autorar un config nuevo): `references/etl-config.md`.

**DEPRECADO:** `bdd-epa-digital.epa_agency_reports`. Ya no se usa ni se
duplica — no es la fuente de nada.

**Nunca asumir el sufijo `_reporting`.** No todos los clientes lo usan.
Resolver siempre por lookup antes de la primera query:

```sql
SELECT schema_name
FROM `bdd-epa-digital`.INFORMATION_SCHEMA.SCHEMATA
WHERE LOWER(schema_name) LIKE '%{cliente}%';
```

Si hay más de un candidato, confirmar con el usuario cuál es antes de
continuar. `/client-context {cliente}` hace esta resolución por ti y la deja
documentada — ver regla 6.

> **Quién ejecuta estas queries:** el contenedor `api` (Go), sidecar del
> mismo servicio de Cloud Run — nunca el frontend Next.js (ver
> `epa-frontend` regla 5). Este skill define el *qué*: qué dataset, qué
> vistas, qué casteos. El *cómo* en Go — el repositorio, la parametrización,
> `MaxBytesBilled` — vive en `epa-backend/references/bigquery-repository.md`.

---

## Regla 1 — Deduplicación (aplica a todo el dataset)

Toda tabla `p_ads_*` / `p_ga4_*` es la tabla física particionada detrás de
la vista homónima sin el prefijo `p_`. **Consultar SIEMPRE las vistas,
ignorar las `p_*`.** Si ves un nombre con prefijo `p_` en un resultado de
`INFORMATION_SCHEMA.TABLES`, no es una opción — es la implementación interna
de la vista de al lado.

---

## Regla 2 — Transfers de Google (`ads_*` y `ga4_*` CamelCase)

- **Vistas de entidad** son snapshots diarios → filtrar
  `WHERE _DATA_DATE = _LATEST_DATE` para el estado actual.
- **Vistas de métricas** usan `segments_date` (o `_DATA_DATE` en el
  transfer nativo de GA4) como la fecha del dato.
- **Costos de Google Ads en micros** → dividir entre `1e6`.

Detalle completo, vistas más usadas, join canónico stats↔entidad, y la
distinción entre vistas custom EPA de GA4 vs. transfer nativo:
`references/schema-google-transfer.md`.

---

## Regla 3 — Meta y Bing

- `impressions`, `clicks`, `spend` llegan como **STRING** → `SAFE_CAST`
  antes de agregar, nunca `CAST` a secas.
- `actions` de Meta es un **array JSON** → `JSON_EXTRACT_ARRAY` + `UNNEST`.

Detalle completo, incluido TikTok y DV360: `references/schema-social.md`.

---

## Regla 4 — Frescura

Antes de reportar cualquier número, verificar `data_freshness` — hay
pipelines que se caen (Bing es el más propenso en la práctica). El
dashboard debe mostrar **"Datos al {fecha}"** usando la fecha real de
`data_freshness`, no la fecha de hoy. Receta lista en
`references/query-recipes.md` (receta 10).

Para tablas de `{cliente}_etl`, la fuente de frescura es distinta:
`pitagoras_etl_ops.partitions` (no `data_freshness`, y no las columnas `_*`
de la tabla) — ver `references/etl-tables.md`. `row_count = 0` ahí es
**válido y final**, no una señal de pipeline caído.

---

## Regla 5 — Higiene de queries

- Varias vistas de Google Ads Data Transfer superan el millón de filas (y
  algunas cientos de millones — ver `references/schema-google-transfer.md`).
  Siempre filtro de fecha + `LIMIT` en exploración.
- **Nunca `SELECT *` en código de producción.**
- Toda query, ejecutada desde el contenedor `api` en Go, declara
  `q.MaxBytesBilled` (ver `references/cost-and-access.md` y
  `epa-backend/references/bigquery-repository.md`).

---

## Regla 6 — Contexto por cliente vive fuera de este skill

Los hechos específicos de un cliente (cuentas activas, rangos reales con
datos, vistas vacías, pipelines caídos hoy) **no están en este skill** —
son datos que cambian por cliente y en el tiempo. Se generan con
`/client-context {cliente}` y viven en `docs/client-context.md`, **en el
repo del dashboard**, no en este plugin.

- Si `docs/client-context.md` existe: **leerlo antes de escribir
  queries** — te ahorra adivinar qué cuentas tienen datos.
- Si no existe: sugerir correr `/client-context {cliente}` primero.
