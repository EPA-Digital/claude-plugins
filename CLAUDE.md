# CLAUDE.md — EPA Digital · epa-turing

Contexto maestro para cualquier sesión de Claude Code que toque infraestructura,
código o assets de EPA Digital.

---

## Contexto de la organización

**EPA Digital** es una agencia de marketing de performance con HQ en LATAM
(~170 personas). Trabajo se divide en dos grandes superficies:

1. **Productos internos** — **Pitágoras** (capa de integración centralizada
   a APIs de medios y analytics: Google Ads, Meta, Universal Analytics, GA4,
   Bing, TikTok, LinkedIn y DV360). Único producto en producción. Otros
   productos están en desarrollo o exploración y no deben asumirse como
   existentes.
2. **Operación de cliente** — campañas, dashboards, atribución y alertas para
   los clientes activos de la agencia. Cartera actual incluye (entre otros):
   ABInBev, AMVO, Coppel, Chedraui, Farmacias del Ahorro, Innovasport, Nestlé
   y UVM.

Todo lo que no sea local del laptop del desarrollador vive en GCP, en un solo
proyecto compartido.

---

## Proyecto GCP

```
Nombre:          epa-turing
Project number:  689827400521
Project path:    projects/689827400521
Región default:  us-central1
```

**Todos los recursos de cualquier producto y cliente están en este mismo proyecto.**
Por eso los nombres importan: el aislamiento entre productos y clientes ocurre
por convenciones de naming, IAM y datasets, no por proyectos GCP separados.

---

## Stack canónico

```
Compute:         Cloud Run (servicios) + Cloud Run Jobs (batch) + Cloud Scheduler
Datos analíticos: BigQuery (datasets {cliente}_{tipo} y {producto}_{modulo})
Documentos / estado: Firestore Native (colecciones {Producto}{Entidad})
Archivos:        GCS (buckets epa-{proposito}-prod)
Secretos:        Secret Manager (secrets en PascalCase)
Mensajería:      Pub/Sub
Automatización visual: n8n (epa-digital.app.n8n.cloud)
Dashboards:      Next.js 15 + Tailwind CSS en Cloud Run (stack preferido)
APIs Python:     FastAPI + uvicorn
APIs TypeScript: Hono o Next.js API routes
Lenguajes:       Python 3.11+, TypeScript con Node 20+
CI/CD:           GitHub Actions → Artifact Registry → Cloud Run
Branding:        EPA Blue #003AD6, IBM Plex Sans, design system propio
```

Detalles completos: ver el plugin `epa-stack`.

---

## Pitágoras — la regla más importante

**Pitágoras** es la capa de integración centralizada para datos de medios y
analytics. Soporta 8 providers hoy: **Google Ads, Meta (Facebook + Instagram),
Universal Analytics, GA4, Bing, TikTok, LinkedIn y DV360**. Toda app,
dashboard, ETL o reporte que necesite datos de cualquiera de estos providers
DEBE pasar por Pitágoras.

Endpoints (públicos, requieren auth):
```
API REST:    https://pitagoras-api-229508468478.us-central1.run.app
MCP Server:  https://pitagoras-mcp-689827400521.us-central1.run.app
```

Acceder directo a las APIs de plataforma:
- Duplica código de auth y paginación entre productos.
- Expone tokens en repos.
- Rompe el historial centralizado de datos.
- Descarga el control de rate-limits a cada servicio.

Cómo usarlo: ver `pitagoras.md` en `epa-stack/references/`.

---

## Recursos protegidos — bloqueo total

NO modificar, eliminar ni sobreescribir sin autorización del **área de Datos e IA**
(`datos@epa.digital`):

```
Firestore:
  PitagorasUsers       ← autenticación de toda la plataforma
  PitagorasTokens      ← tokens de sesión activos

Secret Manager:
  FacebookAccessToken
  TiktokToken
  GoogleAdsYAML
  BingAccessTokenEpa
```

Detalles: `epa-safe-vibe/references/protected-resources.md`.

---

## Plugins de este repo

Este repo (`epa-digital/claude-plugins`) provee 5 plugins oficiales que definen
las convenciones EPA. Si los tienes instalados, Claude las aplica automáticamente:

| Plugin | Propósito | Activación |
|---|---|---|
| `epa-naming` | Convenciones de naming en GCP, GitHub, código | Crear o renombrar cualquier recurso |
| `epa-safe-vibe` | Guardrails de seguridad y bloqueos | Operaciones destructivas, credenciales, APIs de medios |
| `epa-stack` | Árbol de decisión de arquitectura + boilerplate | Construir algo nuevo |
| `epa-design` | Design system (tokens, componentes, copy) | Cualquier UI o presentación |
| `epa-cicd` | Deploy a Cloud Run vía GitHub Actions | Subir app a producción |

Instalación:
```
/plugin marketplace add epa-digital/claude-plugins
/plugin install epa-naming@epa-plugins
/plugin install epa-safe-vibe@epa-plugins
/plugin install epa-stack@epa-plugins
/plugin install epa-design@epa-plugins
/plugin install epa-cicd@epa-plugins
```

O dejar que `extraKnownMarketplaces` y `enabledPlugins` en
`.claude/settings.json` lo hagan automáticamente al confiar en el folder.

---

## Reglas de oro para vibecoding en epa-turing

1. **Antes de crear recursos, revisar epa-naming.** Un nombre fuera de patrón
   rompe el inventario y dificulta el cobro por cliente.
2. **Datos de medios → Pitágoras siempre.** Nunca directo a Meta/Google
   Ads/TikTok/Bing.
3. **Credenciales → Secret Manager.** Nunca en `.env` commiteado, nunca en
   strings literales.
4. **Variables de entorno con prefijo `EPA_`.**
5. **Queries con `LIMIT` o `maximum_bytes_billed`.** Sin tope, una query
   accidental puede costar cientos de dólares.
6. **Sheets / Apps Script no son base de datos.** Para apps usa Firestore o
   BigQuery.
7. **Para deploys: GitHub Actions + Cloud Run.** No hay Compute Engine VMs
   manuales.
8. **Para UI: design system EPA.** No mezclar Inter/Roboto con IBM Plex.

---

## Contactos

```
Infraestructura, recursos protegidos, gasto GCP:   Área de Datos e IA — datos@epa.digital
Productos y desarrollo:                             Equipo de Desarrollo
Datos y modelado de BigQuery / Firestore:           Área de Datos e IA — datos@epa.digital
Diseño y design system:                             Área de Diseño
```

---

## Si algo no está documentado

1. Revisar el plugin que aplica (epa-naming / epa-stack / epa-cicd / epa-design /
   epa-safe-vibe).
2. Buscar un caso similar ya implementado en epa-turing y replicar.
3. Si no hay precedente: preguntar al área de Datos antes de crear el recurso
   o tomar la decisión.

NUNCA improvisar nombres, ubicaciones de recursos o accesos directos a APIs de
plataforma. Las decisiones de arquitectura las toma el equipo, no la sesión.
