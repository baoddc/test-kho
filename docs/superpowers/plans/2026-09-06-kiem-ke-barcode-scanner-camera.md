# Nâng Cấp Quét Mã Camera Trang Kiểm Kê (kiem-ke.html) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp modal quét Camera trong trang `pages/tem-nhan-kiem-ke/kiem-ke.html` theo giao diện chuẩn `#coilScanModal` của `vi-tri-ton.html` (header badge xanh ngọc, tia laser neon animation, ô nhập mã dự phòng, quét liên tục kèm debounce và thẻ phản hồi trực quan tại chỗ).

**Architecture:** 
- Tái cấu trúc giao diện HTML của `#cameraModal` sang layout hiện đại đồng bộ với `vi-tri-ton.html`.
- Bổ sung các rule CSS styling chuyên dụng vào `assets/css/tem-nhan-kiem-ke/kiem-ke.css` (`.scanner-viewport-box`, `.scan-laser-line`, `.coil-input-group`, `.coil-format-hint`, `.coil-status-text`).
- Nâng cấp `startCameraScanner` trong `assets/js/tem-nhan-kiem-ke/kiem-ke.js`: Hỗ trợ quét liên tục (không đóng camera sau mỗi lần quét), cơ chế debounce chống quét trùng cùng 1 tem trong 2.5s, thẻ phản hồi kết quả trực quan ngay trong modal, và hỗ trợ ô nhập/bắn súng mã vạch trực tiếp `#modalBarcodeInput`.
- Chạy `npm run build` để đồng bộ ra các thư mục `dist/`, `dist-app/`, `public/`.

**Tech Stack:** Vanilla JavaScript, HTML5, Bootstrap 5, Html5Qrcode library, CSS3 animations.

## Global Constraints
- Bảo toàn toàn bộ chức năng kiểm kê hiện tại (đọc file Excel cơ sở, tính SUMIF 3 chiều, xuất báo cáo, lưu session localStorage).
- Giữ vững cấu trúc mã nguồn, không làm hỏng responsive trên thiết bị di động.
- Mọi chỉnh sửa mã nguồn phải nằm trong `pages/` và `assets/`, sau đó chạy `node scripts/sync-dist.js` để đồng bộ.

---

### Task 1: Bổ sung CSS Styling Scanner Chuyên Nghiệp vào kiem-ke.css

**Files:**
- Modify: `assets/css/tem-nhan-kiem-ke/kiem-ke.css`

**Interfaces:**
- Produces: CSS classes `.scanner-viewport-box`, `.scan-laser-line`, `@keyframes scanLaserMove`, `.coil-input-group`, `.coil-format-hint`, `.hint-pink`, `.coil-status-text`, `#cameraModal .modal-content`.

- [ ] **Step 1: Thêm các class CSS scanner vào `assets/css/tem-nhan-kiem-ke/kiem-ke.css`**
Thêm các styles cho modal camera giống `vi-tri-ton.css`:
```css
/* =============================================================================
   CAMERA SCANNER MODAL STYLES (MATCHING VI-TRI-TON & MODERN DARK THEME)
   ============================================================================= */
#cameraModal .modal-content {
  border-radius: 14px;
  background-color: #171f2e !important;
  border: 1px solid #2c384e !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65) !important;
}

#cameraModal .modal-header {
  border-bottom: 1px solid #253147 !important;
}

#cameraModal .modal-footer {
  border-top: 1px solid #253147 !important;
}

.scanner-viewport-box {
  position: relative;
  width: 100%;
  min-height: 290px;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #222d40;
}

.scan-laser-line {
  position: absolute;
  left: 6%;
  right: 6%;
  top: 50%;
  height: 2px;
  background: #10b981;
  box-shadow: 0 0 14px 3px rgba(16, 185, 129, 0.85), 0 0 4px #34d399;
  border-radius: 2px;
  pointer-events: none;
  z-index: 10;
  animation: scanLaserMove 2.2s infinite ease-in-out alternate;
}

@keyframes scanLaserMove {
  0% {
    top: 12%;
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  100% {
    top: 88%;
    opacity: 0.8;
  }
}

.coil-input-group {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #364259;
  background: #232c3f;
}

.coil-input-group .input-group-text {
  background: #232c3f;
  border: none;
  color: #94a3b8;
}

.coil-input-group input {
  background: #232c3f !important;
  color: #f8fafc !important;
  border: none !important;
}

.coil-input-group input:focus {
  outline: none !important;
  box-shadow: none !important;
}

.coil-format-hint {
  font-size: 0.82rem;
  color: #94a3b8;
}

.coil-format-hint .hint-pink {
  color: #f472b6;
  font-weight: 600;
}

.coil-status-text {
  color: #00e1d9;
  font-size: 0.85rem;
  font-weight: 600;
}
```

