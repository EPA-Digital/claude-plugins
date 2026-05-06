---
version: alpha
name: EPA Digital Design System
description: >
  Design system for EPA Digital — a performance-marketing agency (~170 people, LATAM HQ).
  Spans two surfaces: the dense product UI (Pitágoras, client dashboards, internal analytics tools, vibecoding apps)
  and the brand/deck surface (executive client presentations, QBRs, case studies).
  All user-facing copy defaults to Spanish (LATAM professional register, informal second-person).

colors:
  # --- Brand core ---
  primary:          "#003AD6"   # EPA Blue — the identity anchor
  primary-dark:     "#002BAF"   # Hover / pressed
  primary-deep:     "#00199C"   # Theme dark blue
  primary-deepest:  "#00154B"   # Near-black for aurora slide backgrounds
  primary-bright:   "#0051FF"   # Saturated aurora blue (deck gradients only)
  primary-mid:      "#B8CAFE"   # Chart accent, secondary data series
  primary-light:    "#E8EFFE"   # Active nav fill, AI-insights tint
  primary-wash:     "#E5EEFA"   # Slide panel light-wash

  # --- Accents (deck / brand — NOT for product UI) ---
  accent-cyan:      "#00E8FF"   # Electric aqua — eyebrows, infographic highlights
  accent-cyan-ink:  "#03B0FF"   # Mid-cyan for icons on light backgrounds
  accent-magenta:   "#DB0043"   # Deck only — dramatic KPI emphasis

  # --- Brand neutrals (slides) ---
  ink:              "#0E141E"   # Wordmark dark — not pure black
  slate:            "#8691AE"   # Cool grey
  slate-soft:       "#707E9F"   # Secondary cool grey

  # --- Product surfaces ---
  surface:          "#FFFFFF"   # Cards, panels
  surface-secondary: "#FAFAFA"  # App canvas (barely-there tint)
  surface-tertiary: "#F5F5F5"   # Input fields, row hover, skeleton loaders

  # --- Foreground ---
  content:          "#0A0A0A"   # Primary text
  content-secondary: "#6B6B6B"  # Supporting text
  content-tertiary: "#A3A3A3"   # Captions, metadata
  on-primary:       "#FFFFFF"   # Text on EPA blue surfaces

  # --- Borders ---
  border:           "#E5E5E5"   # Hairline border (applied at 0.5px)
  border-strong:    "#D4D4D4"   # Stronger border

  # --- Semantic ---
  success:          "#16A34A"
  success-bg:       "#F0FDF4"
  success-border:   "#BBF7D0"
  success-text:     "#166534"
  warning:          "#D97706"
  warning-bg:       "#FFFBEB"
  warning-border:   "#FDE68A"
  warning-text:     "#92400E"
  danger:           "#DC2626"
  danger-bg:        "#FEF2F2"
  danger-border:    "#FECACA"
  danger-text:      "#991B1B"
  info:             "#003AD6"
  info-bg:          "#E8EFFE"
  info-border:      "#B8CAFE"
  info-text:        "#00199C"

typography:
  # --- Product UI scale (dashboard density — 13px default body) ---
  ui-h1:
    fontFamily: IBM Plex Sans
    fontSize: 22px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: -0.5px
  ui-h2:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: -0.4px
  ui-h3:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: 600
    lineHeight: 22px
    letterSpacing: -0.3px
  ui-body:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: -0.1px
  ui-body-strong:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: -0.1px
  ui-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: -0.2px
  ui-sm:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 18px
  ui-xs:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: 400
    lineHeight: 16px
  ui-caps:
    fontFamily: IBM Plex Sans
    fontSize: 10px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.6px
    fontFeature: "case"
  ui-mono:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: 0

  # --- Brand / Deck scale ---
  d-hero:
    fontFamily: IBM Plex Sans
    fontSize: 96px
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: -1.8px
  d-title:
    fontFamily: IBM Plex Sans
    fontSize: 70px
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -1.2px
  d-subtitle:
    fontFamily: IBM Plex Sans
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: -0.3px
  d-body:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.55
  d-caption:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  d-eyebrow:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 1.6px
    fontFeature: "case"

