# Thiết Kế Phản Hồi Rung (Haptic) & Hỗ Trợ Quét Đa Hướng (Dọc/Ngang) Cho Camera

## 1. Tổng Quan & Mục Tiêu
Nâng cấp trải nghiệm quét mã vạch / mã QR bằng camera trên toàn bộ các phân hệ của Web App Quản Lý Kho:
1. **Phản hồi rung (Haptic Feedback)**: Khi camera nhận diện thành công mã vạch hoặc mã QR, thiết bị sẽ kích hoạt một nhịp rung (100ms) để thông báo cho người vận hành ngay lập tức mà không cần luôn nhìn chằm chằm vào màn hình (đặc biệt hữu ích trong kho bãi ồn ào).
2. **Hỗ trợ quét đa hướng (Cả Dọc và Ngang)**:
   - Thay đổi khung ngắm camera (`qrbox`) từ hình chữ nhật dẹt (`320x180`) sang khung vuông linh hoạt (ví dụ `250x250` hoặc tính theo 75% cạnh nhỏ nhất của khung hình). Giúp mã vạch khi xoay dọc hay ngang đều lọt trọn vẹn trong vùng cảm biến hình ảnh mà không bị cắt đầu/đuôi.
   - Bật tính năng Native `BarcodeDetector` (`experimentalFeatures: { useBarCodeDetectorIfSupported: true }`), tận dụng engine phần cứng của Chromium/Android để giải mã mã vạch xoay ở mọi góc độ (0°, 90°, 180°, 270°).

---

## 2. Phạm Vi Áp Dụng
Hệ thống camera quét trong toàn bộ dự án gồm 3 vị trí chính:
1. **Camera Kiểm Kê Kho** ([kiem-ke.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tem-nhan-kiem-ke/kiem-ke.js)):
   - Camera quét liên tục tem cuộn trong modal kiểm kê kho.
   - Thêm `triggerHapticFeedback()` khi quét thành công.
   - Cập nhật `qrbox` sang khung vuông và bật `useBarCodeDetectorIfSupported: true`.
2. **Camera Gán Vị Trí Cuộn Thép** ([vi-tri-ton.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tem-nhan-kiem-ke/vi-tri-ton.js)):
   - Camera quét tem cuộn trong modal vị trí tồn.
   - Bổ sung rung haptic cả khi gọi qua `qrScannerService` hoặc fallback độc lập.
   - Cập nhật `qrbox` sang khung vuông và bật `useBarCodeDetectorIfSupported: true`.
3. **QR Scanner Vị Trí Kho Dùng Chung** ([qr-scanner-service.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/core/qr-scanner-service.js)):
   - Quét mã QR vị trí cho các trang xuất / nhập / tồn tôn và xà gồ.
   - Chuẩn hóa thời lượng rung thành 100ms.
   - Bật `useBarCodeDetectorIfSupported: true` cho scanner instance.

---

## 3. Thiết Kế Chi Tiết

### 3.1. Tiện Ích Rung (Haptic Feedback)
Tạo cơ chế rung an toàn, tương thích mọi trình duyệt và thiết bị di động:
```javascript
function triggerHapticFeedback(duration = 100) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(duration);
    } catch (e) {
      // Bỏ qua nếu thiết bị chặn hoặc không có motor rung
    }
  }
}
```
- Gọi đồng thời với âm thanh bíp (`playBeepSound` / `playBeepSuccess`).
- Thời lượng rung: `100ms` (nhịp dứt khoát, rõ nét trên thiết bị cầm tay).

### 3.2. Cấu Hình Quét Đa Hướng (Dọc & Ngang)
- **Tính toán `qrbox` vuông linh hoạt**:
  ```javascript
  qrbox: function(viewfinderWidth, viewfinderHeight) {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    const size = Math.floor(minEdge * 0.75);
    return { width: Math.max(220, Math.min(size, 320)), height: Math.max(220, Math.min(size, 320)) };
  }
  ```
  Nhờ đó, dù người dùng để camera chế độ ngang hay dọc, mã vạch dán theo chiều thẳng đứng hay nằm ngang đều nằm gọn trong khung nhận diện.
- **Kích hoạt Native BarcodeDetector**:
  ```javascript
  const config = {
    fps: 10,
    qrbox: qrBoxConfig,
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true
    }
  };
  ```
  Khi khởi tạo `new Html5Qrcode(...)`, cũng truyền `experimentalFeatures: { useBarCodeDetectorIfSupported: true }`.

### 3.3. CSS Laser Khung Quét
- Điều chỉnh khung quét laser trên giao diện sao cho đường quét và khung bao ôm trọn vùng quét vuông đối xứng, hiển thị thẩm mỹ và trực quan cho người dùng.

---

## 4. Kế Hoạch Đồng Bộ & Kiểm Thử
- Sửa đổi các file nguồn tại `assets/js/`.
- Chạy `npm run build` để đồng bộ ra các thư mục `public/`, `dist/`, và `dist-app/`.
- Kiểm tra tính toàn vẹn cú pháp và hoạt động không gây lỗi console.
