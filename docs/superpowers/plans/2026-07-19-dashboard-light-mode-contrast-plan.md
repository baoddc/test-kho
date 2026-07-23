# Dashboard Light Mode Contrast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement premium, high-contrast Slate/Indigo theme overrides and dynamic Chart.js theme updating for the Xà gồ (xg-bieu-do) and Tole (tole-bieu-do) dashboard pages in Light Mode.

**Architecture:** Append Light Mode CSS rules to page-specific stylesheets (`xg-bieu-do.css`, `tole-bieu-do.css`). In JS, implement a theme helper, a `MutationObserver` on the root HTML element, and options updating/redraw functions for the Chart.js instances.

**Tech Stack:** Vanilla CSS, JavaScript, Bootstrap 5, Chart.js.

## Global Constraints
- Target light mode theme attribute selector: `html[data-bs-theme="light"]`
- No hardcoded colors for ticks or grids in the chart rendering loops; read theme colors dynamically.

---

### Task 1: Scoped CSS Overrides in xg-bieu-do.css

**Files:**
- Modify: `c:/Users/benhhc/Desktop/web-supabase/assets/css/xg/xg-bieu-do.css`

**Interfaces:**
- Produces: Light Mode styles for all Xà gồ dashboard card and text elements.

- [ ] **Step 1: Append light theme styling rules to the bottom of the CSS file**

Add this content to the end of `c:/Users/benhhc/Desktop/web-supabase/assets/css/xg/xg-bieu-do.css`:
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

- [ ] **Step 2: Commit CSS updates**
Run:
```bash
git add assets/css/xg/xg-bieu-do.css
git commit -m "style(xg-dashboard): add light mode overrides for cards, panels, filters"
```

---

### Task 2: Scoped CSS Overrides in tole-bieu-do.css

**Files:**
- Modify: `c:/Users/benhhc/Desktop/web-supabase/assets/css/tole/tole-bieu-do.css`

**Interfaces:**
- Produces: Light Mode styles for all Tole dashboard card and text elements.

- [ ] **Step 1: Append light theme styling rules to the bottom of the CSS file**

Add the exact same styles from Task 1 to the end of `c:/Users/benhhc/Desktop/web-supabase/assets/css/tole/tole-bieu-do.css`.

- [ ] **Step 2: Commit CSS updates**
Run:
```bash
git add assets/css/tole/tole-bieu-do.css
git commit -m "style(tole-dashboard): add light mode overrides for cards, panels, filters"
```

---

### Task 3: Chart.js Dynamic Colors & MutationObserver in xg-bieu-do.js

**Files:**
- Modify: `c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-bieu-do.js`

**Interfaces:**
- Produces: Dynamic theme updates for all Chart.js instances inside the Xà gồ dashboard.

- [ ] **Step 1: Implement getChartThemeColors, updateChartsTheme and MutationObserver**

Append this block at the end of the file:
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

- [ ] **Step 2: Update chart instantiations to use getChartThemeColors()**

Modify each of these functions in `xg-bieu-do.js` to retrieve labels and grid colors dynamically:
- `createBarChart`
- `createPieChart`
- `createLineChart`
- `createWorkshopChart`
- `createImportMaterialChart`
- `createExportMaterialChart`

Specifically, replace the hardcoded tick/grid color configurations:
```javascript
// Replace ticks color inside scales
ticks: {
  color: getChartThemeColors().textColor,
  // ...
}
// Replace grid color inside scales
grid: {
  color: getChartThemeColors().gridColor,
  // ...
}
// Replace legend labels color inside plugins
labels: {
  color: getChartThemeColors().textColor,
  // ...
}
// Replace tooltip backgroundColor inside plugins
tooltip: {
  backgroundColor: getChartThemeColors().tooltipBg,
  // ...
}
```

- [ ] **Step 3: Commit JS updates**
Run:
```bash
git add assets/js/xg/xg-bieu-do.js
git commit -m "feat(xg-dashboard): implement dynamic Chart.js theme observation and color switching"
```

---

### Task 4: Chart.js Dynamic Colors & MutationObserver in tole-bieu-do.js

**Files:**
- Modify: `c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-bieu-do.js`

**Interfaces:**
- Produces: Dynamic theme updates for all Chart.js instances inside the Tole dashboard.

- [ ] **Step 1: Implement getChartThemeColors, updateChartsTheme and MutationObserver**

Append the same implementation code block from Task 3 to the end of `tole-bieu-do.js`.

- [ ] **Step 2: Update chart instantiations to use getChartThemeColors()**

Modify chart configuration logic inside:
- `createBarChart`
- `createPieChart`
- `createLineChart`
- `createWorkshopChart`
- `createImportMaterialChart`
- `createExportMaterialChart`

to pull dynamic colors from `getChartThemeColors()`.

- [ ] **Step 3: Commit JS updates**
Run:
```bash
git add assets/js/tole/tole-bieu-do.js
git commit -m "feat(tole-dashboard): implement dynamic Chart.js theme observation and color switching"
```

---

### Task 5: Manual Validation

- [ ] **Step 1: Test Light Mode transition manually**
1. Toggle the theme button to Light Mode.
2. Confirm the page background transforms to clean light gray `#f1f5f9`.
3. Confirm all summary/KPI cards, inputs, and chart cards have white backgrounds with subtle borders and shadows.
4. Confirm all card text, page title, and labels are dark grey or black, with high contrast.
5. Verify the Chart.js gridlines turn into subtle gray lines (`rgba(0, 0, 0, 0.08)`) and legends/axes ticks turn to dark slate (`#475569`).
