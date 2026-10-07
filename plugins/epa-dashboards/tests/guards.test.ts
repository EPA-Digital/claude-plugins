import { describe, expect, test } from 'claude-code/testing'

import { bqDryRunArgv, checkGcloudDeploy, parseDryRunBytes, splitSimpleCommand } from '../hooks/lib/rules.ts'

const SAFE_BQ =
  'bq query --use_legacy_sql=false --maximum_bytes_billed=10737418240 "SELECT a FROM coppel_reporting.t LIMIT 10"'

// Lo que el modelo lee cuando la llamada se niega, venga como deny o como resultado de error.
function refusal(out: { deny?: string; isError?: boolean; text?: string }): string | undefined {
  return out.deny ?? (out.isError ? out.text : undefined)
}

describe('reglas puras', () => {
  test('splitSimpleCommand respeta comillas y rechaza comandos compuestos', async () => {
    expect(splitSimpleCommand(`bq query "SELECT 'x' LIMIT 1"`)).toEqual(['bq', 'query', "SELECT 'x' LIMIT 1"])
    expect(splitSimpleCommand('FOO=1 bq query x')).toEqual(['bq', 'query', 'x'])
    expect(splitSimpleCommand('cd x && bq query y')).toBeNull()
    expect(splitSimpleCommand('bq query "$(cat q.sql)"')).toBeNull()
    expect(splitSimpleCommand('bq query < q.sql')).toBeNull()
  })

  test('bqDryRunArgv agrega --dry_run y --format=json', async () => {
    expect(bqDryRunArgv('bq --project_id=epa-turing query --format=pretty --maximum_bytes_billed=1 "SELECT 1 LIMIT 1"')).toEqual([
      'bq',
      '--project_id=epa-turing',
      '--format=json',
      'query',
      '--dry_run',
      '--maximum_bytes_billed=1',
      'SELECT 1 LIMIT 1',
    ])
  })

  test('parseDryRunBytes lee JSON y texto', async () => {
    expect(parseDryRunBytes('{"statistics":{"totalBytesProcessed":"2048"}}')).toBe(2048)
    expect(parseDryRunBytes('running this query will process 99 bytes of data.')).toBe(99)
    expect(parseDryRunBytes('nada')).toBeNull()
  })

  test('el port de guard-cloud-deploy.sh', async () => {
    expect(checkGcloudDeploy('gcloud run deploy coppel-dashboard-vibe --project=epa-turing')).toBeNull()
    expect(checkGcloudDeploy('gcloud run deploy epa-dashboard --project=bdd-epa-digital')).toContain('bdd-epa-digital')
    expect(checkGcloudDeploy('gcloud run deploy x-vibe')).toContain('Falta --project')
    expect(checkGcloudDeploy('gcloud run services delete pitagoras-api --project=epa-turing')).toContain('-vibe')
    expect(checkGcloudDeploy('gcloud builds submit --project=epa-turing')).toBeNull()
    expect(checkGcloudDeploy('gcloud run services list')).toBeNull()
  })
})

