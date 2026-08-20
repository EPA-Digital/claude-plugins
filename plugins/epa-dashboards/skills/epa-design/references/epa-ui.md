# `epa-ui` — la capa de componentes real

Fuente: `epa-datos/epa-ui`, owner `iescutia`. HEAD `3f5d758` (2026-08-13, 3
commits de vida) al escribir esto. Este documento resuelve el
`<REGISTRY_URL>` que `epa-frontend` regla 3 dejaba pendiente — la respuesta
real es que **no hay registry**, y esto explica qué hacer en su lugar.

---

## Qué es y cómo se consume: copiar a commit fijado

`epa-ui` es 61 componentes sobre **Base UI** (no Radix), con Tailwind v4,
tokens OKLCH y IBM Plex ya cargado, más un dashboard de marketing completo
(`components/showcase/dashboard-example.tsx`) como composición de
referencia.

**El registry no existe hoy.** `components.json` declara `registries: {}`,
no hay `registry.json` en el repo, y el repo es privado — `pnpm dlx shadcn
add @epa/x` no tiene contra qué resolver. La única forma real de consumir
`epa-ui` es **copiar archivos** a un commit fijado:

1. Copiar del repo, al SHA que se registre (ver paso 2): `components/ui/*`
   (solo lo que el dashboard usa, no los 61 de una vez),
   `lib/utils.ts` (`cn()`), `hooks/use-mobile.ts`,
   `providers/theme-provider.tsx`, los tokens de `app/globals.css`, el setup
   de fuentes de `app/layout.tsx`, y `components.json`.
2. Registrar el SHA copiado en el `AGENTS.md` del dashboard (ver plantilla
   de `epa-frontend/SKILL.md`) — así la próxima actualización es un diff
   contra ese commit, no una adivinanza sobre qué cambió.
3. Que exista un registry real (o un paquete npm) es un pedido pendiente
   para `@iescutia`, no algo que el dashboard resuelva por su cuenta — ver
   la sección de huecos, abajo.

---

## Mapa intención → componente

