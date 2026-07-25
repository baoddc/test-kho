# Design Spec: Đóng gói ứng dụng Desktop (.exe) với Live Web Sync & Offline Fallback

## 1. Tổng quan (Overview)
Đóng gói dự án **Hệ thống Quản lý Kho Phôi Cuộn - DDC** thành ứng dụng Windows Desktop dạng file thực thi (`.exe`). Hỗ trợ cơ chế tự động cập nhật tức thì khi update code web, đồng thời có thể chạy offline khi không có kết nối mạng.

## 2. Kiến trúc & Thiết kế (Architecture & Design)
- **Công nghệ đóng gói:** Electron v43+ & Electron-Builder v26+.
- **Cấu hình khởi chạy (`dist-app/main.js`):**
  - Tự động nạp giao diện từ URL trực tuyến (`https://baoddc.github.io/test-kho/index.html`).
  - Mỗi khi phát hành/cập nhật code mới trên Web/GitHub Pages, mọi máy khách đang sử dụng file `.exe` đều tự động nhận phiên bản mới nhất ngay khi mở app.
  - Nếu không có mạng (hoặc tải URL online thất bại), ứng dụng kích hoạt sự kiện `did-fail-load` để tự động chuyển sang nạp bộ file nguồn local thông qua một HTTP server siêu nhẹ tích hợp sẵn (`http://127.0.0.1:<port>`).
- **Sản phẩm đóng gói (Deliverables):**
  1. `Kho Phôi DDC Setup 1.0.0.exe` (NSIS Installer - Bản cài đặt chuẩn Windows, tự tạo Icon Desktop & Start Menu, chọn thư mục cài đặt).
  2. `Kho Phôi DDC 1.0.0.exe` (Portable - Bản chạy ngay không cần cài đặt, dễ dàng copy qua USB/Zalo/Drive).

## 3. Quy trình thực hiện (Implementation Steps)
1. **Chuẩn bị môi trường & đồng bộ nguồn:**
   - Kiểm tra và cài đặt đầy đủ các gói phụ thuộc (node_modules) trong thư mục `dist-app`.
   - Đồng bộ các thư mục `pages/`, `assets/`, `index.html`, `manifest.json`, `sw.js` mới nhất từ root vào `dist-app/`.
2. **Cấu hình & Đóng gói:**
   - Kiểm tra thông số app name, version, icon trong `dist-app/package.json`.
   - Tiến hành build file `.exe` thông qua `electron-builder`.
3. **Kiểm thử & Bàn giao:**
   - Đảm bảo file `.exe` tạo ra trong thư mục `dist-app/release/` chạy tốt.
   - Viết tài liệu hướng dẫn phân phối và cập nhật ứng dụng.
