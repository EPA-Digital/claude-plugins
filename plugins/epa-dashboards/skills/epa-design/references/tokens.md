# EPA Design Tokens — Referencia Rápida (product)

Todos los valores del `DESIGN.md` organizados para copy-paste directo en
código. Versión product-only — sin tokens de deck/brand.

> **Los tokens de runtime reales son los de `epa-ui`** (OKLCH, `app/globals.css`,
> ver `references/epa-ui.md`) — no los bloques de esta página. Lo que sigue
> se conserva como **referencia de marca** (los hex `--epa-*` de abajo) y
> como forma histórica (el bloque `tailwind.config.js`, que es sintaxis de
> Tailwind v3 — el stack real usa v4 y no tiene archivo de config). Si un
> valor de aquí contradice a `epa-ui`, gana `epa-ui` en superficie de
> producto.

## Tokens de runtime — OKLCH, el contrato real

```css
/* app/globals.css de epa-ui — copiar tal cual, no reescribir a hex */
:root {
  --primary: oklch(0.546 0.245 262.881);   /* = Tailwind blue-600 */
  --destructive: oklch(0.577 0.245 27.325);
  --chart-1: oklch(0.546 0.245 262.881);
  --chart-2: oklch(0.5 0.205 142.495);
  --chart-3: oklch(0.6 0.191 49.763);
  --chart-4: oklch(0.55 0.247 348.498);
  --chart-5: oklch(0.55 0.261 286.711);
  --chart-6: oklch(0.63 0.19 96);
  --chart-7: oklch(0.55 0.16 172);
  --chart-8: oklch(0.6 0.14 202);
  --chart-9: oklch(0.5 0.22 232);
  --chart-10: oklch(0.55 0.24 318);
  --radius: 0.625rem; /* 10px — sm/md/lg/xl/2xl/3xl/4xl se derivan de este */
}
```

No hay `success`/`warning`/`info` en este contrato — ver el estado
semántico provisional en `references/epa-ui.md`.

## CSS Custom Properties — completas

```css
:root {
  /* === BRAND CORE === */
  --epa-primary:          #003AD6;
  --epa-primary-dark:     #002BAF;
  --epa-primary-mid:      #B8CAFE;
  --epa-primary-light:    #E8EFFE;
  --epa-on-primary:       #FFFFFF;

  /* === BRAND NEUTRALS === */
  --epa-ink:              #0E141E;

  /* === PRODUCT SURFACES === */
  --epa-surface:          #FFFFFF;
  --epa-surface-secondary:#FAFAFA;
  --epa-surface-tertiary: #F5F5F5;

  /* === FOREGROUND === */
  --epa-content:          #0A0A0A;
  --epa-content-secondary:#6B6B6B;
  --epa-content-tertiary: #A3A3A3;

  /* === BORDERS === */
  --epa-border:           #E5E5E5;
  --epa-border-strong:    #D4D4D4;

  /* === SEMANTIC SUCCESS === */
  --epa-success:          #16A34A;
  --epa-success-bg:       #F0FDF4;
  --epa-success-border:   #BBF7D0;
  --epa-success-text:     #166534;

  /* === SEMANTIC WARNING === */
  --epa-warning:          #D97706;
  --epa-warning-bg:       #FFFBEB;
  --epa-warning-border:   #FDE68A;
  --epa-warning-text:     #92400E;

  /* === SEMANTIC DANGER === */
  --epa-danger:           #DC2626;
  --epa-danger-bg:        #FEF2F2;
  --epa-danger-border:    #FECACA;
  --epa-danger-text:      #991B1B;

  /* === SEMANTIC INFO === */
  --epa-info:             #003AD6;
  --epa-info-bg:          #E8EFFE;
  --epa-info-border:      #B8CAFE;
  --epa-info-text:        #00199C;

  /* === RADII === */
  --epa-radius-sm:        4px;
  --epa-radius-md:        6px;
  --epa-radius-lg:        8px;
  --epa-radius-xl:        10px;
  --epa-radius-2xl:       12px;
  --epa-radius-full:      9999px;

  /* === SPACING === */
  --epa-space-xs:         4px;
  --epa-space-sm:         8px;
  --epa-space-md:         16px;
  --epa-space-lg:         24px;
  --epa-space-xl:         40px;
  --epa-space-2xl:        72px;
  --epa-topbar:           56px;
  --epa-sidebar-icon:     52px;
  --epa-sidebar-nav:      200px;
  --epa-sidebar-collapsed:48px;
  --epa-grid-gutter:      16px;
  --epa-grid-margin:      20px;
  --epa-grid-max-width:   1440px;

  /* === SHADOWS === */
  --epa-shadow-sm:        0 1px 2px rgba(10,14,30,0.04);
  --epa-shadow-md:        0 2px 6px rgba(10,14,30,0.06);
  --epa-shadow-lg:        0 8px 24px rgba(10,14,30,0.08);

  /* === DURATION === */
  --epa-duration-fast:    150ms;
  --epa-duration-base:    300ms;
  --epa-duration-slow:    800ms;
  --epa-duration-stagger: 50ms;

  /* === Z-INDEX === */
  --epa-z-topbar:         100;
  --epa-z-dropdown:       200;
  --epa-z-modal:          300;
  --epa-z-toast:          400;
}
```

