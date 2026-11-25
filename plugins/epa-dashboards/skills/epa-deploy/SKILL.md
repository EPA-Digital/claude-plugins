---
name: epa-deploy
description: >
  Deploy de dashboards EPA a producción. Activar cuando el usuario quiera
  desplegar su dashboard, configurar deploys automáticos, entender cómo
  funciona el flujo de deploy, o preguntar cómo "subir" su app a la nube.
  También activar ante términos como "deploy", "producción", "Cloud Run",
  "GitHub Actions", "pipeline", "automatizar el deploy", o "cómo publico
  esto". Proporciona templates listos para usar y una guía paso a paso
  diseñada para usuarios sin experiencia en DevOps.
---

# EPA Deploy — Llevar tu dashboard a producción

Stack: **GitHub Actions + Cloud Run** en **epa-turing**
Región: **us-central1**
Audiencia: usuarios con poca o ninguna experiencia en DevOps

---

## Regla 0 — Nombres

```
Servicio de Cloud Run:   {cliente}-dashboard-vibe
                         UN servicio con DOS contenedores (web + api) —
                         no un servicio por contenedor. Siempre kebab-case,
                         siempre termina en -vibe, sí también en producción
                         (ver epa-safe-vibe B7).
Repo de GitHub:          {cliente}-dashboard   (monorepo: apps/web + apps/api)
Imágenes en Artifact
Registry:                .../epa-containers/{cliente}-dashboard/web
                         .../epa-containers/{cliente}-dashboard/api
Service account runtime: {cliente}-dashboard-runtime@epa-turing.iam...
                         UNA sola, compartida por los dos contenedores.
Ramas:                   main / dev / feature/EPA-{ticket}-{slug}
Variables de entorno:    EPA_* (servidor, ambos contenedores) ·
                         NEXT_PUBLIC_* (navegador, solo web)
```

> Servicios ya desplegados como `{cliente}-dashboard-web-vibe` (de antes de
> este cambio) **conservan su nombre** — renombrar un servicio de Cloud Run
> le cambia la URL. El infijo `-web` se retira solo en dashboards nuevos.

Prohibido: nombres genéricos (`dashboard`, `epa-dashboard` — es la cadena
del incidente Newton), nombres personales, versión en el nombre
(`-v2`), mezclar convenciones, **un segundo servicio de Cloud Run para el
backend Go** (ver epa-safe-vibe B5/B6 — el backend es un sidecar del mismo
servicio, no un servicio aparte). Si tienes duda de cómo nombrar algo,
escribe a datos@epa.digital antes de crear el recurso.

---

## Concepto en 30 segundos

```
Tu código en GitHub (un repo: apps/web + apps/api)
       ↓
   Haces push a main
       ↓
GitHub Actions se activa automáticamente
       ↓
pnpm typecheck && pnpm lint && pnpm build         (apps/web)
go build ./... && go test ./... && golangci-lint run  (apps/api)
       ↓                              ← si algo falla, no pasa de aquí
Construye DOS imágenes Docker (web, api) con el mismo $SHA
       ↓
Sube las dos imágenes a Google Artifact Registry
       ↓
UN gcloud run deploy con --container=web --container=api
       ↓
Tu dashboard está vivo en una URL de Cloud Run — un servicio, dos contenedores
```

Después del setup inicial, desplegar es solo hacer `git push`.

**Orden de banderas de `gcloud run deploy` con multi-contenedor** (verificado
contra `gcloud run deploy --help`, sección *Container Flags*, SDK 580.0.0):
*"The following flags apply to a single container. If the `--container`
flag is specified these flags may only be specified after a `--container`
flag."* — es decir: `--project`, `--region`, `--service-account`,
`--no-allow-unauthenticated`, `--iap`, `--min-instances`, `--max-instances` van
**antes** del primer `--container`; `--image`, `--port`, `--memory`,
`--cpu`, `--depends-on`, `--startup-probe`, `--update-env-vars` van
**después** del `--container` al que pertenecen. El comando completo, con
el detalle de por qué el contenedor `api` nunca lleva `--port`, vive en
`epa-backend/references/sidecar.md` — no se repite aquí.

