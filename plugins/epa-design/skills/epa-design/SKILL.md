---
name: epa-design
description: >
  Design system oficial de EPA Digital. Activar SIEMPRE que el usuario vaya a
  construir o modificar interfaces (dashboards, webapps, landings, decks, slides,
  reportes visuales) o cualquier output con presencia visual: HTML, JSX/TSX, CSS,
  componentes UI, copy de UI, tipografía, paleta, espaciado, animaciones.
  También activar ante términos como "diseño", "branding", "tokens", "componente",
  "UI", "Tailwind", "estilo EPA", "color azul EPA", "deck", "slide", "presentación"
  o cuando el usuario pida "que se vea bonito" o "estilo agencia". Provee tokens
  exactos (colores, tipografía IBM Plex, espaciado, sombras), componentes copy-paste
  y guía de copy en español.
---

# EPA Design System

Sistema de diseño oficial de EPA Digital. Cubre dos superficies que NO se mezclan:

```
PRODUCT SURFACE          DECK / BRAND SURFACE
─────────────────        ─────────────────────
Dashboards internos      Presentaciones a cliente
AuditOS, Kalman          QBRs, case studies
Apps de vibecoding       Landing de marca
13px body por default    96px hero por default
Densidad alta            Espaciado dramático
Sin acentos magenta      Acentos magenta/cyan permitidos
```

Antes de escribir CSS, confirmar superficie. Aplicar tokens del bloque correcto.

---

## Identidad en 30 segundos

```
Color anchor:     EPA Blue  #003AD6
Tipografía:       IBM Plex Sans (UI + deck) · IBM Plex Mono (números, code)
Voz UX:           Español LATAM, segunda persona informal (tú), sentence case
Border radius:    md=6px (default) · lg=8px (panels) · full (pills, dot)
Densidad UI:      13px body, 22px h1, hairlines 0.5px, espaciado 8/16/24/40
Densidad Deck:    18px body, hero 96px, espaciado 24/40/72, gradientes aurora
Animación:        150ms hover, 300ms paneles, 800ms entradas
```

---

## Cuándo cargar referencias

Este SKILL es solo el índice. Para cualquier trabajo concreto, abrir el reference
correspondiente — ahí están los valores exactos copy-paste:

| Necesidad | Reference |
|---|---|
| Tokens (CSS vars, Tailwind config, TS export) | `references/tokens.md` |
| Componentes (HTML/CSS, React/Tailwind copy-paste) | `references/components.md` |
| Copy de UI (microcopy, errores, vacíos, cifras) | `references/copy.md` |
| Spec completa del design system (YAML autoritativo) | `references/DESIGN.md` |

`references/DESIGN.md` es la fuente de verdad. Si hay conflicto entre archivos,
gana DESIGN.md.

---

## Reglas no-negociables

### Color
- **Solo `#003AD6`** como azul EPA en product. Nada de `#0040FF`, `#0033CC`,
  `#003ACC` ni variantes "parecidas". Si el código tiene un azul que no está
  en `tokens.md`, está mal.
- **Magenta `#DB0043` y cyan `#00E8FF`** existen solo en deck. Bloqueados en
  product UI.
- Los semánticos (success/warning/danger/info) son fijos. No reemplazar con
  paletas tipo "tailwind default green-500".

### Tipografía
- **IBM Plex Sans** en todo. NO Inter, NO Roboto, NO system-ui sin Plex.
  Si Plex no está cargado, agregar `@import` o `<link>` antes de cualquier UI.
- **IBM Plex Mono** para cifras tabulares y bloques de código.
- En product, `body = 13px`. Densidad alta es intencional, no error.

### Layout
- Hairlines: `border: 0.5px solid var(--border)`. NO `1px` por default.
- Border radius: `6px` (md) en buttons/inputs/pills. `8px` (lg) en panels.
  `9999px` (full) en pills y avatares.
- Sombras: `sm`/`md`/`lg` definidas en tokens. NO sombras Tailwind default.

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

1. **Identificar superficie:** product o deck.
2. **Cargar tokens:** copiar el bloque CSS vars o Tailwind config de `tokens.md`
   al proyecto.
3. **Cargar fuente:** asegurarse de que IBM Plex Sans + Plex Mono estén
   disponibles (Google Fonts, self-hosted, o `@fontsource/ibm-plex-sans`).
4. **Construir con componentes existentes** de `components.md`. NO inventar
   buttons/cards/pills nuevos antes de revisar este archivo.
5. **Escribir copy con `copy.md`** abierto al lado.
6. **Verificar** contra el checklist al final de este SKILL antes de cerrar el
   ticket.

---

## Patrones específicos de EPA

### KPI cards (product)
- Border radius: `xl` (10px).
- Número grande en IBM Plex Mono, 36–48px.
- Delta abajo con `▲` o `▼` y color semántico.
- Label superior en `ui-caps` (10px, letter-spacing 0.6px, uppercase).

### Status pills
- `rounded: full`, padding `4px 10px`, `ui-body-strong` (13px/500).
- Combos cerrados: `success` / `warning` / `danger` / `info`.
- NO inventar variantes.

### Tablas de datos densas
- Row height: 32–36px.
- Hairline 0.5px entre rows.
- Hover row: `var(--surface-tertiary)` (#F5F5F5).
- Números en Plex Mono, alineación derecha, `tabular-nums`.

### Slides / Deck
- Background: gradiente aurora `--primary-deepest` → `--primary-deep`
  → `--primary-bright`.
- Title: `d-title` (70px/700, letter-spacing -1.2px).
- Eyebrow: `d-eyebrow` (12px/600, uppercase, letter-spacing 1.6px).
- Acentos cyan o magenta solo aquí.

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
✗ Usar magenta o cyan en product UI
✗ Border radius >12px en product (se lee "consumer", no "enterprise")
✗ Sombras tipo Tailwind default (shadow-md, shadow-xl) — usar las de tokens
✗ Botones con esquinas pill en product (solo en pills/badges)
✗ ALL CAPS fuera de eyebrows y caps tokens
✗ Colores hex inline en JSX/HTML — siempre usar var() o token
✗ Espaciado fuera de la escala (ej. 13px, 18px, 27px)
✗ Copy en inglés en interfaces de cliente español sin razón explícita
✗ Animaciones >800ms en interacciones de UI
```

---

## Checklist antes de cerrar UI

```
TOKENS
[ ] Solo colores de tokens.md (sin hex inline)
[ ] IBM Plex Sans cargado, body 13px en product / 18px en deck
[ ] Border radius dentro de la escala (4/6/8/10/12/full)
[ ] Espaciado dentro de la escala (4/8/16/24/40/72)

COMPONENTES
[ ] Botones, pills y cards copiados de components.md (no reinventados)
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

## Cuándo escalar al área de Datos / Diseño

- Cliente nuevo sin paleta secundaria definida.
- Componente que no existe en `components.md` y se va a usar en >1 producto.
- Discrepancia entre lo que pide el cliente y los tokens (no improvisar — escalar).
- Cualquier propuesta de cambiar el azul EPA o la tipografía base.
