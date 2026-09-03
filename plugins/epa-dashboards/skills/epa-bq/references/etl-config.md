# Cuando el dato no está en `{cliente}_reporting` — autorar un config de `epa-etl`

`epa-datos/epa-etl` (`pitagoras-etl`) ya trae un `AGENTS.md` escrito
**literalmente para esta audiencia** — una sesión de Claude Code en el repo
de un dashboard de cliente que necesita autorar un config. Este documento es
el resumen accionable con lo que ese `AGENTS.md` explica; para el contrato
completo, léelo ahí, no lo dupliques de memoria.

---

## La regla de entrada — esto no es una tabla propia del dashboard

**Autorar un config es proponer un cambio a un ETL compartido entre todos
los dashboards de EPA**, no crear un recurso del proyecto actual. Antes de
escribir un config:

1. Propón el config al usuario (qué provider, qué cuentas, qué dimensiones
   y métricas) y **espera confirmación explícita** — nunca lo crees porque
   "parece razonable".
2. Confírmalo con `datos@epa.digital` / Axel — es quien mantiene el ETL y
   quien puede decir si ya existe algo equivalente.
3. **Podés llamar la API vos mismo**, con el `gcloud` de la persona con la
   que estás trabajando — no hace falta esperar a que alguien de Datos e
   IA lo cree por ti, y funciona contra los dos entornos:

   ```bash
   curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
     https://pitagoras-etl-prod-l6dmrzkz7a-uc.a.run.app/configs   # o la URL de dev
   ```

   El servicio acepta el id token de cualquier cuenta `@epa.digital` — no
   necesita Identity Platform ni una service account nueva (ver
   `AGENTS.md` del repo de `epa-etl` para el detalle). Dos cosas que eso
   implica: **el token dura 1 hora** (nada desatendido, se vuelve a pedir
   y listo), y **el config queda a nombre de esa persona** — gasta su
   cuota de Pitágoras (100 llamadas/día) y extrae con sus permisos. Si no
   tiene acceso al cliente en Pitágoras, el config valida y **nunca trae
   datos**, sin error visible en ningún lado — por eso el paso 2 sigue
   siendo confirmar con Axel antes de crear, no solo con quien te lo pidió.

---

## El contrato, en una vista rápida

```
client: str        # slug de dataset BQ: ^[a-z][a-z0-9_]*$ — sin guiones
dashboard: str      # slug con guiones permitidos: ^[a-z][a-z0-9-]*$
owner: str          # email — de quién es la credencial que extrae. Obligatorio, SIN default
environment: "prod" | "dev"   # obligatorio, SIN default
extraction: {...}   # unión discriminada por provider — ver abajo
dimensions: [...]   # nombres canónicos, opcional
metrics: [...]      # nombres canónicos, ≥1, obligatorio
granularity: "daily" | "hourly" = "daily"
load: {mode: "replace_window", window_days: 1-90}
notifications: {emails: [...], dedup_days: 1-30}
status: "active" | "superseded" | "retired" = "active"
```

Todo lo derivado (`config_id`, `dataset`, `table`, `grain_hash`,
`clustering`) **no se escribe** — sale de la tupla de entidades, siempre.

### Los 4 providers y sus campos de cuenta

| `provider` | Campos de cuenta | Campo extra |
| :-- | :-- | :-- |
| `facebook` | `account_id`, `name` | — |
| `adwords` | + `login_customer_id` (MCC) | `resource` |
| `analytics4` | + `property_id`, `credential_email` | — |
| `tik-tok` | `account_id`, `name` | `data_level` |

---

## Vocabulario cerrado — no se inventa una entrada

`pitagoras-etl` **rechaza** cualquier métrica o dimensión fuera de este
vocabulario:

- **Métricas:** `impressions clicks cost sessions users conversions
  conversion_value`, más `conversions_<action_type>` /
  `conversion_value_<action_type>` (p. ej. `conversions_purchase` — para
  Facebook, `conversions` a secas **no** se acepta, porque `actions` es un
  array de valores distintos y sumarlos no significa nada).
- **Dimensiones**, por entidad (pedir cualquiera de las dos da la misma
  tabla): `campaign` (`campaign_id`/`campaign_name`), `adset`, `ad`,
  `creative`, `keyword`, `audience`, `product`, `placement`, `device`,
  `geo`, `age`, `gender`, `landing`, `channel`.
- **Prohibido siempre:** tasas (`ctr`, `cpc`, `cpa`, `cpm`, `roas`, `cvr`) —
  se derivan en query, nunca se piden como métrica.
- `date`/`hour` no se declaran en `dimensions` — son tiempo, no grano; se
  descartan en silencio si se incluyen.

**El campo que necesitas y no está en ninguna lista no se inventa.** Entrar
al vocabulario exige un **fixture grabado** contra la API real de Pitágoras
que pruebe que el campo existe y con qué tipo llega (invariante 8 de
`epa-etl`) — es la defensa contra un mapping plausible-pero-falso
(`facebook.reach → reach` suena bien y puede no existir), que es
exactamente el modo de falla de un agente escribiendo esto sin evidencia.
Mientras no exista el fixture, el dato viaja igual dentro de `extras`
(columna `STRING` con JSON), sin declararse en el config.

---

## Lo que rechaza un config, con el motivo

| Regla | Por qué |
| :-- | :-- |
| Campo con typo (`extra="forbid"`) | **Falla**, no se ignora — un campo ignorado en silencio produce el grano equivocado sin error |
| Dimensión con entidad fuera de `ENTITY_RANK` | Rechazo explícito — pedir la entrada nueva antes de usarla, nunca un rank 99 automático |
| `status: "superseded"` sin `superseded_by` | Deja una tabla huérfana — ver `etl-tables.md` |
| `status: "active"` con `superseded_by` seteado | Contradictorio |
| Dimensiones o métricas duplicadas | Lista los duplicados por nombre |

---

## Modificar un config existente

- **Agregar una métrica es seguro** — sube `schema_version`, la tabla
  acepta la columna nueva vía `ALLOW_FIELD_ADDITION`.
- **Cambiar `dimensions` NO es editar el config: es tabla nueva.** Config
  nuevo activo + el viejo marcado `superseded` con `superseded_by`
  apuntando al nuevo, en la misma operación. Dejar un `superseded` sin
  sucesor es el riesgo de tabla huérfana de `etl-tables.md`.
- El orden del array de `dimensions` nunca importa — lo decide
  `ENTITY_RANK` internamente.

---

## Si algo de esto no cuadra

El código de `epa-etl` (`core/config.py`, `core/grain.py`,
`core/vocabulary.py`, `core/validate.py`) es la fuente de la verdad, no este
resumen ni el `AGENTS.md` de ese repo. Si un config que según esto debería
pasar es rechazado, o viceversa, es una señal para preguntar a
`datos@epa.digital`, no para ajustar el config a prueba y error.