- [ ] **Step 2: Xác nhận cú pháp CSS và commit Task 1**
```bash
git add assets/css/tem-nhan-kiem-ke/kiem-ke.css
git commit -m "feat(kiem-ke): add scanner modal and laser styles matching vi-tri-ton"
```

---

### Task 2: Cập nhật Cấu trúc HTML của `#cameraModal` trong kiem-ke.html

**Files:**
- Modify: `pages/tem-nhan-kiem-ke/kiem-ke.html:232-249`

**Interfaces:**
- Consumes: CSS classes from Task 1.
- Produces: HTML structure for `#cameraModal` with Header badge, Viewport `#cameraScannerContainer`, Laser line `.scan-laser-line`, Status text `#cameraStatusText`, Input `#modalBarcodeInput`, Button `#btnSubmitModalBarcode`, Hint `.coil-format-hint`, and Feedback container `#modalLastScanAlert`.

- [ ] **Step 1: Cập nhật `#cameraModal` trong `pages/tem-nhan-kiem-ke/kiem-ke.html`**
Thay thế khối `<div class="modal fade" id="cameraModal" ...>` hiện tại bằng:
```html
  <!-- CAMERA SCANNER MODAL (QUÉT MÃ VẠCH / QR CUỘN THÉP) -->
  <div class="modal fade" id="cameraModal" tabindex="-1" aria-labelledby="cameraModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content shadow-lg border-0 text-white">
        <!-- Header matching vi-tri-ton design -->
        <div class="modal-header py-2 px-3 align-items-center">
          <div class="d-flex align-items-center gap-2">
            <div class="rounded-3 d-flex align-items-center justify-content-center" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #10b981; width: 38px; height: 38px; flex-shrink: 0;">
              <i class="bi bi-qr-code-scan fs-5"></i>
            </div>
            <div>
              <h5 class="modal-title fw-bold text-white mb-0" style="font-size: 1.05rem;" id="cameraModalLabel">Quét Mã Vạch / QR Cuộn Thép</h5>
              <div class="text-secondary" style="font-size: 0.8rem;">Hướng camera vào mã vạch trên tem cuộn (Quét liên tục)</div>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <div class="modal-body p-3">
          <!-- Camera Viewport with Laser Beam -->
          <div id="cameraScannerContainer" class="scanner-viewport-box mb-2">
            <div id="cameraScannerReader" style="width: 100%; min-height: 290px; background: #000;"></div>
            <div class="scan-laser-line"></div>
          </div>

          <!-- Camera Status Text -->
          <div class="text-center mb-3">
            <span id="cameraStatusText" class="coil-status-text">Đang khởi động camera...</span>
          </div>

          <!-- Input Group: Keyboard icon + Input + Green Ghi nhận button -->
          <div class="input-group coil-input-group mb-1 shadow-sm">
            <span class="input-group-text">
              <i class="bi bi-keyboard fs-6"></i>
            </span>
            <input type="text" id="modalBarcodeInput" class="form-control fw-semibold" placeholder="Nhập hoặc bắn mã (VD: 10001189-2X349VN-1472)..." autocomplete="off">
            <button id="btnSubmitModalBarcode" class="btn btn-success fw-bold px-3 d-flex align-items-center gap-1 border-0" type="button">
              <i class="bi bi-check2-circle"></i> Ghi nhận
            </button>
          </div>

          <!-- Format Hint -->
          <div class="coil-format-hint mb-3 px-1">
            <i class="bi bi-info-circle me-1"></i> Định dạng tem cuộn: <span class="hint-pink">MãVT-Batch-Kg</span> hoặc <span class="hint-pink">MãVT-Batch</span>.
          </div>

          <!-- Live Scan Alert / In-modal feedback -->
          <div id="modalLastScanAlert" class="alert alert-dark border-secondary py-2 px-3 small d-none" role="alert">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-1">
              <span class="fw-bold text-success" id="modalLastScanTitle"><i class="bi bi-check-circle-fill me-1"></i> Đã quét thành công:</span>
              <span class="badge bg-secondary" id="modalLastScanTime">--:--:--</span>
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap mt-1">
              <span class="badge bg-primary" id="modalLastScanMaVT">Mã VT: ---</span>
              <span class="badge bg-secondary text-light" id="modalLastScanBatch">Batch: ---</span>
              <span class="badge bg-warning text-dark" id="modalLastScanKg">0 Kg</span>
              <span class="badge bg-info text-dark" id="modalLastScanCount">Lần 1</span>
            </div>
          </div>
        </div>

        <div class="modal-footer border-secondary py-2 justify-content-between">
          <span class="small text-muted fst-italic">Camera quét liên tục các cuộn tiếp theo</span>
          <button type="button" class="btn btn-sm btn-secondary px-4" data-bs-dismiss="modal">Hoàn thành &amp; Đóng</button>
        </div>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: Commit Task 2**
```bash
git add pages/tem-nhan-kiem-ke/kiem-ke.html
git commit -m "feat(kiem-ke): upgrade camera scanner modal HTML structure to match vi-tri-ton"
```

---

### Task 3: Cập nhật Logic Quét Liên Tục, Debounce & In-modal Feedback trong kiem-ke.js

**Files:**
- Modify: `assets/js/tem-nhan-kiem-ke/kiem-ke.js`

**Interfaces:**
- Consumes: `#cameraModal`, `#modalBarcodeInput`, `#btnSubmitModalBarcode`, `#modalLastScanAlert`, `processScannedBarcode()`.
- Produces: Continuous scanning flow, 2.5s debounce for identical barcodes, in-modal live feedback update.

