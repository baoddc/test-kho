# HTML Page Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement detailed per-file access control for all `.html` pages in the DDC Kho application, allowing Admin (`bao.lt`) to grant/revoke access per user and enforcing route protection on frontend & sidebar.

**Architecture:** Add `allowed_pages` (JSONB array of page URLs) to Supabase `users` table and RPCs (`check_login`, `admin_get_users`, `admin_save_user`). Update `quan-ly-user.html` and `quan-ly-user.js` to provide grouped page checkbox UI. Update `dang_nhap.js` and `sidebar.js` to store permissions in `localStorage`, filter sidebar links, and redirect unauthorized access to `home.html`.

**Tech Stack:** HTML5, JavaScript (ES6+), Bootstrap 5, Supabase JS v2, PL/pgSQL RPCs.

## Global Constraints

- Preserve admin `bao.lt` full access unconditionally.
- Group `.html` pages logically: Trang Chung, 5S, XÀ GỒ, TOLE, PHẾ LIỆU, Quản trị.
- On unauthorized page access attempt, alert and redirect to `home.html`.

---

### Task 1: Supabase Database Schema & RPC Functions Update

**Files:**
- Modify: `scripts/setup_users_supabase.sql:1-60`
- Modify: `scripts/setup_users_management_rpc.sql:1-150`

**Interfaces:**
- Consumes: Existing Supabase `users` table and RPCs.
- Produces: `allowed_pages` JSONB column on `public.users`; updated `admin_get_users`, `admin_save_user`, and `check_login` RPC signature/logic.

- [ ] **Step 1: Update `scripts/setup_users_supabase.sql` schema and initial data**

Update table definition to include `allowed_pages JSONB DEFAULT '[]'::jsonb`.

```sql
-- Thêm cột allowed_pages nếu chưa có
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS allowed_pages JSONB DEFAULT '[]'::jsonb;
```

Update `check_login` RPC in `setup_users_supabase.sql`:
```sql
CREATE OR REPLACE FUNCTION public.check_login(
    p_username TEXT,
    p_password TEXT
)
RETURNS TABLE (
    id BIGINT,
    username TEXT,
    email TEXT,
    require_otp BOOLEAN,
    can_add BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_view BOOLEAN,
    allowed_pages JSONB
) 
...
```

- [ ] **Step 2: Update `scripts/setup_users_management_rpc.sql`**

Update `admin_get_users` RPC to select `u.allowed_pages`.
Update `admin_save_user` RPC to accept `p_allowed_pages JSONB DEFAULT '[]'::jsonb` and INSERT/UPDATE `allowed_pages`.

- [ ] **Step 3: Commit database script updates**

```bash
git add scripts/setup_users_supabase.sql scripts/setup_users_management_rpc.sql
git commit -m "feat(db): add allowed_pages column and update Supabase RPC functions"
```

---

### Task 2: User Management Page UI & Logic (`quan-ly-user.html` & `quan-ly-user.js`)

**Files:**
- Modify: `pages/quan-ly-user.html:170-205`
- Modify: `assets/js/quan-ly-user.js:80-280`

**Interfaces:**
- Consumes: Supabase `admin_get_users` and `admin_save_user` returning/receiving `allowed_pages`.
- Produces: UI for selecting per-group and per-file `.html` access permissions; summary badge in user table.

- [ ] **Step 1: Modify `quan-ly-user.html` modal form**

Add a HTML page permission container inside `userModal` with collapsible groups for Trang Chung, 5S, XÀ GỒ, TOLE, PHẾ LIỆU, and Quản trị, each with a "Select All" checkbox.

- [ ] **Step 2: Modify `quan-ly-user.js` table rendering**

Update `renderUserTable` to show summary badge `allowed_pages.length` or `Tất cả` for admin.

- [ ] **Step 3: Modify `quan-ly-user.js` modal & save logic**

In `openAddUserModal` and `openEditUserModal`, check/uncheck page checkboxes based on `user.allowed_pages`.
In `handleSaveUser`, gather array of checked page URLs into `p_allowed_pages` and pass to `admin_save_user`.

- [ ] **Step 4: Commit UI changes**

```bash
git add pages/quan-ly-user.html assets/js/quan-ly-user.js
git commit -m "feat(ui): add grouped HTML page permission checkboxes to user management page"
```

---

### Task 3: Access Control & Route Guard (`dang_nhap.js` & `sidebar.js`)

**Files:**
- Modify: `assets/js/dang_nhap.js:68-100, 344-352`
- Modify: `assets/js/sidebar.js:230-380, 1000-1025`

**Interfaces:**
- Consumes: `allowed_pages` returned from `check_login` RPC.
- Produces: `localStorage.getItem('userAllowedPages')`, sidebar menu filtering, and automatic page access guard with alert + redirect to `home.html`.

- [ ] **Step 1: Modify `dang_nhap.js` to store `userAllowedPages`**

When login succeeds, store `account.allowedPages` into `localStorage.setItem('userAllowedPages', JSON.stringify(account.allowedPages || []))`.

- [ ] **Step 2: Modify `sidebar.js` sidebar navigation builder**

Filter `NAV_ITEMS` so that links are only displayed if user is `bao.lt` or page URL is present in `userAllowedPages`. If a group has no visible child pages, hide the group header.

- [ ] **Step 3: Add route guard check in `sidebar.js`**

Add check on page load and iframe tab load:
```js
function checkPagePermission(urlPath) {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return;
    if (currentUser === 'bao.lt') return;

    const allowedPages = JSON.parse(localStorage.getItem('userAllowedPages') || '[]');
    const isAllowed = allowedPages.some(page => urlPath.endsWith(page) || page === '*');

    if (!isAllowed && !urlPath.endsWith('home.html') && !urlPath.endsWith('dang_nhap.html')) {
        alert('Rất tiếc! Bạn không có quyền truy cập trang này.');
        window.location.href = '/pages/home.html';
    }
}
```

- [ ] **Step 4: Commit access control implementation**

```bash
git add assets/js/dang_nhap.js assets/js/sidebar.js
git commit -m "feat(auth): implement page permission filtering on sidebar and route guard redirect"
```
