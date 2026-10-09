# Thiết Kế Kỹ Thuật: Tính Năng Nạp Cuộn Quét Bằng File .CSV (Kiểm Kê Kho)

## 1. Tổng Quan & Mục Tiêu

Hệ thống Kiểm kê tồn kho bằng máy quét và đối soát file (`pages/tem-nhan-kiem-ke/kiem-ke.html`) hiện hỗ trợ:
1. Nạp file Excel cơ sở kiểm kê (Cột G, K, O) làm dữ liệu chuẩn.
2. Quét mã vạch từng cuộn thực tế bằng súng quét mã vạch (USB/Bluetooth), camera điện thoại, hoặc nhập tay.

Mục tiêu mới:
Cho phép người dùng nạp danh sách cuộn đã quét thực tế từ file `.csv` (hoặc `.txt`) để tự động bổ sung hàng loạt vào danh sách cuộn đã kiểm đếm (`scannedRolls`), thay vì phải quét từng cuộn một tại chỗ (phù hợp khi sử dụng máy kiểm kho PDA, máy quét cầm tay offline xuất file CSV, hoặc danh sách quét thu thập từ nhiều đội kiểm kê).

---

## 2. Giao Diện Người Dùng & Thao Tác (UI / UX)

### 2.1. Nút nạp CSV trên thanh công cụ chính (`kiem-ke.html`)
- Vị trí: Đặt trong cụm công cụ Quét Barcode trung tâm, ngay cạnh nút Camera:
  ```html
  <label for="csvScanFileInput" data-perm="add" class="btn btn-sm btn-outline-warning shadow-sm d-inline-flex align-items-center gap-1 text-nowrap px-2" style="cursor: pointer;" title="Nạp danh sách cuộn quét từ file .CSV">
    <i class="bi bi-filetype-csv"></i> <span class="d-none d-md-inline">Nạp CSV</span>
  </label>
  <input type="file" id="csvScanFileInput" accept=".csv, .txt" class="d-none">
  ```
- Màu sắc: `btn-outline-warning` (vàng cam), dễ nhận biết, phân biệt rõ với nút xanh lơ của File Excel cơ sở và nút xanh lá của Camera.

### 2.2. Nút bấm tại Tab 2 ("Cuộn Đã Quét")
- Bổ sung nút bấm phụ `[Nạp file .CSV]` cạnh nút `[Đặt lại danh sách]` để người dùng thao tác tiện lợi ngay khi xem danh sách chi tiết các cuộn quét.

### 2.3. Phản hồi trạng thái (Feedback & Toast)
- Hiển thị spinner ngắn trong lúc xử lý file lớn.
- Phát âm thanh beep thành công (`playBeepSuccess()`).
- Hiển thị Toast thông báo:
  - Thành công: `"Đã nạp thành công {N} cuộn từ file {fileName} (Tổng {Kg} kg)"`.
  - Có dòng bị bỏ qua: Thông báo kèm số dòng bỏ qua do sai cú pháp hoặc rỗng.

---

## 3. Kiến Trúc Xử Lý & Dữ Liệu

### 3.1. Phân tích cú pháp dữ liệu CSV (`KiemKeEngine.parseCsvScannedRolls`)
Vị trí: `assets/js/tem-nhan-kiem-ke/kiem-ke-engine.js`

Xử lý các đặc điểm của file CSV:
- Xử lý mã hóa UTF-8 và UTF-8 BOM (`\uFEFF`).
- Tách dòng theo `\r\n` hoặc `\n`.
- Tự động nhận diện dấu phân cách: dấu phẩy `,`, dấu chấm phẩy `;`, tab `\t`.
- Tự động nhận diện 2 dạng tệp:
  1. **Dạng danh sách Barcode theo dòng (1 cột):**
     - Mỗi dòng là 1 chuỗi mã tem cuộn (VD: `10001189-2X349VN-1472` hoặc `10001189-2X349VN`).
     - Tự động bỏ qua dòng rỗng hoặc dòng header chứa chữ `"barcode"`, `"mã"`, `"material"`.
     - Phân tích cú pháp lấy `maVatTu`, `batch`, `kg` bằng hàm phân tích tem hiện có.
  2. **Dạng bảng có nhiều cột (có Header):**
     - Đọc dòng đầu tiên để ánh xạ tên cột:
       - Cột Barcode: `barcode`, `mã vạch`, `ma vach`, `cuộn id`, `cuon id`.
       - Cột Mã vật tư: `mã vật tư`, `ma vat tu`, `mã vt`, `ma vt`, `material`.
       - Cột Batch: `batch`, `lô`, `lo`.
       - Cột Khối lượng: `khối lượng`, `khoi luong`, `kg`, `số lượng`, `so luong`, `weight`.
     - Nếu có cột Barcode thì ưu tiên lấy Barcode; nếu có các cột tách rời thì tự ghép thành `barcode` tương ứng `maVatTu-batch-kg`.
