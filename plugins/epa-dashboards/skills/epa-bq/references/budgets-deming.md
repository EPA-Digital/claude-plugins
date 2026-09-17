# Presupuestos / pacing ("Deming") — cómo se lee sin corromper cifras

"Deming" es el apodo interno de **BudgetsAuditor**, un servicio Go en
Cloud Run (`budgets-auditor`, repo `epa-datos/budgets-auditor`) que corre
**diario**: lee los presupuestos evaluables de la colección `budgets` en
Firestore (`bdd-epa-digital`), recalcula gasto/revenue/ROAS contra
BigQuery, y sobrescribe el documento completo de vuelta a Firestore.
`budget-alerts` es un servicio hermano que manda notificaciones sobre esos
mismos presupuestos.

**`deming-mcp` (repo `epa-datos/deming-mcp`) es otra cosa** — un servidor
MCP en desarrollo para que un humano cargue presupuestos *planeados* desde
Google Sheets vía Claude, con diff y confirmación humana obligatoria antes
de escribir. No expone lectura pensada para que un dashboard la consuma en
runtime — si lo ves mencionado, es una herramienta de autoría, no una
fuente de datos.

**Un dashboard nunca llama a `budgets-auditor`, `budget-alerts` ni
`deming-mcp`, y nunca lee la colección `budgets` de Firestore directo**
(ya está en la lista de recursos protegidos — bloqueo total, ver
`epa-safe-vibe`). El único camino correcto es BigQuery, igual que con
`{cliente}_etl`.

---

## ⚠️ Candado de frescura — correr esto ANTES de escribir una query de negocio

```sql
SELECT MAX(synced_at) FROM `bdd-epa-digital.dw_epa_digital.bu_budget_performance`;
```

**Medido en esta sesión (2026-09-17): la última sincronización real fue
`2026-05-17`.** `budgets-auditor` corre diario y sí mantiene Firestore al
día — el job que copia ese resultado a BigQuery lleva **~4 meses
congelado** (mismo patrón en `bu_spend`: `MAX(last_updated)` = `2026-06-06`,
~3 meses). No es una suposición: son las dos consultas de arriba corridas
contra producción.

Esto no invalida el patrón de lectura (BigQuery sigue siendo el único
camino correcto — Firestore sigue protegida). Invalida "usar estos números
con confianza hoy mismo". Antes de cablear un módulo de pacing:

1. Corre la query de arriba.
2. Si la fecha es reciente (el criterio es el mismo que el resto de este
   skill: días, no meses), procede con el resto de este documento.
3. Si sigue congelada como hoy: **no construyas el módulo sobre estos
   datos**. Dile al usuario explícitamente que la sincronización parece
   caída, y que hay que confirmar con Datos e IA (Axel) si es un corte
   temporal o si el pipeline se abandonó, antes de prometer un dashboard
   de presupuestos con esto.

---

## Las tablas — `bdd-epa-digital.dw_epa_digital`

Dataset cross-cliente, existe desde 2021, **no** es `epa_agency_reports`
(ese es un dataset distinto, sí deprecado — los dos existen hoy, no se
reemplazan entre sí). Todas son tablas chicas (miles de filas, no
millones) — no aplica la disciplina de costo de `{cliente}_reporting`,
pero sí `LIMIT`/filtro de fecha en exploración, por higiene.

### `bu_budget_performance` — la de mejor esquema para pacing

```sql
CREATE TABLE bdd-epa-digital.dw_epa_digital.bu_budget_performance (
  firestore_id STRING NOT NULL, account_name STRING, account_id STRING,
  account_postgres_id INT64, name STRING, business_unit STRING,
  effort STRING, currency STRING, start_date DATE, end_date DATE,
  days_passed INT64, last_day DATE, budget FLOAT64, objective FLOAT64,
  roas_objetivo FLOAT64, medios STRING, spend FLOAT64,
  pct_ejecucion FLOAT64, revenue FLOAT64, real_roas FLOAT64,
  pct_roas_vs_objetivo FLOAT64, input_utility FLOAT64,
  input_utility_proy FLOAT64, output_utility FLOAT64,
  output_utility_proy FLOAT64, last_day_spend FLOAT64,
  last_day_revenue FLOAT64, providers STRING, budget_errors_count INT64,
  evaluated_at TIMESTAMP, synced_at TIMESTAMP
)
PARTITION BY DATE_TRUNC(start_date, MONTH)
CLUSTER BY account_name, business_unit;
```

Ya trae ROAS (`real_roas` vs. `roas_objetivo`), `pct_ejecucion` (pacing:
gasto real vs. esperado dado `days_passed`), utilidad, y
`budget_errors_count` — **este último campo se muestra siempre en la UI si
es > 0**, nunca se oculta. Es el propio auditor diciendo "algo no cuadra
en este presupuesto", y silenciarlo es peor que no tener el dato.

### `bu_budgets` — la definición cruda, sin performance

```sql
CREATE TABLE bdd-epa-digital.dw_epa_digital.bu_budgets (
  client_id INTEGER, client_name STRING, name STRING, business_unit STRING,
  branding_objetive_type STRING, mediums STRING, budget NUMERIC,
  objective NUMERIC, currency STRING, start_date STRING, end_date STRING,
  firestore_id STRING, campaign_name STRING, effort STRING, accounts STRING
);
```

