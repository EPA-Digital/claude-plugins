# EPA Digital — Claude Code Plugins

Plugins oficiales de **EPA Digital** para trabajar con Claude Code dentro del
proyecto GCP `epa-turing`. Le dan a tu Claude el contexto institucional de la
agencia: cómo se nombran las cosas, qué no se debe tocar, qué stack usar, cómo
debe verse la UI y cómo se sube algo a producción.

> **¿Por qué existen estos plugins?**
> Sin ellos, cada vez que pides ayuda a Claude tienes que explicarle desde cero
> que somos EPA, que el proyecto se llama `epa-turing`, que las campañas de
> medios pasan por Pitágoras, que la fuente real de datos es BigQuery (no
> Sheets), y mil detalles más. Los plugins guardan todo ese contexto y se lo
> dan a Claude automáticamente cuando lo necesita. Resultado: tu Claude
> propone arquitecturas correctas desde el primer mensaje, te bloquea si vas
> a cometer un error costoso (borrar Firestore, pegar credenciales en código)
> y escribe UI con la paleta y tipografía oficiales de la agencia.

---

## ¿Qué hace cada plugin?

| Plugin | Qué hace | Cuándo se activa solo |
|---|---|---|
| **`epa-naming`** | Sabe cómo se nombran todos los recursos en EPA (colecciones, tablas, buckets, repos, variables). | Cuando vas a crear o renombrar un recurso en GCP, GitHub o tu código. |
| **`epa-safe-vibe`** | Te bloquea cuando vas a hacer algo que ha costado caro antes: borrar `PitagorasUsers`, hardcodear un token, conectarte directo a Meta Ads sin Pitágoras, usar Google Sheets como base de datos. | Ante palabras como `delete`, `drop`, `api_key="..."`, `gspread`, `googleads.googleapis.com`, etc. |
| **`epa-stack`** | Te dice qué stack usar para cada caso (FastAPI vs Hono, Cloud Run vs Cloud Run job, BigQuery vs Firestore). Dashboards: **Next.js 15 + Tailwind**. | Cuando dices "voy a construir X", "qué uso para Y", "cómo hago un dashboard de Z". |
| **`epa-design`** | Tiene los tokens, componentes y guías de copy del design system de EPA: paleta `#003AD6`, tipografía IBM Plex, copy en español sentence-case, separadores correctos. | Cuando construyes UI, escribes CSS/Tailwind/JSX, haces un slide o un landing. |
| **`epa-cicd`** | Te entrega templates listos para subir tu app a Cloud Run usando GitHub Actions, con guía paso a paso. | Cuando dices "deploy", "subir a producción", "Cloud Run", "CI/CD". |

Todos son **skills auto-invocados**: no tienes que escribir `/epa-naming` ni
nada parecido. Claude detecta el contexto y los activa solo. Tu trabajo es
solo tenerlos instalados.

---

## Instalación — la guía sin asumir nada

> **Audiencia:** cualquier persona en EPA que use Claude Code, aunque nunca
> haya abierto una terminal.

### 1. Asegúrate de tener Claude Code

