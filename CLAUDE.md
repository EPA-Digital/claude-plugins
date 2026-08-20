# CLAUDE.md — EPA Digital · epa-dashboards

Contexto maestro para cualquier sesión de Claude Code que toque este repo
o un dashboard generado con él.

**Qué es este repo:** el marketplace de un solo plugin, `epa-dashboards`,
exclusivo para generar y estandarizar dashboards de EPA Digital. Invariantes
al mantenerlo: `marketplace.json` tiene **una** entrada, el plugin tiene
**6 skills** (`epa-frontend`, `epa-backend`, `epa-bq`, `epa-design`,
`epa-deploy`, `epa-safe-vibe`) + 4 comandos + 1 agente + 1 hook en
`hooks/` (raíz del plugin), y **este repo no hospeda paquetes npm** — si
algún día el kit `@epa/*` de la plataforma de dashboards quiere vivir aquí,
es una decisión deliberada del equipo, no una deriva. Validar siempre con
`claude plugin validate .` antes de un PR.

---

## Contexto de la organización

**EPA Digital** es una agencia de marketing de performance con HQ en
LATAM (~170 personas). Cartera de clientes activos (entre otros): ABInBev,
AMVO, Coppel, Chedraui, Farmacias del Ahorro, Innovasport, Nestlé y UVM —
orientación solamente, resolver siempre el dataset real por lookup (ver
más abajo), nunca asumir que un cliente tiene dashboard o dataset por
estar en esta lista.

---

## Proyecto GCP

```
Nombre:          epa-turing
Project number:  689827400521
Project path:    projects/689827400521
Región default:  us-central1
```

**Casi todo runtime de dashboards vive en `epa-turing`.** Excepciones
notables:

```
bdd-epa-digital      ← BigQuery canónico de la agencia — un dataset por
                       cliente: {cliente}_reporting. Resolver el nombre
                       exacto por lookup en INFORMATION_SCHEMA.SCHEMATA,
                       no asumir el sufijo. NUNCA desplegar servicios aquí
                       (ver incidente Newton, epa-safe-vibe).

ga360-250517         ← BigQuery exclusivo de Coppel (dataset Epa_dataset)
                       Tablas PMBF_*, vienen desde Domo.
                       NO usar salvo necesidad explícita confirmada con el usuario.
```

---

## Modelo de datos

```
bdd-epa-digital.{cliente}_reporting   ← fuente de verdad. Granular por
                                         cliente y plataforma de medios.
bdd-epa-digital.{cliente}_etl.{tabla} ← tablas del ETL centralizado
                                         (pitagoras-etl, en construcción por
                                         Datos e IA). NO es epa-turing —
                                         mismo proyecto que el reporting.
ga360-250517.Epa_dataset              ← excepción Coppel (Domo).
```

**`{cliente}_etl` vive en `bdd-epa-digital`, no en `epa-turing`.** Es una
corrección de hecho sobre la spec original del ETL, que asumía `epa-turing`
por error. La location del dataset **sigue al cliente** (D2 de
`pitagoras-etl`): `chedraui_etl` nace en `us-central1` porque ahí vive
`chedraui_reporting` — BigQuery no cruza locations en un `JOIN` — mientras
que el ledger operativo (`pitagoras_etl_ops`) vive en `US`, porque es del
servicio, no de un cliente. **Estado real hoy: fases 4-6 del ETL sin
empezar** — solo existen datasets `{cliente}_etl_dev`, no hay endpoint para
crear configs, y ningún dashboard puede leer `_etl` en producción todavía.
Detalle completo, incluido cuándo y cómo leerlo una vez que exista:
`skills/epa-bq/references/etl-tables.md` y `etl-config.md`.

**DEPRECADO:** `bdd-epa-digital.epa_agency_reports`. No existe reemplazo
cross-cliente — un rollup entre varios clientes se escala a Datos e IA.

---

## Stack canónico

```
Frontend:        Next.js 15 App Router + Tailwind CSS + pnpm, en Cloud Run
Backend:         Go + gin, forkeado por dashboard de epa-standards-backend,
                 desplegado como sidecar del mismo servicio (nunca un
                 servicio propio) — el único que consulta BigQuery
Datos:            BigQuery (bdd-epa-digital.{cliente}_reporting)
CI/CD:           GitHub Actions → Artifact Registry → Cloud Run
Branding:        EPA Blue #003AD6, IBM Plex Sans/Mono
```

Detalles completos: skills `epa-frontend` y `epa-backend` del plugin.

---

## Pitágoras — contexto mínimo

Pitágoras es la capa de integración de medios de la agencia. **Un
dashboard nunca la llama** — su único consumidor es el ETL centralizado
(`pitagoras-etl`). El MCP de Pitágoras (Tokyo) está deprecado. Si un dato de
medios no está en `{cliente}_reporting`, se escala a `datos@epa.digital`.

