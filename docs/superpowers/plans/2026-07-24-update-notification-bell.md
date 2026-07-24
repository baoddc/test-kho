# Implementation Plan: Chuông Thông Báo Cập Nhật Phiên Bản Mới

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo biểu tượng Chuông Thông Báo 🔔 tự động kiểm tra và báo cho người dùng khi có phiên bản mới, hỗ trợ 1-click cập nhật ngay.

**Architecture:** Tạo `version.json` chứa thông tin phiên bản và module `assets/js/update-checker.js` để inject Chuông, Banner và Modal cập nhật vào giao diện web/app.

**Tech Stack:** JavaScript (ES6+), HTML5, CSS3 / Bootstrap 5 Modal & Toast.

## Global Constraints
- Đường dẫn file phiên bản: `version.json`
- Script đính kèm: `assets/js/update-checker.js`

---

### Task 1: Khởi tạo tệp cấu hình phiên bản `version.json`

**Files:**
- Create: `version.json`

**Interfaces:**
- Consumes: N/A
- Produces: JSON object với thuộc tính `version`, `releaseDate`, `changelog`

- [ ] **Step 1: Tạo file `version.json` ở gốc dự án**

```json
{
  "version": "1.0.1",
  "releaseDate": "2026-07-24",
  "changelog": [
    "Cập nhật tính năng Chuông thông báo phiên bản mới",
    "Tối ưu hóa hiệu năng nạp dữ liệu kho phôi"
  ]
}
```

---

### Task 2: Xây dựng module `assets/js/update-checker.js`

**Files:**
- Create: `assets/js/update-checker.js`

**Interfaces:**
- Consumes: `version.json`
- Produces: UI Notification Bell 🔔, Red Badge, Update Toast & Modal

- [ ] **Step 1: Viết mã JS cho update-checker.js**

Tạo script tự động inject CSS/HTML cho Chuông thông báo, fetch `version.json`, so sánh phiên bản và xử lý sự kiện nút "Cập nhật ngay" (`window.location.reload(true)`).

---

### Task 3: Đồng bộ và tích hợp vào các trang Web (`index.html`, `pages/`)

**Files:**
- Modify: `index.html`, `pages/home.html`
- Modify: `dist-app/main.js` (cấu hình load URL online / local fallback)

**Interfaces:**
- Consumes: `assets/js/update-checker.js`
- Produces: Chuông thông báo hiển thị mượt mà trên tất cả màn hình ứng dụng

- [ ] **Step 1: Nhúng `update-checker.js` vào `index.html` và `pages/home.html`**

Thêm thẻ `<script src="/assets/js/update-checker.js" defer></script>` vào trước thẻ đóng `</body>`.

- [ ] **Step 2: Cập nhật `dist-app/main.js` với chế độ ưu tiên nạp Web Online & Offline Fallback**

Cập nhật mã nguồn `dist-app/main.js` để tự động kiểm tra mạng và nạp từ Web host với fallback server local.
