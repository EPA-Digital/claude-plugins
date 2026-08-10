# Onboarding Día 0 — Vibecoding en EPA Digital

Checklist para una persona nueva antes de tocar código en `epa-turing` o
armar su primer dashboard. Sigue el orden — cada sección depende de la
anterior.

---

## Antes de empezar (lo tramita IT una vez)

```
[ ] Cuenta @epa.digital
[ ] Cuenta GitHub + membresía en la org EPA-Digital
[ ] Alta en el grupo grp-vibecoding@epa.digital
    (permisos IAM del grupo: bigquery.jobUser + bigquery.dataViewer en
     bdd-epa-digital, datastore.user, run.developer y cloudscheduler.admin
     en epa-turing)
```

Si no tienes acceso a alguno de estos, pide al área de Datos e IA
(`datos@epa.digital`) que te dé de alta — no hay ruta de auto-servicio para
esto.

---

## En tu máquina (15 minutos, una vez)

```
[ ] Claude Code instalado + login con tu cuenta @epa.digital
[ ] git instalado + gh auth login
[ ] Node 22 LTS + corepack enable
[ ] gcloud CLI + gcloud auth application-default login
[ ] claude plugin marketplace add EPA-Digital/claude-plugins
    + instalar los 6 plugins (o abrir un repo EPA que los auto-instale)
```

Los 6 plugins:

```
claude plugin install epa-naming@epa-plugins
claude plugin install epa-safe-vibe@epa-plugins
claude plugin install epa-stack@epa-plugins
claude plugin install epa-design@epa-plugins
claude plugin install epa-cicd@epa-plugins
claude plugin install epa-dashboards@epa-plugins
```

Verifica que quedaron los 6 con check verde antes de seguir — ver el README
del repo, sección "Instalación", para el detalle paso a paso si algo falla.

---

## Listo

Pídele a Claude Code:

```
/plan-dashboard {cliente}
```

y empieza desde ahí — el comando te va a pedir los datos del dashboard y
va a validar contra `docs/client-context.md` si ya existe (si no existe,
te va a sugerir correr `/client-context {cliente}` primero).
