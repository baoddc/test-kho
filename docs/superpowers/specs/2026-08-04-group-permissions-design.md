# Design Spec: Per-Group Data Action Permissions

## Overview
Currently, data manipulation permissions (Xem, Thêm, Sửa, Xóa) are assigned globally across the whole system. This design spec transitions data manipulation permissions to be configured **per group** (e.g. Trang Chung, Nhóm 5S, Nhóm XÀ GỒ, Nhóm TOLE, Nhóm PHẾ LIỆU, Quản trị) in the User Management & Permissions modal (`quan-ly-user.html`).

---

## 1. User Management Modal (`pages/quan-ly-user.html`)

- Remove the standalone global section "Quyền thao tác dữ liệu" at the top of the form.
- Inside each group box in the accordion (`#pagePermAccordion`):
  - **Group Header**: Group Name + Group Select All Checkbox (`group-select-all`).
  - **Group Action Permissions Row**:
    - `👁️ Xem`: `group-perm-{group}-view`
    - `➕ Thêm`: `group-perm-{group}-add`
    - `✏️ Sửa`: `group-perm-{group}-edit`
    - `🗑️ Xóa`: `group-perm-{group}-delete`
  - **Group HTML Pages Row**: Checkboxes for accessing HTML pages in that group (`group-page-{group}`).
- Clicking a group's `Select All` checkbox toggles both its HTML pages and its group action permissions.

---

## 2. Data Model & Storage

### `allowed_pages` (JSONB) Schema Extension
To ensure backward compatibility without breaking existing Supabase schema, `allowed_pages` stored in `users.allowed_pages` column will accept an object structure:

```json
{
  "pages": [
    "/pages/home.html",
    "/pages/xg/xg-nhap.html",
    "/pages/xg/xg-xuat.html"
  ],
  "groups": {
    "chung": { "canView": true, "canAdd": false, "canEdit": false, "canDelete": false },
    "5s": { "canView": true, "canAdd": false, "canEdit": false, "canDelete": false },
    "xg": { "canView": true, "canAdd": true, "canEdit": true, "canDelete": false },
    "tole": { "canView": true, "canAdd": false, "canEdit": false, "canDelete": false },
    "pl": { "canView": true, "canAdd": true, "canEdit": true, "canDelete": true },
    "admin": { "canView": false, "canAdd": false, "canEdit": false, "canDelete": false }
  }
}
```
*Note*: If `allowed_pages` is a simple array `["*"]` (for Admin `bao.lt`), all pages and group actions return `true`.

### Supabase Column Compatibility
When saving a user via `admin_save_user`, system-level flags (`can_view`, `can_add`, `can_edit`, `can_delete`) are computed as the OR combination of all group permissions so legacy backend queries continue working.

---

## 3. Login & Client Session (`assets/js/dang_nhap.js`)

During login, `check_login` returns `allowed_pages`. `completeLogin` stores:
- `localStorage.setItem('userAllowedPages', JSON.stringify(allowedPages.pages || allowedPages))`
- `localStorage.setItem('userGroupPermissions', JSON.stringify(allowedPages.groups || {}))`
- `localStorage.setItem('userPermissions', JSON.stringify(globalPermissions))`

---

## 4. Permission Resolution Helper (`assets/js/supabase-config.js`)

Updated `getUserPermissions(groupName)` signature:

```javascript
function getUserPermissions(groupName = null) {
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser && currentUser.toLowerCase() === 'bao.lt') {
    return { canView: true, canAdd: true, canEdit: true, canDelete: true, isAdmin: true };
  }

  let groupPerms = null;
  if (groupName) {
    try {
      const rawGroups = localStorage.getItem('userGroupPermissions');
      if (rawGroups) {
        const groupsObj = JSON.parse(rawGroups);
        if (groupsObj[groupName]) {
          groupPerms = groupsObj[groupName];
        }
      }
    } catch (e) {}
  }

  if (groupPerms) {
    return {
      canView: !!groupPerms.canView,
      canAdd: !!groupPerms.canAdd,
      canEdit: !!groupPerms.canEdit,
      canDelete: !!groupPerms.canDelete,
      isAdmin: false
    };
  }

  // Fallback to global perms if groupName is not provided or not configured
  let storedPerms = null;
  try {
    const raw = localStorage.getItem('userPermissions');
    if (raw) storedPerms = JSON.parse(raw);
  } catch (e) {}

  return {
    canView: storedPerms ? !!storedPerms.canView : true,
    canAdd: storedPerms ? !!storedPerms.canAdd : false,
    canEdit: storedPerms ? !!storedPerms.canEdit : false,
    canDelete: storedPerms ? !!storedPerms.canDelete : false,
    isAdmin: false
  };
}
```

---

## 5. Module Integration

Each module passes its group identifier to `getUserPermissions`:
- **Xà Gỗ (`xg`)**: `getUserPermissions('xg')` in `xg-nhap-supabase.js`, `xg-xuat-supabase.js`
- **Tole (`tole`)**: `getUserPermissions('tole')` in `tole-nhap-supabase.js`, `tole-xuat-supabase.js`
- **Phế Liệu (`pl`)**: `getUserPermissions('pl')` in `pl-da-thu.js`, `pl-chua-thu.js`, `pl-can-thu.js`, `pl-phieu-in.js`
- **5S (`5s`)**: `getUserPermissions('5s')` in `hse.js`

---

## Verification Plan

### Automated Syntax & Build Verification
- Execute `node -c` check across all modified JavaScript files (`quan-ly-user.js`, `supabase-config.js`, `dang_nhap.js`, `xg-*.js`, `tole-*.js`, `pl-*.js`).

### Manual Functional Verification
1. Log in as `bao.lt`, open `quan-ly-user.html`.
2. Edit `user1`:
   - Group XÀ GỒ: Grant Xem, Thêm, Sửa (leave Xóa unchecked).
   - Group TOLE: Grant Xem only.
   - Group PHẾ LIỆU: Grant Xem, Thêm, Sửa, Xóa.
3. Save user and log in as `user1`.
4. Open `pages/xg/xg-nhap.html`: Verify Add and Edit modals work, but Delete button is hidden.
5. Open `pages/tole/tole-nhap.html`: Verify Add/Edit modals are disabled (View only).
6. Open `pages/pl/pl-da-thu.html`: Verify Add, Edit, and Delete buttons work.
