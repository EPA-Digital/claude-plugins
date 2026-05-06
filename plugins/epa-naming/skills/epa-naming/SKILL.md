---
name: epa-naming
description: >
  Naming conventions oficiales de EPA Digital para todos los recursos en epa-turing.
  Activar SIEMPRE que el usuario vaya a crear, renombrar o referenciar cualquier
  recurso en GCP (Firestore collections, BigQuery datasets/tables, Cloud Run services,
  GCS buckets, Secret Manager, variables de entorno, repositorios de GitHub) o
  cuando pregunte "cómo nombro esto", "qué nombre le pongo a X", o cuando proponga
  un identificador que no siga las convenciones EPA. Este skill es la fuente de
  verdad para nombres y un prerequisito de epa-safe-vibe, epa-stack y epa-cicd.
---

# EPA Naming — Convenciones Oficiales

Proyecto GCP: **epa-turing** (`projects/689827400521`)
Región default: **us-central1**

Todo recurso en epa-turing debe seguir estas convenciones. Un nombre fuera de
patrón rompe el inventario, dificulta el cobro por cliente, y genera colisiones
entre productos. Antes de crear cualquier recurso, validar el nombre contra
este documento.

---

## Regla universal — antes de nombrar cualquier recurso

Hacer estas tres preguntas, en orden:

1. **¿Quién es el dueño funcional?** ¿Es un producto interno (Pitágoras es el
   único en producción al día de hoy) o trabajo de un cliente activo (Coppel,
   Chedraui, Innovasport, Nestlé, ABInBev, AMVO, Farmacias del Ahorro, UVM,
   entre otros)?
2. **¿Qué tipo de recurso es?** Cada tipo tiene su patrón — no se mezclan.
3. **¿El nombre transmite el propósito?** Si dentro de 6 meses alguien lee solo
   el nombre, ¿entiende qué guarda o qué hace?

Si la respuesta a (3) es no, reescribir antes de crear.

---

## Convención EPA — productos internos llevan nombre de científico

Las **herramientas / productos internos de EPA** se nombran con apellidos de
científicos. Es la marca interna que distingue lo que construye la agencia.

Productos existentes que siguen el patrón:
```
Pitágoras    ← capa centralizada de medios (ÚNICO en producción hoy)
Newton       ← producto interno
Fermat       ← producto interno
Einstein     ← producto interno
```

(Otros nombres de científico están reservados para productos en exploración o
desarrollo. Si vas a crear uno nuevo, validar con el área de Datos e IA antes
de fijar el nombre.)

**Reglas:**
- Sólo apellidos de **científicos reales** (matemáticos, físicos, astrónomos,
  químicos, biólogos). Sin nombres de pila, sin personajes ficticios, sin
  empresas, sin acrónimos.
- En recursos de GCP / código se aplica la convención de cada tipo (ej.
  Pitágoras → Firestore `Pitagoras*`, Cloud Run `pitagoras-api`,
  BQ `pitagoras_logs`, Secret `PitagorasApiKey`, env `EPA_PITAGORAS_*`,
  repo `pitagoras`). Mantener el ASCII sin acentos en identificadores
  técnicos — los acentos sólo en docs y UI.
- Esta convención **no aplica a herramientas de cliente** ni a recursos
  específicos de cliente: ahí se usa el nombre del cliente como prefijo.

```
✓ Newton            ← producto interno
✓ Fermat            ← producto interno
✓ ChedrauiDashboard ← herramienta para Chedraui (NO lleva nombre de científico)
✗ Tesla             ← reservar a científico (Nikola Tesla) sí, pero validar
                      antes con Datos para evitar colisión con Tesla Inc.
✗ AuditOS           ← no es nombre de científico — patrón rechazado
✗ Reportes-Coppel   ← producto interno con nombre descriptivo + cliente,
                      rompe ambas convenciones
```

---

## Firestore — Colecciones

**Patrón:** `PascalCase` con prefijo de producto o cliente.

```
{Producto}{Entidad}      ← producto interno
{Cliente}{Entidad}       ← trabajo de cliente
```

**Ejemplos correctos:**
```
PitagorasUsers              ← usuarios de Pitágoras (PROTEGIDO)
PitagorasTokens             ← tokens de sesión (PROTEGIDO)
CoppelCampaigns             ← campañas del cliente Coppel
ChedrauiOrders              ← órdenes del cliente Chedraui
InnovasportAudiences        ← audiencias del cliente Innovasport
NestleCreatives             ← assets creativos del cliente Nestlé
EpaSettings                 ← configuración global
```

