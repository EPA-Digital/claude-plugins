# EPA Digital — Plugin de Dashboards para Claude Code

Este repositorio le enseña a tu Claude Code cómo construir dashboards para
EPA Digital, siguiendo las reglas de la agencia: qué stack usar, de dónde
salen los datos, cómo se ve el diseño, y cómo se sube a producción sin
romper nada.

Instalas **un solo plugin**. Después, cuando le pidas a Claude que te ayude
con un dashboard, él ya sabe cómo hacerlo bien — sin que tengas que
explicárselo cada vez.

---

## ⚠️ ¿Ya tenías instalados los plugins viejos?

Si en algún momento instalaste `epa-naming`, `epa-safe-vibe`, `epa-stack`,
`epa-design` o `epa-cicd`, quítalos — ya no existen en este repo y pueden
darte instrucciones desactualizadas. Pega esto en tu terminal:

```bash
claude plugin uninstall epa-naming@epa-plugins
claude plugin uninstall epa-safe-vibe@epa-plugins
claude plugin uninstall epa-stack@epa-plugins
claude plugin uninstall epa-design@epa-plugins
claude plugin uninstall epa-cicd@epa-plugins
claude plugin install epa-dashboards@epa-plugins
```

Si nunca los instalaste, ignora esta sección y sigue con la instalación
normal de abajo.

---

## ¿Ya tienes un dashboard empezado con otro stack?

Si ya escribiste código — con `npm` en vez de `pnpm`, otra librería de
charts, queries directo a otra API, lo que sea — **no lo reescribas a
mano ni empieces de cero**. Instala el plugin (sección de abajo) y luego
corre, dentro de ese proyecto:

```
/migrate-to-epa
```

Te dice qué corrigió solo, qué necesita tu confirmación, y qué queda
pendiente. Es exactamente para este caso.

Si tu dashboard todavía no existe, ignora esto y sigue con la instalación.

---

## Instalación — paso a paso, sin asumir nada

**Audiencia:** cualquier persona en EPA, aunque nunca hayas abierto una
terminal.

### 1. Instala Claude Code

