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
Servicio de Cloud Run:   {cliente}-dashboard-web-vibe
                         siempre kebab-case, siempre termina en -vibe
                         (sí, también en producción — ver epa-safe-vibe B7)
Repo de GitHub:          {cliente}-dashboard
Ramas:                   main / dev / feature/EPA-{ticket}-{slug}
Variables de entorno:    EPA_* (servidor) · NEXT_PUBLIC_* (navegador)
```

Prohibido: nombres genéricos (`dashboard`, `epa-dashboard` — es la cadena
del incidente Newton), nombres personales, versión en el nombre
(`-v2`), mezclar convenciones. Si tienes duda de cómo nombrar algo,
escribe a datos@epa.digital antes de crear el recurso.

---

## Concepto en 30 segundos

```
Tu código en GitHub
       ↓
   Haces push a main
       ↓
GitHub Actions se activa automáticamente
       ↓
pnpm typecheck && pnpm lint && pnpm build   ← si algo falla, no pasa de aquí
       ↓
Construye tu app en un contenedor Docker
       ↓
Sube el contenedor a Google Artifact Registry
       ↓
Despliega en Cloud Run (epa-turing)
       ↓
Tu dashboard está vivo en una URL de Cloud Run
```

Después del setup inicial, desplegar es solo hacer `git push`.

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

# Además, para que el dashboard pueda leer BigQuery en tiempo de ejecución
gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:{cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"
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

---

## Template de GitHub Actions — deploy a Cloud Run

Crear el archivo en tu repo: `.github/workflows/deploy.yml`

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
  SERVICE_NAME: cliente-dashboard-web-vibe

jobs:
  deploy:
    name: Build y Deploy
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout del código
        uses: actions/checkout@v4

      - name: Instalar pnpm
        uses: pnpm/action-setup@v4

      - name: Instalar Node 22 LTS
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Instalar dependencias
        run: pnpm install --frozen-lockfile

      # Gate de calidad — si algo falla aquí, no se construye ni despliega nada
      - name: Typecheck, lint y build
        run: pnpm typecheck && pnpm lint && pnpm build

      - name: Autenticar en GCP
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configurar Docker para Artifact Registry
        run: |
          gcloud auth configure-docker ${{ env.REGISTRY }} --quiet

      - name: Build de la imagen Docker
        run: |
          docker build \
            -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.SERVICE_NAME }}:${{ github.sha }} \
            -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.SERVICE_NAME }}:latest \
            .

      - name: Push de la imagen a Artifact Registry
        run: |
          docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.SERVICE_NAME }}:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.SERVICE_NAME }}:latest

      # Guard de existencia: la PRIMERA vez que se crea el servicio, aborta si el
      # nombre ya existe (un deploy a un nombre existente lo SOBREESCRIBE — incidente
      # Newton). Quitar este step una vez que el servicio es tuyo y deployeas updates.
      - name: Guard — el servicio no debe existir ya (primer deploy)
        if: ${{ vars.FIRST_DEPLOY == 'true' }}
        run: |
          if gcloud run services describe ${{ env.SERVICE_NAME }} \
               --region=${{ env.REGION }} --project=${{ env.PROJECT_ID }} >/dev/null 2>&1; then
            echo "🔴 El servicio '${{ env.SERVICE_NAME }}' YA existe en ${{ env.PROJECT_ID }}."
            echo "   Un deploy lo SOBREESCRIBIRÍA. Elige otro nombre (ver epa-safe-vibe B7)."
            exit 1
          fi

      - name: Deploy a Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.SERVICE_NAME }}:${{ github.sha }} \
            --region=${{ env.REGION }} \
            --project=${{ env.PROJECT_ID }} \
            --platform=managed \
            --no-allow-unauthenticated \
            --service-account=github-actions-deployer@epa-turing.iam.gserviceaccount.com \
            --memory=1Gi \
            --cpu=1 \
            --min-instances=0 \
            --max-instances=3 \
            --port=8080

      - name: Mostrar URL del servicio
        run: |
          gcloud run services describe ${{ env.SERVICE_NAME }} \
            --region=${{ env.REGION }} \
            --project=${{ env.PROJECT_ID }} \
            --format='value(status.url)'
```

> ⚠️ **Por qué `--no-allow-unauthenticated`:** un dashboard muestra datos
> reales de campañas y presupuesto de un cliente. Hasta que exista el auth
> real de la plataforma (IAP + Identity Platform, ver
> `epa-frontend/references/auth.md`), el servicio **no es público en
> internet**. Acceso interno vía `gcloud run services proxy` o dando
> `roles/run.invoker` a personas/grupos específicos. Si el dashboard
> necesita ser accesible por el cliente final HOY, escala a
> datos@epa.digital antes de exponerlo — no cambies esta bandera a
> `--allow-unauthenticated` por tu cuenta.

---

## Template con variables de entorno desde Secret Manager

