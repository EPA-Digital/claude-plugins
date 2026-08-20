---
description: "Genera docs/client-context.md con los datos reales del cliente en BigQuery"
argument-hint: "[cliente]"
---

# /client-context — Contexto real de datos de un cliente

Cliente objetivo: `$1` (si no se dio, pregúntalo antes de continuar).

Genera (o actualiza) `docs/client-context.md` con los hechos reales de
BigQuery para este cliente: qué cuentas existen, qué pipelines están al día,
qué vistas tienen datos y en qué rango. Este documento es lo que `epa-bq`
y `/plan-dashboard` leen para no adivinar contra datos que no existen.

## Paso 0 — Resolver el dataset real

**Nunca asumas el sufijo `_reporting`.** Corre:

```sql
SELECT schema_name
FROM `bdd-epa-digital`.INFORMATION_SCHEMA.SCHEMATA
WHERE LOWER(schema_name) LIKE '%$1%';
```

Este mismo `LIKE` trae también, si existen, `{cliente}_etl` y
`{cliente}_etl_dev` — las tablas del ETL centralizado (`pitagoras-etl`, ver
`epa-bq/references/etl-tables.md`). **No los confundas con el dataset de
reporting**: son dos cosas distintas, con reglas de lectura distintas
(frescura por `pitagoras_etl_ops.partitions`, no `data_freshness`; dinero ya
sin dividir; `require_partition_filter`). Repórtalos por separado en el
documento final, y si solo existe `_etl_dev`, anótalo explícitamente como
"no productivo — no construir sobre esto sin confirmar con
`datos@epa.digital`".

- Si hay exactamente un candidato de reporting, úsalo como `{dataset}` para
  el resto del comando.
- Si hay más de uno, muéstralos y pregunta al usuario cuál es el correcto.
- Si no hay ninguno, detente y dile al usuario que no encontraste un
  dataset para ese cliente en `bdd-epa-digital` — puede ser un cliente
  nuevo sin onboarding de datos, o un nombre distinto. No sigas adivinando.

## Paso 1 — Verificar acceso

```bash
bq query --use_legacy_sql=false 'SELECT 1'
```

Si falla por auth: instruye al usuario a correr
`gcloud auth application-default login` y **detente** — no continúes sin
acceso confirmado.

## Paso 2 — Ejecutar en orden (proyecto `bdd-epa-digital`, dataset `{dataset}` del paso 0)

Ejecuta estas queries en este orden. Respeta el comentario "una query por
familia, no por vista" — es para no quemar slots en clientes con cientos de
vistas.

1. **Cuentas del cliente:**
   ```sql
   SELECT DISTINCT *
   FROM `bdd-epa-digital.{dataset}.dim_clients_accounts`
   WHERE LOWER(client_name) LIKE '%$1%';
   ```
   (con `DISTINCT` — esta tabla puede tener filas duplicadas). Anota
   plataforma, vertical, estado por cuenta.

2. **Frescura de pipelines:**
   ```sql
   SELECT * FROM `bdd-epa-digital.{dataset}.data_freshness`;
   ```
   Anota qué plataformas están al día y cuáles detenidas, con la fecha del
   último dato exitoso.

3. **Inventario de vistas:**
   ```sql
   SELECT table_name
   FROM `bdd-epa-digital.{dataset}`.INFORMATION_SCHEMA.TABLES
   WHERE table_name NOT LIKE 'p\_%' ESCAPE '\';
   ```
   Excluye las `p_*` (regla 1 de `epa-bq`) — no son opciones, son la
   implementación física de la vista de al lado.

4. **Rangos reales por familia de vistas** (una query por familia —
   `ads_*`, `ga4_*`, `facebook_ads_*`, `tiktok_ads_*`, `bing_ads_*`,
   `dv360_ads_*` — no una por cada vista individual):
   ```sql
   SELECT MIN(date) AS min_date, MAX(date) AS max_date, COUNT(*) AS filas
   FROM `bdd-epa-digital.{dataset}.{vista_representativa_de_la_familia}`;
   ```
   Si una vista devuelve 0 filas, es una **vista vacía** — anótala como tal,
   no como error.

## Paso 3 — Escribir `docs/client-context.md`

Sigue **exactamente** la estructura de referencia (secciones en este orden):

```
# Contexto: dataset `bdd-epa-digital.{dataset}`

(Párrafo de resumen: vertical del cliente, moneda, timezone, frescura
típica. Regla de deduplicación p_* en una línea.)

## 1. Tablas de control
### `dim_clients_accounts`
(tabla de cuentas por plataforma, marcando las sin datos)
### `data_freshness`
(estado por plataforma, pipelines detenidos con fecha)

## 2. Google Ads — Data Transfer nativo
(sufijo MCC, vistas más usadas, rango de datos, join canónico)

## 3. GA4
(vistas custom vs. transfer nativo, propiedad, rangos)

## 4. Meta / Facebook Ads
(cuentas, schema, rangos con datos)

## 5. TikTok Ads
(cuentas, schema, rangos con datos)

## 6. Otras plataformas
(Bing, DV360 — o lo que aplique)

## 7. ETL centralizado (`{cliente}_etl`)
(Si existe `{cliente}_etl` o `{cliente}_etl_dev`: qué tablas tiene y su
estado — productivo o solo `_dev`. Si no existe ninguno, dilo explícito en
una línea; no omitas la sección en silencio.)

## Recomendaciones de uso (para queries)
(lista numerada: ignorar p_*, filtros de fecha correctos, casts necesarios,
unidades de costo, verificar frescura, LIMIT en exploración)
```

Marca explícitamente: cuentas sin datos, pipelines detenidos (con fecha del
último dato), y el rango real (min/max date) por cada fuente con datos.

**No inventes secciones para plataformas que el cliente no usa** — si no
hay TikTok, omite esa sección o dila explícitamente vacía.

## Paso 4 — Si el archivo ya existía

Antes de sobreescribir, compara contra el `docs/client-context.md` anterior
y muestra al usuario un diff resumido: cuentas nuevas, cuentas dadas de baja,
pipelines que cambiaron de estado (nuevo caído / recuperado). No sobreescribas
en silencio.