- [ ] **Step 1: Cập nhật `processScannedBarcode` để trả về thông tin cuộn**
Chỉnh sửa cuối hàm `processScannedBarcode`:
```javascript
    return { rollItem, existingCount };
```

- [ ] **Step 2: Cập nhật hàm điều khiển Camera Scanner trong `kiem-ke.js`**
- Thêm biến debounce: `let lastScannedText = ''; let lastScannedTime = 0;`
- Viết hàm `updateModalScanFeedback({ rollItem, existingCount }, rawText)` để hiển thị thẻ `#modalLastScanAlert`.
- Cấu hình `qrbox: { width: 320, height: 180 }` cho `Html5Qrcode`.
- Trong `onScanSuccess(decodedText)`:
  + Kiểm tra nếu trùng `lastScannedText` và `(Date.now() - lastScannedTime) < 2500` thì bỏ qua.
  + Cập nhật `lastScannedText` và `lastScannedTime`.
  + Gọi `const res = processScannedBarcode(decodedText)`.
  + Gọi `updateModalScanFeedback(res, decodedText)`.
  + **Không gọi** `stopCameraScanner()` và `modal.hide()`, camera tiếp tục hoạt động.
- Sự kiện `shown.bs.modal`: Khởi động camera và focus vào `#modalBarcodeInput`.
- Sự kiện `hidden.bs.modal`: Tắt camera, reset `lastScannedText`, ẩn feedback, trả focus về `#barcodeInput`.
- Bắt sự kiện click `#btnSubmitModalBarcode` và phím `Enter` trên `#modalBarcodeInput`.

- [ ] **Step 3: Commit Task 3**
```bash
git add assets/js/tem-nhan-kiem-ke/kiem-ke.js
git commit -m "feat(kiem-ke): implement continuous scanning with debounce and in-modal feedback"
```

---

### Task 4: Đồng bộ Build (sync-dist) & Kiểm thử Xác thực Toàn diện

**Files:**
- Build script: `scripts/sync-dist.js`
- Test: Trình duyệt mở `pages/tem-nhan-kiem-ke/kiem-ke.html`

- [ ] **Step 1: Chạy lệnh build đồng bộ**
```bash
npm run build
```
Xác nhận tất cả các file trong `dist/`, `dist-app/`, `public/` đều được đồng bộ thành công.

- [ ] **Step 2: Kiểm tra xác thực tính năng**
- Mở modal camera: Giao diện chuẩn phong cách `#coilScanModal`, header badge xanh ngọc, tia laser quét hoạt hình mượt mà, khung viền bo góc sắc nét.
- Kiểm tra ô nhập `#modalBarcodeInput`: Bắn mã hoặc gõ mã nhấn Enter -> Ghi nhận và hiển thị feedback ngay trong modal.
- Quét qua camera: Quét liên tục thành công, âm thanh Beep vang lên, thẻ feedback hiển thị chính xác.
- Bấm "Hoàn thành & Đóng": Camera dừng an toàn, bảng đối soát cập nhật đầy đủ số lượng cuộn đã kiểm đếm.

- [ ] **Step 3: Commit hoàn thành Task 4**
```bash
git add .
git commit -m "chore(kiem-ke): sync build to dist, dist-app and public directories"
```
