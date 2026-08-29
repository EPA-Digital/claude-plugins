# Dockerfile — Next.js en Cloud Run

Multi-stage build para imagen pequeña, con pnpm (corepack) y Node 22 LTS —
consistente con el stack cerrado de `epa-frontend` (Next 16). **No usar
`npm`** en ningún stage.

> ⚠️ **Next 16 — tres áreas a revisar en el primer dashboard real**
> (recomendación de `iescutia` al integrar `@epa-datos/ui`, ver
> `epa-frontend/references/stack.md`): middleware de rutas protegidas,
> `await` al leer `params`/`searchParams` en Server Components, y la imagen
> base de Docker. Esta última **ya está resuelta** — `node:22-alpine`
> satisface el mínimo de Next 16 — las otras dos no tienen código de
> ejemplo en este plugin todavía, así que no hay nada que migrar hoy, solo
> tenerlas presentes al escribir el primer middleware/route real.

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 8080
CMD ["node", "server.js"]
```

Requiere `output: 'standalone'` en `next.config.js` (ya lo trae el stack
cerrado):
```js
module.exports = { output: 'standalone' }
```

`ENV PORT=8080` + `EXPOSE 8080` son correctos tal cual — Next.js standalone
respeta la variable `PORT` que Cloud Run inyecta.

---

## `.dockerignore` recomendado

```
.git
.github
.env*
*.key
*.pem
service-account*.json
node_modules
.next
*.md
Dockerfile*
docs/
```
