# EPA Components — Patrones de Referencia

> ⚠️ **SUPERSEDED (2026-08) — usar `references/epa-ui.md`.** Este archivo
> es HTML/CSS a mano con `#003AD6` incrustado, escrito antes de que
> `epa-ui` (la librería de componentes real, `epa-datos/epa-ui`) se
> integrara al plugin. Hoy contradice dos cosas a la vez: el primary de
> producto ya no es `#003AD6` (ver `epa-design/SKILL.md`), y "componentes
> hechos a mano" es justo lo que el anti-stack del plugin prohíbe. Se
> conserva sin borrar por el mismo motivo que `stack.md` conserva `@epa/data`
> — para no perder el porqué de cada patrón y no re-litigarlo — pero no es
> lo que hay que copiar en un dashboard nuevo.

Todos los componentes del design system con HTML/CSS listo para usar.
Todos son superficie `product` salvo que se indique lo contrario.

---

## Botones

```html
<!-- PRIMARY -->
<button class="btn-primary">Acción principal</button>

<!-- SECONDARY -->
<button class="btn-secondary">Acción secundaria</button>

<!-- GHOST -->
<button class="btn-ghost">Descartar</button>

<style>
.btn-primary, .btn-secondary, .btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.1px;
  cursor: pointer;
  transition: background 150ms, border-color 150ms, color 150ms;
  white-space: nowrap;
}
/* Focus ring compartido */
.btn-primary:focus-visible,
.btn-secondary:focus-visible,
.btn-ghost:focus-visible {
  outline: 2px solid #003AD6;
  outline-offset: 1px;
}
/* Disabled compartido */
.btn-primary:disabled,
.btn-secondary:disabled,
.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary { background: #003AD6; color: #FFFFFF; border: none; }
.btn-primary:hover { background: #002BAF; }

.btn-secondary { background: transparent; color: #003AD6; border: 0.5px solid #003AD6; }
.btn-secondary:hover { background: #E8EFFE; }

.btn-ghost { background: transparent; color: #6B6B6B; border: none; }
.btn-ghost:hover { background: #F5F5F5; }
</style>
```

---

## Status Pills

```html
<span class="pill pill-success">Señal saludable</span>
<span class="pill pill-warning">Señal en alerta</span>
<span class="pill pill-danger">Señal crítica</span>
<span class="pill pill-epa">Próximamente</span>
<span class="pill pill-neutral">Inactivo</span>

<style>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 9999px;
  border: 0.5px solid transparent;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
.pill-success { background:#F0FDF4; color:#166534; border-color:#BBF7D0; }
.pill-warning  { background:#FFFBEB; color:#92400E; border-color:#FDE68A; }
.pill-danger   { background:#FEF2F2; color:#991B1B; border-color:#FECACA; }
.pill-epa      { background:#E8EFFE; color:#003AD6; border-color:#B8CAFE; }
.pill-neutral  { background:#F5F5F5; color:#6B6B6B; border-color:#E5E5E5; }

/* Dot indicador opcional */
.pill-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pill-success .pill-dot { background: #16A34A; }
.pill-warning  .pill-dot { background: #D97706; }
.pill-danger   .pill-dot { background: #DC2626; }
</style>
```

---

## KPI Card

```html
<div class="kpi-card">
  <div class="kpi-label">CONVERSIONES</div>
  <div class="kpi-value">12.4K</div>
  <div class="kpi-delta kpi-delta--up">▲ 8.2% vs semana anterior</div>
</div>

<!-- Delta negativo -->
<div class="kpi-card">
  <div class="kpi-label">CPA PROMEDIO</div>
  <div class="kpi-value">$184</div>
  <div class="kpi-delta kpi-delta--down">▼ 3.1% vs semana anterior</div>
</div>

<!-- Sin delta -->
<div class="kpi-card">
  <div class="kpi-label">CAMPAÑAS ACTIVAS</div>
  <div class="kpi-value">24</div>
  <div class="kpi-delta kpi-delta--neutral">— sin cambio</div>
</div>

<style>
.kpi-card {
  background: #FFFFFF;
  border: 0.5px solid #E5E5E5;
  border-radius: 10px;
  padding: 16px 20px;
}
.kpi-label {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.6px; text-transform: uppercase;
  color: #A3A3A3; margin-bottom: 8px;
  font-feature-settings: "case";
}
.kpi-value {
  font-size: 22px; font-weight: 600;
  line-height: 28px; letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
  color: #0A0A0A; margin-bottom: 4px;
}
.kpi-delta { font-size: 12px; font-weight: 400; line-height: 18px; }
.kpi-delta--up   { color: #166534; }
.kpi-delta--down { color: #991B1B; }
.kpi-delta--neutral { color: #A3A3A3; }
</style>
```

