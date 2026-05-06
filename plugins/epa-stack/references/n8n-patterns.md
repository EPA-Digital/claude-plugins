# n8n — Patrones de flujos en EPA Digital

Instancia EPA: `epa-digital.app.n8n.cloud`. n8n es la herramienta canónica para
flujos visuales con múltiples pasos: ETLs ligeros, alertas, integraciones entre
sistemas SaaS, automations de negocio.

Antes de construir un flujo en n8n, validar que es el lugar correcto:

```
✓ n8n cuando:
  - Hay >2 pasos con dependencias entre sistemas
  - Hay branching condicional visible que el negocio quiere ver
  - El equipo no técnico necesita modificar la lógica
  - Es una alerta o notificación recurrente

✗ NO n8n cuando:
  - Es transformación pesada de datos (>10K filas) → Cloud Run
  - Hay lógica compleja con loops anidados → Cloud Run
  - Necesita ejecutarse en <1 segundo de latencia → Cloud Run + Pub/Sub
  - Es una API que recibe requests externos → Cloud Run
```

---

## Convenciones de naming en n8n

### Workflow name
```
[{Cliente|Producto}] {Acción corta} — {Trigger}

Ejemplos:
[Coppel] Alerta gasto diario — Schedule 09:00
[Pitágoras] Sync usuarios → HubSpot — Webhook
[Chedraui] Generar reporte semanal — Schedule lunes 07:00
[Interno] Notificar deploys exitosos — Webhook GitHub
```

### Folders
Organizar por cliente o producto:
```
/Coppel
/Chedraui
/Innovasport
/Nestlé
/Pitágoras
/Interno
```

Crear el folder al onboardear un cliente nuevo (consultar la lista vigente con
el área de Datos e IA antes de inventar nombres).

### Node names
Renombrar todos los nodes a algo descriptivo. NO dejar el default
"HTTP Request" o "Set". Ejemplo:
```
"Get campaigns from Pitágoras"
"Filter active only"
"Format Slack message"
"Send to #alerts-coppel"
```

---

## Patrones recurrentes

### 1. Alerta de performance — Schedule + Pitágoras + Slack

```
Schedule Trigger (every day 09:00 America/Mexico_City)
    ↓
HTTP Request → Pitágoras API
    GET /api/v1/{platform}/campaigns?client_id={id}&date_from=...
    Auth: Bearer ${PITAGORAS_API_KEY}
    ↓
Code (JavaScript) — Filter campaigns con spend > umbral
    ↓
IF (count > 0)
    ↓
Slack — Post Message a canal del cliente
    ↓
Set status = "ok" o "no_alerts"
```

Variables de credenciales se guardan en n8n Credentials, NO en el flow JSON.

### 2. Sync entre dos sistemas — Trigger por cambio

```
Webhook Trigger (recibe evento de sistema A)
    ↓
HTTP Request → Sistema A (enrich con datos completos)
    ↓
Set — Map fields al schema del sistema B
    ↓
HTTP Request → Sistema B (POST/PATCH)
    ↓
IF (success)
    ↓
HTTP Request → Pitágoras Logs (registra el sync)
    ↓
Respond to Webhook (200 OK)
```

### 3. Reporte programado — Schedule + BigQuery + Email

```
Schedule Trigger (every Monday 07:00)
    ↓
BigQuery — Run scheduled query (lectura solo, con maximum_bytes_billed)
    ↓
Code — Format result a tabla HTML o CSV
    ↓
Send Email — Gmail node con destinatarios del cliente
    ↓
Google Drive — Backup del archivo en epa-reports-prod (vía API)
```

### 4. Trigger desde GitHub → notificación

```
Webhook Trigger (GitHub push o release event)
    ↓
IF (branch == 'main' && action == 'push')
    ↓
Slack — Post a #deploys-prod con SHA, autor, mensaje
```

---

## Acceso a credenciales

n8n tiene su propio store de credenciales. NUNCA pegar API keys en JSON del flow.

