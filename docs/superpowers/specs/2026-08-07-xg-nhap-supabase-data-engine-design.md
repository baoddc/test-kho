# Design Spec: SupabaseDataEngine Pilot Implementation for `xg-nhap`

## 1. Overview & Goal
Migrate `pages/xg/xg-nhap.html` and `assets/js/xg/xg-nhap.js` from downloading the full table (`fetchAllFromSupabase`) and filtering in client JS memory to pure **Server-side Range Pagination & Server-side Filtering** powered by `SupabaseDataEngine` (`assets/js/core/supabase-data-engine.js`). This pilot ensures `xg-nhap` runs smoothly with sub-second response times on datasets scaling up to 500,000+ rows within Supabase Free Tier constraints.

---

## 2. Technical Architecture & Component Changes

### A. Data Fetching & State Management (`xg-nhap.js`)
- **Query Engine:** Replace `fetchAllFromSupabase` loop calls with `window.supabaseDataEngine.fetchPage(TABLE_NAME, currentPage, ROWS_PER_PAGE, filters, orderBy, ascending)`.
- **Page Size (`ROWS_PER_PAGE`):** Default to 100 rows per page.
- **Cache & Prefetch:** Utilize `BPlusBlockCache` for instant 0ms cached page views and non-blocking background prefetching of page `N+1`.

### B. Server-Side Filter Mapping
All user filters are combined into a structured filter object passed to `SupabaseDataEngine`:
- **Text Search (`searchInput`):**
  - `filters.searchTerm`: Clean string from search input.
  - `filters.searchColumns`: `['Mã chứng từ', 'Phiếu nhập', 'Mã vật tư', 'Tên vật tư', 'Batch', 'Cuộn ID', 'Vị trí', 'Mã công trình', 'Tên công trình', 'Ghi chú']`.
- **Date Range (`fromDate`, `toDate`):**
  - `filters.dateColumn`: `'Ngày nhập'`.
  - `filters.fromDate`: ISO string or formatted date string (`YYYY-MM-DD`).
  - `filters.toDate`: ISO string or formatted date string (`YYYY-MM-DD`).
- **Multi-Select Checkboxes (`Loại nhập`, `Mã chứng từ`):**
  - `filters.equals['Loại nhập']`: Array of checked string values.
  - `filters.equals['Mã chứng từ']`: Array of checked string values.

### C. Distinct Dropdown Filter Values
- To populate checkbox filters for "Loại nhập" and "Mã chứng từ" without downloading all 500k rows:
  - Query unique values using light PostgREST queries (e.g. `supabase.from('xg-nhap').select('Loại nhập')` or indexed distinct options).

### D. CRUD & Cache Invalidation
- **Add / Edit / Delete Data (`btnAddData`, `btnEditData`, `btnDeleteData`):**
  - On successful insert, update, or deletion, invoke `window.supabaseDataEngine.invalidateCache(TABLE_NAME)`.
  - Refresh the current page view by calling `fetchDataFromSupabase(currentPage)`.

### E. Excel Export Tối ưu (`btnExport`)
- Check filter row count before exporting.
- If total rows exceed 10,000, export in server-side batches using range queries (chunk size 1,000) or prompt user to apply date range filter.

---

## 3. Implementation Plan Summary

1. Update `fetchDataFromSupabase` in `assets/js/xg/xg-nhap.js` to construct `filters` object and call `window.supabaseDataEngine.fetchPage`.
2. Connect `filterTable` and debounced inputs directly to `fetchDataFromSupabase(1)` to trigger server-side re-query.
3. Update `updatePaginationControls` and page jump buttons (`prevPage`, `nextPage`, `pageSelect`) to drive server-side page fetching.
4. Implement distinct value fetching for filter menus.
5. Invalidate cache on CRUD actions.
6. Verify and test manually.

---

## 4. Verification & Testing Plan
- **Pagination Test:** Verify initial load shows Page 1 with 100 rows. Test page navigation, Next, Prev, and jumping via page select dropdown.
- **Search Test:** Type search terms (e.g. "Batch", "Mã vật tư") and confirm server-side `ilike` query returns accurate total count and page results.
- **Date & Filter Checkboxes Test:** Filter by Date Range and multi-select checkboxes, verifying filtered total count and pagination update correctly.
- **CRUD Cache Invalidation:** Add a new record, edit a record, delete a record, and verify table updates cleanly.
