# Stack de frontend — dashboards vibecoding EPA

Fuente: documento interno "Stack de Frontend — Dashboards Vibecoding EPA" v1.0
(agosto 2026, Owner: José Carlos Corona). Volcado con adaptaciones mínimas de
formato para servir como referencia de este skill.

Principio rector de todas las decisiones: **el código lo va a escribir
mayormente Claude Code y lo van a leer humanos.** Cada elección optimiza tres
cosas, en este orden: (1) que el LLM genere código correcto a la primera,
(2) que los errores se detecten en compilación/CI y no en producción,
(3) que un humano pueda auditar el resultado rápido.

---

## Estado hoy vs. estado objetivo

Este documento describe la arquitectura completa de la plataforma, incluido
el kit `@epa/*` (`epa-dashboard-kit`). El kit **no existe todavía** — es la
Etapa 2 de la plataforma de dashboards, fuera de alcance de este plugin. Las
reglas ejecutables **hoy** son las del `SKILL.md` de `epa-frontend`, no las
que mencionan `@epa/*` en las secciones 2 y 5 de abajo.

| Tema | Estado hoy (este skill, `SKILL.md`) | Estado objetivo (kit `@epa/*` como paquetes) |
|---|---|---|
| Charts | `ChartContainer`/`ChartConfig` de `epa-ui` + las 6 reglas de `epa-frontend` (título/subtítulo, comparación punteada, colores por canal vía `--chart-N`, máx. 6 series, cifras formateadas, botón "Ver tabla") | **SUPERSEDED por `epa-ui`** (ver nota abajo) — `@epa/charts` como paquete npm no existe; el artefacto real es un repo del que se copia. |
| Primitivas UI | `epa-datos/epa-ui`, copiado a commit fijado (ver `epa-design/references/epa-ui.md`) — sobre Base UI, no Radix | **SUPERSEDED por `epa-ui`** — sin registry ni paquete `@epa/ui` hoy; pedido abierto a `@iescutia`. |
| Acceso a datos | Route handlers del proyecto hacen `fetch` al backend Go (`apps/api`, sidecar), que corre las queries parametrizadas a BigQuery — ver `epa-backend` | **SUPERSEDED por la decisión de Go** (2026-08, ver nota abajo) — `@epa/data` como BFF en TypeScript ya no aplica. `useReport()` sobre TanStack Query sigue siendo válido del lado del navegador; lo que cambia es qué hay detrás: Go, no un BFF de Node. |
| Backend del dashboard | `apps/api` — backend en Go forkeado de `epa-standards-backend`, sidecar del mismo servicio de Cloud Run que `apps/web` | **SUPERSEDED** — "el BFF del template es el único backend" describía un backend en TypeScript. El equipo decidió Go por depurabilidad del equipo de datos (ver `epa-backend/SKILL.md`), no TypeScript. Los route handlers de `apps/web` **siguen existiendo** — son el proxy obligatorio hacia `apps/api`, no algo a reemplazar. |
| Creación del proyecto | Se sigue este skill a mano sobre un `create-next-app` no interactivo (ver sección 2) | `npx create-epa-dashboard {cliente}-{dashboard}` — template congelado con todo preinstalado. |

> **Input registrado durante la planeación de este plugin** (José Carlos
> Corona, consultando a Dany): *"si vamos a congelar el template, podría ir ya
> instalado [el kit]. Igual sería bueno ponerlo como paquete npm para el tema
> de las actualizaciones, entonces vivirá en este mismo repo."* Esto confirma
> la columna "estado objetivo" — el kit llega preinstalado en el template,
> distribuido como paquete npm.
>
> **✅ TODO resuelto (2026-08) — el kit no vive en `claude-plugins`.**
> `@epa/*` como paquetes npm publicados no existe, y no es lo que se
> integró: lo que existe y se integró es `epa-datos/epa-ui`, un repo propio
> del que se **copia** a commit fijado (ver `epa-ui.md`), no un paquete que
> se instale. El invariante de que `claude-plugins` no hospeda paquetes npm
> (ver `CLAUDE.md` raíz) queda intacto — la pregunta de si algún día
> publicar `@epa/*` de verdad sigue abierta y sigue siendo decisión del
> equipo, pero deja de ser una ambigüedad que bloquee este documento.