rounded:
  sm:   4px     # Sub-components, nested chips
  md:   6px     # Default — buttons, pills, form inputs, status badges
  lg:   8px     # Panels, table cards
  xl:   10px    # KPI cards
  2xl:  12px    # Large panels, modals
  full: 9999px  # Avatars, live-status dot, tag pills

spacing:
  xs:          4px
  sm:          8px
  md:          16px
  lg:          24px
  xl:          40px
  2xl:         72px
  topbar:      56px
  sidebar-icon: 52px
  sidebar-nav:  200px
  sidebar-collapsed: 48px
  grid-gutter:  16px
  grid-margin:  20px
  grid-max-width: 1440px

shadows:
  sm:  "0 1px 2px rgba(10,14,30,0.04)"
  md:  "0 2px 6px rgba(10,14,30,0.06)"
  lg:  "0 8px 24px rgba(10,14,30,0.08)"

duration:
  fast:   150ms   # Button hover, color transitions
  base:   300ms   # Sidebar expand/collapse, panel transitions
  slow:   800ms   # EMQ health ring draw, entrance animations
  stagger: 50ms   # Per-item delay in list entrances

z-index:
  topbar:   100
  dropdown: 200
  modal:    300
  toast:    400

components:
  # --- Buttons (surface: product) ---
  button-primary:
    surface: product
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 8px 16px
    typography: "{typography.ui-body-strong}"
  button-primary-hover:
    surface: product
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.on-primary}"

  button-secondary:
    surface: product
    backgroundColor: transparent
    textColor: "{colors.primary}"
    borderColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 8px 16px
    typography: "{typography.ui-body-strong}"

  button-ghost:
    surface: product
    backgroundColor: transparent
    textColor: "{colors.content-secondary}"
    rounded: "{rounded.md}"
    padding: 8px 16px
    typography: "{typography.ui-body}"
  button-ghost-hover:
    surface: product
    backgroundColor: "{colors.surface-tertiary}"

  # --- Status pills (surface: product) ---
  pill-success:
    surface: product
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success-text}"
    borderColor: "{colors.success-border}"
    rounded: "{rounded.full}"
    padding: 4px 10px
    typography: "{typography.ui-body-strong}"
  pill-warning:
    surface: product
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning-text}"
    borderColor: "{colors.warning-border}"
    rounded: "{rounded.full}"
    padding: 4px 10px
    typography: "{typography.ui-body-strong}"
  pill-danger:
    surface: product
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-text}"
    borderColor: "{colors.danger-border}"
    rounded: "{rounded.full}"
    padding: 4px 10px
    typography: "{typography.ui-body-strong}"
  pill-epa:
    surface: product
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"
    borderColor: "{colors.primary-mid}"
    rounded: "{rounded.full}"
    padding: 4px 10px
    typography: "{typography.ui-body-strong}"
  pill-neutral:
    surface: product
    backgroundColor: "{colors.surface-tertiary}"
    textColor: "{colors.content-secondary}"
    borderColor: "{colors.border}"
    rounded: "{rounded.full}"
    padding: 4px 10px
    typography: "{typography.ui-body-strong}"

  # --- Form (surface: product) ---
  input:
    surface: product
    backgroundColor: "{colors.surface-tertiary}"
    textColor: "{colors.content}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    typography: "{typography.ui-body}"

  # --- Cards (surface: product) ---
  card:
    surface: product
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.xl}"
    padding: 16px

  kpi-card:
    surface: product
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.xl}"
    padding: 16px 20px

  # --- Navigation (surface: product) ---
  nav-item:
    surface: product
    backgroundColor: transparent
    textColor: "{colors.content-secondary}"
    height: 34px
  nav-item-hover:
    surface: product
    backgroundColor: "{colors.surface-tertiary}"
    textColor: "{colors.content}"
  nav-item-active:
    surface: product
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"

  # --- Chrome (surface: product) ---
  topbar:
    surface: product
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    height: "{spacing.topbar}"

  data-table-header:
    surface: product
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.content-tertiary}"
    typography: "{typography.ui-caps}"
    borderColor: "{colors.border}"

  data-table-row:
    surface: product
    backgroundColor: "{colors.surface}"
    textColor: "{colors.content}"
    typography: "{typography.ui-body}"
    borderColor: "{colors.border}"
  data-table-row-hover:
    surface: product
    backgroundColor: "{colors.surface-secondary}"

  # --- Feedback states (surface: product) ---
  empty-state:
    surface: product
    backgroundColor: "{colors.surface}"
    textColor: "{colors.content-tertiary}"
    iconColor: "{colors.border-strong}"
    rounded: "{rounded.xl}"
    padding: 40px 24px

  error-banner:
    surface: product
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-text}"
    borderColor: "{colors.danger-border}"
    rounded: "{rounded.lg}"
    padding: 12px 16px

  info-banner:
    surface: product
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.info-text}"
    borderColor: "{colors.info-border}"
    rounded: "{rounded.lg}"
    padding: 12px 16px

  toast-success:
    surface: product
    backgroundColor: "{colors.surface}"
    textColor: "{colors.content}"
    borderColor: "{colors.success-border}"
    rounded: "{rounded.lg}"
    padding: 12px 16px

  # --- Code / Mono (surface: product) ---
  code-inline:
    surface: product
    backgroundColor: "{colors.surface-tertiary}"
    textColor: "{colors.content}"
    typography: "{typography.ui-mono}"
    rounded: "{rounded.sm}"
    padding: 1px 6px

  # --- Deck components (surface: deck) ---
  deck-eyebrow:
    surface: deck
    textColor: "{colors.accent-cyan}"
    typography: "{typography.d-eyebrow}"

  deck-eyebrow-light:
    surface: deck
    textColor: "{colors.primary}"
    typography: "{typography.d-eyebrow}"

  deck-stat-card:
    surface: deck
    backgroundColor: "rgba(255,255,255,0.08)"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: 20px 24px