describe('tool.call: bloqueos', () => {
  test('bq query sin tope ni LIMIT se bloquea; con ambos pasa', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))

    const bad = await $.tool.call({ tool: 'Bash', command: 'bq query "SELECT * FROM coppel_reporting.t"' })
    expect(refusal(bad)).toContain('--maximum_bytes_billed')
    expect(refusal(bad)).toContain('LIMIT')

    const tooBig = await $.tool.call({
      tool: 'Bash',
      command: 'bq query --maximum_bytes_billed=999999999999999 "SELECT 1 LIMIT 1"',
    })
    expect(refusal(tooBig)).toContain('tope de EPA')

    const good = await $.tool.call({ tool: 'Bash', command: SAFE_BQ })
    expect(refusal(good)).toBeUndefined()
  })

  test('recursos protegidos', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))
    const cases: [string, string][] = [
      ['bq query --maximum_bytes_billed=1 "SELECT * FROM bdd-epa-digital.epa_agency_reports.x LIMIT 1"', 'DEPRECADO'],
      ['bq query --maximum_bytes_billed=1 "DELETE FROM coppel_etl.meta_ads WHERE true"', 'pitagoras-etl'],
      ['gcloud secrets versions add FacebookAccessToken --data-file=-', 'FacebookAccessToken'],
      ['firebase firestore:delete users --recursive --project bdd-epa-digital', 'Firestore'],
      ['PITAGORAS_MODE=live python run.py', 'PITAGORAS_MODE'],
      ['gcloud run deploy epa-dashboard --project=bdd-epa-digital --source .', 'Newton'],
    ]
    for (const [command, expected] of cases) {
      expect(refusal(await $.tool.call({ tool: 'Bash', command }))).toContain(expected)
    }
  })

  test('comandos ajenos pasan sin tocarse', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))
    expect(refusal(await $.tool.call({ tool: 'Bash', command: 'ls -la && git status' }))).toBeUndefined()
    expect(refusal(await $.tool.call({ tool: 'Bash', command: 'gcloud run services list --project=epa-turing' }))).toBeUndefined()
  })

  test('mencionar un recurso en texto no es usarlo', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))
    for (const command of [
      'grep -rn epa_agency_reports docs/',
      'git log --grep ga360-250517',
      'git commit -m "docs: gcloud run deploy epa-dashboard --project=bdd-epa-digital"',
      'rg "PITAGORAS_MODE=live" plugins/',
    ]) {
      expect(refusal(await $.tool.call({ tool: 'Bash', command }))).toBeUndefined()
    }
    // Pero un tubo hacia bq sí es una consulta.
    const piped = await $.tool.call({ tool: 'Bash', command: 'cat q.sql | bq query --use_legacy_sql=false' })
    expect(refusal(piped)).toContain('--maximum_bytes_billed')
  })

  test('Tokyo está deprecado', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))
    const out = await $.tool.call({ tool: 'mcp__claude_ai_Tokyo__facebook_report', account: 'x' })
    expect(refusal(out)).toContain('DEPRECADO')
  })

  test('MCP de BigQuery exige LIMIT', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))
    const bad = await $.tool.call({ tool: 'mcp__claude_ai_Google_Cloud_BigQuery__execute_sql', query: 'SELECT * FROM t' })
    expect(refusal(bad)).toContain('LIMIT')
    const good = await $.tool.call({ tool: 'mcp__claude_ai_Google_Cloud_BigQuery__execute_sql', query: 'SELECT * FROM t LIMIT 5' })
    expect(refusal(good)).toBeUndefined()
  })
})

describe('tool.check: preguntas con contexto', () => {
  test('una query grande pide confirmación con el costo', async ($, on) => {
    on('tool.check', () => ({ decision: 'allow' }))
    on('process.run', () => ({ value: { exitCode: 0, stdout: '{"totalBytesProcessed":"53687091200"}', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
    const verdict = await $.tool.check({ tool: 'Bash', input: { command: SAFE_BQ } })
    expect(verdict.decision).toBe('ask')
    expect(verdict.reason).toContain('50 GiB')
  })

  test('una query chica conserva la decisión de las reglas', async ($, on) => {
    on('tool.check', () => ({ decision: 'allow' }))
    on('process.run', () => ({ value: { exitCode: 0, stdout: '{"totalBytesProcessed":"1024"}', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
    expect((await $.tool.check({ tool: 'Bash', input: { command: SAFE_BQ } })).decision).toBe('allow')
  })

  test('desplegar encima de un servicio vivo pide confirmación', async ($, on) => {
    on('tool.check', () => ({ decision: 'allow' }))
    on('process.run', () => ({
      value: {
        exitCode: 0,
        stdout: JSON.stringify({ status: { latestReadyRevisionName: 'coppel-dashboard-vibe-00042' } }),
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }))
    const verdict = await $.tool.check({
      tool: 'Bash',
      input: { command: 'gcloud run deploy coppel-dashboard-vibe --project=epa-turing --source .' },
    })
    expect(verdict.decision).toBe('ask')
    expect(verdict.reason).toContain('00042')
  })

  test('en la terminal pregunta directo y respeta un "no"', async ($, on) => {
    on('tool.check', () => ({ decision: 'allow' }))
    on('session.surfaces', () => ({ value: ['terminal'] as const }))
    // $.ui.ask es una llamada a AskUserQuestion; la persona elige "No, cancelar".
    on('tool.call', { tool: 'AskUserQuestion' }, (_$, e) => ({
      result: { questions: e.questions, answers: { [e.questions[0]?.question ?? '']: 'No, cancelar' } },
    }))
    const verdict = await $.tool.check({
      tool: 'Bash',
      input: { command: 'bq ls --project_id=ga360-250517 Epa_dataset' },
    })
    expect(verdict.decision).toBe('deny')
    expect(verdict.reason).toContain('canceló')
  })

  test('ga360-250517 pide confirmación', async ($, on) => {
    on('tool.check', () => ({ decision: 'allow' }))
    const verdict = await $.tool.check({
      tool: 'Bash',
      input: { command: 'bq ls --project_id=ga360-250517 Epa_dataset' },
    })
    expect(verdict.decision).toBe('ask')
  })
})
