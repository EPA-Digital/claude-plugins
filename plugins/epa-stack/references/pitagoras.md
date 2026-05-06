# Pitágoras — Acceso desde código

Pitágoras es la capa de integración centralizada de EPA para datos de medios.
NUNCA acceder directamente a Meta, Google Ads, TikTok, o Bing desde código nuevo.

Endpoint base: `https://pitagoras-api-2yl4a3ya6a-uc.a.run.app`
MCP endpoint:  `https://pitagoras-api-2yl4a3ya6a-uc.a.run.app/mcp`

---

## Decisión rápida — qué método usar

```
Vibecoding interactivo (Claude Code, Cowork)
    └── MCP de Pitágoras (sin código)

App o servicio en runtime
    └── REST API con httpx / fetch

Pipeline batch a BigQuery
    └── REST API + Cloud Run job (no llamar desde dashboard)

n8n flow
    └── HTTP Request node con credencial "EPA · Pitágoras API"
```

---

## Plataformas disponibles

```
facebook    →  Meta Ads (campañas, ad sets, ads, métricas)
googleads   →  Google Ads (campañas, grupos, keywords)
tiktok      →  TikTok Ads
bing        →  Microsoft Advertising
```

Endpoints comunes:
```
GET /api/v1/{platform}/accounts
GET /api/v1/{platform}/campaigns?client_id=&date_from=&date_to=
GET /api/v1/{platform}/insights?level=ad&...
```

---

## Autenticación

API key en Secret Manager: `PitagorasApiKey`.

```python
from google.cloud import secretmanager

def get_pitagoras_token() -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = "projects/689827400521/secrets/PitagorasApiKey/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")
```

NUNCA hardcodear la key. NUNCA pasarla como query param (logs, accidental git
commits).

---

## Cliente Python — patrón estándar

```python
import os
import httpx
from google.cloud import secretmanager
from typing import Any

PITAGORAS_BASE_URL = "https://pitagoras-api-2yl4a3ya6a-uc.a.run.app"

def _get_token() -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = "projects/689827400521/secrets/PitagorasApiKey/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

class PitagorasClient:
    def __init__(self, timeout: float = 30.0):
        self._token = _get_token()
        self._timeout = timeout

    async def get_campaigns(
        self,
        platform: str,
        client_id: str,
        date_from: str,
        date_to: str,
    ) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=self._timeout) as http:
            response = await http.get(
                f"{PITAGORAS_BASE_URL}/api/v1/{platform}/campaigns",
                headers={"Authorization": f"Bearer {self._token}"},
                params={
                    "client_id": client_id,
                    "date_from": date_from,
                    "date_to": date_to,
                },
            )
            response.raise_for_status()
            return response.json()
```

Características obligatorias:
- Timeout explícito (default 30s).
- `raise_for_status()` para fallar fuerte si el upstream responde mal.
- Lectura del token solo en `__init__` — no en cada request.

---

## Cliente TypeScript — patrón estándar

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

const PITAGORAS_BASE_URL = 'https://pitagoras-api-2yl4a3ya6a-uc.a.run.app'
const PROJECT = 'epa-turing'

async function getToken(): Promise<string> {
  const sm = new SecretManagerServiceClient()
  const [version] = await sm.accessSecretVersion({
    name: `projects/689827400521/secrets/PitagorasApiKey/versions/latest`,
  })
  return version.payload!.data!.toString()
}

export class PitagorasClient {
  private token: Promise<string>

  constructor() {
    this.token = getToken()
  }

  async getCampaigns(params: {
    platform: 'facebook' | 'googleads' | 'tiktok' | 'bing'
    clientId: string
    dateFrom: string
    dateTo: string
  }) {
    const token = await this.token
    const url = new URL(`${PITAGORAS_BASE_URL}/api/v1/${params.platform}/campaigns`)
    url.searchParams.set('client_id', params.clientId)
    url.searchParams.set('date_from', params.dateFrom)
    url.searchParams.set('date_to', params.dateTo)

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Pitágoras ${res.status}: ${await res.text()}`)
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
| 401 | Token inválido o expirado | Rotar el secret, contactar Datos |
| 404 | Cliente o plataforma no existen | Validar inputs |
| 429 | Rate limit | Backoff exponencial, máx 3 reintentos |
| 5xx | Error interno de Pitágoras | Reintentar con backoff, notificar a Datos si persiste |

```python
import asyncio
import httpx

async def with_retry(coro, max_attempts: int = 3):
    for attempt in range(max_attempts):
        try:
            return await coro()
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (429, 502, 503, 504):
                if attempt == max_attempts - 1:
                    raise
                await asyncio.sleep(2 ** attempt)
            else:
                raise
```

---

## Cuándo NO usar Pitágoras

| Necesidad | Herramienta correcta |
|---|---|
| Analytics de sitio web | GA4 API directamente |
| Datos de CRM del cliente | API del CRM del cliente |
| Datos internos de EPA | BigQuery o Firestore en epa-turing |
| Datos de Google Search Console | GSC API directamente |
| Datos de medios orgánicos (no paid) | Plataforma directamente |

---

## MCP — uso en vibecoding

Si Claude Code o Cowork tienen el MCP de Pitágoras configurado, basta con
pedir en lenguaje natural:

```
"Trae las campañas activas de Meta del cliente Coppel del último mes"
"Compárame el ROAS de Google Ads vs Meta para MacStore en Q1"
```

El MCP se encarga de auth, paginación y normalización. Para apps en runtime,
seguir usando la API REST.

---

## Integración con BigQuery — patrón ELT

```
Pitágoras API
     ↓ (Cloud Run job, programado)
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

Si la API de Pitágoras devuelve errores raros o no tiene los datos esperados,
contactar al área de Datos antes de buscar alternativas directas a las APIs
de plataforma.
