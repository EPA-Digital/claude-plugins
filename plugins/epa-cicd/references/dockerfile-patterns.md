# Dockerfile Patterns — EPA Digital

Dockerfiles optimizados para Cloud Run en epa-turing.
Todos exponenen el puerto 8080 y usan multi-stage builds para imágenes pequeñas.

---

## Python (FastAPI)

```dockerfile
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
ENV PORT=8080
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
```

## TypeScript / Node.js (Hono)

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

## Next.js (frontend + API)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
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

Para Next.js standalone, agregar en `next.config.js`:
```js
module.exports = { output: 'standalone' }
```

---

## .dockerignore recomendado

```
.git
.github
.env
*.key
*.pem
service-account*.json
node_modules
__pycache__
.venv
dist
.next
*.md
Dockerfile*
```
