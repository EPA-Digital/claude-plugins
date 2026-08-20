---
description: "Homologa un dashboard que empezó con otro stack a los estándares EPA"
argument-hint: "[opcional: carpeta o archivo específico]"
---

# /migrate-to-epa — Homologar un dashboard existente

Para alguien que ya empezó su dashboard con otro stack (u otras
convenciones) y quiere dejarlo al estándar completo de EPA. Objetivo:
`$1` (si no se dio, revisa el repo completo desde la raíz).

**El backend en Go ya no es un bloqueo — es el Paso 6.** La plantilla de
Eddy (`epa-standards-backend`) y la arquitectura de sidecar (`epa-backend`)
ya están disponibles: si el proyecto consulta BigQuery directo desde route
handlers, este comando migra eso a `apps/api` en Go, con tu confirmación
antes de crear nada (ver Paso 6). Lo único que sigue bloqueado es la
librería de componentes de Dany (`<REGISTRY_URL>` pendiente, ver
`epa-frontend` regla 3) — eso sí se reporta bloqueado, sin intentarlo.

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

Corrige estos tres puntos donde sea que vivan las queries hoy (típicamente
un route handler) — son correcciones de dataset/API, no de arquitectura.
Si el proyecto todavía consulta BigQuery directo desde `apps/web`/route
handlers, ese movimiento de arquitectura completo es el Paso 6.

## Paso 5 — Correr las revisiones existentes

Una vez aplicado lo anterior:
1. Corre `/critique-epa` sobre el proyecto completo.
2. Invoca al agente `security-reviewer` sobre el proyecto completo.

Incluye ambos resultados en el reporte final (Paso 6), no los muestres
por separado.

## Paso 6 — Migrar a la arquitectura de dos contenedores (con tu confirmación)

Si el proyecto consulta BigQuery directo desde `apps/web`/route handlers
(la arquitectura anterior), esto ya no es un bloqueo — es una migración
real, con este procedimiento:

1. **Inventariar**, sin tocar nada todavía: cada lugar del proyecto que
   hoy consulta BigQuery — qué dimensiones, métricas, agregaciones y
   filtros expone cada uno. Esto se convierte 1:1 en los recursos
   (`entity`/`ports`/`service`/`repository`/`handlers`) que va a tener
   `apps/api`.
2. **Proponer el plan al usuario y esperar confirmación explícita antes
   de crear nada** — cuántos recursos, en qué orden se migran, si hay
   endpoints que se pueden agrupar en un solo recurso. No asumas que
   "migrar" autoriza reestructurar todo de una sola vez.
3. Una vez confirmado:
   - Mover el código actual del dashboard a `apps/web/` dentro del mismo
     repo (si no vivía ya ahí).
   - Forkear `epa-standards-backend` a `apps/api/` siguiendo
     `epa-backend/references/fork-checklist.md`.
   - Un slice completo (las 6 capas) por recurso del inventario del paso
     1 — ver `epa-backend/references/bigquery-repository.md` como
     plantilla.
   - Borrar el cliente de BigQuery de `apps/web` por completo
     (`@google-cloud/bigquery` u otro) y quitar los permisos de BigQuery
     de la SA que usaba el frontend, si tenía una propia — el patrón final
     es una sola SA de runtime compartida (ver
     `epa-deploy/references/cloud-run-config.md`).
   - Un solo workflow de deploy con `--container=web --container=api` (ver
     `epa-deploy/SKILL.md`) — nunca dos servicios de Cloud Run.
4. Correr `security-reviewer` de nuevo después de migrar — su sección 7
   está diseñada exactamente para esta frontera.

**Componentes de UI hechos a mano** siguen bloqueados de verdad — repórtalo
sin intentarlo: depende de la librería de Dany y del `<REGISTRY_URL>` del
registry (ver `epa-frontend` regla 3). Lista los componentes caseros
encontrados, no los reescribas todavía.

## Salida obligatoria

Tabla consolidada:

| Severidad | Hallazgo | Archivo:línea | Estado | Fix |
|---|---|---|---|---|
| ... | ... | ... | migrado / requiere tu ok / bloqueado (pendiente de X) | ... |

Cierra siempre con un resumen, separando lo que ya no depende de nadie de
lo que sigue bloqueado por Dany:

> "N cambios aplicados automáticamente. M requieren tu confirmación antes
> de aplicarse. [Si aplica: "La migración a apps/api (Go) está lista para
> empezar en cuanto confirmes el inventario del Paso 6."] K componentes
> caseros quedan bloqueados hasta que Dany comparta su librería."

Si algo requiere tu confirmación, pregúntalo explícitamente antes de
tocar esos archivos — no asumas que "migrar" significa autorización para
todo.
