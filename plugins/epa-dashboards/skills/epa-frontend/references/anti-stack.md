# Anti-stack — prohibido y por qué

Lista de lo que un dashboard vibecodeado en EPA nunca debe tener. Si
encuentras uno de estos patrones al revisar o generar código, deténte y
corrige antes de seguir.

## Vigentes hoy

```
✗ npm / yarn / bun
  → Un solo gestor de paquetes en toda la plataforma: pnpm. Los demás
    permiten phantom dependencies o mezclan lockfiles y rompen CI.

✗ any, @ts-ignore
  → any es error de lint, no warning. @ts-ignore está prohibido;
    @ts-expect-error solo con descripción escrita. El modo de falla típico
    de código generado es "compila pero miente" — estas reglas lo convierten
    en error de CI.

✗ CSS custom / styled-components / cualquier estilo fuera de Tailwind+tokens
  → Rompe el control central de diseño. Si una clase no sale de los tokens
    de epa-design, no existe.

✗ Componentes de UI hechos a mano (botón, card, dialog, tabla... copiados de
  internet o creados desde cero)
  → Duplican lo que ya existe en el registry EPA de shadcn y divergen del
    design system con el tiempo. Si el componente no existe en el registry,
    se avisa al usuario para que lo pida al owner del kit — no se improvisa.

✗ Fetch directo a APIs de medios (Meta, Google Ads, TikTok, Bing, DV360...)
  → Redirige a epa-safe-vibe / Pitágoras. Los dashboards leen
    bdd-epa-digital.{cliente}_reporting en BigQuery — nunca la API de la
    plataforma ni Pitágoras directo (ver epa-bq).

✗ SQL por concatenación de strings
  → Vector de inyección y de fuga cross-cliente. Toda query va parametrizada
    (ver epa-bq y security-reviewer).

✗ Pages Router, o mezclar Pages Router con App Router
  → App Router únicamente — es la unidad deployable con el backend
    integrado (route handlers + middleware).

✗ create-next-app interactivo para arrancar un dashboard nuevo
  → Dos personas respondiendo el wizard producen dos proyectos distintos.
    Cada dashboard sigue las reglas de este skill (ver SKILL.md) — a futuro,
    create-epa-dashboard congela esto en un template sin prompts.
```

## Futuro — al liberarse el kit `@epa/*` (no vigente hoy, ver `stack.md`)

```
✗ import de Recharts o de primitivas Radix directo (sin pasar por @epa/*)
  → Cuando exista el kit, @epa/charts y @epa/ui son el único wrapper
    permitido — mantienen tokens, formato de cifras y accesibilidad
    consistentes entre todos los dashboards.

✗ Route handlers nuevos en el dashboard
  → Cuando exista create-epa-dashboard, el BFF del template es el único
    backend del dashboard. Hoy, mientras no exista, el dashboard sí tiene
    route handlers propios — ver la regla 5 del SKILL.md.
```
