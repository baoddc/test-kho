# Thiết Kế: Phân Loại Xà Gồ / Tole Khi Quét Phiếu Xuất Kho (XG-XUAT & TOLE-XUAT)

## 1. Tổng Quan & Bối Cảnh

Hệ thống quản lý xuất kho Đại Dũng có hai phân hệ kho xuất riêng biệt:
- **Kho Xà Gồ - Xuất** (`pages/xg/xg-xuat.html` kết hợp `assets/js/xg/xg-xuat.js`)
- **Kho Tole - Xuất** (`pages/tole/tole-xuat.html` kết hợp `assets/js/tole/tole-xuat.js`)

Cả hai phân hệ đều hỗ trợ nhập tự động từ ảnh phiếu xuất kho qua AI Vision OCR (`ReceiptOcrService`). Tuy nhiên, hiện tại khi người dùng tải lên, dán (`Ctrl + V`) hoặc chụp ảnh một phiếu xuất kho:
1. Hệ thống chưa có cơ chế kiểm tra và phân loại phiếu xuất đó thuộc về kho **Xà gồ** hay kho **Tole**.
2. Nếu thủ kho đang mở nhầm trang (ví dụ mở trang Xà Gồ Xuất nhưng lại quét phiếu Tole, hoặc ngược lại), dữ liệu vẫn được điền vào biểu mẫu của trang đó, tiềm ẩn nguy cơ xuất sai kho, sai dữ liệu tồn và sai lệch báo cáo kiểm kê.

**Mục tiêu**:
1. Tự động nhận diện và phân loại phiếu xuất kho thuộc về **Xà Gồ** hay **Tole** ngay sau khi quét ảnh OCR.
2. Nếu phiếu khớp với kho hiện tại: Tự động điền form bình thường và hiển thị nhãn xác nhận loại phiếu.
3. Nếu phiếu thuộc về kho khác:
   - Chặn không điền vào form của kho hiện tại.
   - Hiển thị hộp thoại cảnh báo phân hệ lệch rõ ràng, nêu số phiếu và căn cứ nhận diện.
   - Cung cấp nút bấm chuyển nhanh sang đúng trang (`SessionStorage Bridge`), tự động mở modal Thêm dữ liệu trên trang đích và điền sẵn 100% dữ liệu đã quét cùng ảnh preview.

---

## 2. Kiến Trúc Giải Pháp & Quy Tắc Phân Loại

### 2.1. Bộ Phân Loại Hai Tầng (`ReceiptOcrService.classifyReceipt`)
Được đặt tại `assets/js/core/receipt-ocr-service.js` để cả hai phân hệ tái sử dụng đồng nhất.

```
                  [Ảnh Phiếu Xuất Kho]
                           │
                           ▼
                 [ReceiptOcrService]
              (Trích xuất dữ liệu JSON)
                           │
                           ▼
          [classifyReceipt(receiptData, currentWarehouse)]
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    [Tầng 1: SAP MB51]         [Tầng 2: Từ Khóa Vận Hành]
    (Nếu có phieuXuat)         (Nếu chưa có trong SAP)
             │                           │
    - 10040 / 10041 -> 'xg'    - Xà gồ, thép phôi kẽm -> 'xg'
    - 10030 / 10031 /          - Phôi tôn, tôn mạ,
      10022 / 10091 -> 'tole'    inox, nhôm -> 'tole'
             └─────────────┬─────────────┘
                           ▼
            { targetWarehouse, isMatchCurrent, ... }
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      [isMatchCurrent]           [!isMatchCurrent]
    Điền dữ liệu vào form       Hiển thị Modal Cảnh Báo
                                & Nút Chuyển Trang Thông Minh
```