---

## Prerequisitos — hacer una sola vez

### 0. ¿Tienes gcloud CLI instalado?

Los siguientes pasos tienen **tres rutas**. Elige la que mejor se adapte:

| | Quién | Qué necesitas |
|---|---|---|
| **Opción A — Consola GCP** | Cualquier persona con acceso al proyecto epa-turing en el navegador | Solo una cuenta GCP |
| **Opción B — gcloud CLI** | Usuarios técnicos que prefieren terminal | Instalar gcloud (descarga en [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) — `.pkg` para Mac, `.exe` para Windows, sin terminal) |
| **Opción C — Datos e IA lo hace por ti** | Usuarios sin acceso a GCP o sin tiempo para el setup | Nada — solo envía un correo |

> **Opción C (más rápida):** Escribe a `datos@epa.digital` con el asunto "Setup CI/CD para [nombre-de-tu-dashboard]". El área de Datos e IA crea la service account, la registra en Artifact Registry y te manda el valor del `GCP_SA_KEY`. Tú solo agregas ese secret en tu repo de GitHub y pones el workflow. Pasa al paso del workflow directamente.

---

### 1. Configurar autenticación de GitHub → GCP

**Opción B (gcloud):** crear la Service Account desde terminal:

```bash
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer" \
  --project=epa-turing

# Permisos necesarios
gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:github-actions-deployer@epa-turing.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:github-actions-deployer@epa-turing.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:github-actions-deployer@epa-turing.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# --- SA de RUNTIME, distinta de la de deploy ---------------------------
# github-actions-deployer es quien DESPLIEGA. El servicio, en tiempo de
# ejecución, corre con {cliente}-dashboard-runtime — la misma SA para los
# dos contenedores (web + api). Solo esta SA necesita permisos de BigQuery
# y necesita LOS DOS roles: dataViewer solo no incluye bigquery.jobs.create,
# y la primera query del contenedor api da 403 sin jobUser también. Comandos
# exactos y el porqué en epa-deploy/references/cloud-run-config.md — única
# fuente, no se repiten en otro archivo.
gcloud iam service-accounts create {cliente}-dashboard-runtime \
  --display-name="{cliente} dashboard — runtime (web + api)" \
  --project=epa-turing
```

