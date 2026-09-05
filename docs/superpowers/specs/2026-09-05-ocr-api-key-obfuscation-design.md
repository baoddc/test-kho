# Tích hợp sẵn và Bảo mật API Key Gemini OCR (Xà gồ & Tole Xuất)

**Date:** 2026-09-05  
**Topic:** ocr-api-key-obfuscation  

## 1. Mục tiêu
- Tích hợp sẵn API Key Gemini Vision (`GEMINI_API_KEY_REDACTED`) vào hệ thống để người dùng sử dụng tính năng quét ảnh phiếu xuất tự động mà không cần thao tác cấu hình thủ công.
- Bảo mật và che giấu API Key: không cho người dùng khác xem, sao chép hoặc tìm kiếm thấy key trong mã nguồn hoặc giao diện ứng dụng.
- Hoạt động ổn định trên cả Web tĩnh và ứng dụng Android (Capacitor).

## 2. Thiết kế chi tiết

### 2.1. Che giấu & Mã hóa API Key trong `receipt-ocr-service.js`
- Chuỗi thô của API Key sẽ bị loại bỏ hoàn toàn khỏi mã nguồn.
- Sử dụng thuật toán mã hóa mảng byte đa tầng kết hợp mặt nạ XOR biến thiên theo chỉ mục (`salt = 0x5A`, bước dịch `7`) đặt trong closure riêng tư (IIFE).
- Key chỉ được giải mã tức thời trong bộ nhớ RAM khi chuẩn bị gửi request phân tích hình ảnh tới Google Gemini API (`callGeminiVision` và `resolveWorkingModel`).
- Cơ chế ưu tiên: Nếu có key mã hóa mặc định, `hasApiKey()` luôn trả về `true`. Không ghi đè hay lưu API Key vào `localStorage` dưới dạng văn bản rõ để ngăn chặn trích xuất qua Developer Tools (Application > LocalStorage).
- Nếu `processImage` được gọi, hệ thống tự động sử dụng key mã hóa nhúng sẵn mà không yêu cầu người dùng phải cấu hình.

### 2.2. Loại bỏ giao diện Cấu hình & Nút Bánh răng
- **Giao diện HTML (`pages/xg/xg-xuat.html`, `pages/tole/tole-xuat.html`)**:
  - Gỡ bỏ nút `#btnOcrSettings` (biểu tượng bánh răng) trên dropzone OCR.
  - Gỡ bỏ modal `#ocrSettingsModal` (modal cấu hình Gemini API Key) để triệt tiêu hoàn toàn giao diện xem hoặc sửa key.
- **JavaScript xử lý (`assets/js/xg/xg-xuat.js`, `assets/js/tole/tole-xuat.js`)**:
  - Dọn dẹp các trình lắng nghe sự kiện liên quan đến `#btnOcrSettings`, modal settings, nút lưu key, nút kiểm tra kết nối.
  - Loại bỏ các cảnh báo yêu cầu nhập API Key trước khi quét ảnh phiếu xuất.

### 2.3. Quy trình Đồng bộ (`scripts/sync-dist.js`)
- Đồng bộ các thay đổi từ thư mục gốc `assets/` và `pages/` sang `dist/`, `public/`, và `dist-app/` bằng script `node scripts/sync-dist.js`.

## 3. Kế hoạch Kiểm thử & Xác nhận
1. Mở `pages/xg/xg-xuat.html` và `pages/tole/tole-xuat.html`:
   - Xác nhận nút bánh răng `#btnOcrSettings` và modal `#ocrSettingsModal` đã biến mất khỏi giao diện.
   - Tìm kiếm toàn bộ project: Đảm bảo chuỗi plaintext của API Key không hề xuất hiện ở bất kỳ file nào.
2. Kiểm tra `ReceiptOcrService`:
   - Kiểm tra hàm `hasApiKey()` trả về `true`.
   - Kiểm tra hàm nội bộ giải mã key ra đúng chuỗi gốc trong runtime.
3. Chạy `node scripts/sync-dist.js` và đảm bảo toàn bộ thư mục `dist/`, `public/`, `dist-app/` đồng bộ hoàn toàn.