#### Tầng 1: Tra cứu trực tiếp bảng SAP MB51 (`xg_sap_mb51`)
- **Điều kiện**: `receiptData.phieuXuat` có giá trị.
- **Truy vấn**: `window.supabase.from('xg_sap_mb51').select('material_group, material, debit_credit_ind').ilike('material_document', receiptData.phieuXuat)`
- **Quy tắc phân loại**:
  - Nếu `material_group` bắt đầu bằng `10040` (`10040-Phôi xà gồ mạ`) hoặc `10041` (`10041-Xà gồ`):
    - `targetWarehouse: 'xg'` (Xà Gồ - Xuất)
    - `confidence: 'sap'`
    - `reason: 'Khớp nhóm SAP MB51: ' + material_group`
  - Nếu `material_group` bắt đầu bằng `10030` (`10030-Phôi tôn mạ`), `10031` (`10031-Tôn`), `10022` (`10022-Thép cuộn Inox`), hoặc `10091` (`10091-Nhôm cuộn`):
    - `targetWarehouse: 'tole'` (Tole - Xuất)
    - `confidence: 'sap'`
    - `reason: 'Khớp nhóm SAP MB51: ' + material_group`

#### Tầng 2: Dự phòng theo Mã hàng & Tên hàng từ dữ liệu OCR
- **Điều kiện**: Không tìm thấy số phiếu trong SAP MB51 (chưa kịp đồng bộ từ MB51 hoặc hệ thống offline).
- **Quy tắc phân loại**:
  - Quét qua mảng `items`:
    - Chuỗi kiểm tra = kết hợp tất cả `tenVatTu` và `maVatTu`.
    - **Xà gồ**: Khớp biểu thức quy chuẩn:
      `/(xà gồ|xa go|thép phôi kẽm|thep phoi kem|phôi kẽm|phoi kem|phôi xà gồ|phoi xa go)/i`
      hoặc mã vật tư thuộc dải xà gồ.
      -> `targetWarehouse: 'xg'`, `confidence: 'keywords'`, `reason: 'Tên hàng chứa quy cách Xà gồ'`.
    - **Tole**: Khớp biểu thức quy chuẩn:
      `/(phôi tôn|phoi ton|tôn cuộn|ton cuon|thép cuộn inox|nhôm cuộn|phôi thép mạ kẽm|tole|\btôn\b|\bton\b)/i`
      hoặc mã vật tư thuộc dải tole.
      -> `targetWarehouse: 'tole'`, `confidence: 'keywords'`, `reason: 'Tên hàng chứa quy cách Tole'`.
  - Nếu không khớp bên nào: `targetWarehouse: 'unknown'`.

#### Cấu trúc kết quả trả về của hàm:
```javascript
{
  targetWarehouse: 'xg' | 'tole' | 'unknown',
  confidence: 'sap' | 'keywords' | 'none',
  reason: string,
  isMatchCurrent: boolean,
  targetPageUrl: string, // '/pages/xg/xg-xuat.html' hoặc '/pages/tole/tole-xuat.html'
  targetLabel: string    // 'Kho Xà Gồ - Xuất' hoặc 'Kho Tole - Xuất'
}
```

---

## 3. Thiết Kế Trải Nghiệm Giao Diện (UX) & Cơ Chế Chuyển Trang

### 3.1. Hộp thoại Cảnh Báo Phân Hệ Lệch (`mismatchWarehouseModal`)
Khi `classification.isMatchCurrent === false` và `classification.targetWarehouse !== 'unknown'`:
- Hệ thống **không gọi** `populateFieldsFromOcr()`.
- Tạo hoặc cập nhật modal `#receiptWarehouseMismatchModal`:
  - **Header**: Nền màu cam/đỏ cánh báo (`bg-warning text-dark` hoặc `bg-danger text-white`), icon `bi-exclamation-triangle-fill`.
  - **Tiêu đề**: `PHÁT HIỆN PHIẾU XUẤT THUỘC ${classification.targetLabel.toUpperCase()}`
  - **Nội dung thân modal**:
    - Số phiếu: `<span class="badge bg-primary fs-6">${phieuXuat}</span>`
    - Căn cứ phân loại: `<span class="badge bg-info-subtle text-info border">${classification.reason}</span>`
    - Cảnh báo: *"Bạn đang thao tác trên trang **${currentLabel}**. Phiếu xuất này thuộc phân hệ **${classification.targetLabel}**."*
  - **Footer**:
    - Nút hành động chính: **`[👉 Chuyển sang ${classification.targetLabel} & Điền ngay]`** (`btn-primary` hoặc `btn-success`).
    - Nút phụ: **`[Đóng / Quét phiếu khác]`** (`btn-secondary`).

