---
name: epa-init
description: >
  Inicializa un proyecto nuevo de EPA Digital con toda la infraestructura base:
  CLAUDE.md con contexto EPA, .claude/settings.json con Tokyo MCP + BigQuery +
  plugins EPA, cloudbuild.yaml para Cloud Run en epa-turing, .env.local.template,
  y checklist de pasos manuales. Usar cuando el usuario quiera arrancar un
  proyecto nuevo bajo los estándares EPA.
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
3. **¿Tiene autenticación de usuarios vía Supabase?** (sí / no)
4. **¿Consume datos de plataformas de medios vía Tokyo?** (Google Ads, Meta, TikTok — sí / no)
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
BigQuery:   epa-turing — dataset: {SLUG_SNAKE}
Cloud Run:  {SLUG}-web (servicio en epa-turing)
Secretos:   Secret Manager en epa-turing
\`\`\`

---

## BigQuery

\`\`\`
Proyecto:  epa-turing
Dataset:   {SLUG_SNAKE}
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
- **Tokyo:** Datos de medios solo vía Tokyo MCP o REST API. Nunca directo a plataformas.
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

### Archivo 3: `cloudbuild.yaml`

Adaptar según stack (Next.js vs FastAPI):

**Next.js:**
```yaml
# Cloud Build → Cloud Run en epa-turing
# Servicio: {SLUG}-web
# Proyecto: epa-turing

steps:
  - name: gcr.io/cloud-builders/docker
    id: build
    args:
      - build
      - -t=$_IMAGE:$_TAG
      - -f=Dockerfile
      - .

  - name: gcr.io/cloud-builders/docker
    id: push
    args: [push, $_IMAGE:$_TAG]
    waitFor: [build]

  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    id: deploy
    entrypoint: gcloud
    args:
      - run
      - deploy
      - {SLUG}-web
      - --image=$_IMAGE:$_TAG
      - --region=us-central1
      - --project=epa-turing
      - --platform=managed
      - --allow-unauthenticated
      - --port=3000
      - --memory=512Mi
      - --cpu=1
      - --min-instances=0
      - --max-instances=10
      - --service-account={SLUG}-runtime@epa-turing.iam.gserviceaccount.com
      - --set-secrets={SECRETOS_NECESARIOS}
    waitFor: [push]

substitutions:
  _IMAGE: us-central1-docker.pkg.dev/epa-turing/{SLUG}/{SLUG}-web
  _TAG: latest

options:
  logging: CLOUD_LOGGING_ONLY
```

**FastAPI:**
```yaml
# Cloud Build → Cloud Run en epa-turing
# Servicio: {SLUG}-api
# Proyecto: epa-turing

steps:
  - name: gcr.io/cloud-builders/docker
    id: build
    args:
      - build
      - -t=$_IMAGE:$_TAG
      - -f=Dockerfile
      - .

  - name: gcr.io/cloud-builders/docker
    id: push
    args: [push, $_IMAGE:$_TAG]
    waitFor: [build]

  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    id: deploy
    entrypoint: gcloud
    args:
      - run
      - deploy
      - {SLUG}-api
      - --image=$_IMAGE:$_TAG
      - --region=us-central1
      - --project=epa-turing
      - --platform=managed
      - --allow-unauthenticated
      - --port=8000
      - --memory=512Mi
      - --cpu=1
      - --min-instances=0
      - --max-instances=10
      - --service-account={SLUG}-runtime@epa-turing.iam.gserviceaccount.com
      - --set-secrets={SECRETOS_NECESARIOS}
    waitFor: [push]

substitutions:
  _IMAGE: us-central1-docker.pkg.dev/epa-turing/{SLUG}/{SLUG}-api
  _TAG: latest

options:
  logging: CLOUD_LOGGING_ONLY
```

---

### Archivo 4: `.env.local.template`

```bash
# ─── BigQuery (epa-turing) ───────────────────────────────────────────────────
# Service account con acceso a BigQuery en epa-turing
# Descargar desde: IAM → Service Accounts → {slug}-runtime@epa-turing
GOOGLE_APPLICATION_CREDENTIALS=./credentials/epa-turing-sa.json

# ─── Tokyo API ───────────────────────────────────────────────────────────────
# Email del usuario con acceso a Pitagoras (Tokyo backend)
TOKYO_EMAIL=analytics@epa.digital
# URL base del API (no cambiar)
TOKYO_API_URL=https://api.tokyo.epa.digital/api/v1

# ─── Supabase (si aplica) ────────────────────────────────────────────────────
# Obtener desde: app.supabase.com → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

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
        bq mk --project_id=epa-turing --dataset {SLUG_SNAKE}
  [ ] Crear Artifact Registry repo:
        gcloud artifacts repositories create {SLUG} \
          --repository-format=docker --location=us-central1 \
          --project=epa-turing
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
  [ ] TOKYO_EMAIL
  [ ] EPA_ADMIN_TOKEN
  [ ] ANTHROPIC_API_KEY  (si aplica)
  [ ] SUPABASE_SERVICE_ROLE_KEY  (si aplica)
  Comando: gcloud secrets create NOMBRE --project=epa-turing --data-file=-

Cloud Build:
  [ ] Conectar repo de GitHub a Cloud Build en epa-turing
  [ ] Crear trigger en master/main → cloudbuild.yaml
  [ ] Primer deploy manual para verificar

[SI SUPABASE]
  [ ] Crear tabla user_clients en Supabase para controlar acceso por usuario
  [ ] Dar acceso a los usuarios iniciales en user_clients

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
- El dataset de BigQuery en `epa-turing` sigue naming `snake_case` (e.g., `turing_rentabilidad`)
- El servicio de Cloud Run sigue naming `{slug}-web` (frontend) o `{slug}-api` (backend)
- El SA de runtime sigue naming `{slug}-runtime@epa-turing.iam.gserviceaccount.com`
- El repo de Artifact Registry sigue naming `{slug}` (kebab-case)
- Nunca commitear `.env.local` ni archivos de credentials JSON
