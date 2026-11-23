#!/usr/bin/env bash
# setup-wif.sh — crea, UNA SOLA VEZ para toda la plataforma, la federación de
# GitHub Actions → GCP con la que los dashboards se despliegan SIN llaves JSON.
#
# Lo corre alguien con permisos de IAM (owner / Datos e IA). Un dashboard nuevo
# NO lo necesita: solo tiene que vivir en EPA-Digital, llamarse *-dashboard y
# desplegar desde main (ver epa-deploy/SKILL.md, Prerequisitos, paso 1).
#
# Crea (idempotente: lo que ya existe se deja como está):
#   - Pool "github-dashboards" y provider "github" (OIDC de GitHub Actions) con
#     la condición: owner EPA-Digital + repo que termina en -dashboard + rama main.
#   - SA "github-dashboards-deployer" con roles/run.developer y
#     roles/iam.serviceAccountUser (proyecto) y artifactregistry.writer SOLO sobre
#     el repo epa-containers. Sin condiciones: las condiciones IAM por nombre no
#     funcionan con Cloud Run vía gcloud (probado el 2026-11-23).
#   - Permiso para que las identidades del pool actúen como esa SA.
#
# run.developer NO incluye setIamPolicy: la SA no puede cambiar el IAM de un
# servicio, o sea, no puede exponerlo al público.
#
# Uso:
#   bash setup-wif.sh [--dry-run]
#
# --dry-run imprime los comandos de escritura sin ejecutarlos (las lecturas sí
# se ejecutan, para saber qué ya existe).

set -euo pipefail

PROJECT="epa-turing"
PROJECT_NUMBER="689827400521"
REGION="us-central1"
POOL="github-dashboards"
PROVIDER="github"
SA_ID="github-dashboards-deployer"
SA="${SA_ID}@${PROJECT}.iam.gserviceaccount.com"
OWNER="EPA-Digital"
SUFFIX="-dashboard"
BRANCH="refs/heads/main"
AR_REPO="epa-containers"
ISSUER="https://token.actions.githubusercontent.com"

# La condición del provider: lo único que decide qué repos pueden entrar.
CONDITION="assertion.repository_owner == '${OWNER}' && assertion.repository.endsWith('${SUFFIX}') && assertion.ref == '${BRANCH}'"
MAPPING="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref"
POOL_MEMBER="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/*"
PROVIDER_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"

DRY_RUN=0
usage() { sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }
die() { echo "🔴 $*" >&2; exit 1; }
info() { echo "▶ $*"; }
run() { echo "  \$ $*"; if [[ $DRY_RUN -eq 0 ]]; then "$@"; fi; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage 0 ;;
    *) die "Opción desconocida: $1 (usa --help)" ;;
  esac
done
command -v gcloud >/dev/null || die "Falta gcloud."

# --- 1. APIs --------------------------------------------------------------------
info "1/6 Habilitando APIs (iam, iamcredentials, sts, run, artifactregistry)"
run gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  run.googleapis.com artifactregistry.googleapis.com --project="$PROJECT"

# --- 2. Pool ----------------------------------------------------------------------
info "2/6 Pool '${POOL}'"
if gcloud iam workload-identity-pools describe "$POOL" --location=global --project="$PROJECT" >/dev/null 2>&1; then
  echo "  ya existe — se deja como está"
else
  run gcloud iam workload-identity-pools create "$POOL" --location=global --project="$PROJECT" \
    --display-name="GitHub Actions — dashboards"
fi

# --- 3. Provider ------------------------------------------------------------------
info "3/6 Provider '${PROVIDER}' (condición: ${CONDITION})"
if CURRENT="$(gcloud iam workload-identity-pools providers describe "$PROVIDER" --workload-identity-pool="$POOL" \
  --location=global --project="$PROJECT" --format='value(attributeCondition)' 2>/dev/null)"; then
  echo "  ya existe — se deja como está"
  if [[ "$CURRENT" != "$CONDITION" ]]; then
    echo "  ⚠️  su condición actual es DISTINTA de la del script:"
    echo "      actual: ${CURRENT}"
    echo "      script: ${CONDITION}"
    echo "      Actualízala a propósito con: gcloud iam workload-identity-pools providers update-oidc ${PROVIDER} ..."
  fi
else
  run gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --workload-identity-pool="$POOL" --location=global --project="$PROJECT" \
    --issuer-uri="$ISSUER" --attribute-mapping="$MAPPING" --attribute-condition="$CONDITION" \
    --display-name="GitHub Actions"
fi

# --- 4. SA de deploy ----------------------------------------------------------------
info "4/6 SA de deploy '${SA_ID}'"
if gcloud iam service-accounts describe "$SA" --project="$PROJECT" >/dev/null 2>&1; then
  echo "  ya existe — se deja como está"
else
  run gcloud iam service-accounts create "$SA_ID" --project="$PROJECT" \
    --display-name="GitHub Actions — deploy de dashboards (WIF, sin llaves)"
fi

# --- 5. Roles de la SA ----------------------------------------------------------------
info "5/6 Roles: run.developer y serviceAccountUser (proyecto), artifactregistry.writer (solo ${AR_REPO})"
for role in roles/run.developer roles/iam.serviceAccountUser; do
  run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:${SA}" \
    --role="$role" --condition=None --quiet --format=none
done
if gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  run gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --location="$REGION" --project="$PROJECT" \
    --member="serviceAccount:${SA}" --role=roles/artifactregistry.writer --quiet --format=none
else
  echo "  ⚠️  el repo ${AR_REPO} no existe todavía: créalo (epa-deploy, paso 3) y vuelve a correr este script"
fi

# --- 6. Las identidades del pool pueden actuar como la SA ---------------------------------
info "6/6 Las identidades del pool '${POOL}' pueden actuar como ${SA_ID}"
run gcloud iam service-accounts add-iam-policy-binding "$SA" --project="$PROJECT" \
  --member="$POOL_MEMBER" --role=roles/iam.workloadIdentityUser --quiet --format=none

cat <<EOF

✅ Listo. En el workflow de cada dashboard (epa-deploy/SKILL.md):

   permissions:
     contents: read
     id-token: write
   ...
   - uses: google-github-actions/auth@v2
     with:
       workload_identity_provider: ${PROVIDER_NAME}
       service_account: ${SA}

Quién puede entrar: repos de ${OWNER} que terminen en '${SUFFIX}', desde ${BRANCH}.
Quién NO: cualquier otro repo, otra rama o un pull request.
Pendiente aparte (no lo hace este script): borrar las llaves JSON y los secretos
GCP_SA_KEY de los dashboards que aún los usan, y revisar el alcance de las SAs
de deploy anteriores (audit-os-github-deployer, github-actions-deployer…).
EOF
