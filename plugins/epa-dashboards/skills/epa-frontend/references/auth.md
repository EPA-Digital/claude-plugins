# Auth — IAP + lista de acceso (patrón estándar)

Todo dashboard EPA se protege igual. No hay login en la app, ni contraseñas, ni
sesiones propias:

```
navegador ──► IAP (Google)          AUTENTICA: ¿quién eres?
               │  agrega un JWT firmado en x-goog-iap-jwt-assertion
               ▼
            apps/web (Next.js)       REENVÍA el JWT tal cual (no lo interpreta)
               │  + revisión optimista en proxy.ts
               ▼
            apps/api (Go, sidecar)   VERIFICA el JWT (firma, aud, iss, dominio)
               │                     y AUTORIZA contra AccessUsers
               ▼
            Firestore AccessUsers    roles y bloqueos de ESTE dashboard
                                     (en `restringido`, también quién entra)
```

**Las dos capas son obligatorias**, también cuando solo entra gente de EPA:

1. **IAP** autentica: deja pasar solo cuentas `@epa.digital`
   (`domain:epa.digital`) y corta internet.
2. **`apps/api`** autoriza según `ACCESS_MODE`. Política de EPA (nov 2026):
   **nada interno está cerrado a menos que se declare.**
   - **`interno`** — el estándar. Todo `@epa.digital` entra con lectura.
     `AccessUsers` solo sirve para dar rol `admin` y para bloquear a una
     persona concreta (`disabled`). Si no hacen falta ni admins ni bloqueos,
     ni siquiera existe la lista (`ACCESS_STORE=none`): no hay Firestore ni nada
     que pedir.
   - **`restringido`** — excepción deliberada, con motivo y dueño en el
     `AGENTS.md` (por ejemplo datos financieros de la agencia o de personas;
     datos de medios de clientes no lo justifican). Aquí `AccessUsers` es la
     puerta: sin un registro `active`, 403 y "Sin acceso".

Cerrar un dashboard se hace **declarándolo** así, nunca dejando vacía la
política de IAP: un servicio con IAP y nadie en `iap.httpsResourceAccessor` no
es "restringido", es un dashboard roto que nadie sabe por qué no abre.

**El JWT lo verifica `apps/api`, no `apps/web`.** La API no confía en ningún
header plano: si un route handler se salta `fetchApi`, o si la API quedara
expuesta por error, igual nadie pasa sin un token válido de IAP. Hay un solo
verificador, junto a los datos.

| Pieza | Dónde | Guía |
|---|---|---|
| Reenviar el JWT, puerta de la UI | `apps/web` | este archivo |
| Verificar el JWT, `AccessUsers`, `RequireAccess`, `GET /api/v1/me`, admin | `apps/api` | `epa-backend/references/access-control.md` |
| IAP, Firestore, permisos, primer admin | GCP | `epa-deploy/scripts/setup-acceso.sh` y `epa-deploy/references/cloud-run-config.md` § Autenticación |

Precedentes: `EPA-Digital/chedraui-dashboard` (en producción, verifica en web),
`EPA-Digital/kcm-informe-interno` (verifica en la API, el modelo de esta guía).
Ambos usan la lista como puerta de entrada, es decir, el comportamiento de
`restringido`; el estándar para dashboards internos nuevos es `interno`.
`EPA-Digital/coppel-dashboard` es el antipatrón: contraseña compartida y servicio
público (auditoría 2026-10-12, bloqueado).

Tiempo estimado para un dashboard interno nuevo: **~3–4 h** (código 2 h
copiando de aquí, infraestructura 30 min con el script, pruebas 1 h).

---

## 0. Interno, restringido o externo — se decide en el onboarding

`/plan-dashboard` lo pregunta y lo escribe en el `AGENTS.md` del dashboard
(`Acceso: interno`, `Acceso: restringido` o `Acceso: externo`). `ACCESS_MODE`
del contenedor `api` tiene que decir lo mismo. Cambia la infraestructura, casi
nada del código:

