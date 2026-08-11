#!/usr/bin/env bash
#
# epa-safe-vibe — Guard de deploys de Cloud Run / Cloud Build (PreToolUse)
#
# Bloquea cualquier `gcloud run deploy` / `gcloud builds submit` / creación de
# trigger ejecutado por Claude que NO cumpla la convención EPA:
#   1) El proyecto destino debe ser epa-turing (declarado explícito con --project).
#   2) Para `run deploy`, el servicio debe terminar en el sufijo reservado de IA
#      ("-vibe"), para no colisionar con servicios humanos/productivos (ej. Newton).
#
# Origen: incidente 2026-06-09 — un deploy automatizado eligió el nombre genérico
# `epa-dashboard` en bdd-epa-digital y sobrescribió a Newton (la intranet de EPA).
#
# Filosofía: el discriminador NO es la propiedad (todo se despliega con la misma
# identidad), sino EXISTENCIA + NAMESPACE. Todo dashboard EPA usa el sufijo
# "-vibe" en el nombre de su servicio — siempre, incluida producción, sin
# excepción. No es solo una señal de "esto lo desplegó una IA".
#
# Mecánica: lee el tool_input.command de stdin (JSON). Si detecta un deploy que
# viola la convención → exit 2 + razón en stderr (bloquea y se la muestra a Claude).
# Fail-open ante cualquier error de parseo para no romper comandos no relacionados.

SUFFIX="-vibe"
ALLOWED_PROJECT="epa-turing"

input="$(cat)"

# --- Extraer el comando (jq preferido; python3 como fallback) -----------------
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"
else
  cmd="$(printf '%s' "$input" | python3 -c 'import sys,json
try:
    print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception:
    pass' 2>/dev/null)"
fi

[ -z "$cmd" ] && exit 0

# --- ¿Es un comando de deploy de Cloud Run / Cloud Build? ---------------------
deploy_re='gcloud[[:space:]]+([a-z]+[[:space:]]+)?run[[:space:]]+deploy'
mutate_re='gcloud[[:space:]]+([a-z]+[[:space:]]+)?run[[:space:]]+services[[:space:]]+(replace|update|delete)'
build_re='gcloud[[:space:]]+([a-z]+[[:space:]]+)?builds[[:space:]]+(submit|triggers[[:space:]]+create)'

if ! printf '%s' "$cmd" | grep -Eq "$deploy_re|$mutate_re|$build_re"; then
  exit 0
fi

reasons=""

# --- 1) Proyecto destino debe ser epa-turing y explícito ----------------------
proj="$(printf '%s' "$cmd" | grep -oE -- '--project[= ]+[a-z0-9-]+' | head -1 | grep -oE '[a-z0-9-]+$')"
if [ -z "$proj" ]; then
  reasons="${reasons}  • Falta --project=${ALLOWED_PROJECT} explícito. Un deploy de IA nunca debe depender de la config activa de gcloud (puede ser bdd-epa-digital u otro proyecto con servicios productivos).
"
elif [ "$proj" != "$ALLOWED_PROJECT" ]; then
  reasons="${reasons}  • Proyecto destino '${proj}' ≠ ${ALLOWED_PROJECT}. Claude solo puede desplegar herramientas vibecodeadas en ${ALLOWED_PROJECT}.
"
fi

# --- 2) Para 'run deploy', el servicio debe terminar en el sufijo reservado ---
if printf '%s' "$cmd" | grep -Eq "$deploy_re"; then
  # Servicio = primer token tras 'run deploy' (posicional), o --service=...
  svc="$(printf '%s' "$cmd" | sed -E 's/.*run[[:space:]]+deploy[[:space:]]+//' | grep -oE '^[A-Za-z0-9_-]+')"
  svc_flag="$(printf '%s' "$cmd" | grep -oE -- '--service[= ]+[A-Za-z0-9_-]+' | head -1 | grep -oE '[A-Za-z0-9_-]+$')"
  [ -n "$svc_flag" ] && svc="$svc_flag"
  case "$svc" in
    *"$SUFFIX") : ;;  # OK, termina en -vibe
    "") : ;;          # no se pudo determinar — no bloquear por nombre
    *)
      reasons="${reasons}  • El servicio '${svc}' no termina en '${SUFFIX}'. Todo deploy hecho por Claude/IA debe usar el sufijo reservado '${SUFFIX}' para vivir en un namespace disjunto al de los servicios humanos/productivos (ej. Newton) y NO poder sobrescribirlos.
"
      ;;
  esac
fi

# --- Veredicto ----------------------------------------------------------------
if [ -n "$reasons" ]; then
  {
    echo "🔴 epa-safe-vibe BLOQUEÓ este deploy de Cloud Run / Cloud Build."
    echo "   (Guardrail nacido del incidente Newton — 2026-06-09 — no repetir.)"
    echo ""
    printf '%s' "$reasons"
    echo ""
    echo "Cómo proceder:"
    echo "  - epa-turing + sufijo ${SUFFIX} — siempre, incluida producción."
    echo "    Ej: {cliente}-dashboard-web${SUFFIX}."
  } >&2
  exit 2
fi

exit 0
