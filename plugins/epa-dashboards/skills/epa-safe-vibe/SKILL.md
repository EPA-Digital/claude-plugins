---
name: epa-safe-vibe
description: >
  Guardrail de seguridad maestro para dashboards EPA. Activar SIEMPRE que el
  usuario vaya a ejecutar cualquier operación sobre infraestructura de
  epa-turing: crear recursos GCP, escribir código que toque BigQuery, Cloud
  Run, Secret Manager, o cualquier API de medios. También activar ante
  cualquier señal de mala práctica: credenciales en código, Google Sheets
  como base de datos, operaciones destructivas (delete, drop, overwrite,
  truncate), o acceso directo a APIs de medios/Pitágoras. Este skill es
  BLOQUEANTE para malas prácticas y CONSULTIVO para el resto.
---

# EPA Safe Vibe — Guardrail de Seguridad

Proyecto GCP por defecto para vibecoding: **epa-turing** (`projects/689827400521`)
Modo: **BLOQUEANTE** para malas prácticas · **CONSULTIVO** para arquitectura

> **Alcance: TODOS los proyectos GCP de EPA**, no solo epa-turing. El guardrail
> aplica igual en `epa-turing`, `bdd-epa-digital` (datos canónicos + intranet Newton)
> y `ga360-250517` (Coppel). El incidente Newton (ver B7) ocurrió justo porque un
> deploy fue a `bdd-epa-digital` y la regla "se sintió" fuera de alcance.

Este skill protege la infraestructura compartida de EPA y previene los errores
más costosos del vibecoding de dashboards sin contexto institucional.

> ⚙️ **Enforcement automático:** este plugin trae un hook PreToolUse
> (`hooks/guard-cloud-deploy.sh`) que **bloquea de verdad** —sin depender de que el
> modelo lea esta skill— cualquier `gcloud run deploy` / `gcloud builds submit` de
> Claude que no apunte a `epa-turing` o cuyo servicio no lleve el sufijo `-vibe`
> (ver B7). El texto de abajo es el respaldo conceptual del hook.

---

## Protocolo de activación

Antes de ejecutar CUALQUIER operación sobre infraestructura, hacer estas preguntas
internamente. Si alguna respuesta activa un BLOQUEO, detener y explicar antes de
continuar.

---

## BLOQUEOS — Detener inmediatamente

Estas situaciones requieren STOP completo. No continuar hasta resolver.

### 🔴 B1 — Operación destructiva sin confirmación explícita

Palabras clave que activan este bloqueo:
```
delete, drop, truncate, remove, destroy, overwrite, wipe,
eliminar, borrar, vaciar, limpiar, resetear tabla/servicio
```

**Protocolo obligatorio antes de proceder:**
1. Identificar exactamente QUÉ se va a eliminar (nombre completo del recurso)
2. Verificar si el recurso está en la lista de recursos protegidos (ver `references/protected-resources.md`)
3. Mostrar al usuario: "Estás a punto de [operación] en [recurso]. Esto es irreversible. ¿Confirmas?"
4. Esperar confirmación textual explícita ("sí", "confirmo", "adelante")
5. Si el recurso es protegido: BLOQUEO TOTAL — redirigir al área de Datos e IA (datos@epa.digital)

> Caso real que originó esta regla: una colección de autenticación de la
> agencia fue eliminada accidentalmente durante la creación de un producto
> nuevo en el mismo proyecto GCP. Firestore no tiene papelera. Ver lista
> completa en `references/protected-resources.md`.

### 🔴 B2 — Credenciales hardcodeadas en código

Detectar cualquier patrón de credencial en strings literales:
```
api_key = "AIza..."
token = "EAA..."
secret = "whsec_..."
password = "..."
client_secret = "..."
ACCESS_TOKEN = "ya29...."
```

**Acción:** DETENER. Mostrar el patrón correcto — un dashboard Next.js
**nunca** llama al SDK de Secret Manager desde su código; los secretos
llegan como variables de entorno inyectadas al desplegar:

```yaml
# En el workflow de deploy (ver epa-deploy)
--set-secrets=EPA_ADMIN_TOKEN=EpaAdminToken:latest
```

```typescript
// En el route handler — se lee como env var normal, ya inyectada
const token = process.env.EPA_ADMIN_TOKEN
```

Secretos disponibles hoy en `epa-turing`: `FacebookAccessToken`,
`TiktokToken`, `GoogleAdsYAML`, `BingAccessTokenEpa` — estos son del ETL
centralizado, un dashboard no debería necesitarlos directamente (ver B3).

### 🔴 B3 — Acceso directo a APIs de medios, analytics o Pitágoras

Si el código intenta conectarse directo a cualquiera de las siguientes
APIs, BLOQUEAR:

