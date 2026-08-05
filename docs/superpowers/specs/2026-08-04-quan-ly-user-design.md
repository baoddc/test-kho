# Thiết kế Trang Quản lý Người dùng (User Management Page)

**Ngày khởi tạo:** 2026-08-04
**Người thực hiện:** Antigravity AI
**Mục tiêu:** Cho phép người dùng `bao.lt` (hoặc tài khoản admin) tạo mới, xóa, và phân quyền (Thêm, Sửa, Xóa, Xem) cho các người dùng khác trong hệ thống thông qua Supabase.

---

## 1. Tổng quan Kiến trúc

```
+-------------------------------------------------------------+
|                      Client Frontend                        |
|                                                             |
|  [Sidebar Menu: 🛠️ Quản lý người dùng]                      |
|         ↓ (Chi hiển thị cho user `bao.lt`)                  |
|  [pages/quan-ly-user.html] <---> [assets/js/quan-ly-user.js]|
+------------------------------+------------------------------+
                               |
                   Gọi các hàm Supabase RPC
                               |
                               v
+-------------------------------------------------------------+
|                     Supabase Database                       |
|                                                             |
|  Table: public.users (RLS Enabled - Chống F12 xem pass)     |
|                                                             |
|  RPC Functions:                                             |
|  - admin_get_users()                                        |
|  - admin_save_user(...)                                     |
|  - admin_delete_user(...)                                   |
+-------------------------------------------------------------+
```

---

## 2. Kiểm soát Truy cập & Bảo mật (Auth & Security)

1. **Client-side Auth Guard**:
   - Trong `quan-ly-user.js`, kiểm tra `localStorage.getItem('currentUser')`.
   - Nếu `currentUser !== 'bao.lt'`, lập tức hiển thị Toast cảnh báo và chuyển hướng `window.location.href = 'home.html'`.
2. **Server-side Security (Supabase RPC)**:
   - Toàn bộ thao tác đọc/ghi/xóa dữ liệu bảng `users` được thực hiện qua các hàm SQL RPC cài đặt trên Supabase với thuộc tính `SECURITY DEFINER`.
   - Không cho phép client JS truy vấn trực tiếp bảng `users` bằng `supabase.from('users')`, giúp chống tuyệt đối việc xem mật khẩu qua DevTools (F12).
   - Hàm `admin_delete_user` có logic cứng chặn không cho xóa tài khoản `bao.lt`.

---

## 3. Chi tiết các thành phần chính

### A. Tệp SQL Setup (`scripts/setup_users_management_rpc.sql`)
Cung cấp 3 hàm RPC:
1. `admin_get_users()`:
   - Trả về danh sách người dùng gồm: `id`, `username`, `email`, `require_otp`, `can_add`, `can_edit`, `can_delete`, `can_view`, `created_at`.
   - Cố tình KHÔNG trả về cột `password` để đảm bảo an toàn.
2. `admin_save_user(p_id, p_username, p_password, p_email, p_require_otp, p_can_add, p_can_edit, p_can_delete, p_can_view)`:
   - Nếu `p_id` IS NULL: Thêm người dùng mới. Nếu `p_password` trống thì báo lỗi.
   - Nếu `p_id` IS NOT NULL: Cập nhật thông tin. Nếu `p_password` trống thì giữ nguyên mật khẩu cũ.
3. `admin_delete_user(p_user_id)`:
   - Kiểm tra nếu `username = 'bao.lt'` thì từ chối xóa và ném lỗi.
   - Ngược lại thực hiện xóa dòng tương ứng trong `public.users`.

### B. Tệp HTML (`pages/quan-ly-user.html`)
- Giao diện thiết kế theo chuẩn Bootstrap 5 & CSS Theme dark/light của ứng dụng.
- **Thanh Công cụ**:
  - Ô tìm kiếm tên đăng nhập / email.
  - Nút "+ Thêm người dùng mới" kích hoạt Modal.
- **Bảng dữ liệu Người dùng**:
  - STT, Username, Email, OTP (Có/Không), Quyền hạn (Badges màu phân biệt: Xem, Thêm, Sửa, Xóa), Ngày tạo, Thao tác (Sửa, Xóa).
- **Modal Thêm / Chỉnh sửa Người dùng**:
  - Tên đăng nhập (Input text, disable khi ở chế độ Edit).
  - Mật khẩu (Input password, placeholder "Để trống nếu không muốn đổi" khi Edit).
  - Email (Input email).
  - Checkbox "Yêu cầu OTP khi đăng nhập".
  - Nhóm Checkbox phân quyền: `Thêm dữ liệu`, `Chỉnh sửa dữ liệu`, `Xóa dữ liệu`, `Xem dữ liệu`.
- **Modal Xác nhận Xóa**:
  - Cảnh báo trước khi xóa vĩnh viễn user.

### C. Tệp JS Trình điều khiển (`assets/js/quan-ly-user.js`)
- Quản lý state danh sách người dùng.
- Lắng nghe các sự kiện form submit, click sửa, click xóa.
- Hiển thị Toast thông báo trạng thái thao tác.

### D. Tệp Sidebar (`assets/js/sidebar.js`)
- Thêm mục menu `"🛠️ Quản lý người dùng"` liên kết tới `pages/quan-ly-user.html`.
- Kiểm tra nếu `localStorage.getItem('currentUser') === 'bao.lt'` thì hiển thị menu này, ngược lại ẩn đi.

---

## 4. Kế hoạch Kiểm thử & Xác minh (Verification Plan)

1. **Kiểm tra phân quyền hiển thị Sidebar**:
   - Đăng nhập tài khoản `bao.lt` -> Thấy menu "Quản lý người dùng".
   - Đăng nhập tài khoản `user1` -> Không thấy menu "Quản lý người dùng".
2. **Kiểm tra Bảo mật Auth Guard**:
   - Mở trực tiếp `pages/quan-ly-user.html` khi đăng nhập `user1` -> Bị đẩy về `home.html`.
3. **Kiểm tra Chức năng**:
   - Thêm user mới -> Xem xuất hiện trong bảng và kiểm tra trong Supabase.
   - Sửa quyền hạn user -> Đăng nhập bằng user đó để kiểm tra quyền.
   - Xóa user -> Kiểm tra xóa thành công và không cho xóa `bao.lt`.
