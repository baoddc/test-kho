# Design Spec: Hiển thị và truy cập đường link trong Thông báo Hệ thống (Clickable Notification Links)

**Ngày khởi tạo:** 2026-07-29  
**Tác giả:** Antigravity AI & `bao.lt`  
**Trạng thái:** Approved  

---

## 1. Tổng quan & Mục tiêu

Hiện tại, ứng dụng Quản lý Kho Phôi Cuộn - DDC hiển thị các thông báo hệ thống do Admin phát hành qua dạng **Toast Notification** (thả nổi góc phải) và **Trung tâm Thông báo** (Modal khi click vào icon 🔔 chuông). Tuy nhiên, nội dung thông báo được hiển thị dưới dạng văn bản thuần (`pre-wrap`), làm cho các đường link (URL) không thể click hay mở trực tiếp.

**Mục tiêu:** Tự động phát hiện các liên kết URL (`http://`, `https://`, `www.`) trong nội dung thông báo và chuyển đổi thành thẻ liên kết HTML (`<a>`) có thể click để truy cập trực tiếp trên tab mới, đồng thời bảo đảm an toàn XSS và giữ giao diện hiện đại.

---

## 2. Thiết kế chi tiết

### 2.1 Hàm định dạng văn bản (`formatNotificationText`)

Thêm hàm trợ giúp `formatNotificationText(rawText)` trong module `update-checker.js`:

1. **Bảo mật XSS (Sanitization)**:
   Mã hóa các ký tự đặc biệt HTML trước khi parse URL:
   - `&` ➔ `&amp;`
   - `<` ➔ `&lt;`
   - `>` ➔ `&gt;`
   - `"` ➔ `&quot;`
   - `'` ➔ `&#039;`

2. **Regex nhận diện và chuyển đổi URL**:
   Sử dụng Pattern Regex: `/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi`
   - Nếu URL bắt đầu bằng `www.`, tự động thêm tiền tố `https://` cho attribute `href`.
   - Kết quả trả về thẻ HTML:
     ```html
     <a href="${url}" target="_blank" rel="noopener noreferrer" class="announcement-link" onclick="event.stopPropagation();">${displayUrl}</a>
     ```
   - Thêm `event.stopPropagation()` để ngăn việc nhấp vào liên kết trên Toast làm kích hoạt sự kiện đóng/mở Toast hoặc mở Modal.

### 2.2 Kiểu dáng CSS (`.announcement-link`)

Bổ sung vào hàm `injectStyles()` trong `update-checker.js`:

```css
.announcement-link {
  color: #38bdf8;
  text-decoration: underline;
  word-break: break-all;
  font-weight: 500;
  transition: color 0.2s ease;
}
.announcement-link:hover {
  color: #7dd3fc;
  text-decoration: underline;
}
```

### 2.3 Các điểm tích hợp (Integration Sites)

1. **Toast Notification (`showAnnouncementToast`)**:
   - Chuyển `${announcement.content}` thành `${formatNotificationText(announcement.content)}`.
2. **Tab Thông báo người dùng (`renderUserTabHTML`)**:
   - Chuyển `${item.content}` thành `${formatNotificationText(item.content)}`.
3. **Tab Quản lý Admin (`renderAdminTabHTML`)**:
   - Chuyển `${item.content}` thành `${formatNotificationText(item.content)}`.
4. **File đồng bộ**:
   - [`assets/js/update-checker.js`](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/update-checker.js)
   - [`dist-app/assets/js/update-checker.js`](file:///c:/Users/benhhc/Desktop/web-supabase/dist-app/assets/js/update-checker.js)

---

## 3. Kế hoạch kiểm thử (Verification)

1. **Kiểm thử liên kết hợp lệ**:
   - Đăng thông báo chứa `https://google.com`, `http://example.com`, và `www.ddc.com.vn`.
   - Xác nhận tất cả liên kết hiển thị đúng định dạng xanh nõn (#38bdf8), gạch chân.
   - Click vào liên kết ➔ Mở trang trong tab trình duyệt mới (`_blank`).
   - Click vào liên kết trên Toast ➔ Link mở đúng tab mới mà không đóng Toast hay làm sai lệch hành vi Toast.
2. **Kiểm thử an toàn XSS**:
   - Đăng thông báo chứa thẻ `<script>alert(1)</script>` hoặc `<img src=x onerror=alert(1)>`.
   - Xác nhận thẻ script được mã hóa an toàn dưới dạng text, không bị thực thi.
