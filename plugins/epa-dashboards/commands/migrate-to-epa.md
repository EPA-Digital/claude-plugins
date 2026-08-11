---
description: "Homologa un dashboard que empezó con otro stack a los estándares EPA"
argument-hint: "[opcional: carpeta o archivo específico]"
---

# /migrate-to-epa — Homologar un dashboard existente

Para alguien que ya empezó su dashboard con otro stack (u otras
convenciones) y quiere dejarlo al estándar completo de EPA. Objetivo:
`$1` (si no se dio, revisa el repo completo desde la raíz).

**No depende de nada pendiente.** Aunque el stack de backend en Go (Eddy)
y la librería de componentes (Dany) todavía no estén compartidos, este
comando avanza con todo lo que sí es resoluble hoy — y reporta como
bloqueado, explícitamente, lo que depende de esas dos piezas. No te
detengas a esperarlas.

## Paso 1 — Auditar y corregir lo mecánico (autofix)

Aplica estos cambios directo, sin pedir confirmación (son mecánicos y
reversibles con git):

1. **Gestor de paquetes:** si el proyecto usa `npm` o `yarn` (hay
   `package-lock.json` o `yarn.lock`), migra a pnpm: genera `pnpm-lock.yaml`
   con `pnpm import` si existe un lockfile previo, borra el lockfile viejo,
   agrega `packageManager: "pnpm@10.14.0"` y `engines` a `package.json`
   (ver `epa-frontend/references/tsconfig-eslint.md`).
2. **Node version:** crea o corrige `.nvmrc` → `22`.
3. **`tsconfig.json` / `eslint.config.mjs` / `.npmrc`:** compara contra
   `epa-frontend/references/tsconfig-eslint.md`. Si faltan las opciones
   estrictas (`noUncheckedIndexedAccess`, `no-explicit-any: error`, etc.),
   agrégalas — no las reescribas desde cero si ya hay config custom
   compatible, solo agrega lo que falte.
4. **Prettier:** si no existe `prettier-plugin-tailwindcss`, agrégalo.

## Paso 2 — Auditar violaciones de `anti-stack.md` (requieren tu confirmación)

Busca y reporta (no corrijas sin confirmar — estos cambios sí pueden
romper algo):

- **Pages Router:** carpeta `pages/` con rutas — proponer plan de
  migración a `app/`, no migrar automático (puede haber lógica compleja
  por página).
- **CSS custom / styled-components:** archivos `.css`/`.scss` fuera de
  Tailwind, o `styled-components`/`emotion` en `package.json`.
- **`any` / `@ts-ignore`:** buscar todas las apariciones, listarlas con
  archivo:línea — corregir una por una requiere entender cada caso.

## Paso 3 — Charts

Si el proyecto usa una librería de charts distinta a Recharts (Chart.js,
Victory, Nivo, D3 directo, etc.):
- Reporta cada chart encontrado.
- Ofrece migrar componente por componente a Recharts siguiendo las 6
  reglas de `epa-frontend` regla 4 (título/subtítulo, comparación
  punteada, colores por canal, máx. 6 series, formato de cifras, botón
  "Ver tabla").
- Si ya usa Recharts pero sin las 6 reglas: lista cuáles faltan por chart.

## Paso 4 — Acceso a datos

Busca y migra:
- Queries a `bdd-epa-digital.epa_agency_reports` → reescribir contra
  `{cliente}_reporting` (resolver el dataset real por lookup, ver
  `epa-bq` regla 0).
- Llamadas directas a Pitágoras (REST o MCP/Tokyo) o a APIs de plataforma
  (`graph.facebook.com`, `googleads.googleapis.com`, etc.) → migrar a
  lectura de `{cliente}_reporting`. Si el dato no existe ahí, márcalo como
  riesgo — no lo resuelvas llamando a la API directo.
- `SELECT *` o queries sin `LIMIT`/filtro de fecha → corregir con el
  patrón de `epa-bq/references/cost-and-access.md`.

## Paso 5 — Correr las revisiones existentes

Una vez aplicado lo anterior:
1. Corre `/critique-epa` sobre el proyecto completo.
2. Invoca al agente `security-reviewer` sobre el proyecto completo.

Incluye ambos resultados en el reporte final (Paso 6), no los muestres
por separado.

## Paso 6 — Reportar lo bloqueado, sin intentarlo

No intentes resolver esto — repórtalo como bloqueado, igual que el
`<REGISTRY_URL>` pendiente:

- **Backend en otro stack** (Go, Python, un servicio separado): la
  migración de backend depende del stack que va a compartir Eddy. No
  propongas una reescritura — señala qué archivos/rutas son backend y que
  quedan pendientes.
- **Componentes de UI hechos a mano:** depende de la librería de Dany y
  del `<REGISTRY_URL>` del registry (ver `epa-frontend` regla 3). Lista
  los componentes caseros encontrados, no los reescribas todavía.

## Salida obligatoria

Tabla consolidada:

| Severidad | Hallazgo | Archivo:línea | Estado | Fix |
|---|---|---|---|---|
| ... | ... | ... | migrado / requiere tu ok / bloqueado (pendiente de X) | ... |

Cierra siempre con un resumen:

> "N cambios aplicados automáticamente. M requieren tu confirmación antes
> de aplicarse. K quedan bloqueados hasta que Eddy/Dany compartan su
> parte."

Si algo requiere tu confirmación, pregúntalo explícitamente antes de
tocar esos archivos — no asumas que "migrar" significa autorización para
todo.
