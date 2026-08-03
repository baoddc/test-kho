# Maintain Current Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve table pagination position (`currentPage`) across Add, Edit, and Delete operations for `pl` (Phế liệu), `xg` (Xà gồ), and `tole` (Tôn) modules, with boundary protection against empty pages after deletion.

**Architecture:** Update `applyFilters(resetPage)` and `renderTable(data, resetPage)` signatures to take a `resetPage = true` parameter. After CRUD operations, trigger updates with `resetPage = false`. Add safety clamping `currentPage = Math.min(currentPage, totalPages)` to handle total page shrinkage after row deletions.

**Tech Stack:** Vanilla JavaScript (ES6+), Supabase Client, DOM Manipulation.

## Global Constraints
- Preserve `resetPage = true` behavior when user interacts with search box or filter dropdowns.
- Always clamp `currentPage` between `1` and `totalPages`.
- Do not introduce breaking changes to existing data structures or Supabase sync mechanisms.

---

### Task 1: Update Phế liệu (`pl`) JS Files (`pl-can-thu.js`, `pl-chua-thu.js`, `pl-da-thu.js`, `pl-phieu-in.js`)

**Files:**
- Modify: `assets/js/pl/pl-can-thu.js`
- Modify: `assets/js/pl/pl-chua-thu.js`
- Modify: `assets/js/pl/pl-da-thu.js`
- Modify: `assets/js/pl/pl-phieu-in.js`

**Interfaces:**
- Produces: Updated `applyFilters(resetPage = true)` that preserves page position when `resetPage` is `false`.

- [ ] **Step 1: Update `applyFilters` in `pl-can-thu.js`**

Modify `applyFilters(resetPage = true)` in `assets/js/pl/pl-can-thu.js`:
```javascript
function applyFilters(resetPage = true) {
  const searchInput = document.getElementById('searchInput');
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');

  const searchTerm = searchInput?.value?.toLowerCase() || '';
  const fromDate = fromDateInput?.value;
  const toDate = toDateInput?.value;
  const checkedXuongs = Array.from(document.querySelectorAll('.xuong-filter-checkbox:checked')).map(cb => cb.value);
  const checkedKiDos = Array.from(document.querySelectorAll('.kido-filter-checkbox:checked')).map(cb => cb.value);

  filteredData = tableData.filter(row => {
    if (searchTerm) {
      const searchFields = [row.xuong, row.loai, row.ghichu].filter(f => f).join(' ').toLowerCase();
      if (!searchFields.includes(searchTerm)) return false;
    }
    if (fromDate || toDate) {
      const rowDate = parseRowDate(row.ngay);
      if (rowDate) {
        const rowYear = rowDate.getFullYear();
        const rowMonth = String(rowDate.getMonth() + 1).padStart(2, '0');
        const rowDay = String(rowDate.getDate()).padStart(2, '0');
        const rowDateStr = `${rowYear}-${rowMonth}-${rowDay}`;
        if (fromDate && rowDateStr < fromDate) return false;
        if (toDate && rowDateStr > toDate) return false;
      } else {
        return false;
      }
    }
    if (checkedXuongs.length > 0 && (!row.xuong || !checkedXuongs.includes(row.xuong))) return false;
    if (checkedKiDos.length > 0 && (!row.kido || !checkedKiDos.includes(row.kido))) return false;
    return true;
  });

  if (resetPage) {
    currentPage = 1;
  }

  totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  updatePagination();
  renderTable();
}
```

- [ ] **Step 2: Update `applyFilters` and CRUD reload callers in `pl-chua-thu.js` and `pl-da-thu.js`**

In `pl-chua-thu.js` and `pl-da-thu.js`, update `applyFilters(resetPage = true)` similarly, ensuring `resetPage` is respected and `currentPage` is clamped:
```javascript
if (resetPage) {
  currentPage = 1;
}
totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;
if (currentPage > totalPages) currentPage = totalPages;
if (currentPage < 1) currentPage = 1;
```
And in Add/Edit/Delete submit response handlers, call `applyFilters(false)`.

- [ ] **Step 3: Update `pl-phieu-in.js` `renderTable` and `updateItemsList`**

