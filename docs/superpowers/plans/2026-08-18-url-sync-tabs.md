# Kế Hoạch Triển Khai: Đồng Bộ URL & Điều Hướng Đa Tab (HTML5 History API)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị đường dẫn (URL) thực tế của các trang tab con trên thanh địa chỉ trình duyệt khi mở/chuyển tab; hỗ trợ các nút Back/Forward của trình duyệt và hỗ trợ F5 reload / direct URL access vào đúng tab bên trong shell.

**Architecture:** Sử dụng HTML5 History API (`window.history.pushState`, `replaceState`, sự kiện `popstate`) trong `assets/js/components/sidebar.js`. Khi mở hoặc chuyển tab, URL cha được cập nhật theo đường dẫn của iframe. Trang con khi truy cập trực tiếp ở tầng ngoài cùng sẽ tự động chuyển tiếp vào shell `home.html` và mở sẵn tab tương ứng.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5 History API, CSS3, iframe DOM events.

## Global Constraints
- Không làm gián đoạn các tính năng hiện có: theme dark/light, realtime permission checker, PWA, kéo thả sắp xếp tab.
- Đảm bảo đường dẫn hiển thị sạch, đẹp, không phát sinh lỗi 404 khi người dùng refresh hoặc chia sẻ link.
- Đồng bộ cả file nguồn `assets/js/components/sidebar.js` và bản build `dist-app/assets/js/sidebar.js` (nếu có).

---

### Task 1: Nâng cấp hàm switchTab, openTab, closeTab với History API

**Files:**
- Modify: `assets/js/components/sidebar.js`

**Interfaces:**
- `switchTab(tabId, updateHistory = true)`: Cập nhật active tab, document.title, sidebar active state và `window.history.pushState()`.
- `openTab(url, title, updateHistory = true)`: Khởi tạo iframe, lắng nghe URL/Title từ iframe và gọi `switchTab()`.
- `closeTab(tabId)`: Đóng tab và chuyển URL về tab liền kề hoặc tab-home.

- [ ] **Step 1: Cập nhật logic `switchTab` trong `sidebar.js`**
  Thêm tham số `updateHistory`, cập nhật `document.title` động và gọi `history.pushState` tương ứng với URL của tab mục tiêu.
- [ ] **Step 2: Cập nhật logic `openTab` trong `sidebar.js`**
  Thêm đồng bộ URL và tiêu đề từ iframe sang shell cha khi iframe load trang mới.
- [ ] **Step 3: Cập nhật logic `closeTab` trong `sidebar.js`**
  Đảm bảo khi đóng tab đang active, URL thanh địa chỉ chuyển mượt về tab trước đó.

---

### Task 2: Thêm bộ lắng nghe sự kiện `popstate` cho nút Back / Forward

**Files:**
- Modify: `assets/js/components/sidebar.js`

- [ ] **Step 1: Khai báo hàm `initHistoryPopstateListener()` trong `sidebar.js`**
  Lắng nghe sự kiện `window.addEventListener('popstate', (e) => { ... })`.
- [ ] **Step 2: Xử lý kích hoạt lại tab khi người dùng bấm nút Back/Forward**
  Nếu tab còn mở thì `switchTab(tabId, false)`, nếu tab đã đóng thì `openTab(url, title, false)`.

---

### Task 3: Xử lý Deep Linking & F5 Reload (Bảo toàn Shell đa tab)

**Files:**
- Modify: `assets/js/components/sidebar.js`

- [ ] **Step 1: Thêm cơ chế tự động chuyển tiếp vào Shell khi truy cập trực tiếp trang con**
  Kiểm tra nếu `!isIframe` và URL là trang con trong `/pages/` (khác `home.html`, `index.html`), chuyển hướng `window.location.replace('/pages/home.html?openTab=' + encodeURIComponent(targetUrl))`.
- [ ] **Step 2: Thêm logic tự động mở tab từ query parameter `?openTab=...` khi Shell `home.html` khởi chạy**
  Đọc `openTab` từ URL params, tìm tiêu đề tương ứng từ danh mục menu hoặc đường dẫn, tự động mở tab và thay thế URL hiển thị bằng `history.replaceState`.

---

### Task 4: Đồng bộ bản phân phối và Kiểm thử toàn diện

**Files:**
- Modify: `dist-app/assets/js/sidebar.js` (đồng bộ từ `assets/js/components/sidebar.js`)

- [ ] **Step 1: Đồng bộ mã nguồn sang `dist-app/assets/js/sidebar.js`**
- [ ] **Step 2: Chạy server kiểm thử và xác minh các luồng:**
  1. Mở menu -> URL đổi thành URL trang con và tiêu đề tab trình duyệt đổi.
  2. Chuyển đổi giữa các tab -> URL đổi tương ứng.
  3. Bấm Back / Forward trình duyệt -> Di chuyển qua lại đúng các tab.
  4. F5 tải lại trang -> Vẫn giữ nguyên Shell với tab con đang mở và URL sạch.
  5. Đóng tab -> URL cập nhật về tab liền trước.
