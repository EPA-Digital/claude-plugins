---
name: epa-stack
description: >
  Stack canónico de EPA Digital para vibecoding en epa-turing. Activar SIEMPRE
  que el usuario vaya a construir algo nuevo: dashboard, ETL, pipeline de datos,
  API, automatización, alerta, o cualquier app. Proporciona el árbol de decisión
  de arquitectura correcto, el stack aprobado por caso de uso, y el boilerplate
  mínimo para arrancar sin malas prácticas desde el origen. También activar cuando
  el usuario pregunte "qué usar para X", "cómo hago Y en GCP", o "cómo estructuro
  este proyecto". Prerequisito: epa-naming y epa-safe-vibe instalados.
---

# EPA Stack — Arquitectura Canónica

Proyecto GCP: **epa-turing** (`projects/689827400521`)
Región: **us-central1**

Antes de escribir una línea de código, identificar el caso de uso
y seguir el árbol de decisión correspondiente.

---

## Árbol de decisión principal

```
¿Qué estoy construyendo?
│
├── 1. NECESITO DATOS DE MEDIOS O ANALYTICS
│   │   (Google Ads, Meta, Universal Analytics, GA4, Bing, TikTok, LinkedIn, DV360)
│   ├── ¿El dato que necesitas ya está en `bdd-epa-digital.{cliente}_reporting`?
│   │   └── → Léelo de ahí directo. No llames a ninguna API.
│   │
│   └── ¿No está — necesitas un extract nuevo o un grano distinto?
│       └── → Escala a datos@epa.digital (ETL centralizado, en construcción).
│           DEPRECADO: acceso directo a Pitágoras (API REST o MCP/Tokyo)
│           desde apps, dashboards o vibecoding — nunca lo llames tú.
│           Ver references/pitagoras.md (uso exclusivo del ETL centralizado).
│
├── 2. NECESITO LEER / GUARDAR DATOS
│   ├── ¿Necesitas métricas de medios/analytics de un cliente (campañas, sesiones, revenue)?
│   │   └── → BigQuery: `bdd-epa-digital.{cliente}_reporting`
│   │       Granular por plataforma (Google Ads, GA4, Meta, TikTok, Bing, DV360...).
│   │       Resolver el dataset por lookup — no todos los clientes usan el
│   │       sufijo `_reporting` — nunca asumirlo:
│   │         SELECT schema_name FROM `bdd-epa-digital`.INFORMATION_SCHEMA.SCHEMATA
│   │         WHERE LOWER(schema_name) LIKE '%{cliente}%'
│   │       DEPRECADO: `bdd-epa-digital.epa_agency_reports` (dataset cross-
│   │       cliente consolidado). Hoy no hay un dataset agregador vigente —
│   │       si necesitas un rollup entre varios clientes, escala a Datos e IA.
│   │
│   ├── ¿Necesitas tablas que produce el ETL centralizado (en construcción)?
│   │   └── → BigQuery: `epa-turing.{cliente}_etl.{tabla}` (particionadas por date)
│   │
│   ├── ¿Coppel y necesitas resultados de campaña detallados que NO están en
│   │     bdd-epa-digital (transacciones por SKU, building blocks de funnel)?
│   │   └── → Excepción: ga360-250517.Epa_dataset (tablas PMBF_*)
│   │       Sólo si es estrictamente necesario — el cliente pidió no usar
│   │       Domo salvo necesidad. Confirmar con el usuario primero.
│   │
│   ├── ¿Son datos tabulares de un producto interno o cliente sin pipeline canónico?
│   │   └── → BigQuery en `epa-turing`
│   │       Dataset: {cliente}_{tipo} o {producto}_{modulo}
│   │       (raw / staging / performance — ver bigquery-patterns.md)
│   │
│   ├── ¿Son documentos, configuración, estado de app, o usuarios?
│   │   └── → Firestore
│   │       Colección: {Producto}{Entidad} o {Cliente}{Entidad}
│   │
│   ├── ¿Son archivos, PDFs, imágenes, o exports?
│   │   └── → Google Cloud Storage
│   │       Bucket: epa-{proposito}-prod
│   │
│   └── ¿Son datos temporales de sesión o caché?
│       └── → Firestore con TTL o Memorystore (Redis)
│           NUNCA Google Sheets
│
├── 3. NECESITO CONSTRUIR UNA API O BACKEND
│   └── → Cloud Run
│       ├── Python: FastAPI + uvicorn
│       ├── TypeScript: Hono o Next.js API routes
│       └── Nombre: {producto}-api o {cliente}-{funcion}-svc
│
├── 4. NECESITO UN DASHBOARD O INTERFAZ
│   └── → Next.js 15 + Tailwind CSS en Cloud Run
│       Stack PREFERIDO de la agencia para cualquier UI nueva.
│       Con epa-design para tokens, componentes y copy correcto.
│       Hablar con el área de Datos antes de crear uno nuevo
│       — puede haber un esfuerzo en curso o un patrón a seguir.
│
├── 5. NECESITO AUTOMATIZAR UN PROCESO
│   ├── ¿Se ejecuta en horario fijo (diario, semanal)?
│   │   └── → Cloud Scheduler + Cloud Run job
│   │
│   ├── ¿Se ejecuta cuando ocurre un evento?
│   │   └── → Pub/Sub + Cloud Run
│   │
│   ├── ¿Es un flujo visual con múltiples pasos?
│   │   └── → n8n (instancia EPA en epa-digital.app.n8n.cloud)
│   │
│   └── ¿Es una automatización puntual de Workspace?
│       └── → Apps Script (solo para esto, no para lógica de negocio)
│
├── 6. NECESITO PROCESAR DATOS (ETL / Pipeline)
│   ├── ¿Transformación simple, un solo paso?
│   │   └── → Cloud Run job (Python con pandas o TypeScript)
│   │
│   ├── ¿Pipeline complejo con múltiples pasos y dependencias?
│   │   └── → n8n o Cloud Workflows
│   │
│   └── ¿Procesamiento masivo de BigQuery a BigQuery?
│       └── → BigQuery scheduled queries o dbt
│
├── 7. NECESITO ENVIAR ALERTAS O NOTIFICACIONES
│   ├── ¿Alertas de performance de campañas?
│   │   └── → n8n + Slack webhook o email
│   │
│   └── ¿Alertas de sistema o infraestructura?
│       └── → Cloud Monitoring + Alerting
│
└── 8. NECESITO AUTENTICAR USUARIOS
    └── → Firebase Authentication (mismo proyecto GCP epa-turing)
        El backend verifica tokens reusando el mismo service account
        ya usado para BigQuery/Firestore — sin secret nuevo.
        Ver references/firebase-auth.md
```