Lo que convierte un pedido vibecodeado ("una forma de filtrar esto", "que
se vea menos vacío", "déjales saber que funcionó") en el componente correcto
en vez de un `<div>` — condensado del `AGENTS.md` de `epa-ui`, con el mismo
sesgo a dashboards (datos, filtros, drill-down, estado):

**Mostrar datos**
- Lista/grid de registros con columnas → `Table` (+ `Badge` de estado,
  `Avatar` de personas, `Progress` para % completado)
- Muchas filas → `Pagination` bajo la `Table`
- Un solo número destacado → `Card` con `CardDescription` (label) +
  `CardTitle` (valor)
- Pocos registros como cards/rows → `Item`/`ItemGroup`, no `div`s sueltos
- Valor relativo/agregado (% completado, presupuesto gastado) → `Progress`
- Tendencia en el tiempo → `Chart` vía `ChartContainer` — nunca un SVG a
  mano (ver sección de charts abajo)
- Cero filas / nada que mostrar → `Empty`, no un `div` vacío
- Cargando → `Skeleton` para la forma, `Spinner` para estado inline/botón

**Filtrar y encontrar**
- Un set fijo de opciones → `Select`
- Buscar escribiendo sobre una lista larga → `Combobox`
- Pocos estados mutuamente exclusivos → `ToggleGroup` o `Tabs`
- Búsqueda global "ir a X" → `Command`/`CommandDialog`

**Drill-down / acción**
- "Más sobre esta fila" sin navegar → `HoverCard` (hover), `Popover`
  (click, ligero), `Dialog` (tarea enfocada), `Sheet` (panel pesado)
- Confirmar algo irreversible → `AlertDialog`, nunca un `Dialog` plano
- Menú de acciones en una fila → `DropdownMenu`

**Feedback y estado**
- Algo que notar pero no bloqueante → `Alert` (banner persistente)
- Confirmación de que algo acaba de pasar → `toast` (`toast.add(...)`), no
  otro `Alert`
- Estado a simple vista (activo/pausado, prioridad) → `Badge` con la
  variante correcta (ver "Estado semántico" abajo) — nunca color de texto a
  mano

---

## Base UI, no Radix

`components/ui/*` envuelve `@base-ui/react`, no Radix. Varias partes usan
un prop `render` para fusionar comportamiento sobre un elemento real en vez
de envolverlo en un nodo DOM extra:

```tsx
<DialogTrigger render={<Button variant="outline" />}>Abrir</DialogTrigger>
```

**Necesitan `render={<Button/>}` (o similar):** `DialogTrigger`/
`DialogClose`, `AlertDialogTrigger`/`AlertDialogCancel`, `SheetTrigger`/
`SheetClose`, `PopoverTrigger`, `TooltipTrigger`, `HoverCardTrigger`,
`DropdownMenuTrigger`, `CollapsibleTrigger`.

**No lo necesita:** `ContextMenuTrigger` — es un `div` estilizado (la
superficie de right-click), no un botón.

---

## Providers ya montados

`ThemeProvider`, `TooltipProvider` y `Toaster` se montan **una vez** en
`app/layout.tsx`. No montar un segundo `TooltipProvider` alrededor de un
`Tooltip` puntual, ni renderizar otro `<Toaster />`. Para un toast, el
singleton imperativo:

```tsx
import { toast } from "@/components/ui/toast"
toast.add({ title, description, type }) // type: success | info | warning | error | loading
```

---

## Charts: `ChartContainer` + `ChartConfig`, no Recharts a mano

`components/ui/chart.tsx` es el contrato. Las primitivas de `recharts` **sí**
se importan directo, pero solo dentro de un `ChartContainer` con su
`ChartConfig` — nunca un SVG hecho a mano. Esto corrige la regla anterior
de `anti-stack.md`, que prohibía importar Recharts directo asumiendo un
wrapper de Radix que nunca existió así.

Las 6 reglas de chart de `epa-frontend` regla 4 **siguen vigentes** —
título/subtítulo, comparación punteada, colores por canal, máx. 6 series,
cifras en Plex Mono, botón "Ver tabla" — se aplican sobre `ChartContainer`,
no en lugar de él.

**Paleta categórica ya resuelta:** `--chart-1` … `--chart-10` en
`app/globals.css`, espaciados por tono para máxima distinguibilidad y
evitando a propósito la banda de `--destructive` (~22-27°) — esto es el
`@epa/tokens` que `epa-frontend` regla 4 daba como bloqueado; ya no lo está.
Usar las claves de canal de esa regla (`google-ads, meta, tiktok, dv360,
bing, organic, direct, email, otros`) mapeadas a `--chart-1..10`,
consistentes dentro del mismo dashboard.

**Los nombres de clase tienen que ser literales** — `bg-chart-6` sí,
`` `bg-chart-${n}` `` no. El scanner de Tailwind es estático y no resuelve
templates.

---

## Tokens y escalas, tal como son en el código (no como decía la doctrina vieja)

- **OKLCH + `@theme inline`** en `app/globals.css` (`:root`/`.dark`).
  **Tailwind v4 no tiene `tailwind.config.js`** — si necesitas la forma de
  config equivalente para referencia histórica, está en `tokens.md`
  marcada como forma de v3, no como archivo real de este stack.
- **Un solo `--radius`** (0.625rem = 10px) escalado `sm`…`4xl` (hasta
  ~26px). El anti-patrón "border-radius >12px prohibido" de `epa-design`
  es **falso** contra este código — se corrige en `SKILL.md`.
- **Sombras: las de Tailwind** (`shadow-sm/md/lg/xl`) por elevación —
  `sm` cards, `md` popovers/dropdowns (+ `ring-1 ring-foreground/10`),
  `lg` sheets/submenus/toast, `xl` tooltip de chart. El anti-patrón "NO
  sombras tipo Tailwind default" también es falso contra el código.
- **Espaciado:** escala default de Tailwind (pasos de 0.25rem), sin escala
  custom.
- **Variante `short:`** (`@media (max-height: 700px)`) para adaptar layouts
  en viewports bajos — usarla antes de escribir una media query suelta.
- **`cn()` de `@/lib/utils`** (clsx + tailwind-merge) obligatorio para
  mezclar clases — nunca concatenar strings ni dejar clases de Tailwind en
  conflicto.

---

## Estado semántico — la sección que hace ejecutable el resto

`epa-ui` **no tiene** `success`/`warning`/`info` como token ni como
variante — solo `--destructive`. `Badge` y `Alert` tienen exactamente
`default | secondary | destructive | outline | ghost | link`
(`badge.tsx:10-24`). Y **todo KPI card tiene un delta**, así que esto no
puede quedar como un hueco a resolver después — se resuelve con la regla
que `epa-ui` ya usa en su propia composición de referencia
(`components/showcase/dashboard-example.tsx`):

- **Delta de KPI** (`dashboard-example.tsx:219-221`): `Badge
  variant="secondary"` + `ArrowUpRightIcon` (lucide) cuando mejora,
  `variant="destructive"` + `ArrowDownRightIcon` cuando empeora. **Sin
  verde.** Ojo con métricas donde "abajo" es la buena noticia (CPA, CPC):
  el signo lo decide el negocio, la aritmética por sí sola no basta.
- **Status pills** (`dashboard-example.tsx:197-204`): un
  `Record<Status, BadgeVariant>` explícito por dashboard, sobre las seis
  variantes que existen — p. ej. `Active: "default"`, `Paused:
  "secondary"`, `Ended: "outline"`. No inventar `variant="success"`.
- **Prohibido:** un hex verde/ámbar inline, declarar una variante nueva en
  `Badge`/`Alert`, o reusar `--chart-N` como color de estado — esos tokens
  son de **serie de datos**, y amarrarles significado semántico rompe los
  charts el día que la paleta cambie.
- **`▲`/`▼` de `epa-design` siguen vigentes en texto** — una celda de
  tabla, una etiqueta de chart, una frase de copy. El ícono de lucide
  dentro de un `Badge` es para cuando hay un componente; el carácter es
  para cuando no hay componente y es solo texto. Ninguno de los dos es el
  emoji que `/critique-epa` prohíbe.
- **Toast:** los cuatro tipos (`success/info/warning/error`, más
  `loading`) ya se distinguen por ícono (`toast.tsx:135-160`) — solo
  `error` lleva color (`text-destructive`). No agregarles color a mano a
  los otros tres.

---

## `dashboard-example.tsx` como referencia

549 líneas, composición real con KPI cards, tabla de campañas, dropdown de
acciones, alert de aviso, y los dos patrones de estado semántico citados
arriba. Léelo antes de armar una pantalla nueva — es más confiable que
inventar la composición desde los componentes sueltos.

---

## Huecos conocidos de `epa-ui` — para pedir, no para parchar

- **Tokens semánticos reales** (`success`/`warning`/`info` como variante de
  `Badge`/`Alert`, no solo la regla provisional de arriba).
- **Distribución:** sin `registry.json`, sin paquete npm, repo privado. Hoy
  solo se puede copiar.
- **Estabilidad de API:** 3 commits de vida — los wrappers todavía pueden
  moverse. De ahí que se copie a commit fijado y se registre el SHA, no que
  se trate como una dependencia estable.

Estos tres puntos van en un issue a `epa-datos/epa-ui` (ver
`commands/migrate-to-epa.md` y el registro de la sesión que integró esto) —
no se resuelven inventando un parche paralelo dentro de un dashboard.

---

## Nota al pie: el bloque `nextjs-agent-rules`

El `AGENTS.md` de `epa-ui` tiene un bloque `<!-- BEGIN:nextjs-agent-rules -->`
que `next dev` reescribe solo, ligado a la versión de Next instalada. Se
menciona aquí **únicamente** para que nadie interprete sus diffs como un
cambio intencional del repo — no entra a la doctrina de este plugin.