> **SUPERSEDED (2026-08) — el backend del dashboard es Go, no `@epa/data`.**
> Cuando se escribió este documento (v1.0, agosto 2026), el plan de acceso
> a datos era un BFF en TypeScript (`@epa/data`) integrado al template. El
> equipo decidió en junta que el backend real es **Go**, forkeado por
> dashboard de `epa-standards-backend`, por depurabilidad del equipo de
> datos — no por mérito técnico de Go sobre un BFF en TS (ver
> `epa-backend/SKILL.md` para el detalle completo). No se borra esta
> sección para no perder el porqué y evitar re-litigarlo.
>
> **Lo que NO cambia:** `@epa/ui`, `@epa/charts` y `@epa/tokens` (el
> trabajo de Dany) siguen enteramente del lado Next.js — no hay backend
> involucrado en ninguno de los tres. `@epa/auth` sobrevive **parcial**: la
> verificación del JWT que IAP inyecta sigue pasando en `apps/web` (es
> quien recibe el request del navegador); lo que se mueve es el row
> filtering — antes se imaginaba dentro del BFF de `@epa/data`, ahora vive
> en el service de `apps/api` (Go), porque es ahí donde se construye la
> query. Si `@epa/auth` llega a existir, su contrato de `getUser()` no
> cambia — lo que cambia es qué hace `apps/web` con esa identidad después
> de obtenerla (propagarla a `apps/api`, no filtrar ella misma).

> **SUPERSEDED (2026-08) — `@epa/ui`, `@epa/charts` y `@epa/tokens` como
> paquetes npm de Dany, por `epa-ui`.** Este documento (v1.0) imaginaba tres
> paquetes publicados y compilados. Lo que se integró es
> `epa-datos/epa-ui`: un repo real, ya con 61 componentes sobre Base UI, que
> se copia a commit fijado en vez de instalarse — ver
> `epa-design/references/epa-ui.md` para el detalle completo (Base UI no
> Radix, `ChartContainer`/`ChartConfig` como el `@epa/charts` que ya
> resuelve la paleta categórica vía `--chart-1..10`, y la regla provisional
> de estado semántico mientras `success`/`warning`/`info` no existan como
> variante). No se borra esta nota por el mismo motivo que las de arriba —
> conserva el porqué de lo que se había planeado.

---

## 1. Gestor de paquetes: **pnpm** ✅ (vigente hoy)

| Opción | Veredicto | Por qué |
|---|---|---|
| **pnpm** | **Elegido** | (a) `node_modules` estricto: solo se puede importar lo declarado en `package.json`. npm/yarn clásico "aplanan" dependencias y permiten *phantom dependencies* — Claude Code importa un paquete que funciona en dev y explota en CI. Con pnpm ese error es imposible por estructura. (b) Workspaces de primera clase — el kit (`epa-dashboard-kit`) ya es pnpm + Turborepo; un solo gestor en toda la plataforma. (c) Store global content-addressable: installs 2-3x más rápidos y menos disco en CI. |
| npm | ❌ | Lento, hoisting permisivo (phantom deps), sin ventaja alguna sobre pnpm. |
| yarn (berry/PnP) | ❌ | PnP rompe tooling con frecuencia (editores, algunas libs); yarn classic está en mantenimiento. Fricción sin retorno. |
| bun | ❌ por ahora | Velocidad excelente, pero: compatibilidad incompleta con el ecosistema Next.js/CI, menos training data (Claude Code genera menos patrones bun-idiomáticos), y madurez de lockfile/workspaces por debajo de pnpm. Re-evaluar en 12 meses; hoy el riesgo no paga. |

**Enforcement (no es sugerencia, es candado):**
```jsonc
// package.json
"packageManager": "pnpm@10.14.0",       // corepack lo fuerza
"engines": { "node": ">=22.0.0", "pnpm": ">=10" }
```
```
# .npmrc
engine-strict=true
```
Node **22 LTS** fijado en `.nvmrc` y en la imagen de CI. Usar `npm install` en el repo → error, no warning.

---

## 2. Creación del proyecto: **template determinista, NO instalación interactiva** ⚠️