| | **Interno** (estándar) | **Restringido** (excepción) | **Externo** (gente del cliente) |
|---|---|---|---|
| Quién ve datos | Todo `@epa.digital` | Solo con registro `active` | Quien se dé de alta |
| `ACCESS_MODE` (api) | `interno` | `restringido` | `restringido` |
| `ACCESS_STORE` (api) | `none` (nada que pedir) o `firestore` si hacen falta admins o bloqueos | `firestore` | `firestore` |
| IAP | Identidades de Google, `domain:epa.digital` | Igual que interno (a nivel proyecto) | External identities + Identity Platform, o cliente OAuth propio |
| Página de login | No | No | Sí (patrón `apps/login` de Chedraui) |
| `AUTH_ALLOWED_DOMAINS` (api) | Exactamente `epa.digital` (si no, no arranca) | `epa.digital` | Dominios del cliente + `epa.digital`, o `*` |
| Rol de `AccessUsers` | Admins y bloqueos (solo con `firestore`) | Puerta de entrada + roles | Puerta de entrada + roles |
| Qué se declara en el `AGENTS.md` | Nada más | **Motivo y dueño** | Aprobación de Datos e IA |
| Quién lo monta | Quien construye el dashboard, con `setup-acceso.sh --acceso interno` | Igual, con `--acceso restringido` (usa Firestore: los permisos de IAM se piden a Datos e IA) | **Escalar a `datos@epa.digital`** antes de exponerlo |

Como el IAP de dominio está concedido a nivel proyecto y IAM es aditivo,
**restringir no se puede hacer en IAP**: se hace en la API, con la lista como
puerta. Por eso `restringido` solo funciona si la API verifica el JWT y la lista
(ya es obligatorio).

Pasar de interno a otro modo **no es solo cambiar IAP y dominios**: `interno` se
niega a arrancar con otro `AUTH_ALLOWED_DOMAINS`, para que gente del cliente no
reciba lectura automática por un cambio a medias. Se cambia `ACCESS_MODE` a
`restringido` y se da de alta a las personas.

---

## 1. Variables de entorno (`apps/web`)

Todas de servidor; **ninguna es `NEXT_PUBLIC_*`**.

| Variable | Valor | Notas |
|---|---|---|
| `EPA_API_BASE_URL` | `http://localhost:8081` | El sidecar |
| `AUTH_SIGN_OUT_URL` | `/?gcp-iap-mode=CLEAR_LOGIN_COOKIE` | En externo: `/?gcp-iap-mode=GCIP_SIGNOUT` |
| `DEV_USER_EMAIL` | `tu@epa.digital` | **Solo desarrollo.** Se ignora con `NODE_ENV=production` |

Las de verificación y autorización (`IAP_AUDIENCE`, `AUTH_ALLOWED_DOMAINS`,
`AUTH_MODE`, `ACCESS_MODE`) van en el contenedor `api`, no aquí.

## 2. `src/lib/auth-forward.ts` — qué se reenvía a la API

```typescript
/**
 * Los headers de identidad que viajan a apps/api. NO verifica nada: la API
 * valida el JWT de IAP. Aquí solo se copia, para que nunca se arme a mano.
 */
export const IAP_JWT_HEADER = "x-goog-iap-jwt-assertion";

export function identityHeaders(reqHeaders: Headers): Headers {
  const out = new Headers();
  const jwt = reqHeaders.get(IAP_JWT_HEADER);
  if (jwt) out.set(IAP_JWT_HEADER, jwt);

  // Desarrollo sin IAP: la API corre con AUTH_MODE=local y lee este header.
  // En producción nunca sale (y la API con AUTH_MODE=iap lo ignoraría).
  const devEmail = process.env.DEV_USER_EMAIL?.trim();
  if (process.env.NODE_ENV !== "production" && devEmail) {
    out.set("x-dev-user-email", devEmail);
  }
  return out;
}

export const readSignOutUrl = () =>
  process.env.AUTH_SIGN_OUT_URL?.trim() || "/?gcp-iap-mode=CLEAR_LOGIN_COOKIE";
```

