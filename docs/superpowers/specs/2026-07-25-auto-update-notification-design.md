# Design Spec: Auto-Update Notification System for Desktop (.exe) & Web

## 1. Executive Summary
Hệ thống Tự động kiểm tra và Thông báo Cập nhật Phiên bản Mới (Auto-Update Notification System) cho ứng dụng Quản lý Kho Phôi Cuộn - DDC.
Hệ thống cho phép ứng dụng mã hóa dưới dạng ứng dụng Desktop Electron (`.exe`) hoặc Web Browser tự động nhận biết khi người quản trị/developer vừa cập nhật code mới lên server (Vercel) và hiển thị thông báo trực quan cho người dùng cập nhật 1-click.

## 2. Architecture & Components

### 2.1 Version File (`version.json`)
File cấu hình phiên bản chuẩn được lưu tại gốc repository và phục vụ trên Web server:
- Đường dẫn: `/version.json`
- Đỉnh dạng: JSON
- Nội dung:
```json
{
  "version": "1.0.1",
  "buildTime": "2026-07-25T14:00:00Z",
  "releaseNotes": "Cập nhật giao diện & tính năng mới cho Hệ thống Quản lý Kho Phôi Cuộn.",
  "minExeVersion": "1.0.0"
}
```

### 2.2 Version Checker Module (`assets/js/update-checker.js`)
- **Tự động chạy:** Được import vào tất cả các trang chính (hoặc `index.html` / `sidebar.js`).
- **Tần suất kiểm tra:**
  - Khởi chạy ngay khi mở app (delay 3 giây).
  - Định kỳ kiểm tra ngầm mỗi 5 phút (300,000 ms).
- **Cơ chế chống Cache:** Khi fetch `/version.json`, đính kèm tham số URL query string `?t=${Date.now()}`.
- **So sánh phiên bản:** So sánh chuỗi semantic versioning (hoặc timestamp) giữa `version.json` trên server và `window.APP_VERSION` hiện tại.

### 2.3 UI Notification Component
- Giao diện Toast Notification thả nổi (Floating Toast) góc dưới bên phải màn hình:
  - Thiết kế: Glassmorphism mờ nhám, viền sương mù mỏng, bóng đổ sang trọng.
  - Tiêu đề: 🚀 Đã có phiên bản mới (vX.X.X)
  - Mô tả: Nội dung từ `releaseNotes`.
  - Nút bấm chính: **[⚡ Cập nhật ngay]** -> Gọi `location.reload(true)` để nạp lại toàn bộ tài nguyên web mới nhất từ server.
  - Nút đóng: **[Đóng]** -> Khép thông báo, lưu mốc thời gian tạm thời bỏ qua phiên bản này trong phiên làm việc.

### 2.4 Integration with Build Process & Electron
- Nâng cấp `scripts/build-exe.js` để tự động sao chép file `version.json` vào thư mục `dist-app/` khi đóng gói ứng dụng `.exe`.
- Cập nhật `pages/index.html` và `dist-app/index.html` để tải file `assets/js/update-checker.js`.

## 3. Error Handling & Fallback
- Nếu không có kết nối Internet hoặc Vercel gặp lỗi 404/500, module kiên trì bỏ qua lỗi ngầm mà không gây ảnh hưởng đến trải nghiệm của người dùng.
- Nếu ứng dụng đang chạy ở chế độ offline hoàn toàn (`127.0.0.1`), hệ thống sẽ kiểm tra server local mà không hiển thị cảnh báo sai lệch.

## 4. Verification Plan
- Chạy kiểm tra local server và mô phỏng thay đổi số `version` trong `version.json` từ `1.0.0` thành `1.0.1`.
- Đảm bảo Toast Notification xuất hiện ngay sau khi phát hiện phiên bản mới.
- Kiểm tra nút **Cập nhật ngay** hoạt động chính xác.
