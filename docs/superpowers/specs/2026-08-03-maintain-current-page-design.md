# Design Spec: Maintain Current Page on Add, Edit, and Delete Operations

## Overview
Currently, performing Create (Add), Update (Edit), or Delete (Xóa) operations resets table pagination to **Page 1**. This spec details the changes needed to preserve the user's current pagination page (`currentPage`) across data modification workflows, while ensuring boundary safety if total pages decrease.

## Goal
- Maintain `currentPage` when data is added, modified, or deleted.
- Adjust `currentPage` safely to `totalPages` if deletions cause the current page to no longer exist.
- Preserve page 1 reset behavior when users explicitly apply new search queries or filter selections.

## Target Files
1. `assets/js/pl/pl-can-thu.js`
2. `assets/js/pl/pl-chua-thu.js`
3. `assets/js/pl/pl-da-thu.js`
4. `assets/js/pl/pl-phieu-in.js`
5. `assets/js/xg/xg-nhap-supabase.js`
6. `assets/js/xg/xg-xuat-supabase.js`
7. `assets/js/xg/xg-ton-supabase.js`
8. `assets/js/tole/tole-nhap-supabase.js`
9. `assets/js/tole/tole-xuat-supabase.js`
10. `assets/js/tole/tole-ton-supabase.js`

## Detailed Design

### 1. Function Parameter & State Logic
- Modify `applyFilters(resetPage = true)` in modules using `applyFilters`:
  ```javascript
  function applyFilters(resetPage = true) {
    // ... filter logic ...
    
    if (resetPage) {
      currentPage = 1;
    }
    
    totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;
    
    // Clamp currentPage within valid bounds [1, totalPages]
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    updatePagination();
    renderTable();
  }
  ```

- Ensure `renderTable(data, resetPage = true)` and `calculatePagination(data)` safely clamp `currentPage`:
  ```javascript
  function calculatePagination(data) {
    totalPages = Math.max(1, Math.ceil((data.length - 1) / ROWS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
  }
  ```

### 2. Post-CRUD Workflows
- **Add / Edit Save Handler**:
  - Call `applyFilters(false)` or `renderTable(tableData, false)`.
  - Pass `resetPage = false` so `currentPage` is maintained.
- **Delete Handler**:
  - Call `applyFilters(false)` or `renderTable(tableData, false)`.
  - `calculatePagination` or `applyFilters` automatically clamps `currentPage` if deleting items reduces `totalPages` below the current `currentPage`.
- **Restore Filter State**:
  - Ensure `restoreFilterState(state)` updates `currentPage = state.currentPage || 1;` and re-invokes `renderTableWithPagination()` / `applyFilters(false)` so UI table rows match the restored page.

### 3. Filter / Search User Actions (Reset to Page 1)
- User typing in `searchInput` -> calls `applyFilters(true)` or `applyFilters()`.
- User changing `fromDate` / `toDate` -> calls `applyFilters(true)` or `applyFilters()`.
- User toggling checkbox filter menus -> calls `applyFilters(true)` or `applyFilters()`.

## Verification Plan
1. **Manual Testing**:
   - Navigate to Page 3 in `pl-can-thu.html`.
   - Edit an entry -> verify user remains on Page 3.
   - Add a new entry -> verify user remains on Page 3.
   - Delete entries on Page 3 -> verify user remains on Page 3 (or drops to Page 2 if Page 3 became empty).
   - Type in Search Box -> verify table resets to Page 1.
2. Repeat verification across `pl`, `xg`, and `tole` table views.
