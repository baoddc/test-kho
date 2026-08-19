# Design Document: Hiển thị đầy đủ thanh Sidebar ở chế độ Khách (Guest Mode)

**Date**: 2026-08-19  
**Author**: AI Assistant & bao.lt  
**Status**: Approved  

---

## 1. Mục tiêu & Tổng quan

Hệ thống cho phép hiển thị **đầy đủ tất cả các danh mục và trang** trên thanh Sidebar khi người dùng ở **chế độ Khách (chưa đăng nhập)**, **ngoại trừ duy nhất trang `quan-ly-user.html` (Quản lý Người dùng)**.

Khi người dùng ở chế độ Khách:
1. **Sidebar Visibility**: Hiển thị đầy đủ toàn bộ menu và submenu của các nhóm (5S, XÀ GỒ, TOLE, GRATING, PHẾ LIỆU, GIỚI THIỆU, CÔNG VIỆC). Riêng `QUẢN LÝ NGƯỜI DÙNG` (`pages/quan-ly-user.html`) bị ẩn hoàn toàn.
2. **Action Intercept (Option 2)**:
   - Các trang thuộc `PUBLIC_PAGES` (như `home.html`, `about.html`, `flower.html`, `xg-ton.html`, `tole-ton.html`): Khách click vào sẽ mở tab xem bình thường.
   - Các trang bảo mật còn lại (như `xg-nhap.html`, `xg-xuat.html`, `tole-nhap.html`, `tole-xuat.html`, các trang `pl-*.html`, `5s-*.html`, `cong-viec.html`): Khi Khách click trên thanh Sidebar, hệ thống sẽ kích hoạt modal yêu cầu đăng nhập (`showAuthModal()`) mà không mở tab.
3. **Đối với tài khoản đã đăng nhập**:
   - Tài khoản Admin (`bao.lt`): Thấy đầy đủ tất cả menu bao gồm `QUẢN LÝ NGƯỜI DÙNG`.
   - Các tài khoản người dùng khác: Sidebar hiển thị theo đúng phân quyền đã được cấu hình trong `userAllowedPages` và `userGroupPermissions`.
4. **Bảo mật trực tiếp (Direct URL / Iframe Guard)**:
   - Nếu Khách hoặc tài khoản không có quyền cố tình mở trực tiếp URL của `quan-ly-user.html` hoặc các trang bảo mật, hệ thống sẽ chặn và chuyển hướng về trang đăng nhập / trang chủ.

---

## 2. Chi tiết Thiết kế Kỹ thuật

### 2.1 Cập nhật Logic Xây dựng Sidebar (`sidebar.js`)

Hiện tại, trong các hàm:
- `buildSidebarNav()`
- `buildSubGroup()`
- `buildSubSubGroup()`

Đang dùng `isPageAllowed(href)` để lọc bỏ các mục không được phép. Khi `!currentUser`, `isPageAllowed(href)` trả về `false` đối với các trang không nằm trong `PUBLIC_PAGES`, dẫn đến các menu bị ẩn.

**Giải pháp**:
Tách biệt giữa **Quyền hiển thị trên Sidebar (Sidebar Item Visibility)** và **Quyền truy cập trực tiếp / Mở tab (Route Permission & Tab Opening)**:

1. **Hàm kiểm tra hiển thị Sidebar: `isSidebarItemVisible(itemOrHref, onlyAdmin)`**:
   - Nếu `onlyAdmin === true` hoặc đường dẫn là `quan-ly-user.html`: Chỉ hiển thị khi `currentUser === 'bao.lt'`.
   - Nếu là Khách (`!currentUser`): **Luôn trả về `true`** cho tất cả các menu khác (để Khách thấy đầy đủ Sidebar).
   - Nếu là User đã đăng nhập (`currentUser !== 'bao.lt'`): Gọi `isPageAllowed(href)` để chỉ hiển thị các trang được phân quyền.

2. **Hàm kiểm tra quyền truy cập: `isPageAllowed(href)`**:
   - `quan-ly-user.html`: Chỉ cho phép `currentUser === 'bao.lt'`.
   - Các trang `PUBLIC_PAGES`: Cho phép tất cả.
   - Các trang bảo mật khác: Chỉ cho phép khi có `currentUser` và thoả mãn `allowedPages` / `groupPerms`. Nếu `!currentUser` -> trả về `false`.

3. **Hàm mở Tab: `openTab(url, title)`**:
   - Khi click vào bất kỳ item nào, `openTab` kiểm tra `isPageAllowed(url)`.
   - Nếu `!isPageAllowed(url)` và `!currentUser`: Gọi `showAuthModal()` để hiển thị thông báo yêu cầu đăng nhập.
   - Nếu `!isPageAllowed(url)` và `currentUser` (đã đăng nhập nhưng không có quyền): Gọi `showAccessDeniedModal()`.

### 2.2 Đồng bộ trên `assets/js/home.js`

Trong `home.js`:
- Đảm bảo `showAuthModal()` hiển thị giao diện thông báo đăng nhập đẹp mắt, hỗ trợ nút "Đăng nhập ngay" chuyển về `pages/index.html` hoặc mở modal đăng nhập.
- Logic kiểm tra sự kiện click và `openTab` phối hợp nhịp nhàng, không gây xung đột double-alert.

### 2.3 Đồng bộ các tệp nguồn
Cần cập nhật đồng thời cả 2 vị trí:
1. `assets/js/components/sidebar.js` & `dist-app/assets/js/sidebar.js`
2. `assets/js/home.js` & `dist-app/assets/js/home.js` (nếu cần thiết)

---

## 3. Kịch bản Kiểm thử & Xác minh

1. **Chế độ Khách (Chưa đăng nhập - `localStorage.removeItem('currentUser')`)**:
   - Tải lại trang chủ (`index.html`).
   - Kiểm tra thanh Sidebar:
     - Thấy đầy đủ các mục: **5S** (3 mục con), **XÀ GỒ** (4 mục con), **TOLE** (4 mục con), **GRATING**, **PHẾ LIỆU** (đầy đủ mục cấp 2 và cấp 3), **GIỚI THIỆU**, **CÔNG VIỆC & NHẮC HẸN**.
     - **KHÔNG** thấy mục **QUẢN LÝ NGƯỜI DÙNG** (`quan-ly-user.html`).
   - Click vào trang công khai (vd: `XÀ GỒ -> Tồn - XG` hoặc `GIỚI THIỆU`): Mở tab bình thường.
   - Click vào trang bảo mật (vd: `5S -> HSE` hoặc `XÀ GỒ -> Nhập - XG` hoặc `PHẾ LIỆU -> Cần thu`): Hiện popup `Yêu cầu đăng nhập` (`showAuthModal`), không mở trang.
   - Mở URL trực tiếp `/pages/quan-ly-user.html`: Bị chặn truy cập và chuyển hướng về đăng nhập/trang chủ.

2. **Chế độ Đăng nhập với User thường (vd: được cấp quyền 5S & XÀ GỒ)**:
   - Sidebar chỉ hiển thị các nhóm được cấp quyền (5S, XÀ GỒ, Giới thiệu...), ẩn TOLE, PHẾ LIỆU và QUẢN LÝ NGƯỜI DÙNG.
   - Click vào 5S / XÀ GỒ mở tab bình thường.

3. **Chế độ Đăng nhập Admin (`bao.lt`)**:
   - Thấy đầy đủ tất cả menu bao gồm cả **QUẢN LÝ NGƯỜI DÙNG** (`quan-ly-user.html`).
   - Mở được mọi trang.
