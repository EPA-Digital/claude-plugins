---
name: epa-frontend
description: >
  Stack definitivo de frontend para dashboards vibecodeados en EPA.
  Activar cuando el usuario construye, modifica o inicia un dashboard,
  menciona Next.js, componentes, charts, tablas de datos, o pregunta
  "qué uso para" algo de frontend. También cuando escribe package.json,
  tsconfig, eslint o instala dependencias en un proyecto de dashboard.
---

# EPA Frontend — Stack de Dashboards

El stack cerrado para todo dashboard vibecodeado en EPA: gestor de
paquetes, config exacta de TypeScript, de dónde salen los componentes y
los charts, y cómo se accede a datos. Trabaja junto a `epa-design` (tokens,
copy, componentes) y `epa-bq` (datos).

---

## Regla 1 — Stack cerrado, sin alternativas

```
Runtime          Node 22 LTS (.nvmrc)
Paquetes         pnpm — NUNCA npm, yarn ni bun (ver anti-stack.md)
Framework        Next.js 16 · App Router · src/ · Turbopack · alias @/*
Lenguaje         TypeScript estricto (regla 2)
Estilos          Tailwind v4 con tokens EPA — cero CSS custom
Validación       Zod en todos los boundaries (respuestas del backend Go,
                 params de URL, configs)
Datos            TanStack Query
Filtros/URL      nuqs
Formateo         Prettier + prettier-plugin-tailwindcss
Testing          Vitest + Testing Library (smoke: cada página renderiza sin
                 crash) — nada más profundo; eso se prueba una vez en el kit
CI               pnpm typecheck && pnpm lint && pnpm build — gate de deploy,
                 sin excepciones (ver epa-deploy)
```

Detalle y racional completo en `references/stack.md`. Bloques copiables
exactos (`tsconfig.json`, `eslint.config.mjs`, `package.json`, `.npmrc`,
`.nvmrc`) en `references/tsconfig-eslint.md`.

---

## Regla 2 — TypeScript

Copiar la config de `references/tsconfig-eslint.md` tal cual — no
reinventarla por proyecto.

- `any` está **prohibido por lint** (error, no warning).
- `@ts-ignore` está **prohibido**.
- `@ts-expect-error` solo se permite con una descripción escrita
  justificando por qué.

---

## Regla 3 — Componentes: siempre de `epa-ui`, nunca hechos a mano

Las primitivas de UI vienen del paquete de npm **`@epa-datos/ui`**
(`epa-datos/epa-ui`, owner `iescutia`), sobre **Base UI**, no Radix:
`pnpm add @epa-datos/ui`. No hay registry de shadcn — el paquete de npm es
la vía de distribución real. Detalle completo, mapa intención→componente, y
las variantes semánticas reales (`success`/`warning`/`info`):
`epa-design/references/epa-ui.md`.

**NUNCA** crear un botón, card, dialog o cualquier primitiva desde cero, ni
copiarla de internet o de otro proyecto. Si el componente que necesitas no
existe en `epa-ui`, avísale al usuario para que lo solicite a `@iescutia` —
no lo improvises.

---

## Regla 4 — Charts

Los charts se construyen con **`ChartContainer` + `ChartConfig`** de
`epa-ui` (`components/ui/chart.tsx`) — las primitivas de Recharts sí se
importan directo, pero solo dentro de ese contrato, nunca un SVG a mano.
Reglas obligatorias, sin excepción:

1. **Título + subtítulo siempre.** Un chart sin título no comunica nada.
2. **Comparación de periodo** como línea punteada gris cuando aplique
   (periodo anterior, YoY, edición anterior).
3. **Colores por canal desde `--chart-1`…`--chart-10` de `epa-ui` — nunca
   hex inline, nunca un nombre de clase templado (`bg-chart-${n}`).**
4. **Máximo 6 series.** Agrupar el resto en "Otros".
5. **Números formateados** (`$42.33M`, `1.29%`, `10.10x`) con **IBM Plex
   Mono**.
6. **Botón "Ver tabla"** en los charts de los módulos principales.

**El mapa canal→color ya existe**: las claves de canal
(`google-ads, meta, tiktok, dv360, bing, organic, direct, email, otros`)
se asignan a `--chart-1..10` de `epa-ui`, consistentes dentro del mismo
dashboard — ver `epa-design/references/epa-ui.md`. Ya no está bloqueado
esperando `@epa/tokens`.

Si lo que se necesita no es una serie de tiempo simple — un heatmap
hora×día, un funnel de conversión con drop-off por etapa, o KPI cards que
también filtran series — `epa-ui` ya trae esos widgets en
`components/epa/*`, no se arman a mano sobre `ChartContainer`. Ver la
sección "Widgets compuestos" de `epa-design/references/epa-ui.md`.

---

## Regla 5 — Datos

