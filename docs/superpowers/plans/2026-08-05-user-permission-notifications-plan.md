# User Permission Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically send targeted, private notifications to user notification bells whenever an admin (`bao.lt`) grants or revokes permissions in [quan-ly-user.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/quan-ly-user.html).

**Architecture:** Mở rộng cơ sở dữ liệu Supabase bằng cách thêm cột `target_user` vào bảng `system_announcements`. Trang quản lý user (`quan-ly-user.js`) sẽ tính toán sự thay đổi phân quyền (diff) và đẩy thông báo tới `target_user`. Script chuông thông báo (`update-checker.js`) sẽ lọc dữ liệu hiển thị riêng cho người dùng tương ứng.

**Tech Stack:** JavaScript (ES6+), Supabase JS Client, PostgreSQL SQL, Bootstrap 5.

## Global Constraints
- `target_user = NULL` hoặc `'*'`: Thông báo chung cho toàn hệ thống.
- `target_user = 'username'`: Thông báo riêng biệt duy nhất cho user `username`.
- Bảo toàn dữ liệu hiện có trong `system_announcements`.
- Đồng bộ mã nguồn giữa `assets/js/update-checker.js` và `dist-app/assets/js/update-checker.js`.

---

### Task 1: Tạo Script Database Migration trên Supabase

**Files:**
- Create: `docs/supabase/add_target_user_to_system_announcements.sql`

**Interfaces:**
- Produces: Cột `target_user TEXT DEFAULT NULL` và chỉ mục `idx_system_announcements_target_user` trên bảng `public.system_announcements`.

- [ ] **Step 1: Tạo file migration SQL**

```sql
-- Migration: Bổ sung cột target_user cho bảng system_announcements
ALTER TABLE public.system_announcements 
ADD COLUMN IF NOT EXISTS target_user TEXT DEFAULT NULL;

-- Tạo index tăng tốc truy vấn lọc thông báo theo người dùng
CREATE INDEX IF NOT EXISTS idx_system_announcements_target_user 
ON public.system_announcements (target_user);
```

- [ ] **Step 2: Commit file migration**

```bash
git add docs/supabase/add_target_user_to_system_announcements.sql
git commit -m "feat(db): add target_user migration script for system_announcements"
```

---

### Task 2: Tính toán Diff Phân quyền & Đẩy Thông báo trong `quan-ly-user.js`

**Files:**
- Modify: `assets/js/quan-ly-user.js:248-417`

**Interfaces:**
- Consumes: Hàm `openEditUserModal(userId)`, `handleSaveUser()`
- Produces: Bản ghi thông báo riêng cho user trong `system_announcements` với `target_user = username`.

- [ ] **Step 1: Lưu vị thế phân quyền ban đầu khi mở Modal sửa user**

Trong `openEditUserModal(userId)`, ghi nhớ trạng thái phân quyền ban đầu:

```javascript
window._editingUserOriginalPermissions = {
    allowedPages: [...allowedPagesList],
    groups: JSON.parse(JSON.stringify(groupsObj || {}))
};
```

- [ ] **Step 2: Xây dựng hàm so sánh Diff phân quyền**

Viết helper `computePermissionDiff(oldPerms, newPagesPayload)` để trả về object chứa thông tin chi tiết cấp thêm và thu hồi:

```javascript
function computePermissionDiff(username, oldPerms, newAllowedPagesPayload) {
    const isNewUser = !oldPerms;
    if (isNewUser) {
        return {
            hasChanges: true,
            title: '🎉 Tài khoản của bạn đã được khởi tạo',
            content: `Tài khoản ${username} đã được Admin khởi tạo và cấp quyền truy cập hệ thống.`,
            type: 'info'
        };
    }

    const oldPages = Array.isArray(oldPerms.allowedPages) ? oldPerms.allowedPages : [];
    const newPages = Array.isArray(newAllowedPagesPayload.pages) ? newAllowedPagesPayload.pages : [];
    
    const addedPages = newPages.filter(p => !oldPages.includes(p));
    const removedPages = oldPages.filter(p => !newPages.includes(p));

    const pageLabels = {
        '/pages/home.html': 'Trang chủ',
        '/pages/cong-viec.html': 'Quản lý Công việc',
        '/pages/quan-ly-user.html': 'Quản lý User',
        '/pages/about.html': 'Giới thiệu',
        '/pages/5s/quan-ly-5s.html': 'Quản lý 5S',
        '/pages/xg/xg-nhap-supabase.html': 'Xưởng Phôi - Nhập kho',
        '/pages/xg/xg-xuat-supabase.html': 'Xưởng Phôi - Xuất kho',
        '/pages/tole/tole-nhap-supabase.html': 'Xưởng Tole - Nhập kho',
        '/pages/tole/tole-xuat-supabase.html': 'Xưởng Tole - Xuất kho',
        '/pages/pl/pl-chua-thu.html': 'Phân Loại - Phôi Chưa Thu',
        '/pages/pl/pl-da-thu.html': 'Phân Loại - Phôi Đã Thu',
        '/pages/pl/pl-can-thu.html': 'Phân Loại - Phôi Cần Thu'
    };

    let addedTextList = addedPages.map(p => pageLabels[p] || p);
    let removedTextList = removedPages.map(p => pageLabels[p] || p);

    if (addedTextList.length === 0 && removedTextList.length === 0) {
        return { hasChanges: false };
    }

    let summaryParts = [];
    if (addedTextList.length > 0) {
        summaryParts.push(`➕ Được cấp thêm quyền truy cập trang: ${addedTextList.join(', ')}`);
    }
    if (removedTextList.length > 0) {
        summaryParts.push(`➖ Bị thu hồi quyền truy cập trang: ${removedTextList.join(', ')}`);
    }

    const isWarning = removedTextList.length > 0 && addedTextList.length === 0;

    return {
        hasChanges: true,
        title: isWarning ? '⚠️ Thu hồi quyền truy cập' : '📢 Cập nhật quyền truy cập tài khoản',
        content: `Phân quyền tài khoản của bạn vừa được Quản trị viên cập nhật:\n` + summaryParts.join('\n'),
        type: isWarning ? 'warning' : 'info'
    };
}
```

