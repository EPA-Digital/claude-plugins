// Mods de epa-dashboards: guards que corren dentro de Claude Code (≥ 2.1.287)
// en cualquier superficie, VS Code incluido. Las reglas viven en ./lib/rules.ts.
//
// - tool.call bloquea lo que nunca se permite (deny, sin preguntar).
// - tool.check pide confirmación a una persona para lo que la necesita, con el
//   motivo a la vista (costo estimado, servicio que se va a reemplazar): en
//   terminal o escritorio pregunta directo; en VS Code, con el diálogo de permiso.
// - Los comandos que solo leen o mueven texto (grep, git, cat...) no se revisan.
// - /epa-check revisa el repo del dashboard sin gastar un turno de Claude.
//
// guard-cloud-deploy.sh sigue en hooks.json como respaldo para versiones sin
// mods; cuando este módulo carga, bloquea primero y el .sh no llega a correr.

import type { EngineInterface, Register } from 'claude-code'

import {
  ALLOWED_PROJECT,
  ASK_BYTES_THRESHOLD,
  TOKYO_DENY,
  bqDeny,
  bqDryRunArgv,
  checkBqCommand,
  checkFirestore,
  checkGcloudDeploy,
  checkProtectedData,
  checkSecrets,
  checkSqlLimit,
  estimateUsd,
  formatBytes,
  isBqQuery,
  isCloudRunDeploy,
  isTextOnly,
  mentionsGa360,
  parseDryRunBytes,
  regionOf,
  serviceName,
} from './lib/rules.ts'

const GUARD_FAILED = '🔴 epa-dashboards: el guard falló al revisar este comando; por seguridad no se ejecutó. Reintenta o revisa `claude --debug`.'
const CHECK_FAILED = 'epa-dashboards no pudo revisar el costo o el servicio de este comando. Revísalo antes de aprobarlo.'
const YES = 'Sí, continuar'
const NO = 'No, cancelar'
const GA360 =
  '`ga360-250517` es el proyecto exclusivo de Coppel (Domo). Solo se usa con necesidad explícita confirmada por la persona. ¿Confirmas que hace falta?'

// Comandos que vale la pena revisar; todo lo demás pasa sin tocarse (fail-open).
const RELEVANT = /\b(bq|gcloud|firebase|PITAGORAS_MODE)\b|epa_agency_reports|ga360-250517/

function relevant(cmd: string): boolean {
  return RELEVANT.test(cmd) && !isTextOnly(cmd)
}

/**
 * Pide confirmación a una persona. Con terminal o escritorio pregunta directo
 * ($.ui.ask), así el clasificador del modo auto no decide por ella; en VS Code
 * o sin superficie devuelve `ask` y decide el diálogo de permiso del host.
 */
async function confirm($: EngineInterface, reason: string) {
  try {
    const surfaces = await $.session.surfaces()
    if (!surfaces.some(s => s === 'terminal' || s === 'desktop')) return { decision: 'ask' as const, reason }
    const answer = await $.ui.ask(reason, { header: 'EPA', options: [YES, NO] })
    return answer === YES
      ? { decision: 'allow' as const, reason: `Confirmado por la persona: ${reason}` }
      : { decision: 'deny' as const, reason: `La persona canceló: ${reason}` }
  } catch {
    return { decision: 'ask' as const, reason }
  }
}

function sqlOf(input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>
  return String(args.query ?? args.sql ?? args.statement ?? '')
}

