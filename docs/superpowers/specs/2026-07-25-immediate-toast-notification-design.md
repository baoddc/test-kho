# Immediate Toast Notification Feature - Design Specification

## Overview
Cho phép hiển thị Toast Popup thông báo hệ thống (bảo trì, cập nhật phiên bản, thông báo chung) ngay lập tức ở góc màn hình (0ms delay) ngay khi người dùng vừa truy cập ứng dụng Web hoặc Desktop (.exe).

---

## 1. Requirements & User Experience

### 1.1 Immediate Execution (Tải dữ liệu 0ms delay)
- Khi ứng dụng nạp xong (`DOMContentLoaded` hoặc khởi chạy script `update-checker.js`), hệ thống thực hiện `checkUpdate()` và `fetchAnnouncements()` ngay lập tức mà không chờ delay (thay vì chờ 1.5 giây như trước).

### 1.2 Toast Popup Appearance
- Ngay khi nhận được danh sách thông báo hoạt động (`is_active = true` và chưa đánh dấu là đã đọc trong `localStorage`), Glassmorphic Toast Popup (`#system-announcement-toast`) sẽ hiển thị tức thì tại góc dưới màn hình.
- Nút "🔍 Xem chi tiết" cho phép người dùng mở Modal xem nội dung và đánh dấu đã đọc.
- Nút "Bỏ qua" cho phép người dùng ẩn Toast và đánh dấu đã đọc.

---

## 2. Technical Modifications

### 2.1 File Changes
1. **`assets/js/update-checker.js`**:
   - Trong hàm `init()`: Gọi `checkUpdate()` trực tiếp ngay khi khởi tạo thay cho `setTimeout(checkUpdate, 1500)`.
   - Giữ nguyên chu kỳ polling định kỳ 5 phút (`setInterval(checkUpdate, CHECK_INTERVAL_MS)`).

2. **`dist-app/assets/js/update-checker.js`**:
   - Đồng bộ hóa các thay đổi từ `assets/js/update-checker.js` sang phiên bản đóng gói ứng dụng Desktop.

---

## 3. Verification Plan

1. **Kiểm thử trên Web**:
   - Xóa `localStorage.removeItem('read_announcements')` trên trình duyệt.
   - Refresh trang web, kiểm tra Toast Popup xuất hiện ngay lập tức ở góc dưới màn hình mà không có độ trễ 1.5s.
2. **Kiểm thử trên Desktop App**:
   - Đảm bảo file `dist-app/assets/js/update-checker.js` được cập nhật đồng bộ.