Si todavía no lo tienes, instálalo desde [claude.com/code](https://claude.com/code).
Versión mínima recomendada: 2024-10 o superior (para soporte de plugins).

### 2. Abre la terminal

- **Mac:** Presiona `Cmd + Espacio`, escribe `Terminal` y presiona Enter.
- **Windows:** Presiona la tecla Windows, escribe `PowerShell` y presiona Enter.
- **Dentro de VS Code o Cursor:** menú `Terminal` → `New Terminal`.

Vas a ver un cursor parpadeando. Ahí pegas los comandos uno por uno.

### 3. (Opcional pero recomendado) Verifica que `claude` está instalado

Pega esto y presiona Enter:

```bash
claude --version
```

Si te muestra una versión (ej. `claude-code 1.x.x`), todo bien. Si dice
`command not found`, regresa al paso 1 e instala Claude Code.

### 4. Agrega el marketplace (paso que se hace una vez por máquina)

```bash
claude plugin marketplace add EPA-Digital/claude-plugins
```

Esto le dice a tu Claude Code: "el catálogo oficial de EPA está en este repo
de GitHub". A partir de aquí puedes instalar cualquiera de nuestros plugins.

### 5. Instala los 5 plugins

Pégalos uno por uno (o todos juntos en un mismo bloque — funciona igual):

```bash
claude plugin install epa-naming@epa-plugins
claude plugin install epa-safe-vibe@epa-plugins
claude plugin install epa-stack@epa-plugins
claude plugin install epa-design@epa-plugins
claude plugin install epa-cicd@epa-plugins
```

Cada uno tarda 2–5 segundos. Listo.

### 6. Verifica que todo quedó instalado

```bash
claude plugin marketplace list
```

Deberías ver `epa-plugins` en la lista. Para confirmar plugins activos abre
Claude Code y escribe `/plugin` — verás los 5 con check verde.

---

## Instalación a nivel de **usuario** vs a nivel de **proyecto**

Los pasos anteriores instalan los plugins a nivel **usuario** (default), que
es lo recomendado: así los tienes en cualquier proyecto donde abras Claude
Code, sin volver a configurar nada.

| Scope | Comando | Cuándo usarlo |
|---|---|---|
| **Usuario (default — recomendado)** | `claude plugin marketplace add EPA-Digital/claude-plugins` | Tu máquina personal. Aplica a todos los repos en los que trabajas. |
| **Proyecto** | `claude plugin marketplace add EPA-Digital/claude-plugins --scope project` | Solo cuando un repo específico debe traer los plugins consigo (ya configurado en algunos repos EPA via `.claude/settings.json`). |
| **Local** | `claude plugin marketplace add EPA-Digital/claude-plugins --scope local` | Pruebas puntuales. Se borra al cerrar la sesión. |

> **Atajo para repos EPA:** Algunos repos de la agencia ya incluyen un
> `.claude/settings.json` con los plugins preconfigurados. Cuando abres Claude
> Code y confías en el folder, te aparece un prompt automático preguntando si
> quieres instalar el marketplace de EPA. Dile que sí y todo queda listo.

---

## Cómo usarlos en el día a día

Una vez instalados, **no hay nada que invocar manualmente**. Claude Code
activa el skill correcto según lo que estés haciendo. Algunos ejemplos:

| Lo que escribes en Claude Code | Plugin que se activa | Qué pasa |
|---|---|---|
| "Voy a crear una colección de Firestore para Coppel" | `epa-naming` | Te propone `CoppelCampaigns` siguiendo la convención `{Cliente}{Entidad}`. |
| "Borra esta colección de Firestore" | `epa-safe-vibe` | Te detiene, te pregunta exactamente qué vas a borrar y verifica si está protegida. |
| Pegas `api_key = "AIza..."` en tu código | `epa-safe-vibe` | BLOQUEA. Te muestra cómo obtenerlo desde Secret Manager. |
| "Necesito un dashboard de campañas para Innovasport" | `epa-stack` + `epa-design` | Te arma scaffolding Next.js + Tailwind con tokens EPA correctos. |
| "Cómo subo este servicio a producción" | `epa-cicd` | Te genera el `.github/workflows/deploy.yml` y te guía por los prerequisitos. |
| "Cómo me conecto a la API de Meta para traer las campañas de Nestlé" | `epa-safe-vibe` + `epa-stack` | BLOQUEA acceso directo a Meta. Te redirige a Pitágoras con código listo. |
| "Hazme un componente de tabla con los KPIs del cliente" | `epa-design` | Usa IBM Plex, hairlines 0.5px, números en mono, copy en español sentence case. |
| "Quiero hacer un ETL de datos de Google Ads para Chedraui" | `epa-stack` | Te propone Cloud Run job + Cloud Scheduler + flujo Pitágoras → BQ. |

No tienes que recordarte de invocarlos. Tu trabajo es escribir como
escribirías normalmente; los plugins hacen lo suyo.

---

## Mantenerlos actualizados

Cuando publiquemos versión nueva (cambios en convenciones, nuevas referencias,
fixes), corres:

```bash
claude plugin marketplace update epa-plugins
```

Eso refresca el catálogo. Los plugins individuales se actualizan
automáticamente al iniciar Claude Code la próxima vez.

---

## Estructura del repo (para referencia)

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json          ← catálogo del marketplace
├── .claude/
│   └── settings.json             ← auto-instalación cuando se confía en el folder
├── CLAUDE.md                     ← contexto maestro de epa-turing
├── README.md                     ← este archivo
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

## Métodos alternativos de instalación

Si por alguna razón no puedes usar la CLI, aquí van otras dos vías.

### Opción B — Desde dentro de Claude Code

Abre Claude Code en cualquier folder y escribe estos comandos uno por uno
(con la barra `/` al inicio):

```
/plugin marketplace add EPA-Digital/claude-plugins
/plugin install epa-naming@epa-plugins
/plugin install epa-safe-vibe@epa-plugins
/plugin install epa-stack@epa-plugins
/plugin install epa-design@epa-plugins
/plugin install epa-cicd@epa-plugins
```

### Opción C — Auto-instalación desde un repo EPA

Si tu repo ya incluye este `.claude/settings.json`, al abrir Claude Code te
pregunta si quieres instalarlo:

```json
{
  "extraKnownMarketplaces": {
    "epa-plugins": {
      "source": { "source": "github", "repo": "EPA-Digital/claude-plugins" }
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

---

## Validación local (solo si vas a contribuir)

Para verificar que un cambio al repo no rompe el marketplace:

```bash
claude plugin validate .
```

Debe responder `✔ Validation passed`. Si no, corrige y vuelve a correr.

---

## Soporte y reporte de problemas

| Situación | Qué hacer |
|---|---|
| Un plugin no se activa cuando esperarías | Abre un issue en este repo describiendo el prompt y qué activación esperabas. |
| Un plugin bloquea cosas que no debería | Mismo flujo — issue con el caso. |
| Quieres proponer un nuevo plugin EPA | Escribe al área de Datos e IA: `datos@epa.digital`. |
| Cambios al stack canónico, naming o seguridad | PR a este repo, con un breve "Why" explicando el cambio. |

---

## Licencia y mantenimiento

```
Licencia:  MIT
Owner:     EPA Digital — Área de Datos e IA
Contacto:  datos@epa.digital
```
