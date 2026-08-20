---
description: "QA de diseño del dashboard contra el design system EPA + heurísticas UX"
argument-hint: "[página o componente]"
---

# /critique-epa — QA de diseño

Objetivo: `$1` (página o componente a revisar; si no se dio, revisa el
componente o página que el usuario esté editando en esta sesión).

Si `$1` resuelve a varios archivos (un directorio, un módulo con varios
componentes): produce **una sola tabla consolidada** de Fase A cubriendo
todos los archivos — cada fila sigue apuntando a su `archivo:línea`
específico, no se separan en tablas por archivo. La Fase B sí puede hablar
del conjunto (ej. "el módulo no tiene skeleton en ninguno de sus 3
componentes").

## Fase A — Compliance EPA (checklist objetiva, pass/fail por regla)

Revisa cada regla y reporta pass/fail con `archivo:línea` del hallazgo.

1. **Colores:** cero hex/rgb/OKLCH inline en JSX/CSS — solo clases o `var()`
   de tokens de `epa-ui` (`--primary`, `--chart-N`, etc. — ver
   `epa-design/references/epa-ui.md`).
   - No marques como violación el `style` inline del hairline de 0.5px
     (`border: 0.5px solid var(--border)` o equivalente) — es una
     excepción sancionada porque la clase `border` de Tailwind redondea a
     1px.
   - No marques como violación mezclar variables OKLCH de `epa-ui`
     (`--primary`, `--chart-N`, `--radius`) con los `--epa-*` hex de
     `tokens.md` que **solo** aparecen en contexto de marca/deck — son dos
     capas legítimas y con alcance distinto (producto vs. marca), no un
     error. Sí marca como violación un `--epa-*` de marca usado en una
     superficie de producto.
   - Un hex/OKLCH inline usado como "color de éxito/advertencia" (verde,
     ámbar) es violación **aunque no sea el azul EPA** — `epa-ui` no tiene
     esa variante; la regla correcta es la de `epa-ui.md` (delta por
     `secondary`/`destructive` + ícono, status pills por mapa explícito).

2. **Tipografía:** IBM Plex Sans en toda la UI, IBM Plex Mono en todo
   número o dato tabular.
   - No marques `13px` ni `18px` como "fuera de la escala" si aparecen
     como **tamaño de fuente** — son tamaños canónicos de la escala de
     tipo de epa-design (`ui-body` 13px, `ui-h2` 18px, etc.). La regla de
     "espaciado fuera de la escala" aplica solo a propiedades de
     spacing/padding/margin/gap, no a `font-size`.

3. **Copy:** español, sentence case, separadores correctos (`·`, `›`,
   sin anglicismos innecesarios). Para deltas: `▲`/`▼` en texto plano (una
   celda de tabla, una frase de copy); dentro de un `Badge` de `epa-ui`, el
   ícono de lucide (`ArrowUpRightIcon`/`ArrowDownRightIcon`) es el
   equivalente correcto — no marques el ícono como violación de "nunca
   emoji", no lo es. Ver `epa-design/references/epa-ui.md`.

4. **Componentes:** las primitivas vienen de `epa-ui`, copiadas a commit
   fijado (no hay registry de shadcn hoy — ver
   `epa-design/references/epa-ui.md`). Busca componentes caseros que
   dupliquen button/card/dialog/table en vez de usar `epa-ui`.

5. **Charts** (si `$1` incluye alguno): título + subtítulo presentes,
   dentro de `ChartContainer`/`ChartConfig` (nunca un SVG a mano), colores
   de canal desde `--chart-1..10` de `epa-ui` mapeados a una **clave
   conocida** — `google-ads, meta, tiktok, dv360, bing, organic, direct,
   email, otros` (ver `epa-frontend` regla 4) —, nunca un hex/OKLCH inline
   ni un nombre de clase templado (`` `bg-chart-${n}` ``). El mapeo ya
   existe (`--chart-1..10`) — exige que la clave sea una de las conocidas,
   que el color salga de esos tokens, y que sea consistente dentro del
   mismo dashboard.

6. **Anti-patrones de epa-design:** gradientes, glassmorphism
   (`backdrop-filter: blur()`), dark-glow, magenta/cyan. Prohibidos sin
   excepción — este plugin no cubre superficie deck/presentación.
   - **No marques border-radius >12px ni sombras tipo Tailwind
     (`shadow-sm/md/lg/xl`) como violación** — son la escala real de
     `epa-ui` (radius hasta ~26px, sombras de Tailwind por elevación). La
     regla vieja que las prohibía era incorrecta contra el código; ver
     `epa-design/references/epa-ui.md`.

## Fase B — Calidad UX (heurística)

Evalúa y reporta con severidad (alta/media/baja) y un fix concreto:

- **Jerarquía:** ¿el KPI más importante se identifica en 2 segundos de
  mirar la pantalla?
- **Carga cognitiva:** ¿hay más de 6 elementos compitiendo por atención o
  decisión en una sola vista?
- **Estados:** ¿existen los 4 estados obligatorios de todo módulo de
  datos — vacío, cargando (skeleton), error, y sin-datos-por-frescura
  (frescura vieja, no lo mismo que vacío)?
- **Storytelling:** ¿los títulos de los charts comunican el insight
  ("Ingresos cayeron 12% por menor tráfico orgánico") o solo nombran la
  métrica ("Ingresos por día")?

## Salida obligatoria

1. **Tabla Fase A:** `regla · pass/fail · archivo:línea`
2. **Top 3–5 issues de Fase B:** severidad + fix concreto cada uno
3. **Veredicto final**

Cerrar siempre con: "Corrige y vuelve a correr `/critique-epa`."
