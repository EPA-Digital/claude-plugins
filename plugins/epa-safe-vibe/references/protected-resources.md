# Recursos Protegidos — bdd-epa-digital y epa-turing

Estos recursos NO deben modificarse, eliminarse, ni sobreescribirse
sin autorización explícita del **área de Datos e IA** (`datos@epa.digital`).

Cualquier intento de operación destructiva sobre estos recursos
activa BLOQUEO TOTAL en epa-safe-vibe.

---

## Firestore — Colecciones protegidas

Las colecciones críticas viven en el proyecto **`bdd-epa-digital`** (no en `epa-turing`).
Los nombres son **lowercase** — son colecciones legacy; no seguir PascalCase aquí.

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

---

## Secret Manager — Secrets protegidos

Secrets en el proyecto **`epa-turing`**:

| Secret | Plataforma | Impacto si se elimina |
|---|---|---|
| `FacebookAccessToken` | Meta Ads | Todos los reportes y ETLs de Meta dejan de funcionar |
| `TiktokToken` | TikTok Ads | Integración TikTok rota para todos los clientes |
| `GoogleAdsYAML` | Google Ads | Acceso a Google Ads roto en toda la agencia |
| `BingAccessTokenEpa` | Bing Ads | Integración Bing rota |

> Los secrets para LinkedIn y DV360 no están documentados aún — preguntar al área de
> Datos e IA antes de crear o modificar secrets relacionados con esos providers.

Path de acceso (solo lectura):
```
projects/689827400521/secrets/{NombreSecret}/versions/latest
```

**Nunca:**
- Crear una nueva versión con un valor vacío o incorrecto
- Eliminar versiones activas
- Compartir el valor fuera de Secret Manager

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
