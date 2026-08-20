# Control de costo y acceso — BigQuery para dashboards

Un dashboard es **lector**, nunca autor, de `bdd-epa-digital.{cliente}_reporting`.
Este documento cubre lo que un lector necesita: cómo no generar una
factura inesperada, y cómo funciona el acceso cross-project. El *código*
que implementa esta política vive en
`epa-backend/references/bigquery-repository.md` — este documento es la
política y los números, no el código.

---

## Acceso — `bdd-epa-digital` es proyecto separado de `epa-turing`

Solo la SA de runtime del dashboard (`{cliente}-dashboard-runtime` —
compartida por los contenedores `web` y `api`, ver
`epa-deploy/references/cloud-run-config.md`) necesita permisos de
BigQuery, y necesita **dos roles**, no uno:

- `roles/bigquery.jobUser` sobre `epa-turing` — permiso para **correr**
  queries. Sin este rol, la primera query del contenedor `api` da 403
  "`Access Denied: bigquery.jobs.create`" **aunque `dataViewer` ya esté
  otorgado** — es el error más común al desplegar por primera vez.
- `roles/bigquery.dataViewer` sobre `bdd-epa-digital.{cliente}_reporting`
  — permiso para **leer** ese dataset específico, y solo ese.

Ninguno de los dos sustituye al otro. Solicitarlos al área de Datos e IA
con caso de uso explícito (qué dashboard, qué cliente, qué dataset) si no
tienes acceso para otorgarlos tú mismo.

**El frontend (`apps/web`) no necesita ningún permiso de BigQuery** — nunca
declara un cliente de BigQuery en su código (ver `epa-frontend` regla 5).
Que la SA sea compartida entre los dos contenedores (arquitectura de
sidecar, ver `epa-backend/references/sidecar.md`) no cambia esto: el
control de que `web` nunca la use en código es lo que hace que el permiso
heredado no importe en la práctica.

**Las vistas son read-only para todo runtime.** Escribir en
`{cliente}_reporting` va exclusivamente por el equipo de dev / el ETL
centralizado — nunca desde un dashboard.

---

## Límite de bytes facturados — obligatorio en toda query

Toda query que corre el contenedor `api` declara un tope de bytes
facturados antes de ejecutarse — si lo supera, **falla en vez de cobrar de
más**. Mejor un error visible que una factura inesperada.

```
Default:                          100 MB  (104,857,600 bytes)
Exploración en ga360-250517:       50 MB  (más conservador — dataset del cliente)
```

El código que aplica estos números — `q.MaxBytesBilled` centralizado en
`newQuery()`, para que ninguna query del repositorio pueda saltárselo —
vive en `epa-backend/references/bigquery-repository.md`. No se duplica
aquí porque el código y la política divergen si viven en dos archivos: el
número correcto está en un solo lugar y el otro apunta a él.

## Dry run antes de una query nueva o pesada

El repositorio Go incluye un helper de `DryRun` (`DryRunEstimate` en
`bigquery-repository.md`) que devuelve los bytes que procesaría una query
sin correrla. Si reporta >5 GB, revisar el filtro de fecha antes de
correrla de verdad — ver `epa-bq` regla 5 y `query-recipes.md`.

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
