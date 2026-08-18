# Codebase Cleanup & Professional Restructuring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up legacy code and reorganize project files into standard professional structure while preserving 100% of app functionality.

**Architecture:** Group scripts into `core`, `components`, and `modules`. Consolidate image assets under `assets/images/`. Consolidate login pages into `pages/index.html`. Update all asset paths across HTML files, service worker, sidebar navigation, and user permission scripts.

**Tech Stack:** Vanilla JavaScript (ES6), HTML5, CSS3, Supabase JS SDK, Service Worker.

## Global Constraints
- Do not break any Supabase table data queries or dynamic calculation logic.
- Retain all PWA functionality (Service Worker caching, offline support).
- All paths referenced in HTML files must use absolute `/assets/...` paths consistent with current codebase.

---

### Task 1: Delete Untracked Legacy Files and Duplicate Login Page

**Files:**
- Delete: `assets/js/tole/tole-nhap.js`
- Delete: `assets/js/tole/tole-ton.js`
- Delete: `assets/js/tole/tole-xuat.js`
- Delete: `assets/js/xg/xg-nhap.js`
- Delete: `assets/js/xg/xg-ton.js`
- Delete: `assets/js/xg/xg-xuat.js`
- Delete: `dist-app/assets/js/tole/tole-nhap.js`
- Delete: `dist-app/assets/js/tole/tole-ton.js`
- Delete: `dist-app/assets/js/tole/tole-xuat.js`
- Delete: `dist-app/assets/js/xg/xg-nhap.js`
- Delete: `dist-app/assets/js/xg/xg-ton.js`
- Delete: `dist-app/assets/js/xg/xg-xuat.js`
- Delete: `pages/dang_nhap.html`

- [ ] **Step 1: Remove legacy untracked JS files and duplicate login page**

```powershell
Remove-Item -Force assets/js/tole/tole-nhap.js, assets/js/tole/tole-ton.js, assets/js/tole/tole-xuat.js
Remove-Item -Force assets/js/xg/xg-nhap.js, assets/js/xg/xg-ton.js, assets/js/xg/xg-xuat.js
Remove-Item -Force dist-app/assets/js/tole/tole-nhap.js, dist-app/assets/js/tole/tole-ton.js, dist-app/assets/js/tole/tole-xuat.js -ErrorAction SilentlyContinue
Remove-Item -Force dist-app/assets/js/xg/xg-nhap.js, dist-app/assets/js/xg/xg-ton.js, dist-app/assets/js/xg/xg-xuat.js -ErrorAction SilentlyContinue
Remove-Item -Force pages/dang_nhap.html
```

- [ ] **Step 2: Verify git status after deletion**

Run: `git status`
Expected: `pages/dang_nhap.html` marked deleted; legacy `.js` files gone.

---

### Task 2: Consolidate Image Assets into `assets/images/`

**Files:**
- Create: `assets/images/logos/Logo-DDC.png`
- Create: `assets/images/logos/logo-tieu-de.png`
- Create: `assets/images/backgrounds/login-bg.png`
- Delete folder: `assets/img/`

- [ ] **Step 1: Create image subdirectories and move images**

```powershell
New-Item -ItemType Directory -Path assets/images/logos -Force
New-Item -ItemType Directory -Path assets/images/backgrounds -Force
Copy-Item assets/img/Logo-DDC.png assets/images/logos/Logo-DDC.png
Copy-Item assets/img/logo-tieu-de.png assets/images/logos/logo-tieu-de.png
Copy-Item assets/img/login-bg.png assets/images/backgrounds/login-bg.png
Remove-Item -Recurse -Force assets/img
```

- [ ] **Step 2: Verify image files exist in new location**

Run: `Get-ChildItem assets/images -Recurse`
Expected: `logos/Logo-DDC.png`, `logos/logo-tieu-de.png`, `backgrounds/login-bg.png` listed.

---

### Task 3: Restructure JavaScript Directory Layout (`assets/js/`)

**Files:**
- Move to `assets/js/core/`: `supabase-config.js`, `supabase-data-engine.js`, `pwa-register.js`, `update-checker.js`
- Move to `assets/js/components/`: `sidebar.js`, `voice-assistant.js`
- Rename & Keep in `assets/js/tole/`:
  - `tole-nhap-supabase.js` -> `tole-nhap.js`
  - `tole-ton-supabase.js` -> `tole-ton.js`
  - `tole-xuat-supabase.js` -> `tole-xuat.js`
- Rename & Keep in `assets/js/xg/`:
  - `xg-nhap-supabase.js` -> `xg-nhap.js`
  - `xg-ton-supabase.js` -> `xg-ton.js`
  - `xg-xuat-supabase.js` -> `xg-xuat.js`

- [ ] **Step 1: Create core and components directories and relocate JS files**

```powershell
New-Item -ItemType Directory -Path assets/js/core -Force
New-Item -ItemType Directory -Path assets/js/components -Force

Move-Item assets/js/supabase-config.js assets/js/core/supabase-config.js
Move-Item assets/js/supabase-data-engine.js assets/js/core/supabase-data-engine.js
Move-Item assets/js/pwa-register.js assets/js/core/pwa-register.js
Move-Item assets/js/update-checker.js assets/js/core/update-checker.js

Move-Item assets/js/sidebar.js assets/js/components/sidebar.js
Move-Item assets/js/voice-assistant.js assets/js/components/voice-assistant.js

Move-Item assets/js/tole/tole-nhap-supabase.js assets/js/tole/tole-nhap.js
Move-Item assets/js/tole/tole-ton-supabase.js assets/js/tole/tole-ton.js
Move-Item assets/js/tole/tole-xuat-supabase.js assets/js/tole/tole-xuat.js

Move-Item assets/js/xg/xg-nhap-supabase.js assets/js/xg/xg-nhap.js
Move-Item assets/js/xg/xg-ton-supabase.js assets/js/xg/xg-ton.js
Move-Item assets/js/xg/xg-xuat-supabase.js assets/js/xg/xg-xuat.js
```

