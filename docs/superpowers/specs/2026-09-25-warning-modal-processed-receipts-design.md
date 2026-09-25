# Thiết Kế: Modal Cảnh Báo Phiếu Đã Nhập / Xuất Kho

**Ngày tạo:** 25/09/2026  
**Phạm vi áp dụng:** `xg-nhap.html`, `xg-xuat.html`, `tole-nhap.html`, `tole-xuat.html`  
**Mục tiêu:** Cảnh báo trực quan và chi tiết cho người dùng khi một số phiếu (chứng từ) đã từng được nhập hoặc xuất trước đó trong hệ thống, tránh trường hợp vô tình nhập/xuất trùng lặp nhưng vẫn cho phép tiếp tục nếu có chủ đích (ví dụ nhập/xuất theo từng đợt).

---

## 1. Bối Cảnh & Hiện Trạng

- Hiện tại trên cả 4 trang (`xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`), người dùng có thể tìm kiếm phiếu SAP qua Autocomplete (`xg-sap-lookup.js`) hoặc gõ tay số phiếu vào ô `input[name="col_3"]`.
- Khi một phiếu SAP đã được nhập hoặc xuất một phần hoặc toàn bộ trước đó:
  - Dropdown Autocomplete chưa phản ánh trạng thái đã có trong CSDL.
  - Form thêm dữ liệu không có cảnh báo khi chọn số phiếu đã tồn tại.
  - Khi submit form, nếu Cuộn ID không bị trùng lặp thì hệ thống vẫn cho lưu bình thường mà không hề có thông báo nhắc nhở nào về việc số phiếu này đã có bản ghi trong kho.

---

## 2. Nguyên Tắc & Quy Định Nghiệp Vụ

1. **Bảng và Cột Dữ Liệu Tương Ứng:**
   - `xg-nhap`: Bảng `xg-nhap`, Cột `Phiếu nhập` (hướng: Nhập, đơn vị: Kg)
   - `xg-xuat`: Bảng `xg-xuat`, Cột `Phiếu xuất` (hướng: Xuất, đơn vị: Kg)
   - `tole-nhap`: Bảng `tole-nhap`, Cột `Phiếu nhập` (hướng: Nhập, đơn vị: Kg + Mét)
   - `tole-xuat`: Bảng `tole-xuat`, Cột `Phiếu xuất` (hướng: Xuất, đơn vị: Kg + Mét)

2. **Cơ Chế Tra Cứu Sự Tồn Tại Của Phiếu:**
   - **Tầng 1 (Local In-Memory Cache):** Tra cứu ngay trong `window._rawSupabaseData` của trang (nếu có) để có kết quả tức thì (0ms latency).
   - **Tầng 2 (Supabase Remote Query):** Query kiểm tra bảng tương ứng qua `supabase.from(tableName).select('*').ilike(voucherColumn, docNo)`.
   - Tổng hợp dữ liệu phiếu đã có:
     - Tổng số dòng / số cuộn đã lưu.
     - Tổng khối lượng (Kg) đã lưu.
     - Ngày nhập/xuất đầu tiên & gần nhất.
     - Mã công trình & Tên công trình.
     - Danh sách các Cuộn ID đã ghi nhận.

3. **Ba Điểm Kích Hoạt Cảnh Báo (3-Layer Warning):**
   - **Lớp 1: Gợi ý Autocomplete SAP:** Hiển thị badge màu cam `⚠️ Đã nhập: X kg (Y cuộn)` hoặc `⚠️ Đã xuất: X kg (Y cuộn)` bên cạnh số phiếu trong danh sách dropdown.
   - **Lớp 2: Khi Chọn Phiếu / Rời Ô Nhập (Change/Blur):** Bật Modal cảnh báo chi tiết, hiển thị rõ số liệu đã nhập/xuất trước đó so với phiếu SAP. Cho phép người dùng bấm **"Hủy / Đổi phiếu"** hoặc **"Tiếp tục điền phiếu"**.
   - **Lớp 3: Chốt chặn khi Submit Form ("Thêm dữ liệu"):** Trước khi thực hiện insert dữ liệu, kiểm tra nếu số phiếu đã tồn tại trong CSDL và chưa được xác nhận bỏ qua trong phiên làm việc hiện tại, hiển thị modal xác nhận lần cuối.

---

## 3. Thiết Kế Chi Tiết Modal Cảnh Báo

### 3.1. Giao Diện Modal (`#receiptProcessedWarningModal`)
- **Header:** Màu cam hổ phách (`#f59e0b`) hoặc đỏ cam:
  - Icon: `<i class="bi bi-exclamation-triangle-fill me-2"></i>`
  - Tiêu đề: **CẢNH BÁO: PHIẾU ĐÃ [NHẬP/XUẤT] TRƯỚC ĐÓ**
