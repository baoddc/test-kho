# Thiết Kế Nâng Cấp Quét Mã Camera Trang Kiểm Kê (kiem-ke.html)
### Đồng bộ theo chuẩn "Quét Mã Vạch / QR Cuộn Thép" của vi-tri-ton.html

- **Ngày tạo**: 2026-09-06
- **Trạng thái**: Đã thống nhất thiết kế với người dùng (Phương án 1 - Quét liên tục thông minh)

---

## 1. Mục tiêu & Bối cảnh

Trong màn hình **Kiểm Kê Tồn Kho Bằng Máy Quét & Đối Soát File** (`pages/tem-nhan-kiem-ke/kiem-ke.html`), modal quét Camera hiện tại (`#cameraModal`) đang có giao diện đơn giản, chưa có tia laser quét hiệu ứng, chưa hỗ trợ quét liên tục nhiều cuộn (bị tự động đóng ngay sau 1 lần quét), và chưa đồng bộ với trải nghiệm của modal **"Quét Mã Vạch / QR Cuộn Thép"** (`#coilScanModal`) đã hoạt động rất tốt tại `pages/tem-nhan-kiem-ke/vi-tri-ton.html`.

Mục tiêu nâng cấp:
1. **Thiết kế giao diện chuẩn hóa**: Kế thừa 100% nhận diện hiện đại từ `#coilScanModal` của `vi-tri-ton.html` (header badge xanh lá, khung viền tối `#171f2e`, tia laser neon chuyển động `.scan-laser-line`, ô nhập nhanh dự phòng, dòng gợi ý định dạng).
2. **Cơ chế Quét liên tục (Continuous Scanning)**: Cho phép thủ kho quét liên tiếp nhiều cuộn mã vạch/QR cuộn thép trong kho mà không bị tắt camera giữa chừng.
3. **Chống quét trùng lặp tức thì (Debounce 2.5s)**: Tránh việc giữ camera trước 1 tem làm ghi nhận trùng liên tiếp nhiều lần.
4. **Phản hồi trực quan tại chỗ (In-modal Feedback)**: Hiển thị tóm tắt thông tin cuộn vừa quét (Mã VT, Batch, Khối lượng, Trạng thái) ngay trong modal kèm âm thanh Beep thành công để thủ kho an tâm kiểm đếm.

---

## 2. Thiết Kế Giao Diện (UI Components)

### 2.1. Cấu trúc HTML Modal (`#cameraModal`)
- Modal kích thước `modal-lg`, canh giữa màn hình (`modal-dialog-centered modal-dialog-scrollable`).
- **Header**:
  - Icon badge bo tròn nền xanh ngọc nhạt:
    ```html
    <div class="rounded-3 d-flex align-items-center justify-content-center" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #10b981; width: 38px; height: 38px; flex-shrink: 0;">
      <i class="bi bi-qr-code-scan fs-5"></i>
    </div>
    ```
  - Tiêu đề chính: `Quét Mã Vạch / QR Cuộn Thép`
  - Phụ đề: `Hướng camera vào mã vạch trên tem cuộn`
  - Nút đóng `btn-close btn-close-white`.
- **Body**:
  - **Khung Camera & Tia Laser**:
    - Container `.scanner-viewport-box`: Nền đen, bo tròn 10px, viền kim loại tối `#222d40`.
    - Reader element: `#cameraScannerReader` (min-height: 290px).
    - Hiệu ứng tia laser quét: `.scan-laser-line` (xanh ngọc neon, quét lên xuống 12% - 88%).
  - **Trạng thái Camera**: Dòng thông báo trạng thái mượt mà `#cameraStatusText` (Màu xanh ngọc `#00e1d9`, font 0.85rem).
  - **Thẻ Phản Hồi Cuộn Vừa Quét (`#modalLastScanBox`)**:
    - Hiển thị badge Mã VT, Batch, Khối lượng tem (Kg) và số lần đã quét của cuộn này.
    - Xuất hiện ngay khi quét thành công hoặc cảnh báo nếu mã sai định dạng.
  - **Ô nhập Barcode dự phòng (`.coil-input-group`)**:
    - Nhóm input icon bàn phím `<i class="bi bi-keyboard fs-6"></i>` + input `#modalBarcodeInput` + nút "Ghi nhận" xanh lá `#btnSubmitModalBarcode`.
    - Giúp người dùng gõ tay hoặc dùng máy quét cắm ngoài ngay tại modal nếu camera bị chói hoặc tem rách.
  - **Dòng gợi ý định dạng (`.coil-format-hint`)**:
    - `Định dạng tem cuộn: MãVT-Batch-Kg hoặc MãVT-Batch.`
