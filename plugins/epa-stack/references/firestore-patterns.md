# Firestore — Patrones avanzados en epa-turing

Proyecto: `epa-turing` · Modo: Native · Convenciones de naming en epa-naming.

Firestore es la base de datos de documentos para estado de aplicación, perfiles
de usuario, configuración y datos no analíticos. Para datos tabulares grandes,
usar BigQuery.

---

## Modelado — antes de crear una colección

Hacer estas preguntas en orden:

1. **¿Cuál es el patrón de lectura más frecuente?** Firestore se modela alrededor
   de la query, no de la entidad.
2. **¿Cuántos documentos esperamos en 12 meses?** >1M en una colección plana
   requiere subcolecciones o sharding.
3. **¿Hay datos que necesiten queries de agregación (sum, avg)?** Esos viven en
   BigQuery, no Firestore.
4. **¿Hay relaciones N-a-N?** Firestore no tiene JOINs — modelar con referencias
   o duplicación intencional.

---

## Estructura jerárquica vs plana

### Plana (default)
```
CoppelCampaigns/{campaignId}
  - name
  - status
  - budget
  - clientId
```

Buena cuando: querys son globales, los documentos son independientes.

### Subcolecciones
```
Clients/{clientId}/Campaigns/{campaignId}
  - name
  - status
```

Buena cuando: las queries están limitadas al scope del padre. Permite reglas
de seguridad por cliente.

### Referencias (foreign keys)
```
CoppelCampaigns/{campaignId}
  - name
  - clientRef: /Clients/coppel
```

Útil para deduplicar metadata. Costo: reads adicionales por cada documento
relacionado (no hay JOIN — se hacen reads explícitas).

---

## Lecturas eficientes

### Siempre con `limit()`
```python
from google.cloud import firestore

db = firestore.Client(project="epa-turing")

# ✓ Correcto
docs = db.collection("CoppelCampaigns").limit(100).stream()

# ✗ Bloqueado por epa-safe-vibe — puede traer millones de docs
docs = db.collection("CoppelCampaigns").stream()
```

### Paginación con cursor

```python
# Primera página
first_page = (
    db.collection("CoppelCampaigns")
      .order_by("created_at", direction=firestore.Query.DESCENDING)
      .limit(50)
      .stream()
)
docs = list(first_page)
last_doc = docs[-1]

# Siguiente página
next_page = (
    db.collection("CoppelCampaigns")
      .order_by("created_at", direction=firestore.Query.DESCENDING)
      .start_after(last_doc)
      .limit(50)
      .stream()
)
```

### Composite indexes — declarar en código

Cualquier query con múltiples `where()` sobre campos diferentes requiere índice
compuesto. Firestore lo dirá en el primer error con un link directo. Mejor
declararlo en `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "CoppelCampaigns",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status",     "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Y deployar con `firebase deploy --only firestore:indexes` o gcloud equivalente.

---

## Escrituras

### Siempre con `merge=True`
```python
# ✓ Mantiene campos existentes que no estén en data
db.collection("CoppelCampaigns").document(doc_id).set(data, merge=True)

# ✗ Sobreescribe completo — borra cualquier campo no incluido en data
db.collection("CoppelCampaigns").document(doc_id).set(data)
```

Excepción: cuando intencionalmente se quiere reemplazar. Documentar el porqué.

### Update parcial
```python
db.collection("CoppelCampaigns").document(doc_id).update({
    "status": "paused",
    "updated_at": firestore.SERVER_TIMESTAMP
})
```

### Batch writes (hasta 500 ops)
```python
batch = db.batch()
for campaign in campaigns_to_update:
    ref = db.collection("CoppelCampaigns").document(campaign["id"])
    batch.set(ref, campaign, merge=True)
batch.commit()
```

### Transacciones — para read-modify-write atómico
```python
@firestore.transactional
def increment_counter(transaction, ref):
    snapshot = ref.get(transaction=transaction)
    transaction.update(ref, {
        "count": snapshot.get("count") + 1
    })

increment_counter(db.transaction(), db.collection("Counters").document("daily"))
```

---

## Timestamps y auditoría

Toda colección de producción debe tener:
```python
{
    "created_at": firestore.SERVER_TIMESTAMP,
    "updated_at": firestore.SERVER_TIMESTAMP,
    "created_by": "user_id_o_service_account",
    "updated_by": "user_id_o_service_account"
}
```

`SERVER_TIMESTAMP` es autoritativo del lado del servidor — evita drift de relojes.

---

## TTL (Time-To-Live)

Para datos efímeros (sesiones, caches, locks):
```python
import datetime

