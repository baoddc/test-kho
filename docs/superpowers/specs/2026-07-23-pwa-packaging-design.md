# Design Spec: Đóng gói dự án web-supabase thành PWA (Progressive Web App)

**Ngày tạo:** 2026-07-23  
**Dự án:** Quản lý Kho Phôi Cuộn - DDC (`web-supabase`)  
**Mục tiêu:** Đóng gói ứng dụng web hiện tại thành Progressive Web App (PWA) cho phép cài đặt và sử dụng mượt mà như một ứng dụng native trên máy tính (Windows Desktop) và thiết bị di động (Android/iOS).

---

## 1. Tổng quan Architecture & Cấu trúc File

Dự án sẽ bổ sung các file PWA chuẩn ở thư mục gốc và thư mục tài nguyên:

```
web-supabase/
├── manifest.json                  # Cấu hình PWA Web App Manifest
├── sw.js                          # Service Worker xử lý caching & offline
├── offline.html                   # Trang hiển thị khi mất kết nối mạng
├── assets/
│   ├── js/
│   │   └── pwa-register.js        # Đăng ký SW & xử lý nút bấm cài đặt App
│   └── icons/                     # Thư mục chứa các Icon PWA
│       ├── icon-192x192.png       # Biểu tượng 192px
│       ├── icon-512x512.png       # Biểu tượng 512px
│       └── icon-maskable.png      # Biểu tượng maskable cho Android/iOS
```

---

## 2. Chi tiết các thành phần

### 2.1. Web App Manifest (`manifest.json`)
* **`name`**: `Hệ thống Quản lý Kho Phôi Cuộn - DDC`
* **`short_name`**: `Kho DDC`
* **`start_url`**: `/pages/index.html` (hoặc `/index.html`)
* **`display`**: `standalone`
* **`background_color`**: `#f8f9fa`
* **`theme_color`**: `#0d6efd`
* **`icons`**: Định nghĩa đầy đủ icon 192x192, 512x512 và maskable.

### 2.2. Service Worker (`sw.js`)
* **Tên Cache**: `ddc-kho-v1`
* **Chiến lược Caching**:
  * **Static Resources (CSS, JS, Web Fonts, Images, Icons)**: Cache-First (đọc từ cache, cập nhật ngầm nếu có thay đổi).
  * **HTML & Dynamic Data (Supabase API `*.supabase.co`)**: Network-First (luôn lấy dữ liệu mới nhất từ server, fallback về cache hoặc `offline.html` khi mất mạng).

### 2.3. Đăng ký & Giao diện cài đặt (`assets/js/pwa-register.js`)
* Tự động đăng ký `sw.js` trên tất cả các trang HTML khi tải trang.
* Bắt sự kiện `beforeinstallprompt`, hiển thị nút/banner "Cài đặt App Kho DDC" trực quan cho người dùng.

### 2.4. Tích hợp HTML
Thêm các thẻ meta và script đăng ký PWA vào tất cả các trang HTML trong dự án (`index.html`, `pages/*.html`):
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0d6efd">
<link rel="apple-touch-icon" href="/assets/icons/icon-192x192.png">
<script src="/assets/js/pwa-register.js" defer></script>
```

---

## 3. Kế hoạch Kiểm thử & Xác minh (Verification Plan)

1. **Lighthouse PWA Audit**:
   - Sử dụng Google Chrome DevTools Lighthouse để audit điểm PWA. Đảm bảo đạt đủ điều kiện installable và PWA badge.
2. **Kiểm thử cài đặt trên Windows Desktop**:
   - Truy cập trang web trên Chrome/Edge, xác nhận biểu tượng cài đặt App xuất hiện trên thanh địa chỉ hoặc thông qua nút cài đặt trên giao diện.
3. **Kiểm thử Offline Capability**:
   - Bật chế độ Offline trong Chrome DevTools Network Tab, đảm bảo các tài nguyên tĩnh vẫn hoạt động và trang offline hiển thị đúng khi không có mạng.