Si no lo tienes, descárgalo de [claude.com/code](https://claude.com/code).

### 2. Abre la terminal

- **Mac:** `Cmd + Espacio`, escribe `Terminal`, Enter.
- **Windows:** tecla Windows, escribe `PowerShell`, Enter.
- **Si usas VS Code o Cursor:** menú `Terminal` → `New Terminal`.

Se abre una ventana con un cursor parpadeando. Ahí vas a pegar comandos.

### 3. Inicia sesión con tu cuenta de EPA

```bash
claude
```

Se abre el navegador para que inicies sesión.

> ⚠️ **Usa tu cuenta `@epa.digital`**, no tu Gmail personal. Con la cuenta
> personal no vas a poder instalar nada de esto.

Cuando termines de iniciar sesión, sal con `/quit` o `Ctrl+D` y vuelve a la
terminal.

### 4. Dile a Claude Code dónde está el plugin de EPA

Un **"marketplace"** es solo el catálogo de dónde vienen los plugins.
Este comando le dice a Claude Code: "el catálogo de EPA está en este repo
de GitHub" — lo haces una sola vez, en cualquier máquina:

```bash
claude plugin marketplace add EPA-Digital/claude-plugins
```

### 5. Instala el plugin

```bash
claude plugin install epa-dashboards@epa-plugins
```

Tarda unos segundos. Listo.

### 6. Verifica que quedó instalado

Abre Claude Code y escribe `/plugin`. Deberías ver `epa-dashboards` con un
check verde.

> **¿Prefieres el checklist completo?** `docs/onboarding-vibecoding.md`
> incluye también los pasos que tramita el equipo de IT antes de este
> punto (acceso a BigQuery, alta en el grupo del equipo).

---

## ¿Qué trae el plugin?

Una vez instalado, no tienes que invocar nada a mano — Claude detecta lo
que estás haciendo y usa la parte correcta del plugin sola.

| Parte | Qué hace | Cuándo se activa |
|---|---|---|
| **Stack de frontend** | Next.js, pnpm, TypeScript, Tailwind — el stack completo y cerrado, sin que tengas que decidir nada | Cuando construyes o modificas un dashboard |
| **Backend en Go** | El servicio que de verdad consulta BigQuery — uno por dashboard, corre junto al frontend sin que tengas que desplegarlo aparte | Cuando el dashboard necesita datos reales de un cliente |
| **Datos de BigQuery** | Sabe qué tablas usar por cliente, cómo escribir queries que no te cuesten dinero de más, cuándo un dato no está en el reporting normal y hay que ir al ETL centralizado, y de dónde sale el módulo de presupuestos/pacing (ver "Repos hermanos" más abajo) | Cuando escribes SQL o pides datos de un cliente |
| **Design system** | Componentes y tokens salen de `epa-ui` (la librería real de EPA), no se hacen a mano — tipografía, colores y espaciado ya vienen resueltos | Cuando construyes cualquier pantalla |
| **Deploy** | Te guía para subir el dashboard a producción (frontend y backend juntos) | Cuando dices "deploy" o "cómo subo esto" |
| **Seguridad** | Te detiene si vas a hacer algo riesgoso (borrar algo, pegar una contraseña en el código) | Automático, todo el tiempo |
| **Revisión de seguridad** | Un agente aparte revisa el código en busca de vulnerabilidades antes de darlo por bueno | Cuando pides una revisión de seguridad o antes de un deploy importante |

Y 4 comandos que sí escribes tú, cuando los necesitas:

| Comando | Para qué |
|---|---|
| `/plan-dashboard {cliente}` | Antes de empezar: te ayuda a planear el dashboard antes de escribir código |
| `/client-context {cliente}` | Revisa qué datos reales existen de ese cliente en BigQuery |
| `/critique-epa` | Revisa que tu dashboard cumpla el diseño oficial de EPA |
| `/migrate-to-epa` | Si ya empezaste tu dashboard con otro stack, lo homologa al estándar EPA |

---

## Cómo se usa en el día a día

```
Tú escribes:                              Claude hace:
──────────────────────────────────────    ────────────────────────────────
"Quiero un dashboard de campañas          Te pregunta lo necesario y te
para Innovasport"                         arma el proyecto con el stack
                                           correcto — sin que tengas que
                                           decidir Next.js, pnpm, etc.

Pegas api_key = "AIza..." en tu código    BLOQUEA. Te muestra cómo
                                           guardarlo correctamente.

"Dame las ventas por campaña de           Sabe qué tabla de BigQuery usar,
Google Ads de Chedraui"                   castea los tipos correctos, y
                                           nunca te deja hacer una query sin
                                           límite que te cueste dinero.

"Cómo subo este dashboard a               Te genera el archivo de deploy
producción"                               automático y te guía paso a paso.
```

Solo escribe como escribirías normalmente. El plugin hace lo suyo.

---

## Estructura del repo (para referencia)

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json          ← catálogo del plugin
├── .claude/
│   └── settings.json             ← auto-instalación al confiar en el folder
├── CLAUDE.md                     ← contexto maestro
├── README.md                     ← este archivo
├── docs/
│   └── onboarding-vibecoding.md  ← checklist completo de Día 0
└── plugins/
    └── epa-dashboards/
        ├── .claude-plugin/plugin.json
        ├── hooks/                         ← guardrail de deploy (automático)
        ├── commands/
        │   ├── plan-dashboard.md
        │   ├── client-context.md
        │   ├── critique-epa.md
        │   └── migrate-to-epa.md
        ├── agents/
        │   └── security-reviewer.md
        └── skills/
            ├── epa-frontend/
            ├── epa-backend/
            ├── epa-bq/
            ├── epa-design/
            ├── epa-deploy/
            └── epa-safe-vibe/
```

---

## Repos hermanos

Este repo es el plugin. Los repos de abajo, de la organización `epa-datos`,
son lo que ese plugin lee y consume — no necesitas instalar nada de ahí,
Claude los lee cuando hacen falta.

| Repo | Qué es | Owner |
|---|---|---|
| `epa-datos/epa-ui` | Librería de componentes de producto, publicada en npm como `@epa-datos/ui` — de ahí sale la UI real de un dashboard | iescutia |
| `epa-datos/epa-etl` | ETL centralizado (`pitagoras-etl`) — detalle abajo | AxelRuiz123 |
| `epa-datos/budgets-auditor` | Apodo interno: **"Deming"**. Recalcula presupuesto/pacing/ROAS a diario — detalle abajo | Eddye-Mx |

### `epa-etl` (`pitagoras-etl`) — cuándo entra en juego un dashboard

Un dashboard **nunca llama a Pitágoras directo** (ni su API ni su MCP,
deprecado). El único consumidor autorizado de Pitágoras es este ETL
centralizado, que llena tablas `bdd-epa-digital.{cliente}_etl.*` cuando un
dato de medios que necesitas **no** está en `{cliente}_reporting`.

```
¿El dato ya está en {cliente}_reporting?
  Sí  → úsalo directo, es la fuente de verdad (ver skill epa-bq).
  No  → puede que ya exista en {cliente}_etl, o haga falta un config nuevo.
        Ya no depende de esperar a Datos e IA: desde el 2026-09-02
        cualquier persona de EPA puede autorar un config con su propio
        gcloud.
```

**Estado real:** las fases 4-6 del ETL están construidas y desplegadas,
con producción real desde el 2026-08-31. Que un config exista y ya tenga
datos **no** significa que su tabla sea confiable todavía — el criterio es
3 días corriendo sin fallar, y se verifica caso por caso, nunca se asume
por la antigüedad del config.

Detalle completo — cómo leer sus tablas sin corromper cifras, cómo autorar
un config nuevo: `epa-bq/references/etl-tables.md` y `etl-config.md`
(dentro del skill `epa-bq` de este mismo repo).

### `budgets-auditor` ("Deming") — el módulo de presupuestos/pacing

Un dashboard **nunca llama a `budgets-auditor` ni a su servicio hermano
`budget-alerts`** — corren diario contra Firestore, y ese Firestore está
protegido (bloqueo total). Lo que un dashboard sí puede leer es la copia
en BigQuery que ese servicio va llenando: `bdd-epa-digital.dw_epa_digital`
(tablas `bu_budget_performance`, `bu_budgets`, `bu_spend`, `cl_clients`).

> ⚠️ **Antes de prometer este módulo, verifica que el dato esté vivo.**
> Medido al integrar esto (2026-09-17): la sincronización a BigQuery lleva
> meses congelada. La query para comprobarlo y qué hacer si sigue
> congelada: `epa-bq/references/budgets-deming.md` (dentro del skill
> `epa-bq` de este mismo repo) — es lectura obligatoria antes de construir
> este módulo, no un detalle opcional.

`deming-mcp` es un repo aparte, todavía en desarrollo, para que un humano
cargue presupuestos *planeados* desde Sheets vía Claude — no es algo que
un dashboard use.

---

## Otras formas de instalar

Si por alguna razón no puedes usar los comandos de arriba:

**Desde dentro de Claude Code** (con la barra `/` al inicio):
```
/plugin marketplace add EPA-Digital/claude-plugins
/plugin install epa-dashboards@epa-plugins
```

**Auto-instalación en un repo de dashboard:** si tu repo ya trae este
`.claude/settings.json`, Claude Code te pregunta si quieres instalarlo al
abrirlo — dile que sí:
```json
{
  "extraKnownMarketplaces": {
    "epa-plugins": {
      "source": { "source": "github", "repo": "EPA-Digital/claude-plugins" }
    }
  },
  "enabledPlugins": {
    "epa-dashboards@epa-plugins": true
  }
}
```

---

## Validación local (solo si vas a contribuir a este repo)

```bash
claude plugin validate .
```

Debe responder `✔ Validation passed`. Si no, corrige y vuelve a correr.

---

## Soporte y reporte de problemas

| Situación | Qué hacer |
|---|---|
| El plugin no se activa cuando esperarías | Abre un issue en este repo describiendo qué le pediste a Claude y qué esperabas |
| El plugin bloquea algo que no debería | Mismo flujo — issue con el caso |
| Cambios a las reglas del plugin | PR a este repo con un breve "por qué" |

---

## Licencia y mantenimiento

```
Licencia:  MIT
Owner:     EPA Digital — Área de Datos e IA
Contacto:  datos@epa.digital
```
