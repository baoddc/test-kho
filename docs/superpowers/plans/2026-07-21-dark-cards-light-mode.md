# Dark-Style Summary Cards with Black Text in Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance summary cards on Xà Gồ (`xg-bieu-do`) and Tole (`tole-bieu-do`) dashboard pages in Light Mode with Dark Mode structure (4px accent left-borders, category gradient backgrounds for child cards, icon badges, hover shine animations) while forcing 100% black text (`#000000`) for all titles, numerical values, and unit labels.

**Architecture:** Replace existing summary card Light Mode CSS overrides (`html[data-bs-theme="light"] .summary-card`) in `xg-bieu-do.css` and `tole-bieu-do.css` with enhanced dark-style rules and high-contrast black text styling.

**Tech Stack:** CSS3, Vanilla CSS

## Global Constraints

- Target CSS files: [xg-bieu-do.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/xg/xg-bieu-do.css) and [tole-bieu-do.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/tole/tole-bieu-do.css)
- Card titles (`h6`), card values (`.card-value`), and card units (`.card-unit`) MUST use `#000000 !important` in Light Mode.
- Main summary cards MUST retain 4px left borders (`.card-inventory` -> `#2ecc71`, `.card-import` -> `#3498db`, `.card-export` -> `#e74c3c`).
- Child cards MUST have category gradient backgrounds (`.card-import-type` -> blue tint, `.card-export-type` -> red tint).

---

### Task 1: Update Xà Gồ Dashboard CSS (`xg-bieu-do.css`)

**Files:**
- Modify: [xg-bieu-do.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/xg/xg-bieu-do.css#L1022-L1050)

**Interfaces:**
- Consumes: `html[data-bs-theme="light"]` attribute selector
- Produces: CSS rules for `.summary-card`, `.card-inventory`, `.card-import`, `.card-export`, `.card-import-type`, `.card-export-type`, `.card-content h6`, `.card-value`, `.card-unit`

- [ ] **Step 1: Replace Light Mode Summary Cards section in `xg-bieu-do.css`**

In [xg-bieu-do.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/xg/xg-bieu-do.css#L1022-L1050), replace lines 1022 to 1049 with:

```css
/* Summary Cards (KPIs) - Dark-Style in Light Mode with Black Text */
html[data-bs-theme="light"] .summary-card {
  background: #ffffff !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
  position: relative;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
}

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

/* Child KPI Cards Gradient Backgrounds */
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

/* Black Text Overrides */
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

- [ ] **Step 2: Commit changes to `xg-bieu-do.css`**

```bash
git add assets/css/xg/xg-bieu-do.css
git commit -m "style(xg): add dark-style summary cards with black text in light mode"
```

---

### Task 2: Update Tole Dashboard CSS (`tole-bieu-do.css`)

**Files:**
- Modify: [tole-bieu-do.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/tole/tole-bieu-do.css#L1022-L1050)

**Interfaces:**
- Consumes: `html[data-bs-theme="light"]` attribute selector
- Produces: CSS rules for `.summary-card`, `.card-inventory`, `.card-import`, `.card-export`, `.card-import-type`, `.card-export-type`, `.card-content h6`, `.card-value`, `.card-unit`

- [ ] **Step 1: Replace Light Mode Summary Cards section in `tole-bieu-do.css`**

In [tole-bieu-do.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/tole/tole-bieu-do.css#L1022-L1050), replace lines 1022 to 1049 with the exact same updated CSS block as in Task 1.

- [ ] **Step 2: Commit changes to `tole-bieu-do.css`**

```bash
git add assets/css/tole/tole-bieu-do.css
git commit -m "style(tole): add dark-style summary cards with black text in light mode"
```

---

### Task 3: Verification

- [ ] **Step 1: Open dashboard pages in browser**
Open `pages/tole/tole-bieu-do.html` and `pages/xg/xg-bieu-do.html`.

- [ ] **Step 2: Toggle to Light Mode**
Verify left accent borders (`border-left`), hover lift and shine animations, colored sub-card gradient backgrounds, icon badges, and 100% black card text (`#000000`).
