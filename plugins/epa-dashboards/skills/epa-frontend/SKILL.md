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
Framework        Next.js 15 · App Router · src/ · Turbopack · alias @/*
Lenguaje         TypeScript estricto (regla 2)
Estilos          Tailwind v4 con tokens EPA — cero CSS custom
Validación       Zod en todos los boundaries (respuestas de route handlers,
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

## Regla 3 — Componentes: siempre del registry, nunca hechos a mano

Las primitivas de UI vienen del registry EPA de shadcn:

```
pnpm dlx shadcn add @epa/{componente}
```

**NUNCA** crear un botón, card, dialog o cualquier primitiva desde cero, ni
copiarla de internet o de otro proyecto. Si el componente que necesitas no
existe en el registry, avísale al usuario para que lo solicite al owner del
kit — no lo improvises.

> ⚠️ **TODO pendiente:** la URL real del registry (`<REGISTRY_URL>`) está
> pendiente de confirmarse en la sesión con Dany. Hasta entonces, este skill
> no puede resolver `pnpm dlx shadcn add` contra un registry real — avisar
> al usuario de este bloqueo si insiste en instalar un componente.

---

## Regla 4 — Charts

Los charts se construyen con **Recharts** siguiendo las convenciones de
shadcn/ui charts. Reglas obligatorias, sin excepción:

1. **Título + subtítulo siempre.** Un chart sin título no comunica nada.
2. **Comparación de periodo** como línea punteada gris cuando aplique
   (periodo anterior, YoY, edición anterior).
3. **Colores por canal desde tokens de epa-design — nunca hex inline.**
4. **Máximo 6 series.** Agrupar el resto en "Otros".
5. **Números formateados** (`$42.33M`, `1.29%`, `10.10x`) con **IBM Plex
   Mono**.
6. **Botón "Ver tabla"** en los charts de los módulos principales.

> ⚠️ **El mapa canal→color no existe todavía como tokens hex.**
> `epa-design` no tiene paleta categórica — solo reserva `Primary Mid
> (#B8CAFE)` para series secundarias genéricas. Las **claves** de canal a
> usar hoy (sin hex fijo, hasta que exista `@epa/tokens`) son:
> `google-ads, meta, tiktok, dv360, bing, organic, direct, email, otros`.
> Mientras el mapeo hex no exista: asignar un color de la paleta de
> epa-design por clave y mantenerlo consistente dentro del mismo dashboard;
> nunca hardcodear un hex distinto por chart. No inventar claves de canal
> nuevas sin necesidad.

---

## Regla 5 — Datos

Todo acceso a BigQuery pasa por **route handlers del proyecto** con queries
**parametrizadas**.

- Nunca `fetch` a APIs externas (de medios o de cualquier otra plataforma)
  desde el cliente.
- Nunca SQL por concatenación de strings — ver `epa-bq` y el agente
  `security-reviewer`.

---

## Regla 6 — Sin backend propio

El dashboard no tiene backend fuera de sus propios route handlers. Si el
proyecto parece necesitar un job programado, un ETL o un servicio aparte:
**detente** y dile al usuario que eso se escala al equipo de datos
(`datos@epa.digital`) — no lo construyas tú.

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

- Los datos salen de route handlers propios con queries parametrizadas a
  BigQuery — nunca fetch directo a BQ ni a APIs de medios/Pitágoras desde
  el cliente.
- Los charts van con Recharts + las convenciones de `epa-frontend`
  (título/subtítulo, colores por canal desde tokens, máx. 6 series) — nunca
  CSS custom para chartear.
- Las primitivas de UI vienen del registry EPA de shadcn, nunca hechas a
  mano.
- Sin login propio — el acceso se restringe en capa de plataforma (ver
  `references/auth.md`). No improvisar Firebase/NextAuth/tabla de usuarios.
- Si el proyecto parece necesitar un ETL o un job aparte, escalar a
  datos@epa.digital — no construirlo aquí.

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

Todo vive en el plugin `epa-dashboards` — 5 skills (`epa-frontend`,
`epa-bq`, `epa-design`, `epa-deploy`, `epa-safe-vibe`), 3 comandos
(`/plan-dashboard`, `/client-context`, `/critique-epa`, `/migrate-to-epa`)
y el agente
`security-reviewer`. Se activan solos según el contexto — no hace falta
invocarlos por nombre salvo los comandos.
```

---

## Regla 8 — Auth

Hoy ningún dashboard tiene login propio. El acceso se restringe en capa de
plataforma (proxy autenticado / IAM invoker), no en la app — ver
`references/auth.md` antes de escribir cualquier lógica de sesión. Si el
proyecto necesita login de cliente final ahora, escalar a
`datos@epa.digital`, no improvisar.