---

# EPA Digital Design System

## Overview

EPA Digital es una agencia de performance marketing de ~170 personas con sede en LATAM (México), trabajando con marcas como Coppel, Chedraui, Innovasport, Nestlé y ABInBev, entre otras. El design system cubre dos superficies completamente distintas que deben sentirse como una sola marca cohesiva.

**Superficie product — Pitágoras, dashboards de cliente y herramientas internas:** Densa, orientada a datos, analítica. Diagnósticos de Meta Pixel y CAPI, módulos de performance audit, análisis de funnel, dashboards en Next.js + Tailwind. Siente como un terminal Bloomberg con contención y craft — texto de 13px por defecto, bordes hairline de 0.5px, fondo blanco, pequeños acentos azules. La densidad de información es una característica, no un problema.

**Superficie deck — presentaciones para clientes y QBRs:** Expansiva, segura, de alto impacto. Headlines IBM Plex Sans Bold de 70–96px. Fondos aurora con gradiente profundo (navy → electric blue → violet/cyan). Tipo blanco sobre campos oscuros saturados. Eyebrows en cyan eléctrico. El deck es el espejo inverso del producto: oscuro donde el producto es blanco, grande donde el producto es compacto.

La personalidad de marca en ambas superficies es **data-credible**: experta, directa, nunca fría, nunca inflada. Respeta la inteligencia de analistas y operadores.

---

## Surfaces

La bifurcación más importante del sistema. Antes de generar cualquier pantalla o componente, identificar la superficie.

### Superficie: Product

Aplica para apps internas, dashboards, herramientas de datos, y cualquier interfaz operada por el equipo de EPA o clientes en una sesión de trabajo.

