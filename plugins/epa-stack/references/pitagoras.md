# Pitágoras — Acceso desde código

Pitágoras es la capa de integración centralizada de EPA para datos de medios.
NUNCA acceder directamente a las APIs de plataforma desde código nuevo.

> **DEPRECADO:** llamar a Pitágoras directo desde apps, dashboards, reportes
> o vibecoding interactivo. El único consumidor de este documento hoy es el
> **ETL centralizado** (en construcción, área de Datos e IA). Todo lo demás
> lee los datos ya materializados en BigQuery
> (`bdd-epa-digital.{cliente}_reporting`) — si el dato que necesitas no está
> ahí, escala a datos@epa.digital en vez de llamar a Pitágoras. El resto de
> este documento es la referencia técnica que usa el ETL internamente.

## Endpoints

```
API REST:    https://pitagoras-api-229508468478.us-central1.run.app
API path:    /api/v1
             Uso: EXCLUSIVO del ETL centralizado.
MCP Server:  https://pitagoras-api-2yl4a3ya6a-uc.a.run.app/mcp
             DEPRECADO — nombre de producto Tokyo. No usar.
```

> Ambos endpoints son públicos pero **requerían autenticación distinta**:
> - **API REST**: token bearer obtenido vía `POST /api/v1/customers` con un
>   `user_email` autorizado. El token va en `Authorization` (sin `Bearer `).
> - **MCP Server (Tokyo, deprecado)**: usaba Google OAuth con la cuenta
>   `@epa.digital` del usuario.
>
> Nunca expongas el token de la API ni el `user_email` en logs, respuestas
> al cliente, ni en commits.

---

## Plataformas soportadas hoy

