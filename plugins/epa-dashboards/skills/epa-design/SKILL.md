---
name: epa-design
description: >
  Design system oficial de EPA Digital para dashboards. Activar SIEMPRE que
  el usuario vaya a construir o modificar interfaces de dashboard, o
  cualquier output con presencia visual: HTML, JSX/TSX, CSS, componentes UI,
  copy de UI, tipografía, paleta, espaciado, animaciones. También activar
  ante términos como "diseño", "branding", "tokens", "componente", "UI",
  "Tailwind", "estilo EPA", "color azul EPA" o cuando el usuario pida "que
  se vea bonito" o "estilo agencia". Provee tokens exactos (colores,
  tipografía IBM Plex, espaciado, sombras), componentes copy-paste y guía
  de copy en español.
---

# EPA Design System — versión product (dashboards)

> Esta es la versión **product-only** del design system, para dashboards.
> La spec completa de la agencia (que también cubre presentaciones/deck)
> la mantiene el área de Diseño — si necesitas un slide o una presentación
> a cliente, esa superficie no vive en este plugin.

---

## Identidad en 30 segundos

```
Color anchor:     Primary de epa-ui (oklch 0.546 0.245 262.881 = Tailwind
                   blue-600) en superficie de producto — ver nota abajo.
                   #003AD6 sigue siendo el azul de marca de la agencia.
Tipografía:       IBM Plex Sans (UI) · IBM Plex Mono (números, code)
Voz UX:           Español LATAM, segunda persona informal (tú), sentence case
Border radius:    escala de epa-ui, hasta 4xl (~26px) — ver tokens.md
Densidad UI:      13px body, 22px h1, hairlines 0.5px, espaciado 8/16/24/40
Animación:        150ms hover, 300ms paneles, 800ms entradas
```

> **Cambio de autoridad de color (jcorona, 2026-08-20).** El azul de
> superficies de producto ya no es `#003AD6` — es el `--primary` real de
> `epa-ui`, la librería de componentes que se adoptó completa (ver
> `references/epa-ui.md`). Decisión explícita: "epa-ui gana tal cual", para
> no mantener un overlay de color sobre una librería que ningún componente
> hardcodea. **La frontera se mantiene:** esto es solo la superficie de
> producto que este skill ya declaraba cubrir — `#003AD6` sigue siendo el
> azul de marca de la agencia (decks, sitio, presentaciones), que mantiene
> el área de Diseño fuera de este plugin. Consecuencia aceptada: un
> dashboard ya no es pixel-consistente con esas superficies en el azul
> primario.

---

## Cuándo cargar referencias

Este SKILL es solo el índice. Para cualquier trabajo concreto, abrir el reference
correspondiente — ahí están los valores exactos copy-paste:

| Necesidad | Reference |
|---|---|
| Tokens (CSS vars OKLCH, escalas reales) | `references/tokens.md` |
| Componentes de producto (qué usar, cómo se consume, estado semántico) | `references/epa-ui.md` |
| Copy de UI (microcopy, errores, vacíos, cifras) | `references/copy.md` |
| Spec completa del design system (YAML autoritativo, marca) | `references/DESIGN.md` |
| `references/components.md` (HTML/CSS a mano) | **SUPERSEDED** por `epa-ui.md` — ver nota ahí |

`references/DESIGN.md` es la fuente de verdad de **marca**. En superficie de
producto (color, componentes, radius, sombras), donde `DESIGN.md` contradiga
al código real de `epa-ui`, gana `epa-ui` — ver `references/epa-ui.md`.

---

## Reglas no-negociables

### Color
- **El primary de producto es el de `epa-ui`** (`oklch(0.546 0.245
  262.881)`, ver nota de arriba) — no `#003AD6`. No introducir un azul
  distinto al de `app/globals.css` de `epa-ui` en ningún dashboard.
- **Magenta `#DB0043` y cyan `#00E8FF` están prohibidos** en cualquier UI de
  dashboard.
- Los semánticos (success/warning/danger/info) **no existen todavía como
  variante de componente** en `epa-ui` — usar la regla provisional de
  `references/epa-ui.md` (deltas por `secondary`/`destructive` + ícono de
  dirección; status pills por mapa explícito). No inventar una variante
  paralela ni reemplazar con paletas tipo "tailwind default green-500".

### Tipografía
- **IBM Plex Sans** en todo. NO Inter, NO Roboto, NO system-ui sin Plex.
  Si Plex no está cargado, agregar `@import` o `<link>` antes de cualquier UI.
- **IBM Plex Mono** para cifras tabulares y bloques de código.
- `body = 13px`. Densidad alta es intencional, no error.

### Layout
- Hairlines: `border: 0.5px solid var(--border)`. NO `1px` por default.
- Border radius: escala de `epa-ui` (`sm`…`4xl`, hasta ~26px) — no la escala
  vieja de 6/8/9999px. Ver `references/epa-ui.md` y `tokens.md`.
- Sombras: **las de Tailwind** (`shadow-sm/md/lg/xl`) por elevación — ver
  `references/epa-ui.md`. La regla vieja de "sombras custom, no Tailwind
  default" era incorrecta contra el código real.