**Convención de nombres en n8n Credentials:**
```
EPA · Pitágoras API
EPA · BigQuery (epa-turing)
EPA · Slack Webhook (alerts-coppel)
EPA · GitHub PAT (deploy notifications)
```

Para credenciales que también se usan en código (Cloud Run), mantener una sola
fuente de verdad: Secret Manager. Sincronizar manualmente al rotar.

---

## Manejo de errores

### Workflow-level error workflow
Configurar un "Error Workflow" en cada flow productivo para que cualquier fallo
notifique:

```
[Error Workflow] EPA · Notificar fallos n8n
    ↓ (se dispara automáticamente al fallar otro workflow)
Slack — Post a #n8n-errors con:
    - Workflow name
    - Node que falló
    - Error message
    - Link a la execution
```

### Reintentos por node
En nodes HTTP, activar:
- `Retry on fail`: enabled
- `Retry attempts`: 3
- `Retry between attempts`: 5s con backoff

### Idempotencia
Los workflows que escriben a BigQuery o Firestore deben ser idempotentes. Usar:
- Patrón MERGE en BigQuery (ver bigquery-patterns.md).
- `set(merge=True)` en Firestore.
- Idempotency key en headers cuando se llama API externa.

---

## Performance

```
Para volúmenes de datos:
  < 1K registros           →  n8n flow estándar
  1K – 10K registros       →  n8n con SplitInBatches
  > 10K registros          →  NO n8n. Cloud Run job.

Para frecuencia:
  Diaria, semanal          →  n8n Schedule
  Cada 5 minutos           →  n8n Schedule (revisar costo)
  Cada segundo, push       →  Cloud Run + Pub/Sub
```

### SplitInBatches
Para procesar listas grandes sin saturar APIs:
```
Get campaigns (5,000 items)
    ↓
SplitInBatches (size=50)
    ↓
HTTP Request to API destino
    ↓ (loop hasta agotar batches)
Wait 1s
```

---

## Ambientes y promoción

n8n cloud no tiene "staging" nativo. Convención EPA:

```
Workflow productivo:    [Coppel] Alerta gasto diario — Schedule 09:00
Workflow staging:       [DEV] [Coppel] Alerta gasto diario — Manual trigger
```

El staging:
- Tag prefix `[DEV]`.
- Trigger manual (NO schedule activo).
- Apunta a credenciales de prueba o canales `#test-*`.

Para promover: duplicar a producción, quitar `[DEV]`, activar trigger.

---

## Guardar el flow como código (opcional)

n8n permite exportar como JSON. Para flows críticos, mantener export en repo:
```
ops/n8n-flows/
├── coppel-alerta-gasto-diario.json
├── pitagoras-sync-hubspot.json
└── README.md  ← qué hace cada uno y cómo restaurarlos
```

NO commitear si el JSON contiene credenciales — n8n las exporta vacías por
default, validar antes.

---

## Anti-patrones

```
✗ Pegar API keys en el JSON del flow
✗ Workflows sin error handler configurado
✗ Procesar >10K registros sin SplitInBatches
✗ Schedule de cada minuto cuando un evento serviría mejor
✗ Lógica de negocio compleja en nodes "Code" — mover a Cloud Run
✗ Flows sin Folder asignado (caos en la UI)
✗ Nombres genéricos ("My workflow", "Untitled")
✗ Credenciales con nombres ambiguos ("API Key", "Token")
```

---

## Cuándo migrar de n8n a Cloud Run

Señales:
- El flow tiene >20 nodes y se vuelve ilegible.
- Falla constantemente por timeouts (>5 min de ejecución).
- Procesa >10K registros por run.
- Lógica condicional anidada >3 niveles.
- Necesita librerías Python específicas (pandas, scikit-learn).

Migración: extraer el flow a un Cloud Run job con Cloud Scheduler. Mantener un
n8n flow mínimo solo si el negocio quiere visibilidad del trigger.