export const register: Register = on => {
  // --- Bloqueos sin pregunta -------------------------------------------------

  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const cmd = e.command
    if (!relevant(cmd)) return next(e)
    const reason =
      checkProtectedData(cmd) ?? checkSecrets(cmd) ?? checkFirestore(cmd) ?? checkGcloudDeploy(cmd) ?? checkBqCommand(cmd)
    return reason ? { deny: reason } : next(e)
  }).catch(($, e, next) => (next.called || !relevant(e.command) ? next(e) : { deny: GUARD_FAILED }))

  on('tool.call', { tool: /^mcp__.*big_?query/i }, ($, e, next) => {
    const sql = sqlOf(e)
    const reason = checkProtectedData(sql) ?? checkSqlLimit(sql)
    return reason ? { deny: reason.startsWith('🔴') ? reason : bqDeny([reason]) } : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: GUARD_FAILED }))

  on('tool.call', { tool: /^mcp__claude_ai_Tokyo__/ }, () => ({ deny: TOKYO_DENY }))

  // --- Preguntas con contexto (diálogo nativo) --------------------------------

  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'deny') return verdict
    const cmd = String((e.input as { command?: unknown })?.command ?? '')
    if (!relevant(cmd)) return verdict

    if (mentionsGa360(cmd)) return confirm($, GA360)

    if (isBqQuery(cmd)) {
      const argv = bqDryRunArgv(cmd)
      if (!argv) return verdict
      const run = await $.process.run(argv, { timeoutMs: 20000 })
      const bytes = run.exitCode === 0 ? parseDryRunBytes(run.stdout) : null
      if (bytes !== null && bytes > ASK_BYTES_THRESHOLD) {
        return confirm($, `Esta consulta procesará ${formatBytes(bytes)} (${estimateUsd(bytes)} on-demand). ¿La corremos?`)
      }
      return verdict
    }

    if (isCloudRunDeploy(cmd)) {
      const svc = serviceName(cmd)
      if (!svc) return verdict
      const run = await $.process.run(
        ['gcloud', 'run', 'services', 'describe', svc, `--project=${ALLOWED_PROJECT}`, `--region=${regionOf(cmd)}`, '--format=json'],
        { timeoutMs: 20000 },
      )
      if (run.exitCode !== 0) return verdict // servicio nuevo: deciden las reglas de siempre
      const live = JSON.parse(run.stdout) as {
        status?: { latestReadyRevisionName?: string; url?: string }
        metadata?: { annotations?: Record<string, string> }
      }
      const rev = live.status?.latestReadyRevisionName ?? '¿?'
      const who = live.metadata?.annotations?.['serving.knative.dev/lastModifier'] ?? 'alguien'
      return confirm(
        $,
        `Vas a reemplazar el servicio vivo '${svc}' en ${ALLOWED_PROJECT} (revisión actual ${rev}, último cambio de ${who}${live.status?.url ? `, ${live.status.url}` : ''}). ¿Desplegamos encima?`,
      )
    }

    return verdict
  }).catch(($, e, next) => (next.called ? next(e) : { decision: 'ask', reason: CHECK_FAILED }))

  on('tool.check', { tool: /^mcp__.*big_?query/i }, async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision !== 'deny' && mentionsGa360(sqlOf(e.input))) return confirm($, GA360)
    return verdict
  })

  // --- /epa-check --------------------------------------------------------------

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'epa-check',
      description: 'Revisa que este repo cumpla las reglas de un dashboard EPA (sin gastar un turno)',
    })
    return next(e)
  })

  on('command.run', { command: 'epa-check' }, async $ => {
    const lines: string[] = ['Checklist EPA de este repo:', '']
    const ok = (s: string) => lines.push(`✅ ${s}`)
    const warn = (s: string) => lines.push(`⚠️ ${s}`)
    const bad = (s: string) => lines.push(`❌ ${s}`)

    const sh = async (argv: string[]) => {
      try {
        const r = await $.process.run(argv, { timeoutMs: 15000 })
        return r.exitCode === 0 ? r.stdout.trim() : null
      } catch {
        return null
      }
    }

    const node = await sh(['node', '--version'])
    if (node?.startsWith('v22.')) ok(`Node ${node}`)
    else warn(`Node ${node ?? 'no encontrado'}; el stack de EPA usa Node 22`)

    const pnpm = await sh(['pnpm', '--version'])
    if (pnpm) ok(`pnpm ${pnpm}`)
    else bad('pnpm no está instalado; el stack de EPA usa pnpm')

    const project = await sh(['gcloud', 'config', 'get-value', 'project'])
    if (project === ALLOWED_PROJECT) ok(`gcloud apunta a ${ALLOWED_PROJECT}`)
    else warn(`gcloud apunta a '${project ?? 'nada'}'; los deploys siempre llevan --project=${ALLOWED_PROJECT}`)

    const isMonorepo = (await $.fs.exists('apps/web')) && (await $.fs.exists('apps/api'))
    if (!isMonorepo) {
      warn('No hay apps/web + apps/api: no parece el monorepo de un dashboard EPA. Me salto las revisiones del repo.')
      return { text: lines.join('\n') }
    }
    ok('Monorepo apps/web + apps/api')

    const tracked = await sh(['git', 'ls-files', '--', '*.env', '.env*', '**/.env*'])
    const envs = (tracked ?? '').split('\n').filter(f => f && !/\.example$|\.sample$|\.template$/.test(f))
    if (envs.length) bad(`Archivos .env commiteados: ${envs.join(', ')}. Las credenciales van a Secret Manager vía --set-secrets.`)
    else ok('Ningún .env commiteado')

    if (await $.fs.exists('apps/web/package.json')) {
      const pkg = await $.fs.read('apps/web/package.json')
      if (typeof pkg === 'string' && pkg.includes('@google-cloud/bigquery')) {
        bad('apps/web declara @google-cloud/bigquery. El frontend nunca tiene cliente de BigQuery (regla de oro #7).')
      } else ok('El frontend no tiene cliente de BigQuery')
      if (typeof pkg === 'string' && !pkg.includes('@epa-datos/ui')) warn('apps/web no usa @epa-datos/ui (regla de oro #6).')
    }

    if (await $.fs.exists('.github/workflows')) {
      const files = (await $.fs.list('.github/workflows')).filter(f => /\.ya?ml$/.test(f.name))
      let deploys = 0
      for (const f of files) {
        const text = await $.fs.read(`.github/workflows/${f.name}`)
        if (typeof text !== 'string' || !/run\s+deploy|deploy-cloudrun/.test(text)) continue
        deploys += 1
        if (!/-vibe\b/.test(text)) bad(`${f.name} despliega a Cloud Run sin el sufijo -vibe`)
        if (!text.includes(ALLOWED_PROJECT)) bad(`${f.name} despliega sin mencionar ${ALLOWED_PROJECT}`)
      }
      if (deploys === 0) warn('No encontré un workflow de deploy a Cloud Run en .github/workflows')
      else ok(`${deploys} workflow(s) de deploy revisados`)
    } else warn('No hay .github/workflows: el deploy a Cloud Run va por GitHub Actions')

    const screens = await $.fs.exists('docs/product/screens.md')
    const domain = await $.fs.exists('docs/product/domain.md')
    if (screens && domain) ok('docs/product/screens.md y domain.md existen')
    else warn('Faltan docs/product/screens.md o domain.md (necesarios antes de construir UI nueva de producto)')

    return { text: lines.join('\n') }
  })
}
