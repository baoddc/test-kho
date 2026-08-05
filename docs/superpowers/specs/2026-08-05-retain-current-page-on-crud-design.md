# Retain Current Page on Add, Edit, Delete (CRUD) Operations

## Executive Summary
When users perform Add (Thêm), Edit (Sửa), or Delete (Xóa) operations in data tables across the application (XG, Tole, and PL modules), the UI currently resets the page back to page 1 (`currentPage = 1`). This design specifies retaining the user's active `currentPage` after any CRUD operation and ensuring automatic page boundary validation if deletions reduce the total page count.

---

## Architectural & Design Overview

### Key Behavior
1. **Preserve `currentPage`**: Upon completion of Add, Edit, or Delete actions, the current page index (`currentPage`) remains unchanged rather than resetting to `1`.
2. **Page Bounds Validation**: When items are deleted and `currentPage > totalPages` (e.g., all rows on the last page were deleted), `currentPage` is automatically clamped to `totalPages` (`Math.max(1, totalPages)`).
3. **Filter & Scroll State Restoration**: Retain existing search query, column filters, and scroll position via `restoreFilterState()` and `restoreScrollPosition()`.

---

## Target Modules & Code Components

### 1. XG Modules
- `assets/js/xg/xg-nhap-supabase.js`
- `assets/js/xg/xg-xuat-supabase.js`
- `assets/js/xg/xg-ton-supabase.js`

### 2. Tole Modules
- `assets/js/tole/tole-nhap-supabase.js`
- `assets/js/tole/tole-xuat-supabase.js`
- `assets/js/tole/tole-ton-supabase.js`

### 3. PL (Phế Liệu) Modules
- `assets/js/pl/pl-can-thu.js`
- `assets/js/pl/pl-chua-thu.js`
- `assets/js/pl/pl-da-thu.js`
- `assets/js/pl/pl-phieu-in.js`

---

## Implementation Details

1. **Table Rendering & Pagination Function Clamping**:
   Ensure `renderTableWithPagination()` (or `calculatePagination()`) in all target modules enforces:
   ```javascript
   if (currentPage > totalPages) currentPage = totalPages;
   if (currentPage < 1) currentPage = 1;
   ```
2. **CRUD Post-Action Calls**:
   - Call `renderTable(data, false)` with `resetPage = false` after inserting, updating, or deleting rows.
   - When calling `loadGoogleSheet()` or `loadDataSupabase()`, save and restore `currentPage` alongside filter states (`window._savedFilterState`).
   - In `pl-phieu-in.js`, update post-delete/post-save reload logic (`loadGoogleSheet()`) to pass `resetPage = false` to `renderTable()`.

---

## Verification Plan

### Manual Verification
1. Navigate to Page 2 (or higher) in `Tole Nhập`, `XG Nhập`, or `PL Phế Liệu`.
2. **Edit a row**: Confirm page remains on Page 2 after save.
3. **Add a row**: Confirm page remains on Page 2 after save.
4. **Delete a row on Page 2**: Confirm page remains on Page 2 (or shifts to Page 1 if Page 2 had only 1 item and is now empty).
