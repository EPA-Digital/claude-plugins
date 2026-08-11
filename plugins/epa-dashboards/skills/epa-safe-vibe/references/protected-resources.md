# Recursos Protegidos — bdd-epa-digital y epa-turing

Estos recursos NO deben modificarse, eliminarse, ni sobreescribirse
sin autorización explícita del **área de Datos e IA** (`datos@epa.digital`).

Cualquier intento de operación destructiva sobre estos recursos
activa BLOQUEO TOTAL en epa-safe-vibe.

---

## Firestore — Colecciones protegidas

Las colecciones críticas viven en el proyecto **`bdd-epa-digital`** (no en `epa-turing`).
Los nombres son **lowercase** — son colecciones legacy de la agencia.

| Colección | Proyecto | Por qué es crítica |
|---|---|---|
| `users` | `bdd-epa-digital` | Autenticación y permisos de todos los usuarios de la plataforma. Pérdida = nadie puede acceder. |
| `clients` | `bdd-epa-digital` | Cuentas, credenciales de acceso y configuración de todos los clientes activos (Coppel, Chedraui, Innovasport, Nestlé, ABInBev, AMVO, Farmacias del Ahorro, UVM, entre otros). |
| `budgets` | `bdd-epa-digital` | Datos de presupuesto y pacing por cuenta. Pérdida interrumpe el control de inversión publicitaria. |

**Operaciones bloqueadas sobre estas colecciones:**
- `delete()` sobre documentos individuales sin flujo de negocio definido
- Sobreescritura masiva con `set()` sin merge
- Eliminación de la colección completa
- Cambio de estructura de documentos existentes sin migración aprobada

**Otras colecciones en `bdd-epa-digital` que no deben tocarse sin consultar:**
`analyses`, `audits`, `etl_runs`, `extraction_logs`, `historic`, `processed_documents`, `projects`, `rules`

Un dashboard no debería tocar ninguna de estas — no son parte de su modelo
de datos (ver `epa-bq`). Si tu dashboard necesita leer o escribir en alguna,
detente y confirma con Datos e IA antes de continuar.

---

## Secret Manager — Secrets protegidos

Secrets en el proyecto **`epa-turing`**:

| Secret | Plataforma | Impacto si se elimina |
|---|---|---|
| `FacebookAccessToken` | Meta Ads | Todos los reportes y ETLs de Meta dejan de funcionar |
| `TiktokToken` | TikTok Ads | Integración TikTok rota para todos los clientes |
| `GoogleAdsYAML` | Google Ads | Acceso a Google Ads roto en toda la agencia |
| `BingAccessTokenEpa` | Bing Ads | Integración Bing rota |

Estos secrets son del ETL centralizado — un dashboard no debería
necesitarlos directamente (ver B3 en `SKILL.md`).

**Nunca:**
- Crear una nueva versión con un valor vacío o incorrecto
- Eliminar versiones activas
- Compartir el valor fuera de Secret Manager

---

## Cloud Run — Servicios protegidos

| Servicio | Proyecto | Por qué es crítico |
|---|---|---|
| `epa-dashboard` (**Newton**) | `bdd-epa-digital` | Intranet de EPA en `dashboard.epa.digital` — dashboard usado a diario para revisar el estatus de cuentas. Lleva >1 año corriendo con ese nombre genérico (legacy; debió ser `newton-web`). |
| `pitagoras-api` | `epa-turing` | Capa centralizada de medios (8 providers). Romperla rompe el ETL centralizado. |

**Operaciones bloqueadas (BLOQUEO TOTAL):**
- `gcloud run deploy` apuntando a uno de estos nombres (sobrescribe el servicio vivo).
- `gcloud run services delete/update/replace` sobre ellos.
- Crear un trigger de Cloud Build que despliegue sobre estos nombres.

> ⚠️ **Incidente Newton (2026-06-09):** un deploy automatizado reusó el
> nombre `epa-dashboard` en `bdd-epa-digital` y sobrescribió a Newton.
> Regla derivada (ver `SKILL.md` B7): todo dashboard va a `epa-turing` +
> sufijo `-vibe` en el nombre del servicio — **siempre, incluida
> producción, sin excepción**. El hook `hooks/guard-cloud-deploy.sh` lo
> enforce.

---

## Procedimiento de recuperación ante pérdida de datos

### Firestore (`bdd-epa-digital`)
1. Contactar al área de Datos e IA (datos@epa.digital) inmediatamente
2. Verificar si existe backup en `gs://epa-backups-prod/firestore/`
3. Si hay backup reciente: restaurar con `gcloud firestore import`
4. Si no hay backup: escalar a soporte de GCP (datos pueden recuperarse
   hasta 7 días después con soporte Enterprise)

### Secret Manager
Los secrets eliminados tienen un periodo de retención de 24h.
Contactar al área de Datos e IA para restaurar desde el historial de versiones.

---

## Contactos de escalación

| Situación | Contactar a |
|---|---|
| Pérdida de datos en Firestore | Área de Datos e IA — datos@epa.digital |
| Secret comprometido o eliminado | Área de Datos e IA + rotar credencial en la plataforma upstream |
| Gasto inesperado en GCP | Área de Datos e IA |
| Servicio de Cloud Run caído | Equipo de Desarrollo |
