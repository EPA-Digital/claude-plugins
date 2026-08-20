---
# ⚠️ SCOPE NOTE (2026-08): this file is the brand-authoritative spec — colors,
# type scale, spacing as originally defined. Where it describes a PRODUCT
# surface (color primary, component radius/shadow scale) and contradicts the
# real epa-ui codebase (epa-datos/epa-ui, see
# ../epa-ui.md), epa-ui wins — that decision is recorded in SKILL.md. This
# file keeps full authority over brand/deck surfaces, which epa-ui doesn't
# touch at all.
version: alpha
name: EPA Digital Design System (product-only)
description: >
  Design system for EPA Digital dashboards — a performance-marketing agency
  (~170 people, LATAM HQ). This is the product-surface subset: dense
  product UI (client dashboards, internal analytics tools). The full
  agency design system (which also covers brand/deck — client
  presentations, QBRs) is maintained by the área de Diseño, outside this
  plugin. All user-facing copy defaults to Spanish (LATAM professional
  register, informal second-person).

colors:
  # --- Brand core ---
  primary:          "#003AD6"   # EPA Blue — the identity anchor
  primary-dark:     "#002BAF"   # Hover / pressed
  primary-mid:      "#B8CAFE"   # Chart accent, secondary data series
  primary-light:    "#E8EFFE"   # Active nav fill, AI-insights tint

  # --- Brand neutrals ---
  ink:              "#0E141E"   # Near-black — use instead of pure #000000

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
---

# EPA Digital Design System — product (dashboards)

> Versión product-only, para dashboards. La spec completa de la agencia
> (que también cubre presentaciones/deck) la mantiene el área de Diseño —
> no es propiedad de este repo.

## Overview

EPA Digital es una agencia de performance marketing de ~170 personas con sede en LATAM (México), trabajando con marcas como Coppel, Chedraui, Innovasport, Nestlé y ABInBev, entre otras.

**Superficie product — dashboards de cliente y herramientas internas:** Densa, orientada a datos, analítica. Dashboards en Next.js + Tailwind. Siente como un terminal Bloomberg con contención y craft — texto de 13px por defecto, bordes hairline de 0.5px, fondo blanco, pequeños acentos azules. La densidad de información es una característica, no un problema.

La personalidad de marca es **data-credible**: experta, directa, nunca fría, nunca inflada. Respeta la inteligencia de analistas y operadores.

---

## Colors

