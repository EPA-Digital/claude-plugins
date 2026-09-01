# Tablas del ETL centralizado (`{cliente}_etl`) — cómo se leen

Fuente: `epa-datos/epa-etl` (`pitagoras-etl`), HEAD `f43359f` al escribir
esto. Este documento resume solo lo que un dashboard necesita para **leer**
esas tablas sin corromper cifras — la especificación completa vive en
`docs/plan.md` de ese repo, y `AGENTS.md` ahí está escrito para quien
**autora un config** nuevo (ver `etl-config.md` en este mismo skill).

> ⚠️ **Candado de estado, no una formalidad.** Las fases 4, 5 y 6 del ETL ya
> están construidas y desplegadas — `POST /configs` existe, y hay
> producción real en `bdd-epa-digital` desde 2026-08-31. Pero **producción
> tiene horas de vida, no meses**: su primer ledger se purgó por un bug real
> (el `PROBE` de prod confundió sus propios load jobs con los de `dev`) y el
> criterio del plan para dar por estable un config productivo —3 días
> corriendo sin intervención— todavía no se cumple. **Ningún dashboard
> debería leer una tabla `{cliente}_etl` en producción todavía**, no porque
> no exista, sino porque nadie la ha visto estable el tiempo suficiente.
> Antes de cablear un chart contra esto, confirma con `datos@epa.digital`
> que la tabla que necesitas ya lleva varios días estable — no asumas que
> "la tabla existe en BigQuery" es lo mismo que "los datos son confiables".

---

## Nombre — derivado, nunca escrito a mano

```
bdd-epa-digital.{cliente}_etl.{provider}_{grano}_{periodicidad}
                                                  (dev: {cliente}_etl_dev)
```

Ejemplos reales del plan: `chedraui_etl.facebook_campaign_age_gender_daily`,
`chedraui_etl.adwords_campaign_daily`, `innovasport_etl.ga4_landing_daily`.
El nombre sale de una sola tupla ordenada (`Grain`) junto con el hash de
identidad y el clustering — **nunca lo construyas por convención**, resuélvelo
por lookup:

```sql
SELECT table_name
FROM `bdd-epa-digital.{cliente}_etl`.INFORMATION_SCHEMA.TABLES;
```

Slugs de provider que puedes ver en el nombre: `tik-tok` → `tiktok`,
`analytics4` → `ga4` (los nombres nativos solo aparecen en el bloque de
extracción del config, nunca en el nombre de tabla).

---

## `require_partition_filter = TRUE` — toda query filtra `date`, o falla

A diferencia de muchas vistas de `{cliente}_reporting`, toda tabla que
genera el ETL se crea con `require_partition_filter = TRUE`. Una query sin
condición sobre `date` no escanea de más — **falla** directamente. Es la
misma disciplina de fecha que el service Go de `epa-backend` ya aplica
(regla 5: fechas validadas antes de tocar BigQuery) — aquí no es una
convención nueva, es que BigQuery la exige.

---

## Dinero: `NUMERIC(35, 6)`, nunca `FLOAT64`

Todo campo de dinero en `{cliente}_etl` es `NUMERIC(35, 6)` — 35 y no 38
porque BigQuery exige `P - S <= 29`. En SQL se agrega sin castear. En Go, el
destino del scan **no es `float64`** — verificar en el primer `go build` qué
tipo usa el driver para preservar la escala exacta (ver la nota equivalente
en `epa-backend/references/bigquery-repository.md`).

---

## Tasas: nunca almacenadas, siempre derivadas en query

`ctr`, `cpc`, `cpa`, `cpm`, `roas`, `cvr` no existen como columna en ninguna
tabla del ETL — invariante 6 de `epa-etl`. Agregarlas es siempre:

```sql
SUM(cost) / NULLIF(SUM(clicks), 0)   -- nunca AVG(cpc)
```

Promedio de promedios no es promedio — un `AVG(cpc)` sobre filas con
volúmenes distintos da un número que no corresponde a ningún gasto real.

