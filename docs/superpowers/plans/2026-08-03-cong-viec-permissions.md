# User-Based Visibility & Permissions in `cong-viec.html` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement user-based visibility and edit permission control in `pages/cong-viec.html` and `assets/js/cong-viec.js`, granting full access to `bao.lt` and restricting regular users to their own tasks.

**Architecture:** Filter task lists, KPI calculations, and reminder triggers by active user (`localStorage.getItem('currentUser')`). Restrict create/edit/delete/status action handlers for non-admin users. Expose a user creator filter dropdown for `bao.lt`.

**Tech Stack:** HTML5, JavaScript (ES6+), Supabase JS Client, LocalStorage fallback.

## Global Constraints

- User username resolved via `localStorage.getItem('currentUser')` || `'bao.lt'`.
- User `'bao.lt'` is the system administrator with full access to view, edit, delete, and manage all tasks.
- Non-admin users can ONLY see, edit, complete, reopen, or delete tasks where `task.user_created === currentUser`.
- KPI stats and real-time reminders must strictly reflect the visible task set.

---

### Task 1: Add Creator Filter UI Element to `pages/cong-viec.html`

**Files:**
- Modify: `pages/cong-viec.html:91-111`

**Interfaces:**
- Consumes: Existing filter group `.cv-filter-groups` in `pages/cong-viec.html`
- Produces: `<select id="filterUserCreated" class="cv-select" style="display: none;"></select>` element for admin filter control

- [ ] **Step 1: Inspect `.cv-filter-groups` in `pages/cong-viec.html`**

View `pages/cong-viec.html` lines 91-111 to verify exact location for `filterUserCreated`.

- [ ] **Step 2: Add `filterUserCreated` select element to `pages/cong-viec.html`**

Add `<select id="filterUserCreated" class="cv-select" style="display: none;"><option value="tat_ca">Tất cả người tạo</option></select>` right before `filterPriority` or inside `.cv-filter-groups`.

- [ ] **Step 3: Verify HTML structure**

Check that `filterUserCreated` element exists in `pages/cong-viec.html` with correct ID and classes.

---

### Task 2: Implement User Filtering & Permission Verification in `assets/js/cong-viec.js`

**Files:**
- Modify: `assets/js/cong-viec.js`

**Interfaces:**
- Consumes: `localStorage.getItem('currentUser')`, `allTasks`, `filterUserCreated`
- Produces: `getVisibleTasks()`, permission-guarded action functions (`handleEditTask`, `handleDeleteTask`, `handleMarkComplete`, `handleReopenTask`, `saveTaskToStorage`)

- [ ] **Step 1: Define `getActiveUser()` and `getVisibleTasks()` helpers**

Implement `getVisibleTasks()`:
```javascript
function getActiveUser() {
  return (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || 'bao.lt';
}

function isAdminUser() {
  return getActiveUser() === 'bao.lt';
}

function getVisibleTasks() {
  const activeUser = getActiveUser();
  if (isAdminUser()) {
    const selectedUser = document.getElementById('filterUserCreated')?.value || 'tat_ca';
    if (selectedUser !== 'tat_ca') {
      return allTasks.filter(t => t.user_created === selectedUser);
    }
    return allTasks;
  }
  return allTasks.filter(t => t.user_created === activeUser);
}
```

- [ ] **Step 2: Populate and show `filterUserCreated` dropdown for `bao.lt`**

In `renderTasks()` or initial load, if `isAdminUser()`, set `filterUserCreated.style.display = 'inline-block'`. Extract unique `user_created` values from `allTasks` and populate dropdown options, preserving selected value.

- [ ] **Step 3: Update `renderTasks()`, `updateStats()`, and `checkReminders()`**

Replace direct iteration over `allTasks` in `renderTasks()`, `updateStats()`, and `checkReminders()` with `getVisibleTasks()`.

- [ ] **Step 4: Add permission checks to action handlers**

In `handleEditTask(id)`, `handleDeleteTask(id)`, `handleMarkComplete(id)`, `handleReopenTask(id)`:
```javascript
function canManageTask(task) {
  if (!task) return false;
  return isAdminUser() || task.user_created === getActiveUser();
}
```
If `!canManageTask(task)`, alert "Bạn không có quyền thực hiện thao tác trên công việc này!" and abort action.

- [ ] **Step 5: Ensure `taskForm` submit assigns correct `user_created`**

When saving a new task, set `user_created = getActiveUser()`. When editing an existing task, preserve `existingTask.user_created`.

- [ ] **Step 6: Add event listener to `filterUserCreated`**

Add `filterUserCreated.addEventListener('change', renderTasks);`.

---

### Task 3: Sync Mirror Files & End-to-End Manual Verification

**Files:**
- Modify/Sync: `dist-app/assets/js/cong-viec.js` (if present)

- [ ] **Step 1: Check if `dist-app` mirror files exist and copy if needed**
- [ ] **Step 2: Perform manual verification for regular user vs `bao.lt`**