## 3. `src/proxy.ts` — revisión optimista

En Next 16 el middleware se llama `proxy.ts` (leer
`node_modules/next/dist/docs/` antes de tocarlo). **No es el control de
acceso** —ese es la API—: solo corta temprano un request que ni siquiera trae
JWT, para no renderizar nada.

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { IAP_JWT_HEADER } from "@/lib/auth-forward";

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  if (request.headers.get(IAP_JWT_HEADER) || isDev) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/"))
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return new NextResponse("Sesión no válida. Vuelve a entrar al dashboard.", { status: 401 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|svg|webp|gif|css|js|woff2?)$).*)"],
};
```

## 4. `src/lib/api-upstream.ts` — el único camino a `apps/api`

**Todo route handler llama a la API con `fetchApi`, nunca con `fetch` directo.**
Sin el JWT reenviado, la API responde 401.

```typescript
import { z } from "zod";
import { identityHeaders } from "@/lib/auth-forward";

export async function fetchApi(reqHeaders: Headers, input: URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  identityHeaders(reqHeaders).forEach((value, key) => headers.set(key, value));
  return fetch(input, { cache: "no-store", ...init, headers });
}

const accessUserSchema = z.object({
  email: z.string(),
  name: z.string().optional(),
  role: z.enum(["admin", "usuario"]),
  status: z.enum(["active", "disabled"]),
  implicit: z.boolean().optional(), // true = sin registro, `usuario` por defecto (modo interno)
});
export type AccessUser = z.infer<typeof accessUserSchema>;

export type Access =
  | { status: "ok"; user: AccessUser }
  | { status: "forbidden" }        // dado de baja; en `restringido`, también sin alta
  | { status: "unauthenticated" }  // sin JWT válido
  | { status: "error" };

