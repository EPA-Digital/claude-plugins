#!/usr/bin/env bash
# setup-acceso.sh — deja listo el acceso de un dashboard EPA INTERNO:
#   IAP (solo @epa.digital) + base de Firestore propia + primer admin.
#
# Patrón completo: epa-frontend/references/auth.md y
# epa-backend/references/access-control.md. Dashboards con gente del cliente
# (Acceso: externo) NO usan este script: se escalan a datos@epa.digital.
#
# Uso:
#   bash setup-acceso.sh --service {cliente}-dashboard-vibe \
#     --runtime-sa {cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com \
#     --admin persona@epa.digital [--dry-run]
#
# Es idempotente: se puede correr las veces que haga falta. Orden recomendado:
#   1. Correrlo ANTES del primer deploy: crea la base, los permisos y el admin.
#      Los pasos de IAP se saltan si el servicio todavía no existe.
#   2. Primer deploy (con --iap, ver epa-deploy/SKILL.md).
#   3. Correrlo OTRA VEZ: activa IAP y da acceso a domain:epa.digital.
# Así IAP nunca se enciende sobre una revisión que no exige la lista de acceso.

set -euo pipefail

PROJECT="epa-turing"
PROJECT_NUMBER="689827400521"
REGION="us-central1"
DOMAIN="epa.digital"
COLLECTION="AccessUsers"

SERVICE=""
RUNTIME_SA=""
ADMIN=""
DRY_RUN=0

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }
die() { echo "🔴 $*" >&2; exit 1; }
info() { echo "▶ $*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service) SERVICE="${2:-}"; shift 2 ;;
    --runtime-sa) RUNTIME_SA="${2:-}"; shift 2 ;;
    --admin) ADMIN="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage 0 ;;
    *) die "Opción desconocida: $1 (usa --help)" ;;
  esac
done

# --- Validaciones: fallar antes de tocar nada ---------------------------------
[[ -n "$SERVICE" && -n "$RUNTIME_SA" && -n "$ADMIN" ]] || usage 1
[[ "$SERVICE" =~ ^[a-z][a-z0-9-]{2,61}-vibe$ ]] \
  || die "El servicio '$SERVICE' tiene que ser kebab-case y terminar en -vibe (regla de naming EPA)."
[[ "$RUNTIME_SA" == *"@${PROJECT}.iam.gserviceaccount.com" ]] \
  || die "La SA de runtime tiene que ser de ${PROJECT} (…@${PROJECT}.iam.gserviceaccount.com)."
ADMIN="$(echo "$ADMIN" | tr '[:upper:]' '[:lower:]' | xargs)"
[[ "$ADMIN" =~ ^[^@[:space:]]+@${DOMAIN//./\\.}$ ]] \
  || die "El primer admin tiene que ser una cuenta @${DOMAIN}."

DATABASE="$SERVICE" # una base de Firestore por dashboard, con el nombre del servicio
IAP_AGENT="service-${PROJECT_NUMBER}@gcp-sa-iap.iam.gserviceaccount.com"
AUDIENCE="/projects/${PROJECT_NUMBER}/locations/${REGION}/services/${SERVICE}"

run() {
  echo "  \$ $*"
  if [[ $DRY_RUN -eq 0 ]]; then "$@"; fi
}

# Evita depender del proyecto activo de gcloud: todo lleva --project explícito.
command -v gcloud >/dev/null || die "Falta gcloud."
command -v curl >/dev/null || die "Falta curl."

# --- 1. APIs ------------------------------------------------------------------
info "1/6 Habilitando APIs (run, firestore, iap)"
run gcloud services enable run.googleapis.com firestore.googleapis.com iap.googleapis.com \
  --project="$PROJECT"

# --- 2. Base de Firestore propia ----------------------------------------------
info "2/6 Base de Firestore '${DATABASE}'"
if [[ $DRY_RUN -eq 0 ]] && gcloud firestore databases describe --database="$DATABASE" \
  --project="$PROJECT" >/dev/null 2>&1; then
  echo "  ya existe — se deja como está"
else
  run gcloud firestore databases create --database="$DATABASE" --location="$REGION" \
    --type=firestore-native --project="$PROJECT"
fi

# --- 3. Permiso de la SA de runtime, acotado a ESA base ------------------------
info "3/6 roles/datastore.user para ${RUNTIME_SA}, solo sobre la base ${DATABASE}"
run gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user" \
  --condition="expression=resource.name == \"projects/${PROJECT}/databases/${DATABASE}\",title=solo-${DATABASE}" \
  --format=none --quiet

# --- 4. Primer admin (solo si no existe: nunca pisa un registro) ---------------
info "4/6 Primer admin: ${ADMIN}"
URL="https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents/${COLLECTION}?documentId=${ADMIN}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BODY=$(cat <<JSON
{"fields":{
  "role":{"stringValue":"admin"},
  "status":{"stringValue":"active"},
  "createdAt":{"timestampValue":"${NOW}"},
  "createdBy":{"stringValue":"setup-acceso.sh"}
}}
JSON
)
if [[ $DRY_RUN -eq 1 ]]; then
  echo "  \$ curl -X POST '${URL}' (crea ${COLLECTION}/${ADMIN} con role=admin, status=active)"
else
  TOKEN="$(gcloud auth print-access-token)"
  CODE=$(curl -sS -o /tmp/setup-acceso.$$ -w '%{http_code}' -X POST "$URL" \
    -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d "$BODY")
  case "$CODE" in
    200) echo "  creado" ;;
    409) echo "  ya existía — no se modificó" ;;
    *) cat /tmp/setup-acceso.$$ >&2; rm -f /tmp/setup-acceso.$$; die "Firestore respondió ${CODE}." ;;
  esac
  rm -f /tmp/setup-acceso.$$
fi

# --- 5 y 6. IAP (solo si el servicio ya existe) --------------------------------
if [[ $DRY_RUN -eq 0 ]] && ! gcloud run services describe "$SERVICE" --region="$REGION" \
  --project="$PROJECT" >/dev/null 2>&1; then
  info "5/6 y 6/6 El servicio ${SERVICE} todavía no existe: haz el primer deploy (con --iap) y vuelve a correr este script."
else
  info "5/6 Activando IAP en ${SERVICE} y dándole run.invoker al agente de IAP"
  run gcloud beta services identity create --service=iap.googleapis.com --project="$PROJECT"
  run gcloud run services update "$SERVICE" --region="$REGION" --project="$PROJECT" --iap
  run gcloud run services add-iam-policy-binding "$SERVICE" --region="$REGION" --project="$PROJECT" \
    --member="serviceAccount:${IAP_AGENT}" --role="roles/run.invoker" --format=none --quiet

  info "6/6 IAP deja pasar solo a domain:${DOMAIN}"
  run gcloud iap web add-iam-policy-binding --resource-type=cloud-run \
    --service="$SERVICE" --region="$REGION" --project="$PROJECT" \
    --member="domain:${DOMAIN}" --role="roles/iap.httpsResourceAccessor" --format=none --quiet
fi

cat <<EOF

✅ Listo. Variables del contenedor api (deploy/api.env.yaml o el workflow):
   AUTH_MODE=iap
   IAP_AUDIENCE=${AUDIENCE}
   AUTH_ALLOWED_DOMAINS=${DOMAIN}
   FIRESTORE_PROJECT_ID=${PROJECT}
   FIRESTORE_DATABASE_ID=${DATABASE}

Recordatorio: el servicio NUNCA lleva allUsers ni --allow-unauthenticated.
Quién entra lo decide ${COLLECTION}: altas y bajas desde /admin/accesos.
EOF
