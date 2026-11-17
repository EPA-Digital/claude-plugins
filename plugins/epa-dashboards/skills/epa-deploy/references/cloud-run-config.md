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

## Recursos por contenedor

Un dashboard es un servicio con dos contenedores — los recursos se
configuran **por contenedor**, y el límite real de la instancia es la
**suma** de los dos (ver `epa-backend/references/sidecar.md` para el
comando de deploy completo):

| Contenedor | CPU | Memoria | Min instances | Max instances | Concurrency |
|---|---|---|---|---|---|
| `web` (Next.js, ingress) | 1 | 1Gi | 0 | 10 | 80 |
| `api` (Go, sidecar) | 1 | 512Mi | — (sigue la del servicio) | — | — |

`--min-instances`/`--max-instances`/concurrency son **service-level** (van
antes del primer `--container`) — se aplican a la instancia completa, no
por contenedor. `min-instances=0` por default (zero cost en idle). Solo
subir a 1+ cuando hay SLA de latencia y se acepta el costo fijo del
servicio completo (~$8-10/mes extra, más que un solo contenedor porque el
sidecar suma su propio vCPU/memoria).

---

## Autenticación

Todo dashboard: **IAP delante + lista `AccessUsers` en la API**. Patrón
completo en `epa-frontend/references/auth.md` (por qué y el lado web) y
`epa-backend/references/access-control.md` (verificación del JWT y lista).

### Interno (solo `@epa.digital`) — el default

```bash
gcloud run deploy {servicio} --no-allow-unauthenticated --iap ...
```

Todo lo demás lo hace `epa-deploy/scripts/setup-acceso.sh` (idempotente,
`--dry-run` para ver los comandos). Lo que corre, para referencia:

```bash
# Base de Firestore propia del dashboard (guarda AccessUsers)
gcloud firestore databases create --database={servicio} \
  --location=us-central1 --type=firestore-native --project=epa-turing

# La SA de runtime puede leer y escribir SOLO esa base
gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:{cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com" \
  --role="roles/datastore.user" \
  --condition='expression=resource.name == "projects/epa-turing/databases/{servicio}",title=solo-{servicio}'

# IAP: el agente de IAP invoca el servicio; solo domain:epa.digital pasa IAP
gcloud beta services identity create --service=iap.googleapis.com --project=epa-turing
gcloud run services update {servicio} --region=us-central1 --project=epa-turing --iap
gcloud run services add-iam-policy-binding {servicio} --region=us-central1 --project=epa-turing \
  --member="serviceAccount:service-689827400521@gcp-sa-iap.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
gcloud iap web add-iam-policy-binding --resource-type=cloud-run \
  --service={servicio} --region=us-central1 --project=epa-turing \
  --member="domain:epa.digital" --role="roles/iap.httpsResourceAccessor"

# + el primer admin: documento AccessUsers/{correo} con role=admin, status=active
```

`IAP_AUDIENCE` del contenedor `api` =
`/projects/689827400521/locations/us-central1/services/{servicio}`.

**Quién entra NO se maneja con IAM.** IAP deja pasar a todo `@epa.digital`;
la lista de cada dashboard decide. No agregar personas a
`iap.httpsResourceAccessor` ni a `run.invoker` una por una: serían dos listas
que se desincronizan.

### Externo (entra gente del cliente)

Escalar a `datos@epa.digital` **antes** de exponer el dashboard. Requiere IAP
con external identities + Identity Platform y una página de login propia
(precedente: `chedraui-dashboard`, `apps/login` y `docs/auth-iap.md`). La lista
`AccessUsers` y la API no cambian.

### Nunca

- `--allow-unauthenticated` o `allUsers` como invoker en el servicio del
  dashboard (caso Coppel: auditoría bloqueada).
- Contraseña compartida o login propio como sustituto de IAP.
- `gcloud run services proxy` como forma de "dar acceso": sirve para depurar
  con tu propia identidad, no para que alguien use el dashboard.

---

## Service account dedicado por dashboard — hogar único de estos grants

NO compartir el default compute service account entre dashboards de
distintos clientes. Cada dashboard tiene su propia identity con permisos
mínimos — esto es lo que hace posible aislar qué cliente puede leer qué
dataset.