**Ejemplos incorrectos:**
```
✗ users                     ← sin prefijo, colisiona entre productos
✗ coppel_campaigns          ← snake_case no es la convención de Firestore
✗ campaigns-coppel          ← orden invertido, kebab-case
✗ data                      ← genérico, no dice nada
```

**Subcolecciones:** mismo patrón, anidadas:
```
CoppelCampaigns/{campaignId}/Insights
CoppelCampaigns/{campaignId}/Audiences
```

---

## BigQuery — Proyectos, datasets y tablas

### Proyectos GCP donde vive BigQuery en EPA

```
bdd-epa-digital     ← dataset canónico de la agencia. Project separado.
                      Dataset principal: epa_agency_reports
                      Vistas: account_metrics_daily, paid_media_metrics
                      (cost, sessions, transactions, revenue por client_name+medios+date)

epa-turing          ← datasets ad-hoc por producto o cliente.
                      RAW desde Pitágoras, staging, marts específicos.

ga360-250517        ← excepción Coppel: dataset Epa_dataset con tablas PMBF_*.
                      Resultados desde Domo. NO usar salvo necesidad explícita.
```

Antes de crear un dataset nuevo, validar si la métrica que necesitas ya está
en `bdd-epa-digital.epa_agency_reports`. Si sí, no dupliques pipeline.

### Datasets nuevos en `epa-turing`

**Patrón:** `snake_case` con prefijo de cliente o producto.

```
{cliente}_{tipo}            ← datos de cliente
{producto}_{modulo}         ← datos de producto interno
```

**Ejemplos correctos:**
```
coppel_raw                  ← datos crudos de Coppel desde Pitágoras
chedraui_attribution        ← modelado de atribución de Chedraui
innovasport_audiences       ← audiencias de Innovasport
nestle_performance          ← mart específico de Nestlé
abinbev_raw                 ← datos crudos de ABInBev
farmacias_ahorro_raw        ← datos crudos de Farmacias del Ahorro
pitagoras_logs              ← logs operativos de Pitágoras
epa_internal                ← datos internos de la agencia
```

**Nota sobre nombres compuestos:** clientes con dos palabras como "Farmacias del
Ahorro" se normalizan a `farmacias_ahorro` (sin artículos, snake_case). Validar
con el área de Datos e IA al onboardear cliente nuevo.

> **No crear** `*_performance` para datos que ya viven en
> `bdd-epa-digital.epa_agency_reports`. La duplicación rompe consistencia y
> dispara costo doble de ingesta.

**Ejemplos incorrectos:**
```
✗ Coppel-Performance        ← kebab-case + PascalCase no aplican en BQ
✗ data                      ← genérico
✗ coppel                    ← sin sufijo, no se distingue tipo
✗ test                      ← nombres temporales nunca llegan a producción
```

### Tablas

**Patrón:** `snake_case` con sufijo de granularidad temporal cuando aplique.

```
{entidad}_{granularidad}    ← campaigns_daily, ads_hourly
{evento}                    ← conversions, signups (sin granularidad)
{snapshot}_{fecha}          ← solo para snapshots manuales
```

**Ejemplos correctos:**
```
campaigns_daily             ← métricas de campañas por día
ads_hourly                  ← métricas de anuncios por hora
keywords_performance_daily
conversions                 ← tabla de eventos
audit_results               ← outputs de auditorías
```

### Tablas particionadas

Toda tabla con datos temporales debe estar **particionada por fecha**:
```sql
CREATE TABLE `epa-turing.chedraui_performance.campaigns_daily` (
  date DATE NOT NULL,
  campaign_id STRING,
  impressions INT64,
  clicks INT64,
  spend NUMERIC
)
PARTITION BY date
CLUSTER BY campaign_id;
```

---

## Cloud Run — Servicios

**Patrón:** `kebab-case` con sufijo según tipo.

```
{producto}-api              ← API de producto interno
{producto}-web              ← frontend / dashboard de producto
{producto}-job              ← Cloud Run job programado
{cliente}-{funcion}-svc     ← servicio para un cliente específico
```

