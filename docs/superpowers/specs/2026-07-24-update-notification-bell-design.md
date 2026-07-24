# Design Spec: Chuông Thông Báo Cập Nhật Phiên Bản Mới (App Update Notification Bell)

**Ngày tạo:** 2026-07-24  
**Trạng thái:** Đã duyệt bởi người dùng  

## 1. Mục tiêu
Cung cấp biểu tượng Chuông Thông báo 🔔 trên giao diện ứng dụng nhằm chủ động thông báo cho người dùng khi có phiên bản code mới được phát hành, cho phép họ cập nhật ứng dụng tức thì chỉ với 1 click.

## 2. Giải pháp Kỹ thuật
- **File phiên bản (`version.json`)**: Đặt tại thư mục gốc ứng dụng để khai báo thông tin phiên bản hiện tại (ví dụ: `version`, `releaseDate`, `changelog`).
- **Module kiểm tra bản mới (`assets/js/update-checker.js`)**:
  - Tự động kiểm tra `version.json` định kỳ hoặc khi mở ứng dụng.
  - So sánh `version` của server với `version` hiện tại trong `localStorage`.
- **Thành phần Giao diện (UI Components)**:
  - **Chuông Thông Báo (Notification Bell)**: Tích hợp vào Sidebar/Header với hiệu ứng rung nhẹ (bell ringing animation) và badge chấm đỏ khi có phiên bản mới.
  - **Banner Toast**: Hiển thị popup góc trên bên phải khi phát hiện phiên bản mới.
  - **Modal Cập Nhật (Update Modal)**: Hiển thị thông tin thay đổi (Changelog) cùng nút "Cập nhật ngay" (`window.location.reload()`) và nút "Để sau".

## 3. Quy trình Thực thi
1. **Tạo `version.json`**: Khởi tạo file cấu hình phiên bản chuẩn.
2. **Xây dựng `assets/js/update-checker.js`**: Viết mã nguồn kiểm tra phiên bản, inject biểu tượng chuông và Modal thông báo vào DOM.
3. **Tích hợp vào Sidebar/Giao diện gốc**: Nạp script `update-checker.js` vào các trang HTML chính (`index.html`, `pages/home.html`, ...).
4. **Kiểm thử**: Mô phỏng sự thay đổi phiên bản trong `version.json` để kiểm tra hiển thị chuông thông báo và tính năng làm mới ứng dụng.