- Trả về cấu trúc kết quả:
  ```javascript
  {
    validRolls: [
      {
        barcode: string,
        maVatTu: string,
        batch: string,
        kg: number,
        timestamp: string,
        scannedBy: string
      }
    ],
    skippedCount: number,
    totalKg: number
  }
  ```

### 3.2. Lưu trữ & Đồng bộ Supabase (`KiemKeStorage.insertBatchScannedRollsToSupabase`)
Vị trí: `assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js`

- Hỗ trợ nạp hàng loạt (`batch insert`) lên bảng `kiem_ke_scans` trên Supabase.
- Chia nhỏ mảng bản ghi theo mẻ (chunks 100 bản ghi/lần) để đảm bảo tốc độ cao, không vượt quá giới hạn payload HTTP và không nghẽn Realtime.
- Cập nhật ID và `createdAt` trả về từ Supabase cho các đối tượng cuộn.
- Cập nhật bộ đệm LocalStorage (`saveSession`).

### 3.3. Tích hợp Controller (`kiem-ke.js`)
Vị trí: `assets/js/tem-nhan-kiem-ke/kiem-ke.js`

- Lắng nghe sự kiện `change` trên `#csvScanFileInput` (và nút phụ ở Tab 2).
- Sử dụng `FileReader` đọc tệp văn bản.
- Gọi hàm `KiemKeEngine.parseCsvScannedRolls`.
- Thực hiện nối tiếp (`append`) các cuộn hợp lệ vào đầu mảng `scannedRolls`.
- Lưu session vào LocalStorage.
- Chạy nền tiến trình nạp hàng loạt lên Supabase `kiem_ke_scans`.
- Gọi `recalculateAndRender()` để cập nhật tức thì:
  - Thẻ thống kê: Đã quét (Kg / Cuộn), Khớp/Lệch, Tiến độ kiểm đếm.
  - Bảng tổng hợp đối soát (Tab 1).
  - Bảng cuộn đã quét (Tab 2).
- Reset giá trị `input.value = ''` để cho phép người dùng chọn lại file mà không bị chặn.

---

## 4. Xử Lý Lỗi & Trường Hợp Đặc Biệt (Edge Cases)

1. **File rỗng hoặc không có dữ liệu hợp lệ:**
   - Hiển thị thông báo Toast cảnh báo: `"File CSV không chứa dữ liệu cuộn quét hợp lệ."`.
   - Giữ nguyên dữ liệu hiện có.
2. **Dòng chứa ký tự đặc biệt hoặc số thập phân kiểu Việt Nam (dấu phẩy):**
   - Hàm `normalizeNumber` xử lý linh hoạt cả `1472.5` lẫn `1472,5`.
3. **Mất kết nối mạng trong lúc đồng bộ Supabase:**
   - Dữ liệu cuộn quét vẫn được lưu toàn vẹn trong bộ nhớ ứng dụng và `LocalStorage`, hiển thị đầy đủ trên giao diện.
   - Ghi log cảnh báo trên Console mà không ngắt quãng phiên kiểm kê của người dùng.
4. **Quyền truy cập:**
   - Thêm thuộc tính `data-perm="add"` cho nút bấm để đồng bộ với cơ chế phân quyền RBAC hiện tại của ứng dụng.

---

## 5. Kế Hoạch Kiểm Thử (Verification Plan)

1. **Kiểm thử đọc file CSV 1 cột (danh sách barcode):**
   - Tạo file test mẫu chứa 5 mã tem dạng `10001189-2X349VN-1472`.
   - Nạp vào hệ thống, xác minh 5 cuộn xuất hiện trong Tab "Cuộn Đã Quét" với đúng Mã VT, Batch, Kg.
2. **Kiểm thử đọc file CSV nhiều cột (có Header):**
   - Tạo file test mẫu có các cột `Mã vật tư, Batch, Khối lượng` hoặc `Barcode, Kg`.
   - Nạp vào hệ thống, xác minh dữ liệu bóc tách chính xác.
3. **Kiểm thử tính toán đối soát 3 chiều:**
   - Xác minh số Kg và số cuộn cộng dồn chính xác vào thẻ thống kê và bảng đối soát Tab 1.
4. **Kiểm thử phân quyền & giao diện:**
   - Kiểm tra hiển thị nút trên giao diện màn hình máy tính và màn hình điện thoại di động (responsive).