**Ejemplos correctos:**
```
pitagoras-api               ← API de Pitágoras
pitagoras-web               ← frontend de Pitágoras
coppel-attribution-svc      ← servicio de atribución para Coppel
chedraui-etl-job            ← job de ETL para Chedraui
innovasport-dashboard-web   ← dashboard del cliente Innovasport
github-actions-deployer     ← service account, no servicio (ver IAM)
```

**Ejemplos incorrectos:**
```
✗ pitagoras_api             ← snake_case no aplica en Cloud Run
✗ PitagorasAPI              ← PascalCase no aplica
✗ api                       ← genérico
✗ test-deploy               ← nombres temporales no llegan a producción
✗ jose-test                 ← nunca usar nombres personales
```

**Sufijo `-staging`** para servicios de pre-producción:
```
pitagoras-api               ← producción
pitagoras-api-staging       ← staging
```

---

## GCS — Buckets

**Patrón:** `epa-{proposito}-{ambiente}` (siempre kebab-case, prefijo `epa-`).

```
epa-{proposito}-prod
epa-{proposito}-staging
epa-{cliente}-{proposito}-prod
```

**Ejemplos correctos:**
```
epa-reports-prod            ← reportes generados (PDFs, Excels)
epa-backups-prod            ← backups de Firestore y otros recursos
epa-uploads-prod            ← archivos subidos por usuarios
epa-coppel-assets-prod      ← assets específicos del cliente Coppel
epa-public-assets-prod      ← assets públicos (logos, favicons)
```

**Ejemplos incorrectos:**
```
✗ reports                   ← sin prefijo, colisiona globalmente en GCS
✗ epa_reports               ← snake_case no aplica en GCS
✗ EpaReports                ← PascalCase no aplica
✗ epa-test                  ← ambiente "test" no existe; usa staging
```

**Recordatorio:** los nombres de buckets son globales en GCS — el prefijo `epa-`
evita colisiones con otros proyectos del mundo.

---

## Secret Manager — Secrets

**Patrón:** `PascalCase`, descriptivo del propósito.

```
{Plataforma}AccessToken
{Plataforma}{Tipo}
{Producto}ApiKey
```

**Ejemplos correctos (existentes — PROTEGIDOS):**
```
FacebookAccessToken         ← Meta Ads API
TiktokToken                 ← TikTok Ads API
GoogleAdsYAML               ← config completa de Google Ads
BingAccessTokenEpa          ← Bing Ads
PitagorasApiKey             ← acceso a la API de Pitágoras
```

**Ejemplos correctos (nuevos):**
```
SlackWebhookEpaAlerts       ← webhook para alertas internas
OpenAIApiKey                ← API key de OpenAI
AnthropicApiKey             ← API key de Anthropic
```

**Ejemplos incorrectos:**
```
✗ fb_token                  ← snake_case + ambiguo
✗ token                     ← genérico
✗ api-key                   ← kebab-case no aplica + genérico
```

---

## Variables de entorno

**Patrón:** `EPA_` como prefijo + `SCREAMING_SNAKE_CASE`.

```
EPA_{SERVICIO}_{VARIABLE}
```

**Ejemplos correctos:**
```
EPA_KALMAN_API_PORT=8080
EPA_PITAGORAS_TIMEOUT_MS=30000
EPA_FB_TOKEN=${secret:FacebookAccessToken}
EPA_GADS_YAML=${secret:GoogleAdsYAML}
EPA_GCP_PROJECT=epa-turing
EPA_LOG_LEVEL=info
```

**Ejemplos incorrectos:**
```
✗ PORT                      ← sin prefijo EPA_
✗ port                      ← lowercase
✗ epa-port                  ← kebab-case no aplica
✗ FB_TOKEN                  ← sin prefijo EPA_
✗ DATABASE_URL              ← genérico, sin contexto
```

**Nota:** Variables del runtime de Cloud Run como `PORT` las inyecta GCP — no
se redefinen en `EPA_*`. Solo prefijar las propias del servicio.

---

## GitHub — Repositorios

**Patrón:** `kebab-case`, organización `epa-digital`.

```
{producto}                  ← repo de un producto interno
{cliente}-{descripcion}     ← repo específico de cliente
{tipo}-{descripcion}        ← herramientas, plantillas, plugins
```

