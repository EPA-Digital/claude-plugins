# Pitágoras — Cómo acceder correctamente

Pitágoras es la capa de integración centralizada de EPA para datos de medios.
NUNCA acceder directamente a Meta, Google Ads, TikTok, o Bing desde código nuevo.

---

## Opción 1 — MCP de Pitágoras (recomendado para vibecoding)

Si estás usando Claude Code o Cowork, el MCP de Pitágoras ya está disponible.
Solo necesitas invocarlo en tu prompt:

```
"Obtén las campañas activas de Meta para el cliente Coppel del último mes"
"Dame el gasto por campaña de Google Ads de MacStore esta semana"
"Trae las métricas de conversión de TikTok para el cliente X"
```

El MCP se encarga de la autenticación, paginación, y normalización de datos.

MCP endpoint: `https://pitagoras-api-2yl4a3ya6a-uc.a.run.app/mcp`

---

## Opción 2 — API REST de Pitágoras

Para apps que necesitan datos de medios en runtime:

```python
import httpx
from google.cloud import secretmanager

def get_pitagoras_token() -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = "projects/689827400521/secrets/PitagorasApiKey/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

async def get_campaigns(platform: str, client_id: str, date_from: str, date_to: str):
    token = get_pitagoras_token()
    base_url = "https://pitagoras-api-2yl4a3ya6a-uc.a.run.app"

    async with httpx.AsyncClient() as http:
        response = await http.get(
            f"{base_url}/api/v1/{platform}/campaigns",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "client_id": client_id,
                "date_from": date_from,
                "date_to": date_to,
            }
        )
        response.raise_for_status()
        return response.json()
```

### Plataformas disponibles en Pitágoras
```
facebook    →  Meta Ads (campañas, ad sets, ads, métricas)
googleads   →  Google Ads (campañas, grupos de anuncios, keywords)
tiktok      →  TikTok Ads
bing        →  Microsoft Advertising
```

---

## Cuándo NO usar Pitágoras

Pitágoras provee datos de medios pagados (paid media). Para otros casos:

| Necesidad | Herramienta correcta |
|---|---|
| Analytics de sitio web | GA4 API directamente |
| Datos de CRM del cliente | API del CRM del cliente |
| Datos internos de EPA | BigQuery o Firestore en epa-turing |
| Datos de Google Search Console | GSC API directamente |

---

## Soporte de Pitágoras

Si la API de Pitágoras devuelve errores o no tiene los datos que necesitas,
contactar al área de Datos antes de buscar alternativas directas.