El sistema está anclado en **EPA Blue (#003AD6)** — un azul confiado, levemente frío, de saturación media. Todos los demás colores son satélites de él.

- **Primary (#003AD6):** El anchor de identidad único. Solo a saturación completa — nunca tintado para decoración. Usado en botones primarios, el indicador activo de nav (barra de 2px), focus rings, acentos del panel de AI-insights y links inline.
- **Primary Dark (#002BAF):** Estado hover y pressed del botón primario. No decorativo.
- **Primary Light (#E8EFFE):** La presencia más suave de la marca — relleno del row activo en nav y fondo del panel AI-insights al 30% de opacidad. Nunca como tint genérico.
- **Primary Mid (#B8CAFE):** Líneas de acento en gráficas, series de datos secundarias únicamente. Nunca para texto.

**Magenta (#DB0043) y cyan (#00E8FF) están prohibidos.** No son parte de este sistema — no los uses aunque los veas en algún material de marca de la agencia (viven en la superficie deck, fuera de alcance aquí).

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

**Regla de capitalización:** Sentence case en todo. Uppercase es exclusivo de `ui-caps`. Nunca ALL-CAPS en oraciones o botones CTA.

**Numéricos:** Todos los valores métricos usan `font-variant-numeric: tabular-nums`. Humanizar umbrales: `1.2K` / `340K` / `2.3M`. Porcentajes: un decimal si no es entero, sin `.0` en enteros. Deltas usan `▲` / `▼` (flechas geométricas unicode, no emoji) en color `success` o `danger`. Delta cero → `— sin cambio` en `content-tertiary`.

---

## Layout

Tres columnas estructurales fijas, de izquierda a derecha:

1. **Icon sidebar — 52px:** Columna extrema izquierda, fija. Solo íconos de módulo — sin text labels. Fondo `surface`, separador hairline `border-right`.
2. **Nav panel — 200px expandido / 48px colapsado:** Adyacente al icon sidebar. Navegación textual con group labels en `ui-caps`. Ancho animado en 300ms `ease-out-expo`. Fondo `surface`, hairline `border-right`.
3. **Content area:** Ocupa el viewport restante. Sin max-width en páginas de datos. Gutters internos de 16–20px. Canvas `surface-secondary` (#FAFAFA).

**Topbar:** Fijo 56px, span completo sobre columnas 2 y 3. Contiene breadcrumb (`ui-sm`), live-status dot, búsqueda global, avatar. Fondo `surface`, border-bottom 0.5px.

**Grid:** `grid-gutter: 16px`, `grid-margin: 20px`, `grid-max-width: 1440px`. Spacing siempre en múltiplos de 4px.

---

## Elevation & Depth

**Bordes hairline, sombras mínimas.** `0.5px solid #E5E5E5` separa cada card, panel, e input de su vecino. El valor 0.5px produce "airy density" — máxima información por pantalla sin congestión visual. Debe aplicarse via `style` inline o utility CSS dedicada — la clase `border` de Tailwind redondea a 1px.

| Token | Valor | Uso |
|---|---|---|
| `shadows.sm` | `0 1px 2px rgba(10,14,30,0.04)` | Hover lift en cards interactivas, combinado con `translateY(-1px)` |
| `shadows.md` | `0 2px 6px rgba(10,14,30,0.06)` | Estado resting de cards cuando se necesita elevación |
| `shadows.lg` | `0 8px 24px rgba(10,14,30,0.08)` | Modals, dropdowns |

Color de sombra ink-tinted (`rgba(10,14,30,...)`) — nunca negro puro. Sin sombras multicapa. Sin glow effects. `backdrop-filter: blur()` no es parte del lenguaje product.

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

Nunca usar 20px+ de radio — se leen como consumer/friendly, lo que contradice la personalidad experta/analítica del sistema.

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

- **Primary:** Relleno EPA Blue, texto blanco. Hover: `primary-dark`. El único botón que domina la vista.
- **Secondary:** Fondo transparente, border `primary` (0.5px), texto `primary`. Mismo tamaño que primary — usar cuando ya existe una acción primary en pantalla.
- **Ghost:** Transparente, texto `content-secondary`, sin border. Acciones terciarias (filtro, ordenar, descartar). Hover: fondo `surface-tertiary`.

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

Lucide (`lucide-react`) es el único set de íconos permitido — 16px por defecto, stroke-width 1.5, color match con el texto de contexto. No usar estilos filled. No escalar Lucide por encima de 24px.

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
- Nunca ALL-CAPS en oraciones o CTAs — uppercase solo para `ui-caps`
- No usar "usted" — siempre `tú`

**Voz:** Directa, experta, sin relleno. "Ver reporte" no "Haz clic aquí para ver tu reporte". "Sin datos" no "Parece que no hay datos disponibles en este momento".

---

## Do's and Don'ts

**Colores:**
- Usar `primary` (#003AD6) a saturación completa. Nunca tintarlo para decoración.
- No usar magenta (#DB0043) ni cyan (#00E8FF) — no son parte de este sistema.
- No usar negro puro (#000000). Usar `ink` (#0E141E) para los momentos más oscuros.
- No usar gradientes de fondo — no son parte de este sistema.
- Siempre usar el trío semántico completo (bg + border + text) para pills y banners — nunca un solo color para las tres propiedades.
- No usar `backdrop-filter: blur()` — no es parte del lenguaje product.

**Tipografía:**
- Aplicar letter-spacing negativo a todo el tipo desde 13px hacia arriba — es la firma visual.
- No usar más de dos font weights en una sola pantalla.
- Reservar uppercase para `ui-caps` únicamente. Nunca ALL-CAPS en oraciones o CTAs.
- No usar itálica. Existe en la fuente pero no es parte del sistema.
- Usar `font-variant-numeric: tabular-nums` en cada valor métrico, columna numérica de tabla, e ID.

**Bordes y separación:**
- Usar hairline borders de 0.5px para toda separación de cards, panels, e inputs.
- No usar borders de 1px — se leen más pesados de lo diseñado.
- Los shadows son para hover lift únicamente — los borders son el separador primario.

**Formas:**
- No mezclar radios redondeados (≥12px) y ajustados (≤6px) en el mismo componente.
- No usar radios de 20px+ en ningún lugar — contradicen la personalidad experta/analítica.

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
- Usar Lucide (`lucide-react`) exclusivamente — 16px, stroke-width 1.5.
- No usar estilos filled ni escalar Lucide por encima de 24px.
