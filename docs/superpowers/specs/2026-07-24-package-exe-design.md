# Design Spec: Đóng gói dự án Quản lý Kho Phôi Cuộn DDC thành file Executable (.exe)

**Ngày tạo:** 2026-07-24  
**Trạng thái:** Đã duyệt bởi người dùng  

## 1. Mục tiêu
Chuyển đổi dự án Web "Hệ thống Quản lý Kho Phôi Cuộn - DDC" hiện tại thành ứng dụng Windows Desktop chạy độc lập dạng file executable (`.exe`).

## 2. Giải pháp Kỹ thuật
Sử dụng **Electron** kết hợp với **electron-builder** để đóng gói toàn bộ giao diện Web, JS, CSS và assets vào khung ứng dụng Windows Native Desktop.

### 2.1 Thành phần chính
- **Electron Shell (`dist-app/main.js`)**: Tạo cửa sổ ứng dụng Windows, khởi chạy Local HTTP Server nội bộ trên cổng ngẫu nhiên để load ứng dụng mượt mà, hạn chế vấn đề CORS và tài nguyên cục bộ.
- **Cấu hình Đóng gói (`dist-app/package.json`)**: Định nghĩa tên sản phẩm (`Hệ thống Quản lý Kho Phôi Cuộn - DDC`), icon (`assets/images/icon-512.png`), cùng cấu hình target Windows.

### 2.2 Các định dạng Đầu ra (`dist-app/dist/`)
1. **Portable Executable (`.exe`)**: File thực thi chạy ngay không cần quyền Administrator hay các bước cài đặt.
2. **Setup Installer Executable (`Setup .exe`)**: Trình cài đặt NSIS tiêu chuẩn cho phép chọn thư mục cài đặt, tự động tạo Shortcut ngoài Desktop và trong Start Menu (`Kho Phôi DDC`).

## 3. Quy trình thực thi
1. **Kiểm tra & Đồng bộ tài nguyên**: Đảm bảo toàn bộ các file mới nhất từ root (giao diện HTML, JS, CSS, assets) được cập nhật đầy đủ trong `dist-app`.
2. **Cài đặt Dependency**: Cài đặt `electron` và `electron-builder` làm `devDependencies`.
3. **Đóng gói dự án**: Thực thi `electron-builder --win` từ thư mục `dist-app`.
4. **Kiểm tra kết quả**: Xử lý và kiểm tra file đầu ra `.exe` trong thư mục `dist-app/dist/`.
