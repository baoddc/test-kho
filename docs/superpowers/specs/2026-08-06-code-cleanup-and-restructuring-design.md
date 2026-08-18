# Design Specification: Codebase Cleanup & Professional File Restructuring

**Date:** 2026-08-06  
**Status:** Approved by User  
**Target:** `web-supabase`  

---

## 1. Goal Overview
Clean up unnecessary/legacy code and reorganize the project directory structure according to professional web development standards while ensuring 100% preservation of all existing functionality (Supabase integration, PWA offline support, Voice Assistant, Sidebar navigation, and User Management).

---

## 2. Structural & File Changes

### 2.1 Removal of Unused & Legacy Files
- **Untracked / Legacy JS Files** (Old local sheets implementation before Supabase):
  - `assets/js/tole/tole-nhap.js`
  - `assets/js/tole/tole-ton.js`
  - `assets/js/tole/tole-xuat.js`
  - `assets/js/xg/xg-nhap.js`
  - `assets/js/xg/xg-ton.js`
  - `assets/js/xg/xg-xuat.js`
  - Untracked duplicates in `dist-app/assets/js/tole/` & `dist-app/assets/js/xg/`
- **Duplicate HTML Page**:
  - Delete `pages/dang_nhap.html` (consolidate all login references to `pages/index.html`).

### 2.2 JavaScript Folder Restructuring (`assets/js/`)
Reorganize scripts into clean semantic folders:
- **`assets/js/core/`**: Infrastructure and system-level services
  - `supabase-config.js`
  - `supabase-data-engine.js`
  - `pwa-register.js`
  - `update-checker.js`
- **`assets/js/components/`**: Reusable UI components & background services
  - `sidebar.js`
  - `voice-assistant.js`
- **`assets/js/modules/`** (Domain specific modules):
  - **`tole/`**: `tole-bieu-do.js`, `tole-nhap.js` (renamed from `tole-nhap-supabase.js`), `tole-ton.js` (renamed from `tole-ton-supabase.js`), `tole-xuat.js` (renamed from `tole-xuat-supabase.js`)
  - **`xg/`**: `xg-bieu-do.js`, `xg-nhap.js` (renamed from `xg-nhap-supabase.js`), `xg-ton.js` (renamed from `xg-ton-supabase.js`), `xg-xuat.js` (renamed from `xg-xuat-supabase.js`)
  - **`pl/`**: `pl-can-thu.js`, `pl-chua-thu.js`, `pl-da-thu.js`, `pl-phieu-in.js`, `pl-tong-hop-can-thu.js`, `pl-tong-hop-chua-thu.js`, `pl-tong-hop-da-thu.js`
  - **`5s/`**: `5s-so-do-phe-lieu.js`, `5s-so-do-phoi-cuon.js`, `hse.js`
  - **`page-scripts/`**: `home.js`, `quan-ly-user.js`, `cong-viec.js`, `flower.js`, `fireworks.js`

### 2.3 Image Asset Consolidation (`assets/images/`)
Merge `assets/img/` into `assets/images/` with clear semantic subdirectories:
- `assets/images/logos/`: `Logo-DDC.png`, `logo-tieu-de.png`
- `assets/images/backgrounds/`: `login-bg.png`
- `assets/images/icons/`: `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon.ico`
- Remove empty `assets/img/` folder.

### 2.4 Reference Synchronization
Update all file paths in:
- HTML `<script src="...">` and `<img src="...">` tags in all HTML files (`index.html`, `pages/*.html`, `pages/*/*.html`).
- `sidebar.js` menu routing and login URL redirects.
- `quan-ly-user.js` page permissions mapping.
- `voice-assistant.js` navigation paths.
- Service Worker `sw.js` cache list.

---

## 3. Code Cleanup Guidelines
1. **Remove Dead Google Sheet Code**: Delete all commented out `SHEET_ID`, `SHEET_GID_*`, and `XLSX_URL_*` constants in `tole-bieu-do.js`, `xg-bieu-do.js`, etc.
2. **Clean Debug Statements**: Remove redundant `console.log()` calls while retaining critical error logging (`console.error`).
3. **Preserve Functionality**: Ensure zero breaking changes to data fetching, dynamic inventory calculations, Supabase integration, or PWA caching.

---

## 4. Verification & Testing
- Test PWA Service Worker caching with updated paths in `sw.js`.
- Verify navigation between login (`pages/index.html`), `home.html`, `tole`, `xg`, `pl`, `5s`, and `quan-ly-user.html`.
- Confirm Supabase data fetching and chart renders work seamlessly.
