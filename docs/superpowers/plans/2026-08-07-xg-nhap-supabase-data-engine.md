# Pilot Implementation of SupabaseDataEngine on `xg-nhap.html` Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `xg-nhap.html` and `xg-nhap.js` from client-side full table download to server-side range pagination and server-side filtering via `SupabaseDataEngine`.

**Architecture:** Replace `fetchAllFromSupabase` with `window.supabaseDataEngine.fetchPage(...)`, wiring `searchInput`, `fromDate`/`toDate`, and checkbox filter states into `filters` parameters. Fetch distinct filter options via light targeted queries and invalidate cache on CRUD operations.

**Tech Stack:** JavaScript (ES6+), Supabase JS Client v2, Vanilla CSS/HTML, Bootstrap 5.

## Global Constraints
- Target file: `assets/js/xg/xg-nhap.js` and `pages/xg/xg-nhap.html`.
- Rows per page: 100 (`ROWS_PER_PAGE = 100`).
- Database table name: `xg-nhap`.

---

### Task 1: Refactor `fetchDataFromSupabase` to use `SupabaseDataEngine.fetchPage`

**Files:**
- Modify: `assets/js/xg/xg-nhap.js`

**Interfaces:**
- Consumes: `window.supabaseDataEngine.fetchPage(tableName, page, rowsPerPage, filters, orderBy, ascending)`
- Produces: Server-paginated `tableData`, `totalCount`, and `totalPages` state.

- [ ] **Step 1: Build filter collector function `buildSupabaseFilters()` in `xg-nhap.js`**

```javascript
function buildSupabaseFilters() {
  const filters = {
    searchColumns: [
      'Mã chứng từ', 'Phiếu nhập', 'Mã vật tư', 'Tên vật tư',
      'Batch', 'Cuộn ID', 'Vị trí', 'Mã công trình', 'Tên công trình', 'Ghi chú'
    ],
    equals: {}
  };

  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl && searchInputEl.value.trim()) {
    filters.searchTerm = searchInputEl.value.trim();
  }

  const fromDateEl = document.getElementById('fromDate');
  const toDateEl = document.getElementById('toDate');
  if (fromDateEl && fromDateEl.value) {
    filters.fromDate = fromDateEl.value;
    filters.dateColumn = 'Ngày nhập';
  }
  if (toDateEl && toDateEl.value) {
    filters.toDate = toDateEl.value;
    filters.dateColumn = 'Ngày nhập';
  }

  const typeMenu = document.getElementById('typeFilterMenu');
  if (typeMenu) {
    const selectedTypes = Array.from(typeMenu.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => String(cb.value).trim())
      .filter(Boolean);
    if (selectedTypes.length > 0) {
      filters.equals['Loại nhập'] = selectedTypes;
    }
  }

  const voucherMenu = document.getElementById('voucherFilterMenu');
  if (voucherMenu) {
    const selectedVouchers = Array.from(voucherMenu.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => String(cb.value).trim())
      .filter(Boolean);
    if (selectedVouchers.length > 0) {
      filters.equals['Mã chứng từ'] = selectedVouchers;
    }
  }

  return filters;
}
```

- [ ] **Step 2: Update `fetchDataFromSupabase(targetPage = 1)` to execute `window.supabaseDataEngine.fetchPage`**

```javascript
async function fetchDataFromSupabase(targetPage = 1) {
  try {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = '';
      loadingEl.textContent = 'Đang tải dữ liệu...';
    }

    currentPage = targetPage;
    const filters = buildSupabaseFilters();

    const result = await window.supabaseDataEngine.fetchPage(
      TABLE_NAME,
      currentPage,
      ROWS_PER_PAGE,
      filters,
      'id',
      true
    );

    const { data: rawRows, count: totalRows } = result;
    totalCount = totalRows || 0;
    totalPages = Math.max(1, Math.ceil(totalCount / ROWS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    tableData = [COLUMN_HEADERS, ...rawRows.map((row, idx) => {
      const arr = rowToArray(row);
      arr.originalIndex = (currentPage - 1) * ROWS_PER_PAGE + idx + 1;
      return arr;
    })];

    renderTableData(tableData);
    updatePaginationControls();

    if (loadingEl) loadingEl.style.display = 'none';
    const btnExport = document.getElementById('btnExport');
    if (btnExport) btnExport.disabled = false;

  } catch (error) {
    console.error('Supabase error in fetchDataFromSupabase:', error);
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.textContent = `Lỗi kết nối Supabase: ${error.message}`;
  }
}
```

---

### Task 2: Implement Filter Trigger Event Listeners & Distinct Filter Populating

**Files:**
- Modify: `assets/js/xg/xg-nhap.js`

- [ ] **Step 1: Implement `populateDistinctFilterDropdowns()`**

Query unique filter dropdown options without fetching full table:

```javascript
async function populateDistinctFilterDropdowns() {
  try {
    const [{ data: typesData }, { data: vouchersData }] = await Promise.all([
      supabase.from(TABLE_NAME).select('Loại nhập').not('Loại nhập', 'is', null).limit(1000),
      supabase.from(TABLE_NAME).select('Mã chứng từ').not('Mã chứng từ', 'is', null).limit(1000)
    ]);

    if (typesData) {
      const uniqueTypes = Array.from(new Set(typesData.map(r => r['Loại nhập']).filter(Boolean))).sort();
      buildFilterMenuOptions('typeFilterMenu', 'typeFilterBtn', 'typeFilterCount', uniqueTypes);
    }
    if (vouchersData) {
      const uniqueVouchers = Array.from(new Set(vouchersData.map(r => r['Mã chứng từ']).filter(Boolean))).sort();
      buildFilterMenuOptions('voucherFilterMenu', 'voucherFilterBtn', 'voucherFilterCount', uniqueVouchers);
    }
  } catch (e) {
    console.warn('Failed to load distinct filter options:', e);
  }
}
```

- [ ] **Step 2: Connect `filterTable` and search inputs to trigger `fetchDataFromSupabase(1)`**

```javascript
function filterTable(resetPage = true) {
  const pageToFetch = resetPage ? 1 : currentPage;
  fetchDataFromSupabase(pageToFetch);
}
```

---

### Task 3: Invalidate Cache on CRUD Operations

**Files:**
- Modify: `assets/js/xg/xg-nhap.js`

- [ ] **Step 1: Add cache invalidation after Insert, Update, and Delete**

In `saveAddData()`, `saveEditData()`, and `deleteSelectedRows()`, call:
```javascript
window.supabaseDataEngine.invalidateCache(TABLE_NAME);
await fetchDataFromSupabase(currentPage);
```

---

### Task 4: Manual Verification

- [ ] **Step 1: Test pagination buttons (Trang trước, Trang sau, Select page)**
- [ ] **Step 2: Test text search input and date filters**
- [ ] **Step 3: Test adding/editing/deleting a record and verifying clean update**
