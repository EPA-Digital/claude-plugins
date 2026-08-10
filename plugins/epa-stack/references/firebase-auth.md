# Firebase Authentication — patrón GCP-nativo para auth de usuarios

Firebase es una capa de Google Cloud, no un proyecto separado: se habilita
**sobre el mismo proyecto `epa-turing`**, sin crear infraestructura nueva.
Es el patrón por default para autenticación de usuarios — evita depender de
terceros no-GCP (ej. Supabase) para algo que Google ya resuelve dentro del
mismo proyecto.

---

## Setup — una sola vez por proyecto

1. [Firebase Console](https://console.firebase.google.com) → **Agregar
   proyecto** → seleccionar el proyecto GCP existente `epa-turing` (Firebase
   se activa sobre él, no crea un proyecto nuevo).
2. **Authentication** → **Sign-in method** → habilitar los proveedores que
   necesite el producto (Google, email/password, etc.).
3. **Project Settings → General → Tus apps** → **Agregar app → Web** →
   copiar la config a las variables `NEXT_PUBLIC_FIREBASE_*` (ver abajo).

---

## Variables de entorno

Las variables del cliente Firebase **no son secretas** — Firebase las expone
al navegador por diseño (la seguridad la dan las Firebase Security Rules /
la verificación del token en el backend, no ocultar estos valores):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=epa-turing.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=epa-turing
```

El backend **no necesita un secret nuevo**: la verificación de tokens usa
Firebase Admin SDK con las mismas credenciales de service account
(`GOOGLE_APPLICATION_CREDENTIALS`) que ya se usan para BigQuery/Firestore.

---

## Cliente — Next.js

```typescript
// lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
```

---

## Backend — verificar el token (FastAPI)

```python
import firebase_admin
from firebase_admin import auth, credentials

firebase_admin.initialize_app(credentials.ApplicationDefault())

def verify_firebase_token(id_token: str) -> dict:
    """Lanza ValueError si el token es inválido o expiró."""
    return auth.verify_id_token(id_token)
```

`credentials.ApplicationDefault()` reusa `GOOGLE_APPLICATION_CREDENTIALS` —
no requiere una key de Firebase separada.

---

## Backend — verificar el token (Hono / TypeScript)

```typescript
import { getAuth } from 'firebase-admin/auth'
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app'

const app = getApps().length ? getApps()[0] : initializeApp({ credential: applicationDefault() })

export async function verifyFirebaseToken(idToken: string) {
  return getAuth(app).verifyIdToken(idToken) // lanza si es inválido o expiró
}
```

---

## Guardar permisos por usuario

Para mapear el UID de Firebase a permisos/cliente dentro de EPA, usar
Firestore (nunca Sheets):

```
{Producto}Users/{uid}
  cliente: "coppel"
  rol: "viewer"
```

Sigue la convención `{Producto}{Entidad}` de `epa-naming`. No confundir con
la colección legacy `users` de `bdd-epa-digital`, que está protegida y es
exclusiva de la autenticación interna de la agencia — no mezclar ni migrar
sin confirmar con el área de Datos e IA.

---

## Cuándo NO usar Firebase Auth

| Necesidad | Herramienta correcta |
|---|---|
| Autenticación de service-to-service (Cloud Run → Cloud Run) | IAM + ID tokens (ver `cloud-run-config.md`) |
| Permisos de acceso a datos de la agencia (`bdd-epa-digital`) | Colección legacy `users` — protegida, no tocar |
| Autorización de acceso a Pitágoras | `user_email` autorizado por el área de Datos e IA, no Firebase |
