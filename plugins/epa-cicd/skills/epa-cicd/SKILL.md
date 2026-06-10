---
name: epa-cicd
description: >
  CI/CD para proyectos EPA Digital en epa-turing. Activar cuando el usuario quiera
  desplegar una app a producción, configurar deploys automáticos, entender cómo
  funciona el flujo de deploy, o preguntar cómo "subir" su app a la nube. También
  activar ante términos como "deploy", "producción", "Cloud Run", "GitHub Actions",
  "pipeline", "automatizar el deploy", o "cómo publico esto". Proporciona templates
  listos para usar y una guía paso a paso diseñada para usuarios sin experiencia
  en DevOps. Prerequisito: epa-naming, epa-safe-vibe, y epa-stack instalados.
---

# EPA CI/CD — Deploy Automatizado

Stack: **GitHub Actions + Cloud Run** en **epa-turing**
Región: **us-central1**
Audiencia: usuarios con poca o ninguna experiencia en DevOps

---

## Concepto en 30 segundos

```
Tu código en GitHub
       ↓
   Haces push a main
       ↓
GitHub Actions se activa automáticamente
       ↓
Construye tu app en un contenedor Docker
       ↓
Sube el contenedor a Google Artifact Registry
       ↓
Despliega en Cloud Run (epa-turing)
       ↓
Tu app está viva en una URL pública de Cloud Run
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

> **Opción C (más rápida):** Escribe a `datos@epa.digital` con el asunto "Setup CI/CD para [nombre-de-tu-repo]". El área de Datos e IA crea la service account, la registra en Artifact Registry y te manda el valor del `GCP_SA_KEY`. Tú solo agregas ese secret en tu repo de GitHub y pones el workflow. Pasa al paso del workflow directamente.

---

### 1. Configurar autenticación de GitHub → GCP

**Opción B (gcloud):** crear la Service Account desde terminal:

```bash
# Nombre sugerido según epa-naming:
# github-actions-deployer

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
```

> **Opción A (Consola GCP):**
> 1. Ve a [console.cloud.google.com](https://console.cloud.google.com) → proyecto `epa-turing`
> 2. Menú → **IAM & Admin → Service Accounts** → **+ Crear cuenta de servicio**
> 3. Nombre: `github-actions-deployer` → **Crear y continuar**
> 4. Agrega los tres roles uno a uno: **Cloud Run Admin**, **Artifact Registry Writer**, **Service Account User** → **Listo**

### 2. Crear el JSON de credenciales y subirlo a GitHub

**Opción B (gcloud):**
```bash
# Generar el JSON de la service account
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
  --description="Contenedores Docker de servicios EPA"
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
  workflow_dispatch:  # Permite disparar el deploy manualmente desde GitHub

env:
  PROJECT_ID: epa-turing
  REGION: us-central1
  REGISTRY: us-central1-docker.pkg.dev
  REPOSITORY: epa-containers
  # ⚠️ Cambiar SERVICE_NAME al nombre de tu servicio (según epa-naming)
  SERVICE_NAME: mi-servicio-svc

jobs:
  deploy:
    name: Build y Deploy
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout del código
        uses: actions/checkout@v4

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
            echo "   Un deploy lo SOBREESCRIBIRÍA. Elige otro nombre (ver epa-naming / epa-safe-vibe B7)."
            exit 1
          fi

      - name: Deploy a Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.SERVICE_NAME }}:${{ github.sha }} \
            --region=${{ env.REGION }} \
            --project=${{ env.PROJECT_ID }} \
            --platform=managed \
            --allow-unauthenticated \
            --memory=512Mi \
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

---

## Template con variables de entorno desde Secret Manager

Si tu servicio necesita credenciales, usar este template extendido.
Las variables se inyectan directamente desde Secret Manager en el deploy — el código
nunca las ve como texto plano en el repo.

```yaml
      - name: Deploy a Cloud Run (con secrets)
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.SERVICE_NAME }}:${{ github.sha }} \
            --region=${{ env.REGION }} \
            --project=${{ env.PROJECT_ID }} \
            --platform=managed \
            --allow-unauthenticated \
            --memory=512Mi \
            --cpu=1 \
            --min-instances=0 \
            --max-instances=3 \
            --port=8080 \
            --set-secrets="EPA_FB_TOKEN=FacebookAccessToken:latest,EPA_GADS_YAML=GoogleAdsYAML:latest"
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
`branches: [dev]` y un `SERVICE_NAME` distinto (ej: `mi-servicio-staging-svc`).

---

## QA local antes de hacer push a main

Antes de hacer push a `main` — que dispara el deploy real — verifica que el servicio arranca y responde localmente. No requiere Docker ni herramientas adicionales; usa el runtime que ya tienes.

### Python (FastAPI)

```bash
# Instalar dependencias (si aún no lo has hecho)
pip install -r requirements.txt

