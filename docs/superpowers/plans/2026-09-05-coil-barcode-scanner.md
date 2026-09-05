# Kế Hoạch Triển Khai: Quét Barcode Cuộn & Tra Cứu Tồn Kho Theo Batch (vi-tri-ton.html)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm chức năng quét Barcode cuộn định dạng `"Mã vật tư-Batch-Khối lượng"` trên trang `vi-tri-ton.html`, xác định số lượng cuộn và tổng khối lượng còn tồn trong toàn kho theo Batch, đồng thời đối soát chi tiết với kệ hiện tại đang mở.

**Architecture:** Bổ sung hàm parser bóc tách Barcode và scanner đa định dạng mã vạch trong `qr-scanner-service.js`. Thiết kế giao diện nút bấm "Quét Cuộn" trên Top Bar và Modal tra cứu thông minh trên `vi-tri-ton.html`. Xử lý tra cứu tồn kho tức thì (0ms latency) từ cache/dữ liệu Supabase XG & Tole đã nạp, hiển thị thống kê tổng và bảng chi tiết phân bổ kệ kèm điều hướng 1-click trong `vi-tri-ton.js`.

**Tech Stack:** JavaScript (ES6+), Bootstrap 5, Html5Qrcode (1D & 2D Barcodes), Supabase JS Client, Node.js (test runner).

---

## Danh Sách Tasks

### Task 1: Xây dựng & Kiểm thử Đơn vị Hàm Bóc Tách Barcode Cuộn (`parseCoilBarcode`)
**Files:**
- Modify: `assets/js/core/qr-scanner-service.js`
- Test: `tests/coil-barcode-parser.test.js`

- [ ] **Step 1: Viết test case kiểm thử thất bại (Failing Test)**
  Tạo file `tests/coil-barcode-parser.test.js` kiểm tra các trường hợp:
  + Mã chuẩn 3 phần: `"10001189-2X349VN-1472"` -> `{ maVatTu: '10001189', batch: '2X349VN', kg: 1472 }`
  + Batch chứa dấu gạch nối: `"10001189-2X-349VN-1472.5"` -> `{ maVatTu: '10001189', batch: '2X-349VN', kg: 1472.5 }`
  + Khối lượng có dấu phẩy thập phân: `"10001264-VN-2130,5"` -> `{ maVatTu: '10001264', batch: 'VN', kg: 2130.5 }`
  + Ký tự phân cách linh hoạt (khoảng trắng thừa, ký tự gạch dưới): xử lý chuẩn hóa.
  + Chuỗi không hợp lệ hoặc mã kệ: trả về `null` hoặc `isRack: true`.

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
  Chạy `node tests/coil-barcode-parser.test.js` -> kỳ vọng báo lỗi chưa có hàm.

- [ ] **Step 3: Cài đặt hàm `parseCoilBarcode` trong `assets/js/core/qr-scanner-service.js`**
  Cài đặt logic bóc tách và export vào `window.qrScannerService.parseCoilBarcode` và `module.exports` cho môi trường Node.js.

- [ ] **Step 4: Chạy lại test để xác nhận test pass 100%**
  Chạy `node tests/coil-barcode-parser.test.js` -> PASS tất cả các case.

- [ ] **Step 5: Commit mã nguồn Task 1**
  `git add assets/js/core/qr-scanner-service.js tests/coil-barcode-parser.test.js && git commit -m "feat: add parseCoilBarcode helper and unit tests"`

---

### Task 2: Cập nhật Giao diện HTML & Modal Tra Cứu trên `pages/vi-tri-ton.html`
**Files:**
- Modify: `pages/vi-tri-ton.html`
- Modify: `assets/css/vi-tri-ton.css`

- [ ] **Step 1: Thêm nút "Quét Cuộn" trên thanh Top Bar**
  Thêm nút `#btnScanCoil` có icon `bi-upc-scan` màu xanh lá (outline-success) ngay cạnh nút làm mới `#btnRefreshData` đúng vị trí mũi tên đỏ.

