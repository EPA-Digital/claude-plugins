# Pitágoras — Cómo acceder correctamente

Pitágoras es la capa de integración centralizada de EPA para datos de medios.
NUNCA acceder directamente a las APIs de plataforma desde código nuevo.

> **La forma correcta de "acceder" hoy es leer BigQuery, no llamar a
> Pitágoras.** Los datos ya están materializados en
> `bdd-epa-digital.{cliente}_reporting`. El acceso directo a la API REST o al
> MCP (Tokyo) está **DEPRECADO** para apps, dashboards, reportes y vibecoding
> — el único consumidor legítimo es el ETL centralizado (en construcción,
> área de Datos e IA). Si el dato que necesitas no está en BigQuery, escala a
> `datos@epa.digital`; no lo resuelvas llamando a Pitágoras tú mismo.

> Para detalles técnicos completos (clientes Python/TS, todos los endpoints,
> manejo de errores, integración con BigQuery), ver
> `epa-stack/references/pitagoras.md`. Este archivo es la versión corta para
> el guardrail de seguridad.

---

## Endpoints (referencia — uso exclusivo del ETL centralizado)

```
API REST:    https://pitagoras-api-229508468478.us-central1.run.app
API path:    /api/v1
MCP Server:  https://pitagoras-api-2yl4a3ya6a-uc.a.run.app/mcp
             DEPRECADO — nombre de producto Tokyo. No usar.
```

Ambos son públicos pero requieren autenticación. La API genera un token bearer
vía `POST /api/v1/customers` con un `user_email` autorizado, y ese token va
en el header `Authorization` de los demás requests (sin prefijo `Bearer`).

---

## Plataformas soportadas hoy

```
googleads / adwords  →  Google Ads
facebook             →  Meta Ads (Facebook + Instagram)
analytics            →  Universal Analytics (legacy)
analytics4           →  Google Analytics 4 (GA4)
bing                 →  Microsoft Advertising
tiktok               →  TikTok Ads
linkedin             →  LinkedIn Ads
dv360                →  Display & Video 360
```

Si necesitas un provider que NO está en esta lista, contactar al área de
Datos e IA antes de buscar acceso directo a su API.

---

## Opción 1 — MCP de Pitágoras / Tokyo — DEPRECADO

Este MCP (`https://pitagoras-api-2yl4a3ya6a-uc.a.run.app/mcp`, nombre de
producto **Tokyo**) permitía pedir reportes en lenguaje natural durante
vibecoding. **Ya no se usa.** Para explorar datos de un cliente durante
vibecoding, lee directo `bdd-epa-digital.{cliente}_reporting` (ver
`epa-stack/references/bigquery-patterns.md`) — no configures este MCP en
proyectos nuevos.

---

## Opción 2 — API REST de Pitágoras (uso exclusivo del ETL centralizado)

Este patrón ya no es para apps de vibecoding — es la referencia interna que
usa el ETL centralizado (área de Datos e IA) para poblar
`{cliente}_reporting`. Si estás construyendo una app o dashboard, no
necesitas nada de esta sección: lee BigQuery. El patrón mínimo (referencia):

```python
import httpx
import os

PITAGORAS_BASE_URL = "https://pitagoras-api-229508468478.us-central1.run.app"

async def get_pitagoras_token(user_email: str) -> str:
    """Obtiene token bearer de Pitágoras. El token expira; renueva en 401."""
    async with httpx.AsyncClient(timeout=30.0) as http:
        response = await http.post(
            f"{PITAGORAS_BASE_URL}/api/v1/customers",
            json={"user_email": user_email},
        )
        response.raise_for_status()
        return response.json()["token"]


async def get_facebook_report(user_email: str, accounts, fields, start_date, end_date):
    token = await get_pitagoras_token(user_email)
    async with httpx.AsyncClient(timeout=30.0) as http:
        response = await http.post(
            f"{PITAGORAS_BASE_URL}/api/v1/facebook/report",
            headers={"Authorization": token},  # SIN "Bearer "
            json={
                "accounts": accounts,
                "fields": fields,
                "start_date": start_date,
                "end_date": end_date,
            },
        )
        response.raise_for_status()
        return response.json()
```

Reglas obligatorias:
- El `user_email` se inyecta por variable de entorno (`EPA_PITAGORAS_USER_EMAIL`)
  o se obtiene del request del usuario autenticado — **nunca hardcodear**.
- Header `Authorization` va con el token directo, **sin `Bearer `**.
- En `401` refrescar token llamando otra vez a `/customers` y reintentar UNA
  sola vez antes de fallar.

### Endpoints de reporte (uno por plataforma)

```
POST /api/v1/adwords/report
POST /api/v1/facebook/report
POST /api/v1/analytics/report
POST /api/v1/analytics4/report
POST /api/v1/bing/report
POST /api/v1/tik-tok/report
POST /api/v1/linkedin/report
POST /api/v1/dv360/report
```

### Endpoint de presupuestos (budgets)

Para alertas de pacing o reconciliación, Pitágoras expone presupuestos
asignados por cuenta para los 8 providers. El shape exacto del request y
response varía por provider — validar contra el contrato vigente con el área
de Datos e IA antes de integrar.

---

## Cuándo NO usar Pitágoras

Pitágoras provee datos de medios y tracking. Para otros casos:

| Necesidad | Herramienta correcta |
|---|---|
| Datos de CRM del cliente | API del CRM del cliente |
| Datos internos de EPA | BigQuery o Firestore en epa-turing |
| Datos de Google Search Console | GSC API directamente |
| Datos de medios orgánicos (no paid) | Plataforma directamente |

---

## Soporte de Pitágoras

Si la API devuelve errores raros, no tiene los datos esperados, o necesitas
onboardear un `user_email` nuevo, contactar al área de Datos e IA
(`datos@epa.digital`) antes de buscar alternativas directas a las APIs de
plataforma.
