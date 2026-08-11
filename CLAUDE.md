# CLAUDE.md — EPA Digital · epa-dashboards

Contexto maestro para cualquier sesión de Claude Code que toque este repo
o un dashboard generado con él.

**Qué es este repo:** el marketplace de un solo plugin, `epa-dashboards`,
exclusivo para generar y estandarizar dashboards de EPA Digital. Invariantes
al mantenerlo: `marketplace.json` tiene **una** entrada, el plugin tiene
**5 skills** (`epa-frontend`, `epa-bq`, `epa-design`, `epa-deploy`,
`epa-safe-vibe`) + 3 comandos + 1 agente + 1 hook en `hooks/` (raíz del
plugin), y **este repo no hospeda paquetes npm** — si algún día el kit
`@epa/*` de la plataforma de dashboards quiere vivir aquí, es una decisión
deliberada del equipo, no una deriva. Validar siempre con
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
epa-turing.{cliente}_etl.{tabla}      ← tablas del ETL centralizado (en
                                         construcción por Datos e IA).
ga360-250517.Epa_dataset              ← excepción Coppel (Domo).
```

**DEPRECADO:** `bdd-epa-digital.epa_agency_reports`. No existe reemplazo
cross-cliente — un rollup entre varios clientes se escala a Datos e IA.

---

## Stack canónico

```
Frontend:        Next.js 15 App Router + Tailwind CSS + pnpm, en Cloud Run
Datos:            BigQuery (bdd-epa-digital.{cliente}_reporting)
CI/CD:           GitHub Actions → Artifact Registry → Cloud Run
Branding:        EPA Blue #003AD6, IBM Plex Sans/Mono
```

Detalles completos: skill `epa-frontend` del plugin.

---

## Pitágoras — contexto mínimo

Pitágoras es la capa de integración de medios de la agencia. **Un
dashboard nunca la llama** — su único consumidor es el ETL centralizado.
El MCP de Pitágoras (Tokyo) está deprecado. Si un dato de medios no está
en `{cliente}_reporting`, se escala a `datos@epa.digital`.

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

`epa-dashboards` — un solo plugin, 5 skills, se activan solas según el
contexto:

| Skill | Cubre |
|---|---|
| `epa-frontend` | Stack cerrado (Node 22, pnpm, Next.js, TS estricto, Tailwind, Recharts), auth |
| `epa-bq` | Convenciones de `{cliente}_reporting`, control de costo |
| `epa-design` | Design system EPA (tokens, componentes, copy) |
| `epa-deploy` | Deploy a Cloud Run vía GitHub Actions |
| `epa-safe-vibe` | Guardrails de seguridad + hook de deploy |

Más 3 comandos (`/plan-dashboard`, `/client-context`, `/critique-epa`,
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

1. **Datos de medios → siempre `{cliente}_reporting` en BigQuery.** Nunca
   directo a Meta/Google Ads/TikTok/Bing ni a Pitágoras.
2. **Toda query con `LIMIT` o `maximumBytesBilled`.** Sin tope, una query
   accidental puede costar cientos de dólares.
3. **Credenciales → Secret Manager vía `--set-secrets`.** Nunca en `.env`
   commiteado, nunca en strings literales.
4. **Variables de entorno:** `EPA_*` en servidor, `NEXT_PUBLIC_*` en
   cliente.
5. **Todo servicio de Cloud Run termina en `-vibe`** — siempre, incluida
   producción. Nunca desplegar en `bdd-epa-digital` ni `ga360-250517`.
6. **UI = design system EPA.** IBM Plex, `#003AD6`, sin CSS custom, sin
   componentes hechos a mano.

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
