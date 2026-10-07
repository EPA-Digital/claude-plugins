# Secretos — cómo crearlos y consumirlos en un dashboard EPA

Una sola ruta para que una credencial llegue a un dashboard: **Secret
Manager (`epa-turing`) → `--set-secrets` en el `--container` que la
necesita → variable de entorno en el proceso**. Nada en el repo, nada en
la imagen, nada en el navegador.

Este documento consolida lo que ya dicen `SKILL.md` (B2),
`epa-deploy/SKILL.md` y `epa-deploy/references/cloud-run-config.md`. Si
algo aquí contradice a esos, gana el que tenga la fecha más reciente y hay
que corregir el otro en el mismo PR.

---

## 1. ¿Realmente necesitas un secreto?

Casi nunca. Los datos de medios vienen de `{cliente}_reporting` en
BigQuery, que el contenedor `api` lee con la identidad de su service
account (ADC) — no hay credencial que gestionar.

Casos legítimos (ver B3 en `SKILL.md`):
- Google Search Console API.
- CRM de un cliente.
- Un token propio del dashboard (ej. un token de admin interno).

**Nunca para:** Meta, Google Ads, TikTok, Bing ni Pitágoras. Esas
credenciales ya existen en `epa-turing` y son del ETL centralizado:

```
FacebookAccessToken · TiktokToken · GoogleAdsYAML · BingAccessTokenEpa
```

Un dashboard no las lee, no las referencia en `--set-secrets`, no crea
versiones nuevas ni las elimina (ver `protected-resources.md`). Si crees
que necesitas una, el problema es de datos: escala a `datos@epa.digital`.

---

## 2. Crear un secreto

> ⚠️ **Esto no es autoservicio.** El grupo `grp-vibecoding` (ver
> `docs/onboarding-vibecoding.md`) tiene `run.developer` en `epa-turing`
> pero **ningún rol de Secret Manager**. Crear un secreto y darle acceso a
> la SA de runtime lo hace el área de Datos e IA. Tu parte es pedirlo bien
> y entregar el valor por un canal seguro.

### Qué pedir a `datos@epa.digital`

Asunto: `Secret nuevo para [nombre-del-dashboard]`. Incluye:

```
Dashboard / servicio:   {cliente}-dashboard-vibe
Nombre propuesto:       {NombrePascalCase}        (ver convención abajo)
Para qué sirve:         una línea
Contenedor que lo usa:  api   (o web, con justificación)
Variable de entorno:    EPA_{NOMBRE_VAR}
Quién entrega el valor: nombre de la persona — NUNCA en el correo
```

**Nombre.** Los secretos existentes en `epa-turing` usan PascalCase
(`FacebookAccessToken`, `BingAccessTokenEpa`) y los ejemplos de estas
skills también (`EpaAdminToken`). Trátalo como convención observada, no
como regla firmada: confírmala con Datos antes de proponer un nombre, y no
improvises otro estilo.

### Qué ejecuta Datos e IA (referencia)

```bash
# El valor entra por stdin: no queda en el historial del shell ni en ps.
# printf, no echo — echo agrega un salto de línea que rompe tokens.
printf '%s' "$VALOR" | gcloud secrets create NombreSecret \
  --project=epa-turing \
  --replication-policy=automatic \
  --data-file=-

# Acceso al secreto INDIVIDUAL — nunca a nivel de proyecto — y solo para
# la SA de RUNTIME. No a github-actions-deployer: esa despliega, no lee.
gcloud secrets add-iam-policy-binding NombreSecret \
  --project=epa-turing \
  --member="serviceAccount:{cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Notas:
- `secretAccessor` por secreto, no `secretmanager.secretAccessor` en el
  proyecto: con el binding a nivel proyecto cualquier dashboard leería los
  secretos de todos los demás.
- Runtime SA ≠ deploy SA. Es el mismo error que ya documenta `epa-deploy`
  para BigQuery: el grant tiene que apuntar a la SA que el servicio
  realmente usa (`--service-account` del deploy).
- Si el valor lo tienes tú en un archivo para entregarlo, bórralo al
  terminar y nunca lo dejes dentro de ningún repo (el `.gitignore` cubre
  `*.key`, `*.pem` y `.env*`, pero no es una red de seguridad para
  valores pegados en otros archivos).

---

## 3. Consumir un secreto

### En el deploy: `--set-secrets` dentro del `--container` correcto

```bash
--container=api \
  --image=... \
  --update-env-vars=PORT=8081,BQ_BILLING_PROJECT=epa-turing,... \
  --set-secrets="EPA_ADMIN_TOKEN=EpaAdminToken:latest"