- [ ] **Step 2: Verify `assets/js/` structure**

Run: `Get-ChildItem assets/js -Recurse`
Expected: `core/`, `components/`, `tole/`, `xg/`, `pl/`, `5s/` properly populated.

---

### Task 4: Clean Dead Google Sheet Code and Debug Comments in JS Files

**Files:**
- Modify: `assets/js/tole/tole-bieu-do.js`
- Modify: `assets/js/xg/xg-bieu-do.js`
- Modify: `assets/js/tole/tole-nhap.js`
- Modify: `assets/js/tole/tole-xuat.js`
- Modify: `assets/js/tole/tole-ton.js`
- Modify: `assets/js/xg/xg-nhap.js`
- Modify: `assets/js/xg/xg-xuat.js`
- Modify: `assets/js/xg/xg-ton.js`

- [ ] **Step 1: Remove Google Sheet dead constant blocks from `tole-bieu-do.js` and `xg-bieu-do.js`**

Remove lines 11-22 in `tole-bieu-do.js` (commented out Google Sheet SHEET_ID, SHEET_GID_*, XLSX_URL_*).
Remove equivalent commented out Google Sheet blocks in `xg-bieu-do.js`.

- [ ] **Step 2: Verify files clean build without syntax errors**

---

### Task 5: Update Path References Across HTML, Service Worker, and JS Scripts

**Files:**
- Modify: `index.html`
- Modify: `pages/index.html`
- Modify: `pages/home.html`
- Modify: `pages/quan-ly-user.html`
- Modify: `pages/cong-viec.html`
- Modify: `pages/about.html`
- Modify: `pages/flower.html`
- Modify: `pages/tole/*.html`
- Modify: `pages/xg/*.html`
- Modify: `pages/pl/*.html`
- Modify: `pages/5s/*.html`
- Modify: `sw.js`
- Modify: `assets/js/components/sidebar.js`
- Modify: `assets/js/quan-ly-user.js`
- Modify: `assets/js/components/voice-assistant.js`

- [ ] **Step 1: Update `sw.js` cache asset URL list**

Replace `/assets/js/supabase-config.js` -> `/assets/js/core/supabase-config.js`
Replace `/assets/js/sidebar.js` -> `/assets/js/components/sidebar.js`
Replace `/assets/js/voice-assistant.js` -> `/assets/js/components/voice-assistant.js`
Replace `/assets/img/Logo-DDC.png` -> `/assets/images/logos/Logo-DDC.png`
Remove `/pages/dang_nhap.html`

- [ ] **Step 2: Update HTML files script & img tags**

In all HTML files:
- `/assets/js/pwa-register.js` -> `/assets/js/core/pwa-register.js`
- `/assets/js/supabase-config.js` -> `/assets/js/core/supabase-config.js`
- `/assets/js/supabase-data-engine.js` -> `/assets/js/core/supabase-data-engine.js`
- `/assets/js/update-checker.js` -> `/assets/js/core/update-checker.js`
- `/assets/js/sidebar.js` -> `/assets/js/components/sidebar.js`
- `/assets/js/voice-assistant.js` -> `/assets/js/components/voice-assistant.js`
- `/assets/js/tole/tole-nhap-supabase.js` -> `/assets/js/tole/tole-nhap.js`
- `/assets/js/tole/tole-ton-supabase.js` -> `/assets/js/tole/tole-ton.js`
- `/assets/js/tole/tole-xuat-supabase.js` -> `/assets/js/tole/tole-xuat.js`
- `/assets/js/xg/xg-nhap-supabase.js` -> `/assets/js/xg/xg-nhap.js`
- `/assets/js/xg/xg-ton-supabase.js` -> `/assets/js/xg/xg-ton.js`
- `/assets/js/xg/xg-xuat-supabase.js` -> `/assets/js/xg/xg-xuat.js`
- `/assets/img/Logo-DDC.png` -> `/assets/images/logos/Logo-DDC.png`
- `/assets/img/logo-tieu-de.png` -> `/assets/images/logos/logo-tieu-de.png`
- `/assets/img/login-bg.png` -> `/assets/images/backgrounds/login-bg.png`

- [ ] **Step 3: Update `sidebar.js`, `quan-ly-user.js`, and `voice-assistant.js` page routing**

Replace any references to `dang_nhap.html` with `index.html`.
Replace old script or image paths if referenced programmatically.

---

### Task 6: Comprehensive Verification & Test Pass

**Files:**
- All HTML, JS, CSS, SW files

- [ ] **Step 1: Search for any lingering broken path references**

Run: `grep -rn "assets/img/" .`
Expected: Zero results.

Run: `grep -rn "dang_nhap.html" .`
Expected: Zero results (or handled in fallback logic).

Run: `grep -rn "tole-nhap-supabase.js" .`
Expected: Zero results.

- [ ] **Step 2: Validate application startup**

Run: `npx serve .` or `npm run start` to verify static file serving works.
