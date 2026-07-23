# Design Document: Lock Edit/Delete Operations After 24 Hours

## 1. Overview & Objective
System requirement: Restrict users from editing or deleting data that was entered into the system more than 24 hours ago.
This policy applies strictly to all users (including Admin accounts) across all data management modules in the application (Phế liệu, Tôn, Xà gồ).

## 2. Requirements & Business Rules
1. **Timestamp Reference**: The 24-hour cutoff is calculated from the record creation timestamp stored in Supabase DB (`created_at`).
2. **Elapsed Time Threshold**: $\text{Elapsed Time} = \text{Current Time} - \text{Created At Time} > 24 \text{ hours}$ (i.e. $86,400,000\text{ ms}$).
3. **Strict Policy**: Applied uniformly across all users without exception.
4. **Scope**:
   - Phế liệu: `assets/js/pl/pl-phieu-in.js`, `assets/js/pl/pl-can-thu.js`, `assets/js/pl/pl-chua-thu.js`, `assets/js/pl/pl-da-thu.js`
   - Tôn: `assets/js/tole/tole-nhap-supabase.js`, `assets/js/tole/tole-xuat-supabase.js`
   - Xà gồ: `assets/js/xg/xg-nhap-supabase.js`, `assets/js/xg/xg-xuat-supabase.js`
5. **Fallback Handling**: If legacy data lacks a `created_at` timestamp, it is considered unlocked (editable/deletable) to prevent breaking historical records without creation timestamps.

## 3. System Architecture & Component Design

### 3.1 Centralized Utility Function (`assets/js/supabase-config.js`)
Expose a global helper function `isRecordLocked(record)`:

```javascript
/**
 * Checks if a Supabase data record is older than 24 hours from creation.
 * @param {Object} record - The raw record object from Supabase.
 * @returns {boolean} True if created > 24h ago, false otherwise.
 */
function isRecordLocked(record) {
  if (!record) return false;
  const createdAtStr = record.created_at || record.createdAt;
  if (!createdAtStr) return false;
  
  const createdTime = new Date(createdAtStr).getTime();
  if (isNaN(createdTime)) return false;
  
  const LOCK_DURATION_MS = 24 * 60 * 60 * 1000;
  return (Date.now() - createdTime) > LOCK_DURATION_MS;
}
```

### 3.2 UI Button State Integration
In each module's selection handler (when rows are selected/deselected via checkboxes or table row clicks):
- Evaluate all currently selected records using `isRecordLocked(record)`.
- If single row selected is locked:
  - Disable "Sửa" (Edit) button.
  - Disable "Xóa" (Delete) button and update button text/tooltip to indicate locked status.
- If multiple rows are selected:
  - Disable "Sửa" (Edit) button (multi-edit not supported).
  - Disable "Xóa" (Delete) button if **at least one** selected row is locked (> 24 hours old).

### 3.3 Function-level Guards (Defensive Programming)
- **Modal Opening Guards**: `openEditDataModal` / `openDeleteDataModal` / `openEditModal` check `isRecordLocked`. If locked, show alert `Dữ liệu này đã được nhập quá 24 giờ. Không thể sửa hoặc xóa.` and prevent opening modal.
- **Action Execution Guards**: `handleEditFormSubmit` / `confirmDelete` re-verify lock state before initiating Supabase DB `.update()` or `.delete()` queries.

## 4. Verification & Testing Plan
- Test creating a new record (< 24h old): Verify Edit and Delete buttons are enabled and operations succeed.
- Test mock record (> 24h old): Verify Edit and Delete buttons are disabled and programmatic attempts are blocked with alert message.
- Test multi-selection with mixed records (< 24h and > 24h): Verify Delete button is disabled.
- Code regression test: Verify existing filter, export, and search functionalities are unaffected.