/** ¿Quién es y puede entrar? — GET /api/v1/me (no escribe nada). */
export async function getAccess(reqHeaders: Headers): Promise<Access> {
  const base = process.env.EPA_API_BASE_URL;
  if (!base) {
    console.error("access: EPA_API_BASE_URL is not set");
    return { status: "error" };
  }
  let res: Response;
  try {
    res = await fetchApi(reqHeaders, new URL("/api/v1/me", base));
  } catch (error) {
    console.error("access: fetch to apps/api failed", error);
    return { status: "error" };
  }
  if (res.status === 401) return { status: "unauthenticated" };
  if (res.status === 403) return { status: "forbidden" };
  if (!res.ok) return { status: "error" };

  const parsed = accessUserSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return { status: "error" };
  return parsed.data.status === "active"
    ? { status: "ok", user: parsed.data }
    : { status: "forbidden" };
}
```

Un route handler típico:

```typescript
export async function GET(request: Request) {
  const url = new URL("/api/v1/campaigns", process.env.EPA_API_BASE_URL);
  const res = await fetchApi(request.headers, url);
  if (!res.ok) return Response.json({ error: "upstream" }, { status: res.status }); // nunca reenviar el cuerpo de un 500
  return Response.json(campaignsSchema.parse(await res.json()));
}
```

## 5. `src/app/layout.tsx` — la puerta de la UI

```tsx
import { headers } from "next/headers";
import { getAccess } from "@/lib/api-upstream";
import { readSignOutUrl } from "@/lib/auth-forward";
import { AccessGate } from "@/components/access-gate";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess(await headers());
  return (
    <html lang="es">
      <body>
        {access.status !== "ok" ? (
          <AccessGate access={access} signOutUrl={readSignOutUrl()} />
        ) : (
          /* Providers + navegación con access.user.email, "Cerrar sesión" a
             readSignOutUrl(), y la sección de admin si access.user.role === "admin" */
          children
        )}
      </body>
    </html>
  );
}
```

`AccessGate` es una `Card` de `@epa-datos/ui`, sin navegación ni datos:

| Estado | Título | Texto |
|---|---|---|
| `forbidden` | No tienes acceso a este dashboard | Pide acceso a un administrador o entra con otra cuenta. |
| `unauthenticated` | No pudimos verificar tu sesión | Cierra sesión y vuelve a entrar. |
| `error` | No pudimos verificar tu acceso | Intenta de nuevo en unos minutos. Si sigue pasando, avisa al equipo de EPA. |

Componente de referencia: `apps/web/src/components/access-gate.tsx` de
`chedraui-dashboard` (quitar los estados `pending` y `unverified`, que aquí no
existen).

> El layout es la puerta **visual**. La seguridad es que `apps/api` rechaza
> toda llamada de datos de quien no pase la política de `ACCESS_MODE`. Ocultar
> algo en la UI nunca cuenta como control de acceso. En `interno`, `forbidden`
> solo le llega a quien un admin dio de baja; el resto entra con el `usuario`
> implícito y la UI **no** debe mostrar la sección de admin (`role !== "admin"`).

### Pantalla de accesos (solo admins)

Ruta `/admin/accesos`: lista, alta, cambio de rol, baja (`disabled`). Sus route
handlers usan `fetchApi` contra `/api/v1/admin/access-users*` y validan el input
con Zod antes de reenviarlo. La API vuelve a comprobar que quien llama es admin
(ver `access-control.md`); esconder el menú a quien no lo es solo es comodidad.
Referencia: `components/access-admin.tsx` de `kcm-informe-interno`.

## 6. Desarrollo local

`apps/web/.env.local` (gitignoreado):

```
EPA_API_BASE_URL=http://localhost:8081
DEV_USER_EMAIL=tu@epa.digital
```

Y `apps/api` con `AUTH_MODE=local` y `ACCESS_MODE=interno` (o `restringido`,
según el `AGENTS.md`; sin ella la API no arranca). Con `DATA_SOURCE=mock`, el
repositorio mock de `AccessUsers` da `admin` a cualquier correo: no hace falta
Firestore.

## 7. Tests mínimos (Vitest)

- `identityHeaders`: copia el JWT; con `NODE_ENV=production` **nunca** agrega
  `x-dev-user-email` aunque `DEV_USER_EMAIL` esté puesto.
- `getAccess`: 401 → `unauthenticated`, 403 → `forbidden`, `disabled` →
  `forbidden`, usuario implícito (`implicit: true`) → `ok`, cuerpo con otra
  forma → `error`.
- `proxy`: sin JWT en producción → 401.

---

## Nunca

- **Contraseña compartida, token de sesión estático o login propio** (Firebase
  Auth, NextAuth, Auth.js, Clerk, Auth0…). IAP y Google ya autentican; las
  contraseñas nunca pasan por la app. Es el caso Coppel.
- **`allUsers` como invoker** de Cloud Run, ni `--allow-unauthenticated` en el
  servicio del dashboard.
- Decidir quién es el usuario con algo que mande el navegador (body, query,
  cookie propia): `updatedBy`, "usuario actual" y similares los pone la API a
  partir del token verificado.
- Verificar el JWT en `apps/web` y mandar el correo en un header plano: la API
  quedaría confiando en un header.
- `AUTH_MODE=local` o `DEV_USER_EMAIL` en producción.
- La colección `users` de `bdd-epa-digital`: es la de toda la agencia y está
  protegida (`epa-safe-vibe`). Un dashboard con `ACCESS_STORE=firestore` tiene su
  `AccessUsers` en su propia base de Firestore en `epa-turing`; con `none` no
  tiene ninguna.
- Filtrar filas (qué cuentas ve alguien) en `apps/web`. Si hacen falta, van en
  el service de `apps/api`, antes de armar la query.
