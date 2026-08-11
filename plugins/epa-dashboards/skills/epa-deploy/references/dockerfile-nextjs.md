# Dockerfile — Next.js en Cloud Run

Multi-stage build para imagen pequeña, con pnpm (corepack) y Node 22 LTS —
consistente con el stack cerrado de `epa-frontend`. **No usar `npm`** en
ningún stage.

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