```
graph.facebook.com                          ← Meta Ads / Marketing API
googleads.googleapis.com                    ← Google Ads
analyticsdata.googleapis.com                ← GA4 Data API
analyticsreporting.googleapis.com           ← Universal Analytics (legacy)
analytics.googleapis.com                    ← UA Management API
business-api.tiktok.com                     ← TikTok Ads
bingads.microsoft.com                       ← Bing / Microsoft Advertising
api.linkedin.com/v2/adAccounts              ← LinkedIn Ads
displayvideo.googleapis.com                 ← DV360
doubleclickbidmanager.googleapis.com        ← DV360 reporting
pitagoras-api-*.run.app                     ← Pitágoras (API REST o MCP/Tokyo)
```

También bloquear librerías cliente que conectan directo:
```
facebook-business, google-ads, google-analytics-data,
linkedin-api / python-linkedin, TikTokBusinessSdk
```

**Acción:** DETENER. Explicar:
> "Un dashboard EPA nunca llama directo a una plataforma de medios ni a
> Pitágoras. Lee los datos ya materializados en
> `bdd-epa-digital.{cliente}_reporting` (ver `epa-bq`). Si el dato que
> necesitas no está ahí, escala a datos@epa.digital — el único que llama a
> Pitágoras es el ETL centralizado, y ese no es este proyecto."

**Excepción:** Google Search Console API y CRM de cliente NO pasan por
`{cliente}_reporting`. Para esos casos, conexión directa con su propio
secret en Secret Manager, confirmando con el usuario primero.

### 🔴 B4 — Google Sheets como base de datos principal

Señales de activación:
```
gspread, google-spreadsheets, sheets as database,
"guardar en sheets", "leer de sheets", spreadsheetId en código de backend
```

**Excepción permitida:** Sheets como destino de exportación para el usuario
final (e.g., "exportar reporte a Sheets"). Lo que se bloquea es usarlo como
fuente de verdad de un dashboard — eso es siempre `{cliente}_reporting` en
BigQuery.

**Acción:** DETENER. Redirigir a `epa-bq`.

### 🔴 B5/B6 — Infraestructura incorrecta para el caso de uso

Un dashboard EPA es una sola cosa: Next.js en Cloud Run leyendo BigQuery.
Si el usuario propone otra pieza de infraestructura, bloquear y redirigir:

| Si el usuario propone... | Bloquear y proponer... |
|---|---|
| Google Sheets como base de datos | BigQuery (`{cliente}_reporting`) — ver `epa-bq` |
| Apps Script como backend o para lógica de negocio del dashboard | Route handler de Next.js — ver `epa-frontend` |
| Un ETL, job o pipeline propio dentro del dashboard | Escalar a datos@epa.digital — el dashboard no construye pipelines (ver `epa-frontend` regla 6) |
| Compute Engine VM manual para el backend | Cloud Run — ver `epa-deploy` |
| Secretos en `.env` commiteado | Secret Manager + `--set-secrets` en el deploy |

### 🔴 B7 — Deploy de Cloud Run sobre un servicio existente (overwrite silencioso)

`gcloud run deploy <servicio>` es **create-or-update**: si ya existe un
servicio con ese nombre, lo **sobrescribe sin avisar**. Lo mismo aplica a
`gcloud builds submit` (que internamente despliega).

**Caso real que originó esta regla — incidente Newton (2026-06-09):**
Un deploy automatizado del dashboard de analytics eligió el nombre genérico
`epa-dashboard` en el proyecto `bdd-epa-digital` y **sobrescribió a Newton**,
la intranet de EPA (`dashboard.epa.digital`) que llevaba >1 año corriendo con
ese nombre.

1. **Proyecto:** los servicios de dashboard van SOLO a `epa-turing`. Nunca
   desplegar en `bdd-epa-digital` ni `ga360-250517`. Declarar
   `--project=epa-turing` explícito.
2. **Sufijo `-vibe` — obligatorio en TODO dashboard, incluida producción.**
   No es solo una señal de "esto lo desplegó una IA": es la convención de
   naming de la plataforma completa. Un dashboard de cliente en producción
   se llama `{cliente}-dashboard-web-vibe`, no `{cliente}-dashboard-web`.
   Sin excepciones.
3. **Verificar existencia antes de crear:** correr
   `gcloud run services list --project=epa-turing --region=us-central1` y
   confirmar que el nombre **NO existe ya** (o que es el mismo servicio y
   se quiere actualizar a propósito).
4. **Deploys de producción van por GitHub Actions** (ver `epa-deploy`), con
   el service account dedicado del proyecto — nunca con una identidad
   personal ni con la identidad compartida `analytics@epa.digital` desde un
   laptop.

> El hook `hooks/guard-cloud-deploy.sh` ya bloquea (1) y (2) de forma
> automática. (3) y (4) son responsabilidad del operador.

---

## ADVERTENCIAS — Consultivo (continúa pero avisa)

### 🟡 A1 — Operación sobre recurso compartido no protegido

Si el código va a modificar algo que podría afectar a otro dashboard o
producto:

> "⚠️ Vas a modificar [recurso]. Verifica que no lo estén usando otros
> proyectos antes de continuar."

### 🟡 A2 — Sin manejo de estados en operaciones de datos

Si un módulo de datos no maneja loading/error/empty:

> "⚠️ Esta operación puede fallar en producción sin retroalimentación al
> usuario. Todo módulo de datos necesita sus 4 estados — ver `/critique-epa`."

