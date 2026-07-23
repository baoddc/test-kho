# Implementation Plan: Lock Edit/Delete Operations After 24 Hours

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent editing and deleting records that were created in Supabase more than 24 hours ago across all modules (Phế liệu, Tôn, Xà gồ), disabling UI edit/delete buttons when locked records are selected and enforcing guards at the function level.

**Architecture:** Add a centralized helper `isRecordLocked(record)` in `assets/js/supabase-config.js` that checks if `(Date.now() - new Date(record.created_at).getTime()) > 24 * 60 * 60 * 1000`. Integrate this check in row-selection change handlers across all modules to dynamically disable Edit/Delete buttons, and add protective guards inside modal opening and submit/delete functions.

**Tech Stack:** Vanilla JavaScript, Supabase Client JS API, Bootstrap Modals.

## Global Constraints
- `LOCK_DURATION_MS`: $24 \times 60 \times 60 \times 1000$ (86,400,000 milliseconds).
- Policy applies strictly to all users (including admin `bao.lt`).
- Fallback: Records without a valid `created_at` timestamp remain unlocked (`isRecordLocked` returns `false`).

---

### Task 1: Add Centralized `isRecordLocked` Utility Function

**Files:**
- Modify: `assets/js/supabase-config.js`

**Interfaces:**
- Produces: `window.isRecordLocked(record)` -> returns `boolean`

- [ ] **Step 1: Inspect `assets/js/supabase-config.js`**

View `assets/js/supabase-config.js` content.

- [ ] **Step 2: Add `isRecordLocked` function to `assets/js/supabase-config.js`**

```javascript
/**
 * Checks if a Supabase data record was created over 24 hours ago.
 * @param {Object} record - Raw record object from Supabase.
 * @returns {boolean} True if locked (> 24h old), false otherwise.
 */
function isRecordLocked(record) {
  if (!record) return false;
  const createdAtStr = record.created_at || record.createdAt || record.created_Time;
  if (!createdAtStr) return false;
  
  const createdTime = new Date(createdAtStr).getTime();
  if (isNaN(createdTime)) return false;
  
  const LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  return (Date.now() - createdTime) > LOCK_DURATION_MS;
}

if (typeof window !== 'undefined') {
  window.isRecordLocked = isRecordLocked;
}
```

- [ ] **Step 3: Verify function definition**

Ensure `isRecordLocked` is globally available when `supabase-config.js` is loaded.

- [ ] **Step 4: Commit Task 1**

```bash
git add assets/js/supabase-config.js
git commit -m "feat: add global isRecordLocked helper function"
```

---

### Task 2: Implement 24h Restriction in Phế liệu Module (`pl-phieu-in.js`)

**Files:**
- Modify: `assets/js/pl/pl-phieu-in.js`

**Interfaces:**
- Consumes: `window.isRecordLocked(record)`

- [ ] **Step 1: Update row selection handler in `pl-phieu-in.js`**

In `pl-phieu-in.js`, update checkbox selection handling (`updateSelectionState` or equivalent) to check if any selected row is locked:
```javascript
// Check if selected rows are locked (>24h)
const isAnySelectedLocked = selectedRowIndexes.some(idx => {
  const record = rawSupabaseData && rawSupabaseData[idx - 1];
  return window.isRecordLocked(record);
});

// Update edit button: disabled if non-single row OR if selected row is locked
const editBtn = document.getElementById('btnEditData');
if (editBtn) {
  if (selectedRowIndexes.length === 1 && !isAnySelectedLocked) {
    editBtn.disabled = false;
  } else {
    editBtn.disabled = true;
  }
}

// Update delete button: disabled if no selection OR if any selected row is locked
const deleteBtn = document.getElementById('btnDeleteData');
if (deleteBtn) {
  if (selectedRowIndexes.length > 0 && !isAnySelectedLocked) {
    deleteBtn.disabled = false;
  } else {
    deleteBtn.disabled = true;
  }
}
```

- [ ] **Step 2: Add guard in `openEditDataModal` and `openDeleteDataModal`**

```javascript
function openEditDataModal() {
  const record = rawSupabaseData && rawSupabaseData[selectedRowIndex - 1];
  if (window.isRecordLocked(record)) {
    alert('Dữ liệu này đã được nhập quá 24 giờ. Không thể chỉnh sửa.');
    return;
  }
  // existing logic...
}

function openDeleteDataModal() {
  const isAnyLocked = selectedRowIndexes.some(idx => {
    const record = rawSupabaseData && rawSupabaseData[idx - 1];
    return window.isRecordLocked(record);
  });
  if (isAnyLocked) {
    alert('Trong số các dòng được chọn, có dữ liệu đã nhập quá 24 giờ. Không thể xóa.');
    return;
  }
  // existing logic...
}
```

