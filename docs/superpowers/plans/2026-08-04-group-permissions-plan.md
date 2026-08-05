# Per-Group Data Action Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to grant data action permissions (Xem 👁️, Thêm ➕, Sửa ✏️, Xóa 🗑️) individually per group (Trang Chung, 5S, Xà Gỗ, Tole, Phế Liệu, Quản trị) in `quan-ly-user.html`, store them in `allowed_pages` JSONB, and enforce them per module at runtime.

**Architecture:** Remove standalone global data action checkboxes in `quan-ly-user.html` and place 4 action checkboxes inside each group container. Store per-group permissions in `allowed_pages` JSONB as `{ pages: [...], groups: { xg: {...}, tole: {...}, pl: {...}, 5s: {...}, chung: {...} } }`. Update `getUserPermissions(groupName)` in `supabase-config.js` to return group-specific action flags. Update module scripts to pass group names (`'xg'`, `'tole'`, `'pl'`, `'5s'`).

**Tech Stack:** HTML5, Bootstrap 5, Vanilla JavaScript, Supabase Client JS.

## Global Constraints

- Preserve `bao.lt` full admin access bypass.
- Maintain backward compatibility for users stored with legacy `can_add`, `can_edit`, `can_delete`, `can_view` Supabase columns.

---

### Task 1: Update Modal UI in `pages/quan-ly-user.html`

**Files:**
- Modify: `pages/quan-ly-user.html:174-288`

**Interfaces:**
- Consumes: Existing DOM structure in `userModal`.
- Produces: Form controls for group-level action permissions (`group-perm-{group}-view`, `group-perm-{group}-add`, `group-perm-{group}-edit`, `group-perm-{group}-delete`).

- [ ] **Step 1: Remove standalone global data action checkboxes**
- [ ] **Step 2: Add 4 action permission checkboxes to each group box in `#pagePermAccordion`**
- [ ] **Step 3: Verify HTML layout visually / via browser**

---

### Task 2: Update User Management Logic in `assets/js/quan-ly-user.js`

**Files:**
- Modify: `assets/js/quan-ly-user.js:140-345`

**Interfaces:**
- Consumes: Modal group action checkboxes and page checkboxes.
- Produces: Payload sent to `window.supabase.rpc('admin_save_user', payload)` containing `p_allowed_pages` object with `{ pages, groups }`.

- [ ] **Step 1: Update `openAddUserModal` to clear all group action checkboxes**
- [ ] **Step 2: Update `openEditUserModal` to populate per-group action checkboxes from `user.allowed_pages`**
- [ ] **Step 3: Update Group Select All click listener to toggle action checkboxes alongside page checkboxes**
- [ ] **Step 4: Update `handleSaveUser` to construct `{ pages, groups }` JSON and calculate system-level OR fallback flags (`can_view`, `can_add`, `can_edit`, `can_delete`)**
- [ ] **Step 5: Update `renderUserTable` to render per-group permission badges in table rows**

---

### Task 3: Update Login & Session Storage in `assets/js/dang_nhap.js`

**Files:**
- Modify: `assets/js/dang_nhap.js:68-100`, `345-358`

**Interfaces:**
- Consumes: Account object returned from `check_login` RPC.
- Produces: `localStorage.setItem('userGroupPermissions', JSON.stringify(groupsObj))` and `localStorage.setItem('userAllowedPages', JSON.stringify(pagesList))`.

- [ ] **Step 1: Extract `allowed_pages.groups` and `allowed_pages.pages` in `dang_nhap.js`**
- [ ] **Step 2: Save `userGroupPermissions` to `localStorage` in `completeLogin()`**

---

### Task 4: Upgrade `getUserPermissions(groupName)` in `supabase-config.js`

**Files:**
- Modify: `assets/js/supabase-config.js:45-80`
- Modify: `dist-app/assets/js/supabase-config.js:45-80`

**Interfaces:**
- Consumes: `groupName` parameter (e.g. `'xg'`, `'tole'`, `'pl'`, `'5s'`, `'chung'`) and `localStorage.getItem('userGroupPermissions')`.
- Produces: `{ canView, canAdd, canEdit, canDelete, isAdmin }` for the specified group.

- [ ] **Step 1: Update `getUserPermissions(groupName)` in `assets/js/supabase-config.js`**
- [ ] **Step 2: Copy update to `dist-app/assets/js/supabase-config.js`**

---

### Task 5: Pass Group Identifiers in Data Modules

**Files:**
- Modify: `assets/js/xg/xg-nhap-supabase.js` & `dist-app/assets/js/xg/xg-nhap-supabase.js`
- Modify: `assets/js/xg/xg-xuat-supabase.js` & `dist-app/assets/js/xg/xg-xuat-supabase.js`
- Modify: `assets/js/tole/tole-nhap-supabase.js` & `dist-app/assets/js/tole/tole-nhap-supabase.js`
- Modify: `assets/js/tole/tole-xuat-supabase.js` & `dist-app/assets/js/tole/tole-xuat-supabase.js`
- Modify: `assets/js/pl/pl-da-thu.js` & `dist-app/assets/js/pl/pl-da-thu.js`
- Modify: `assets/js/pl/pl-chua-thu.js` & `dist-app/assets/js/pl/pl-chua-thu.js`
- Modify: `assets/js/pl/pl-can-thu.js` & `dist-app/assets/js/pl/pl-can-thu.js`
- Modify: `assets/js/pl/pl-phieu-in.js` & `dist-app/assets/js/pl/pl-phieu-in.js`

**Interfaces:**
- Consumes: `getUserPermissions('xg')`, `getUserPermissions('tole')`, `getUserPermissions('pl')`, `getUserPermissions('5s')`.

- [ ] **Step 1: Update `setupModalPermissions` and delete modal handlers in XG modules (`'xg'`)**
- [ ] **Step 2: Update `setupModalPermissions` and delete modal handlers in Tole modules (`'tole'`)**
- [ ] **Step 3: Update `setupModalPermissions` and delete modal handlers in PL modules (`'pl'`)**

---

### Task 6: Syntax Verification & End-to-End Test

**Files:**
- Test: Run `node -c` on all updated JavaScript files.

- [ ] **Step 1: Run `node -c` syntax validation on all JS files**
- [ ] **Step 2: Verify zero syntax errors or broken references**