# Levantar en el mismo puerto que Cloud Run usa
uvicorn main:app --host 0.0.0.0 --port 8080
```

En otra terminal (o en tu navegador en `localhost:8080`):
```bash
curl localhost:8080/health    # debe devolver 200
curl localhost:8080/          # debe responder, sin errores 500
```

### TypeScript / Node (Hono)

```bash
npm install
npm run dev   # o npm start — ver scripts en package.json
```

```bash
curl localhost:8080/health
```

### Next.js

```bash
npm install
npm run dev   # corre en :3000 por default
```

Abre `localhost:3000` en el navegador y verifica que la UI carga sin errores de consola.

### Si tu servicio necesita variables de entorno

Crea un archivo `.env.local` con los valores de prueba que necesites y cárgalo antes de iniciar:

```bash
# Python — usando python-dotenv o similar que ya tengas configurado
# Node / Next.js
cp .env.example .env.local   # editar con valores de prueba
```

> ⚠️ `.env.local` y `.env` deben estar en `.gitignore`. Nunca commitear credenciales, aunque sean de prueba.

### ¿Cuándo es suficiente este QA?

Para la mayoría de apps EPA (dashboards, APIs ligeras, ETLs simples): sí es suficiente. Si el servicio **necesita conectarse a Firestore o Secret Manager de producción para arrancar**, considera hacer push a `dev` primero y revisar el deploy de staging antes de mergear a `main`.

---

## Checklist antes del primer deploy

```
REPO Y CÓDIGO
[ ] El repo está en GitHub (bajo epa-digital org o cuenta personal)
[ ] El código tiene un Dockerfile válido en la raíz
[ ] El Dockerfile expone el puerto 8080
[ ] El servicio tiene un endpoint GET /health que responde 200
[ ] El .gitignore incluye .env, *.key, *.json de service accounts

GITHUB
[ ] El secret GCP_SA_KEY está configurado en el repo
[ ] El archivo .github/workflows/deploy.yml existe con SERVICE_NAME correcto
[ ] SERVICE_NAME sigue las convenciones de epa-naming

GCP
[ ] El repositorio epa-containers existe en Artifact Registry
[ ] La service account github-actions-deployer tiene los permisos correctos
[ ] El proyecto epa-turing está seleccionado (no otro proyecto)
[ ] Corrí `gcloud run services list --project=epa-turing` y SERVICE_NAME NO existe
    ya (un deploy a un nombre existente lo SOBREESCRIBE — ver epa-safe-vibe B7)
[ ] Si el deploy lo hace Claude/IA: SERVICE_NAME termina en `-vibe`
[ ] Nunca desplegar en bdd-epa-digital (reservado a datos + Newton)

SEGURIDAD
[ ] No hay credenciales en el código ni en el Dockerfile
[ ] Las variables sensibles usan --set-secrets, no --set-env-vars
[ ] El archivo github-actions-key.json fue borrado después de subirlo a GitHub
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

### El deploy termina exitoso pero la app no responde
```
Causa:  El contenedor no levanta en el puerto 8080
Fix:    1. Verificar que el Dockerfile tiene EXPOSE 8080
        2. Verificar que la app escucha en 0.0.0.0:8080, no en localhost
        3. Revisar los logs en Cloud Run: Consola GCP → Cloud Run → tu servicio → Logs
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
Estimado mensual para un servicio interno de uso moderado:
- 0 instancias en idle:     $0
- 1M requests/mes (512MB): ~$8–15 USD
- Artifact Registry storage: ~$1–3 USD/mes

Total típico por servicio:  $5–20 USD/mes
```

Si ves costos inesperadamente altos, revisar:
1. Si `--min-instances` está en 1 o más (cobra aunque no haya tráfico)
2. Si hay queries a BigQuery sin límite de bytes
3. Notificar al área de Datos e IA si el costo supera $50 USD/mes por servicio

---

## Recursos adicionales

- `references/dockerfile-patterns.md` — Dockerfiles optimizados para Python y TypeScript
- `references/cloud-run-config.md` — configuraciones avanzadas (VPC, autenticación, memoria)
