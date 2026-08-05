# Thiết Kế Thông Báo Cá Nhân Khi Cấp / Thu Hồi Quyền User

## Tổng Quan (Overview)
Khi Quản trị viên (`bao.lt`) thực hiện cấp mới hoặc thu hồi phân quyền (quyền truy cập trang HTML, quyền Thêm/Sửa/Xóa/Xem theo nhóm) đối với một tài khoản người dùng trong trang [quan-ly-user.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/quan-ly-user.html), hệ thống sẽ tự động gửi thông báo đến **Chuông thông báo** và hiển thị **Toast popup** dành riêng cho tài khoản người dùng đó. Các tài khoản khác sẽ không nhìn thấy thông báo này.

---

## 1. Cơ sở dữ liệu (Supabase Schema & Migration)

Cập nhật bảng `public.system_announcements` trên Supabase:
- Thêm cột `target_user TEXT DEFAULT NULL`: 
  - `NULL` hoặc `'*'`: Thông báo hệ thống chung cho toàn bộ người dùng.
  - `'username'`: Thông báo riêng biệt dành cho tài khoản `username`.

```sql
-- 1. Bổ sung cột target_user vào bảng system_announcements
ALTER TABLE public.system_announcements 
ADD COLUMN IF NOT EXISTS target_user TEXT DEFAULT NULL;

-- 2. Tạo Index tối ưu hóa truy vấn lọc thông báo theo người dùng
CREATE INDEX IF NOT EXISTS idx_system_announcements_target_user 
ON public.system_announcements (target_user);
```

---

## 2. Giao diện Quản lý User (`assets/js/quan-ly-user.js`)

### 2.1. Theo dõi sự thay đổi phân quyền
- Khi Quản trị viên mở Modal Chỉnh sửa người dùng (`openEditUserModal`), lưu lại ảnh chụp phân quyền ban đầu:
  - `allowed_pages` (Danh sách các đường dẫn trang HTML được duyệt)
  - `groups` (Chi tiết quyền `canView`, `canAdd`, `canEdit`, `canDelete` cho từng nhóm: `chung`, `5s`, `xg`, `tole`, `pl`, `admin`)
- Khi Quản trị viên bấm nút **Lưu** (`handleSaveUser`) và RPC `admin_save_user` thành công:
  - So sánh cấu hình quyền mới so với phân quyền ban đầu.
  - Xác định chi tiết:
    - **Cấp thêm**: Các trang HTML / quyền thao tác nhóm mới được tích chọn.
    - **Thu hồi**: Các trang HTML / quyền thao tác nhóm bị bỏ tích chọn.

### 2.2. Phát thông báo phân quyền
- Nếu là **Tạo người dùng mới**:
  - Tiêu đề: `🎉 Tài khoản của bạn đã được khởi tạo`
  - Nội dung: `Tài khoản ${username} đã được cấp quyền truy cập hệ thống. Vui lòng kiểm tra danh sách trang và chức năng được phân quyền.`
  - `target_user`: `${username}`
- Nếu là **Chỉnh sửa phân quyền người dùng hiện có**:
  - So sánh diff giữa quyền cũ và mới. Nếu có sự thay đổi:
    - Tiêu đề: `📢 Thay đổi quyền truy cập tài khoản`
    - Nội dung tổng hợp chi tiết dạng văn bản rõ ràng (VD: `Quyền của bạn vừa được cập nhật: ➕ Cấp thêm: Trang Quản lý 5S (Xem, Sửa); ➖ Thu hồi: Trang Quản lý Tole (Xóa)`).
    - `target_user`: `${username}`
  - Đẩy bản ghi thông báo trực tiếp lên bảng `system_announcements` với `is_active = true`, `created_by = 'bao.lt'`, `type = 'info'` (nếu cấp thêm) hoặc `'warning'` (nếu thu hồi).

---

## 3. Khách thể hiển thị thông báo (`assets/js/update-checker.js` & `dist-app/assets/js/update-checker.js`)

### 3.1. Truy vấn thông báo theo từng User
Cập nhật hàm `fetchAnnouncements()`:
- Đọc tài khoản đang đăng nhập hiện tại từ `localStorage.getItem('currentUser')`.
- Nếu tài khoản hiện tại là người dùng thông thường (`!isAdmin`):
  - Truy vấn Supabase lọc các thông báo hoạt động:
    - `is_active = true`
    - `target_user IS NULL` OR `target_user = '*'` OR `target_user = currentUser`
- Nếu là `bao.lt` (Admin): Tải đầy đủ thông báo hệ thống và quản trị như cũ.

### 3.2. Trải nghiệm người dùng (UX)
- Khi user mục tiêu truy cập hoặc đang dùng app, `update-checker.js` tự động phát hiện thông báo chưa đọc (chưa nằm trong `localStorage.getItem('read_announcements')`).
- Đèn Chuông nhấp nháy, hiện chấm đỏ badge unread.
- Glassmorphic Toast popup xuất hiện góc dưới màn hình thông báo trực quan cho user.

---

## 4. Kế hoạch Kiểm thử & Xác minh (Verification Plan)

1. **Chạy Migration SQL**: Thực thi lệnh SQL trên Supabase Dashboard.
2. **Kiểm thử Cấp quyền mới**:
   - Đăng nhập `bao.lt`, vào Trang Quản lý User -> Cấp thêm trang `quan-ly-5s.html` cho user `test_user`.
   - Đăng nhập tài khoản `test_user` trên cửa sổ mới -> Kiểm tra chuông thông báo, Toast popup xuất hiện nội dung cấp quyền.
3. **Kiểm thử Thu hồi quyền**:
   - Đăng nhập `bao.lt` -> Thu hồi quyền của `test_user`.
   - Đăng nhập `test_user` -> Kiểm tra chuông thông báo nhận tin nhắn thu hồi.
4. **Kiểm thử Tính riêng tư (Isolation)**:
   - Đăng nhập bằng một tài khoản khác (ví dụ: `other_user`) -> Xác nhận `other_user` KHÔNG nhìn thấy thông báo cá nhân của `test_user`.
