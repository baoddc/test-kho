# Design Spec: Dark-Style Summary Cards with Black Text in Light Mode

This document specifies the CSS overrides required to bring the dark mode card structure, accent borders, hover animations, icon badges, and section color gradients to Light Mode (`html[data-bs-theme="light"]`) on the dashboard pages (`xg-bieu-do` and `tole-bieu-do`), while forcing all card text to high-contrast black (`#000000`).

## Goal

Enhance the visual appeal of summary cards in Light Mode by combining:
1. The structured aesthetic of Dark Mode cards (4px colored accent borders, soft category background gradients for child cards, round icon badges, and hover shine/lift animations).
2. **100% Black Text (`#000000`)** across titles (`h6`), value figures (`.card-value`), and unit labels (`.card-unit`) for optimal readability against light backgrounds.

---

## Target Files

- [xg-bieu-do.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/xg/xg-bieu-do.css)
- [tole-bieu-do.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/tole/tole-bieu-do.css)

---

## Detailed CSS Specifications

### 1. Main Summary Cards (`.card-inventory`, `.card-import`, `.card-export`)

```css
/* Summary Cards base style in Light Mode */
html[data-bs-theme="light"] .summary-card {
  background: #ffffff !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
  position: relative;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
}

/* Hover shine animation */
html[data-bs-theme="light"] .summary-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.04), transparent);
  transition: left 0.5s ease;
}

html[data-bs-theme="light"] .summary-card:hover::before {
  left: 100%;
}

html[data-bs-theme="light"] .summary-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.1) !important;
}

/* 4px Left Accent Borders */
html[data-bs-theme="light"] .card-inventory {
  border-left: 4px solid #2ecc71 !important;
}

html[data-bs-theme="light"] .card-import {
  border-left: 4px solid #3498db !important;
}

html[data-bs-theme="light"] .card-export {
  border-left: 4px solid #e74c3c !important;
}

/* Icon Badges */
html[data-bs-theme="light"] .card-inventory .card-icon {
  color: #16a34a !important;
  background: rgba(34, 197, 94, 0.15) !important;
}

html[data-bs-theme="light"] .card-import .card-icon {
  color: #2563eb !important;
  background: rgba(59, 130, 246, 0.15) !important;
}

html[data-bs-theme="light"] .card-export .card-icon {
  color: #dc2626 !important;
  background: rgba(239, 68, 68, 0.15) !important;
}
```

### 2. Child KPI Cards (`.card-import-type` & `.card-export-type`)

```css
/* Import Sub-cards (Nhà cung cấp, Xưởng SX, Gia công, Công trình) */
html[data-bs-theme="light"] .card-import-type {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02)) !important;
  border: 1px solid rgba(59, 130, 246, 0.2) !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.05) !important;
}

html[data-bs-theme="light"] .card-import-type:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.15) !important;
  border-color: rgba(59, 130, 246, 0.4) !important;
}

/* Export Sub-cards (Xưởng SX, Điều chuyển, Gia công, Công trình) */
html[data-bs-theme="light"] .card-export-type {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02)) !important;
  border: 1px solid rgba(239, 68, 68, 0.2) !important;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.05) !important;
}

html[data-bs-theme="light"] .card-export-type:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.4) !important;
}
```

### 3. Black Text Styling (`#000000`) Across All Card Content

```css
/* Black titles, numbers, and unit text for all summary and child cards */
html[data-bs-theme="light"] .card-content h6,
html[data-bs-theme="light"] .card-import-type .card-content h6,
html[data-bs-theme="light"] .card-export-type .card-content h6 {
  color: #000000 !important;
  font-weight: 700 !important;
}

html[data-bs-theme="light"] .card-value,
html[data-bs-theme="light"] .card-import-type .card-value,
html[data-bs-theme="light"] .card-export-type .card-value {
  color: #000000 !important;
  font-weight: 800 !important;
}

html[data-bs-theme="light"] .card-unit {
  color: #000000 !important;
  font-weight: 600 !important;
}
```

---

## Verification Plan

1. Open `pages/tole/tole-bieu-do.html` and `pages/xg/xg-bieu-do.html` in browser (or via dev server / local browser).
2. Switch to **Light Mode** using the theme toggle in the sidebar.
3. Verify that main summary cards have 4px left borders (`#2ecc71`, `#3498db`, `#e74c3c`), colored icon badges, and hover shine animations.
4. Verify child cards have soft gradient backgrounds and tinted matted borders matching their category (blue for Import, red for Export).
5. Verify all card headings, numbers, and units are crisp 100% black text (`#000000`).
