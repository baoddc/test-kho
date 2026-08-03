# Design Document: User-Based Visibility & Permissions in `cong-viec.html`

## 1. Overview
Currently, the Task & Reminder Management module (`pages/cong-viec.html`, `assets/js/cong-viec.js`) displays all tasks from Supabase / LocalStorage to any logged-in user, and allows any user to perform edit, complete, reopen, or delete actions on any task.

This design introduces strict User-Based Visibility & Edit Permission Controls:
- **Regular Users**: Can only view, manage (edit/complete/reopen/delete), and receive reminders for tasks created by themselves (`task.user_created === currentUser`).
- **Admin User (`bao.lt`)**: Has full access to view, edit, delete, complete, reopen, filter by creator, and manage all tasks across the system.

## 2. Architecture & Data Flow

### 2.1 User Identification
User session is resolved dynamically via `localStorage.getItem('currentUser')`:
- Admin check: `const isAdmin = getActiveUser() === 'bao.lt';`
- Current user username: `const activeUser = getActiveUser();`

### 2.2 Data Filtering & Visibility Rules
1. **`renderTasks()`**:
   - Filter `allTasks` by user visibility before applying search/status/priority filters:
     - If `isAdmin` (user `bao.lt`): include all tasks (or filter by selected creator if creator filter dropdown is used).
     - If non-admin: filter `allTasks` to only tasks where `task.user_created === activeUser`.
2. **`updateStats()`**:
   - Calculate KPIs (Total, Today's tasks, Overdue, Completed) strictly based on the visible task set for the active user.
3. **`checkReminders()` Engine**:
   - Only evaluate reminder triggers for tasks visible to the active user (i.e. non-admins won't get popups or audio chimes for other users' tasks).
4. **Creator Filter Bar Dropdown for Admin**:
   - For `bao.lt`, dynamically populate a creator filter dropdown (`filterUserCreated`) listing all distinct creators present in tasks.
   - For non-admin users, hide this dropdown.

### 2.3 Permission Verification for Actions
1. **Modal Form (Create / Edit)**:
   - When creating: `task.user_created` is set to `getActiveUser()`.
   - When editing: verify permission (`isAdmin || task.user_created === activeUser`). If permission denied, alert and abort.
2. **Status Changes & Deletion**:
   - `handleMarkComplete(id)`: verify permission before updating status.
   - `handleReopenTask(id)`: verify permission before reopening task.
   - `handleDeleteTask(id)`: verify permission before deleting task.

## 3. File Modifications

### 3.1 [MODIFY] [cong-viec.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/cong-viec.html)
- Add a user creator filter dropdown `<select id="filterUserCreated" class="cv-select" style="display: none;"></select>` in `.cv-filter-groups` for Admin (`bao.lt`).

### 3.2 [MODIFY] [cong-viec.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/cong-viec.js)
- Implement user-based filtering logic in `getVisibleTasks()`.
- Update `renderTasks()`, `updateStats()`, and `checkReminders()` to use `getVisibleTasks()`.
- Populate and handle `filterUserCreated` for `bao.lt`.
- Enforce action level permissions in `handleEditTask`, `handleDeleteTask`, `handleMarkComplete`, `handleReopenTask`, and form submission.

### 3.3 [MODIFY] [dist-app assets / synced files if applicable]
- Copy/sync changes if `dist-app` or other target directories require mirrored assets.

## 4. Verification Plan

### Automated / Manual Testing
1. **Test Regular User Visibility**:
   - Set `localStorage.setItem('currentUser', 'user.test1')`.
   - Create a task T1.
   - Verify T1 appears in table and KPI stats count = 1.
   - Set `localStorage.setItem('currentUser', 'user.test2')`.
   - Reload page and verify T1 is hidden, table empty / empty state shown, KPI count = 0.
2. **Test Admin Visibility (`bao.lt`)**:
   - Set `localStorage.setItem('currentUser', 'bao.lt')`.
   - Verify both T1 and other users' tasks are displayed.
   - Verify creator filter dropdown appears and filters tasks by creator correctly.
3. **Test Permission Enforcement**:
   - Test editing, deleting, completing tasks as creator vs as non-creator.
