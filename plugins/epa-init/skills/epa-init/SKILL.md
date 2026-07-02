---
name: epa-init
description: >
  Inicializa un proyecto nuevo de EPA Digital con toda la infraestructura base:
  CLAUDE.md con contexto EPA, .claude/settings.json con MCP Tokyo + BigQuery +
  plugins EPA, .github/workflows/deploy.yml para Cloud Run en epa-turing,
  .env.local.template, y checklist de pasos manuales. Usar cuando el usuario
  quiera arrancar un proyecto nuevo bajo los estándares EPA.
---

# Skill: epa-init

Inicializa la estructura base de un proyecto EPA Digital nuevo.

---

## Comportamiento al activarse

**Paso 1 — Recopilar datos del proyecto**

Haz estas preguntas en UN SOLO MENSAJE (no una por una):

1. **¿Cuál es el slug del proyecto?** (kebab-case, e.g., `turing-rentabilidad`, `chedraui-ropo`, `epa-presupuestos`)
2. **¿Cuál es el stack principal?**
   - A) Next.js (React + App Router)
   - B) FastAPI (Python)
   - C) Otro (especificar)
3. **¿Tiene autenticación de usuarios vía Firebase Authentication?** (sí / no)
4. **¿Tu app necesita consumir datos de plataformas de medios en tiempo de ejecución (backend/ETL)?** (Google Ads, Meta, TikTok, etc. — sí / no). El MCP de Tokyo se configura siempre para uso interactivo del desarrollador, sin importar esta respuesta.
5. **¿Tendrá dominio custom?** (e.g., `presupuestos.epa.digital`) — sí / no, y cuál si aplica

Espera las respuestas antes de generar cualquier archivo.

---

**Paso 2 — Generar archivos**

Con las respuestas, genera los siguientes archivos en el directorio actual del proyecto:

---

### Archivo 1: `CLAUDE.md`

```markdown
# CLAUDE.md — {NOMBRE_PROYECTO}

{DESCRIPCION_BREVE_DEL_PROYECTO}
Aplican todas las reglas del [contexto organizacional EPA](https://github.com/EPA-Digital/claude-plugins).

---

## Stack

\`\`\`
{STACK_COMPLETO}
GCP:        epa-turing (Project: 689827400521, Región: us-central1)
BigQuery:   epa-turing — dataset: {SLUG_SNAKE}_raw
Cloud Run:  {SLUG}-web (servicio en epa-turing)
Secretos:   Secret Manager en epa-turing
\`\`\`

---

## BigQuery

\`\`\`
Proyecto:  epa-turing
Dataset:   {SLUG_SNAKE}_raw
Tablas:    (definir según el modelo de datos del proyecto)
\`\`\`

Todas las queries deben incluir filtros de fechas y un LIMIT preventivo.
**No hacer SELECT * sin LIMIT** — las tablas de métricas pueden tener millones de filas.

---

## Archivos clave

\`\`\`
(completar conforme crece el proyecto)
\`\`\`

---

## Cloud Run

- Servicio: `{SLUG}-web`
- Proyecto: `epa-turing`
- Región: `us-central1`
- URL de producción: (completar tras primer deploy)
{SI_DOMINIO: - Dominio custom: `{DOMINIO}`}

---

## Reglas EPA que aplican aquí

- **Design system:** IBM Plex Sans/Mono, EPA Blue `#003AD6`.
- **BigQuery:** Siempre filtros de fecha y LIMIT. Sin `SELECT *` sin restricciones.
- **Datos de medios:** vibecoding interactivo → MCP de Tokyo (ya configurado en `.claude/settings.json`). Código en runtime/ETL → API REST de Pitágoras (`EPA_PITAGORAS_USER_EMAIL`). Nunca directo a las plataformas.
- **Credenciales:** En `.env.local` (no commiteado). Producción en Secret Manager de epa-turing.
- **Naming:** Seguir `epa-naming` para cualquier recurso nuevo.
- **Operaciones destructivas:** Siempre confirmar con el usuario antes de DELETE / DROP / TRUNCATE.
```

---

### Archivo 2: `.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(git log --oneline *)",
      "Bash(git diff --stat *)",
      "Bash(git diff --no-color *)",
      "Bash(git status *)",
      "Bash(git status --short)",
      "Bash(git branch)",
      "Bash(find * -type f *)",
      "Bash(ls *)",
      "Bash(wc -l *)"
    ]
  },
  "mcpServers": {
    "Tokyo": {
      "type": "http",
      "url": "https://api.tokyo.epa.digital/mcp"
    },
    "bigquery": {
      "command": "uvx",
      "args": [
        "mcp-server-bigquery",
        "--project",
        "epa-turing",
        "--location",
        "US"
      ],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/ruta/a/credentials.json"
      }
    }
  },
  "extraKnownMarketplaces": {
    "epa-plugins": {
      "source": {
        "source": "github",
        "repo": "EPA-Digital/claude-plugins"
      }
    }
  },
  "enabledPlugins": {
    "epa-naming@epa-plugins": true,
    "epa-safe-vibe@epa-plugins": true,
    "epa-design@epa-plugins": true,
    "epa-cicd@epa-plugins": true
  }
}
```

> Nota para el usuario: reemplazar `/ruta/a/credentials.json` con la ruta real al service account de epa-turing.

---

### Archivo 3: `.github/workflows/deploy.yml`

Un solo workflow sirve para Next.js y FastAPI — solo cambia `SERVICE_NAME`
(sufijo `-web` o `-api`) y el `Dockerfile` del proyecto. Sigue el mismo stack
canónico documentado en el plugin `epa-cicd` (GitHub Actions + Cloud Run,
nunca Cloud Build) — ahí está el detalle completo: cómo crear `GCP_SA_KEY`
una sola vez, troubleshooting y QA local antes de `main`.

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
  SERVICE_NAME: "{SLUG}-web"   # "{SLUG}-api" si el stack es FastAPI
  PORT: 8080

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
            --port=${{ env.PORT }} \
            --memory=512Mi \
            --cpu=1 \
            --min-instances=0 \
            --max-instances=10 \
            --service-account={SLUG}-runtime@epa-turing.iam.gserviceaccount.com \
            --set-secrets={SECRETOS_NECESARIOS}

      - name: Mostrar URL del servicio
        run: |
          gcloud run services describe ${{ env.SERVICE_NAME }} \
            --region=${{ env.REGION }} \
            --project=${{ env.PROJECT_ID }} \
            --format='value(status.url)'
```