> **Vibecoding = TypeScript.** Todo proyecto de vibecoding (dashboards y su
> lógica) se hace en TypeScript con el stack del skill `epa-frontend`
> (plugin epa-dashboards). Si el proyecto necesita un ETL, un job
> programado o un servicio backend aparte, no lo construyas: escálalo al
> equipo de datos (datos@epa.digital).

---

## Stack aprobado por lenguaje

### Python — para data, ETLs, scripts, y ML
```
Runtime:        Python 3.11+
Web framework:  FastAPI
HTTP client:    httpx (async) o requests (sync)
Data:           pandas, polars (para datasets grandes)
GCP SDK:        google-cloud-* (bigquery, firestore, storage, secretmanager)
Linting:        ruff
Type hints:     siempre — no código sin tipado
```

### TypeScript — para APIs, dashboards y herramientas CLI
```
Runtime:        Node.js 20+ o Bun
Dashboards UI:  Next.js 15 + Tailwind CSS  ← stack PREFERIDO para toda UI nueva
APIs ligeras:   Hono
HTTP client:    fetch nativo o ky
GCP SDK:        @google-cloud/* (bigquery, firestore)
ORM/DB:         Prisma (si se usa PostgreSQL) o SDK nativo de Firestore
Linting:        biome o eslint + prettier
Styling:        Tailwind CSS con tokens de epa-design (NO CSS-in-JS, NO MUI)
Componentes:    HTML semántico + componentes copy-paste de epa-design/components.md
                shadcn/ui aceptado si se reestiliza con tokens EPA
```

### Cuándo usar cada uno
```
Python  →  ETLs, pipelines de datos, ML, scripts de análisis, workers pesados
TypeScript →  APIs con UI, dashboards, CLIs, herramientas de producto
Ambos son válidos para Cloud Run — elegir por el caso de uso, no por preferencia
```

---

## Boilerplate mínimo — Cloud Run con FastAPI (Python)

Estructura de archivos:
```
{nombre-servicio}/
├── main.py
├── requirements.txt
├── Dockerfile
├── .env.example         ← documentar variables, nunca valores reales
├── .gitignore
└── README.md
```

**main.py:**
```python
from fastapi import FastAPI, HTTPException
from google.cloud import secretmanager
import os

app = FastAPI(title="{NombreServicio}", version="1.0.0")

def get_secret(secret_id: str) -> str:
    """Obtiene un secreto de Secret Manager. Nunca hardcodear credenciales."""
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/689827400521/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"service": "{nombre-servicio}", "version": "1.0.0"}
```