---

## `cost` ya viene dividido — nunca dividir entre 1e6 aquí

**Citando la invariante 1 de `epa-etl` literal:** *"Pitágoras ya lo
divide. Dividir otra vez da costos entre 1e12."* Esto es **lo contrario**
de `{cliente}_reporting`, donde el transfer nativo de Google Ads sí llega en
micros y sí hay que dividir (ver regla 2 de este skill) — es la confusión
más probable entre las dos fuentes, y la más silenciosa: la query corre, el
chart renderiza, la cifra está mal por un factor de un millón.

(Esta afirmación viene de la mitad **vocabulario** de `epa-etl`
— qué tipo y qué unidad tiene `cost`, no de la mitad **mapping**
nativo→canónico, que `epa-etl` mismo marca como bloqueada/provisional hasta
tener un fixture grabado. Si necesitas ese detalle, es una pregunta para
`epa-etl`, no algo que este documento pueda confirmar.)

---

## `extras` es `STRING`, nunca asumas el tipo `JSON`

El vocabulario del ETL no tiene el tipo `JSON` a propósito — un load job de
BigQuery lo rechaza. Cualquier campo nativo sin canónico viaja en la
columna `extras` como `STRING` con JSON serializado:

```sql
SAFE.PARSE_JSON(extras) -- o JSON_VALUE(extras, '$.campo') para un campo puntual
```

Los campos `x_` sí son columnas tipadas — son nativos ya promovidos desde
`extras`, y se leen como cualquier otra columna.

---

## Columnas `_*` — son de operación, no de negocio

`_config_id`, `_config_version`, `_run_id`, `_ingested_at` están en toda
tabla. **Nunca se exponen en la UI de un dashboard.** Y en particular:
`_ingested_at` **no es frescura del dato** — es cuándo corrió el load job,
no qué tan reciente es la información que contiene. Para frescura real, ver
la sección siguiente.

---

## Frescura real: el ledger, no la tabla

La fuente de frescura de `{cliente}_etl` es `pitagoras_etl_ops.partitions`
(copia analítica del ledger de Firestore, location `US`), no `data_freshness`
como en `{cliente}_reporting` (regla 4 de este skill) y no `_ingested_at`.

```sql
SELECT config_id, MAX(partition_date) AS ultima_particion
FROM `bdd-epa-digital.pitagoras_etl_ops.partitions`
WHERE config_id = '{config_id}'
GROUP BY config_id;
```

**`row_count = 0` en una fila del ledger es válido y final** — un día sin
datos legítimamente no es un hueco ni un pipeline caído. No lo trates igual
que una tabla vacía en `{cliente}_reporting`.

---

## Moneda: el ETL nunca convierte

Si las cuentas de un cliente tienen monedas mixtas, la conversión **no**
ocurre en el ETL — vive en vistas de BigQuery, si es que existe. No sumes
`cost` entre cuentas de distinta moneda asumiendo que ya está normalizado;
confirma la moneda por cuenta (`POST /customers` de Pitágoras la expone) y
escala a `datos@epa.digital` si necesitas conversión y no existe todavía.

---

## El riesgo real: tabla huérfana

Un config marcado `superseded` sin que su reemplazo (`superseded_by`) tenga
datos frescos deja una tabla que **dejó de actualizarse pero sigue
respondiendo queries sin error**. Un dashboard apuntado ahí muestra números
viejos indefinidamente, sin ningún síntoma visible. Antes de cablear un
chart nuevo contra `{cliente}_etl`:

1. Verifica en el ledger (`pitagoras_etl_ops.partitions`) que la tabla tiene
   partición reciente.
2. Si tienes acceso al store de configs, confirma que el config que la
   produce está `active`, no `superseded`.
3. Si algo no cuadra, es una pregunta para `datos@epa.digital` antes de
   construir sobre esa tabla — no una que puedas resolver adivinando.
