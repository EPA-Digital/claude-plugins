# Sidecar — la topología de dos contenedores

Única fuente de cómo `web` y `api` conviven en un solo servicio de Cloud
Run. `epa-deploy` y `epa-frontend/references/auth.md` apuntan aquí — no
repiten el comando de deploy ni los grants de IAM.

---

## El comando de deploy completo

`gcloud run deploy` acepta banderas por contenedor desde la bandera
`--container` (verificado contra `gcloud run deploy --help`, SDK 580.0.0,
sección *Container Flags*: **las banderas service-level van antes del
primer `--container`; las banderas de contenedor van después del suyo**):

```bash
gcloud run deploy {cliente}-dashboard-vibe \
  --project=epa-turing --region=us-central1 \
  --service-account={cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --min-instances=0 --max-instances=10 \
  --labels=epa-managed-by={cliente}-dashboard \
  --container=web \
    --image=us-central1-docker.pkg.dev/epa-turing/epa-containers/{cliente}-dashboard-web:$SHA \
    --port=8080 --cpu=1 --memory=1Gi \
    --depends-on=api \
    --update-env-vars=EPA_API_BASE_URL=http://localhost:8081 \
  --container=api \
    --image=us-central1-docker.pkg.dev/epa-turing/epa-containers/{cliente}-dashboard-api:$SHA \
    --cpu=1 --memory=512Mi \
    --startup-probe=httpGet.path=/health,httpGet.port=8081 \
    --update-env-vars=PORT=8081,BQ_BILLING_PROJECT=epa-turing,BQ_DATA_PROJECT=bdd-epa-digital,BQ_DATASET={cliente}_reporting,BQ_ADS_MCC={mcc},BQ_MAX_BYTES_BILLED=104857600
```

Notas sobre este comando:
- `--depends-on=api` en el contenedor `web` le dice a Cloud Run que arranque
  `api` primero y espere su startup probe antes de arrancar `web` — evita
  la carrera donde `web` recibe tráfico antes de que `api` esté listo.
- `api` **no tiene `--port`** — es justo lo que lo mantiene sin ingress.
  `PORT=8081` va como env var explícita porque, sin `--port`, Cloud Run
  tampoco se la inyecta automáticamente.
- `--update-env-vars`, nunca `--set-env-vars` — este comando ya tiene otras
  env vars en el mismo contenedor; `--set-env-vars` reemplazaría el set
  completo en vez de agregarlas.

---

## Por qué no hay auth en el salto `web` → `api`

Los contenedores de un mismo servicio de Cloud Run comparten el namespace
de red de la instancia. `http://localhost:8081` **no es alcanzable desde
fuera de la instancia** — no hay ruta, no hay URL pública, no hay IAM que
configurar mal, y por lo tanto no hay superficie de ataque que auditar en
ese salto. Es el patrón que Google documenta para sidecars (Envoy, Cloud
SQL Proxy, colectores de OpenTelemetry): la comunicación intra-instancia no
necesita el mismo tratamiento que una llamada entre dos servicios
independientes.

Esto es deliberadamente más simple que un diseño de dos servicios con ID
tokens (`idtoken.NewValidator`, `run.invoker`, `ALLOWED_INVOKER_SAS`) — ese
diseño se evaluó y se descartó en esta sesión precisamente porque el
aislamiento de red del sidecar ya da la misma garantía (de hecho más
fuerte: no hay URL que alcanzar, ni con IAM mal configurado) sin la
superficie de fallo de un handshake.

---

## El costo real y su control compensatorio

Los dos contenedores de un servicio de Cloud Run **comparten la misma
service account**. El proceso de `web` hereda los permisos de BigQuery de
`{cliente}-dashboard-runtime`, aunque no los use.

La compensación es una regla verificada, no una preferencia de estilo:
`apps/web` **nunca** declara `@google-cloud/bigquery` ni ningún otro
cliente de BigQuery (ver `epa-frontend` regla 5, `anti-stack.md`). Es el
hallazgo **crítico** #1 de `security-reviewer` §7 — si `web` nunca puede
hablar con BigQuery en el código, que herede el permiso a nivel de IAM deja
de importar en la práctica.

---

## Grants de IAM — única fuente

```bash
# Una sola SA para los dos contenedores.
gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:{cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

gcloud projects add-iam-policy-binding epa-turing \
  --member="serviceAccount:{cliente}-dashboard-runtime@epa-turing.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer" \
  --condition='expression=resource.name.startsWith("projects/bdd-epa-digital/datasets/{cliente}_reporting"),title={cliente}-reporting-only'
```

**Los dos roles son necesarios.** `dataViewer` por sí solo no incluye
`bigquery.jobs.create` — la primera query que corra el contenedor `api` da
403 sin `jobUser` también. `epa-deploy/references/cloud-run-config.md` es
el hogar documentado de esta SA; este bloque es la única fuente de los
comandos exactos — no se repiten en otro archivo.

---

## Dev local — idéntico a producción

```bash
# terminal 1
cd apps/api && go run ./cmd/api   # escucha en :8081

# terminal 2
cd apps/web && EPA_API_BASE_URL=http://localhost:8081 pnpm dev
```

Sin impersonación de service account, sin modo passthrough, sin
configuración especial — es exactamente la misma topología que producción,
solo que ambos procesos corren en la máquina del desarrollador en vez de en
la misma instancia de Cloud Run. Las credenciales de BigQuery en local
salen de `gcloud auth application-default login` (el ADC de usuario sí
sirve para BigQuery — la limitación de ADC de usuario que sí importaba en
el diseño de dos servicios era no poder emitir ID tokens, y ese problema ya
no existe en absoluto con sidecar).

---

## Troubleshooting

**`web` recibe 502 / `ECONNREFUSED` al hacer fetch a `localhost:8081`:**
1. Confirmar que `api` tiene `PORT=8081` en sus env vars (no lo infiere de
   `--port`, porque no tiene).
2. Confirmar `--depends-on=api` en el contenedor `web`.
3. Revisar el startup probe de `api` — si falla, Cloud Run nunca deja que
   `web` reciba tráfico. Verificar en el primer deploy real si el probe
   `httpGet.port=8081` contra un sidecar se acepta tal cual o hay que
   bajarlo a `tcpSocket.port=8081`.
4. **Lo que NO se hace nunca:** agregar `--port` a `api` "para que le
   llegue" — eso le da ingress público y anula todo el argumento de
   aislamiento de red de este documento. Es un hallazgo crítico de
   `security-reviewer` §7, no un workaround válido.

**403 `bigquery.jobs.create` en la primera query de `api`:** falta el rol
`roles/bigquery.jobUser` en la SA — `dataViewer` solo no alcanza (ver
sección de IAM arriba).

**"container failed to start" en el log del servicio:** con dos
contenedores hay dos fuentes de log — filtrar por
`labels."run.googleapis.com/container_name"` para saber si el que falló es
`web` o `api` antes de diagnosticar.