---

## Form Input

```html
<div class="field">
  <label class="field-label">Rango de fechas</label>
  <input type="text" class="field-input" placeholder="01/05/2025 – 31/05/2025">
</div>

<!-- Search variant -->
<div class="field-search">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="#A3A3A3" stroke-width="1.5" stroke-linecap="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
  <input type="search" class="field-input field-input--search" placeholder="Buscar campaña...">
</div>

<style>
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 12px; font-weight: 500;
  color: #6B6B6B; letter-spacing: -0.1px;
}
.field-input {
  height: 32px;
  padding: 0 12px;
  background: #F5F5F5;
  border: 0.5px solid #E5E5E5;
  border-radius: 6px;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  color: #0A0A0A;
  transition: border-color 150ms;
  outline: none;
}
.field-input:focus {
  border-color: #003AD6;
  box-shadow: 0 0 0 2px rgba(0,58,214,0.12);
}
.field-search { position: relative; display: flex; align-items: center; }
.field-search svg { position: absolute; left: 10px; pointer-events: none; }
.field-input--search { padding-left: 32px; }
</style>
```

---

## Data Table

```html
<table class="data-table">
  <thead>
    <tr>
      <th>CAMPAÑA</th>
      <th class="num">IMPRESIONES</th>
      <th class="num">CLICS</th>
      <th class="num">CTR</th>
      <th>ESTADO</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="primary-col">Coppel Semana Santa</td>
      <td class="num">1.2M</td>
      <td class="num">34.8K</td>
      <td class="num">2.9%</td>
      <td><span class="pill pill-success">Activa</span></td>
    </tr>
    <tr>
      <td class="primary-col">StarTravel Verano</td>
      <td class="num">340K</td>
      <td class="num">8.1K</td>
      <td class="num">2.4%</td>
      <td><span class="pill pill-warning">En revisión</span></td>
    </tr>
  </tbody>
</table>

<style>
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
}
.data-table th {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.6px; text-transform: uppercase;
  color: #A3A3A3;
  background: #FAFAFA;
  padding: 8px 12px;
  text-align: left;
  border-bottom: 0.5px solid #E5E5E5;
  font-feature-settings: "case";
}
.data-table td {
  font-size: 13px; font-weight: 400;
  letter-spacing: -0.1px; color: #0A0A0A;
  padding: 10px 12px;
  border-bottom: 0.5px solid #E5E5E5;
}
.data-table tbody tr:hover td { background: #FAFAFA; }
.data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.data-table .primary-col { font-weight: 500; }
</style>
```

---

## Empty State

```html
<div class="empty-state">
  <!-- Reemplazar con ícono Lucide apropiado al contexto -->
  <svg class="empty-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
  </svg>
  <h3 class="empty-title">Sin datos disponibles</h3>
  <p class="empty-desc">
    Aún no hay información para mostrar en este periodo.
    Ajusta el rango de fechas para ver resultados.
  </p>
  <button class="btn-ghost">Cambiar periodo</button>
</div>

<style>
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; text-align: center;
  padding: 40px 24px;
  background: #FFFFFF;
  border-radius: 10px;
}
.empty-icon { color: #D4D4D4; margin-bottom: 12px; }
.empty-title {
  font-size: 15px; font-weight: 600;
  letter-spacing: -0.3px; color: #0A0A0A;
  margin: 0 0 8px;
}
.empty-desc {
  font-size: 13px; color: #6B6B6B;
  line-height: 20px; letter-spacing: -0.1px;
  max-width: 320px; margin: 0 0 16px;
}
</style>
```

