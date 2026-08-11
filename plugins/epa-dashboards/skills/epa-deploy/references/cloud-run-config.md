# Cloud Run — Configuraciones avanzadas para dashboards en epa-turing

Proyecto: `epa-turing` · Región default: `us-central1`. Este documento es
para casos que pasan del template básico de `SKILL.md` (memoria,
autenticación, concurrency, scaling).

> **Nota:** Los comandos de esta guía requieren `gcloud` CLI. Si no lo
> tienes instalado, descárgalo desde
> [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install).
> Si tienes dudas sobre alguna configuración, consultar al área de Datos e
> IA (`datos@epa.digital`).

---

## Recursos para un dashboard Next.js

| CPU | Memoria | Min instances | Max instances | Concurrency |
|---|---|---|---|---|
| 1 | 1Gi | 0 | 3 | 80 |

`min-instances=0` por default (zero cost en idle). Solo subir a 1+ cuando
hay SLA de latencia y se acepta el costo fijo (~$5/mes extra).

---

## Autenticación

### Privada (default para dashboards — ver `epa-deploy/SKILL.md`)

```bash
gcloud run deploy {servicio} \
  --no-allow-unauthenticated \
  ...

# Dar acceso a una persona o grupo específico
gcloud run services add-iam-policy-binding {servicio} \
  --member="user:persona@epa.digital" \
  --role="roles/run.invoker" \
  --region=us-central1

# O a un grupo (más escalable para un equipo de cliente)
gcloud run services add-iam-policy-binding {servicio} \
  --member="group:cliente-team@epa.digital" \
  --role="roles/run.invoker" \
  --region=us-central1
```

Acceso interno sin invocador dedicado: `gcloud run services proxy
{servicio} --project=epa-turing --region=us-central1` abre un túnel local
autenticado con tu propia identidad.

### Pública (solo con autorización explícita de Datos e IA)

Un dashboard **no** se despliega público por default — ver el porqué en
`SKILL.md`. Si el caso de uso genuinamente lo requiere (ej. reporte para
un cliente sin cuenta @epa.digital, mientras no exista IAP), confirmar con
`datos@epa.digital` antes de cambiar la bandera:
```bash
gcloud run deploy {servicio} --allow-unauthenticated ...
```

---

## Service account dedicado por dashboard

NO compartir el default compute service account entre dashboards de
distintos clientes. Cada dashboard tiene su propia identity con permisos
mínimos — esto es lo que hace posible aislar qué cliente puede leer qué
dataset.

```bash
gcloud iam service-accounts create {cliente}-dashboard-runtime \
  --display-name="{Cliente} Dashboard Runtime" \
  --project=epa-turing

# Permiso mínimo: leer el dataset de BigQuery de ese cliente
gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:{cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer" \
  --condition='expression=resource.name.startsWith("projects/bdd-epa-digital/datasets/{cliente}_reporting")'

# Asignar al servicio
gcloud run deploy {cliente}-dashboard-web-vibe \
  --service-account={cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com \
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
--set-secrets="EPA_ADMIN_TOKEN=EpaAdminToken:latest"
```

Formato: `EPA_VAR_NAME=NombreSecret:version`. Usar `:latest` salvo cuando
se quiere pinear (raro). El service account del runtime necesita
`roles/secretmanager.secretAccessor` sobre cada secret.

---

## Concurrency tuning

Concurrency = requests simultáneos por instancia.

```
Concurrency 80 (default)  →  suficiente para un dashboard normal, IO-bound
Concurrency 10-40         →  si hay agregaciones pesadas por request
```

Con concurrency baja, Cloud Run escala más instancias bajo carga. Calibrar
después de medir, no antes.

---

## Timeouts

Default: 5 minutos. Máximo: 60 minutos.

```bash
--timeout=300s    # 5 min — default, suficiente para un dashboard
```

Si una query de BigQuery tarda más que esto, el problema es la query (ver
`epa-bq` — filtros de fecha, `LIMIT`), no el timeout.

---

## Health checks

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "ok" })
}
```

Configurar startup probe en deploy:
```bash
--startup-cpu-boost   # Más CPU durante startup (reduce cold starts)
```

---

## Observabilidad — logging estructurado

```typescript
// lib/logger.ts
export function logStructured(severity: "INFO" | "ERROR" | "WARNING", message: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ severity, message, ...extra }))
}
```

Cloud Logging detecta JSON automáticamente y lo indexa por campo. Cloud
Run inyecta trace/span en headers automáticamente — no hace falta
propagarlos a mano.

Configurar alertas en Cloud Monitoring → Alerting:
- Error rate >1% durante 5 minutos
- Latency p95 >2s
- Memory usage >80%

---

## Cold starts — mitigación

| Causa | Mitigación |
|---|---|
| Bundle grande de Next.js | Verificar `output: 'standalone'`, revisar dependencias pesadas |
| Conexión a BigQuery en cada request | Reusar el cliente de `@google-cloud/bigquery` entre requests (no recrearlo) |
| Muchas dependencias en startup | `min-instances=1` con `--cpu-throttling` si el SLA lo justifica |

```bash
# Mantener una instancia siempre viva (cuesta ~$5/mes)
--min-instances=1
--cpu-throttling   # CPU solo durante requests; ahorra vs no-throttling
```

---

## Rollouts graduales

Para un dashboard con muchos usuarios activos, splitear tráfico en vez de
un corte directo:
```bash
gcloud run deploy {servicio} --no-traffic --tag=canary --image=...

gcloud run services update-traffic {servicio} --to-tags=canary=10 --region=us-central1
# si todo bien:
gcloud run services update-traffic {servicio} --to-tags=canary=100 --region=us-central1
gcloud run services update-traffic {servicio} --remove-tags=canary --region=us-central1
```

---

## Costos — qué los dispara

```
1. min-instances > 0       →  cobra CPU/memoria 24/7
2. Concurrency baja        →  más instancias = más costo
3. Queries a BigQuery sin LIMIT/filtro de fecha → esto suele costar más
   que Cloud Run mismo
4. Egress de red           →  $0.12/GB internacional, $0.01/GB intra-región
```

Si un dashboard supera $50 USD/mes, revisar primero las queries a BigQuery
antes que la config de Cloud Run.

---

## Checklist de dashboard listo para producción

```
DEPLOY
[ ] Service account dedicado por cliente, con permiso solo sobre su dataset
[ ] Secrets vía --set-secrets, no --set-env-vars
[ ] min-instances=0 salvo SLA justificado
[ ] --no-allow-unauthenticated (ver auth.md para el porqué)

OBSERVABILIDAD
[ ] Endpoint /api/health responde 200
[ ] Logs estructurados (JSON)
[ ] Alerta de error rate y latency configurada en Cloud Monitoring

SEGURIDAD
[ ] No hay credenciales en variables planas
[ ] roles/run.invoker otorgado solo a quien debe ver este dashboard
[ ] Row filters de acceso a datos aplicados en el servidor, no solo en UI

COSTO
[ ] Memoria justificada (1Gi por default para Next.js)
[ ] Queries a BigQuery con LIMIT y filtro de fecha
[ ] Costo mensual estimado documentado
```
