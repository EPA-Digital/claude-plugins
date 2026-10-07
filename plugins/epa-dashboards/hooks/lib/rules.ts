// Reglas puras de los guards de epa-dashboards: reciben texto y devuelven el
// motivo de bloqueo (o null). No tocan `$`, así que se prueban sin sesión.
//
// Fuente de cada regla:
//   - CLAUDE.md, "Reglas de oro" y "Recursos protegidos"
//   - skills/epa-safe-vibe/references/protected-resources.md
//   - hooks/guard-cloud-deploy.sh (incidente Newton, 2026-06-09)

export const ALLOWED_PROJECT = 'epa-turing'
export const SERVICE_SUFFIX = '-vibe'
export const DEFAULT_REGION = 'us-central1'

// Tope duro de --maximum_bytes_billed (100 GiB ≈ 0.61 USD on-demand).
export const MAX_BYTES_BILLED_CAP = 100 * 1024 ** 3
// Arriba de esto el dry-run pide confirmación (10 GiB ≈ 0.06 USD).
export const ASK_BYTES_THRESHOLD = 10 * 1024 ** 3
const USD_PER_TIB = 6.25

export const PROTECTED_SECRETS = ['FacebookAccessToken', 'TiktokToken', 'GoogleAdsYAML', 'BingAccessTokenEpa']
export const PROTECTED_COLLECTIONS = ['users', 'clients', 'budgets']

const FOOTER = 'Si de verdad hace falta, lo autoriza el área de Datos e IA (datos@epa.digital).'

// --- Utilidades --------------------------------------------------------------

export function formatBytes(bytes: number): string {
  const gib = bytes / 1024 ** 3
  if (gib >= 1) return `${gib.toFixed(gib >= 10 ? 0 : 1)} GiB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`
}

export function estimateUsd(bytes: number): string {
  return `~${((bytes / 1024 ** 4) * USD_PER_TIB).toFixed(2)} USD`
}

function flagValue(cmd: string, flag: string): string | null {
  const m = cmd.match(new RegExp(`--${flag}[= ]+['"]?([A-Za-z0-9_.:-]+)`))
  return m?.[1] ?? null
}

/**
 * Parte un comando simple en argv, como lo haría sh. Devuelve null si el
 * comando es compuesto o usa algo que no se puede reproducir sin shell
 * (`;`, `&&`, `|`, redirecciones, `$(...)`, backticks, heredocs, saltos de línea).
 */
export function splitSimpleCommand(cmd: string): string[] | null {
  const argv: string[] = []
  let cur = ''
  let has = false
  let quote: '' | "'" | '"' = ''
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i] ?? ''
    if (quote === "'") {
      if (c === "'") quote = ''
      else cur += c
      continue
    }
    if (quote === '"') {
      if (c === '"') quote = ''
      else if (c === '`' || (c === '$' && cmd[i + 1] === '(')) return null
      else if (c === '\\' && '"\\$`'.includes(cmd[i + 1] ?? '')) cur += cmd[++i]
      else cur += c
      continue
    }
    if (c === "'" || c === '"') {
      quote = c
      has = true
    } else if (c === '\\') {
      if (i + 1 < cmd.length) {
        cur += cmd[++i]
        has = true
      }
    } else if (c === ' ' || c === '\t') {
      if (has) argv.push(cur)
      cur = ''
      has = false
    } else if (';&|<>`\n\r'.includes(c) || (c === '$' && cmd[i + 1] === '(')) {
      return null
    } else {
      cur += c
      has = true
    }
  }
  if (quote) return null
  if (has) argv.push(cur)
  // Quita asignaciones de entorno al inicio (FOO=bar bq query ...).
  while (argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0] ?? '')) argv.shift()
  return argv.length ? argv : null
}

// Comandos que solo leen o mueven texto: buscar `epa_agency_reports` con grep o
// nombrar `ga360-250517` en un mensaje de commit no es usar el recurso.
const TEXT_ONLY = new Set([
  'grep', 'rg', 'ag', 'git', 'gh', 'echo', 'printf', 'cat', 'less', 'head', 'tail',
  'sed', 'awk', 'ls', 'find', 'fd', 'wc', 'diff', 'jq', 'code', 'open',
])

/** Primera palabra del comando, sin asignaciones de entorno al inicio. */
export function firstWord(cmd: string): string {
  const words = cmd.trim().split(/\s+/)
  while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0] ?? '')) words.shift()
  return (words[0] ?? '').replace(/^.*\//, '')
}

/**
 * Todos los tramos del comando (separados por `;`, `&&`, `||`, `|`) solo leen
 * o mueven texto, aunque mencionen recursos. `cat q.sql | bq query` no lo es.
 * Partir sin respetar comillas puede crear tramos de más; eso solo hace que se
 * revise un comando de más (falla hacia el lado seguro).
 */
export function isTextOnly(cmd: string): boolean {
  if (/(^|[;&|]\s*|export\s+)PITAGORAS_MODE\s*=/.test(cmd)) return false
  return cmd
    .split(/;|&&|\|\||\||\n/)
    .filter(s => s.trim())
    .every(s => TEXT_ONLY.has(firstWord(s)))
}