> Nota para el usuario: si el repo todavía no tiene el secret `GCP_SA_KEY`
> configurado, seguir el plugin `epa-cicd` (tres opciones, incluida pedirle a
> Datos e IA que lo haga por ti). El repositorio `epa-containers` en Artifact
> Registry es compartido por todos los servicios de EPA — si no existe,
> crearlo una sola vez (ver `epa-cicd`), no crear uno nuevo por proyecto.

---

### Archivo 4: `.env.local.template`

```bash
# ─── BigQuery (epa-turing) ───────────────────────────────────────────────────
# Service account con acceso a BigQuery en epa-turing
# Descargar desde: IAM → Service Accounts → {slug}-runtime@epa-turing
GOOGLE_APPLICATION_CREDENTIALS=./credentials/epa-turing-sa.json

# ─── Pitágoras (datos de medios en runtime — Google Ads, Meta, TikTok, etc.) ─
# Email autorizado para obtener token vía POST /api/v1/customers.
# Ver plugins/epa-stack/references/pitagoras.md para el cliente completo.
# Para vibecoding interactivo (explorar datos durante desarrollo) usa el MCP
# Tokyo ya configurado en .claude/settings.json — no necesitas esta variable
# para eso, Tokyo no está pensado para llamadas de runtime/ETL.
EPA_PITAGORAS_USER_EMAIL=analytics@epa.digital

# ─── Firebase Authentication (si aplica) ─────────────────────────────────────
# Firebase Console → Project Settings → General → Tus apps (Web app)
# El proyecto de Firebase debe ser el mismo proyecto GCP (epa-turing)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=epa-turing.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=epa-turing
# La verificación de tokens en el backend reusa GOOGLE_APPLICATION_CREDENTIALS
# de arriba (Firebase Admin SDK) — no se necesita un secret nuevo.

# ─── Anthropic (si el proyecto usa Claude) ────────────────────────────────────
ANTHROPIC_API_KEY=

# ─── Admin token interno ─────────────────────────────────────────────────────
# Generar con: openssl rand -hex 32
EPA_ADMIN_TOKEN=
```

---

### Archivo 5: `.gitignore` (si no existe)

Asegurar que incluya al menos:
```
.env.local
.env.*.local
credentials/
*.json.bak
secrets/
__pycache__/
.next/
node_modules/
```

---

**Paso 3 — Imprimir checklist de pasos manuales**

Al terminar de generar los archivos, mostrar este checklist:

