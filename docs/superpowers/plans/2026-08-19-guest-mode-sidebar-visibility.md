# Guest Mode Sidebar Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị đầy đủ tất cả danh mục và trang trên thanh Sidebar khi ở chế độ Khách (chưa đăng nhập), ngoại trừ duy nhất trang `quan-ly-user.html`, đồng thời chặn mở tab và yêu cầu đăng nhập khi khách click vào các trang bảo mật.

**Architecture:** Tách biệt hàm kiểm tra hiển thị Sidebar `isSidebarItemVisible` và hàm kiểm tra quyền truy cập route `isPageAllowed`. `isSidebarItemVisible` cho phép hiển thị tất cả menu cho khách trừ `quan-ly-user.html`, trong khi `isPageAllowed` và `openTab` giữ nguyên quyền hạn để bảo vệ dữ liệu bảo mật và hiển thị modal đăng nhập khi khách nhấn vào trang bảo mật.

**Tech Stack:** JavaScript Vanilla, Bootstrap 5, Supabase, HTML/CSS.

## Global Constraints

- Chỉ hiển thị `QUẢN LÝ NGƯỜI DÙNG` (`quan-ly-user.html`) cho tài khoản `bao.lt`. Ẩn hoàn toàn khỏi sidebar đối với khách và user thường.
- Chế độ Khách thấy đầy đủ tất cả menu còn lại (5S, XÀ GỒ, TOLE, GRATING, PHẾ LIỆU, GIỚI THIỆU, CÔNG VIỆC).
- Khách click vào trang `PUBLIC_PAGES` mở bình thường. Khách click vào trang bảo mật kích hoạt `showAuthModal()`.
- Giữ tính toàn vẹn và đồng bộ giữa `assets/js/components/sidebar.js` và `dist-app/assets/js/sidebar.js`.

---

### Task 1: Cập nhật hàm lọc Sidebar Visibility trong `assets/js/components/sidebar.js`

**Files:**
- Modify: `assets/js/components/sidebar.js:260-650`

- [ ] **Step 1: Thêm hàm `isSidebarItemVisible` và cập nhật logic `buildSubSubGroup`, `buildSubGroup`, `buildSidebarNav`**

```javascript
  function isSidebarItemVisible(item) {
    if (!item) return false;
    const currentUser = localStorage.getItem('currentUser');
    const href = typeof item === 'string' ? item : item.href;
    const onlyAdmin = typeof item === 'object' ? !!item.onlyAdmin : false;
    const isQuanLyUser = (href && (href.endsWith('quan-ly-user.html') || href.includes('quan-ly-user')));

    // 1. Quản lý user / onlyAdmin: chỉ hiển thị cho duy nhất tài khoản bao.lt
    if (onlyAdmin || isQuanLyUser) {
      return currentUser === 'bao.lt';
    }

    // 2. Chế độ Khách (chưa đăng nhập): Hiển thị tất cả các mục khác
    if (!currentUser) {
      return true;
    }

    // 3. Tài khoản đã đăng nhập: kiểm tra theo quyền truy cập của user
    return isPageAllowed(href);
  }
```

- [ ] **Step 2: Cập nhật `buildSubSubGroup`, `buildSubGroup`, và `buildSidebarNav` dùng `isSidebarItemVisible` thay vì `isPageAllowed` cho việc render UI**

- [ ] **Step 3: Kiểm tra cú pháp JavaScript**

Run: `node -c assets/js/components/sidebar.js`
Expected: Không có lỗi cú pháp.

- [ ] **Step 4: Commit**

```bash
git add assets/js/components/sidebar.js
git commit -m "feat: show full sidebar in guest mode except quan-ly-user.html"
```

---

### Task 2: Đồng bộ sang `dist-app/assets/js/sidebar.js` & Hoàn thiện xử lý click trong `home.js`

**Files:**
- Modify: `dist-app/assets/js/sidebar.js`
- Modify: `assets/js/home.js`
- Modify: `dist-app/assets/js/home.js`

- [ ] **Step 1: Đồng bộ logic `isSidebarItemVisible` sang `dist-app/assets/js/sidebar.js`**
- [ ] **Step 2: Đảm bảo `home.js` và `dist-app/assets/js/home.js` hiển thị `showAuthModal()` mượt mà khi khách click vào các trang bảo mật**
- [ ] **Step 3: Kiểm tra cú pháp toàn bộ file JS đã sửa**

Run:
```powershell
node -c assets/js/components/sidebar.js; node -c dist-app/assets/js/sidebar.js; node -c assets/js/home.js; node -c dist-app/assets/js/home.js
```
Expected: Tất cả file đều hợp lệ (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add dist-app/assets/js/sidebar.js assets/js/home.js dist-app/assets/js/home.js
git commit -m "feat: sync guest mode sidebar visibility and auth modal handling"
```

---

### Task 3: Xác minh hoạt động trên trình duyệt

**Files:**
- Test: Trình duyệt mở `index.html`

- [ ] **Step 1: Kiểm tra chế độ khách (chưa đăng nhập)**:
  - Sidebar hiển thị đầy đủ: 5S, XÀ GỒ, TOLE, GRATING, PHẾ LIỆU, GIỚI THIỆU, CÔNG VIỆC.
  - Mục `QUẢN LÝ NGƯỜI DÙNG` không hiển thị.
  - Click `XÀ GỒ -> Tồn - XG`: Mở tab xem tồn kho bình thường.
  - Click `XÀ GỒ -> Nhập - XG` hoặc `5S -> HSE`: Hiện modal yêu cầu đăng nhập.
- [ ] **Step 2: Kiểm tra chế độ đăng nhập admin `bao.lt`**:
  - Sidebar hiển thị đầy đủ tất cả mục bao gồm cả `QUẢN LÝ NGƯỜI DÙNG`.