**Una sola SA, compartida por los dos contenedores** (`web` y `api`) — no
hay SA separada por contenedor. Esto es deliberado (ver "por qué no hay
auth en el salto" en `epa-backend/references/sidecar.md`): el costo es que
`web` hereda permisos de BigQuery que no usa; el control compensatorio es
que `web` nunca declara un cliente de BigQuery en su código (ver
`epa-frontend` regla 5, verificado por `security-reviewer` §7).

Esta sección es la **única fuente** de los comandos de estos grants —
`epa-backend/references/sidecar.md` y `epa-deploy/SKILL.md` apuntan aquí,
no los repiten.

```bash
gcloud iam service-accounts create {cliente}-dashboard-runtime \
  --display-name="{Cliente} Dashboard Runtime (web + api)" \
  --project=epa-turing

# 1) Permiso para CORRER queries — sin este rol, la primera query del
#    contenedor api da 403 "bigquery.jobs.create" aunque dataViewer ya
#    esté otorgado. dataViewer por sí solo NO incluye este permiso.
gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:{cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# 2) Permiso para LEER el dataset de ese cliente — y solo ese dataset.
gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:{cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer" \
  --condition='expression=resource.name.startsWith("projects/bdd-epa-digital/datasets/{cliente}_reporting"),title={cliente}-reporting-only'

# Asignar al servicio — una sola bandera, se aplica a ambos contenedores.
gcloud run deploy {cliente}-dashboard-vibe \
  --service-account={cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com \
  ...
```

Los **dos** roles de BigQuery son necesarios — no es opcional otorgar solo
uno. `dataViewer` gobierna qué datos se pueden leer; `jobUser` gobierna si
se puede correr un job de query en absoluto. Faltando cualquiera de los
dos, el contenedor `api` no puede servir ni un solo request de datos reales.

---

## Variables de entorno y secrets

Estas banderas van **dentro de su `--container`** — cada contenedor tiene
su propio set. Usar siempre `--update-env-vars`, no `--set-env-vars`: en
cuanto el mismo contenedor tenga más de una bandera de env vars en su
historial de deploys (casi siempre el caso — `api` ya trae varias del
template de `sidecar.md`), `--set-env-vars` reemplaza el set completo en
vez de agregar, y una variable que ya estaba configurada desaparece sin
aviso.

### Variables planas (no sensibles)
```bash
--update-env-vars="EPA_LOG_LEVEL=info,EPA_GCP_PROJECT=epa-turing,EPA_REGION=us-central1"
```

### Secrets desde Secret Manager
```bash
--set-secrets="EPA_ADMIN_TOKEN=EpaAdminToken:latest"
```

Formato: `EPA_VAR_NAME=NombreSecret:version`. Usar `:latest` salvo cuando
se quiere pinear (raro). El service account del runtime necesita
`roles/secretmanager.secretAccessor` sobre cada secret.

---

## Multi-contenedor

Verificado contra `gcloud run deploy --help` (SDK 580.0.0), sección
*Container Flags*: *"The following flags apply to a single container. If
the `--container` flag is specified these flags may only be specified
after a `--container` flag."*

```
Service-level (ANTES del primer --container):
  --project --region --service-account --no-allow-unauthenticated --iap
  --min-instances --max-instances --labels --concurrency

Container-scoped (DESPUÉS de su --container):
  --image --port --memory --cpu --depends-on --startup-probe
  --liveness-probe --readiness-probe --args --workdir
  --set-env-vars / --update-env-vars / --set-secrets (por contenedor)
```

- `--depends-on=api` en el contenedor `web` ordena el arranque: Cloud Run
  arranca `api` primero y espera su startup probe antes de arrancar `web`
  — evita servir tráfico antes de que el backend esté listo.
- **El contenedor `api` nunca lleva `--port`.** Es lo único que lo
  mantiene sin ingress público — sin él, no hay URL externa que alcanzar,
  ni con IAM mal configurado. `PORT=8081` va como env var explícita porque
  sin `--port` Cloud Run tampoco la inyecta.
- El comando de deploy completo, con los dos `--container`, vive en
  `epa-backend/references/sidecar.md` — no se repite aquí.

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

Cada contenedor expone su propio health check, en rutas deliberadamente
distintas (convención de la plantilla de Eddy para `api` — no se cambia):

```typescript
// apps/web — app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "ok" })
}
```

```go
// apps/api — GET /health, ya en internal/infrastructure/api/routes.go
r.GET("/health", func(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
})
```

Solo `/api/health` de `web` es alcanzable desde fuera del servicio — `api`
no tiene ingress público, así que su `/health` solo lo consulta el startup
probe de Cloud Run (intra-instancia) y `web` vía `--depends-on`, nunca
nadie desde internet.

Configurar startup probe en deploy:
```bash
# web (opcional, para cold starts)
--startup-cpu-boost   # Más CPU durante startup (reduce cold starts)

# api (obligatorio — es lo que ordena el arranque con --depends-on)
--startup-probe=httpGet.path=/health,httpGet.port=8081
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
| Bundle grande de Next.js (`web`) | Verificar `output: 'standalone'`, revisar dependencias pesadas |
| Conexión a BigQuery en cada request (`api`) | Reusar el `*bigquery.Client` singleton entre requests — ver el patrón `sync.Once` en `epa-backend/references/bigquery-repository.md`, nunca recrearlo por request |
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
[ ] --no-allow-unauthenticated + --iap (ver § Autenticación)
[ ] setup-acceso.sh corrió (interno) o datos@epa.digital aprobó (externo)

OBSERVABILIDAD
[ ] Endpoint /api/health responde 200
[ ] Logs estructurados (JSON)
[ ] Alerta de error rate y latency configurada en Cloud Monitoring

SEGURIDAD
[ ] No hay credenciales en variables planas
[ ] run.invoker solo para el agente de IAP; nada de allUsers
[ ] Quién entra lo decide AccessUsers (no bindings de IAM por persona)
[ ] apps/api verifica el JWT de IAP (IAP_AUDIENCE de este servicio, hd)
[ ] Row filters de acceso a datos aplicados en el contenedor api (Go),
    antes de construir la query — no solo en la UI ni en el route handler
[ ] apps/web no declara ningún cliente de BigQuery propio

COSTO
[ ] Memoria justificada (1Gi por default para Next.js)
[ ] Queries a BigQuery con LIMIT y filtro de fecha
[ ] Costo mensual estimado documentado
```