- **Body:**
  - Lời dẫn: *"Số phiếu **[SỐ_PHIẾU]** đã có dữ liệu trong hệ thống **[TÊN_KHO]**. Chi tiết như sau:"*
  - Bảng thống kê tổng hợp:
    | Thông tin | Giá trị đã lưu trong hệ thống |
    | :--- | :--- |
    | **Loại nghiệp vụ** | Nhập kho (hoặc Xuất kho) |
    | **Số lần / Ngày ghi nhận** | 12/03/2026 (hoặc ngày gần nhất) |
    | **Công trình** | CT101 - Landmark |
    | **Tổng số lượng đã lưu** | **15.200 kg** (4 cuộn) |
    | **Danh sách Cuộn ID** | C001, C002, C003, C004 |
  - Nếu chọn từ SAP: Khung so sánh:
    - *Khối lượng trên SAP:* `15.200 kg`
    - *Khối lượng đã nhập/xuất:* `15.200 kg`
    - *Trạng thái:* `Đã nhập đủ 100% phiếu` (hoặc `Đã nhập một phần...`)
- **Footer:**
  - Nút bên trái: `<button class="btn btn-secondary">Hủy / Chọn phiếu khác</button>` -> Reset input, không điền dữ liệu.
  - Nút bên phải: `<button class="btn btn-warning text-dark fw-bold">Tiếp tục điền phiếu</button>` -> Đóng modal, đánh dấu đã xác nhận cho phiếu này, cho phép tiếp tục thao tác.

---

## 4. Thiết Kế Kỹ Thuật (Module & Interface)

### 4.1. Cập nhật `assets/js/xg/xg-sap-lookup.js`
- Bổ sung hàm: `checkReceiptProcessed(docNo, pageContext)`:
  - Nhận diện `tableName` và `colName` từ `pageContext` (`xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`).
  - Kiểm tra `window._rawSupabaseData` trước, sau đó query Supabase nếu cần.
  - Trả về `{ isProcessed: boolean, count: number, totalKg: number, totalM: number, records: Array, firstDate: string, lastDate: string, projects: Array }`.
- Bổ sung hàm: `showReceiptProcessedWarningModal(info, onConfirm, onCancel)`:
  - Tạo / hiển thị modal Bootstrap.
  - Xử lý callback khi người dùng bấm Hủy hoặc Tiếp tục.
- Cập nhật hàm `renderDropdown()` trong `initSapDocumentAutocomplete()`:
  - Cache nhanh các số phiếu đã tồn tại trong `window._rawSupabaseData` để render badge ngay lập tức.
  - Khi click chọn dòng đã có trong hệ thống, kích hoạt `showReceiptProcessedWarningModal`.
- Cập nhật event `change` của input: Kiểm tra phiếu gõ tay, nếu đã có thì hiện modal cảnh báo.

### 4.2. Cập nhật 4 file Controller (`xg-nhap.js`, `xg-xuat.js`, `tole-nhap.js`, `tole-xuat.js`)
- Trong sự kiện submit `addDataForm`:
  - Trước khi insert/gọi RPC, gọi `checkReceiptProcessed(docNo, currentContext)`.
  - Nếu đã có và người dùng chưa xác nhận tiếp tục (`!window._confirmedProcessedReceipts?.has(docNo)`):
    - Ngăn form submit.
    - Mở modal cảnh báo với callback: Nếu bấm xác nhận -> lưu lại vào `_confirmedProcessedReceipts` và tự động kích hoạt lại submit.

---

## 5. Kế Hoạch Kiểm Thử Tự Động

- Tạo file kiểm thử: `tests/test-receipt-already-processed-warning.js`
- Các ca kiểm thử (Test cases):
  1. Kiểm tra hàm `checkReceiptProcessed`:
     - Phiếu chưa tồn tại -> trả về `isProcessed: false`.
     - Phiếu đã tồn tại trong dữ liệu giả lập -> trả về `isProcessed: true` với đúng `totalKg`, `count`.
  2. Kiểm tra bộ lọc badge trong Autocomplete:
     - Dòng SAP có số phiếu đã nhập -> hiển thị badge cảnh báo.
  3. Kiểm tra chốt chặn Submit Form:
     - Khi số phiếu đã tồn tại và chưa xác nhận -> bị chặn và yêu cầu xác nhận.
     - Sau khi xác nhận -> cho phép đi tiếp.
- Chạy `node scripts/sync-dist.js` để cập nhật `public/`, `dist/`, `dist-app/`.