In `assets/js/pl/pl-phieu-in.js`, ensure `renderTable(data, resetPage = true)` and post-save callers preserve `currentPage`:
```javascript
function renderTable(data, resetPage = true) {
  if (resetPage) {
    currentPage = 1;
  }
  calculatePagination(data);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  renderTableWithPagination();
}
```

- [ ] **Step 4: Verify syntax & behavior**

Check files for syntax errors using `node -c assets/js/pl/pl-can-thu.js`, `node -c assets/js/pl/pl-chua-thu.js`, `node -c assets/js/pl/pl-da-thu.js`, `node -c assets/js/pl/pl-phieu-in.js`.

- [ ] **Step 5: Commit changes**

```bash
git add assets/js/pl/
git commit -m "feat(pl): preserve current page on add, edit, and delete"
```

---

### Task 2: Update Xà gồ (`xg`) JS Files (`xg-nhap-supabase.js`, `xg-xuat-supabase.js`, `xg-ton-supabase.js`)

**Files:**
- Modify: `assets/js/xg/xg-nhap-supabase.js`
- Modify: `assets/js/xg/xg-xuat-supabase.js`
- Modify: `assets/js/xg/xg-ton-supabase.js`

**Interfaces:**
- Consumes: Filter state & pagination state functions
- Produces: Page-preserved table rendering for `xg` module

- [ ] **Step 1: Update `calculatePagination` and `restoreFilterState` in `xg-nhap-supabase.js`**

In `assets/js/xg/xg-nhap-supabase.js`, update `calculatePagination`:
```javascript
function calculatePagination(data) {
  totalPages = Math.max(1, Math.ceil((data.length - 1) / ROWS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
}
```
In `restoreFilterState(state)`, ensure restored `currentPage` is rendered:
```javascript
function restoreFilterState(state) {
  if (!state) return;
  currentPage = state.currentPage || 1;
  // ... restore filter inputs ...
  renderTableWithPagination();
}
```

- [ ] **Step 2: Update `xg-xuat-supabase.js` and `xg-ton-supabase.js`**

Apply the same `calculatePagination` safety clamping and `restoreFilterState` pagination re-rendering in `assets/js/xg/xg-xuat-supabase.js` and `assets/js/xg/xg-ton-supabase.js`.

- [ ] **Step 3: Verify syntax & node check**

Run: `node -c assets/js/xg/xg-nhap-supabase.js`, `node -c assets/js/xg/xg-xuat-supabase.js`, `node -c assets/js/xg/xg-ton-supabase.js`.

- [ ] **Step 4: Commit changes**

```bash
git add assets/js/xg/
git commit -m "feat(xg): preserve current page on add, edit, and delete"
```

---

### Task 3: Update Tôn (`tole`) JS Files (`tole-nhap-supabase.js`, `tole-xuat-supabase.js`, `tole-ton-supabase.js`)

**Files:**
- Modify: `assets/js/tole/tole-nhap-supabase.js`
- Modify: `assets/js/tole/tole-xuat-supabase.js`
- Modify: `assets/js/tole/tole-ton-supabase.js`

**Interfaces:**
- Produces: Page-preserved table rendering for `tole` module

- [ ] **Step 1: Update `calculatePagination` and `restoreFilterState` in `tole-nhap-supabase.js`**

In `assets/js/tole/tole-nhap-supabase.js`:
```javascript
function calculatePagination(data) {
  totalPages = Math.max(1, Math.ceil((data.length - 1) / ROWS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
}
```
And in `restoreFilterState(state)`:
```javascript
function restoreFilterState(state) {
  if (!state) return;
  currentPage = state.currentPage || 1;
  // ... restore filter inputs ...
  renderTableWithPagination();
}
```

- [ ] **Step 2: Update `tole-xuat-supabase.js` and `tole-ton-supabase.js`**

Apply safety clamping in `calculatePagination` and pagination re-rendering in `restoreFilterState` across `assets/js/tole/tole-xuat-supabase.js` and `assets/js/tole/tole-ton-supabase.js`.

- [ ] **Step 3: Verify syntax & node check**

Run: `node -c assets/js/tole/tole-nhap-supabase.js`, `node -c assets/js/tole/tole-xuat-supabase.js`, `node -c assets/js/tole/tole-ton-supabase.js`.

- [ ] **Step 4: Commit changes**

```bash
git add assets/js/tole/
git commit -m "feat(tole): preserve current page on add, edit, and delete"
```
