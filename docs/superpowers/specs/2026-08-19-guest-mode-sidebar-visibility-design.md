# Design Document: Guest Mode Full Sidebar Visibility (Except User Management)

**Date**: 2026-08-19  
**Author**: AI Assistant & bao.lt  
**Status**: Approved  

---

## 1. Overview & Objective

Hiện tại, khi người dùng ở chế độ Khách (chưa đăng nhập / `!currentUser`), hàm `isPageAllowed()` trong thanh Sidebar tự động trả về `false` đối với tất cả các trang không thuộc danh sách `PUBLIC_PAGES`. Điều này dẫn đến việc thanh Sidebar bị ẩn hầu hết các mục menu (5S, XÀ GỒ, TOLE, PHẾ LIỆU, CÔNG VIỆC).

**Mục tiêu:**
- Khi ở chế độ Khách, thanh Sidebar hiển thị đầy đủ tất cả các danh mục và trang chức năng (5S, XÀ GỒ, TOLE, PHẾ LIỆU, GRATING, GIỚI THIỆU, CÔNG VIỆC & NHẮC HẸN...).
- Ẩn duy nhất trang **Quản lý người dùng (`quan-ly-user.html`)** đối với chế độ Khách (trang này chỉ dành riêng cho Admin `bao.lt`).
- Người dùng ở chế độ Khách có thể mở và xem nội dung các trang bình thường (các thao tác ghi dữ liệu như Thêm/Sửa/Xóa đã có phân quyền bảo vệ nội bộ trong từng trang).
- Giữ nguyên cơ chế phân quyền theo tài khoản (`allowed_pages` & `userGroupPermissions`) cho người dùng đã đăng nhập.

---

## 2. Detailed Technical Design

### 2.1 File: `assets/js/components/sidebar.js` & `dist-app/assets/js/sidebar.js`

#### A. Hàm `isPageAllowed(href)`
- Cập nhật logic:
  - Nếu `!currentUser` (chế độ Khách):
    - Nếu trang là `quan-ly-user.html`: trả về `false`.
    - Tất cả các trang khác: trả về `true`.
  - Nếu `currentUser === 'bao.lt'`: trả về `true`.
  - Nếu `currentUser` là tài khoản khác: kiểm tra theo `allowedPages` và `groupPerms`.

#### B. Hàm `checkRoutePermission()` (kiểm tra khi truy cập trực tiếp standalone)
- Nếu `!currentUser`:
  - Nếu trang là `quan-ly-user.html`: chuyển hướng về `/pages/index.html`.
  - Các trang khác: cho phép xem bình thường.

#### C. Menu Sidebar Navigation (`NAV_ITEMS`)
- Mục `nav-quan-ly-user` đã có cờ `onlyAdmin: true`, kết hợp với `isPageAllowed` trả về `false` cho khách, đảm bảo menu Quản lý người dùng hoàn toàn không xuất hiện trên thanh Sidebar khi là Khách hoặc User thông thường.

---

### 2.2 File: `assets/js/home.js` & `dist-app/assets/js/home.js`

- Trong hàm lắng nghe sự kiện `load`:
  - Loại bỏ sự kiện chặn click (`handleRestrictedAccess`) trên các liên kết Sidebar (`.sidebar-link`, `.sidebar-sub-link`, `.sidebar-subsub-link`) đối với người dùng chưa đăng nhập, cho phép người dùng mở tab xem dữ liệu mượt mà.

---

## 3. Verification Plan

1. **Kiểm tra ở chế độ Khách (chưa đăng nhập)**:
   - Mở ứng dụng (Web và Desktop App).
   - Kiểm tra thanh Sidebar: Toàn bộ danh mục 5S, XÀ GỒ, TOLE, PHẾ LIỆU, CÔNG VIỆC, GIỚI THIỆU, GRATING hiển thị đầy đủ các mục con.
   - Kiểm tra mục "QUẢN LÝ NGƯỜI DÙNG" (`quan-ly-user.html`): Đã được ẩn khỏi Sidebar.
   - Thử click vào các mục menu trên Sidebar: Tab mở ra bình thường và hiển thị nội dung trang.
   - Thử truy cập trực tiếp đường dẫn `/pages/quan-ly-user.html` khi chưa đăng nhập: Bị từ chối truy cập và chuyển hướng về trang đăng nhập / trang chủ.

2. **Kiểm tra với tài khoản Admin (`bao.lt`)**:
   - Đăng nhập `bao.lt`: Sidebar hiển thị đầy đủ tất cả menu, bao gồm cả "QUẢN LÝ NGƯỜI DÙNG".

3. **Kiểm tra với tài khoản User thường có phân quyền hạn chế**:
   - Đăng nhập tài khoản chỉ được phân quyền nhóm XÀ GỒ: Sidebar chỉ hiển thị các trang thuộc nhóm XÀ GỒ, ẩn các nhóm khác và ẩn "QUẢN LÝ NGƯỜI DÙNG".