expires_at = datetime.datetime.utcnow() + datetime.timedelta(hours=1)

db.collection("PitagorasTokens").document(token_id).set({
    "user_id": user_id,
    "token": token_value,
    "expires_at": expires_at
})
```

Configurar TTL policy una vez (en consola o gcloud) sobre el campo `expires_at`.
Firestore borra automáticamente — sin code adicional.

---

## Security Rules — modelo recomendado

```
service cloud.firestore {
  match /databases/{database}/documents {

    // Lectura pública NUNCA por default
    match /{document=**} {
      allow read, write: if false;
    }

    // PitagorasUsers: el usuario solo lee/edita su propio doc
    match /PitagorasUsers/{userId} {
      allow read, update: if request.auth.uid == userId;
      allow create: if request.auth != null;
    }

    // Datos de cliente: solo el equipo del cliente
    match /CoppelCampaigns/{campaignId} {
      allow read, write: if request.auth.token.team == "coppel";
    }
  }
}
```

Reglas obligatorias:
- Default deny (`allow ... if false` global).
- Validar `request.auth` en toda regla de read/write.
- NUNCA `if true` en producción.

---

## Backups

Configurar backup automático del proyecto entero:
```bash
gcloud firestore operations describe \
  --project=epa-turing \
  $(gcloud firestore export gs://epa-backups-prod/firestore/$(date +%Y-%m-%d) \
    --project=epa-turing --async --format='value(name)')
```

Frecuencia mínima recomendada: **diaria** para colecciones críticas (PitagorasUsers,
PitagorasTokens, EpaSettings).

---

## Patrones específicos

### Counter distribuido (alta concurrencia)

Firestore tiene un límite de ~1 escritura/segundo por documento. Para contadores
concurrentes, usar shards:

```python
import random

NUM_SHARDS = 10

def increment_shard(counter_id):
    shard_id = random.randint(0, NUM_SHARDS - 1)
    ref = db.collection("Counters").document(counter_id) \
            .collection("shards").document(str(shard_id))
    ref.update({"count": firestore.Increment(1)})

def get_count(counter_id):
    shards = db.collection("Counters").document(counter_id) \
                .collection("shards").stream()
    return sum(s.to_dict().get("count", 0) for s in shards)
```

### Listas largas embebidas → subcolección

Si un documento crece >1 MB (límite Firestore), mover el array a subcolección.
Ejemplo: `Campaign.events: [...]` con miles de eventos → `Campaign/events/{id}`.

### Búsqueda full-text

Firestore NO tiene full-text search. Opciones:
1. Para casos simples: campo `tags: ["coppel", "performance", "q4"]` con
   `array_contains`.
2. Para búsqueda real: indexar a Algolia o ElasticSearch desde un trigger.
3. Para analytics: copiar a BigQuery y usar SEARCH/REGEXP.

---

## Anti-patrones

```
✗ Lecturas sin limit()
✗ Set sin merge=True (sobreescribe campos)
✗ Modelar con JOINs mentales (Firestore no tiene)
✗ Documentos >1 MB (límite duro)
✗ Más de 1 escritura/segundo en el mismo doc (usar shards)
✗ Almacenar datos analíticos (eso es BigQuery)
✗ Reglas con `allow ... if true` en producción
✗ Eliminar PitagorasUsers o PitagorasTokens — BLOQUEO TOTAL
```

---

## Checklist nueva colección

```
NAMING
[ ] Sigue patrón {Producto}{Entidad} o {Cliente}{Entidad}
[ ] PascalCase, sin guiones, sin acentos

ESQUEMA
[ ] Campos created_at, updated_at, created_by, updated_by
[ ] No hay arrays que puedan crecer sin límite (>500 items)
[ ] Tamaño esperado de doc < 100 KB

QUERIES
[ ] Definidos los patrones de lectura más frecuentes
[ ] Composite indexes declarados en firestore.indexes.json
[ ] Todas las queries del código usan limit()

SEGURIDAD
[ ] Security rules específicas (no allow if true)
[ ] El service account del runtime tiene mínimo permiso necesario
[ ] No hay datos sensibles sin cifrar (tokens, credenciales)

OPERACIONES
[ ] Configurada en backup diario si es crítica
[ ] TTL policy si los datos son efímeros
[ ] Documentada en el README del producto
```