> Nota: `create-epa-dashboard` (Etapa 3 de la plataforma) **no existe
> todavía** — fuera de alcance de este plugin. Hasta que exista, cada
> dashboard nuevo se arranca a mano siguiendo las reglas de `SKILL.md`
> (stack cerrado, `tsconfig-eslint.md`, `AGENTS.md`), no con este comando.
> La sección de abajo describe el racional y el estado objetivo.

La instalación interactiva de Next.js (`create-next-app` respondiendo
prompts) es la herramienta correcta **una sola vez** — para definir los
valores dorados. Pero cada dashboard nuevo debería generarse desde un
**template congelado** (`create-epa-dashboard`), sin prompts.

Razones:
1. **Determinismo:** dos personas respondiendo el wizard producen dos
   proyectos distintos. La replicabilidad — el objetivo #1 de la
   plataforma — muere ahí.
2. **El wizard no configura lo nuestro:** no instala `@epa/*`, no configura
   IAP, no trae `datasources.ts`, no escribe `AGENTS.md`. El template sí.
3. **Vibecoders no deben tomar decisiones de setup.** Cada prompt del wizard
   es una decisión que ya se tomó por ellos.

**Valores dorados** (equivalen a responder el wizard así, hoy a mano):
TypeScript ✅ · ESLint ✅ · Tailwind ✅ · `src/` directory ✅ · App Router ✅ ·
Turbopack ✅ · import alias `@/*` ✅

---

## 3. TypeScript: estricto y con candados extra ✅ (vigente hoy)

`strict: true` es la base, no el techo. Config exacta en `tsconfig-eslint.md`.

**Por qué tanto candado:** el modo de falla típico de código generado es
"compila pero miente" — un `any` que se propaga, un índice sin verificar, un
`@ts-ignore` que tapa el síntoma. Cada regla convierte una clase de bug
silencioso en un error de CI que Claude Code lee y corrige solo. El costo
(fricción al escribir) lo paga el LLM, no el humano — es la economía
correcta.

**Gate de CI (epa-deploy):** `pnpm typecheck && pnpm lint && pnpm build` — los
tres verdes o no hay deploy. Sin excepciones ni flags de skip.

---

## 4. Defaults recomendados: validados, con dos precisiones ✅ (vigente hoy)

| Recomendación original | Veredicto | Precisión |
|---|---|---|
| TypeScript | ✅ | Con la config de la sección 3, no el default de create-next-app. |
| ESLint | ✅ | Flat config + `typescript-eslint` strict-type-checked + reglas EPA. El default de Next.js solo trae `next/core-web-vitals` — insuficiente. |
| Tailwind CSS | ✅ | v4 con `@theme` alimentado por tokens epa-design. **Regla dura: cero CSS custom en dashboards** — si una clase no sale de tokens, no existe. |
| App Router | ✅ | Una unidad deployable con backend seguro integrado (route handlers + middleware de auth). |
| AGENTS.md | ✅ buena adición | Es el estándar emergente multi-agente. En el proyecto: `AGENTS.md` como fuente de verdad y `CLAUDE.md` → symlink a él (Claude Code lee CLAUDE.md; otros agentes leen AGENTS.md; un solo archivo que mantener). Contenido: reglas del proyecto ("los datos salen de route handlers propios, nunca fetch directo a BQ desde el cliente", "los charts van con Recharts + convenciones de `epa-frontend`, no CSS custom"), comandos (`pnpm dev/lint/typecheck`), y punteros a los skills EPA. |

**Complementos:**

| Pieza | Decisión | Por qué |
|---|---|---|
| Formateo | Prettier + `prettier-plugin-tailwindcss` | Orden canónico de clases Tailwind = diffs limpios y reviews rápidas. Biome se evaluó (más rápido) pero su ecosistema de plugins aún no cubre el sort de Tailwind v4 igual de bien y tiene menos training data. |
| Validación runtime | Zod en todos los boundaries | TS solo protege en compile time. Todo lo que cruza una frontera (respuestas de route handlers, params de URL, configs) se parsea con schema. |
| Estado de filtros | nuqs (URL state) | Dashboards compartibles por link con filtros incluidos. |
| Data fetching | TanStack Query | El vibecoder usa queries declarativas, nunca `fetch` sin cache/estado de carga resuelto. |
| Testing | Vitest + Testing Library (smoke tests) + Playwright solo en el kit | En dashboards: mínimo viable (render sin crash de cada página). La calidad visual/funcional profunda se prueba una vez en el kit, no N veces en cada dashboard. |

