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

## Paso 1 — Preguntar (máximo 5 preguntas, en un solo mensaje, con opciones)

1. **Cliente y nombre del dashboard** (si no vino en `$1`, o para confirmar
   el nombre corto que se usará en `docs/dashboard-spec.md`).
2. **Audiencia:** ¿interno EPA o cliente final? Cambia qué se muestra
   (detalle operativo vs. resumen ejecutivo) y el nivel de acceso default.
3. **Módulos que necesita** — ofrece este menú, permite elegir varios:
   - Overview de canales
   - Por hora
   - Presupuestos / pacing
   - Eventos / promos
   - Categorías y productos
   - Custom (pedir que lo describa)
4. **Plataformas de datos involucradas** (Google Ads, Meta, GA4, TikTok,
   Bing, DV360 — las que apliquen).
5. **Quién tendrá acceso:** ¿solo admins, o también usuarios de cliente?
   ¿Cuántos roles distintos necesita?

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

## Usuarios y roles
(quién ve qué, admin vs usuario, por cliente/cuenta si aplica)

## Pendientes / riesgos
(datos faltantes detectados, plataformas sin frescura, módulos custom sin
vista BQ clara, decisiones que necesitan confirmación del cliente)
```

## Paso 4 — Cerrar sin empezar a codear

Termina siempre con un mensaje como:

> "Spec listo. Revisa `docs/dashboard-spec.md`; cuando lo apruebes,
> empezamos por el módulo {el más simple o el que el usuario priorizó}."

No generes componentes, páginas ni queries en esta misma sesión — eso
requiere aprobación explícita del spec primero.