```
╔══════════════════════════════════════════════════════════════╗
║  CHECKLIST — Pasos manuales para {NOMBRE_PROYECTO}          ║
╚══════════════════════════════════════════════════════════════╝

GCP — epa-turing (hacer UNA VEZ por proyecto):
  [ ] Crear dataset en BigQuery:
        bq mk --project_id=epa-turing --dataset {SLUG_SNAKE}_raw
  [ ] Verificar que el Artifact Registry compartido "epa-containers" existe
      (si no, crearlo una sola vez — ver plugin epa-cicd, no crear uno nuevo
      por proyecto)
  [ ] Crear Service Account de runtime:
        gcloud iam service-accounts create {SLUG}-runtime \
          --project=epa-turing \
          --display-name="{NOMBRE_PROYECTO} Runtime"
  [ ] Dar permisos al SA (BigQuery + Secret Manager):
        gcloud projects add-iam-policy-binding epa-turing \
          --member="serviceAccount:{SLUG}-runtime@epa-turing.iam.gserviceaccount.com" \
          --role="roles/bigquery.dataEditor"
        gcloud projects add-iam-policy-binding epa-turing \
          --member="serviceAccount:{SLUG}-runtime@epa-turing.iam.gserviceaccount.com" \
          --role="roles/secretmanager.secretAccessor"

Secret Manager — subir secretos antes del primer deploy:
  [ ] GOOGLE_APPLICATION_CREDENTIALS_JSON  (contenido del SA JSON, no la ruta)
  [ ] EPA_PITAGORAS_USER_EMAIL  (si consume datos de medios en runtime)
  [ ] EPA_ADMIN_TOKEN
  [ ] ANTHROPIC_API_KEY  (si aplica)
  Comando: gcloud secrets create NOMBRE --project=epa-turing --data-file=-
  (Firebase Authentication no necesita un secret nuevo: el backend reusa
  GOOGLE_APPLICATION_CREDENTIALS_JSON vía Firebase Admin SDK, y las variables
  NEXT_PUBLIC_FIREBASE_* no son secretas.)

GitHub Actions (una sola vez para todo epa-turing, ver plugin epa-cicd si falta):
  [ ] Repo con el secret GCP_SA_KEY configurado
  [ ] Archivo .github/workflows/deploy.yml existe con SERVICE_NAME correcto
  [ ] Push a main → GitHub Actions construye y despliega automático
  [ ] Verificar que {SLUG}-web / {SLUG}-api responde en la URL de Cloud Run

[SI FIREBASE AUTH]
  [ ] Habilitar Firebase Authentication en el proyecto epa-turing
      (Firebase Console → Authentication → Sign-in method)
  [ ] Registrar la Web App en Firebase Console y copiar la config a las
      variables NEXT_PUBLIC_FIREBASE_* del .env.local
  [ ] (Opcional) Colección Firestore para mapear UID → permisos/cliente

[SI DOMINIO CUSTOM]
  [ ] Mapear dominio en Cloud Run:
        gcloud run domain-mappings create \
          --service={SLUG}-web \
          --domain={DOMINIO} \
          --region=us-central1 \
          --project=epa-turing
  [ ] Agregar registros DNS que indique Cloud Run (CNAME o A)
  [ ] Verificar SSL (Cloud Run lo gestiona automático, tarda ~15 min)

Al terminar:
  [ ] Actualizar CLAUDE.md con la URL de Cloud Run final
  [ ] Agregar proyecto al CLAUDE.md de EPADashboard si comparte datos BQ
```

---

## Notas del skill

- Siempre usar `epa-turing` como proyecto GCP (no `bdd-epa-digital` para proyectos nuevos)
- El dataset de BigQuery en `epa-turing` sigue naming `{cliente_o_producto}_{tipo}` (default `{slug_snake}_raw` — nunca solo el slug pelado, ver `epa-naming`)
- El servicio de Cloud Run sigue naming `{slug}-web` (frontend) o `{slug}-api` (backend)
- El SA de runtime sigue naming `{slug}-runtime@epa-turing.iam.gserviceaccount.com`
- El repo de Artifact Registry es el compartido `epa-containers` (no uno nuevo por proyecto)
- Datos de medios: MCP de Tokyo es solo para vibecoding interactivo; el código en runtime (ETL, backend) siempre usa la API REST de Pitágoras — ver `epa-stack/references/pitagoras.md`
- Autenticación de usuarios: Firebase Authentication es el patrón GCP-nativo — ver `epa-stack/references/firebase-auth.md`
- Nunca commitear `.env.local` ni archivos de credentials JSON