// --- BigQuery ----------------------------------------------------------------

const BQ_QUERY_RE = /\bbq(\s+--?[\w-]+(=\S+)?)*\s+query\b/g

export function isBqQuery(cmd: string): boolean {
  return new RegExp(BQ_QUERY_RE.source).test(cmd)
}

/** Reglas de costo sobre un `bq query` en Bash. */
export function checkBqCommand(cmd: string): string | null {
  const queries = cmd.match(BQ_QUERY_RE)?.length ?? 0
  if (queries === 0) return null
  if (/--dry_run\b/.test(cmd)) return null // un dry-run no factura

  const caps = [...cmd.matchAll(/--maximum_bytes_billed[= ]+['"]?(\d+)/g)].map(m => Number(m[1]))
  const reasons: string[] = []
  if (caps.length < queries) {
    reasons.push(
      `Falta --maximum_bytes_billed. Toda query lleva tope de bytes (máximo ${MAX_BYTES_BILLED_CAP}, que es ${formatBytes(MAX_BYTES_BILLED_CAP)}).`,
    )
  } else if (caps.some(c => c > MAX_BYTES_BILLED_CAP)) {
    reasons.push(
      `--maximum_bytes_billed pasa del tope de EPA (${formatBytes(MAX_BYTES_BILLED_CAP)}). Si de verdad necesitas más, pídelo a Datos e IA.`,
    )
  }
  const sqlReason = checkSqlLimit(cmd)
  if (sqlReason) reasons.push(sqlReason)

  return reasons.length ? bqDeny(reasons) : null
}

/** Una consulta SELECT sin LIMIT. Se aplica a Bash y a MCP de BigQuery. */
export function checkSqlLimit(sql: string): string | null {
  if (/\bselect\b/i.test(sql) && !/\blimit\s+\d+/i.test(sql)) {
    return 'La consulta no tiene LIMIT. Toda query de EPA lleva LIMIT (regla de oro #2).'
  }
  return null
}

export function bqDeny(reasons: string[]): string {
  return [
    '🔴 epa-dashboards bloqueó esta consulta de BigQuery (control de costo).',
    ...reasons.map(r => `  • ${r}`),
    'Ejemplo: bq query --use_legacy_sql=false --maximum_bytes_billed=10737418240 "SELECT ... LIMIT 1000"',
  ].join('\n')
}

/** argv para el dry-run de un `bq query` simple, o null si no se puede armar. */
export function bqDryRunArgv(cmd: string): string[] | null {
  const argv = splitSimpleCommand(cmd)
  if (!argv || argv[0] !== 'bq') return null
  const qi = argv.indexOf('query')
  if (qi < 0) return null
  const globals = argv.slice(1, qi).filter(a => !a.startsWith('--format'))
  const rest = argv.slice(qi + 1).filter(a => !a.startsWith('--format') && a !== '--dry_run')
  return ['bq', ...globals, '--format=json', 'query', '--dry_run', ...rest]
}

/** Lee los bytes que procesaría la consulta de la salida del dry-run. */
export function parseDryRunBytes(stdout: string): number | null {
  const json = stdout.match(/"totalBytesProcessed"\s*:\s*"?(\d+)/)
  if (json) return Number(json[1])
  const text = stdout.match(/process\s+(\d+)\s+bytes/)
  return text ? Number(text[1]) : null
}

// --- Datos protegidos (SQL o comandos) ---------------------------------------

const ETL_WRITE_RE =
  /\b(insert\s+into|update|delete\s+from|merge(\s+into)?|create(\s+or\s+replace)?\s+table|alter\s+table|drop\s+table|truncate\s+table)\s+`?[\w-]*[.:]?\w+_etl\./i
const BQ_ETL_MUTATE_RE = /\bbq\s+(--?\S+\s+)*(rm|load|cp|insert|update|mk)\b[^\n]*\b\w+_etl[.:]/

/** Reglas que bloquean sin preguntar, sobre SQL o un comando. */
export function checkProtectedData(text: string): string | null {
  if (/\bepa_agency_reports\b/.test(text)) {
    return deny(
      '`bdd-epa-digital.epa_agency_reports` está DEPRECADO y no tiene reemplazo cross-cliente.',
      'Usa `{cliente}_reporting` del cliente (resuélvelo en INFORMATION_SCHEMA.SCHEMATA); un rollup entre clientes se escala a datos@epa.digital.',
    )
  }
  if (ETL_WRITE_RE.test(text) || BQ_ETL_MUTATE_RE.test(text)) {
    return deny(
      'Los datasets `{cliente}_etl` solo los escribe pitagoras-etl. Un dashboard los lee, nunca los escribe (INSERT/UPDATE/DELETE/MERGE/DDL, bq rm/load/cp).',
      FOOTER,
    )
  }
  if (/\bPITAGORAS_MODE\s*=\s*['"]?live\b/.test(text)) {
    return deny(
      '`PITAGORAS_MODE=live` es exclusivo de scripts/ de epa-etl con confirmación humana. Un dashboard nunca llama a Pitágoras.',
      'Si un dato de medios no está en `{cliente}_reporting`, escala a datos@epa.digital.',
    )
  }
  return null
}

/** ga360-250517 (Coppel/Domo) solo con confirmación explícita del usuario. */
export function mentionsGa360(text: string): boolean {
  return /\bga360-250517\b/.test(text)
}

// --- gcloud / Firestore / Secret Manager --------------------------------------

const DEPLOY_RE = /gcloud\s+([a-z]+\s+)?run\s+deploy\b/
const MUTATE_RE = /gcloud\s+([a-z]+\s+)?run\s+services\s+(replace|update|delete)\b/
const BUILD_RE = /gcloud\s+([a-z]+\s+)?builds\s+(submit|triggers\s+create)\b/

export function isCloudRunDeploy(cmd: string): boolean {
  return DEPLOY_RE.test(cmd)
}

/** Nombre del servicio de un `run deploy` o `run services update|delete`. */
export function serviceName(cmd: string): string | null {
  const flag = flagValue(cmd, 'service')
  if (flag) return flag
  const m = cmd.match(/run\s+(?:deploy|services\s+(?:update|delete))\s+([A-Za-z0-9_-]+)/)
  return m?.[1] ?? null
}

export function regionOf(cmd: string): string {
  return flagValue(cmd, 'region') ?? DEFAULT_REGION
}

/** Port de guard-cloud-deploy.sh, más el sufijo -vibe en update/delete. */
export function checkGcloudDeploy(cmd: string): string | null {
  if (!DEPLOY_RE.test(cmd) && !MUTATE_RE.test(cmd) && !BUILD_RE.test(cmd)) return null

  const reasons: string[] = []
  const project = flagValue(cmd, 'project')
  if (!project) {
    reasons.push(
      `Falta --project=${ALLOWED_PROJECT} explícito. Un deploy de IA nunca depende de la config activa de gcloud (puede ser bdd-epa-digital u otro proyecto con servicios productivos).`,
    )
  } else if (project !== ALLOWED_PROJECT) {
    reasons.push(`Proyecto destino '${project}' ≠ ${ALLOWED_PROJECT}. Claude solo despliega en ${ALLOWED_PROJECT}.`)
  }

  const touchesService = DEPLOY_RE.test(cmd) || /run\s+services\s+(update|delete)\b/.test(cmd)
  const svc = touchesService ? serviceName(cmd) : null
  if (svc && !svc.endsWith(SERVICE_SUFFIX)) {
    reasons.push(
      `El servicio '${svc}' no termina en '${SERVICE_SUFFIX}'. Todo servicio de un dashboard usa ese sufijo (incluida producción) para no poder pisar servicios humanos o productivos (ej. Newton).`,
    )
  }

  if (!reasons.length) return null
  return [
    '🔴 epa-dashboards bloqueó este comando de Cloud Run / Cloud Build.',
    '   (Guardrail nacido del incidente Newton, 2026-06-09.)',
    ...reasons.map(r => `  • ${r}`),
    `Cómo proceder: ${ALLOWED_PROJECT} + sufijo ${SERVICE_SUFFIX}, siempre. Ej: {cliente}-dashboard${SERVICE_SUFFIX}.`,
  ].join('\n')
}

export function checkSecrets(cmd: string): string | null {
  const m = cmd.match(/gcloud\s+([a-z]+\s+)?secrets\s+(delete|update|versions\s+(add|destroy|disable))\s+[^\n]*/)
  if (!m) return null
  const hit = PROTECTED_SECRETS.find(s => new RegExp(`\\b${s}\\b`).test(m[0]))
  if (!hit) return null
  return deny(
    `El secret \`${hit}\` es del ETL centralizado y está protegido: no se crean versiones, no se destruyen ni se borran desde una sesión de IA.`,
    FOOTER,
  )
}

export function checkFirestore(cmd: string): string | null {
  const col = PROTECTED_COLLECTIONS.join('|')
  const del = new RegExp(`firebase\\s+firestore:delete\\b[^\\n]*(--all-collections|\\s['"]?/?(${col})(/|\\b))`)
  if (del.test(cmd)) {
    return deny(
      `Borrar en las colecciones protegidas de Firestore (${PROTECTED_COLLECTIONS.join(', ')}) o todas las colecciones está bloqueado.`,
      FOOTER,
    )
  }
  if (/gcloud\s+([a-z]+\s+)?firestore\s+(import|databases\s+delete)\b/.test(cmd) && /bdd-epa-digital/.test(cmd)) {
    return deny('Importar o borrar bases de Firestore en bdd-epa-digital sobrescribe datos productivos.', FOOTER)
  }
  return null
}

export const TOKYO_DENY = [
  '🔴 El MCP de Pitágoras (Tokyo) está DEPRECADO.',
  '  • Para un dashboard: los datos de medios salen de `{cliente}_reporting` en BigQuery, leídos desde el backend Go.',
  '  • Si el dato no está en `{cliente}_reporting`, escala a datos@epa.digital.',
].join('\n')

function deny(reason: string, how: string): string {
  return `🔴 epa-dashboards bloqueó esta operación (recurso protegido).\n  • ${reason}\n${how}`
}