Pitágoras agrega 8 fuentes de medios. La lista vigente (ver dropdown "Select
a provider" en el frontend) es:

| Provider key | Plataforma |
|---|---|
| `googleads` (alias `adwords`) | Google Ads |
| `analytics` | Universal Analytics (legacy, ojo: deprecado por Google a julio 2024) |
| `analytics4` | Google Analytics 4 (GA4) |
| `facebook` | Meta Ads (Facebook + Instagram) |
| `bing` | Microsoft Advertising (Bing) |
| `tiktok` | TikTok Ads |
| `linkedin` | LinkedIn Ads |
| `dv360` | Display & Video 360 |

Cuando una plataforma nueva no esté en la lista, contactar al área de Datos
e IA antes de buscar acceso directo a su API.

---

## Decisión rápida — qué método usar

```
Necesito datos de medios para una app, dashboard o vibecoding
    └── Léelos de bdd-epa-digital.{cliente}_reporting. NO llames a Pitágoras.
        Si el dato no está ahí, escala a datos@epa.digital.

Soy el ETL centralizado (área de Datos e IA) construyendo un extract nuevo
    └── API REST con httpx / fetch + token bearer (ver abajo)

Vibecoding interactivo vía MCP (Tokyo)
    └── DEPRECADO. No usar.

Solo necesito presupuestos asignados por cuenta
    └── Endpoint de budgets — mismo criterio: uso exclusivo del ETL.
```

---

## Endpoints principales de la API

### Auth — obtener token y customers

`POST /api/v1/customers` con body `{ "user_email": "..." }`. Devuelve el token
y la lista de customers a los que ese email tiene acceso. El token va en cada
request en el header `Authorization` **sin el prefijo `Bearer`**.

### Reportes (uno por plataforma)

```
POST /api/v1/adwords/report          ← Google Ads
POST /api/v1/facebook/report         ← Meta Ads
POST /api/v1/analytics/report        ← Universal Analytics
POST /api/v1/analytics4/report       ← GA4
POST /api/v1/bing/report             ← Bing
POST /api/v1/tik-tok/report          ← TikTok
POST /api/v1/linkedin/report         ← LinkedIn
POST /api/v1/dv360/report            ← DV360
```

Estructura común:
- `accounts` (array de objetos identificadores de cuenta)
- `start_date`, `end_date` en formato `YYYY-MM-DD`
- Campos específicos por plataforma: `metrics`, `dimensions`, `fields`,
  `attributes`, `segments`, `level`, `data_level`, `columns` — depende de la
  plataforma. Ver el SDK / MCP para el shape exacto.

### Endpoints de descubrimiento

Útiles para construir reportes dinámicos:
```
GET  /api/v1/adwords/resources
GET  /api/v1/adwords/attributes?resource_name=…
GET  /api/v1/adwords/segments?resource_name=…
GET  /api/v1/adwords/metrics?resource_name=…
GET  /api/v1/facebook/schema
GET  /api/v1/analytics/dimensions
POST /api/v1/analytics/metrics       ← body: { dimensions: [...] }
POST /api/v1/analytics/filters       ← body: dimensions
POST /api/v1/analytics4/metadata     ← body: { property_id }
GET  /api/v1/bing/levels
GET  /api/v1/bing/columns?level=…
GET  /api/v1/tik-tok/data-levels
GET  /api/v1/tik-tok/dimensions?data-level=…
POST /api/v1/tik-tok/metrics         ← body: { dimensions: [...] }
```

### Budgets

Endpoint dedicado a extraer presupuestos asignados por provider y cuenta —
útil para alertas de pacing y reconciliación con plataforma. Acepta los 8
providers listados arriba (ver dropdown "Select a provider" en el frontend).

```
GET /api/v1/{provider}/budgets?account_id=…
```

Validar el shape exacto contra el contrato vigente con el área de Datos e IA
antes de integrar — la respuesta varía por provider.

---

## Autenticación — patrón de cliente

API key de Pitágoras NO existe como secret estático compartido. El flujo es:

1. Cliente envía `POST /customers` con un `user_email` autorizado (alta vía
   el área de Datos e IA).
2. Pitágoras devuelve un token + la lista de customers permitidos para ese email.
3. Cliente usa ese token en `Authorization` para los demás endpoints.
4. Si recibe `401`, repite el paso 1 — el token expira.

```python
import httpx
from typing import Any

PITAGORAS_BASE_URL = "https://pitagoras-api-229508468478.us-central1.run.app"

async def get_pitagoras_token(user_email: str) -> tuple[str, list[dict[str, Any]]]:
    async with httpx.AsyncClient(timeout=30.0) as http:
        response = await http.post(
            f"{PITAGORAS_BASE_URL}/api/v1/customers",
            json={"user_email": user_email},
        )
        response.raise_for_status()
        data = response.json()
        return data["token"], data.get("customers", [])
```

---

## Cliente Python — patrón estándar

```python
import httpx
from typing import Any

PITAGORAS_BASE_URL = "https://pitagoras-api-229508468478.us-central1.run.app"

class PitagorasClient:
    def __init__(self, user_email: str, timeout: float = 30.0):
        self._user_email = user_email
        self._timeout = timeout
        self._token: str | None = None

    async def _ensure_token(self) -> str:
        if self._token:
            return self._token
        async with httpx.AsyncClient(timeout=self._timeout) as http:
            response = await http.post(
                f"{PITAGORAS_BASE_URL}/api/v1/customers",
                json={"user_email": self._user_email},
            )
            response.raise_for_status()
            self._token = response.json()["token"]
            return self._token

    async def adwords_report(
        self,
        accounts: list[dict[str, Any]],
        resource: str,
        metrics: list[str],
        attributes: list[dict[str, Any]],
        segments: list[str],
        start_date: str,
        end_date: str,
    ) -> Any:
        token = await self._ensure_token()
        async with httpx.AsyncClient(timeout=self._timeout) as http:
            response = await http.post(
                f"{PITAGORAS_BASE_URL}/api/v1/adwords/report",
                headers={"Authorization": token},
                json={
                    "accounts": accounts,
                    "resource": resource,
                    "metrics": metrics,
                    "attributes": attributes,
                    "segments": segments,
                    "start_date": start_date,
                    "end_date": end_date,
                },
            )
            if response.status_code == 401:
                self._token = None  # expira; siguiente call refresca
            response.raise_for_status()
            return response.json()
```

Características obligatorias:
- Timeout explícito (default 30s).
- `raise_for_status()` para fallar fuerte si el upstream responde mal.
- Reintento automático en 401 refrescando el token.
- NUNCA hardcodear el `user_email` real en el código de producción —
  inyectarlo por variable de entorno.

---

## Cliente TypeScript — patrón estándar

```typescript
const PITAGORAS_BASE_URL = 'https://pitagoras-api-229508468478.us-central1.run.app'

export class PitagorasClient {
  private token: string | null = null

  constructor(private userEmail: string) {}

  private async ensureToken(): Promise<string> {
    if (this.token) return this.token
    const res = await fetch(`${PITAGORAS_BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: this.userEmail }),
    })
    if (!res.ok) throw new Error(`Pitágoras /customers ${res.status}`)
    const data = await res.json()
    this.token = data.token as string
    return this.token
  }

  async facebookReport(params: {
    accounts: Array<Record<string, unknown>>
    fields: string[]
    level?: string
    breakdowns?: string[]
    startDate: string
    endDate: string
  }) {
    const token = await this.ensureToken()
    const res = await fetch(
      `${PITAGORAS_BASE_URL}/api/v1/facebook/report`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
        },
        body: JSON.stringify({
          accounts: params.accounts,
          fields: params.fields,
          level: params.level,
          breakdowns: params.breakdowns,
          start_date: params.startDate,
          end_date: params.endDate,
        }),
      }
    )
    if (res.status === 401) this.token = null
    if (!res.ok) throw new Error(`Pitágoras facebook ${res.status}: ${await res.text()}`)
    return res.json()
  }
}
```

---

## Manejo de errores

| Status | Significado | Acción |
|---|---|---|
| 200 | OK | Continuar |
| 400 | Bad request — parámetros inválidos | Loggear, no reintentar |
| 401 | Token inválido o expirado | Refrescar token con `/customers` y reintentar |
| 403 | El user_email no tiene acceso a esa cuenta | Validar permisos, contactar Datos |
| 404 | Cuenta o plataforma no existen | Validar inputs |
| 429 | Rate limit | Backoff exponencial, máx 3 reintentos |
| 5xx | Error interno de Pitágoras | Reintentar con backoff, notificar a Datos si persiste |

---

## MCP de Pitágoras (Tokyo) — DEPRECADO

Este MCP (`https://pitagoras-api-2yl4a3ya6a-uc.a.run.app/mcp`, nombre de
producto **Tokyo**) exponía tools de reporte por plataforma, resources de
descubrimiento y prompts predefinidos para pedir análisis en lenguaje natural
sobre datos de Pitágoras. **Ya no se usa** — el acceso a datos de medios pasa
por BigQuery (`bdd-epa-digital.{cliente}_reporting`), poblado por el ETL
centralizado. No configurar este MCP en proyectos nuevos.

