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

| Tema | Estado hoy (este skill, `SKILL.md`) | Estado objetivo (cuando exista el kit) |
|---|---|---|
| Charts | Recharts directo + las 6 reglas de `epa-frontend` (título/subtítulo, comparación punteada, colores por canal, máx. 6 series, cifras formateadas, botón "Ver tabla") | `@epa/charts` — wrapper sobre Recharts + componentes propios. El vibecoder nunca importa Recharts directo. |
| Primitivas UI | Registry EPA de shadcn (`pnpm dlx shadcn add @epa/{componente}`, URL pendiente — ver `<REGISTRY_URL>` en `SKILL.md`) | `@epa/ui` — primitivas Radix publicadas **compiladas**; el vibecoder no las edita localmente. |
| Acceso a datos | Route handlers del proyecto con queries parametrizadas a BigQuery | `@epa/data` — hook `useReport()` sobre TanStack Query + BFF con query builder y row filters. El vibecoder no escribe SQL. |
| Backend del dashboard | El dashboard tiene sus propios route handlers | El BFF del template (`create-epa-dashboard`) es el único backend — "el vibecoder nunca crea route handlers nuevos". |
| Creación del proyecto | Se sigue este skill a mano sobre un `create-next-app` no interactivo (ver sección 2) | `npx create-epa-dashboard {cliente}-{dashboard}` — template congelado con todo preinstalado. |

> **Input registrado durante la planeación de este plugin** (José Carlos
> Corona, consultando a Dany): *"si vamos a congelar el template, podría ir ya
> instalado [el kit]. Igual sería bueno ponerlo como paquete npm para el tema
> de las actualizaciones, entonces vivirá en este mismo repo."* Esto confirma
> la columna "estado objetivo" — el kit llega preinstalado en el template,
> distribuido como paquete npm.
>
> **⚠️ TODO sin resolver:** "vivirá en este mismo repo" (`claude-plugins`)
> contradice la sección 2.1 de abajo, que define `epa-dashboard-kit` como
> **repo propio** (pnpm workspaces + Turborepo, GitHub Packages privado
> `@epa/*`). Si los paquetes `@epa/*` van a vivir en `claude-plugins`, este
> repo deja de ser un marketplace de plugins puro y pasa a ser también un
> monorepo de librerías — es una decisión de arquitectura que no toma este
> documento ni este plugin. Queda pendiente de que el equipo la resuelva
> antes de la Etapa 2.

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

**Gate de CI (epa-cicd):** `pnpm typecheck && pnpm lint && pnpm build` — los
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

## 5. El stack completo en una tabla (referencia rápida — estado objetivo, con el kit)

> Esta tabla describe el estado **objetivo** (con `@epa/*`). Para lo que
> aplica hoy sin el kit, ver la tabla "Estado hoy vs. estado objetivo" al
> inicio de este documento y las reglas de `SKILL.md`.

```
Runtime          Node 22 LTS (pinned)
Paquetes         pnpm 10 (corepack, engine-strict)
Framework        Next.js 15 · App Router · src/ · Turbopack
Lenguaje         TypeScript estricto (sección 3) — any prohibido por lint
Estilos          Tailwind v4 + @epa/tokens — cero CSS custom
UI               @epa/ui (Radix primitives, publicado compilado)
Charts           @epa/charts (Recharts + componentes propios) — Recharts nunca se importa directo
Datos            @epa/data (TanStack Query + BFF + query builder con row filters) + Zod
Filtros/URL      nuqs
Auth             @epa/auth (verificación JWT de IAP + getUser)
Formateo         Prettier + prettier-plugin-tailwindcss
Lint             ESLint flat + typescript-eslint strict-type-checked + reglas EPA
Testing          Vitest + RTL (smoke) · Playwright en el kit
Instrucciones    AGENTS.md (CLAUDE.md symlink)
CI               epa-cicd: typecheck + lint + build como gate de deploy
```

## 6. Anti-stack (lo que está prohibido y por qué)

```
✗ npm / yarn / bun            → un solo gestor; phantom deps y lockfiles mixtos rompen CI                    [vigente hoy]
✗ any, @ts-ignore             → error de lint; @ts-expect-error solo con descripción                          [vigente hoy]
✗ CSS custom / styled-comp.   → rompe el control central de diseño; todo sale de tokens                        [vigente hoy]
✗ fetch directo a BQ/APIs     → todo dato pasa por un route handler con auth + queries parametrizadas          [vigente hoy]
✗ Pages Router / mezclas      → App Router únicamente                                                          [vigente hoy]
✗ create-next-app interactivo → los dashboards se arman siguiendo SKILL.md (a futuro: create-epa-dashboard)    [vigente hoy]
✗ import de recharts/radix directo → solo vía @epa/charts y @epa/ui; wrappers son el contrato                  [futuro, con el kit]
✗ route handlers nuevos       → el BFF del template es el único backend del dashboard                          [futuro, con el kit]
```

Detalle completo de las prohibiciones vigentes hoy, con el porqué en una
línea cada una: ver `references/anti-stack.md`.
