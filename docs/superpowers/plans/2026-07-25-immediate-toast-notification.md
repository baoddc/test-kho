# Immediate & Realtime Toast Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị Toast Popup thông báo ngay lập tức (0ms delay) khi vừa nạp trang web/app và đẩy thông báo tức thì (Realtime) khi Admin tạo thông báo mới.

**Architecture:** Bỏ khoảng chờ 1.5s (`setTimeout(checkUpdate, 1500)`) trong `init()`. Đăng ký Supabase Realtime channel lắng nghe sự kiện trên bảng `system_announcements` để đẩy Toast thông báo tức thì tới tất cả người dùng đang online.

**Tech Stack:** Vanilla JavaScript, HTML5, Supabase JS SDK (Realtime Postgres Changes).

## Global Constraints

- Hỗ trợ cả Web và Desktop Executable (`dist-app/`).
- Không ảnh hưởng tới cơ chế đánh dấu đã đọc (`read_announcements` trong `localStorage`).

---

### Task 1: Add Realtime Subscription & Instant Load to `assets/js/update-checker.js`

**Files:**
- Modify: `assets/js/update-checker.js`

**Interfaces:**
- Consumes: Supabase Realtime JS SDK (`client.channel()`)
- Produces: Realtime updates for system announcements

- [ ] **Step 1: Implement `subscribeToRealtimeAnnouncements()` in `assets/js/update-checker.js`**

Thêm hàm đăng ký Realtime channel:
```javascript
  async function subscribeToRealtimeAnnouncements() {
    try {
      const client = await ensureSupabaseClient();
      if (!client || typeof client.channel !== 'function') return;

      client.channel('public:system_announcements')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'system_announcements' }, () => {
          isToastShown = false;
          fetchAnnouncements();
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  }
```

Và gọi `subscribeToRealtimeAnnouncements()` trong hàm `init()`:
```javascript
  function init() {
    injectStyles();
    bindBellEventListener();
    setInterval(bindBellEventListener, 1000);

    checkUpdate();
    subscribeToRealtimeAnnouncements();
    setInterval(checkUpdate, CHECK_INTERVAL_MS);
  }
```

- [ ] **Step 2: Commit Task 1 changes**

```bash
git add assets/js/update-checker.js
git commit -m "feat: add Supabase Realtime subscription for system announcements"
```

---

### Task 2: Sync changes to `dist-app/assets/js/update-checker.js`

**Files:**
- Modify: `dist-app/assets/js/update-checker.js`

**Interfaces:**
- Consumes: `assets/js/update-checker.js`
- Produces: Identical `dist-app/assets/js/update-checker.js`

- [ ] **Step 1: Copy `assets/js/update-checker.js` to `dist-app/assets/js/update-checker.js`**

Copy nội dung từ `assets/js/update-checker.js` sang `dist-app/assets/js/update-checker.js`.

- [ ] **Step 2: Commit Task 2 changes**

```bash
git add dist-app/assets/js/update-checker.js
git commit -m "chore: sync Realtime update-checker.js to dist-app"
```