## Tailwind — config equivalente (forma histórica, Tailwind v3)

> ⚠️ El stack real es Tailwind v4 (`epa-ui`), que **no tiene**
> `tailwind.config.js` — los tokens se declaran con `@theme inline` en CSS
> (ver el bloque OKLCH de arriba). Este bloque se conserva como forma
> equivalente de v3 para quien necesite el mapeo conceptual, no como
> archivo a crear en un dashboard real.

```js
// tailwind.config.js — NO crear este archivo en un stack real (Tailwind v4)
module.exports = {
  theme: {
    extend: {
      colors: {
        'epa-primary':    '#003AD6',
        'epa-primary-dark':'#002BAF',
        'epa-primary-light':'#E8EFFE',
        'epa-primary-mid': '#B8CAFE',
        'epa-surface':    '#FFFFFF',
        'epa-surface-2':  '#FAFAFA',
        'epa-surface-3':  '#F5F5F5',
        'epa-content':    '#0A0A0A',
        'epa-content-2':  '#6B6B6B',
        'epa-content-3':  '#A3A3A3',
        'epa-border':     '#E5E5E5',
      },
      borderWidth: { 'hairline': '0.5px' },
      borderRadius: {
        'epa-sm':   '4px',
        'epa-md':   '6px',
        'epa-lg':   '8px',
        'epa-xl':   '10px',
        'epa-2xl':  '12px',
      },
      fontFamily: {
        'epa': ['IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        'epa-mono': ['IBM Plex Mono', 'monospace'],
      },
      transitionDuration: {
        'fast': '150ms',
        'base': '300ms',
        'slow': '800ms',
      },
      zIndex: {
        'topbar':   '100',
        'dropdown': '200',
        'modal':    '300',
        'toast':    '400',
      },
    },
  },
}
```

## Variables para React / styled-components

```ts
// theme.ts
export const epaTheme = {
  colors: {
    primary:        '#003AD6',
    primaryDark:    '#002BAF',
    primaryLight:   '#E8EFFE',
    primaryMid:     '#B8CAFE',
    onPrimary:      '#FFFFFF',
    surface:        '#FFFFFF',
    surfaceSecondary:'#FAFAFA',
    surfaceTertiary:'#F5F5F5',
    content:        '#0A0A0A',
    contentSecondary:'#6B6B6B',
    contentTertiary:'#A3A3A3',
    border:         '#E5E5E5',
    borderStrong:   '#D4D4D4',
    success:        '#16A34A',
    successBg:      '#F0FDF4',
    successBorder:  '#BBF7D0',
    successText:    '#166534',
    warning:        '#D97706',
    warningBg:      '#FFFBEB',
    warningBorder:  '#FDE68A',
    warningText:    '#92400E',
    danger:         '#DC2626',
    dangerBg:       '#FEF2F2',
    dangerBorder:   '#FECACA',
    dangerText:     '#991B1B',
  },
  radius: {
    sm: '4px', md: '6px', lg: '8px', xl: '10px', '2xl': '12px', full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px rgba(10,14,30,0.04)',
    md: '0 2px 6px rgba(10,14,30,0.06)',
    lg: '0 8px 24px rgba(10,14,30,0.08)',
  },
  duration: {
    fast: '150ms', base: '300ms', slow: '800ms', stagger: '50ms',
  },
  zIndex: {
    topbar: 100, dropdown: 200, modal: 300, toast: 400,
  },
} as const
```