---

## 5. El stack completo en una tabla (referencia rápida — vigente hoy)

> Esta tabla describía el estado **objetivo** con paquetes `@epa/*`
> publicados. Ese objetivo llegó, pero no en la forma que se había
> planeado: `epa-ui` (repo, copiado a commit fijado) en vez de `@epa/ui` /
> `@epa/charts` / `@epa/tokens` (paquetes npm). El resto de la tabla ya
> reflejaba lo vigente hoy.

```
Runtime          Node 22 LTS (pinned)
Paquetes         pnpm 10 (corepack, engine-strict)
Framework        Next.js 15 · App Router · src/ · Turbopack
Lenguaje         TypeScript estricto (sección 3) — any prohibido por lint
Estilos          Tailwind v4 + tokens OKLCH de epa-ui — cero CSS custom
UI               epa-ui (Base UI, no Radix), copiado a commit fijado —
                 ver epa-design/references/epa-ui.md
Charts           ChartContainer/ChartConfig de epa-ui — Recharts se importa
                 directo, pero solo dentro de ese contrato, nunca SVG a mano
Backend          Go + gin, forkeado por dashboard de epa-standards-backend,
                 sidecar del mismo servicio — ver epa-backend (SUPERSEDE a
                 @epa/data como BFF, ver nota de arriba)
Datos            TanStack Query en el navegador + Zod en el route handler
                 que hace fetch al backend Go
Filtros/URL      nuqs
Auth             @epa/auth (verificación JWT de IAP + getUser, en apps/web)
                 — row filters se aplican en apps/api, no en @epa/auth
Formateo         Prettier + prettier-plugin-tailwindcss
Lint             ESLint flat + typescript-eslint strict-type-checked + reglas EPA
Testing          Vitest + RTL (smoke) · Playwright en el kit
Instrucciones    AGENTS.md (CLAUDE.md symlink)
CI               epa-deploy: typecheck + lint + build como gate de deploy
```

## 6. Anti-stack (lo que está prohibido y por qué)

```
✗ npm / yarn / bun            → un solo gestor; phantom deps y lockfiles mixtos rompen CI                    [vigente hoy]
✗ any, @ts-ignore             → error de lint; @ts-expect-error solo con descripción                          [vigente hoy]
✗ CSS custom / styled-comp.   → rompe el control central de diseño; todo sale de tokens                        [vigente hoy]
✗ fetch directo a BQ/APIs     → todo dato pasa por un route handler que hace fetch al backend Go (apps/api)     [vigente hoy]
✗ Pages Router / mezclas      → App Router únicamente                                                          [vigente hoy]
✗ create-next-app interactivo → los dashboards se arman siguiendo SKILL.md (a futuro: create-epa-dashboard)    [vigente hoy]
✗ componentes hechos a mano   → solo epa-ui a commit fijado; el registry de shadcn no existe todavía          [vigente hoy]
✗ SVG de chart a mano / bg-chart-${n} templado → solo dentro de ChartContainer, clases de chart literales     [vigente hoy]
✗ cliente de BigQuery en apps/web  → único control que compensa la SA compartida con apps/api (ver epa-backend) [vigente hoy]
```

> La fila "import de recharts/radix directo → solo vía @epa/charts y
> @epa/ui" que existía aquí fue retirada — era doblemente incorrecta contra
> el código real de `epa-ui`: no usa Radix (usa Base UI), y sí importa
> Recharts directo (dentro de `ChartContainer`). Ver `epa-ui.md`.
>
> La fila "route handlers nuevos → el BFF del template es el único backend"
> que existía aquí fue retirada — quedó doblemente obsoleta: el BFF de
> `@epa/data` está SUPERSEDED (ver la nota de arriba), y los route
> handlers de `apps/web` son ahora el proxy permanente hacia `apps/api`, no
> algo a reemplazar cuando llegue el kit.

Detalle completo de las prohibiciones vigentes hoy, con el porqué en una
línea cada una: ver `references/anti-stack.md`.