**Ejemplos correctos:**
```
pitagoras                   ← producto Pitágoras
coppel-attribution          ← repo del servicio para Coppel
chedraui-dashboard          ← repo del dashboard de Chedraui
claude-plugins              ← este repo
plugin-template             ← plantilla de plugins de Claude
```

**Ejemplos incorrectos:**
```
✗ Pitagoras                 ← PascalCase no aplica en repos
✗ pitagoras_api             ← snake_case no aplica en repos
✗ epa-pitagoras             ← redundante (la org ya es epa-digital)
✗ test-repo                 ← nombres temporales
```

### Ramas

```
main        ← producción
dev         ← staging / pre-producción
feature/EPA-{ticket}-{descripcion-corta}
fix/EPA-{ticket}-{descripcion-corta}
hotfix/{descripcion-corta}
```

Ejemplos:
```
feature/EPA-142-add-tiktok-attribution
fix/EPA-89-firestore-timeout
hotfix/cloud-run-quota
```

---

## IAM — Service Accounts

**Patrón:** `{proposito}-{rol}` en kebab-case.

```
github-actions-deployer     ← deploys desde GitHub Actions
pitagoras-runtime           ← runtime de Pitágoras en Cloud Run
kalman-bigquery-reader      ← service account con permisos solo de lectura BQ
```

Email completo: `{nombre}@epa-turing.iam.gserviceaccount.com`

---

## Identificadores en código (Python / TypeScript)

Reglas estándar de cada lenguaje, pero con casos EPA específicos:

### Python
```python
# variables, funciones: snake_case
campaign_data = get_campaign_data()
def fetch_pitagoras_metrics(client_id: str): ...

# clases: PascalCase
class CoppelAttributionEngine: ...

# constantes: SCREAMING_SNAKE_CASE
EPA_GCP_PROJECT = "epa-turing"
PITAGORAS_API_URL = "https://pitagoras-api-229508468478.us-central1.run.app"
```

### TypeScript
```typescript
// variables, funciones: camelCase
const campaignData = getCampaignData()
function fetchPitagorasMetrics(clientId: string) { ... }

// clases, types, interfaces: PascalCase
class CoppelAttributionEngine { ... }
interface CampaignMetrics { ... }

// constantes: SCREAMING_SNAKE_CASE
const EPA_GCP_PROJECT = 'epa-turing'
```

---

## Tabla rápida de referencia

| Recurso | Convención | Ejemplo |
|---|---|---|
| Firestore collection | `PascalCase` con prefijo | `CoppelCampaigns` |
| BQ dataset | `snake_case` con prefijo | `chedraui_performance` |
| BQ table | `snake_case` + granularidad | `campaigns_daily` |
| Cloud Run service | `kebab-case` + sufijo tipo | `pitagoras-api` |
| Cloud Run job | `kebab-case` + `-job` | `macstore-etl-job` |
| GCS bucket | `epa-{proposito}-prod` | `epa-reports-prod` |
| Secret | `PascalCase` descriptivo | `FacebookAccessToken` |
| Variable entorno | `EPA_SCREAMING_SNAKE` | `EPA_KALMAN_API_PORT` |
| GitHub repo | `kebab-case` en `epa-digital` | `pitagoras` |
| Service account | `kebab-case` `{proposito}-{rol}` | `github-actions-deployer` |
| Rama feature | `feature/EPA-{ticket}-{slug}` | `feature/EPA-42-attribution` |

---

## Casos prohibidos — siempre

```
✗ Nombres temporales en producción: test-, tmp-, foo, bar, demo
✗ Nombres personales en recursos compartidos: jose-, lalo-, eddy-
✗ Recursos sin prefijo de cliente o producto en proyectos compartidos
✗ Mezcla de convenciones (snake_case y kebab-case en el mismo recurso)
✗ Espacios o acentos en cualquier identificador
✗ Nombres en inglés mezclados con español sin criterio (elegir uno)
✗ Versionado en el nombre del recurso (v1, v2). Usar tags o branches.
```

---

## Si tienes duda

1. Revisar esta tabla.
2. Buscar un recurso del mismo tipo ya creado en epa-turing y replicar el patrón.
3. Si no hay precedente: preguntar al área de Datos antes de crear.

Casos específicos de cliente o producto nuevo: confirmar el prefijo con el área
de Datos para evitar colisiones futuras.
