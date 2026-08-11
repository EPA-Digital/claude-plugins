# EPA Copy Guidelines — Referencia Extendida

Todo el copy de UI en español, sentence case, segunda persona informal (tú).

---

## Reglas base

| Regla | Correcto | Incorrecto |
|---|---|---|
| Capitalización | "Ver reporte" | "Ver Reporte" / "VER REPORTE" |
| Segunda persona | "Tu sesión expirará" | "Su sesión expirará" |
| Punto en labels | "Exportar" (sin punto) | "Exportar." |
| Punto en descripciones | "Sin datos disponibles." | "Sin datos disponibles" |
| Voz activa | "Exportando datos..." | "Los datos están siendo exportados..." |

---

## Loanwords que permanecen en inglés

Siempre en inglés, sin comillas ni cursivas:
```
Pixel, CAPI, EMQ, Funnel, Quick Wins, Insights, Overview,
Dashboard, Performance, Benchmark, Signal, Feed, Tag,
Conversion, Lead, Reach, Impression, Click, CPC, CPM, CPA, ROAS
```

---

## Caracteres especiales

| Uso | Carácter | Unicode | Incorrecto |
|---|---|---|---|
| Separador de metadata | `·` | U+00B7 | `-` o `|` |
| Breadcrumb | `›` | U+203A | `>` o `/` |
| Delta positivo | `▲` | U+25B2 | `↑` `⬆` `+` |
| Delta negativo | `▼` | U+25BC | `↓` `⬇` `-` |
| Rango de fechas | `–` | U+2013 (en dash) | `-` |

---

## Números y métricas

### Humanizar números grandes
```
1,200       →  1.2K
34,800      →  34.8K
340,000     →  340K
1,200,000   →  1.2M
2,300,000   →  2.3M
```

### Porcentajes
```
12.0%   →  12%      (sin .0 en enteros)
12.4%   →  12.4%    (un decimal si no es entero)
0.04%   →  0.04%    (mantener decimales significativos)
```

### Deltas
```
Positivo:  ▲ 8.2% vs semana anterior
Negativo:  ▼ 3.1% vs semana anterior
Cero:      — sin cambio                 (en color content-tertiary)
```

### Moneda
```
$1,200      →  $1.2K
$184.50     →  $184.50   (mantener centavos si son relevantes)
$184.00     →  $184      (omitir .00)
```

### CSS requerido para números en tablas y KPIs
```css
font-variant-numeric: tabular-nums;
```

---

## Patrones de copy por contexto

### Botones de acción
```
✓  Exportar reporte
✓  Conectar cuenta
✓  Ver análisis
✓  Aplicar filtro
✓  Guardar cambios

✗  Haz clic aquí para exportar
✗  Exportar el reporte ahora
✗  Submit / Save / Cancel   ← nunca en inglés en UI
```

### Estados vacíos (título + descripción + acción)
```
Sin datos disponibles
Aún no hay información para este periodo. Ajusta el rango de fechas para ver resultados.
[Cambiar periodo]

Sin campañas activas
Conecta una cuenta de medios para ver el rendimiento de tus campañas.
[Conectar cuenta]

Sin resultados
No encontramos campañas con ese nombre. Intenta con otro término.
[Limpiar búsqueda]
```

### Errores
```
No se pudo cargar la información.        →  acción: [Reintentar]
Error al guardar los cambios.            →  acción: [Intentar de nuevo]
La sesión expiró.                        →  acción: [Iniciar sesión]
No tienes acceso a este recurso.         →  acción: [Solicitar acceso]
```

### Loading / estados de carga
```
Cargando datos...
Actualizando...
Procesando...
Exportando reporte...
```

### Confirmaciones de acción
```
Cambios guardados
Reporte exportado
Campaña actualizada
Cuenta conectada
```

### Tooltips (breves, sin punto)
```
Impresiones totales del periodo seleccionado
Costo por acción promedio
Última actualización: hace 2 horas
```

---

## Fechas y tiempos

```
Fecha completa:    1 de mayo de 2025
Fecha corta:       01/05/2025
Rango:             01/05/2025 – 31/05/2025
Timestamp:         01/05/2025 14:32
Relativo:          hace 2 horas · hace 3 días · ayer
```

---

## Terminología de medios en español

| Término técnico (inglés) | En copy de UI |
|---|---|
| Campaign | Campaña |
| Ad Set | Conjunto de anuncios |
| Ad | Anuncio |
| Account | Cuenta |
| Pixel | Pixel (sin traducir) |
| Conversion | Conversión |
| Audience | Audiencia |
| Creative | Creatividad |
| Placement | Placement (sin traducir) |
| Budget | Presupuesto |
| Spend | Inversión |
| Reach | Alcance |
| Frequency | Frecuencia |
| Impression | Impresión |
| Click | Clic |

---

## Lo que nunca hacer

```
✗  Usar "usted" — siempre "tú"
✗  Usar emoji en UI — usar ▲▼ · › en su lugar
✗  ALL-CAPS en oraciones o botones
✗  "Haz clic aquí" — ser directo con la acción
✗  "Por favor" en mensajes de error — ir al punto
✗  Números sin formato: 1200000 → debe ser 1.2M
✗  Fechas en formato anglosajón: May 1, 2025 → 1 de mayo de 2025
✗  Traducir loanwords técnicos: "Embudo" en lugar de "Funnel"
```