- [ ] **Step 3: Add guard in `handleEditFormSubmit` and `confirmDelete`**

In `confirmDelete`:
```javascript
const isAnyLocked = rowsToDelete.some(idx => {
  const record = rawSupabaseData && rawSupabaseData[idx - 1];
  return window.isRecordLocked(record);
});
if (isAnyLocked) {
  hideLoadingOverlay();
  alert('Dữ liệu đã nhập quá 24 giờ. Không thể xóa.');
  return;
}
```

- [ ] **Step 4: Commit Task 2**

```bash
git add assets/js/pl/pl-phieu-in.js
git commit -m "feat(pl-phieu-in): integrate 24h edit delete restriction"
```

---

### Task 3: Implement 24h Restriction in Remaining Phế liệu Modules (`pl-can-thu.js`, `pl-chua-thu.js`, `pl-da-thu.js`)

**Files:**
- Modify: `assets/js/pl/pl-can-thu.js`
- Modify: `assets/js/pl/pl-chua-thu.js`
- Modify: `assets/js/pl/pl-da-thu.js`

**Interfaces:**
- Consumes: `window.isRecordLocked(record)`

- [ ] **Step 1: Update selection handling and modal guards in `pl-can-thu.js`**

Add lock check on selected items to disable `btnEdit` and `btnDelete`. Add guard checks in `openEditModal`, `openDeleteModal`, `handleEditSubmit`, `confirmDelete`.

- [ ] **Step 2: Update selection handling and modal guards in `pl-chua-thu.js`**

Add lock check on selected items to disable `btnEdit` and `btnDelete`. Add guard checks in `openEditModal`, `openDeleteModal`, `handleEditSubmit`, `confirmDelete`.

- [ ] **Step 3: Update selection handling and modal guards in `pl-da-thu.js`**

Add lock check on selected items to disable `btnEdit` and `btnDelete`. Add guard checks in `openEditModal`, `openDeleteModal`, `handleEditSubmit`, `confirmDelete`.

- [ ] **Step 4: Commit Task 3**

```bash
git add assets/js/pl/pl-can-thu.js assets/js/pl/pl-chua-thu.js assets/js/pl/pl-da-thu.js
git commit -m "feat(pl): integrate 24h lock restriction across pl modules"
```

---

### Task 4: Implement 24h Restriction in Tôn Modules (`tole-nhap-supabase.js`, `tole-xuat-supabase.js`)

**Files:**
- Modify: `assets/js/tole/tole-nhap-supabase.js`
- Modify: `assets/js/tole/tole-xuat-supabase.js`

**Interfaces:**
- Consumes: `window.isRecordLocked(record)`

- [ ] **Step 1: Integrate 24h lock check into `tole-nhap-supabase.js`**

Add `isRecordLocked` check in row selection update, `openEditModal`, `openDeleteModal`, edit submit, and `confirmDelete`.

- [ ] **Step 2: Integrate 24h lock check into `tole-xuat-supabase.js`**

Add `isRecordLocked` check in row selection update, `openEditModal`, `openDeleteModal`, edit submit, and `confirmDelete`.

- [ ] **Step 3: Commit Task 4**

```bash
git add assets/js/tole/tole-nhap-supabase.js assets/js/tole/tole-xuat-supabase.js
git commit -m "feat(tole): integrate 24h lock restriction across tole modules"
```

---

### Task 5: Implement 24h Restriction in Xà gồ Modules (`xg-nhap-supabase.js`, `xg-xuat-supabase.js`)

**Files:**
- Modify: `assets/js/xg/xg-nhap-supabase.js`
- Modify: `assets/js/xg/xg-xuat-supabase.js`

**Interfaces:**
- Consumes: `window.isRecordLocked(record)`

- [ ] **Step 1: Integrate 24h lock check into `xg-nhap-supabase.js`**

Add `isRecordLocked` check in row selection update, `openEditModal`, `openDeleteModal`, edit submit, and `confirmDelete`.

- [ ] **Step 2: Integrate 24h lock check into `xg-xuat-supabase.js`**

Add `isRecordLocked` check in row selection update, `openEditModal`, `openDeleteModal`, edit submit, and `confirmDelete`.

- [ ] **Step 3: Commit Task 5**

```bash
git add assets/js/xg/xg-nhap-supabase.js assets/js/xg/xg-xuat-supabase.js
git commit -m "feat(xg): integrate 24h lock restriction across xg modules"
```

---

### Task 6: Final Verification & Smoke Testing

- [ ] **Step 1: Verify all modified files build without syntax errors**
- [ ] **Step 2: Confirm git status and commit final changes**

```bash
git status
```
