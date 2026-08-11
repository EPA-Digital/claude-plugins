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

1. **Colores:** cero hex/rgb inline en JSX/CSS — solo clases o `var()` de
   tokens de epa-design.
   - No marques como violación el `style` inline del hairline de 0.5px
     (`border: 0.5px solid var(--epa-border)` o equivalente) — es una
     excepción sancionada porque la clase `border` de Tailwind redondea a
     1px.
   - No marques como violación mezclar variables `--epa-*` (de
     `tokens.md`) con variables sin ese prefijo (`--border`,
     `--surface-tertiary`, usadas en el propio SKILL.md/DESIGN.md de
     epa-design) — son dos capas legítimas del mismo sistema, no un error.

2. **Tipografía:** IBM Plex Sans en toda la UI, IBM Plex Mono en todo
   número o dato tabular.
   - No marques `13px` ni `18px` como "fuera de la escala" si aparecen
     como **tamaño de fuente** — son tamaños canónicos de la escala de
     tipo de epa-design (`ui-body` 13px, `ui-h2` 18px, etc.). La regla de
     "espaciado fuera de la escala" aplica solo a propiedades de
     spacing/padding/margin/gap, no a `font-size`.

3. **Copy:** español, sentence case, separadores correctos (`·`, `›`,
   `▲`/`▼` para deltas — nunca emoji), sin anglicismos innecesarios.

4. **Componentes:** las primitivas vienen del registry EPA (ver
   `epa-frontend`). Busca componentes caseros que dupliquen
   button/card/dialog/table en vez de usar el registry.

5. **Charts** (si `$1` incluye alguno): título + subtítulo presentes,
   colores de canal desde una **clave conocida** — `google-ads, meta,
   tiktok, dv360, bing, organic, direct, email, otros` (ver `epa-frontend`
   regla 4) —, nunca un hex inline distinto por chart. El mapeo hex real
   todavía no existe (`@epa/tokens` no está construido) — no exijas un hex
   específico, exige que la clave sea una de las conocidas y que el color
   sea consistente dentro del mismo dashboard.

6. **Anti-patrones de epa-design:** gradientes, glassmorphism
   (`backdrop-filter: blur()`), dark-glow, magenta/cyan, border-radius
   >12px, sombras tipo Tailwind default. Todos prohibidos sin excepción —
   este plugin no cubre superficie deck/presentación.

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