No es solo una convención — está reforzado por lo que el propio ETL midió
contra la API real: la autenticación de Pitágoras es un **JWT de sesión de
una persona** (no una API key), con cuota de **100 llamadas/día por
usuario**, y toda programación de un job **muere a los 7 días exactos**. Un
dashboard no tiene ninguna de esas tres cosas resueltas — ni credencial de
servicio, ni renovación, ni identidad — así que llamarla directo no es solo
una violación de la regla, es algo que no puede funcionar de forma
sostenida.

---

## Repos hermanos

Dos repos fuera de `claude-plugins` que una sesión de dashboard puede
necesitar leer o consumir:

```
epa-datos/epa-ui    ← Librería de componentes de producto (owner: iescutia).
                       Se copia a commit fijado, no se instala como paquete
                       — ver epa-design/references/epa-ui.md.
epa-datos/epa-etl   ← pitagoras-etl, el ETL centralizado (owner: AxelRuiz123).
                       Su AGENTS.md está escrito para quien autora un config
                       desde el repo de un dashboard — ver
                       epa-bq/references/etl-config.md.
```

---

## Recursos protegidos — bloqueo total

NO modificar, eliminar ni sobreescribir sin autorización del **área de
Datos e IA** (`datos@epa.digital`):

```
Firestore (bdd-epa-digital — nombres en lowercase, son colecciones legacy):
  users, clients, budgets

Secret Manager (epa-turing):
  FacebookAccessToken, TiktokToken, GoogleAdsYAML, BingAccessTokenEpa

Cloud Run (proyectos varios):
  epa-dashboard (Newton, en bdd-epa-digital) · pitagoras-api (epa-turing)
  — cualquier servicio SIN sufijo -vibe puede ser producción real.
```

Detalles y procedimientos de recuperación:
`plugins/epa-dashboards/skills/epa-safe-vibe/references/protected-resources.md`.

---

## El plugin de este repo

`epa-dashboards` — un solo plugin, 6 skills, se activan solas según el
contexto:

| Skill | Cubre |
|---|---|
| `epa-frontend` | Stack cerrado (Node 22, pnpm, Next.js, TS estricto, Tailwind, Recharts), auth |
| `epa-backend` | Backend en Go por dashboard (fork de epa-standards-backend), BigQuery, sidecar |
| `epa-bq` | Convenciones de `{cliente}_reporting`, control de costo |
| `epa-design` | Design system EPA (tokens, componentes, copy) |
| `epa-deploy` | Deploy a Cloud Run vía GitHub Actions (dos contenedores) |
| `epa-safe-vibe` | Guardrails de seguridad + hook de deploy |

Más 4 comandos (`/plan-dashboard`, `/client-context`, `/critique-epa`,
`/migrate-to-epa`) y el agente `security-reviewer`.

Instalación:
```
claude plugin marketplace add EPA-Digital/claude-plugins
claude plugin install epa-dashboards@epa-plugins
```

O dejar que `extraKnownMarketplaces`/`enabledPlugins` en
`.claude/settings.json` lo hagan automáticamente al confiar en el folder.

---

## Reglas de oro para dashboards en epa-turing

1. **Datos de medios → siempre `{cliente}_reporting` en BigQuery, leídos
   desde el backend Go.** Nunca directo a Meta/Google Ads/TikTok/Bing ni a
   Pitágoras, y nunca desde el frontend — el frontend no tiene cliente de
   BigQuery.
2. **Toda query con `LIMIT` y `MaxBytesBilled`/`maximumBytesBilled`.** Sin
   tope, una query accidental puede costar cientos de dólares.
3. **Credenciales → Secret Manager vía `--set-secrets`, por contenedor.**
   Nunca en `.env` commiteado, nunca en strings literales.
4. **Variables de entorno:** `EPA_*` en servidor (ambos contenedores),
   `NEXT_PUBLIC_*` solo en el navegador.
5. **Un dashboard es un repo y un servicio de Cloud Run con dos
   contenedores** (`web` + `api`, el segundo sidecar sin ingress público)
   — el servicio termina en `-vibe`, siempre, incluida producción. Nunca
   un segundo servicio para el backend. Nunca desplegar en
   `bdd-epa-digital` ni `ga360-250517`.
6. **UI = design system EPA.** IBM Plex, `#003AD6`, sin CSS custom, sin
   componentes hechos a mano.
7. **El frontend nunca declara un cliente de BigQuery.** Es el único
   control que compensa que los dos contenedores comparten service
   account — ver `epa-backend`.

---

## Contactos

```
Infraestructura, datos, gasto GCP:   Área de Datos e IA — datos@epa.digital
Diseño y design system:              Área de Diseño
Productos y desarrollo:              Equipo de Desarrollo
```

---

## Si algo no está documentado

1. Revisar la skill del plugin `epa-dashboards` que aplique.
2. Buscar un caso similar ya implementado y replicar.
3. Si no hay precedente: preguntar al área de Datos antes de crear el
   recurso o tomar la decisión.

NUNCA improvisar nombres, ubicaciones de recursos o accesos directos a
APIs de plataforma. Las decisiones de arquitectura las toma el equipo, no
la sesión.
