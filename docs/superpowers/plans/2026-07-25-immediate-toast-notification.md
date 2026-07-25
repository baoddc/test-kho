# Immediate Toast Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị Toast Popup thông báo ngay lập tức (0ms delay) ở góc màn hình khi vừa truy cập ứng dụng.

**Architecture:** Bỏ khoảng chờ 1.5s (`setTimeout(checkUpdate, 1500)`) trong `init()` của `update-checker.js`. Thực hiện `checkUpdate()` trực tiếp ngay khi trang/ứng dụng nạp xong.

**Tech Stack:** Vanilla JavaScript, HTML5, Supabase Client.

## Global Constraints

- Không làm gián đoạn chu kỳ polling 5 phút định kỳ.
- Đồng bộ mã nguồn giữa `assets/js/update-checker.js` và `dist-app/assets/js/update-checker.js`.

---

### Task 1: Update `assets/js/update-checker.js` for immediate execution

**Files:**
- Modify: `assets/js/update-checker.js:942-955`

**Interfaces:**
- Consumes: `checkUpdate()`
- Produces: Immediate execution of `checkUpdate()` on load

- [ ] **Step 1: Modify `init()` in `assets/js/update-checker.js`**

Trong `assets/js/update-checker.js`, thay thế:
```javascript
  function init() {
    injectStyles();
    bindBellEventListener();
    setInterval(bindBellEventListener, 1000);

    setTimeout(checkUpdate, 1500);
    setInterval(checkUpdate, CHECK_INTERVAL_MS);
  }
```
thành:
```javascript
  function init() {
    injectStyles();
    bindBellEventListener();
    setInterval(bindBellEventListener, 1000);

    checkUpdate();
    setInterval(checkUpdate, CHECK_INTERVAL_MS);
  }
```

- [ ] **Step 2: Commit Task 1 changes**

```bash
git add assets/js/update-checker.js
git commit -m "feat: trigger update and announcement check immediately on init"
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
git commit -m "chore: sync update-checker.js to dist-app"
```
