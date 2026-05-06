# EPA Digital — Claude Code Plugins

Plugins oficiales de **EPA Digital** para vibecoding en `epa-turing` con Claude Code.
Cubre naming conventions, guardrails de seguridad, arquitectura canónica, design
system y CI/CD.

---

## Qué hay aquí

| Plugin | Para qué sirve |
|---|---|
| `epa-naming` | Convenciones de naming en GCP, GitHub y código |
| `epa-safe-vibe` | Bloqueos automáticos de operaciones destructivas, credenciales hardcodeadas y APIs de medios sin Pitágoras |
| `epa-stack` | Árbol de decisión de arquitectura + boilerplate Cloud Run (FastAPI / Hono) |
| `epa-design` | Design system EPA (tokens, componentes, copy en español) |
| `epa-cicd` | Templates GitHub Actions → Cloud Run en epa-turing |

Todos los plugins están escritos como **Skills** (auto-invocados por Claude
según contexto). No hay slash commands manuales: Claude los activa solo cuando
el contexto del prompt los amerita.

---

## Instalación rápida

### Opción 1 — Auto-instalación al confiar en un proyecto EPA

Cualquier repo EPA que incluya este `settings.json` en su `.claude/`:

```json
{
  "extraKnownMarketplaces": {
    "epa-plugins": {
      "source": { "source": "github", "repo": "epa-digital/claude-plugins" }
    }
  },
  "enabledPlugins": {
    "epa-naming@epa-plugins": true,
    "epa-safe-vibe@epa-plugins": true,
    "epa-stack@epa-plugins": true,
    "epa-design@epa-plugins": true,
    "epa-cicd@epa-plugins": true
  }
}
```

Al confiar en el folder, Claude Code te pregunta si quieres añadir el marketplace
y activa los 5 plugins automáticamente.

### Opción 2 — Manual

```
/plugin marketplace add epa-digital/claude-plugins
/plugin install epa-naming@epa-plugins
/plugin install epa-safe-vibe@epa-plugins
/plugin install epa-stack@epa-plugins
/plugin install epa-design@epa-plugins
/plugin install epa-cicd@epa-plugins
```

### Opción 3 — Desde CLI

```bash
claude plugin marketplace add epa-digital/claude-plugins --scope project
claude plugin install epa-naming@epa-plugins
claude plugin install epa-safe-vibe@epa-plugins
claude plugin install epa-stack@epa-plugins
claude plugin install epa-design@epa-plugins
claude plugin install epa-cicd@epa-plugins
```

---

## Cómo usar

Una vez instalados, no hay nada que invocar. Claude Code activa el skill correcto
según lo que estés haciendo:

| Lo que estás haciendo | Plugin que se activa |
|---|---|
| "Voy a crear una colección de Firestore para Coppel" | `epa-naming` |
| "Borra esta colección" / "delete documents" | `epa-safe-vibe` (BLOQUEA) |
| "Necesito un dashboard de campañas" | `epa-stack` (decide stack), `epa-design` (UI) |
| "Despliega esto a producción" | `epa-cicd` |
| Pegas un `api_key = "AIza..."` | `epa-safe-vibe` (BLOQUEA) |
| Construyes una landing | `epa-design` |

---

## Estructura del repo

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json          ← catálogo del marketplace
├── .claude/
│   └── settings.json             ← auto-instalación al trust del folder
├── CLAUDE.md                     ← contexto maestro de epa-turing
├── README.md
├── plugins/
│   ├── epa-naming/
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/epa-naming/SKILL.md
│   ├── epa-safe-vibe/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── skills/epa-safe-vibe/SKILL.md
│   │   └── references/
│   │       ├── protected-resources.md
│   │       └── pitagoras-access.md
│   ├── epa-stack/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── skills/epa-stack/SKILL.md
│   │   └── references/
│   │       ├── bigquery-patterns.md
│   │       ├── firestore-patterns.md
│   │       ├── n8n-patterns.md
│   │       └── pitagoras.md
│   ├── epa-design/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── skills/epa-design/SKILL.md
│   │   └── references/
│   │       ├── DESIGN.md
│   │       ├── tokens.md
│   │       ├── components.md
│   │       └── copy.md
│   └── epa-cicd/
│       ├── .claude-plugin/plugin.json
│       ├── skills/epa-cicd/SKILL.md
│       └── references/
│           ├── dockerfile-patterns.md
│           └── cloud-run-config.md
└── .gitignore
```

---

## Validación local

Desde la raíz del repo:

```bash
claude plugin validate .
```

O desde Claude Code:

```
/plugin validate .
```

---

## Versionado

- `version` declarada en cada `plugin.json` y en `metadata.version` del
  marketplace.
- Actualizar `version` en cada release relevante (los plugins están pinneados
  por versión: si no cambia el campo, los usuarios no reciben updates).
- Para development activo, se puede omitir `version` y todo commit nuevo cuenta
  como nueva versión (default behavior cuando se hostea en git).

---

## Mantenimiento

Cambios al stack canónico, naming o políticas de seguridad pasan por el área
de Datos e IA antes de mergear. PRs van con un breve "Why" y el caso real que
motiva el cambio.

```
Owner:    EPA Digital — Datos e IA
Email:    datos@epa.digital
```

---

## Licencia

MIT — uso interno y referencia abierta a la comunidad.
