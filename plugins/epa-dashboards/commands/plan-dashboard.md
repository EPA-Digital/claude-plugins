---
description: "Genera el spec de un dashboard antes de escribir código"
argument-hint: "[cliente]"
user-invocable: true
---

# /plan-dashboard — Spec antes de código

Cliente objetivo: `$1` (si no se dio, pídelo en la primera pregunta).

**No escribas código en este comando.** El único entregable es
`docs/dashboard-spec.md`. Codear empieza en una sesión aparte, después de
que el usuario apruebe explícitamente el spec.

## Paso 0 — Confirmar que no hay un esfuerzo en curso

Antes de preguntar nada, recuérdale al usuario: confirmar con el área de
Datos e IA (`datos@epa.digital`) que no exista ya un dashboard o un
esfuerzo en curso para este cliente — evita construir por duplicado algo
que ya está siendo trabajado. No es bloqueante (el usuario puede seguir
sin haber confirmado todavía), pero debe quedar como pendiente explícito
si no se confirmó.

## Paso 1 — Preguntar (máximo 5 preguntas, en un solo mensaje, con opciones)

1. **Cliente y nombre del dashboard** (si no vino en `$1`, o para confirmar
   el nombre corto que se usará en `docs/dashboard-spec.md`).
2. **¿Quién va a entrar: solo gente de EPA, o también gente del cliente?**
   Es la decisión que más cambia el proyecto:
   - **Solo EPA (`Acceso: interno`)** — Google deja pasar solo cuentas
     `@epa.digital` y la lista del dashboard decide quién de EPA lo ve. Lo
     monta quien construye el dashboard, con
     `epa-deploy/scripts/setup-acceso.sh` (~30 min).
   - **También el cliente (`Acceso: externo`)** — hace falta login para
     cuentas que no son de EPA (Microsoft, correo y contraseña). **Se escala a
     `datos@epa.digital` antes de construir**; precedente: Chedraui. Nunca se
     resuelve con una contraseña compartida (caso Coppel).
   También cambia qué se muestra (detalle operativo vs. resumen ejecutivo).
3. **Módulos que necesita** — ofrece este menú, permite elegir varios:
   - Overview de canales
   - Por hora
   - Presupuestos / pacing (dato real en BigQuery, `dw_epa_digital` — ver
     `epa-bq/references/budgets-deming.md` antes de prometerlo: hoy la
     sync puede estar congelada, verificar antes de comprometerse)
   - Eventos / promos
   - Categorías y productos
   - Custom (pedir que lo describa)
4. **Plataformas de datos involucradas** (Google Ads, Meta, GA4, TikTok,
   Bing, DV360 — las que apliquen).
5. **Admin inicial y roles:** el correo `@epa.digital` de quien administra
   los accesos (lo crea `setup-acceso.sh`). Los roles son dos, `admin` (da
   altas y bajas) y `usuario` (solo ve); si piden más, o que cada quien vea
   solo ciertas cuentas, anótalo como riesgo: son filtros por fila en
   `apps/api`.

Espera las respuestas completas antes de seguir.

## Paso 2 — Validar contra el contexto real del cliente

- Si existe `docs/client-context.md` en este repo: **léelo** y valida que
  los datos de cada módulo pedido realmente existen (plataformas activas,
  vistas con datos, rango de fechas suficiente). Si un módulo pide datos
  que no están ahí (cuenta sin datos, plataforma no onboardeada), anótalo
  como riesgo — no lo ignores ni lo inventes.
- Si no existe: dile al usuario que conviene correr `/client-context $1`
  primero para no planear sobre datos que no existen, y pregunta si quiere
  que lo corras ahora o seguir sin esa validación (deja explícito el
  riesgo si elige seguir sin ella).

## Paso 3 — Producir `docs/dashboard-spec.md`

Estructura:

```
# Spec — Dashboard {cliente} · {nombre}

## Objetivo
(2 líneas: qué decisión o pregunta de negocio resuelve este dashboard)

## Módulos

### {módulo 1}
- Métricas: ...
- Dimensiones: ...
- Vista(s) BQ fuente: bdd-epa-digital.{cliente}_reporting.{vista}
  (si no se validó contra client-context.md, márcalo: "⚠️ sin validar")

### {módulo 2}
...

## Wireframe textual por módulo

### {módulo 1}
- KPIs arriba: ...
- Charts: tipo + qué comunica cada uno
- Filtros: ...

## Usuarios y acceso
- Acceso: interno | externo
- Admin inicial: {correo}@epa.digital
- Roles: admin (altas y bajas) · usuario (solo ve)
- Filtros por fila: (ninguno | qué cuentas ve quién — se aplican en apps/api)

## Pendientes / riesgos
(datos faltantes detectados, plataformas sin frescura, módulos custom sin
vista BQ clara, decisiones que necesitan confirmación del cliente)
```

## Paso 3b — Escribir la decisión de acceso en `AGENTS.md`

Agrega (o actualiza) en el `AGENTS.md` del dashboard, en "Reglas del
proyecto":

```
- Acceso: interno — IAP (solo @epa.digital) + lista AccessUsers en la base
  de Firestore {servicio} de epa-turing. Admin inicial: {correo}.
  Ver epa-frontend/references/auth.md.
```

(o `Acceso: externo — escalado a datos@epa.digital el {fecha}`). Las skills y
`security-reviewer` leen esta línea para saber qué revisar; no la dejes
implícita. Si más adelante cambia el despliegue, se cambia aquí también.

## Paso 4 — Cerrar sin empezar a codear

Termina siempre con un mensaje como:

> "Spec listo. Revisa `docs/dashboard-spec.md`; cuando lo apruebes,
> empezamos por el módulo {el más simple o el que el usuario priorizó}."

No generes componentes, páginas ni queries en esta misma sesión — eso
requiere aprobación explícita del spec primero.
