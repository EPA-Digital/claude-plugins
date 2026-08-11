# Control de costo y acceso — BigQuery para dashboards

Un dashboard es **lector**, nunca autor, de `bdd-epa-digital.{cliente}_reporting`.
Este documento cubre lo que un lector necesita: cómo no generar una
factura inesperada, y cómo funciona el acceso cross-project.

---

## Acceso — `bdd-epa-digital` es proyecto separado de `epa-turing`

El service account del dashboard (el que corre el Cloud Run del route
handler) necesita `roles/bigquery.dataViewer` sobre
`bdd-epa-digital.{cliente}_reporting` — no lo tiene por default aunque el
Cloud Run viva en `epa-turing`. Solicitarlo al área de Datos e IA con caso
de uso explícito (qué dashboard, qué cliente, qué dataset).

**Las vistas son read-only para todo runtime.** Escribir en
`{cliente}_reporting` va exclusivamente por el equipo de dev / el ETL
centralizado — nunca desde un dashboard.

---

## Límite de bytes facturados — obligatorio en todo route handler

```typescript
import { BigQuery } from "@google-cloud/bigquery"

const bigquery = new BigQuery({ projectId: "epa-turing" })

const [job] = await bigquery.createQueryJob({
  query: sql,
  params: { cliente: "chedraui" },
  maximumBytesBilled: "104857600", // 100 MB — falla en vez de cobrar de más
})
const [rows] = await job.getQueryResults()
```

Si la query supera el tope, falla en vez de cobrar. Mejor un error visible
que una factura inesperada.

## Dry run antes de una query nueva o pesada

```typescript
const [job] = await bigquery.createQueryJob({
  query: sql,
  dryRun: true,
})
const bytesProcessed = Number(job.metadata.statistics.query.totalBytesProcessed)
console.log(`Procesará ${(bytesProcessed / 1e9).toFixed(2)} GB`)
```

Si el dry run reporta >5 GB, revisar el filtro de fecha antes de correrla
de verdad — ver `epa-bq` regla 5 y `query-recipes.md`.

---

## Por qué falla una query sin filtro de partición

Las vistas del transfer de Google Ads usan
`require_partition_filter = true` en las tablas físicas detrás de ellas —
una query sin `WHERE segments_date >= ...` (o `_DATA_DATE`) **falla**, no
solo escanea de más. No es un bug: es la protección contra el escaneo
completo de una tabla de cientos de millones de filas (ver
`schema-google-transfer.md`).

---

## Excepción Coppel — costos vs. resultados

Si el código toca `ga360-250517.Epa_dataset` (tablas `PMBF_*`):

1. Verificar primero si `bdd-epa-digital.coppel_reporting` existe (mismo
   patrón de lookup que cualquier cliente) — si solo necesitas **costos**,
   preferir ese dataset.
2. Los **resultados** detallados (transacciones por SKU, building blocks
   de funnel) solo están en `ga360-250517.Epa_dataset`, porque el cliente
   los provee así desde Domo.
3. `ga360-250517` es del cliente — nunca escribir ahí, y usar
   `maximumBytesBilled` bajo (50 MB) durante exploración.
4. El prompt de confirmación con el usuario antes de tocar este dataset
   vive en `epa-safe-vibe` (A3.5) — no lo dupliques aquí.

---

## Evitar `SELECT *`

BigQuery cobra por columna leída, no solo por fila. Listar explícitamente
las columnas necesarias reduce costo 5–20× en las vistas anchas del
transfer de Google Ads (`ads_Ad_*`, `ads_Campaign_*` tienen decenas de
columnas).