- [ ] **Step 3: Gửi thông báo tới Supabase khi lưu user thành công**

Trong `handleSaveUser()`, sau khi RPC `admin_save_user` thành công, thực hiện:

```javascript
const diff = computePermissionDiff(username, window._editingUserOriginalPermissions, allowedPagesPayload);
if (diff.hasChanges && window.supabase) {
    await window.supabase.from('system_announcements').insert([{
        title: diff.title,
        content: diff.content,
        type: diff.type,
        target_user: username,
        created_by: 'bao.lt',
        is_active: true
    }]);
}
window._editingUserOriginalPermissions = null;
```

- [ ] **Step 4: Verify & Commit**

```bash
git add assets/js/quan-ly-user.js
git commit -m "feat(user-mgmt): notify target user when permissions change"
```

---

### Task 3: Lọc Thông Báo Cá Nhân trong `update-checker.js` & `dist-app/assets/js/update-checker.js`

**Files:**
- Modify: `assets/js/update-checker.js:319-358`
- Modify: `dist-app/assets/js/update-checker.js:319-358`

**Interfaces:**
- Consumes: Supabase table `system_announcements`, `localStorage.getItem('currentUser')`
- Produces: Danh sách `activeAnnouncements` được lọc chuẩn xác cho `currentUser`.

- [ ] **Step 1: Cập nhật hàm `fetchAnnouncements()` trong `assets/js/update-checker.js`**

Cập nhật logic query Supabase:

```javascript
async function fetchAnnouncements() {
  try {
    const client = await ensureSupabaseClient();
    if (!client || typeof client.from !== 'function') return [];

    const currentUser = localStorage.getItem('currentUser');
    const isAdmin = currentUser === 'bao.lt';

    let query = client.from('system_announcements').select('*').order('created_at', { ascending: false });
    if (!isAdmin) {
      query = query.eq('is_active', true);
      if (currentUser) {
        query = query.or(`target_user.is.null,target_user.eq.*,target_user.eq.${currentUser}`);
      } else {
        query = query.or(`target_user.is.null,target_user.eq.*`);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Failed to fetch announcements:', error);
      return [];
    }

    const now = new Date();
    const valid = (data || []).filter(item => {
      if (!isAdmin && !item.is_active) return false;
      if (item.expires_at && new Date(item.expires_at) <= now) return false;
      return true;
    });

    activeAnnouncements = valid;

    const readIds = getReadAnnouncementIds();
    const unreadList = activeAnnouncements.filter(a => a.is_active && !readIds.includes(a.id));

    const hasAppUpdate = latestVersionData && compareVersions(latestVersionData.version, CURRENT_VERSION) > 0;
    updateBellUI(unreadList.length > 0 || hasAppUpdate);

    if (unreadList.length > 0 && !isToastShown) {
      showAnnouncementToast(unreadList[0]);
    }

    return activeAnnouncements;
  } catch (e) {
    console.warn('Error in fetchAnnouncements:', e);
    return [];
  }
}
```

- [ ] **Step 2: Đồng bộ sang `dist-app/assets/js/update-checker.js`**

Áp dụng cùng đoạn mã cập nhật hàm `fetchAnnouncements()` cho `dist-app/assets/js/update-checker.js`.

- [ ] **Step 3: Commit**

```bash
git add assets/js/update-checker.js dist-app/assets/js/update-checker.js
git commit -m "feat(notifications): filter personal targeted announcements for current user"
```
