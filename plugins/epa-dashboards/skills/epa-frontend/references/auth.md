# Auth — estado hoy y estado objetivo

Ningún dashboard EPA tiene login propio construido hoy. Esto es
deliberado, no un hueco a rellenar improvisando.

---

## Hoy: el acceso se restringe en capa de plataforma, no en la app

El dashboard se despliega con `--no-allow-unauthenticated` (ver
`epa-deploy`). No hay pantalla de login, no hay tabla de usuarios, no hay
sesión que verificar en el código — el control de acceso vive fuera de la
aplicación:

- **Acceso interno / de equipo:** `gcloud run services proxy {servicio}
  --project=epa-turing --region=us-central1` abre un túnel local
  autenticado con la identidad `@epa.digital` de quien lo corre.
- **Acceso recurrente para una persona o grupo:**
  ```bash
  gcloud run services add-iam-policy-binding {servicio} \
    --member="user:persona@epa.digital" \
    --role="roles/run.invoker" \
    --region=us-central1
  ```
  o `--member="group:cliente-team@epa.digital"` para un equipo completo.

> ⚠️ **Precisión importante:** esto **no** es "login para el cliente vía
> navegador". `--no-allow-unauthenticated` + IAM invoker da acceso a
> identidades de Google específicas, no a cualquiera con la URL. Si el
> cliente final necesita entrar desde su propio navegador sin ser
> `@epa.digital`, este mecanismo no lo resuelve — ver la sección de abajo.

**Si el dashboard necesita ser accesible por el cliente final HOY:**
escala a `datos@epa.digital` antes de exponerlo. No cambies a
`--allow-unauthenticated` por tu cuenta, ni instales Firebase Auth,
NextAuth, o cualquier sistema de login propio — eso crea una migración que
el estado objetivo (abajo) va a tener que deshacer.

---

## Estado objetivo (Etapa 3 de la plataforma, todavía no existe)

IAP en modo external identities + Identity Platform (single tenant). El
contrato para el código del dashboard, cuando exista, es un helper:

```typescript
// lib/auth.ts — forma objetivo, no implementar antes de que exista IAP
export async function getUser(): Promise<{ email: string; role: "admin" | "usuario"; clients: string[] } | null> {
  // Verifica la firma del JWT que IAP inyecta en el header
  // x-goog-iap-jwt-assertion contra los JWKs de Google + el audience
  // del backend. Nunca confiar en headers planos sin verificar firma.
}
```

Escribir código nuevo pensando en esta forma (un `getUser()` que puede
devolver `null`) para no botar trabajo cuando IAP llegue — pero no
implementar el helper todavía, porque no hay nada real que verificar.

**Row filters / control de acceso a datos por cuenta:** cuando existan,
siempre se aplican en el servidor (dentro del route handler, antes de
construir la query), nunca solo ocultando elementos en la UI. Ver
`security-reviewer` §5 — esto ya se audita hoy aunque el login no exista,
porque un dashboard mal filtrado puede filtrar datos de un cliente a otro
incluso sin un sistema de login formal (ej. un parámetro de URL sin
validar).

---

## Nunca

- La colección `users` de `bdd-epa-digital` — es la de autenticación de
  toda la agencia, protegida (ver `epa-safe-vibe`).
- Firebase Auth, NextAuth, Clerk, Auth0, o cualquier proveedor de auth
  client-side — ninguno es el patrón objetivo, y todos crean una migración
  después.
- Un login "temporal" con usuario/password hardcodeado — es peor que no
  tener login: da la sensación de seguridad sin ninguna real.