El frontend **no tiene cliente de BigQuery**. Todo dato sale del backend Go
(contenedor `api`, sidecar en `localhost:8081` — ver `epa-backend`) vía un
route handler que hace `fetch` a `EPA_API_BASE_URL`, reenvía filtros y
valida la respuesta con **Zod**. El route handler es un proxy delgado: no
arma SQL, no decide agregaciones, solo tipa y valida.

- **Nunca** `@google-cloud/bigquery` (ni ningún otro cliente de BQ) en
  `apps/web` — es el único control que compensa que `web` y `api` comparten
  service account (ver `epa-backend/references/sidecar.md`). Es un hallazgo
  **crítico** de `security-reviewer`, no un detalle de estilo.
- **Nunca** `fetch` del navegador directo a `localhost:8081` — no existe
  fuera de la instancia de Cloud Run; solo el route handler (server-side) lo
  alcanza.
- Nunca SQL por concatenación de strings en ningún runtime — ver `epa-bq` y
  el agente `security-reviewer`.

---

## Regla 6 — El backend vive en `apps/api`, no aquí

Un dashboard es un monorepo: `apps/web` (este proyecto) + `apps/api` (Go,
fork de `epa-standards-backend`), desplegados juntos como un solo servicio
de Cloud Run con dos contenedores. El backend **no se construye desde esta
skill** — su arquitectura, su capa de BigQuery y su despliegue viven en
`epa-backend`.

Lo que sigue sin construirse en ninguno de los dos contenedores: un job
programado, un ETL, un pipeline de ingesta, o un **segundo servicio** de
Cloud Run. Si el proyecto parece necesitar algo de eso: **detente** y dile
al usuario que se escala al equipo de datos (`datos@epa.digital`) — no lo
construyas tú.

---

## Regla 7 — `AGENTS.md` obligatorio

Todo proyecto de dashboard debe tener `AGENTS.md` en la raíz, con
`CLAUDE.md` como symlink a él (Claude Code lee `CLAUDE.md`; otros agentes
leen `AGENTS.md`; un solo archivo que mantener). Si no existe, ofrecer
crearlo con esta plantilla:

```markdown
# AGENTS.md — {nombre del dashboard}

Dashboard de EPA Digital para {cliente}. Aplican todas las reglas del
[contexto organizacional EPA](https://github.com/EPA-Digital/claude-plugins)
y del plugin `epa-dashboards`.

## Reglas del proyecto

- Este es un monorepo: `apps/web` (Next.js, este código) + `apps/api` (Go,
  fork de `epa-standards-backend`). Un solo servicio de Cloud Run con dos
  contenedores — ver `epa-backend`.
- `apps/web` **no tiene cliente de BigQuery.** Los datos salen de route
  handlers que hacen `fetch` a `EPA_API_BASE_URL` (el sidecar `api` en
  `localhost:8081`) con queries parametrizadas del lado Go, y se validan con
  Zod al llegar — nunca fetch directo a BQ ni a APIs de medios/Pitágoras
  desde el cliente, ni desde `apps/web` tampoco.
- Los charts van con `ChartContainer` (`epa-ui`) + las convenciones de
  `epa-frontend` (título/subtítulo, colores por canal desde `--chart-N`,
  máx. 6 series) — nunca CSS custom ni SVG a mano.
- Las primitivas de UI vienen de `@epa-datos/ui@{version}` (npm), pin
  exacto en `package.json` — nunca hechas a mano. Subir esa versión es un
  cambio deliberado (`npm update` + revisar el release), no algo que pase
  por accidente.
- Sin login propio — el acceso se restringe en capa de plataforma (ver
  `references/auth.md`). No improvisar Firebase/NextAuth/tabla de usuarios.
- Si el proyecto parece necesitar un ETL, un job programado o un segundo
  servicio de Cloud Run, escalar a datos@epa.digital — no construirlo aquí.

## Comandos

\`\`\`
pnpm dev         # desarrollo local
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint .
pnpm build       # build de producción
\`\`\`

## Datos

Dataset: `bdd-epa-digital.{cliente}_reporting` (resolver el nombre exacto
por lookup, ver `epa-bq`). Contexto real del cliente:
`docs/client-context.md` (generado con `/client-context {cliente}`).

## Referencias

Todo vive en el plugin `epa-dashboards` — 6 skills (`epa-frontend`,
`epa-backend`, `epa-bq`, `epa-design`, `epa-deploy`, `epa-safe-vibe`), 4
comandos (`/plan-dashboard`, `/client-context`, `/critique-epa`,
`/migrate-to-epa`) y el agente `security-reviewer`. Se activan solos según
el contexto — no hace falta invocarlos por nombre salvo los comandos.
```

---

## Regla 8 — Auth

Hoy ningún dashboard tiene login propio. El acceso se restringe en capa de
plataforma (proxy autenticado / IAM invoker), no en la app — ver
`references/auth.md` antes de escribir cualquier lógica de sesión. Si el
proyecto necesita login de cliente final ahora, escalar a
`datos@epa.digital`, no improvisar.