- **Footer**:
  - Nút "Hoàn thành & Đóng" (`btn btn-secondary px-4`) để kết thúc phiên quét camera và xem đối soát.

### 2.2. CSS Styling (`kiem-ke.css`)
- Bổ sung các class dùng chung:
  - `#cameraModal .modal-content`: `background-color: #171f2e !important`, `border: 1px solid #2c384e`, `border-radius: 14px`, `box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65)`.
  - `.scanner-viewport-box`: Kích thước responsive, relative position, bo góc 10px.
  - `.scan-laser-line` & `@keyframes scanLaserMove`: Animation tia laser xanh neon.
  - `.coil-input-group`: Style input tối giản, phẳng, hòa hợp với nền modal.
  - `.coil-format-hint` & `.hint-pink`: Định dạng gợi ý màu hồng nổi bật `#f472b6`.
  - `.coil-status-text`: Màu xanh ngọc `#00e1d9`.

---

## 3. Kiến Trúc Xử Lý Logic & Luồng Dữ Liệu (kiem-ke.js)

### 3.1. Khởi động & Quét liên tục (Continuous Scanning)
- Khi modal hiển thị (`shown.bs.modal`):
  - Khởi tạo `Html5Qrcode` với khung quét chữ nhật `qrbox: { width: 320, height: 180 }`, `fps: 10`.
  - Focus vào ô `#modalBarcodeInput` để sẵn sàng nhận lệnh bàn phím / súng bắn mã.
- Khi nhận diện mã (`onScanSuccess(decodedText)`):
  - **Cơ chế Debounce**:
    ```javascript
    const now = Date.now();
    if (decodedText === lastScannedText && (now - lastScannedTime) < 2500) {
      return; // Bỏ qua quét lặp tức thì của cùng một tem
    }
    lastScannedText = decodedText;
    lastScannedTime = now;
    ```
  - Gọi hàm xử lý cốt lõi `processScannedBarcode(decodedText)`.
  - Phát âm thanh Beep thành công (`window.KiemKeStorage.playBeepSuccess()`).
  - Cập nhật thẻ phản hồi `#modalLastScanBox` hiển thị thông tin cuộn vừa nhận diện thành công.
  - **Không đóng camera / không tắt modal** -> Người dùng lia camera sang cuộn tiếp theo ngay lập tức.
- Khi tắt modal (`hidden.bs.modal`):
  - Dừng camera scanner (`stopCameraScanner()`).
  - Trả focus về ô quét barcode chính trên Top Bar (`keepFocusOnScanner()`).

### 3.2. Xử lý Ô nhập nhanh trong Modal
- Bắt sự kiện `Enter` trên `#modalBarcodeInput` và click trên `#btnSubmitModalBarcode`.
- Gọi hàm `processScannedBarcode(#modalBarcodeInput.value)`.
- Xóa trắng ô input và giữ focus sau khi ghi nhận.

---

## 4. Kế Hoạch Đồng Bộ & Kiểm Thử

1. **Các tệp cần cập nhật**:
   - `pages/tem-nhan-kiem-ke/kiem-ke.html` (và bản sao `pages/kiem-ke.html` nếu có).
   - `assets/css/tem-nhan-kiem-ke/kiem-ke.css`.
   - `assets/js/tem-nhan-kiem-ke/kiem-ke.js`.
   - Chạy `npm run build` (`scripts/sync-dist.js`) để đồng bộ sang `dist/`, `dist-app/`, `public/`.

2. **Kịch bản kiểm thử (Verification Plan)**:
   - Mở modal camera trên cả Desktop và Mobile -> Kiểm tra độ tương thích giao diện, laser animation, header icon.
   - Thử quét mã cuộn: Camera nhận diện, phát tiếng Beep, hiển thị card phản hồi, camera vẫn tiếp tục chạy.
   - Thử giữ camera trước 1 tem: Không bị ghi nhận 5-6 lần liên tiếp (debounce 2.5s).
   - Thử nhập mã vào ô barcode trong modal và nhấn Ghi nhận / Enter -> Ghi nhận chính xác.
   - Nhấn "Hoàn thành & Đóng" -> Camera tắt an toàn, đối soát hiển thị đầy đủ số lượng cuộn đã quét.