---

## Error y Info Banners

```html
<!-- Error -->
<div class="banner banner-error">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
  <span>No se pudo cargar la información. <a href="#">Reintentar</a></span>
</div>

<!-- Info -->
<div class="banner banner-info">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
  <span>Los datos se actualizan cada 24 horas a las 6:00 AM.</span>
</div>

<style>
.banner {
  display: flex; align-items: flex-start;
  gap: 10px; padding: 12px 16px;
  border-radius: 8px; border: 0.5px solid transparent;
  font-size: 13px; letter-spacing: -0.1px; line-height: 20px;
}
.banner-error {
  background: #FEF2F2; color: #991B1B; border-color: #FECACA;
}
.banner-info {
  background: #E8EFFE; color: #00199C; border-color: #B8CAFE;
}
.banner a { color: inherit; font-weight: 500; }
</style>
```

---

## Nav Item (sidebar)

```html
<nav class="sidebar-nav">
  <div class="nav-group-label">ANÁLISIS</div>
  <a href="#" class="nav-item nav-item--active">
    <svg width="16" height="16" ...><!-- ícono --></svg>
    Signal Intelligence
  </a>
  <a href="#" class="nav-item">
    <svg width="16" height="16" ...><!-- ícono --></svg>
    Performance Audit
  </a>
</nav>

<style>
.sidebar-nav { padding: 8px 0; }
.nav-group-label {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.6px; text-transform: uppercase;
  color: #A3A3A3; padding: 8px 16px 4px;
  font-feature-settings: "case";
}
.nav-item {
  display: flex; align-items: center; gap: 8px;
  height: 34px; padding: 0 16px;
  font-size: 13px; font-weight: 400;
  letter-spacing: -0.1px; color: #6B6B6B;
  text-decoration: none;
  border-left: 2px solid transparent;
  transition: background 150ms, color 150ms;
}
.nav-item:hover {
  background: #F5F5F5; color: #0A0A0A;
}
.nav-item--active {
  background: #E8EFFE; color: #003AD6;
  border-left-color: #003AD6; font-weight: 500;
}
</style>
```

---

## Toast

```html
<div class="toast toast-success">
  <div class="toast-bar"></div>
  <div class="toast-content">
    <div class="toast-title">Reporte exportado</div>
    <div class="toast-desc">El archivo estará listo en tu carpeta de descargas.</div>
  </div>
  <button class="toast-close" aria-label="Cerrar">✕</button>
</div>

<style>
.toast {
  position: fixed; bottom: 24px; right: 24px;
  display: flex; align-items: stretch; gap: 0;
  min-width: 320px; max-width: 400px;
  background: #FFFFFF;
  border: 0.5px solid #E5E5E5;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(10,14,30,0.08);
  z-index: 400; overflow: hidden;
}
.toast-bar { width: 4px; flex-shrink: 0; }
.toast-success .toast-bar { background: #16A34A; }
.toast-content { flex: 1; padding: 12px 16px; }
.toast-title { font-size: 13px; font-weight: 500; color: #0A0A0A; margin-bottom: 2px; }
.toast-desc  { font-size: 12px; color: #6B6B6B; line-height: 18px; }
.toast-close {
  padding: 12px 14px; background: none; border: none;
  color: #A3A3A3; cursor: pointer; font-size: 12px;
  align-self: flex-start;
}
</style>
```

---

## Code Inline

```html
<!-- Usar para IDs, tokens, valores de configuración -->
<p>La colección <code class="code-inline">PitagorasUsers</code> no debe modificarse.</p>
<p>Accede al secret <code class="code-inline">FacebookAccessToken</code> via Secret Manager.</p>

<style>
.code-inline {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px; font-weight: 400; line-height: 18px;
  background: #F5F5F5;
  border-radius: 4px;
  padding: 1px 6px;
  color: #0A0A0A;
}
</style>
```
