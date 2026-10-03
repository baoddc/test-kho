# Thiết Kế Kỹ Thuật: Khóa Phiếu Nhập Cấp Loại (Mã Vật Tư + Batch) Cho Kho Xà Gồ Và Kho Tole

## 1. Tổng Quan & Bối Cảnh
- **Vấn đề:** Hiện tại khi một số phiếu SAP (chứng từ) đã có bất kỳ dòng nào được nhập kho thì toàn bộ số phiếu đó bị khóa hoàn toàn. Tuy nhiên, trên thực tế một phiếu nhập kho từ SAP MB51 có thể chứa nhiều loại mặt hàng khác nhau (phân biệt theo `Mã vật tư` + `Batch`). Việc khóa toàn bộ số phiếu khiến các loại còn lại trong cùng một phiếu không thể nhập tiếp được.
- **Mục tiêu:** Chuyển đổi cơ chế khóa từ cấp số phiếu sang **cấp loại cụ thể (`Mã vật tư` + `Batch`)** trên cả 2 màn hình nhập:
  - `pages/xg/xg-nhap.html` (Bảng `xg-nhap`)
  - `pages/tole/tole-nhap.html` (Bảng `tole-nhap`)
  - Các module tra cứu tập trung tại `assets/js/xg/xg-sap-lookup.js`.

---

## 2. Kiến Trúc Dữ Liệu & Định Danh Loại Hàng

### 2.1. Tiêu chí định danh "Loại" (Item)
Một loại vật tư trong phiếu nhập được xác định duy nhất bởi bộ 3:
$$\text{Loại} = (\text{Số phiếu nhập}, \text{Mã vật tư}, \text{Batch})$$
- `Phiếu nhập`: Cột `Phiếu nhập` trong bảng kho tương ứng với `material_document` của SAP MB51.
- `Mã vật tư`: Cột `Mã vật tư` trong bảng kho tương ứng với `material` của SAP MB51.
- `Batch`: Cột `Batch` trong bảng kho tương ứng với `batch` của SAP MB51.

### 2.2. Trạng thái của một Loại
- **ĐÃ NHẬP (ĐÃ KHÓA):** Trong bảng kho (`xg-nhap` hoặc `tole-nhap`) đã có ít nhất một bản ghi khớp cả 3 trường `Phiếu nhập`, `Mã vật tư` và `Batch`. Loại này bị khóa, không cho nhập thêm để tránh trùng lặp.
- **CHƯA NHẬP (MỞ):** Chưa có bản ghi nào trong kho khớp bộ 3 này. Loại này sẵn sàng cho phép chọn và nhập kho bình thường.

### 2.3. Trạng thái của một Phiếu nhập
- **Chưa nhập:** Không có dòng nào của phiếu trong kho.
- **Đang nhập dở dang:** Đã nhập 1 hoặc một số loại, vẫn còn ít nhất 1 loại chưa nhập. $\rightarrow$ Không khóa phiếu, cho phép chọn các loại còn lại.
- **Đã hoàn tất (Đã khóa toàn phiếu):** Tất cả các loại của phiếu trên SAP đều đã có trong kho. $\rightarrow$ Khóa toàn bộ phiếu.

---

## 3. Thiết Kế Chi Tiết Các Module

### 3.1. Module Tra Cứu: `assets/js/xg/xg-sap-lookup.js`

#### A. Hàm kiểm tra cấp loại: `checkReceiptItemProcessed(docNo, material, batch, pageContext)`
- **Tham số:**
  - `docNo`: Chuỗi số phiếu nhập.
  - `material`: Chuỗi mã vật tư.
  - `batch`: Chuỗi lô/batch.
  - `pageContext`: `'xg-nhap'` | `'tole-nhap'` (mặc định nhận diện theo trang).
- **Thuật toán:**
  1. Chuẩn hóa chuỗi tìm kiếm (trim, lowercase).
  2. Tra cứu In-Memory Cache `window._rawSupabaseData`:
     Lọc các bản ghi khớp `Phiếu nhập == docNo`, `Mã vật tư == material` và `Batch == batch`.
  3. Nếu không có trong cache, query Supabase bảng kho tương ứng với 3 điều kiện `eq` / `ilike`.
  4. Tính toán tổng khối lượng `totalKg`, tổng mét `totalM`, đếm số lượng cuộn `count`, danh sách mã cuộn `coilIds`.