### Copy
- Español LATAM, segunda persona informal: "tu reporte", no "su reporte".
- Sentence case en labels y botones: "Ver reporte", no "Ver Reporte".
- Loanwords en inglés sin cursivas: Pixel, CAPI, EMQ, Funnel, ROAS, Insights.
- Separadores: `·` (U+00B7) para metadata, `›` (U+203A) en breadcrumbs.
- Deltas: `▲` y `▼` (NO `↑↓` ni `+/-`).
- Rangos de fecha: `–` (en dash, U+2013), no guion.
- Detalles completos en `references/copy.md`.

---

## Flujo recomendado para una nueva UI

1. **Copiar `epa-ui`** a commit fijado (ver `references/epa-ui.md`) — de
   ahí salen los tokens OKLCH y las fuentes ya configuradas, no de un
   bloque suelto.
2. **Cargar fuente:** asegurarse de que IBM Plex Sans + Plex Mono estén
   disponibles — `epa-ui` ya las trae vía `next/font/google` en
   `app/layout.tsx`, normalmente no hay nada que agregar.
3. **Construir con componentes de `epa-ui`** (`references/epa-ui.md`). NO
   inventar buttons/cards/pills nuevos — si el componente que necesitas no
   existe ahí, avisa al usuario para pedirlo, no lo improvises.
4. **Escribir copy con `copy.md`** abierto al lado.
5. **Verificar** contra el checklist al final de este SKILL antes de cerrar el
   ticket.

---

## Patrones específicos de EPA

### KPI cards
- Border radius: `xl` (10px).
- Número grande en IBM Plex Mono, 36–48px.
- Delta abajo con `Badge` de `epa-ui` (`secondary` mejora / `destructive`
  empeora) + ícono de dirección — **no** "color semántico" genérico, `epa-ui`
  no tiene esa variante. Ver `references/epa-ui.md`.
- Label superior en `ui-caps` (10px, letter-spacing 0.6px, uppercase).

### Status pills
- `Badge` de `epa-ui` con un `Record<Status, BadgeVariant>` explícito por
  dashboard, sobre `default | secondary | destructive | outline | ghost |
  link` — ver `references/epa-ui.md`.
- NO inventar una variante `success`/`warning`/`info` que no existe.

### Tablas de datos densas
- Row height: 32–36px.
- Hairline 0.5px entre rows.
- Hover row: `var(--surface-tertiary)` (#F5F5F5).
- Números en Plex Mono, alineación derecha, `tabular-nums`.

---

## Animación

```
duration.fast    150ms   hover de buttons, transiciones de color
duration.base    300ms   sidebar expand, panel transitions
duration.slow    800ms   entradas grandes (hero numbers, EMQ ring)
duration.stagger 50ms    delay por item en listas
```

Easing por default: `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard).

---

## Anti-patrones que rechazar

```
✗ Mezclar Inter o Roboto con Plex
✗ Usar magenta #DB0043 o cyan #00E8FF en cualquier UI
✗ Botones con esquinas pill (solo en pills/badges)
✗ ALL CAPS fuera de eyebrows y caps tokens
✗ Colores hex inline en JSX/HTML — siempre usar var() o token
✗ Espaciado fuera de la escala (ej. 13px, 18px, 27px como padding/margin/gap
  — 13px y 18px SÍ son tamaños válidos de tipografía, la regla es sobre
  espaciado, no sobre font-size)
✗ Copy en inglés en interfaces de cliente español sin razón explícita
✗ Animaciones >800ms en interacciones de UI
✗ Reusar --chart-N como color de estado (success/warning/error) — son
  tokens de serie de datos, no semánticos (ver references/epa-ui.md)
✗ Inventar una variante "success"/"warning"/"info" en Badge/Alert que no
  existe en epa-ui — usar la regla provisional de delta/status pills
```

---

## Checklist antes de cerrar UI

```
TOKENS
[ ] Solo colores de epa-ui / tokens.md (sin hex inline)
[ ] IBM Plex Sans cargado, body 13px
[ ] Border radius dentro de la escala de epa-ui (sm...4xl)
[ ] Espaciado dentro de la escala (4/8/16/24/40/72)

COMPONENTES
[ ] Botones, pills y cards copiados de epa-ui a commit fijado (no
    reinventados) — ver references/epa-ui.md
[ ] Delta de KPI y status pills siguen la regla provisional de estado
    semántico (secondary/destructive + ícono; Record<Status, BadgeVariant>)
[ ] Tablas con hairlines 0.5px y números en Plex Mono
[ ] Estados hover/focus/disabled definidos

COPY
[ ] Sentence case en labels y botones
[ ] Segunda persona informal (tú)
[ ] Sin loanwords en cursiva ni comillas
[ ] Separadores correctos (·, ›, ▲▼, en dash)

ACCESIBILIDAD
[ ] Contraste AA mínimo en texto sobre fondo
[ ] Focus visible en elementos interactivos
[ ] Tamaños de touch target ≥ 32px en interactivos primarios
```

---

## Cuándo escalar al área de Diseño

- Cliente nuevo sin paleta secundaria definida.
- Componente que no existe en `epa-ui` — es un pedido para `@iescutia`
  (ver `references/epa-ui.md`), no algo que se improvise localmente.
- Discrepancia entre lo que pide el cliente y los tokens (no improvisar — escalar).
- Cualquier propuesta de cambiar el primary de producto o la tipografía base.
- Cualquier necesidad de presentación/deck — fuera de alcance de este plugin
  (ahí sí sigue vigente `#003AD6` como azul de marca).
