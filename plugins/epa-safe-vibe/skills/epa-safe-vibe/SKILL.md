---
name: epa-safe-vibe
description: >
  Guardrail de seguridad maestro para vibecoding en EPA Digital. Activar SIEMPRE
  que el usuario vaya a ejecutar cualquier operación sobre infraestructura de
  epa-turing: crear recursos GCP, escribir código que toque Firestore, BigQuery,
  Cloud Run, Secret Manager, GCS, o cualquier API de medios. También activar ante
  cualquier señal de mala práctica: credenciales en código, Google Sheets como base
  de datos, Apps Script para lógica crítica, operaciones destructivas (delete, drop,
  overwrite, truncate), o acceso directo a APIs de medios sin pasar por Pitágoras.
  Este skill es BLOQUEANTE para malas prácticas y CONSULTIVO para el resto.
  Prerequisito: epa-naming debe estar instalado.
---

# EPA Safe Vibe — Guardrail de Seguridad

Proyecto GCP: **epa-turing** (`projects/689827400521`)
Modo: **BLOQUEANTE** para malas prácticas · **CONSULTIVO** para arquitectura

Este skill protege la infraestructura compartida de EPA y previene los errores
más costosos del vibecoding sin contexto institucional.

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
eliminar, borrar, vaciar, limpiar, resetear colección/tabla/bucket
```

**Protocolo obligatorio antes de proceder:**
1. Identificar exactamente QUÉ se va a eliminar (nombre completo del recurso)
2. Verificar si el recurso está en la lista de recursos protegidos (ver `references/protected-resources.md`)
3. Mostrar al usuario: "Estás a punto de [operación] en [recurso]. Esto es irreversible. ¿Confirmas?"
4. Esperar confirmación textual explícita ("sí", "confirmo", "adelante")
5. Si el recurso es protegido: BLOQUEO TOTAL — redirigir al área de Datos e IA (datos@epa.digital)

**Caso real que originó esta regla:**
La colección `PitagorasUsers` fue eliminada accidentalmente durante la creación
de un producto nuevo en el mismo proyecto GCP. Firestore no tiene papelera.

### 🔴 B2 — Credenciales hardcodeadas en código

Detectar cualquier patrón de credencial en strings literales:
```python
# Patrones que BLOQUEAN:
api_key = "AIza..."
token = "EAA..."
secret = "whsec_..."
password = "..."
client_secret = "..."
ACCESS_TOKEN = "ya29...."
```

**Acción:** DETENER. Mostrar el patrón correcto con Secret Manager:

```python
# CORRECTO — acceso via Secret Manager
from google.cloud import secretmanager

def get_secret(secret_id: str) -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/689827400521/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

# Secrets disponibles en epa-turing:
# FacebookAccessToken, TiktokToken, GoogleAdsYAML, BingAccessTokenEpa
```

### 🔴 B3 — Acceso directo a APIs de medios o analytics sin Pitágoras

Pitágoras agrega 8 providers hoy: Google Ads, Meta, Universal Analytics, GA4,
Bing, TikTok, LinkedIn y DV360. Si el código intenta conectarse directo a
cualquiera de las siguientes APIs, BLOQUEAR:

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
```

También bloquear bibliotecas cliente que conectan directo:
```
facebook-business (Meta SDK)
google-ads (Google Ads SDK)
google-analytics-data (GA4 SDK)
linkedin-api / python-linkedin
TikTokBusinessSdk
```

**Acción:** DETENER. Explicar:
> "EPA tiene Pitágoras, una capa de integración centralizada para los 8 providers
> de medios y analytics que usamos. Acceder directamente a las APIs de plataforma
> duplica código, expone credenciales, rompe el historial centralizado de datos
> y descarga el control de rate-limits a cada servicio. Usa la API de Pitágoras
> (`https://pitagoras-api-229508468478.us-central1.run.app`) o el MCP
> (`https://pitagoras-mcp-689827400521.us-central1.run.app`) en su lugar."

Mostrar cómo acceder a Pitágoras (ver `references/pitagoras-access.md`).

**Excepción:** Google Search Console API y CRM de cliente NO pasan por Pitágoras.
Para esos casos, conexión directa con su propio secret en Secret Manager.

### 🔴 B4 — Google Sheets como base de datos principal

Señales de activación:
```
gspread, google-spreadsheets, sheets as database,
"guardar en sheets", "leer de sheets", spreadsheetId en código de backend
```

**Excepción permitida:** Sheets como destino de exportación para el usuario final
(e.g., "exportar reporte a Sheets"). Lo que se bloquea es usarlo como fuente
de verdad o base de datos de una aplicación.

**Acción:** DETENER. Mostrar árbol de decisión correcto (ver epa-stack).