- **Trả về:**
  ```javascript
  {
    isProcessed: boolean,
    count: number,
    totalKg: number,
    totalM: number,
    records: Array,
    coilIds: Array,
    dates: Array,
    projectNames: Array
  }
  ```

#### B. Hàm đánh giá tổng thể phiếu: `checkReceiptProcessed(docNo, pageContext)`
- Bổ sung trường `itemsSummary`:
  - `totalItems`: Tổng số loại trên SAP của phiếu.
  - `processedItems`: Số loại đã nhập vào kho.
  - `remainingItems`: Số loại chưa nhập.
  - `isAllItemsProcessed`: Boolean (`true` khi tất cả các loại đã nhập).

#### C. Cập nhật Dropdown Autocomplete (`renderDropdown`)
- Với mỗi nhóm SAP `g` (`doc`, `material`, `batch`):
  - Gọi kiểm tra `checkReceiptItemProcessed(g.material_document, g.material, g.batch, currentContext)`.
  - Nếu đã nhập:
    - Hiển thị badge: `[Đã nhập (X kg) - KHÓA]`.
    - Thêm class hoặc style mờ để phân biệt trực quan.
  - Nếu chưa nhập:
    - Hiển thị badge khối lượng SAP bình thường.
- **Sự kiện click vào dòng dropdown:**
  - Click vào dòng **ĐÃ NHẬP**:
    - Hiển thị Modal Cảnh Báo Khóa: thông báo rõ loại `Mã vật tư` - `Batch` của phiếu này đã được nhập trước đó, nêu rõ tổng kg và số cuộn đã nhập.
    - Không xóa số phiếu trên input, để người dùng có thể click lại chọn loại khác.
  - Click vào dòng **CHƯA NHẬP**:
    - Gọi `applySapRecordToForm(g, formEl, currentContext)` điền tự động dữ liệu của dòng đó vào form. Không hiện cảnh báo.

#### D. Xử lý sự kiện `change` / blur trên ô nhập số phiếu
- Khi người dùng nhập/dán số phiếu và rời ô:
  - Tra cứu các nhóm loại của phiếu trên SAP.
  - Nếu phiếu có nhiều loại:
    - Nếu vẫn còn loại chưa nhập: **Không** chặn và không xóa input; tự động hiển thị dropdown gợi ý danh sách các loại để người dùng chọn loại chưa nhập.
    - Nếu tất cả các loại đều đã nhập: Hiển thị modal chặn toàn bộ phiếu.

---

### 3.2. Chốt Chặn Khi Submit Form (`xg-nhap.js` & `tole-nhap.js`)

#### A. Trang `xg-nhap.js`
- Trong sự kiện submit form `#addDataModal`:
  - Lấy giá trị:
    - `phieuNhap = input[name="col_3"].value`
    - `maVatTu = input[name="col_5"].value`
    - `batch = input[name="col_7"].value`
  - Gọi `checkReceiptItemProcessed(phieuNhap, maVatTu, batch, 'xg-nhap')`.
  - Nếu `procCheck.isProcessed === true`:
    - Chặn submit, khôi phục nút bấm submit, ẩn loading.
    - Hiển thị `showReceiptProcessedWarningModal` với thông tin chi tiết loại đã nhập.
  - Nếu `procCheck.isProcessed === false`:
    - Tiếp tục tiến trình lưu bình thường.

#### B. Trang `tole-nhap.js`
- Tương tự với context `'tole-nhap'`.

---

## 4. Kế Hoạch Kiểm Thử & Đồng Bộ Build

1. **Bộ Test Suite:** `tests/test-receipt-already-processed-warning.js`
   - Test 1: Kiểm tra `checkReceiptItemProcessed` với loại đã nhập $\rightarrow$ trả về `isProcessed: true`.
   - Test 2: Kiểm tra `checkReceiptItemProcessed` với loại chưa nhập trong cùng một số phiếu $\rightarrow$ trả về `isProcessed: false`.
   - Test 3: Kiểm tra dropdown gắn đúng badge khóa cho loại đã nhập và giữ nguyên loại chưa nhập.
   - Test 4: Kiểm tra submit chặn đúng loại đã nhập và cho phép submit loại chưa nhập.
2. **Đồng bộ bản build:**
   - Chạy `npm run build` để đồng bộ các thay đổi vào `public/`, `dist/`, `dist-app/`.