---

## Cuándo NO usar Pitágoras

| Necesidad | Herramienta correcta |
|---|---|
| Datos de CRM del cliente | API del CRM del cliente |
| Datos internos de EPA | BigQuery o Firestore en epa-turing |
| Datos de Google Search Console | GSC API directamente |
| Datos de medios orgánicos (no paid) | Plataforma directamente |
| Web analytics de un sitio sin GA4 instalado | No existe vía Pitágoras |

---

## Integración con BigQuery — patrón ELT

```
Pitágoras API
     ↓ (Cloud Run job, programado por Cloud Scheduler)
GCS bucket `epa-{cliente}-raw-prod`
     ↓ (BQ load job)
BigQuery dataset `{cliente}_raw`
     ↓ (scheduled query / dbt)
BigQuery dataset `{cliente}_performance`
     ↓
Dashboard o reporte
```

Nunca llamar Pitágoras directamente desde un dashboard de cliente — la latencia
es alta y se queman llamados a las APIs upstream. Cachear vía BigQuery.

---

## Soporte

Si la API de Pitágoras devuelve errores raros, no tiene los datos esperados,
o necesitas onboardear un `user_email` nuevo, contactar al área de Datos e IA
(`datos@epa.digital`) antes de buscar alternativas directas a las APIs de
plataforma.
