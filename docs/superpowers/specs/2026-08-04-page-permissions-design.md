# Design Document: Detailed HTML Page Permissions Management

**Date**: 2026-08-04  
**Author**: AI Assistant & bao.lt  
**Status**: Approved  

---

## 1. Overview & Objective

The goal is to implement detailed per-file access control for all `.html` pages in the application, grouped logically by module (5S, XÀ GỒ, TOLE, PHẾ LIỆU, TRANG CHUNG, QUẢN TRỊ).

Admin (`bao.lt`) can grant or revoke access to specific `.html` files for each user from the `quan-ly-user.html` page interface.

When a non-admin user logs in, the application will:
1. Hide unallowed `.html` links from the main sidebar.
2. Prevent access to unallowed `.html` pages via direct URL entry or iframe navigation, displaying an warning alert and automatically redirecting the user to `home.html`.

---

## 2. Database Schema & RPC Functions (Supabase)

### 2.1 Schema Updates (`public.users`)
- Add column `allowed_pages` (`JSONB`, default `'[]'::jsonb`) to `public.users`.
- Default for admin (`bao.lt`): `["*"]` or full list.
- Default for newly created users: Selected pages during creation, or `["/pages/home.html"]` by default.

### 2.2 RPC Updates

1. **`check_login(p_username, p_password)`**:
   - Returns user fields including `allowed_pages`.

2. **`admin_get_users()`**:
   - Returns user fields including `allowed_pages`.

3. **`admin_save_user(...)`**:
   - Accepts parameter `p_allowed_pages JSONB DEFAULT '[]'::jsonb`.
   - Saves `allowed_pages` when creating or editing a user record.

---

## 3. UI/UX Changes in `quan-ly-user.html` & `quan-ly-user.js`

### 3.1 User Table View
- Under column **Quyền hạn**, display a summary badge showing the number of permitted pages (e.g. `12/16 trang`).

### 3.2 Modal Add/Edit User
- Below action permissions (Xem/Thêm/Sửa/Xóa), add a section titled **"Phân quyền truy cập trang HTML"**.
- Group pages into distinct expandable/collapsible categories:
  - **Trang chung**: `/pages/home.html`, `/pages/about.html`, `/pages/cong-viec.html`
  - **Nhóm 5S**: `/pages/5s/5s-so-do-phoi-cuon.html`, `/pages/5s/5s-so-do-phe-lieu.html`, `/pages/5s/hse.html`
  - **Nhóm XÀ GỒ**: `/pages/xg/xg-nhap.html`, `/pages/xg/xg-xuat.html`, `/pages/xg/xg-ton.html`, `/pages/xg/xg-bieu-do.html`
  - **Nhóm TOLE**: `/pages/tole/tole-nhap.html`, `/pages/tole/tole-xuat.html`, `/pages/tole/tole-ton.html`, `/pages/tole/tole-bieu-do.html`
  - **Nhóm PHẾ LIỆU**: `/pages/pl/pl-can-thu.html`, `/pages/pl/pl-da-thu.html`, `/pages/pl/pl-chua-thu.html`, `/pages/pl/pl-phieu-in.html`
  - **Nhóm Quản trị**: `/pages/quan-ly-user.html` (Admin only)
- Provide a **"Chọn tất cả"** toggle button for each group and for all pages overall.

---

## 4. Frontend Access Control Guard (`sidebar.js` & `dang_nhap.js`)

### 4.1 Login & Storage
- Upon successful login, save `userAllowedPages` array to `localStorage`.
- `bao.lt` has universal access (`["*"]`).

### 4.2 Sidebar Filtering (`sidebar.js`)
- Filter `NAV_ITEMS` and sub-items based on `userAllowedPages`.
- Hide empty groups if none of their child pages are allowed.

### 4.3 Route Guard (`sidebar.js` / Page Guard)
- On page load / iframe load, verify if current path is in `userAllowedPages` or if user is `bao.lt`.
- If access is denied:
  - Show `alert('Rất tiếc! Bạn không có quyền truy cập trang này. Đang chuyển hướng về Trang chủ.')`.
  - Redirect to `/pages/home.html`.

---

## 5. Verification Plan

1. **SQL Verification**: Run updated SQL script in Supabase and confirm `allowed_pages` column and RPCs work.
2. **Admin UI Verification**: Open `quan-ly-user.html` as `bao.lt`, create a new test user with access to specific pages (e.g. only 5S and XÀ GỒ).
3. **Permission Enforcement Verification**: Log in as test user:
   - Check if Sidebar hides TOLE and PHẾ LIỆU menus.
   - Attempt direct URL navigation to `/pages/tole/tole-nhap.html` and verify alert + redirect to `home.html`.