```

- **Container-scoped:** va después de su `--container`, casi siempre `api`.
  `web` y `api` comparten service account, así que IAM no distingue cuál
  contenedor lee qué: **la única separación real es a cuál `--container`
  le pones `--set-secrets`**. Ponerlo en `web` solo si `web` realmente lo
  necesita — casi nunca.
- **`--update-env-vars`, nunca `--set-env-vars`** en un contenedor que ya
  tenga variables o secretos: `--set-env-vars` reemplaza el set completo.
- Formato: `EPA_{NOMBRE_VAR}={NombreSecret}:{versión}`. `:latest` es lo
  normal; pinear una versión es raro.

### En el código: como una variable de entorno más

```go
// apps/api — vía config.Cfg (viper)
token := config.Cfg.AdminToken
```

```typescript
// apps/web — SOLO código de servidor (route handlers, server components)
const token = process.env.EPA_ADMIN_TOKEN
```

**Reglas duras:**
- **Nunca llames al SDK de Secret Manager desde el código** — ni en Go ni
  en Next. El secreto llega inyectado; el código no necesita permiso para
  listar ni leer nada en Secret Manager.
- **Nunca `NEXT_PUBLIC_*` para un secreto**, ni leerlo desde un componente
  `"use client"`: se hornea en el bundle del navegador. `NEXT_PUBLIC_*` es
  solo para lo que el navegador debe conocer.
- **Nunca como build arg ni `ENV` de un Dockerfile:** queda en las capas de
  la imagen y en Artifact Registry. El secreto existe solo en runtime.
- **Nunca como `--set-env-vars`/`--update-env-vars` en texto plano** —
  se ve en la consola de Cloud Run y en el historial de revisiones.

### Cuándo toma efecto un cambio de valor

Con `--set-secrets` como variable de entorno, `:latest` se resuelve **cuando
arranca una instancia**. Una instancia que ya corre no ve la versión nueva.
Después de agregar una versión, despliega una revisión nueva (un push a
`main` o `workflow_dispatch`) para que todas las instancias la tomen.

---

## 4. Desarrollo local

```bash
cp .env.example .env.local   # valores de PRUEBA
```

- `.env.example` sí se commitea (solo nombres de variable, sin valores
  reales). `.env.local` y `.env` **no** — el `.gitignore` ya los excluye.
- No copies el valor de producción a tu laptop. Si el flujo requiere un
  valor real para probar, pide a Datos un secreto de prueba, no reutilices
  el de producción.
- No pegues un valor real en un chat con Claude, un ticket, Slack ni un PR.

---

## 5. Nunca

```
[ ] Valores en el repo: .env commiteado, JSON de service account, tokens
    en strings literales (B2 en SKILL.md)
[ ] Valores en logs: no imprimir el secreto ni el request/header que lo
    contiene (logrus/console.log)
[ ] Valores en mensajes de error devueltos al cliente HTTP
[ ] Valores en Dockerfile, build args o variables de GitHub Actions en
    texto plano
[ ] Crear una versión vacía o incorrecta de un secreto protegido, o
    eliminar versiones activas
[ ] Compartir un valor fuera de Secret Manager (correo, chat, ticket)
```

---

## 6. Si un secreto se filtra o hay que rotarlo

En este orden — el orden importa, porque un secreto filtrado sigue
sirviendo mientras la plataforma upstream lo acepte:

1. **Avisa ya a `datos@epa.digital`**, no al terminar.
2. **Revoca/rota la credencial en la plataforma de origen** (la API
   externa, el CRM). Esto es lo que realmente corta el acceso; cambiar el
   valor en Secret Manager no invalida el viejo.
3. Datos agrega una **versión nueva** en Secret Manager con la credencial
   nueva.
4. Redespliega el servicio para que las instancias tomen `:latest`
   (sección 3).
5. Datos **deshabilita** la versión vieja (`gcloud secrets versions
   disable`) una vez confirmado que el servicio funciona con la nueva.
6. Si el valor llegó a Git, quitarlo del último commit no basta: queda en
   el historial. Trátalo como comprometido y rota igual (paso 2).

Un secreto eliminado: `protected-resources.md` documenta un periodo de
retención de 24 h para restaurarlo vía Datos e IA — no dependas de eso,
pide restauración de inmediato.

---

## 7. Estado actual y decisiones abiertas

- **Credencial de deploy.** Hoy el workflow de `epa-deploy` autentica con
  una llave JSON de service account guardada como secreto de GitHub
  (`GCP_SA_KEY`). Es una credencial de larga vida; por eso el checklist
  exige borrar `github-actions-key.json` del disco tras subirla. Cambiar
  ese mecanismo es una decisión de arquitectura del equipo, no algo que
  una sesión decida por su cuenta — si te preocupa, plantéalo a Datos.
- **Sin confirmar con Datos e IA:** convención formal de nombres, quién
  puede crear secretos además de Datos, y política de rotación periódica.
  Hasta que se definan, este documento solo afirma lo observable arriba.

---

## Checklist antes de PR / deploy

Coincide con lo que revisa la sección 1 de `security-reviewer`:

```
[ ] Ningún valor de credencial en código, .env commiteado, ni JSON de SA
[ ] .gitignore incluye .env*, *.key, *.pem, service-account*.json
[ ] Cada secreto llega con --set-secrets, en el --container que lo usa
[ ] Ningún secreto en NEXT_PUBLIC_* ni en código "use client"
[ ] Ningún llamado al SDK de Secret Manager desde apps/web ni apps/api
[ ] Ningún secreto en Dockerfile, build arg ni --set-env-vars en texto plano
[ ] La SA de runtime (no la de deploy) tiene secretAccessor sobre ese
    secreto, y solo sobre ese
[ ] No se referencian los 4 secretos protegidos del ETL
```
