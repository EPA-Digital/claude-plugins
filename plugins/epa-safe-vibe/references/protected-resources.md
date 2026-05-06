# Recursos Protegidos — epa-turing

Estos recursos NO deben modificarse, eliminarse, ni sobreescribirse
sin autorización explícita del **área de Datos e IA** (`datos@epa.digital`).

Cualquier intento de operación destructiva sobre estos recursos
activa BLOQUEO TOTAL en epa-safe-vibe.

---

## Firestore — Colecciones protegidas

| Colección | Producto | Por qué es crítica |
|---|---|---|
| `PitagorasUsers` | Pitágoras | Autenticación de todos los usuarios de Pitágoras. Su pérdida deja inaccesible la plataforma. |
| `PitagorasTokens` | Pitágoras | Tokens de sesión activos. Pérdida = logout masivo de todos los usuarios. |

**Operaciones bloqueadas sobre estas colecciones:**
- `delete()` sobre documentos individuales sin flujo de negocio definido
- Sobreescritura masiva con `set()` sin merge
- Eliminación de la colección completa
- Cambio de estructura de documentos existentes sin migración

---

## Secret Manager — Secrets protegidos

| Secret | Plataforma | Impacto si se elimina |
|---|---|---|
| `FacebookAccessToken` | Meta Ads | Todos los reportes y ETLs de Meta dejan de funcionar |
| `TiktokToken` | TikTok Ads | Integración TikTok rota para todos los clientes |
| `GoogleAdsYAML` | Google Ads | Acceso a Google Ads roto en toda la agencia |
| `BingAccessTokenEpa` | Bing Ads | Integración Bing rota |

Path de acceso (solo lectura):
```
projects/689827400521/secrets/{NombreSecret}/versions/latest
```

**Nunca:**
- Crear una nueva versión con un valor vacío o incorrecto
- Eliminar versiones activas
- Compartir el valor fuera de Secret Manager

---

## Colecciones de uso compartido (precaución, no bloqueo total)

Estas colecciones las consumen múltiples servicios o equipos.
Antes de modificarlas, verificar con el equipo responsable.

| Colección | Responsable | Nota |
|---|---|---|
| `EpaSettings` | Área de Datos e IA | Configuración global — cualquier cambio afecta toda la plataforma |

> Cuando se onboarde un producto interno nuevo (todavía en exploración) y empiece
> a almacenar datos compartidos, **agregar su colección a esta tabla** antes de
> exponerla a otros equipos.

---

## Procedimiento de recuperación ante pérdida de datos

### Firestore
1. Verificar si existe backup en `gs://epa-backups-prod/firestore/`
2. Contactar al área de Datos e IA (datos@epa.digital) inmediatamente
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