**requirements.txt:**
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
google-cloud-secret-manager==2.20.0
google-cloud-firestore==2.16.0
google-cloud-bigquery==3.25.0
httpx==0.27.0
```

**Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**.gitignore:**
```
.env
*.key
*.pem
service-account*.json
__pycache__/
.venv/
dist/
```

---

## Boilerplate mínimo — Cloud Run con Hono (TypeScript)

Estructura:
```
{nombre-servicio}/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
├── .gitignore
└── README.md
```

**src/index.ts:**
```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

// Health check obligatorio para Cloud Run
app.get('/health', (c) => c.json({ status: 'ok' }))
app.get('/', (c) => c.json({ service: '{nombre-servicio}', version: '1.0.0' }))

const port = parseInt(process.env.PORT ?? '8080')
serve({ fetch: app.fetch, port })
console.log(`Running on port ${port}`)
```

**package.json:**
```json
{
  "name": "{nombre-servicio}",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "hono": "^4.5.0",
    "@hono/node-server": "^1.12.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "tsx": "^4.17.0",
    "@types/node": "^22.0.0"
  }
}
```

---

## Patrones de acceso a datos

### Firestore — leer y escribir documentos
```python
from google.cloud import firestore

db = firestore.Client(project="epa-turing")

# LEER — siempre con limit() para no traer colecciones enteras
docs = db.collection("CoppelCampaigns").limit(100).stream()
for doc in docs:
    print(doc.to_dict())

# ESCRIBIR — usar merge=True para no sobreescribir campos existentes
db.collection("CoppelCampaigns").document(doc_id).set(data, merge=True)

# NUNCA — sin limit en colecciones grandes
# db.collection("CoppelCampaigns").stream()  ← puede traer millones
```

### BigQuery — queries con costo controlado
```python
from google.cloud import bigquery

# El cliente puede correr desde epa-turing y consultar bdd-epa-digital
# si el service account tiene roles/bigquery.dataViewer en el dataset
client = bigquery.Client(project="epa-turing")

# Métricas de un cliente: dataset {cliente}_reporting (resolver el nombre
# exacto por lookup en INFORMATION_SCHEMA.SCHEMATA, no asumir el sufijo).
# Ejemplo sobre una vista de métricas de Google Ads — nombres reales de vista
# varían por cliente, ver epa-bq (plugin epa-dashboards) o el equipo de Datos.
query = """
    SELECT
      campaign_id,
      segments_date AS date,
      SUM(metrics_cost_micros) / 1e6 AS cost,
      SUM(metrics_conversions)       AS conversions,
      SUM(metrics_conversions_value) AS conversions_value
    FROM `bdd-epa-digital.chedraui_reporting.ads_CampaignBasicStats_{mcc}`
    WHERE segments_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY 1, 2
    ORDER BY date DESC
    LIMIT 1000
"""

# Configurar un límite de bytes para evitar costos inesperados
job_config = bigquery.QueryJobConfig(
    maximum_bytes_billed=100 * 1024 * 1024,  # 100 MB máximo
)

results = client.query(query, job_config=job_config).result()
```

### GCS — subir y descargar archivos
```python
from google.cloud import storage

storage_client = storage.Client(project="epa-turing")
bucket = storage_client.bucket("epa-reports-prod")

# Subir archivo
blob = bucket.blob(f"coppel/2025-05/reporte-mayo.pdf")
blob.upload_from_filename("reporte-mayo.pdf")

# URL firmada para descarga (expira en 1 hora)
url = blob.generate_signed_url(expiration=3600)
```

---

## Anti-patrones bloqueados por epa-safe-vibe

Estos patrones los detecta y bloquea epa-safe-vibe. Se listan aquí para referencia:

```
✗  Google Sheets como base de datos de app
✗  Apps Script para ETLs o lógica de backend
✗  Credenciales hardcodeadas en código
✗  Acceso directo a APIs de medios sin Pitágoras
✗  Compute Engine VM gestionada manualmente (usar Cloud Run)
✗  Queries a Firestore/BigQuery sin LIMIT
✗  Variables de entorno sin prefijo EPA_
✗  .env con valores reales commiteado al repo
```

---

## Recursos adicionales

- `references/bigquery-patterns.md` — patrones avanzados de BQ, particionamiento, costos
- `references/firestore-patterns.md` — modelado de datos, índices, seguridad rules
- `references/n8n-patterns.md` — flujos comunes ya construidos en la instancia EPA