Si tu dashboard necesita credenciales (poco común — la mayoría de los
datos vienen de BigQuery vía ADC, no de secrets), usar este template
extendido. Las variables se inyectan directamente desde Secret Manager en
el deploy — el código nunca las ve como texto plano en el repo.

```yaml
      - name: Deploy a Cloud Run (con secrets)
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.SERVICE_NAME }}:${{ github.sha }} \
            --region=${{ env.REGION }} \
            --project=${{ env.PROJECT_ID }} \
            --platform=managed \
            --no-allow-unauthenticated \
            --memory=1Gi \
            --cpu=1 \
            --min-instances=0 \
            --max-instances=3 \
            --port=8080 \
            --set-secrets="EPA_ADMIN_TOKEN=EpaAdminToken:latest"
```

El formato de `--set-secrets` es:
```
EPA_{NOMBRE_VAR}={NombreSecret}:latest
```

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
`cliente-dashboard-web-staging-vibe`).

---

## QA local antes de hacer push a main

Antes de hacer push a `main` — que dispara el deploy real — verifica que
el dashboard arranca y responde localmente.

```bash
pnpm install
pnpm dev   # corre en :3000 por default
```

Abre `localhost:3000` en el navegador y verifica que la UI carga sin
errores de consola. `pnpm dev` corre en el puerto `:3000`; en Cloud Run el
contenedor escucha en `:8080` — no es una inconsistencia, son entornos
distintos (Next.js standalone respeta la variable `PORT` que Cloud Run le
inyecta).

### Si tu dashboard necesita variables de entorno

```bash
cp .env.example .env.local   # editar con valores de prueba
```

> ⚠️ `.env.local` y `.env` deben estar en `.gitignore`. Nunca commitear
> credenciales, aunque sean de prueba.

---

## Checklist antes del primer deploy

```
REPO Y CÓDIGO
[ ] El repo está en GitHub, bajo la org EPA-Digital
[ ] pnpm typecheck && pnpm lint && pnpm build pasan localmente
[ ] El código tiene un Dockerfile válido en la raíz (ver
    references/dockerfile-nextjs.md)
[ ] El dashboard tiene un endpoint GET /api/health que responde 200
[ ] El .gitignore incluye .env*, *.key, *.json de service accounts

GITHUB
[ ] El secret GCP_SA_KEY está configurado en el repo
[ ] El archivo .github/workflows/deploy.yml existe con SERVICE_NAME correcto
[ ] SERVICE_NAME sigue la Regla 0 de esta skill (kebab-case, sufijo -vibe)

GCP
[ ] El repositorio epa-containers existe en Artifact Registry
[ ] La service account github-actions-deployer tiene los permisos correctos
[ ] El proyecto epa-turing está seleccionado (no otro proyecto)
[ ] Corrí `gcloud run services list --project=epa-turing` y SERVICE_NAME
    NO existe ya (un deploy a un nombre existente lo SOBREESCRIBE — ver
    epa-safe-vibe B7)
[ ] SERVICE_NAME termina en -vibe — siempre, incluida producción
[ ] Nunca desplegar en bdd-epa-digital (reservado a Datos e IA y Newton)

SEGURIDAD
[ ] No hay credenciales en el código ni en el Dockerfile
[ ] Las variables sensibles usan --set-secrets, no --set-env-vars
[ ] El archivo github-actions-key.json fue borrado después de subirlo a GitHub
[ ] El deploy usa --no-allow-unauthenticated (ver nota de auth arriba)
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

### "No puedo abrir el dashboard en el navegador"
```
Causa:  El servicio se desplegó con --no-allow-unauthenticated (correcto,
        ver nota de arriba) y no tienes permiso de invocador
Fix:    gcloud run services proxy {servicio} --project=epa-turing
        región us-central1 — o pide a Datos e IA que te dé
        roles/run.invoker si necesitas acceso recurrente
```

### Error: "Quota exceeded"
```
Causa:  Se alcanzó el límite de instancias o CPU en epa-turing
Fix:    Notificar al área de Datos e IA — puede ser necesario ajustar quotas o costos
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
Estimado mensual para un dashboard de uso moderado:
- 0 instancias en idle:     $0
- 1M requests/mes (1GB):    ~$10–18 USD
- Artifact Registry storage: ~$1–3 USD/mes

Total típico por dashboard:  $10–25 USD/mes
```

Si ves costos inesperadamente altos, revisar:
1. Si `--min-instances` está en 1 o más (cobra aunque no haya tráfico)
2. Si hay queries a BigQuery sin límite de bytes (ver `epa-bq`)
3. Notificar al área de Datos e IA si el costo supera $50 USD/mes por dashboard

---

## Recursos adicionales

- `references/dockerfile-nextjs.md` — Dockerfile optimizado para Next.js
- `references/cloud-run-config.md` — configuraciones avanzadas (autenticación, memoria, cold starts)
