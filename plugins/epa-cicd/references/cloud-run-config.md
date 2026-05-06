# Cloud Run — Configuraciones avanzadas en epa-turing

Proyecto: `epa-turing` · Región default: `us-central1`. Este documento es para
casos que pasan del template básico (CPU, memoria, autenticación, VPC, scaling).

---

## Recursos por tipo de servicio

| Tipo de servicio | CPU | Memoria | Min instances | Max instances | Concurrency |
|---|---|---|---|---|---|
| API ligera (Hono) | 1 | 512Mi | 0 | 3 | 80 |
| API Python (FastAPI) | 1 | 512Mi | 0 | 5 | 40 |
| Frontend Next.js | 1 | 1Gi | 0 | 3 | 80 |
| Job de ETL pesado | 2 | 2Gi | 0 | 1 | 1 |
| Servicio crítico (Pitágoras) | 2 | 1Gi | 1 | 10 | 80 |

`min-instances=0` por default (zero cost en idle). Solo subir a 1+ cuando hay
SLA de latencia y se acepta el costo fijo.

---

## Autenticación

### Pública (allow-unauthenticated)
Para APIs internas que validan auth en el código (JWT, API key custom):
```bash
gcloud run deploy mi-servicio \
  --allow-unauthenticated \
  ...
```

### Privada (IAM)
Para servicios solo accesibles por otras service accounts:
```bash
gcloud run deploy mi-servicio \
  --no-allow-unauthenticated \
  ...

# Dar permiso a un service account específico
gcloud run services add-iam-policy-binding mi-servicio \
  --member="serviceAccount:caller@epa-turing.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=us-central1
```

Llamadas desde otro Cloud Run service:
```python
import google.auth.transport.requests
import google.oauth2.id_token

def call_private_service(url: str, payload: dict):
    auth_req = google.auth.transport.requests.Request()
    id_token = google.oauth2.id_token.fetch_id_token(auth_req, url)
    response = httpx.post(url, json=payload, headers={
        "Authorization": f"Bearer {id_token}"
    })
    return response.json()
```

---

## Service Account dedicado por servicio

NO compartir el default compute service account entre servicios. Cada servicio
debe tener su propia identity con permisos mínimos.

```bash
# Crear SA con naming según epa-naming
gcloud iam service-accounts create pitagoras-runtime \
  --display-name="Pitágoras Runtime" \
  --project=epa-turing

# Permisos mínimos típicos
gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:pitagoras-runtime@epa-turing.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:pitagoras-runtime@epa-turing.iam.gserviceaccount.com" \
  --role="roles/datastore.user"  # Firestore

# Asignar al servicio
gcloud run deploy pitagoras-api \
  --service-account=pitagoras-runtime@epa-turing.iam.gserviceaccount.com \
  ...
```

---

## Variables de entorno y secrets

### Variables planas (no sensibles)
```bash
--set-env-vars="EPA_LOG_LEVEL=info,EPA_GCP_PROJECT=epa-turing,EPA_REGION=us-central1"
```

### Secrets desde Secret Manager
```bash
--set-secrets="EPA_FB_TOKEN=FacebookAccessToken:latest,EPA_PITAGORAS_KEY=PitagorasApiKey:latest"
```

Formato: `EPA_VAR_NAME=NombreSecret:version`. Usar `:latest` salvo cuando se
quiere pinear (rare).

El service account del runtime necesita `roles/secretmanager.secretAccessor`
sobre cada secret.

---

## VPC connector — para acceso a recursos privados

Cuando el servicio necesita conectarse a:
- Cloud SQL en VPC privada
- Memorystore (Redis)
- Otro servicio detrás de un balanceador interno

```bash
# Crear connector una vez (compartido entre servicios)
gcloud compute networks vpc-access connectors create epa-connector \
  --region=us-central1 \
  --network=default \
  --range=10.8.0.0/28

# Asignar al servicio
gcloud run deploy mi-servicio \
  --vpc-connector=epa-connector \
  --vpc-egress=private-ranges-only \
  ...
```

`vpc-egress`:
- `private-ranges-only` (default): solo tráfico privado pasa por VPC. Internet
  va directo (más eficiente).
- `all-traffic`: todo el egress pasa por VPC. Útil si hay firewalls de salida.

---

## Concurrency tuning

Concurrency = requests simultáneos por instancia.

```
Concurrency 80 (default)  →  APIs ligeras, IO-bound
Concurrency 40            →  APIs Python con cargas moderadas
Concurrency 10            →  Servicios CPU-bound o con caches por request
Concurrency 1             →  Jobs largos, ML inference síncrona
```

Con concurrency baja, Cloud Run escala más instancias bajo carga. Con concurrency
alta, mismo número de instancias procesa más. Calibrar después de medir.

---

## Timeouts

Default: 5 minutos. Máximo: 60 minutos.

```bash
--timeout=300s    # 5 min — default, suficiente para APIs
--timeout=900s    # 15 min — para jobs medianos
--timeout=3600s   # 60 min — para ETLs pesados (preferir Cloud Run jobs)
```

Para procesos >15 min, considerar **Cloud Run jobs** (no servicios) o
**Cloud Workflows**.

---

## Health checks