| Propiedad | Valor |
|---|---|
| Fondo de canvas | `surface-secondary` (#FAFAFA) |
| Fondo de cards | `surface` (#FFFFFF) |
| Tipografía default | `ui-body` (IBM Plex Sans 13px) |
| Color primario de acción | `primary` (#003AD6) |
| Separación | Borders hairline 0.5px |
| Gradientes | Prohibidos |
| Accents cyan/magenta | Prohibidos |

### Superficie: Deck

Aplica para presentaciones de clientes, QBRs, case studies, y materiales de pitch.

| Propiedad | Valor |
|---|---|
| Fondo de slide oscuro | `primary-deepest` (#00154B) con gradiente aurora |
| Fondo de slide claro | `surface` (#FFFFFF) |
| Tipografía default | `d-title` (IBM Plex Sans 70px Bold) |
| Eyebrow | `accent-cyan` en slides oscuros, `primary` en slides claros |
| Separación | Sin bordes — separación por contraste de fondo |
| Gradientes | Exclusivos de esta superficie |
| Componentes product | Prohibidos (no usar button-primary, pills, inputs en slides) |

---

## Colors

El sistema está anclado en **EPA Blue (#003AD6)** — un azul confiado, levemente frío, de saturación media. Todos los demás colores son satélites de él.

**Brand core:**
- **Primary (#003AD6):** El anchor de identidad único. Solo a saturación completa — nunca tintado para decoración en product UI. Usado en botones primarios, el indicador activo de nav (barra de 2px), focus rings, acentos del panel de AI-insights y links inline.
- **Primary Dark (#002BAF):** Estado hover y pressed del botón primario. No decorativo.
- **Primary Light (#E8EFFE):** La presencia más suave de la marca — relleno del row activo en nav y fondo del panel AI-insights al 30% de opacidad. Nunca como tint genérico.
- **Primary Mid (#B8CAFE):** Líneas de acento en gráficas, series de datos secundarias únicamente. Nunca para texto.
- **Primary Deepest (#00154B):** Navy casi negro para fondos aurora de slides. Nunca aparece en product UI.
- **Primary Bright (#0051FF):** Azul aurora más saturado — exclusivo para gradientes de deck y la marca.

**Accents — exclusivos de deck y brand:**
- **Accent Cyan (#00E8FF):** Aqua eléctrico para texto de eyebrow en slides, highlights de infografía, énfasis de números hero, y la barra de progreso de slides. Nunca en product UI — se lee demasiado ruidoso sobre blanco.
- **Accent Magenta (#DB0043):** Reservado para momentos de KPI dramáticos en decks ejecutivos. Nunca en product.

**Colores semánticos** siguen un sistema de cuarteto — cada uno tiene `base` (ancla cromática), `bg` (tinte muy claro para fondos), `border` (tinte medio para contornos), y `text` (tono oscuro para texto con contraste AA). Se aplican a pills de status, banners de alerta, bandas de severidad EMQ.

---

## Typography

Una sola familia: **IBM Plex Sans**, hospedada como variable font (eje de peso 100–700, eje de ancho 85–100%). No se permite ninguna otra familia. Fallback: `system-ui, -apple-system, sans-serif`.

**IBM Plex Mono** se usa para datos tabulares, IDs, y código — token `ui-mono`.

**La firma visual del producto es el letter-spacing negativo** aplicado desde 13px hacia arriba — ajuste óptico que hace que el dashboard denso se vea autorado, no genérico. Es no negociable.

### Escala product — analítica, densa

| Token | Size | Weight | Tracking | Rol |
|---|---|---|---|---|
| `ui-h1` | 22px | 600 | −0.5px | Títulos de página, valores KPI primarios |
| `ui-h2` | 18px | 600 | −0.4px | Títulos de sección |
| `ui-h3` | 15px | 600 | −0.3px | Títulos de card, headers de grupo |
| `ui-body` | 13px | 400 | −0.1px | Texto UI por defecto — el caballo de batalla |
| `ui-body-strong` | 13px | 500 | −0.1px | Body enfatizado, valores de tabla, labels activos |
| `ui-md` | 14px | 400 | −0.2px | Body elevado para metadata importante |
| `ui-sm` | 12px | 400 | 0 | Metadata secundaria, timestamps |
| `ui-xs` | 11px | 400 | 0 | Micro labels, captions |
| `ui-caps` | 10px | 600 | +0.6px | Headers de columna, group labels — **siempre uppercase** |
| `ui-mono` | 12px | 400 | 0 | IDs, datos tabulares, código inline |

`ui-caps` es el estilo dominante para group labels en cards y headers de tabla. Es el único uso de uppercase en el producto. Nunca usarlo para oraciones completas.

### Escala deck — espacial, expresiva

| Token | Size | Weight | Tracking | Rol |
|---|---|---|---|---|
| `d-hero` | 96px | 700 | −1.8px | Headline de slide portada |
| `d-title` | 70px | 700 | −1.2px | Default de master PPTX |
| `d-subtitle` | 28px | 400 | −0.3px | Subhead de apoyo en portada |
| `d-body` | 18px | 400 | 0 | Texto de cuerpo en slides |
| `d-caption` | 14px | 400 | 0 | Líneas de atribución, footnotes |
| `d-eyebrow` | 12px | 600 | +1.6px | Categoría de slide sobre el título — **siempre uppercase** |

`d-eyebrow` aparece en `accent-cyan` sobre slides oscuros y `primary` sobre slides claros. La línea decorativa precedente (28px × 1px) es parte del patrón eyebrow.

**Regla de capitalización:** Sentence case en todo. Uppercase es exclusivo de `ui-caps` y `d-eyebrow`. Nunca ALL-CAPS en oraciones o botones CTA.

**Numéricos:** Todos los valores métricos usan `font-variant-numeric: tabular-nums`. Humanizar umbrales: `1.2K` / `340K` / `2.3M`. Porcentajes: un decimal si no es entero, sin `.0` en enteros. Deltas usan `▲` / `▼` (flechas geométricas unicode, no emoji) en color `success` o `danger`. Delta cero → `— sin cambio` en `content-tertiary`.

---

## Layout

### Product (Pitágoras, dashboards de cliente y apps internas)

Tres columnas estructurales fijas, de izquierda a derecha:

1. **Icon sidebar — 52px:** Columna extrema izquierda, fija. Solo íconos de módulo — sin text labels. Fondo `surface`, separador hairline `border-right`.
2. **Nav panel — 200px expandido / 48px colapsado:** Adyacente al icon sidebar. Navegación textual con group labels en `ui-caps`. Ancho animado en 300ms `ease-out-expo`. Fondo `surface`, hairline `border-right`.
3. **Content area:** Ocupa el viewport restante. Sin max-width en páginas de datos. Gutters internos de 16–20px. Canvas `surface-secondary` (#FAFAFA).

**Topbar:** Fijo 56px, span completo sobre columnas 2 y 3. Contiene breadcrumb (`ui-sm`), live-status dot, búsqueda global, avatar. Fondo `surface`, border-bottom 0.5px.

**Grid:** `grid-gutter: 16px`, `grid-margin: 20px`, `grid-max-width: 1440px`. Spacing siempre en múltiplos de 4px.

### Deck

Canvas fijo: **1280×720px**, escalado proporcionalmente vía `transform: scale()`. Márgenes de slide: 56–72px desde los bordes. En slides oscuros (portada, separador de sección, datos), la gravedad del contenido es bottom-anchored — el headline cerca del fondo con cielo arriba. En slides claros (título+cuerpo, comparación), el contenido centra verticalmente en el 60% izquierdo.

---

## Elevation & Depth

**Product: bordes hairline, sombras mínimas.** `0.5px solid #E5E5E5` separa cada card, panel, e input de su vecino. El valor 0.5px produce "airy density" — máxima información por pantalla sin congestión visual. Debe aplicarse via `style` inline o utility CSS dedicada — la clase `border` de Tailwind redondea a 1px.

| Token | Valor | Uso |
|---|---|---|
| `shadows.sm` | `0 1px 2px rgba(10,14,30,0.04)` | Hover lift en cards interactivas, combinado con `translateY(-1px)` |
| `shadows.md` | `0 2px 6px rgba(10,14,30,0.06)` | Estado resting de cards cuando se necesita elevación |
| `shadows.lg` | `0 8px 24px rgba(10,14,30,0.08)` | Modals, dropdowns |

Color de sombra ink-tinted (`rgba(10,14,30,...)`) — nunca negro puro. Sin sombras multicapa. Sin glow effects. `backdrop-filter: blur()` no es parte del lenguaje product.

**Deck:** Slides son flat. Sin sombras de card en slides de fondo oscuro. Stat cards inset en slides claros pueden usar `shadows.sm`.

---

## Shapes

Radios ajustados — funcionales, no amigables:

| Token | Valor | Uso |
|---|---|---|
| `rounded.sm` | 4px | Sub-componentes, chips anidados dentro de otros chips |
| `rounded.md` | 6px | **Default** — botones, pills, inputs, status badges |
| `rounded.lg` | 8px | Panels, table cards |
| `rounded.xl` | 10px | KPI cards |
| `rounded.2xl` | 12px | Large panels, modals |
| `rounded.full` | 9999px | Avatars, live-status dot, tag pills |

Nunca usar 20px+ de radio — se leen como consumer/friendly, lo que contradice la personalidad experta/analítica del sistema. En deck: cero radio para fondos full-bleed (aurora) o 8–12px para stat cards inset en slides claros.

---

## Animation

Todas las animaciones usan `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) — decisivo y preciso, nunca bounce.

| Token | Valor | Uso |
|---|---|---|
| `duration.fast` | 150ms | Hover de botones, transiciones de color |
| `duration.base` | 300ms | Expand/collapse del sidebar, transiciones de panel |
| `duration.slow` | 800ms | Dibujado del EMQ health ring, animaciones de entrada |
| `duration.stagger` | 50ms | Delay por item en entradas de lista |

**Reglas:**
- Usar `ease-out-expo` para todas las animaciones de entrada, transiciones de layout, y cambios de ancho del sidebar.
- No agregar easing bounce — el sistema se lee como preciso y decisivo.
- La única animación idle permitida es `pulse-ring` (el live-status dot en topbar).
- Siempre respetar `prefers-reduced-motion`: sobreescribir todos los `animation-duration` a `0.01ms` globalmente.
- Escalonar entradas de lista con 50ms de delay por item — sin cascada simultánea.

---

## Components

### Botones

Tres niveles. Todos comparten: radio 6px, fuente `ui-body-strong`, transición de 150ms en color (no opacidad), focus ring `ring-2 ring-primary ring-offset-1`, estado disabled `opacity-50 cursor-not-allowed`.

- **Primary:** Relleno EPA Blue, texto blanco. Hover: `primary-dark`. El único botón que domina la vista. `surface: product`.
- **Secondary:** Fondo transparente, border `primary` (0.5px), texto `primary`. Mismo tamaño que primary — usar cuando ya existe una acción primary en pantalla. `surface: product`.
- **Ghost:** Transparente, texto `content-secondary`, sin border. Acciones terciarias (filtro, ordenar, descartar). Hover: fondo `surface-tertiary`. `surface: product`.

### Status Pills

`rounded.full` (9999px), 11px / 500 weight, padding 4×10px, border 0.5px. Cinco tonos: `success`, `warning`, `danger`, `neutral`, y `epa` (azul marca). Cada tono usa su trío bg/text/border — nunca un solo color para las tres propiedades. Punto indicador opcional de 6px usa el color base del tono.

Uso: labels de salud de señal (`Señal saludable`, `Señal en alerta`, `Señal crítica`), bandas de severidad EMQ, estado de procesamiento de eventos, tags `Próximamente`.

### Form Inputs

Fondo `surface-tertiary`, hairline `border` 0.5px, radio 6px, padding 8×12px, fuente `ui-body` (13px). Focus: `ring-2 ring-primary ring-offset-1` — misma ring que botones. Variante search: ícono Lucide `search` de 16px inset izquierdo con offset de padding correspondiente.

### Navigation (Two-Panel Sidebar)

**Icon sidebar (52px):** Solo íconos de módulo. Ícono activo: color `primary`. Inactivo: `content-tertiary`.

**Nav panel (200px):** Group labels en `ui-caps` (10px, uppercase, wide-tracked): `ANÁLISIS` · `DATOS` · `IA` · `CUENTA`. Rows de 34px de altura. Row activo: fondo `primary-light` + barra izquierda de 2px en `primary` + texto `primary`. Hover: fondo `surface-tertiary`, transición 150ms.

La barra indicadora activa se desliza entre secciones — implementar como elemento animado que rastrea la posición Y del item activo, no como border estático en cada row.

### KPI Cards

Fondo `surface`, border 0.5px, radio 10px, padding 16×20px. Estructura top-bottom: label `ui-caps` → valor `ui-h1` (tabular-nums) → label de delta opcional. Delta: `▲`/`▼` + valor en color `success`/`danger`. Delta nulo: `— sin cambio` en `content-tertiary`.

### EMQ Health Ring

SVG ring de 64px. Score 0–10. Bracket de color: `danger` (<4), `warning` (4–6), `success` (≥6). Animado en mount: `stroke-dashoffset` dibujado con `ease-out-expo` en 800ms. Score cuenta hacia arriba numéricamente. El ring y el score son semánticamente inseparables — nunca mostrar uno sin el otro.

### Data Table

Headers de columna: `ui-caps` (10px, uppercase, +0.6px tracking), fondo `surface-secondary`, border-bottom 0.5px. Rows de datos: `ui-body` (13px), border-bottom 0.5px, hover → fondo `surface-secondary`. Todas las columnas numéricas: `tabular-nums`. Usar `ui-body-strong` (500) para identificadores primarios (nombres de eventos, nombres de cuenta) y `ui-body` (400) para columnas de metadata.

### Topbar

Fijo 56px. Fondo `surface`, border-bottom 0.5px. Izquierda: breadcrumb en `ui-sm` (`content-tertiary › página-actual`). Derecha: live-signal pulse dot (círculo 8px en `success`, animación `pulse-ring` — 1800ms infinite), trigger de búsqueda global, avatar de usuario. El live dot comunica conectividad en tiempo real — debe animar mientras un stream de datos en vivo está activo.

### Empty States

Fondo `surface`, radio `rounded.xl`, padding 40×24px. Estructura: ícono Lucide 24px en `content-tertiary` → título en `ui-h3` → descripción en `ui-body` en `content-secondary` → acción primaria opcional. Copy en español, sentence case, con periodo al final de la descripción.

Ejemplo: ícono `inbox` → "Sin datos disponibles" → "Aún no hay información para mostrar en este periodo. Ajusta el rango de fechas para ver resultados." → botón ghost "Cambiar periodo".

### Error Banner

Fondo `danger-bg`, border `danger-border` 0.5px, radio `rounded.lg`, padding 12×16px. Ícono Lucide `alert-circle` 16px en `danger`. Texto en `danger-text`. Siempre incluir una acción de recuperación cuando sea posible (`Reintentar`, `Contactar soporte`).

### Info Banner

Fondo `info-bg`, border `info-border` 0.5px, radio `rounded.lg`, padding 12×16px. Para estados informativos no críticos, onboarding tips, y confirmaciones de acción.

### Toast Notifications

Fondo `surface`, border lateral (4px) en el color semántico correspondiente, radio `rounded.lg`, padding 12×16px, `shadows.lg`. Z-index `z-index.toast` (400). Duración visible: 4 segundos para info/success, persistente para error hasta acción del usuario.

### Code Inline

Fondo `surface-tertiary`, fuente `ui-mono` (IBM Plex Mono 12px), radio `rounded.sm`, padding 1×6px. Para IDs, tokens, valores de configuración, y código inline en prosa.

---

## Iconography

Lucide (`lucide-react`) es el único set de íconos permitido en product UI — 16px por defecto, stroke-width 1.5, color match con el texto de contexto. No usar estilos filled. No escalar Lucide por encima de 24px.

No usar íconos inline en decks — usar motivos de marca basados en imagen del directorio `assets/` (marca Penrose, fondos aurora, patrones de puntos).

---

## Spanish Copy Guidelines

Todo el copy de UI va en **español, sentence case, segunda persona informal** (tú, tu sesión, actualizar).

**Loanwords que permanecen en inglés:** Pixel, CAPI, EMQ, Funnel, Quick Wins, Insights, Overview, Dashboard, Performance, Benchmark, Signal.

**Separadores y caracteres:**
- Metadata: `·` (middle dot U+00B7)
- Breadcrumbs: `›` (rsaquo U+203A)
- Deltas: `▲` / `▼` (flechas geométricas U+25B2 / U+25BC) — nunca emoji
- Rangos numéricos: `–` (en dash U+2013), no guión simple

**Numeración:**
- Humanizar grandes números: `1.2K`, `340K`, `2.3M`
- Porcentajes: un decimal si no es entero (`12.4%`), sin `.0` en enteros (`12%`)
- Delta cero: `— sin cambio` en `content-tertiary`
- Siempre `font-variant-numeric: tabular-nums` en valores métricos y columnas numéricas

**Puntuación en UI:**
- Labels y botones: sin punto final
- Empty states, help text, descripciones: con punto final
- Nunca ALL-CAPS en oraciones o CTAs — uppercase solo para `ui-caps` y `d-eyebrow`
- No usar "usted" — siempre `tú`

**Voz:** Directa, experta, sin relleno. "Ver reporte" no "Haz clic aquí para ver tu reporte". "Sin datos" no "Parece que no hay datos disponibles en este momento".

---

## Do's and Don'ts

**Colores:**
- Usar `primary` (#003AD6) a saturación completa. Nunca tintarlo para decoración.
- Usar `accent-cyan` y `accent-magenta` exclusivamente en deck y brand — nunca en product UI.
- No usar negro puro (#000000). Usar `ink` (#0E141E) para los momentos más oscuros.
- No usar gradientes de fondo en product UI. Los gradientes son exclusivamente un motivo de deck.
- Siempre usar el trío semántico completo (bg + border + text) para pills y banners — nunca un solo color para las tres propiedades.
- No usar `backdrop-filter: blur()` — no es parte del lenguaje product.

**Tipografía:**
- Aplicar letter-spacing negativo a todo el tipo product desde 13px hacia arriba — es la firma visual.
- No usar más de dos font weights en una sola pantalla product.
- Reservar uppercase para `ui-caps` y `d-eyebrow` únicamente. Nunca ALL-CAPS en oraciones o CTAs.
- No usar itálica en product UI. Existe en la fuente pero no es parte del sistema.
- Usar `font-variant-numeric: tabular-nums` en cada valor métrico, columna numérica de tabla, e ID.

**Bordes y separación:**
- Usar hairline borders de 0.5px para toda separación de cards, panels, e inputs en product UI.
- No usar borders de 1px — se leen más pesados de lo diseñado.
- Los shadows son para hover lift únicamente — los borders son el separador primario.

**Formas:**
- No mezclar radios redondeados (≥12px) y ajustados (≤6px) en el mismo componente.
- No usar radios de 20px+ en ningún lugar — contradicen la personalidad experta/analítica.

**Superficies:**
- No usar componentes product (button-primary, pills, inputs) en slides de deck.
- No usar gradientes aurora ni accent-cyan en product UI.
- Identificar siempre la superficie destino antes de generar cualquier componente.

**Z-index:**
- Usar siempre los tokens de z-index definidos: topbar (100), dropdown (200), modal (300), toast (400).
- No inventar valores de z-index ad-hoc — generan conflictos en apps con múltiples capas.

**Animación:**
- Usar `ease-out-expo` para todas las animaciones de entrada y transiciones de layout.
- No usar bounce easing — el sistema es preciso y decisivo.
- Respetar `prefers-reduced-motion` globalmente.
- No agregar animaciones idle más allá del `pulse-ring` del live-status dot.

**Copy:**
- Escribir todo el copy de UI en español, sentence case, segunda persona informal.
- Mantener loanwords técnicos en inglés: Pixel, CAPI, EMQ, Funnel, Quick Wins, Insights, Overview.
- No usar emoji — usar `▲` / `▼` para deltas, `·` para separación de metadata.
- Terminar labels y botones sin punto. Terminar empty states y help text con punto.
- Humanizar números grandes: `1.2K`, `340K`, `2.3M`. Nunca `1200` en bruto.

**Iconografía:**
- Usar Lucide (`lucide-react`) exclusivamente en product — 16px, stroke-width 1.5.
- No usar estilos filled ni escalar Lucide por encima de 24px.
- No usar íconos inline en decks.