### 🟡 A3 — Variables de entorno sin el prefijo correcto

```
Servidor (nunca llega al navegador):   EPA_*
Expuesto al cliente (Next.js):          NEXT_PUBLIC_*
```

Si se define una variable server-side sin `EPA_`, o una variable que debe
llegar al navegador sin `NEXT_PUBLIC_`:

> "⚠️ Por convención EPA: variables de servidor usan `EPA_*`, variables que
> el navegador necesita leer usan `NEXT_PUBLIC_*`. Nunca pongas un secreto
> real en una `NEXT_PUBLIC_*` — se filtra al bundle del navegador."

### 🟡 A3.5 — Uso del dataset Coppel-Domo (`ga360-250517.Epa_dataset`)

Si el código hace queries a `ga360-250517.Epa_dataset` o referencia tablas
`PMBF_*`:

> "⚠️ Estás consultando el dataset Coppel-Domo (`ga360-250517.Epa_dataset`).
> El cliente pidió no usarlo salvo necesidad estricta.
>
> ¿Lo que necesitas son sólo costos? Verifica si existen en
> `bdd-epa-digital.coppel_reporting` (mismo patrón que el resto de clientes).
> Si existen, cambia ahí.
>
> ¿Necesitas resultados detallados (transacciones por SKU, building blocks
> de funnel custom) que no están en el dataset canónico? Confirma que sabes
> exactamente qué tabla `PMBF_*` ocupar y por qué, y procede con
> `maximum_bytes_billed` bajo (50 MB) durante exploración."

NUNCA escribir en `ga360-250517.Epa_dataset` — el dataset es del cliente.

### 🟡 A4 — Datos de cliente en logs

Si el código hace `console.log()` con datos que podrían contener campañas,
costos o configuración de cliente:

> "⚠️ Verifica que los logs no exponen información confidencial de clientes
> antes de desplegar a producción."

### 🟡 A5 — Sin límite en queries a BigQuery

Si el código hace queries sin `LIMIT`:

> "⚠️ Sin LIMIT, esta query puede escanear millones de filas y generar
> costos inesperados. Agrega un límite, filtro de fecha, o paginación."

---

## Checklist pre-deploy obligatorio

```
SEGURIDAD
[ ] No hay credenciales hardcodeadas en ningún archivo
[ ] El .gitignore incluye: .env*, *.key, *.pem, service-account*.json
[ ] Los secretos llegan vía --set-secrets, no variables de entorno de texto

INFRAESTRUCTURA
[ ] El naming sigue las convenciones de epa-deploy (kebab-case, sufijo -vibe)
[ ] No se modifican recursos protegidos (ver references/protected-resources.md)
[ ] Las queries a BigQuery tienen LIMIT y filtro de fecha
[ ] Corrí `gcloud run services list --project=epa-turing` y el nombre del
    servicio NO existe ya (o es el mío y quiero actualizarlo a propósito)
[ ] El servicio termina en -vibe — sin excepción, incluida producción

CÓDIGO
[ ] Los 4 estados de datos están manejados (loading/error/empty/frescura)
[ ] Los logs no exponen datos de cliente
[ ] Las variables de entorno usan EPA_* (servidor) o NEXT_PUBLIC_* (cliente)

ACCESO A DATOS
[ ] Los datos de medios se leen de bdd-epa-digital.{cliente}_reporting
[ ] No hay llamadas directas a APIs de plataforma ni a Pitágoras
```

---

## Pitágoras — contexto mínimo

Pitágoras es la capa de integración centralizada de EPA para datos de
medios (8 providers: Google Ads, Meta, GA4, Bing, TikTok, LinkedIn, DV360,
Universal Analytics). **Un dashboard nunca la llama** — su único
consumidor es el ETL centralizado, un workstream aparte del equipo de
Datos e IA. El MCP de Pitágoras (nombre de producto Tokyo) está
deprecado, no se usa para nada. Si un dato de medios que necesitas no está
en `bdd-epa-digital.{cliente}_reporting`, escala a datos@epa.digital — no
lo resuelvas llamando a Pitágoras tú mismo (ver B3).

---

## Recursos protegidos — resumen

Lista completa en `references/protected-resources.md`.

```
Firestore (bdd-epa-digital — nombres en lowercase, son legacy):
  users, clients, budgets

Secret Manager (epa-turing):
  FacebookAccessToken, TiktokToken, GoogleAdsYAML, BingAccessTokenEpa

Cloud Run (epa-turing):
  cualquier servicio SIN sufijo -vibe puede ser un producto curado en
  producción (incluido dashboard.epa.digital / Newton) — nunca sobrescribir
  sin verificar existencia primero (ver B7)
```

---

## Cómo reportar un incidente

Si una operación destructiva ya ocurrió:
1. Notificar inmediatamente al **área de Datos e IA** — datos@epa.digital
2. Documentar: qué recurso, qué operación, a qué hora
3. No intentar "arreglar" con más operaciones — puede empeorar

Para más detalle y procedimientos de recuperación, leer
`references/protected-resources.md`.