- [ ] **Step 2: Thêm Modal Tra Cứu Cuộn & Tồn Kho Theo Batch (`#coilScanModal`)**
  Modal bao gồm:
  + Header: Tiêu đề "Quét Barcode Cuộn & Tra Cứu Tồn Kho" + Nút đóng.
  + Body:
    * Ô nhập liệu nhanh Barcode + Nút "Tra cứu" (tự động focus cho súng bắn barcode).
    * Khung Camera Scanner (có nút Bật/Tắt camera quét Barcode).
    * Khu vực Alert thông báo lỗi / cảnh báo.
    * Card Thống kê Tóm tắt:
      - Badge thông tin cuộn quét: Mã VT, Tên VT, Batch, Khối lượng tem.
      - Thống kê Tồn Toàn Kho: `[X cuộn | Y Kg]`.
      - Thống kê Đối Soát Kệ Hiện Tại: `[Z cuộn | W Kg tại Kệ ...]`.
    * Bảng danh sách chi tiết các cuộn tồn của Batch này (Vị trí kệ, Cuộn ID, Khối lượng Kg, Ngày nhập, Lưu kho, Thao tác "Xem kệ").
  + Footer: Nút đóng và trạng thái.

- [ ] **Step 3: Bổ sung CSS tùy chỉnh trong `assets/css/vi-tri-ton.css`**
  Styling cho nút quét, camera viewport, các chip thống kê đối soát kệ và highlight dòng cuộn trùng khớp khối lượng.

- [ ] **Step 4: Commit mã nguồn Task 2**
  `git add pages/vi-tri-ton.html assets/css/vi-tri-ton.css && git commit -m "feat(ui): add scan coil button and lookup modal to vi-tri-ton.html"`

---

### Task 3: Xử lý Logic Tra Cứu Tồn Kho & Điều Khiển Modal trong `assets/js/vi-tri-ton.js`
**Files:**
- Modify: `assets/js/vi-tri-ton.js`

- [ ] **Step 1: Quản lý dữ liệu tồn kho toàn cục (`allActiveRolls`)**
  Lưu trữ danh sách toàn bộ cuộn đang tồn trong kho (cả XG & Tole) sau khi nạp từ Supabase vào biến bộ nhớ `allActiveInventory` để tra cứu tức thì 0ms.

- [ ] **Step 2: Điều khiển Camera Scanner & Nhập Barcode**
  + Khi mở modal, tự động focus ô `#coilBarcodeInput`.
  + Bắt sự kiện `keydown` (Enter) trên `#coilBarcodeInput` để tự động kích hoạt tra cứu.
  + Hỗ trợ bật Camera quét Barcode 1D (Code 128, Code 39, EAN-13) và QR Code qua `Html5Qrcode`.

- [ ] **Step 3: Logic tính toán tồn kho theo Batch và hiển thị kết quả**
  + Lấy `maVatTu` và `batch` từ kết quả parser.
  + Lọc tất cả cuộn tồn có cùng `Mã vật tư` và `Batch`.
  + Tính tổng số cuộn toàn kho, tổng kg toàn kho.
  + Đếm số cuộn và số kg đang nằm tại `currentRack`.
  + Render bảng danh sách cuộn phân bổ:
    * Nếu cuộn nằm tại `currentRack`: hiển thị nhãn "Tại kệ này".
    * Nếu cuộn nằm tại kệ khác: hiển thị nút "Chuyển đến kệ" (`selectRack(rack)` và đóng modal).
    * Highlight cuộn có khối lượng trùng khớp với khối lượng tem quét.

- [ ] **Step 4: Commit mã nguồn Task 3**
  `git add assets/js/vi-tri-ton.js && git commit -m "feat: implement coil barcode lookup and batch inventory comparison"`

---

### Task 4: Đồng Bộ Bản Build & Cập Nhật Các Thư Mục Liên Quan
**Files:**
- Sync: `public/`, `dist/`, `dist-app/`

- [ ] **Step 1: Chạy build script**
  Chạy `npm run build` để đồng bộ các thay đổi sang `public/`, `dist/`, `dist-app/`.
- [ ] **Step 2: Commit các file build**
  `git add public/ dist/ dist-app/ && git commit -m "build: sync dist files for coil barcode scanner"`

---

### Task 5: Kiểm Thử Toàn Diện & Đánh Giá Thực Tế (E2E Verification)
- [ ] **Step 1: Chạy toàn bộ test suites**
  Chạy `node tests/coil-barcode-parser.test.js` và `node tests/qr-scanner-service.test.js`.
- [ ] **Step 2: Kiểm thử trực quan trên giao diện**
  Mở trang `vi-tri-ton.html`, kiểm tra nút bấm, mở modal, nhập thử mã mẫu `10001189-2X349VN-1472`, kiểm tra kết quả thống kê toàn kho, đối soát kệ hiện tại và nút điều hướng chuyển kệ.