Cloud Run hace startup probes automáticamente. Para liveness explícito:

```yaml
# main.py o equivalente
@app.get("/health")
def health():
    # Verificar dependencias críticas
    return {"status": "ok"}

@app.get("/ready")
def readiness():
    # Verificar que el servicio puede procesar requests
    # (DB conexión, secret cargado, etc.)
    return {"status": "ready"}
```

Configurar startup probe en deploy:
```bash
--startup-cpu-boost   # Más CPU durante startup (reduce cold starts)
```

---

## Observabilidad

### Logging estructurado
```python
import logging
import json

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        if hasattr(record, "trace"):
            log_obj["logging.googleapis.com/trace"] = record.trace
        return json.dumps(log_obj)

# Cloud Run inyecta automáticamente trace y span en headers
```

Cloud Logging detecta JSON automáticamente y los indexa por campo.

### Métricas custom
```python
from google.cloud import monitoring_v3

client = monitoring_v3.MetricServiceClient()
# Ver Cloud Monitoring docs para definición de custom metrics
```

### Alertas
Configurar en Cloud Monitoring → Alerting:
- Error rate >1% durante 5 minutos
- Latency p95 >2s
- Memory usage >80%

---

## Cold starts — mitigación

Causas comunes y soluciones:

| Causa | Mitigación |
|---|---|
| Bibliotecas pesadas (TensorFlow, etc.) | Lazy load dentro del handler |
| Conexión a DB en startup | Pool con lazy init |
| Carga de modelo ML | Pre-cargar en `/ready` y mantener en memoria |
| Muchas dependencias en startup | `min-instances=1` con `--cpu-throttling` |

```bash
# Mantener una instancia siempre viva (cuesta ~$5/mes)
--min-instances=1
--cpu-throttling   # CPU solo durante requests; ahorra ~$3/mes vs no-throttling
```

---

## Rollouts graduales

Para servicios críticos, splitear tráfico:
```bash
# Deploy nueva versión sin tráfico
gcloud run deploy pitagoras-api \
  --no-traffic \
  --tag=canary \
  --image=...

# Mandar 10% a la nueva
gcloud run services update-traffic pitagoras-api \
  --to-tags=canary=10 \
  --region=us-central1

# Si todo bien, 100%
gcloud run services update-traffic pitagoras-api \
  --to-tags=canary=100 \
  --region=us-central1

# Limpiar tag
gcloud run services update-traffic pitagoras-api \
  --remove-tags=canary \
  --region=us-central1
```

---

## Costos — qué los dispara

```
1. min-instances > 0       →  cobra CPU/memoria 24/7
2. Concurrency baja        →  más instancias = más costo
3. Memoria alta            →  Cloud Run cobra por GB-segundo
4. CPU always-on (sin --cpu-throttling) →  cobra CPU full-time
5. Egress de red           →  $0.12/GB internacional, $0.01/GB intra-región
```

Estimación rápida:
```
512 MB · 1 CPU · 1M requests · 200ms avg duration · concurrency 80
≈ $5–10 USD/mes
```

Si un servicio supera $50 USD/mes, revisar concurrency, memoria y min-instances.

---

## Cloud Run Jobs (vs servicios)

Para procesos batch sin HTTP endpoint:
```bash
gcloud run jobs create coppel-etl-daily \
  --image=us-central1-docker.pkg.dev/epa-turing/epa-containers/coppel-etl:latest \
  --region=us-central1 \
  --service-account=coppel-etl-runtime@epa-turing.iam.gserviceaccount.com \
  --memory=2Gi \
  --cpu=2 \
  --max-retries=3 \
  --task-timeout=3600

# Ejecutar manualmente
gcloud run jobs execute coppel-etl-daily --region=us-central1

# Programar con Cloud Scheduler
gcloud scheduler jobs create http coppel-etl-schedule \
  --schedule="0 6 * * *" \
  --time-zone="America/Mexico_City" \
  --location=us-central1 \
  --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/epa-turing/jobs/coppel-etl-daily:run" \
  --http-method=POST \
  --oauth-service-account-email=scheduler-invoker@epa-turing.iam.gserviceaccount.com
```

---

## Checklist de servicio listo para producción

```
DEPLOY
[ ] Service account dedicado con permisos mínimos
[ ] Secrets vía --set-secrets, no --set-env-vars
[ ] min-instances justificado (0 por default)
[ ] Concurrency calibrada para el caso de uso
[ ] Timeout apropiado (no usar 60min default)

OBSERVABILIDAD
[ ] Endpoint /health responde 200 sin tocar dependencias
[ ] Endpoint /ready valida dependencias críticas
[ ] Logs estructurados (JSON)
[ ] Alerta de error rate y latency configurada en Cloud Monitoring

REDES
[ ] Si usa recursos privados, VPC connector configurado
[ ] vpc-egress correcto (private-ranges-only o all-traffic)

SEGURIDAD
[ ] No allow-unauthenticated si la API es interna
[ ] Headers de seguridad configurados (CORS, CSP si aplica)
[ ] No hay credenciales en variables planas

COSTO
[ ] Memoria justificada (no 8Gi por default)
[ ] cpu-throttling habilitado si min-instances >0
[ ] Costo mensual estimado en ticket o doc del servicio
```