### 3.2. Cơ chế Bàn Giao Dữ Liệu Qua `SessionStorage Bridge`
1. **Lưu dữ liệu trước khi chuyển**:
   Khi người dùng nhấn `[👉 Chuyển sang ...]`:
   ```javascript
   const handoverPayload = {
     data: result.data,
     previewDataUrl: result.dataUrl,
     fileName: label || file.name || 'Ảnh phiếu xuất kho',
     fromWarehouse: currentWarehouse,
     timestamp: Date.now()
   };
   sessionStorage.setItem('pending_receipt_handover', JSON.stringify(handoverPayload));
   window.location.href = classification.targetPageUrl;
   ```

2. **Tiếp nhận dữ liệu tại trang đích**:
   Tại sự kiện khởi tạo trang (`DOMContentLoaded` / khởi tạo module của `xg-xuat.js` và `tole-xuat.js`):
   ```javascript
   function checkPendingReceiptHandover() {
     const raw = sessionStorage.getItem('pending_receipt_handover');
     if (!raw) return;
     sessionStorage.removeItem('pending_receipt_handover'); // Xóa ngay tránh kích hoạt lại
     try {
       const handover = JSON.parse(raw);
       if (Date.now() - handover.timestamp > 10 * 60 * 1000) return; // Hết hạn 10 phút

       // Mở modal Thêm dữ liệu
       openAddDataModal();

       // Điền dữ liệu
       populateFieldsFromOcr(handover.data);

       // Phục hồi preview ảnh nếu có
       const previewContainer = document.getElementById('ocrPreviewContainer');
       const previewThumb = document.getElementById('ocrPreviewThumb');
       const fileNameText = document.getElementById('ocrFileNameText');
       const dropzoneContent = document.querySelector('.ocr-dropzone-content');
       if (previewContainer && previewThumb && handover.previewDataUrl) {
         previewThumb.src = handover.previewDataUrl;
         if (fileNameText) fileNameText.textContent = handover.fileName || 'Ảnh phiếu chuyển từ kho khác';
         if (dropzoneContent) dropzoneContent.style.display = 'none';
         previewContainer.style.display = 'flex';
       }

       // Thông báo Toast cho người dùng
       showAutofillToast(`✓ Đã chuyển phiếu xuất ${handover.data.phieuXuat} sang ${CURRENT_PAGE_LABEL} thành công!`);
     } catch (e) {
       console.warn('Lỗi xử lý bàn giao phiếu xuất:', e);
     }
   }
   ```

---

## 4. Kế Hoạch Kiểm Thử (Testing Plan)

### 4.1. File Kiểm Thử Tự Động
Tạo `tests/test-receipt-warehouse-classification.js` kiểm tra:
1. `ReceiptOcrService.classifyReceipt`:
   - Phân loại qua dữ liệu SAP MB51 nhóm `10040`/`10041` -> `'xg'`.
   - Phân loại qua dữ liệu SAP MB51 nhóm `10030`/`10031`/`10022`/`10091` -> `'tole'`.
   - Phân loại qua từ khóa vật tư:
     - "Thép phôi kẽm 2.0x349VN Z275 G450" -> `'xg'`.
     - "Xà gồ mạ kẽm C200" -> `'xg'`.
     - "Phôi tôn mạ 0.5x1200 AZ150 G550" -> `'tole'`.
     - "Tôn cuộn mạ màu" -> `'tole'`.
     - "Thép cuộn Inox" -> `'tole'`.
2. Kiểm tra cờ `isMatchCurrent` theo ngữ cảnh trang `xg` và `tole`.
3. Kiểm tra tính toàn vẹn của payload bàn giao `SessionStorage Bridge`.

### 4.2. Kiểm Thử Giao Diện & Đồng Bộ
1. Chạy `node tests/test-receipt-warehouse-classification.js` đạt 100% PASS.
2. Chạy toàn bộ các test suite hiện có của dự án để đảm bảo không hồi quy.
3. Chạy `node scripts/sync-dist.js` để cập nhật bản build trong `public/`, `dist/`, và `dist-app/`.