> **Opción A (Consola GCP):**
> 1. Ve a [console.cloud.google.com](https://console.cloud.google.com) → proyecto `epa-turing`
> 2. Menú → **IAM & Admin → Service Accounts** → **+ Crear cuenta de servicio**
> 3. Nombre: `github-actions-deployer` → **Crear y continuar**
> 4. Agrega los tres roles uno a uno: **Cloud Run Admin**, **Artifact Registry Writer**, **Service Account User** → **Listo**

### 2. Crear el JSON de credenciales y subirlo a GitHub

**Opción B (gcloud):**
```bash
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions-deployer@epa-turing.iam.gserviceaccount.com

# ⚠️ IMPORTANTE: Este archivo es una credencial.
# NO commitearlo al repo. Borrarlo después de subirlo a GitHub.
```

> **Opción A (Consola GCP):**
> 1. **IAM & Admin → Service Accounts** → click en `github-actions-deployer`
> 2. Pestaña **Keys** → **Agregar clave → Crear nueva clave → JSON** → se descarga el archivo automáticamente
> 3. ⚠️ Ese archivo es la credencial — no lo compartas ni lo subas al repo

En GitHub → tu repo → **Settings → Secrets and variables → Actions → New repository secret**:
- Nombre: `GCP_SA_KEY`
- Valor: contenido completo del archivo JSON descargado (ábrelo con cualquier editor de texto, copia todo)

Luego borra el archivo del disco (no lo dejes ahí):
```bash
rm github-actions-key.json
```

### 3. Crear el repositorio en Artifact Registry

**Opción B (gcloud):**
```bash
gcloud artifacts repositories create epa-containers \
  --repository-format=docker \
  --location=us-central1 \
  --project=epa-turing \
  --description="Contenedores Docker de dashboards EPA"
```

> **Opción A (Consola GCP):**
> 1. Menú → **Artifact Registry** → **+ Crear repositorio**
> 2. Nombre: `epa-containers`, Formato: **Docker**, Región: `us-central1` → **Crear**

> ℹ️ Si `epa-containers` ya existe en el proyecto (alguien del equipo lo creó antes), omitir este paso.

### 4. Acceso: IAP + `ACCESS_MODE` (obligatorio)

Ningún dashboard sale sin esto, ni siquiera uno interno: IAP deja pasar solo
cuentas `@epa.digital`, y `apps/api` autoriza según `ACCESS_MODE`. Política de
EPA (nov 2026): **nada interno está cerrado a menos que se declare.** El
estándar es `interno` (todo EPA entra con lectura; la lista `AccessUsers` solo
da admins y bloqueos); `restringido` es una excepción con motivo y dueño. El
código (verificar el JWT en `apps/api`, la puerta en `apps/web`) está en
`epa-frontend/references/auth.md` y `epa-backend/references/access-control.md`.

La API declara también **`ACCESS_STORE`**: `none` (sin Firestore: todo EPA entra
con lectura, no hay admins ni bloqueos) o `firestore` (admins, bloqueos y, en
`restringido`, la puerta). **Un dashboard `interno` nuevo usa `none`: no pide
nada a nadie.** Firestore requiere permisos de IAM que un Editor no tiene.

Revisa el `AGENTS.md` del dashboard (lo escribe `/plan-dashboard`):

- **`Acceso: interno`** (el caso normal, sin admins ni bloqueos) → corre el
  script **antes** del primer deploy y otra vez **después**. Solo activa IAP;
  **un Editor lo corre solo, sin pedir nada**:
  ```bash
  bash ${CLAUDE_PLUGIN_ROOT}/skills/epa-deploy/scripts/setup-acceso.sh \
    --service {cliente}-dashboard-vibe \
    --acceso interno
  ```
  Con el servicio ya desplegado (segunda corrida) activa IAP; los bindings de
  IAP por servicio solo se crean si no existen ya a nivel proyecto (en
  `epa-turing` ya existen). Usa `--dry-run` para ver los comandos sin
  ejecutarlos. Al final imprime las variables del contenedor `api`
  (`ACCESS_MODE`, `ACCESS_STORE`, `IAP_AUDIENCE`, etc.): las dos primeras son
  obligatorias y sin ellas la API no arranca.
- **`Acceso: interno` con admins o bloqueos**, o **`Acceso: restringido`**
  (necesitan `ACCESS_STORE=firestore`) → además crea la base de Firestore del
  dashboard, el permiso de la SA de runtime solo sobre esa base y el primer
  admin. Esos pasos **requieren permisos de IAM que un Editor no tiene**:
  pídeselos a Datos e IA (ver `references/cloud-run-config.md`):
  ```bash
  bash ${CLAUDE_PLUGIN_ROOT}/skills/epa-deploy/scripts/setup-acceso.sh \
    --service {cliente}-dashboard-vibe \
    --acceso interno \
    --store firestore \
    --admin tu-correo@epa.digital \
    --runtime-sa {cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com
  ```
  Para `restringido` es igual con `--acceso restringido` (ahí `--store
  firestore` ya es el valor por defecto y `none` se rechaza).
- **`Acceso: restringido`** además exige, en el `AGENTS.md`, el **motivo** y el
  **dueño** (ver `references/cloud-run-config.md` § Restringido).
- **`Acceso: externo`** (entra gente del cliente) → **no** uses el script:
  escala a `datos@epa.digital`. Requiere Identity Platform y página de login
  (precedente: `chedraui-dashboard`).

> ⚠️ **Orden:** IAP nunca se enciende sobre una revisión que no aplica la
> política. Por eso el script solo activa IAP cuando el servicio ya existe, y
> el template de abajo despliega con `--iap` el mismo código que verifica.

---

## Template de GitHub Actions — deploy a Cloud Run (dos contenedores)

Crear el archivo en tu repo: `.github/workflows/deploy.yml`. Un solo
workflow para todo el monorepo: construye `apps/web` y `apps/api`, y hace
**un** `gcloud run deploy` con los dos `--container`.

```yaml
name: Deploy a Cloud Run

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  PROJECT_ID: epa-turing
  REGION: us-central1
  REGISTRY: us-central1-docker.pkg.dev
  REPOSITORY: epa-containers
  # ⚠️ Cambiar al nombre real, kebab-case, SIEMPRE terminado en -vibe (ver Regla 0)
  SERVICE_NAME: cliente-dashboard-vibe
  IMAGE_WEB: cliente-dashboard-web
  IMAGE_API: cliente-dashboard-api
  RUNTIME_SA: cliente-dashboard-runtime@epa-turing.iam.gserviceaccount.com

jobs:
  deploy:
    name: Build y Deploy
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout del código
        uses: actions/checkout@v4

      # --- apps/web: gate de calidad + imagen -----------------------------
      - name: Instalar pnpm
        uses: pnpm/action-setup@v4

      - name: Instalar Node 22 LTS
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: apps/web/pnpm-lock.yaml

      - name: Instalar dependencias (apps/web)
        working-directory: apps/web
        run: pnpm install --frozen-lockfile

      # Gate de calidad — si algo falla aquí, no se construye ni despliega nada
      - name: Typecheck, lint y build (apps/web)
        working-directory: apps/web
        run: pnpm typecheck && pnpm lint && pnpm build

      # --- apps/api: gate de calidad -----------------------------------------
      - name: Instalar Go
        uses: actions/setup-go@v5
        with:
          go-version-file: apps/api/go.mod
          cache-dependency-path: apps/api/go.sum

      - name: Build, test y lint (apps/api)
        working-directory: apps/api
        run: go build ./... && go test ./... && golangci-lint run

      - name: Autenticar en GCP
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configurar Docker para Artifact Registry
        run: |
          gcloud auth configure-docker ${{ env.REGISTRY }} --quiet

      - name: Build y push — imagen de apps/web
        working-directory: apps/web
        run: |
          docker build \
            -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_WEB }}:${{ github.sha }} \
            .
          docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_WEB }}:${{ github.sha }}

      - name: Build y push — imagen de apps/api
        working-directory: apps/api
        run: |
          docker build \
            -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_API }}:${{ github.sha }} \
            .
          docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_API }}:${{ github.sha }}

      # Guard SIEMPRE activo (no depende de un toggle manual que alguien
      # olvide apagar — ver epa-safe-vibe B7 / incidente Newton). Si el
      # servicio ya existe pero su label epa-managed-by no es este repo,
      # un deploy lo SOBREESCRIBIRÍA — abortar.
      - name: Guard — el servicio, si existe, es de este dashboard
        run: |
          existing_label=$(gcloud run services describe ${{ env.SERVICE_NAME }} \
            --region=${{ env.REGION }} --project=${{ env.PROJECT_ID }} \
            --format='value(metadata.labels.epa-managed-by)' 2>/dev/null || true)
          if [ -n "$existing_label" ] && [ "$existing_label" != "${{ env.SERVICE_NAME }}" ]; then
            echo "🔴 El servicio '${{ env.SERVICE_NAME }}' existe con label"
            echo "   epa-managed-by='$existing_label' — no es este repo."
            echo "   Un deploy lo SOBREESCRIBIRÍA (ver epa-safe-vibe B7)."
            exit 1
          fi

      - name: Deploy a Cloud Run (web + api)
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --region=${{ env.REGION }} \
            --project=${{ env.PROJECT_ID }} \
            --platform=managed \
            --no-allow-unauthenticated \
            --iap \
            --service-account=${{ env.RUNTIME_SA }} \
            --min-instances=0 \
            --max-instances=10 \
            --labels=epa-managed-by=${{ env.SERVICE_NAME }} \
            --container=web \
              --image=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_WEB }}:${{ github.sha }} \
              --port=8080 --cpu=1 --memory=1Gi \
              --depends-on=api \
              --update-env-vars=EPA_API_BASE_URL=http://localhost:8081 \
            --container=api \
              --image=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_API }}:${{ github.sha }} \
              --cpu=1 --memory=512Mi \
              --startup-probe=httpGet.path=/health,httpGet.port=8081 \
              --update-env-vars=PORT=8081,BQ_BILLING_PROJECT=epa-turing,BQ_DATA_PROJECT=bdd-epa-digital,BQ_DATASET={cliente}_reporting,BQ_MAX_BYTES_BILLED=104857600 \
              --update-env-vars=AUTH_MODE=iap,ACCESS_MODE=interno,ACCESS_STORE=none,IAP_AUDIENCE=/projects/689827400521/locations/us-central1/services/${{ env.SERVICE_NAME }},AUTH_ALLOWED_DOMAINS=epa.digital
              # ⚠️ ACCESS_MODE debe decir lo mismo que `Acceso:` en el AGENTS.md
              # (interno | restringido). Sin ella la API no arranca.
              # ACCESS_STORE=none = sin Firestore (el default de un dashboard interno).
              # Con admins o bloqueos, o con `restringido`: ACCESS_STORE=firestore y agrega
              # FIRESTORE_PROJECT_ID=epa-turing,FIRESTORE_DATABASE_ID=${{ env.SERVICE_NAME }}

      - name: Mostrar URL del servicio
        run: |
          gcloud run services describe ${{ env.SERVICE_NAME }} \
            --region=${{ env.REGION }} \
            --project=${{ env.PROJECT_ID }} \
            --format='value(status.url)'
```

> ⚠️ **Recordatorios de este template, resueltos ya en el YAML de arriba
> pero fáciles de romper si se edita a mano:**
> - Toda bandera de un contenedor va **después** de su `--container` — ver
>   "Concepto en 30 segundos" arriba y `epa-backend/references/sidecar.md`.
> - `--service-account` es **service-level** — va antes del primer
>   `--container`, y es la SA de *runtime* (`{cliente}-dashboard-runtime`),
>   no la de deploy (`github-actions-deployer`). Confundir las dos es el
>   bug que hacía que el grant de BigQuery apuntara a una SA que el
>   servicio nunca usaba.
> - `--update-env-vars`, nunca `--set-env-vars`, en cualquier `--container`
>   que ya tenga otras env vars/secretos — `--set-env-vars` reemplaza el
>   set completo en vez de agregar.
> - El contenedor `api` **nunca** lleva `--port`.

> ⚠️ **Por qué `--no-allow-unauthenticated` + `--iap`:** un dashboard
> muestra datos reales de un cliente. `--no-allow-unauthenticated` deja el
> servicio fuera de internet; `--iap` pone el login de Google delante (solo
> `@epa.digital` en internos), y `apps/api` verifica ese login y lo compara
> contra `AccessUsers`. Nunca `--allow-unauthenticated` ni `allUsers` como
> invoker: es exactamente lo que dejó a Coppel bloqueado en su auditoría
> (contraseña compartida + servicio público). Si el cliente necesita entrar,
> el camino es `Acceso: externo` vía `datos@epa.digital`, no abrir el
> servicio. El contenedor `api` va un paso más allá: no tiene `--port`, así
> que no recibe tráfico de fuera aunque alguien cambie estas banderas.

---

## Template con variables de entorno desde Secret Manager

Si tu dashboard necesita credenciales (poco común — la mayoría de los
datos vienen de BigQuery vía ADC, no de secrets), `--set-secrets` es
**container-scoped**: va dentro del bloque `--container` del contenedor que
realmente necesita el secreto — casi siempre `api`, casi nunca `web`. Las
variables se inyectan directamente desde Secret Manager en el deploy — el
código nunca las ve como texto plano en el repo.

```yaml
            --container=api \
              --image=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_API }}:${{ github.sha }} \
              --cpu=1 --memory=512Mi \
              --update-env-vars=PORT=8081,BQ_BILLING_PROJECT=epa-turing,... \
              --set-secrets="EPA_ADMIN_TOKEN=EpaAdminToken:latest"
```

El formato de `--set-secrets` es:
```
EPA_{NOMBRE_VAR}={NombreSecret}:latest
```

Cómo se crea el secreto, quién lo pide y cómo rotarlo:
`epa-safe-vibe/references/secrets.md`.

Si el contenedor ya tiene `--update-env-vars` en el mismo `--container`
(como en el template de arriba), agregar `--set-secrets` en la misma línea
no lo pisa — son grupos de banderas independientes. Lo que sí hay que
evitar es mezclar `--set-env-vars` (reemplaza el set completo) con
cualquiera de los dos.

---

## Estructura de ramas recomendada

```
main        →  producción — cada push dispara deploy automático
dev         →  staging — para probar antes de subir a main
feature/*   →  desarrollo de nuevas funcionalidades

Flujo:
feature/EPA-42-nueva-funcionalidad
       ↓ Pull Request
      dev   (staging, revisión)
       ↓ Pull Request aprobado
      main  (producción, deploy automático)
```

Para activar deploy en `dev` también (staging), duplicar el workflow con
`branches: [dev]` y un `SERVICE_NAME` distinto (ej:
`cliente-dashboard-stg-vibe`).

> ⚠️ La plantilla de Eddy (`epa-standards-backend`) usa `staging` como rama
> base para sus propios repos standalone (espejo de `admin-tool-api`, ya en
> producción en la agencia). Esa convención es de sus repos, **no** del
> monorepo del dashboard — aquí `apps/api` sigue las ramas de arriba (`main`
> / `dev` / `feature/*`), igual que `apps/web`. No homologar a `staging`
> por reflejo solo porque la plantilla forkeada la trae así (ver
> `epa-backend/references/fork-checklist.md`, paso 7).

---

## QA local antes de hacer push a main

Antes de hacer push a `main` — que dispara el deploy real — verifica que
los **dos** contenedores arrancan y responden localmente. Con sidecar, dev
local es topológicamente idéntico a producción (detalle completo en
`epa-backend/references/sidecar.md`):

```bash
# terminal 1 — apps/api en :8081
cd apps/api && go run ./cmd/api

# terminal 2 — apps/web en :3000, apuntando al api local
cd apps/web && EPA_API_BASE_URL=http://localhost:8081 pnpm dev
```

Abre `localhost:3000` en el navegador y verifica que la UI carga sin
errores de consola, y que los charts que dependen de datos reales
responden (confirma que el `fetch` de `apps/web` a `apps/api` funciona).
`pnpm dev` corre en el puerto `:3000`; en Cloud Run el contenedor `web`
escucha en `:8080` — no es una inconsistencia, son entornos distintos
(Next.js standalone respeta la variable `PORT` que Cloud Run le inyecta).

### Si tu dashboard necesita variables de entorno

```bash
cp .env.example .env.local   # editar con valores de prueba
```

> ⚠️ `.env.local` y `.env` deben estar en `.gitignore`. Nunca commitear
> credenciales, aunque sean de prueba.

---

## Checklist antes del primer deploy

```
AMBOS CONTENEDORES
[ ] El repo está en GitHub, bajo la org EPA-Digital, con apps/web + apps/api
[ ] El secret GCP_SA_KEY está configurado en el repo
[ ] El archivo .github/workflows/deploy.yml existe, con UN gcloud run
    deploy y dos --container (no dos servicios separados)
[ ] SERVICE_NAME sigue la Regla 0 (kebab-case, sufijo -vibe, sin infijo -web)
[ ] El proyecto epa-turing está seleccionado (no otro proyecto)
[ ] Nunca desplegar en bdd-epa-digital ni ga360-250517
[ ] La SA de runtime ({cliente}-dashboard-runtime) tiene
    roles/bigquery.jobUser Y roles/bigquery.dataViewer — los dos, no solo
    uno (ver epa-deploy/references/cloud-run-config.md)
[ ] No hay credenciales en el código ni en ningún Dockerfile
[ ] El .gitignore incluye .env*, *.key, *.json de service accounts
[ ] El archivo github-actions-key.json fue borrado después de subirlo a GitHub
[ ] El deploy usa --no-allow-unauthenticated Y --iap (ver nota de auth arriba)
[ ] AGENTS.md dice `Acceso: interno`, `restringido` o `externo`, y coincide con
    lo desplegado (restringido → motivo y dueño; externo → aprobado por
    datos@epa.digital)
[ ] setup-acceso.sh corrió (interno o restringido): base de Firestore
    {servicio}, datastore.user acotado, primer admin, IAP activado
[ ] El contenedor api tiene AUTH_MODE=iap, ACCESS_MODE igual al AGENTS.md,
    ACCESS_STORE (none, o firestore con su base y su binding),
    IAP_AUDIENCE de ESTE servicio y AUTH_ALLOWED_DOMAINS — nunca
    AUTH_MODE=local
[ ] Probé con una cuenta @epa.digital que NO está en AccessUsers:
    · interno → entra en solo lectura y /api/v1/admin/* responde 403
    · restringido → ve "No tienes acceso" y /api/v1/* responde 403
[ ] Corrí `pnpm dev` (apps/web) + `go run ./cmd/api` (apps/api) juntos en
    local y el dashboard carga datos reales

SOLO WEB
[ ] pnpm typecheck && pnpm lint && pnpm build pasan localmente
[ ] apps/web tiene un Dockerfile válido (ver references/dockerfile-nextjs.md)
[ ] El contenedor web tiene un endpoint GET /api/health que responde 200
[ ] apps/web NO declara ningún cliente de BigQuery (@google-cloud/bigquery
    o similar) — es el único control que compensa la SA compartida
[ ] EPA_API_BASE_URL nunca es NEXT_PUBLIC_*

SOLO API
[ ] go build ./... && go test ./... && golangci-lint run pasan localmente
[ ] apps/api tiene un endpoint GET /health que responde 200
[ ] El contenedor api NO tiene --port en el comando de deploy
[ ] Toda query declara MaxBytesBilled (ver epa-backend/references/bigquery-repository.md)
[ ] El middleware de bearer estático de la plantilla de Eddy fue borrado
    (ver epa-backend/references/fork-checklist.md, paso 3)
```

---

## Troubleshooting común

### Error: "Permission denied" en el deploy
```
Causa:  La service account no tiene el role roles/run.admin
Fix:    Agregar el permiso desde GCP IAM, o pedirle al área de Datos e IA
```

### Error: "Image not found" en Cloud Run
```
Causa:  El nombre de la imagen en el deploy no coincide con el del push
Fix:    Verificar que SERVICE_NAME, REGISTRY, PROJECT_ID, y REPOSITORY
        son idénticos en los pasos de push y deploy
```

### El deploy termina exitoso pero el dashboard no responde
```
Causa:  El contenedor no levanta en el puerto 8080
Fix:    1. Verificar que el Dockerfile tiene EXPOSE 8080
        2. Verificar que Next.js corre en modo standalone y respeta PORT
        3. Revisar los logs en Cloud Run: Consola GCP → Cloud Run → tu servicio → Logs
```

### Google dice "You don't have access" (403 de IAP)
```
Causa:  Tu cuenta no es @epa.digital, o setup-acceso.sh no ha corrido la
        segunda vez (la que da roles/iap.httpsResourceAccessor)
Fix:    Entrar con tu cuenta @epa.digital; si ya lo es, volver a correr
        setup-acceso.sh con el servicio ya desplegado
```

### El dashboard muestra "No tienes acceso a este dashboard"
```
Causa:  IAP te dejó pasar, pero no estás en AccessUsers (o estás disabled).
        Es el comportamiento correcto para quien no fue dado de alta.
Fix:    Un admin te da de alta en /admin/accesos (o en la consola de
        Firestore: base {servicio} → AccessUsers → documento = tu correo)
```

### Nadie entra, ni el admin ("No pudimos verificar tu sesión")
```
Causa:  La API no puede validar el JWT: IAP_AUDIENCE no es el de este
        servicio, AUTH_ALLOWED_DOMAINS no incluye tu dominio, o el
        servicio se está abriendo por la URL sin pasar por IAP
Fix:    IAP_AUDIENCE = /projects/689827400521/locations/us-central1/services/{servicio}
        (lo imprime setup-acceso.sh). Logs del contenedor api.
```

### El contenedor api no arranca: "config: AUTH_MODE=..."
```
Causa:  Configuración de acceso inválida — la API falla cerrado a propósito
        (sin IAP_AUDIENCE; sin ACCESS_MODE o con un valor que no es
        'interno' | 'restringido'; sin ACCESS_STORE o con un valor que no
        es 'firestore' | 'none'; ACCESS_STORE=none con
        ACCESS_MODE=restringido; ACCESS_MODE=interno con
        AUTH_ALLOWED_DOMAINS distinto de epa.digital; o AUTH_MODE=local en
        Cloud Run)
Fix:    Corregir las variables del contenedor api (ACCESS_MODE igual al
        AGENTS.md; ACCESS_STORE=none solo con interno); nunca AUTH_MODE=local
```

### Error: "Quota exceeded"
```
Causa:  Se alcanzó el límite de instancias o CPU en epa-turing
Fix:    Notificar al área de Datos e IA — puede ser necesario ajustar quotas o costos
```

### 403 en la primera query del contenedor `api`: "Access Denied: bigquery.jobs.create"
```
Causa:  La SA de runtime tiene roles/bigquery.dataViewer pero no
        roles/bigquery.jobUser. dataViewer solo no incluye permiso para
        CORRER queries, solo para leer datos.
Fix:    Agregar roles/bigquery.jobUser sobre epa-turing a la SA de runtime
        — ver epa-deploy/references/cloud-run-config.md
```

### `web` recibe 502 / `ECONNREFUSED` al hacer fetch a `EPA_API_BASE_URL`
```
Causa:  Casi siempre PORT mal configurado en el contenedor api, falta
        --depends-on=api en el contenedor web, o el startup probe de api
        está fallando.
Fix:    Ver el troubleshooting completo en
        epa-backend/references/sidecar.md — y NUNCA agregar --port al
        contenedor api "para que responda": eso le da ingress público.
```

### "Container failed to start" pero no queda claro cuál de los dos
```
Causa:  Con dos contenedores hay dos fuentes de log en el mismo servicio.
Fix:    Filtrar por labels."run.googleapis.com/container_name" en Cloud
        Logging (o en la consola, columna "Contenedor") antes de
        diagnosticar — si no se filtra, los logs de web y api se mezclan.
```

### Ver logs en tiempo real
```bash
gcloud run services logs tail {nombre-servicio} \
  --region=us-central1 \
  --project=epa-turing
```

> **Sin gcloud:** Consola GCP → **Cloud Run** → selecciona tu servicio → pestaña **Logs**

---

## Costos aproximados en epa-turing

Cloud Run cobra solo cuando el servicio está procesando requests.
Con `--min-instances=0` (la configuración del template), el costo es cero
cuando no hay tráfico.

```
Estimado mensual para un dashboard de uso moderado (los dos contenedores
comparten instancia, así que el vCPU/memoria de cada uno se suma dentro de
la misma instancia activa — no son dos servicios facturando por separado):
- 0 instancias en idle:                    $0
- 1M requests/mes (web 1 vCPU/1Gi
  + api 1 vCPU/512Mi):                     ~$14–24 USD
- Artifact Registry storage (2 imágenes):  ~$2–4 USD/mes

Total típico por dashboard:  $16–30 USD/mes
```

Es un poco más que el estimado de un solo contenedor (el sidecar suma su
propio vCPU/memoria), pero sigue siendo un servicio escalando en conjunto
con `--min-instances=0`, no dos servicios escalando por separado.

Si ves costos inesperadamente altos, revisar:
1. Si `--min-instances` está en 1 o más (cobra aunque no haya tráfico)
2. Si hay queries a BigQuery sin `MaxBytesBilled` (ver `epa-bq` y
   `epa-backend/references/bigquery-repository.md`)
3. Notificar al área de Datos e IA si el costo supera $50 USD/mes por dashboard

---

## Recursos adicionales

- `references/dockerfile-nextjs.md` — Dockerfile optimizado para Next.js
- `references/cloud-run-config.md` — configuraciones avanzadas
  (autenticación, memoria, cold starts, y el hogar de la SA de runtime y
  sus grants de BigQuery)
- `epa-backend/references/sidecar.md` — la topología de dos contenedores en
  detalle: comando de deploy completo, por qué no hay auth en el salto
  `web`→`api`, dev local, troubleshooting del sidecar
