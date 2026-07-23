# Design Spec: Dashboard Light Mode Contrast & Readability

This spec documents the styling overrides and logic required to ensure high contrast and readability on the xg-bieu-do (Xà gồ) and tole-bieu-do (Tole) dashboard pages when switching to Light Mode.

## Goal

Ensure all text, cards, charts, and filtering elements have clean contrast, high readability, and a premium visual aesthetic in Light Mode (`html[data-bs-theme="light"]`) matching the application's overall design system.

---

## Proposed CSS Overrides

Add the following Light Mode stylesheet overrides at the bottom of:
- [xg-bieu-do.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/xg/xg-bieu-do.css)
- [tole-bieu-do.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/tole/tole-bieu-do.css)

```css
/* ==================== LIGHT THEME OVERRIDES ==================== */
html[data-bs-theme="light"] body {
  background: #f1f5f9 !important;
  color: #0f172a !important;
}

/* Page title contrast */
html[data-bs-theme="light"] .page-title {
  background: linear-gradient(90deg, #1e3a8a, #0d9488, #1e3a8a) border-box;
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: none;
}

/* Filter Card */
html[data-bs-theme="light"] .filter-card {
  background: #ffffff !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
}

html[data-bs-theme="light"] .filter-header {
  background: rgba(99, 102, 241, 0.06) !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
  color: #4f46e5 !important;
}

html[data-bs-theme="light"] .filter-label {
  color: #475569 !important;
}

html[data-bs-theme="light"] .filter-group .form-control {
  background-color: #ffffff !important;
  border: 1px solid rgba(0, 0, 0, 0.15) !important;
  color: #0f172a !important;
}

html[data-bs-theme="light"] .filter-separator {
  color: rgba(0, 0, 0, 0.25) !important;
}

html[data-bs-theme="light"] .btn-filter-reset {
  background: #f1f5f9 !important;
  color: #475569 !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
}

html[data-bs-theme="light"] .btn-filter-reset:hover {
  background: #e2e8f0 !important;
  color: #0f172a !important;
}

/* Summary Cards (KPIs) */
html[data-bs-theme="light"] .summary-card {
  background: #ffffff !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
}

html[data-bs-theme="light"] .summary-card:hover {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08) !important;
}

/* Maintain high contrast for child cards */
html[data-bs-theme="light"] .card-import-type .card-value,
html[data-bs-theme="light"] .card-export-type .card-value {
  color: #1e293b !important;
}

html[data-bs-theme="light"] .card-content h6 {
  color: #64748b !important;
}

html[data-bs-theme="light"] .card-value {
  color: #1e293b !important;
}

html[data-bs-theme="light"] .card-unit {
  color: #64748b !important;
}

/* Chart Cards */
html[data-bs-theme="light"] .chart-card {
  background: #ffffff !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
}

html[data-bs-theme="light"] .chart-card:hover {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08) !important;
  border-color: rgba(99, 102, 241, 0.2) !important;
}

html[data-bs-theme="light"] .chart-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
}

html[data-bs-theme="light"] .chart-header h5 {
  color: #1e293b !important;
}

html[data-bs-theme="light"] .legend-item {
  color: #475569 !important;
}

/* Custom override for select dropdown in Chart Header */
html[data-bs-theme="light"] #pieChartSelect {
  background-color: #ffffff !important;
  color: #0f172a !important;
  border: 1px solid rgba(0, 0, 0, 0.15) !important;
}

html[data-bs-theme="light"] #loading {
  color: #4f46e5 !important;
}
```

---

## Dynamic Chart Theme Adaptability

Update the chart initialization and update routines in:
- [xg-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-bieu-do.js)
- [tole-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-bieu-do.js)

### Theme-aware helpers & listener:

```javascript
// Helper to get theme-aware colors for Chart.js
function getChartThemeColors() {
  const isLight = document.documentElement.getAttribute('data-bs-theme') === 'light';
  return {
    textColor: isLight ? '#475569' : '#aaa',
    gridColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
    tooltipBg: isLight ? 'rgba(15, 23, 42, 0.9)' : 'rgba(0, 0, 0, 0.8)'
  };
}

// Update active charts with theme styling dynamically
function updateChartsTheme() {
  const colors = getChartThemeColors();
  const charts = [barChart, pieChart, lineChart, workshopChart, importMaterialChart, exportMaterialChart];

  charts.forEach(chart => {
    if (!chart) return;
    
    if (chart.options.plugins) {
      if (chart.options.plugins.legend && chart.options.plugins.legend.labels) {
        chart.options.plugins.legend.labels.color = colors.textColor;
      }
      if (chart.options.plugins.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
      }
    }

    if (chart.options.scales) {
      if (chart.options.scales.x) {
        if (chart.options.scales.x.ticks) chart.options.scales.x.ticks.color = colors.textColor;
        if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = colors.gridColor;
      }
      if (chart.options.scales.y) {
        if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = colors.textColor;
        if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = colors.gridColor;
      }
    }
    
    chart.update();
  });
}

// Observe theme updates to apply changes on toggle
const themeObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-bs-theme') {
      updateChartsTheme();
    }
  });
});
themeObserver.observe(document.documentElement, { attributes: true });
```

All chart creation helper functions (`createBarChart`, `createPieChart`, etc.) will draw ticks and grid lines dynamically from `getChartThemeColors()`.

---

## Verification Plan

### Manual Verification
1. Open the Xà gồ/Tole dashboards in dark mode and verify charts display as expected.
2. Toggle theme selector in the sidebar to Light Mode.
3. Verify body background shifts to `#f1f5f9`, and card backgrounds change to white.
4. Verify all text (titles, filter labels, values) has crisp readability and contrasts well against white.
5. Verify chart axes ticks and grid lines update instantly without page reload, turning into contrasting gray lines.
