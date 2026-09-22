# HSE Equipment Checklist Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the HSE "Checklist kiểm tra thiết bị" module into a monthly interactive workspace with KPI cards, month pills selector, daily inspection form with O/X toggles, and Google Apps Script synchronization.

**Architecture:** Split the flat table into a structured month-by-month view with a quick daily inspection action panel on top and inspection history table on bottom. Data is parsed from Google Sheets CSV, grouped by Month/Year, and mutations are sent to Google Apps Script (`saveEquipmentChecklist` action) with optimistic UI updates.

**Tech Stack:** Vanilla JavaScript (ES6+), Vanilla CSS (Midnight Neo design system, Glassmorphism, CSS Grid/Flexbox), Google Apps Script API.

## Global Constraints

- File paths: Primary sources are `assets/js/5s/hse.js`, `assets/css/5s/hse.css`, and `cloudflare-r2/google-apps-script-snippet.gs`.
- Sync command: `npm run build` (runs `node scripts/sync-dist.js`) to sync `dist/`, `dist-app/`, and `public/`.
- Preserve existing functionality of all other 10 HSE modules (`job-plan`, `clean-schedule`, `5s-fix`, etc.).

---

### Task 1: UI Styles for Equipment Checklist in `assets/css/5s/hse.css`

**Files:**
- Modify: `assets/css/5s/hse.css`

**Interfaces:**
- Produces CSS classes:
  - `.chk-month-tabs`, `.chk-month-tab`, `.chk-month-tab.active`
  - `.chk-kpi-grid`, `.chk-kpi-card`, `.chk-kpi-val`, `.chk-kpi-label`
  - `.chk-form-card`, `.chk-form-header`, `.chk-form-grid`, `.chk-device-list`, `.chk-device-item`
  - `.chk-toggle-group`, `.chk-toggle-btn.btn-pass`, `.chk-toggle-btn.btn-fail`, `.chk-toggle-btn.active`
  - `.badge-chk-pass`, `.badge-chk-fail`, `.badge-chk-na`

- [ ] **Step 1: Add equipment checklist styles to `assets/css/5s/hse.css`**

Add CSS rules at the end of `assets/css/5s/hse.css`:
```css
/* --- Equipment Checklist Redesign Styles --- */
.chk-month-tabs {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    margin-bottom: 1.25rem;
    scrollbar-width: thin;
}
.chk-month-tab {
    padding: 0.5rem 1.1rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: var(--transition);
}
.chk-month-tab:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}
.chk-month-tab.active {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15));
    border-color: rgba(16, 185, 129, 0.5);
    color: #34d399;
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
}

.chk-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
}
.chk-kpi-card {
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    backdrop-filter: blur(8px);
}
.chk-kpi-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.chk-kpi-icon.icon-green { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.chk-kpi-icon.icon-blue { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.chk-kpi-icon.icon-red { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.chk-kpi-val {
    font-size: 1.4rem;
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
}
.chk-kpi-label {
    font-size: 0.78rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 0.2rem;
}

.chk-form-card {
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 14px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}
.chk-form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.chk-form-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.chk-form-inputs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    margin-bottom: 1.25rem;
}
.chk-input-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 0.4rem;
}
.chk-input-control {
    width: 100%;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 0.65rem 0.9rem;
    color: #fff;
    font-size: 0.9rem;
    outline: none;
    transition: var(--transition);
}
.chk-input-control:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.chk-device-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.85rem;
    margin-bottom: 1.5rem;
}
.chk-device-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}
.chk-device-name {
    font-weight: 600;
    font-size: 0.92rem;
    color: #f1f5f9;
}
.chk-toggle-group {
    display: flex;
    gap: 0.4rem;
}
.chk-toggle-btn {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-muted);
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    gap: 0.35rem;
}
.chk-toggle-btn.btn-pass:hover, .chk-toggle-btn.btn-pass.active {
    background: rgba(16, 185, 129, 0.25);
    border-color: #10b981;
    color: #34d399;
}
.chk-toggle-btn.btn-fail:hover, .chk-toggle-btn.btn-fail.active {
    background: rgba(239, 68, 68, 0.25);
    border-color: #ef4444;
    color: #f87171;
}

.chk-form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.btn-quick-pass {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #60a5fa;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
}
.btn-quick-pass:hover {
    background: rgba(59, 130, 246, 0.3);
    color: #fff;
}
.btn-chk-save {
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    color: #fff;
    padding: 0.65rem 1.4rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
    transition: var(--transition);
}
.btn-chk-save:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

.badge-chk-pass {
    background: rgba(16, 185, 129, 0.18);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.4);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.8rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
}
.badge-chk-fail {
    background: rgba(239, 68, 68, 0.18);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.8rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
}
.badge-chk-na {
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 500;
}
.btn-edit-row {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-main);
    padding: 0.3rem 0.65rem;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: var(--transition);
}
.btn-edit-row:hover {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
}
```

- [ ] **Step 2: Verify CSS builds and is valid syntax**

---

### Task 2: Implement Equipment Checklist Logic in `assets/js/5s/hse.js`

**Files:**
- Modify: `assets/js/5s/hse.js`

**Interfaces:**
- Consumes: `GSheetsService.fetchSheetData`, `CONFIG.APPS_SCRIPT_URL_HSE`
- Produces methods on `DashboardManager`:
  - `renderEquipmentChecklist(data)`
  - `selectEquipmentMonth(monthKey)`
  - `toggleDeviceCheck(btn, status)`
  - `quickCheckAllPass()`
  - `populateChecklistForEdit(dateStr, inspector, deviceResultsJson)`
  - `handleEquipmentChecklistSubmit(event)`

- [ ] **Step 1: Add `renderEquipmentChecklist` and helper methods into `DashboardManager`**

- [ ] **Step 2: Update `renderModalContent` routing for `equipment-checklist`**
```javascript
else if (moduleId === 'equipment-checklist') {
    this.renderEquipmentChecklist(data);
}
```

- [ ] **Step 3: Test data grouping and form interaction in browser / script**

---

### Task 3: Add `saveEquipmentChecklist` Handler in `cloudflare-r2/google-apps-script-snippet.gs`

**Files:**
- Modify: `cloudflare-r2/google-apps-script-snippet.gs`

**Interfaces:**
- Produces Apps Script handler for `action === 'saveEquipmentChecklist'`:
  - Locates row by `date` (format `DD/MM/YYYY`) in sheet `Checklist kiểm tra thiết bị`
  - If row exists, updates inspector and device columns
  - If row does not exist, appends new row with values matching headers

- [ ] **Step 1: Add action handling logic into `google-apps-script-snippet.gs`**
- [ ] **Step 2: Verify script syntax**

---

### Task 4: Synchronize Builds & End-to-End Verification

**Files:**
- Command: `npm run build`
- Verify: `public/`, `dist/`, `dist-app/` are synchronized

- [ ] **Step 1: Run `npm run build`**
- [ ] **Step 2: Verify locally with headless browser / node script checking rendered workspace**
- [ ] **Step 3: Commit all changes to git**
