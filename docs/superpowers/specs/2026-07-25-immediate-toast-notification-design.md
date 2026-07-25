# Immediate & Realtime Toast Notification Feature - Design Specification

## Overview
Cho phép hiển thị Toast Popup thông báo hệ thống (bảo trì, cập nhật phiên bản, thông báo chung) ngay lập tức ở góc màn hình (0ms delay) ngay khi người dùng vừa truy cập ứng dụng Web hoặc Desktop (.exe), đồng thời hỗ trợ **Supabase Realtime** để đẩy thông báo mới tới tất cả người dùng đang sử dụng hệ thống tức thì.

---

## 1. Requirements & User Experience

### 1.1 Immediate Execution on Page Load (0ms delay)
- Khi người dùng nạp bất kỳ trang nào trong hệ thống, `update-checker.js` thực hiện `checkUpdate()` và `fetchAnnouncements()` ngay lập tức.
- Nếu có thông báo hoạt động chưa đọc (`is_active = true` và chưa có ID trong `localStorage`), Glassmorphic Toast Popup (`#system-announcement-toast`) trượt lên góc dưới màn hình tức thì.

### 1.2 Realtime Announcement Push (Supabase Realtime)
- Đăng ký Supabase Realtime channel (`client.channel('public:system_announcements')`) theo dõi sự kiện `postgres_changes` trên bảng `system_announcements`.
- Khi Admin đăng thông báo mới, Supabase Realtime phát tín hiệu trực tiếp đến tất cả client đang online:
  - Tự động reset trạng thái hiển thị toast (`isToastShown = false`).
  - Tự động gọi lại `fetchAnnouncements()` và hiển thị Toast Popup ngay trên màn hình người dùng đang làm việc trong tích tắc.

---

## 2. Technical Modifications

### 2.1 File Changes
1. **`assets/js/update-checker.js`**:
   - Thêm hàm `subscribeToRealtimeAnnouncements()` đăng ký kênh Realtime Supabase cho bảng `system_announcements`.
   - Khởi chạy `subscribeToRealtimeAnnouncements()` trong `init()`.
   - Giữ nguyên `checkUpdate()` chạy ngay lúc `init()` (0ms delay) và chu kỳ polling định kỳ 5 phút làm dự phòng network.

2. **`dist-app/assets/js/update-checker.js`**:
   - Đồng bộ hóa toàn bộ các thay đổi từ `assets/js/update-checker.js` sang phiên bản đóng gói ứng dụng Desktop.

---

## 3. Verification Plan

1. **Kiểm thử Tải trang (On-load)**:
   - Xóa `localStorage.removeItem('read_announcements')`.
   - Refresh trang web, Toast xuất hiện ngay lập tức ở góc dưới màn hình.
2. **Kiểm thử Realtime**:
   - Đăng nhập `bao.lt` trên một tab/trình duyệt, và đăng nhập user khác trên tab/trình duyệt thứ 2.
   - Đăng 1 thông báo mới từ tab Admin `bao.lt`.
   - Tab user lập tức hiển thị Toast thông báo mới mà không cần refresh trang.
