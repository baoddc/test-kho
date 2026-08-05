# Retain Current Page on Add, Edit, Delete Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure pagination stays on the current page (`currentPage`) after adding, editing, or deleting data across XG, Tole, and PL modules, auto-clamping to the maximum valid page if all rows on the active page are deleted.

**Architecture:** Update `renderTable`, `renderTableWithPagination`, `restoreFilterState`, and post-CRUD reload logic in target JavaScript modules to preserve `currentPage` instead of resetting to 1, while enforcing boundary checking (`currentPage = Math.min(currentPage, totalPages)`).

**Tech Stack:** Vanilla JavaScript (ES6+), Supabase JS Client.

## Global Constraints
- Preserve existing filter states, search inputs, and scroll positions.
- Do not introduce breaking changes to existing table rendering or filtering APIs.

---

### Task 1: Update XG Modules (`xg-nhap-supabase.js`, `xg-xuat-supabase.js`, `xg-ton-supabase.js`)

**Files:**
- Modify: `assets/js/xg/xg-nhap-supabase.js`
- Modify: `assets/js/xg/xg-xuat-supabase.js`
- Modify: `assets/js/xg/xg-ton-supabase.js`

**Interfaces:**
- Consumes: `saveFilterState()`, `restoreFilterState()`, `renderTable(data, resetPage)`
- Produces: Updated pagination logic retaining `currentPage` after CRUD operations.

- [ ] **Step 1: Update `xg-nhap-supabase.js` pagination & CRUD calls**
Ensure `renderTable(tableData, false)` or `restoreFilterState()` maintains `currentPage` without reset to 1, and ensure `renderTableWithPagination()` clamps `if (currentPage > totalPages) currentPage = totalPages`.

- [ ] **Step 2: Update `xg-xuat-supabase.js` pagination & CRUD calls**
Ensure `renderTable(tableData, false)` or `restoreFilterState()` maintains `currentPage` without reset to 1, and ensure `renderTableWithPagination()` clamps `if (currentPage > totalPages) currentPage = totalPages`.

- [ ] **Step 3: Update `xg-ton-supabase.js` pagination & CRUD calls**
Ensure `renderTable(tableData, false)` or `restoreFilterState()` maintains `currentPage` without reset to 1, and ensure `renderTableWithPagination()` clamps `if (currentPage > totalPages) currentPage = totalPages`.

- [ ] **Step 4: Commit Task 1**
```bash
git add assets/js/xg/*.js
git commit -m "feat(xg): retain current page on CRUD operations"
```

---

### Task 2: Update Tole Modules (`tole-nhap-supabase.js`, `tole-xuat-supabase.js`, `tole-ton-supabase.js`)

**Files:**
- Modify: `assets/js/tole/tole-nhap-supabase.js`
- Modify: `assets/js/tole/tole-xuat-supabase.js`
- Modify: `assets/js/tole/tole-ton-supabase.js`

**Interfaces:**
- Consumes: `saveFilterState()`, `restoreFilterState()`, `renderTable(data, resetPage)`
- Produces: Updated pagination logic retaining `currentPage` after CRUD operations.

- [ ] **Step 1: Update `tole-nhap-supabase.js` pagination & CRUD calls**
Ensure `renderTable(tableData, false)` or `restoreFilterState()` maintains `currentPage` without reset to 1, and ensure `renderTableWithPagination()` clamps `if (currentPage > totalPages) currentPage = totalPages`.

- [ ] **Step 2: Update `tole-xuat-supabase.js` pagination & CRUD calls**
Ensure `renderTable(tableData, false)` or `restoreFilterState()` maintains `currentPage` without reset to 1, and ensure `renderTableWithPagination()` clamps `if (currentPage > totalPages) currentPage = totalPages`.

- [ ] **Step 3: Update `tole-ton-supabase.js` pagination & CRUD calls**
Ensure `renderTable(tableData, false)` or `restoreFilterState()` maintains `currentPage` without reset to 1, and ensure `renderTableWithPagination()` clamps `if (currentPage > totalPages) currentPage = totalPages`.

- [ ] **Step 4: Commit Task 2**
```bash
git add assets/js/tole/*.js
git commit -m "feat(tole): retain current page on CRUD operations"
```

---

### Task 3: Update PL Modules (`pl-can-thu.js`, `pl-chua-thu.js`, `pl-da-thu.js`, `pl-phieu-in.js`)

**Files:**
- Modify: `assets/js/pl/pl-can-thu.js`
- Modify: `assets/js/pl/pl-chua-thu.js`
- Modify: `assets/js/pl/pl-da-thu.js`
- Modify: `assets/js/pl/pl-phieu-in.js`

**Interfaces:**
- Consumes: `saveFilterState()`, `restoreFilterState()`, `renderTable()`
- Produces: Updated pagination logic retaining `currentPage` after CRUD operations.

- [ ] **Step 1: Update `pl-can-thu.js`, `pl-chua-thu.js`, `pl-da-thu.js` pagination & CRUD calls**
Ensure `restoreFilterState()` and `renderTable` maintain `currentPage` without reset to 1, and clamp `currentPage` to `totalPages`.

- [ ] **Step 2: Update `pl-phieu-in.js` pagination & reload calls**
In `pl-phieu-in.js`, update post-CRUD data reloads to pass `resetPage = false` to `renderTable(filteredData, false)` so `currentPage` is preserved.

- [ ] **Step 3: Commit Task 3**
```bash
git add assets/js/pl/*.js
git commit -m "feat(pl): retain current page on CRUD operations"
```
