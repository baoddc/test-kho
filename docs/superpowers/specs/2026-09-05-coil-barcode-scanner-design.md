# Thiết Kế Chức Năng Quét Barcode Cuộn & Tra Cứu Tồn Kho Theo Batch (vi-tri-ton.html)

- **Ngày tạo**: 2026-09-05
- **Trạng thái**: Đã thống nhất thiết kế với người dùng

## 1. Mục tiêu & Bối cảnh
Tại trang **Tra cứu tồn kho theo vị trí kệ** (`pages/vi-tri-ton.html`), người dùng (thủ kho / kiểm kê) cần một công cụ quét nhanh mã Barcode trên cuộn theo định dạng:
`"Mã vật tư-Batch-Khối lượng"` (ví dụ: `10001189-2X349VN-1472`).

Dựa trên cặp `Mã vật tư` và `Batch` vừa quét:
1. Xác định trong toàn kho còn bao nhiêu cuộn và tổng khối lượng là bao nhiêu.
2. Đối soát ngay với kệ hiện tại (đang mở) xem có bao nhiêu cuộn thuộc batch này và khối lượng bao nhiêu.
3. Hiển thị danh sách phân bổ vị trí các cuộn còn tồn trong kho và cho phép chuyển nhanh tới kệ chứa cuộn đó.

## 2. Kiến trúc & Giải thuật Bóc Tách Barcode

### 2.1. Phân tích chuỗi Barcode
- Chuỗi quét có thể đến từ:
  - Máy quét mã vạch chuyên dụng (USB/Bluetooth HID Barcode Scanner) gửi chuỗi ký tự kèm phím Enter.
  - Camera điện thoại / máy tính thông qua thư viện `Html5Qrcode`.
  - Nhập tay trực tiếp từ bàn phím.
- Thuật toán bóc tách:
  ```javascript
  function parseCoilBarcode(rawText) {
    if (!rawText) return null;
    const text = String(rawText).trim();
    
    // Tách bằng dấu gạch ngang '-'
    const parts = text.split('-').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const maVatTu = parts[0];
      const rawKg = parts[parts.length - 1];
      const batch = parts.slice(1, parts.length - 1).join('-');
      const kg = parseFloat(rawKg.replace(',', '.'));
      return {
        maVatTu,
        batch,
        kg: isNaN(kg) ? null : kg,
        rawText
      };
    }
    return null;
  }
  ```
- Nếu chuỗi quét không đúng định dạng 3 phần nhưng lại là mã vị trí kệ (ví dụ `A01`, `B02`, `GRATING`), hệ thống nhận diện và gợi ý chuyển sang kệ đó.

### 2.2. Tính toán tồn kho theo Mã vật tư & Batch
- Dữ liệu tồn kho được tổng hợp từ danh sách nhập chưa xuất của cả Xà gồ (`xg-nhap` - `xg-xuat`) và Tole (`tole-nhap` - `tole-xuat`).
- Khi quét được `maVatTu` và `batch`:
  - Chuẩn hóa: `normMa = maVatTu.toLowerCase()` và `normBatch = batch.toLowerCase()`.
  - Lọc tất cả các cuộn tồn kho thoả mãn `Mã vật tư == normMa` và `Batch == normBatch`.
  - Tính toán:
    + `totalRolls`: Số cuộn còn tồn trên toàn kho.
    + `totalKg`: Tổng khối lượng các cuộn tồn trên toàn kho.
    + `currentRackRolls`: Danh sách cuộn của batch này đang nằm tại `currentRack`.
    + `otherRackRolls`: Danh sách cuộn của batch này đang nằm tại các kệ khác.

## 3. Giao diện người dùng (UI Components)

### 3.1. Nút "Quét Cuộn" tại Top Bar
- Vị trí: Đặt cạnh nút "Tải lại dữ liệu" (`#btnRefreshData`) ở thanh điều khiển trên cùng.
- Cấu trúc HTML:
  ```html
  <button id="btnScanCoil" class="btn btn-sm btn-outline-success shadow-sm d-inline-flex align-items-center gap-1 text-nowrap px-2" style="height: 32px; white-space: nowrap; flex-shrink: 0;" title="Quét Barcode cuộn (Mã VT-Batch-Khối lượng)">
    <i class="bi bi-upc-scan"></i> <span class="d-none d-sm-inline">Quét Cuộn</span>
  </button>
  ```

### 3.2. Modal Quét Cuộn & Đối Soát Tồn Kho (`#coilScanModal`)
- Modal kích thước `modal-lg`, theme tối đồng bộ với giao diện chung.
- **Khu vực đầu vào**:
  - Tab 1: **Camera Quét** (`#coilScannerReader`) hỗ trợ đa định dạng mã (Code 128, Code 39, EAN-13, QR Code).
  - Tab 2 / Ô input: **Ô nhập nhanh Barcode** (`#coilBarcodeInput`) tự động focus khi mở modal, hỗ trợ súng bắn barcode và phím Enter.
- **Khu vực hiển thị kết quả**:
  - **Thẻ Tóm tắt cuộn**:
    + Mã vật tư: `maVatTu` | Tên vật tư: `tenVatTu`
    + Batch: `batch` | Khối lượng tem: `kg` Kg
  - **Thẻ Thống kê Tồn kho**:
    + 🌐 **Tồn toàn kho**: `X cuộn` — `Y Kg`
    + 📍 **Tại kệ hiện tại (`currentRack`)**: `Z cuộn` — `W Kg` (nổi bật màu xanh nếu có, màu vàng/cam nếu chưa có ở kệ này).
  - **Bảng chi tiết cuộn tồn kho**:
    + Cột: STT, Vị trí kệ, Cuộn ID, Khối lượng (Kg), Ngày nhập, Lưu kho (ngày), Hành động ("Xem Kệ" nếu ở kệ khác).
    + Dòng cuộn trùng khớp với khối lượng tem vừa quét sẽ được highlight nhẹ để dễ nhận diện.

## 4. Xử lý lỗi & Tình huống đặc biệt
1. **Quét mã không đúng định dạng**: Thông báo hướng dẫn người dùng cấu trúc hợp lệ (`Mã vật tư-Batch-Khối lượng`).
2. **Batch không còn cuộn nào tồn trong kho**: Hiển thị thông báo "Đã xuất hết kho hoặc chưa từng nhập cuộn nào cho Batch này".
3. **Quét nhầm mã QR vị trí kệ**: Tự động nhận diện kệ và hỏi người dùng có muốn chuyển đến kệ đó hay không.
4. **Không bật được camera**: Hiển thị hướng dẫn chuyển sang dùng ô nhập nhanh hoặc súng quét mã vạch cầm tay.

## 5. Kế hoạch Kiểm thử & Xác minh
- Kiểm thử đơn vị (Unit test) hàm `parseCoilBarcode` với các trường hợp:
  - Mã chuẩn: `10001189-2X349VN-1472`
  - Batch có dấu gạch: `10001189-2X-349VN-1472.5`
  - Khối lượng dạng phẩy: `10001264-VN-2130,5`
  - Chuỗi không hợp lệ: `A01`, `10001189`, rỗng.
- Kiểm thử giao diện và tương tác trên trang `vi-tri-ton.html`.
- Kiểm thử luồng tính toán tồn kho toàn kho và đối soát kệ hiện tại.
