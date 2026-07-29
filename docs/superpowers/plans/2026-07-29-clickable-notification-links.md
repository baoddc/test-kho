# Clickable Notification Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai tự động phát hiện và chuyển đổi các liên kết URL trong thông báo hệ thống thành đường link có thể click truy cập trực tiếp trên tab trình duyệt mới.

**Architecture:** Thêm hàm `formatNotificationText(rawText)` vào `assets/js/update-checker.js` để mã hóa HTML an toàn chống XSS, sau đó sử dụng Regex chuyển các chuỗi URL (`http://`, `https://`, `www.`) thành thẻ `<a href="..." target="_blank" rel="noopener noreferrer" class="announcement-link">...</a>`. Cập nhật các vị trí hiển thị trong Toast Notification và Modal tab của người dùng & Admin, sau đó đồng bộ sang `dist-app/assets/js/update-checker.js`.

**Tech Stack:** JavaScript (Vanilla), HTML5, CSS3.

## Global Constraints

- Chống lỗ hổng XSS bằng cách mã hóa các ký tự đặc biệt HTML trước khi parse URL.
- Link mở ra tab mới với `target="_blank"` và `rel="noopener noreferrer"`.
- Ngăn chặn nổi bọt sự kiện (`event.stopPropagation()`) khi click vào link trên Toast để không gây lỗi xung đột với sự kiện click Toast hay Modal.
- Đảm bảo đồng bộ giữa `assets/js/update-checker.js` và `dist-app/assets/js/update-checker.js`.

---

### Task 1: Thêm hàm `formatNotificationText` và bổ sung CSS `.announcement-link`

**Files:**
- Modify: `assets/js/update-checker.js`

**Interfaces:**
- Produces: `formatNotificationText(rawText)` (Hàm chuyển đổi văn bản chứa URL thành HTML có thẻ `<a>`)

- [ ] **Step 1: Định nghĩa hàm `formatNotificationText` trong `assets/js/update-checker.js`**

Chèn hàm `formatNotificationText` vào module `update-checker.js`:

```javascript
function formatNotificationText(rawText) {
  if (!rawText) return '';
  // 1. Sanitize HTML special characters to prevent XSS
  const escaped = String(rawText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // 2. Regex replace URLs (http, https, www) with <a> tags
  const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  return escaped.replace(urlRegex, (match) => {
    const href = match.toLowerCase().startsWith('www.') ? `https://${match}` : match;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="announcement-link" onclick="event.stopPropagation();">${match}</a>`;
  });
}
```

- [ ] **Step 2: Thêm kiểu dáng CSS cho `.announcement-link` trong `injectStyles()`**

Trong hàm `injectStyles()` của `assets/js/update-checker.js`, bổ sung CSS:

```css
.announcement-link {
  color: #38bdf8 !important;
  text-decoration: underline !important;
  word-break: break-all !important;
  font-weight: 500;
  transition: color 0.2s ease;
}
.announcement-link:hover {
  color: #7dd3fc !important;
  text-decoration: underline !important;
}
```

- [ ] **Step 3: Check syntax & Commit Task 1**

```bash
git add assets/js/update-checker.js
git commit -m "feat: add formatNotificationText helper and announcement-link styles"
```

---

### Task 2: Áp dụng `formatNotificationText` vào Toast & Modal và đồng bộ `dist-app`

**Files:**
- Modify: `assets/js/update-checker.js`
- Modify: `dist-app/assets/js/update-checker.js`

**Interfaces:**
- Consumes: `formatNotificationText(rawText)` từ Task 1.

- [ ] **Step 1: Cập nhật Toast Notification (`showAnnouncementToast`)**

Trong `showAnnouncementToast(announcement)` của `assets/js/update-checker.js`, thay thế:
```javascript
<div class="update-toast-body">${announcement.content}</div>
```
bằng:
```javascript
<div class="update-toast-body">${formatNotificationText(announcement.content)}</div>
```

- [ ] **Step 2: Cập nhật User Modal Tab (`renderUserTabHTML`)**

Trong `renderUserTabHTML` của `assets/js/update-checker.js`, thay thế:
```javascript
<div style="font-size: 0.83rem; color: #94a3b8; line-height: 1.5; white-space: pre-wrap;">${item.content}</div>
```
bằng:
```javascript
<div style="font-size: 0.83rem; color: #94a3b8; line-height: 1.5; white-space: pre-wrap;">${formatNotificationText(item.content)}</div>
```

- [ ] **Step 3: Cập nhật Admin Modal Tab (`renderAdminTabHTML`)**

Trong `renderAdminTabHTML` của `assets/js/update-checker.js`, thay thế:
```javascript
<div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.35rem; white-space: pre-wrap;">${item.content}</div>
```
bằng:
```javascript
<div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.35rem; white-space: pre-wrap;">${formatNotificationText(item.content)}</div>
```

- [ ] **Step 4: Đồng bộ nội dung sang `dist-app/assets/js/update-checker.js`**

Sao chép toàn bộ nội dung từ `assets/js/update-checker.js` sang `dist-app/assets/js/update-checker.js`.

- [ ] **Step 5: Commit Task 2**

```bash
git add assets/js/update-checker.js dist-app/assets/js/update-checker.js
git commit -m "feat: render clickable links in notification toast and modal views"
```

---

### Task 3: Kiểm thử thủ công và xác minh tính năng (Verification)

**Files:**
- Test: Trình duyệt / Node syntax check.

- [ ] **Step 1: Kiểm tra cú pháp JS của 2 file**

Chạy kiểm tra cú pháp với node:
`node -c assets/js/update-checker.js`
`node -c dist-app/assets/js/update-checker.js`

- [ ] **Step 2: Kiểm tra chức năng parse link bằng Node script tạm thời**

Tạo file test nhanh kiểm tra:
- `http://google.com` ➔ Thẻ link chứa `href="http://google.com"`
- `www.facebook.com` ➔ Thẻ link chứa `href="https://www.facebook.com"`
- Thẻ XSS `<script>alert(1)</script>` ➔ Escaped thành `&lt;script&gt;alert(1)&lt;/script&gt;`

- [ ] **Step 3: Commit hoàn tất**

```bash
git commit -m "test: verify clickable links and XSS sanitization in update-checker" --allow-empty
```
