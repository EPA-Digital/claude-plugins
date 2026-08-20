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
  → Duplican lo que ya existe en epa-ui y divergen del design system con el
    tiempo. Si el componente no existe ahí, se avisa al usuario para que lo
    pida a `@iescutia` — no se improvisa (ver epa-design/references/epa-ui.md).

✗ SVG de chart hecho a mano, o un nombre de clase de chart templado
  (`` `bg-chart-${n}` ``)
  → Los charts van dentro de `ChartContainer`/`ChartConfig` de epa-ui; las
    primitivas de Recharts se importan directo pero solo ahí adentro. El
    scanner de Tailwind es estático — una clase templada no compila
    (ver epa-design/references/epa-ui.md).

✗ Un hex o valor OKLCH inline por componente para color de estado
  (verde/ámbar "de éxito"/"de advertencia")
  → epa-ui no tiene esas variantes todavía; la regla provisional (deltas
    por secondary/destructive + ícono, status pills por mapa explícito) es
    la única forma aceptada — ver epa-design/references/epa-ui.md.

✗ Un segundo `<Toaster />` o un `TooltipProvider` adicional alrededor de un
  `Tooltip` puntual
  → Ya están montados una vez en `app/layout.tsx` (de epa-ui). Los toasts
    son el singleton `toast.add(...)`.

✗ `tailwind.config.js`
  → El stack es Tailwind v4 (epa-ui) — no tiene archivo de config; los
    tokens se declaran con `@theme inline` en CSS.

✗ Fetch directo a APIs de medios (Meta, Google Ads, TikTok, Bing, DV360...)
  → Redirige a epa-safe-vibe / Pitágoras. Los dashboards leen
    bdd-epa-digital.{cliente}_reporting en BigQuery — nunca la API de la
    plataforma ni Pitágoras directo (ver epa-bq).

✗ SQL por concatenación de strings (TypeScript o Go)
  → Vector de inyección y de fuga cross-cliente. Toda query va parametrizada
    — `q.Parameters` en Go, nunca `fmt.Sprintf` con un valor del request
    (ver epa-bq, epa-backend y security-reviewer). La única interpolación
    permitida es de identificadores (dataset, sufijo de MCC) que salen de
    config validada por regex al arrancar — nunca de un valor del request.

✗ `@google-cloud/bigquery` (o cualquier cliente de BigQuery) en `apps/web`
  → El frontend y el backend Go comparten service account (arquitectura de
    sidecar, ver epa-backend). Que `apps/web` nunca hable con BigQuery es lo
    único que compensa eso — es un hallazgo **crítico** de security-reviewer,
    no una preferencia de estilo.

✗ Fetch del navegador directo a `localhost:8081` (o "hacerlo público para
  que funcione")
  → El sidecar `api` no tiene ingress público — no hay URL que alcanzar
    desde el navegador, ni con IAM mal configurado. Si un fetch al backend
    falla, la corrección es revisar el route handler que hace de proxy
    (server-side), nunca desplegar `api` con su propio `--port` o su propio
    servicio para "que le llegue" al navegador — eso es un hallazgo crítico,
    no un workaround válido.

✗ Pages Router, o mezclar Pages Router con App Router
  → App Router únicamente — es la unidad deployable con el backend
    integrado (route handlers + middleware).

✗ create-next-app interactivo para arrancar un dashboard nuevo
  → Dos personas respondiendo el wizard producen dos proyectos distintos.
    Cada dashboard sigue las reglas de este skill (ver SKILL.md) — a futuro,
    create-epa-dashboard congela esto en un template sin prompts.
```

## Retirado — contradecía el código real de `epa-ui`

> La entrada que decía "✗ import de Recharts o de primitivas Radix directo
> — solo vía `@epa/charts`/`@epa/ui` cuando exista el kit" se retiró: era
> doblemente incorrecta contra `epa-ui`, que ya existe. No usa Radix (usa
> Base UI), y sí importa Recharts directo — pero solo dentro de
> `ChartContainer` (ver la entrada correcta arriba, en "Vigentes hoy", y
> `epa-design/references/epa-ui.md`).

> El BFF del template (`@epa/data`) como "único backend del dashboard" fue
> **SUPERSEDED** por la decisión de Go — ver `references/stack.md`. Los
> route handlers de `apps/web` no son algo a reemplazar cuando llegue el
> kit: son la capa de proxy obligatoria hacia el backend Go, permanente.