### 🔴 B5 — Apps Script para lógica crítica

Señales de activación:
```
ScriptApp, SpreadsheetApp, MailApp en lógica de negocio,
triggers de Apps Script para ETLs o alertas de producción,
"hago todo en Apps Script"
```

**Excepción permitida:** Apps Script para automatizaciones de Workspace
estrictamente internas (formatear un doc, enviar un correo puntual).
Lo que se bloquea es usarlo como backend de aplicaciones o ETLs.

### 🔴 B6 — Infraestructura incorrecta para el caso de uso

| Si el usuario pide... | Y propone usar... | Bloquear y proponer... |
|---|---|---|
| Base de datos de app | Google Sheets | Firestore o BigQuery |
| ETL recurrente | Apps Script | Cloud Run + Cloud Scheduler |
| Backend de API | Compute Engine VM manual | Cloud Run |
| Almacenamiento de archivos | Drive compartido | GCS bucket `epa-*-prod` |
| Secretos | `.env` en el repo | Secret Manager |
| Colas de trabajo | Polling en loop | Pub/Sub + Cloud Run |

---

## ADVERTENCIAS — Consultivo (continúa pero avisa)

### 🟡 A1 — Operación sobre recurso compartido no protegido

Si el código va a modificar una colección/tabla/bucket que NO está en la lista
de protegidos pero que podría afectar a otros equipos:

> "⚠️ Vas a modificar [recurso]. Verifica con tu equipo que este recurso
> no lo estén usando otros proyectos antes de continuar."

### 🟡 A2 — Sin manejo de errores en operaciones de infraestructura

Si el código hace operaciones GCP sin try/catch o manejo de excepciones:

> "⚠️ Esta operación puede fallar en producción sin retroalimentación al usuario.
> Te recomiendo agregar manejo de errores antes de desplegar."

### 🟡 A3 — Variables de entorno sin prefijo EPA_

Si se definen variables sin el prefijo `EPA_`:

> "⚠️ Por convención EPA, las variables de entorno deben usar el prefijo EPA_.
> Ejemplo: EPA_KALMAN_API_PORT en lugar de PORT."

### 🟡 A4 — Datos de cliente en logs

Si el código hace `print()`, `console.log()`, o `logger.info()` con datos
que podrían contener información de campañas, costos, o configuración de cliente:

> "⚠️ Verifica que los logs no exponen información confidencial de clientes
> antes de desplegar a producción."

### 🟡 A5 — Sin límite en queries a Firestore o BigQuery

Si el código hace queries sin `limit()` o `LIMIT`:

> "⚠️ Sin LIMIT, esta query puede traer millones de registros y generar
> costos inesperados en epa-turing. Agrega un límite o paginación."

---

## Checklist pre-deploy obligatorio

Antes de que el usuario ejecute cualquier comando de deploy o push a main,
recorrer esta lista:

```
SEGURIDAD
[ ] No hay credenciales hardcodeadas en ningún archivo
[ ] El .gitignore incluye: .env, *.key, *.pem, service-account*.json
[ ] Los secretos se acceden via Secret Manager, no variables de entorno de texto

INFRAESTRUCTURA
[ ] El naming sigue las convenciones de epa-naming
[ ] No se modifican recursos protegidos (PitagorasUsers, PitagorasTokens)
[ ] Las queries a Firestore/BigQuery tienen límites definidos
[ ] Se revisó qué recursos ya existen en epa-turing antes de crear nuevos

CÓDIGO
[ ] Hay manejo de errores en todas las operaciones de infraestructura
[ ] Los logs no exponen datos de cliente
[ ] Las variables de entorno usan prefijo EPA_

ACCESO A MEDIOS
[ ] Los datos de medios se obtienen via Pitágoras, no directamente de APIs
[ ] No hay tokens de plataforma en el código
```

---

## Recursos protegidos — resumen

Lista completa en `references/protected-resources.md`.

Protegidos críticos (BLOQUEO TOTAL si se intenta modificar):
```
Firestore:    PitagorasUsers, PitagorasTokens
Secret Manager: FacebookAccessToken, TiktokToken, GoogleAdsYAML, BingAccessTokenEpa
```

---

## Cómo reportar un incidente

Si una operación destructiva ya ocurrió:
1. Notificar inmediatamente al **área de Datos e IA** — datos@epa.digital
2. Documentar: qué recurso, qué operación, a qué hora
3. No intentar "arreglar" con más operaciones — puede empeorar
4. Para Firestore: verificar si hay backups en `epa-backups-prod`

Para más detalle sobre los recursos protegidos y procedimientos de recuperación,
leer `references/protected-resources.md`.
