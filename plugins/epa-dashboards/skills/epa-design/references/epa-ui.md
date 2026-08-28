# `epa-ui` — la capa de componentes real

Fuente: `epa-datos/epa-ui`, owner `iescutia`. Publicado en npm como
[`@epa-datos/ui`](https://www.npmjs.com/package/@epa-datos/ui) — versión
`0.1.0` (2026-08-24) al escribir esto. Este documento resuelve el
`<REGISTRY_URL>` que `epa-frontend` regla 3 dejaba pendiente: la respuesta
real no es un registry de shadcn, es un paquete de npm.

---

## Qué es y cómo se consume: paquete de npm, no copiar archivos

`epa-ui` es 61+ componentes sobre **Base UI** (no Radix), con Tailwind v4,
tokens OKLCH y IBM Plex ya cargado, más un dashboard de marketing completo
(`components/showcase/dashboard-example.tsx`) como composición de
referencia — el showcase **no** viaja en el paquete publicado (`files:
["dist"]`), para verlo hay que clonar el repo.

```bash
npm install @epa-datos/ui   # o pnpm add
```

**Sin barrel `index`** — cada archivo se importa directo, igual que dentro
del propio repo:

```tsx
import { Button } from "@epa-datos/ui/components/ui/button"
import { Badge } from "@epa-datos/ui/components/ui/badge"
import { Heatmap } from "@epa-datos/ui/components/epa/heatmap"
import { cn } from "@epa-datos/ui/lib/utils"
```

**Estilos** — una sola línea en el stylesheet global del proyecto, después
de Tailwind:

```css
@import "tailwindcss";
@import "@epa-datos/ui/styles/tokens.css";
```

Ese import trae los tokens semánticos (`--primary`, `--success`,
`--warning`, `--info`, `--chart-1..10`, etc.), las variantes `dark:`/
`short:`, y las utilidades de animación/data-state que usan los componentes
para transiciones open/close. El proyecto sigue teniendo que declarar
`--font-sans`/`--font-mono` (el paquete no las trae) donde cargue sus
fuentes, igual que antes en `app/layout.tsx`.

**Providers** — se montan una vez cerca de la raíz, igual que en el propio
repo (ver sección de providers abajo).

**Versionado real:** pin exacto en `package.json`, actualizar es
`npm update`/revisar los releases de GitHub del repo. Ya no hay un SHA que
registrar a mano en el `AGENTS.md` del dashboard — el pin de versión en
`package.json` **es** el registro.

> ⚠️ **Verificar en el primer `pnpm add` real:** el `package.json` del
> paquete declara `react`/`react-dom` como `peerDependencies` (`^19`) **y
> también** como `dependencies` fijas (`19.2.8`) al mismo tiempo — packaging
> inusual para una librería de componentes. No está confirmado que esto
> produzca una copia de React duplicada (el comportamiento normal de pnpm
> es que la resolución de peer gane y no haya nesting), pero si al instalar
> aparece un error de tipo `Invalid hook call` en runtime, la mitigación es
> fijar `react`/`react-dom` a `19.2.8` exacto en el `package.json` del
> dashboard para forzar una sola copia. Reportado como pregunta abierta a
> `epa-datos/epa-ui`, sin confirmar como bug.

**El layout de archivos es contrato público.** `AGENTS.md` de `epa-ui` lo
dice explícito: `exports` de su `package.json` mapea 1:1 cada ruta bajo
`components/ui/*`, `components/epa/*`, `lib/*`, `hooks/*` — mover o
renombrar un archivo ahí es un cambio de versión mayor (breaking), no una
limpieza de rutina. No importa desde una ruta que no esté en ese mapa.

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
  `CardTitle` (valor), `CardAction` con un `Badge` de tendencia (ver
  "Estado semántico" abajo)
- Pocos registros como cards/rows → `Item`/`ItemGroup`, no `div`s sueltos
- Valor relativo/agregado (% completado, presupuesto gastado) → `Progress`
- Tendencia en el tiempo → `Chart` vía `ChartContainer` — nunca un SVG a
  mano (ver sección de charts abajo)
- Magnitud en dos dimensiones (hora × día, región × métrica) → `Heatmap`
  (`components/epa/heatmap.tsx`) — ver "Widgets compuestos" abajo
- Cero filas / nada que mostrar → `Empty`, no un `div` vacío
- Cargando → `Skeleton` para la forma, `Spinner` para estado inline/botón

**Filtrar y encontrar**
- Un set fijo de opciones → `Select`
- Buscar escribiendo sobre una lista larga → `Combobox`
- Pocos estados mutuamente exclusivos → `ToggleGroup` o `Tabs`
- Búsqueda global "ir a X" → `Command`/`CommandDialog`
- Filtro de rango de fechas, con presets y/o comparación de periodo →
  `DateRangePicker` (`components/epa/date-range-picker.tsx`) — ver "Widgets
  compuestos" abajo
- KPI cards que también sirven de toggle de series de un chart →
  `MetricCardGroup`/`MetricCard` — ver "Widgets compuestos" abajo

**Drill-down / acción**
- "Más sobre esta fila" sin navegar → `HoverCard` (hover), `Popover`
  (click, ligero), `Dialog` (tarea enfocada), `Sheet` (panel pesado)
- Confirmar algo irreversible → `AlertDialog`, nunca un `Dialog` plano
- Menú de acciones en una fila → `DropdownMenu`

**Feedback y estado**
- Algo que notar pero no bloqueante → `Alert` (banner persistente), con la
  variante que corresponda: `default`/`destructive`/`success`/`warning`/
  `info`
- Confirmación de que algo acaba de pasar → `toast` (`toast.add(...)`), no
  otro `Alert`
- Estado a simple vista (activo/pausado, prioridad) → `Badge` con la
  variante correcta (ver "Estado semántico" abajo) — nunca color de texto a
  mano
- Secuencia de conversión multi-etapa con drop-off por etapa →
  `ConversionFunnel` (`components/epa/conversion-funnel.tsx`) — ver
  "Widgets compuestos" abajo

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

**`Card`, `Badge` e `Item` también aceptan `render`**, pero por otra vía —
usan `useRender`/`mergeProps` de Base UI directamente, no son wrappers de un
overlay. Sirve para volver una tarjeta/badge un elemento interactivo real:

```tsx
<Card render={<button type="button" />} aria-pressed={selected} />
```

Ese es exactamente el patrón detrás de `MetricCard` (ver "Widgets
compuestos") — úsalo cuando la card/badge necesita ser clickeable con
semántica real (foco de teclado, anunciado como control a un lector de
pantalla), nunca un `<div onClick>`.

---

## Providers ya montados

`ThemeProvider`, `TooltipProvider` y `Toaster` se montan **una vez** cerca
de la raíz del proyecto:

```tsx
import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "@epa-datos/ui/components/ui/tooltip"
import { Toaster } from "@epa-datos/ui/components/ui/toast"

export default function RootLayout({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
```

No montar un segundo `TooltipProvider` alrededor de un `Tooltip` puntual, ni
renderizar otro `<Toaster />`. Para un toast, el singleton imperativo:

```tsx
import { toast } from "@epa-datos/ui/components/ui/toast"
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

**Paleta categórica ya resuelta:** `--chart-1` … `--chart-10`, espaciados
por tono para máxima distinguibilidad y evitando a propósito la banda de
`--destructive` (~22-27°). Usar las claves de canal de esa regla
(`google-ads, meta, tiktok, dv360, bing, organic, direct, email, otros`)
mapeadas a `--chart-1..10`, consistentes dentro del mismo dashboard.

**Los nombres de clase tienen que ser literales** — `bg-chart-6` sí,
`` `bg-chart-${n}` `` no. El scanner de Tailwind es estático y no resuelve
templates.

Si lo que necesitas no es una serie de tiempo simple sino un heatmap o un
funnel de conversión, ver "Widgets compuestos" abajo antes de forzarlo
dentro de `ChartContainer`.

---

## Tokens y escalas, tal como son en el código

- **OKLCH + `@theme inline`**, servidas por `@epa-datos/ui/styles/tokens.css`.
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
- **`cn()` de `@epa-datos/ui/lib/utils`** (clsx + tailwind-merge) obligatorio
  para mezclar clases — nunca concatenar strings ni dejar clases de
  Tailwind en conflicto.

---

## Estado semántico — variantes reales, ya no una regla provisional

**`Badge` y `Alert` tienen `success`/`warning`/`info` reales**, con la misma
forma exacta que `destructive` (`bg-X/10 text-X`, `dark:bg-X/20`, etc.) —
esto **reemplaza** la regla que este mismo archivo enseñaba antes de que se
publicara el paquete (delta por `secondary`/`destructive` + ícono). Esa
regla vieja está **retirada explícitamente por el owner**: el `AGENTS.md`
de `epa-ui` dice, sobre `CardAction` con un `Badge` de tendencia,
*"`variant="success"` para un valor que mejora, `variant="destructive"`
para uno que empeora — **no** `secondary`, que se lee neutral en vez de
'bueno'"*. `dashboard-example.tsx` ya cambió a `variant="success"`.

- **Delta de KPI:** `Badge variant="success"` + `ArrowUpRightIcon` (lucide)
  cuando mejora, `variant="destructive"` + `ArrowDownRightIcon` cuando
  empeora. Ojo con métricas donde "abajo" es la buena noticia (CPA, CPC):
  el signo lo decide el negocio, la aritmética por sí sola no basta.
- **Status pills:** un `Record<Status, BadgeVariant>` explícito por
  dashboard — ahora con `success`/`warning`/`info` disponibles como
  opciones reales además de `default`/`secondary`/`outline`/`ghost`/`link`,
  para un estado que de verdad sea "bueno"/"cuidado"/"neutral", no solo
  como antes con las variantes genéricas.
- **`--success` comparte tono (142.495°) con `--chart-2`, a propósito, pero
  no son intercambiables.** `--chart-2` es identidad de serie y puede
  moverse si la paleta de charts se rebalancea; `--success` tiene que
  seguir siendo verde siempre porque ahí rojo/verde es significado
  (malo/bueno), no categoría. Mismo principio aplica a `--warning`/`--info`
  frente a cualquier `--chart-N`: nunca reusar un token de serie de datos
  como color de estado, ni al revés.
- **`▲`/`▼` de `epa-design` siguen vigentes en texto** — una celda de
  tabla, una etiqueta de chart, una frase de copy. El ícono de lucide
  dentro de un `Badge` es para cuando hay un componente; el carácter es
  para cuando no hay componente y es solo texto. Ninguno de los dos es el
  emoji que `/critique-epa` prohíbe.
- **Toast:** los cuatro tipos no-`loading` (`success`/`info`/`warning`/
  `error`) ya tienen ícono **y color** propios — nada que agregar a mano.

---

## `components/epa/*` — widgets compuestos

Un tier nuevo, distinto de `components/ui/*` (wrappers 1:1 de Base UI):
widgets de orden más alto, ensamblados de varios primitivos `ui/*`, que
siguen siendo un componente reusable — no una composición de página
completa (eso es `dashboard-*.tsx` en el showcase). Los cuatro que existen
hoy:

- **`DateRangePicker`** (`components/epa/date-range-picker.tsx`) — presets
  ("Últimos 30 días") + comparación de periodo. Construido sobre `Popover` +
  `Calendar` (`mode="range"`) + `Switch`, no un par de `Input` de fecha a
  mano. `variant="popover"` (default: botón + panel) o `variant="inline"`
  (solo el `ButtonGroup` de presets embebido en la página, sin popover,
  calendario ni comparación) — ambas variantes comparten el mismo API de
  preset/valor, así que extiende esta antes de armar un segundo picker
  inline.
- **`Heatmap`** (`components/epa/heatmap.tsx`) — construido sobre `Table` +
  `Tooltip`, no un grid de `div`s coloreados a mano. Tiene su **propia
  escala** `--heat-1`…`--heat-5` + `--heat-ink` (bajo→alto), que **cruza a
  propósito** la banda roja que la regla de `--chart-N` evita — en un
  heatmap bajo/malo→alto/bueno, rojo en el extremo bajo es el punto
  semántico, no un estado de error. Es la única excepción documentada a la
  regla de colores de chart — no "corregirla" para evitar el rojo.
- **`ConversionFunnel`** (`components/epa/conversion-funnel.tsx`) —
  construido sobre `Progress` + `Badge`, una barra horizontal por etapa con
  valor + tendencia + % de caída vs. la etapa anterior. **Distinto** del
  demo `FunnelChart`/`Funnel` de Recharts en
  `components/showcase/demos/chart.tsx` — ese es el trapecio apilado
  clásico, puramente visual, sin badge de tendencia por etapa. Usar
  `ConversionFunnel` cuando cada etapa necesita su propio valor + tendencia
  + drop-off; el `FunnelChart` de Recharts solo cuando lo que se quiere es
  la forma del trapecio y nada más.
- **`MetricCardGroup`/`MetricCard`** (`components/epa/metric-card-group.tsx`)
  — fila de KPI cards que también actúan como toggle multi-select de las
  series de un chart (p. ej. clic en "Ingresos" o "Sesiones" agrega/quita
  esa serie). Construido sobre `Card` (renderizado como `<button>` real vía
  su `render`, ver arriba) + `Badge` + `ButtonGroup`. `defaultValue` es
  obligatorio — el grupo siempre arranca con un set deliberado de series,
  nunca vacío por accidente — pero ocultar todo después sigue siendo válido
  (mostrar `Empty` en el área del chart cuando pase, no un eje sin series).

**Copy en español por default en las cuatro** (labels, aria-labels,
formatters — p. ej. "% de caída"/"% de alza" del funnel, "Bajo"/"Alto" del
heatmap, "Mostrar todo"/"Ocultar todo" del `MetricCardGroup`), overridable
por props. `DateRangePicker` además pasa `locale={es}` de `date-fns` al
`Calendar` y a sus `format()` — encaja con las reglas de copy español LATAM
de `epa-design` sin trabajo adicional de este lado.

---

## `dashboard-example.tsx` como referencia

Composición real con KPI cards, tabla de campañas, dropdown de acciones,
alert de aviso, y el patrón de estado semántico correcto (`variant="success"`
para el delta positivo). Léelo antes de armar una pantalla nueva — es más
confiable que inventar la composición desde los componentes sueltos. No
viaja en el paquete publicado; está en el repo (clonar para verlo, o
navegar el código en GitHub).

---

## Estado del release — qué sigue siendo real hoy

Las tres preguntas abiertas de la integración anterior están **resueltas**,
respondidas por `iescutia` en `epa-datos/epa-ui#5` (cerrado):

- **Distribución** → paquete de npm (`@epa-datos/ui`), no registry de
  shadcn — la razón que dio: los componentes no se editan en los forks,
  solo aquí, así que un paquete da todo desde el día uno y actualizar es
  `npm update`.
- **Tokens semánticos** → agregados (`success`/`warning`/`info`, ver
  arriba).
- **Next.js** → recomienda subir a 16 (ver `epa-frontend`/`CLAUDE.md`).

Lo que sigue siendo real y vale la pena tener presente:

- **`0.1.0`, un solo release publicado.** Sin `CHANGELOG.md` todavía — el
  historial de cambios por ahora son los releases de GitHub.
- **El layout de archivos ya es contrato público** (ver arriba) — un
  cambio ahí es breaking, no cleanup, así que un pin de versión exacto en
  el dashboard sigue siendo la práctica correcta, igual que con cualquier
  dependencia de una librería joven.

---

## Nota al pie: el bloque `nextjs-agent-rules`

El `AGENTS.md` de `epa-ui` tiene un bloque `<!-- BEGIN:nextjs-agent-rules -->`
que `next dev` reescribe solo, ligado a la versión de Next instalada. Se
menciona aquí **únicamente** para que nadie interprete sus diffs como un
cambio intencional del repo — no entra a la doctrina de este plugin.
