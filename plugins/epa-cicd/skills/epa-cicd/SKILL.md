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

### 1. Configurar autenticación de GitHub → GCP

En la consola de GCP (epa-turing), crear una Service Account para GitHub Actions:

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

### 2. Crear el JSON de credenciales y subirlo a GitHub

```bash
# Generar el JSON de la service account
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions-deployer@epa-turing.iam.gserviceaccount.com

# ⚠️ IMPORTANTE: Este archivo es una credencial. 
# NO commitearlo al repo. Borrarlo después de subirlo a GitHub.
```

En GitHub → tu repo → Settings → Secrets and variables → Actions → New repository secret:
- Nombre: `GCP_SA_KEY`
- Valor: contenido completo del archivo `github-actions-key.json`

Luego borrar el archivo local:
```bash
rm github-actions-key.json
```

### 3. Crear el repositorio en Artifact Registry

```bash
gcloud artifacts repositories create epa-containers \
  --repository-format=docker \
  --location=us-central1 \
  --project=epa-turing \
  --description="Contenedores Docker de servicios EPA"
```

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
Fix:    Agregar el permiso desde GCP IAM o pedirle a Lalo
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
Fix:    Notificar a Lalo — puede ser necesario ajustar quotas o costos
```

### Ver logs en tiempo real
```bash
gcloud run services logs tail {nombre-servicio} \
  --region=us-central1 \
  --project=epa-turing
```

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
3. Notificar a Lalo si el costo supera $50 USD/mes por servicio

---

## Recursos adicionales

- `references/dockerfile-patterns.md` — Dockerfiles optimizados para Python y TypeScript
- `references/cloud-run-config.md` — configuraciones avanzadas (VPC, autenticación, memoria)