Útil para listar qué presupuestos existen/están vigentes, sin el cálculo
de performance. No tiene columna de timestamp propia — asume la misma
frescura que `bu_budget_performance` hasta que se demuestre lo contrario
(mismo `firestore_id` de origen).

### `bu_spend` — gasto, pero de OTRA fuente

```sql
CREATE TABLE bdd-epa-digital.dw_epa_digital.bu_spend (
  client_id INT64, client_name STRING, period_start DATE, period_end DATE,
  medium STRING, spend NUMERIC, currency STRING, is_live BOOL,
  last_updated TIMESTAMP
)
PARTITION BY period_start;
```

**Sincroniza desde Pitágoras MCP, no desde `budgets-auditor`** — es una
fuente distinta a `bu_budget_performance.spend`, y hoy está igualmente
congelada (`MAX(last_updated)` = `2026-06-06`, solo 270 filas de 34
clientes). No asumir que es intercambiable con el `spend` de
`bu_budget_performance` ni usarla como respaldo silencioso — si
`bu_budget_performance` falla la verificación de frescura, `bu_spend`
probablemente también.

### `cl_clients` — mapeo de cliente, con una trampa real

```sql
CREATE TABLE bdd-epa-digital.dw_epa_digital.cl_clients (
  client_id INT64, client_name STRING, country_code STRING,
  timezone STRING, currency STRING, status STRING
);
```

`client_name` es un **nombre de negocio para humanos**, no el slug
`{cliente}` que usan `_reporting`/`_etl` — resolver siempre por `LIKE`,
nunca por igualdad exacta contra el slug. Y **puede haber varios
`client_id` para la misma marca**, medido contra datos reales:

```sql
-- Coppel tiene 8 client_id distintos, no 1:
-- Coppel, Coppel Ecommerce, Coppel Fintech, Coppel Branding, Coppel COOP,
-- Coppel Sale Vale, Coppel Argentina, Coppel Comercializadora (+ Coppel Pruebas)
SELECT client_id, client_name FROM `bdd-epa-digital.dw_epa_digital.cl_clients`
WHERE LOWER(client_name) LIKE '%coppel%';
```

Un dashboard de un cliente con varias unidades de negocio necesita la
lista completa de `client_id`s aplicables, no asumir que hay uno solo.
Igual que `BQAdsMCC` en `epa-backend`, esta lista se resuelve **una vez**
al forkear el dashboard y se fija en config validada al arrancar — nunca
se adivina desde un valor de request.

---

## Parametrización — más simple que `{cliente}_etl`

A diferencia de `{cliente}_etl` (donde el nombre del dataset **es** un
identificador interpolado, validado por regex al arrancar), aquí el
dataset es fijo (`dw_epa_digital`) y `client_id` es un valor de filtro
normal:

```go
sql := `
  SELECT * FROM ` + "`bdd-epa-digital.dw_epa_digital.bu_budget_performance`" + `
  WHERE account_id IN UNNEST(@clientIds)
`
q.Parameters = []bigquery.QueryParameter{
    {Name: "clientIds", Value: cfg.DemingClientIDs}, // []int64 desde config, no del request
}
```

`client_id`/`account_id` van por `@parameter` como cualquier otro valor —
no necesitan el carve-out de identificadores de `epa-backend` regla 5,
porque no forman parte del nombre de la tabla ni del dataset.

---

## Calidad del dato — mostrar el caveat, no esconderlo

Dos problemas reales en cómo `budgets-auditor` calcula estos números, ya
documentados y en el backlog del propio equipo (`NEW-BUDGETS.md` del repo
— **no hace falta reportarlos de nuevo**, solo tenerlos presentes al
diseñar la UI):

- **Atribución por regex de campaña, sin verificar cuenta.** El revenue de
  Google Ads puede estar sobreestimado hasta ~37% porque el matching
  campaña→cuenta no es exacto. Facebook/TikTok están limpios (~97-100% de
  cobertura correcta); Google Ads y DV360 no.
- **Monedas:** si la cuenta y el presupuesto están en monedas distintas, el
  ROAS mostrado puede estar mal calculado (revenue en una moneda dividido
  entre gasto en otra) — el auditor no convierte.

Consecuencia para el dashboard: mostrar `budget_errors_count` siempre que
sea > 0, y no presentar `real_roas`/`revenue` como una cifra absoluta sin
matizar — un patrón razonable es un ícono/tooltip de "atribución
aproximada" en presupuestos con medio Google Ads o DV360, siguiendo el
mismo principio de `epa-bq` regla 4 (frescura visible, nunca oculta).

---

## Resumen

- Solo lectura, solo BigQuery, solo `dw_epa_digital` — nunca Firestore,
  nunca las Cloud Run de Deming, nunca `deming-mcp`.
- Verificar frescura (`MAX(synced_at)`) **antes** de cualquier query de
  negocio — hoy (2026-09-17) esa verificación falla; escalar a Datos e IA
  antes de construir el módulo, no construirlo sobre datos de hace 4 meses.
- `bu_budget_performance` para pacing/ROAS, `bu_budgets` para listar
  presupuestos, `bu_spend` con desconfianza (otra fuente, igual de
  congelada), `cl_clients` para resolver `client_id` — nunca 1:1 con el
  slug `{cliente}`.
- `budget_errors_count` y las limitaciones de atribución/moneda se
  muestran, nunca se ocultan.
