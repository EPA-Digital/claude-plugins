---
name: epa-backend
description: >
  Backend en Go de un dashboard EPA — el contenedor que consulta BigQuery.
  Activar cuando el usuario construye, modifica o despliega el backend de un
  dashboard, menciona Go, gin, el fork de epa-standards-backend, un handler
  o repositorio nuevo, el endpoint que alimenta un chart, el sidecar, o
  pregunta de dónde salen los datos del dashboard. También al escribir
  cualquier archivo .go, go.mod, o al tocar apps/api/. Y ante "cómo conecto
  el frontend con el backend", "por qué no responde localhost:8081", o
  "dónde va esta query".
---

# EPA Backend — Go, uno por dashboard

Cada dashboard tiene su propio backend en Go, forkeado de
[`epa-standards-backend`](https://github.com/epa-datos/epa-standards-backend)
(la plantilla de Eddy). Vive en `apps/api/` del mismo repo que el frontend,
y se despliega como **sidecar** del mismo servicio de Cloud Run — no como
un servicio aparte. Este skill trabaja junto a `epa-frontend` (que consume
sus endpoints vía `fetch`), `epa-bq` (qué datasets/vistas existen) y
`epa-deploy` (cómo se construye y despliega el par de contenedores).

---

## Regla 0 — Un dashboard es UN servicio con DOS contenedores

```
navegador ──HTTPS──> [ contenedor web  :8080 ]  ← ingress (Next.js)
                              │ http://localhost:8081
                              v
                       [ contenedor api  :8081 ]  ← SIN ingress público (Go + gin)
                              │
                              v
                          BigQuery  bdd-epa-digital.{cliente}_reporting
```

El navegador **nunca** alcanza `api` — no tiene URL pública, ni con IAM mal
configurado. El contenedor `web` **nunca** toca BigQuery directo — ver
`epa-frontend` regla 5. Detalle completo del despliegue en
`references/sidecar.md`.

---

## Regla 1 — Un backend por dashboard, forkeado

Nunca compartido entre dashboards. Cada dashboard tiene sus propias
dimensiones, métricas, agregaciones y filtros — lo único que se reusa entre
dashboards es la fuente, BigQuery. No existe (ni se construye) un backend
Go centralizado tipo Pitágoras para dashboards.

---

## Regla 2 — La arquitectura por capas es de Eddy, no la reinventes

```
entity → ports → service → repository → handlers → routes
```

Los 5 docs del fork (`CLAUDE.md`, `docs/ESTRUCTURA.md`, `docs/TESTING.md`,
`docs/MOCKS.md`, `docs/VARIABLES-ENTORNO.md`) son la fuente de verdad para
esta arquitectura — este skill no los duplica, solo documenta lo específico
de dashboards: la capa de BigQuery (que Eddy no trae) y el despliegue como
sidecar.

---

## Regla 3 — BigQuery es un repositorio más, pero read-only

Misma forma que los ejemplos de Postgres/Firestore que trae la plantilla,
implementando `ports.CampaignMetricsRepository` (o el recurso que
corresponda) — pero sin `Create`/`Update`/`Delete`: `{cliente}_reporting`
es de solo lectura para todo runtime de dashboard. Slice completo de
referencia en `references/bigquery-repository.md`.

---

## Regla 4 — Toda query parametrizada + `MaxBytesBilled`

`q.Parameters` (`[]bigquery.QueryParameter`), nunca concatenación de
strings. Default `MaxBytesBilled` 100 MB; 50 MB si se está explorando
`ga360-250517` (ver `epa-bq/references/cost-and-access.md`).

---

## Regla 5 — Nada que venga del request toca la SQL directamente

BigQuery no parametriza identificadores (nombre de dataset, sufijo de MCC,
nombre de tabla) — esos **siempre** salen de variables de entorno, se
validan con regex **al arrancar el proceso** (que muere con
`logrus.Fatalf` si no pasan la validación), y **nunca** de un valor que
llegó en el request. Un `cliente`/`clientId` que sí viene del request se
valida contra la lista autorizada de config antes de usarse — nunca se
interpola directo.

---

## Regla 6 — El sidecar no lleva `--port` — nunca

Es lo único que lo mantiene sin ingress público. Si `web` no puede alcanzar
`api` (502, `ECONNREFUSED`), la causa **no es** que falte exponerlo — es
casi siempre `PORT` mal configurado, `--depends-on` faltante, o el startup
probe fallando. Ver `references/sidecar.md` → Troubleshooting.

---

## Regla 7 — El backend Go tampoco llama a APIs de medios

Correr server-side no es una excepción a `epa-safe-vibe` B3. El backend Go
sigue prohibido de llamar directo a Meta/Google Ads/TikTok/Bing/Pitágoras —
misma excepción que ya existe (Search Console API, CRM de cliente, con
confirmación explícita del usuario).

---

## Regla 8 — Frescura obligatoria

Todo endpoint que devuelve datos de BigQuery incluye `dataFreshness`
(fecha de la última partición materializada — ver
`epa-bq` regla 4). El frontend muestra "Datos al {fecha}" con ese valor,
nunca con la fecha de hoy.

---

## Referencias

- `references/bigquery-repository.md` — el slice `CampaignMetrics`
  completo, las 6 capas, código Go de referencia.
- `references/sidecar.md` — el comando de deploy con dos `--container`,
  por qué no hay auth en el salto `web`→`api`, dev local, troubleshooting.
- `references/fork-checklist.md` — procedimiento operativo de fork.
