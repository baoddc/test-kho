# Thiết kế Kỹ thuật: Phân Loại & Ràng Buộc Dữ Liệu SAP MB51 (Google Sheets) Cho Kho Xà Gồ và Tole

- **Ngày tạo**: 2026-09-25
- **Trạng thái**: Đã phê duyệt
- **Phạm vi áp dụng**: `xg-nhap.html`, `xg-xuat.html`, `tole-nhap.html`, `tole-xuat.html` và các file liên quan (`xg-sap-lookup.js`, `sync-mb51-to-supabase.py`, `setup_xg_sap_mb51.sql`).

---

## 1. Bối cảnh & Yêu cầu Nghiệp Vụ

Dữ liệu kế toán xuất nhập kho từ SAP được tổng hợp tại Google Sheets (sheet `mb51`, Spreadsheet ID: `1BPY6k2bQuDu-RNpkRc3BhS57CuM1Ol__FYXvY8ezRjs`) và đồng bộ về bảng trung gian Supabase `xg_sap_mb51`.

Để đảm bảo dữ liệu khi tra cứu autocomplete và tự động điền (autofill) vào các form nhập/xuất kho không bị lẫn lộn giữa:
- **Nghiệp vụ Nhập kho (Debit) vs Xuất kho (Credit)**
- **Ngành hàng Xà Gồ vs Ngành hàng Tole (Tôn / Inox / Nhôm)**

Hệ thống cần áp dụng các quy tắc ràng buộc chặt chẽ như sau:

### 1.1. Ma trận Ràng buộc Dữ liệu

| Màn hình / File | Loại chứng từ (`Debit/Credit Ind.`) | Nhóm vật tư cho phép (`Phân nhóm / Material group`) |
| :--- | :---: | :--- |
| **`xg-nhap.html`** (Kho Xà Gồ - Nhập) | **`S`** | `10040-Phôi xà gồ mạ`, `10041-Xà gồ` |
| **`xg-xuat.html`** (Kho Xà Gồ - Xuất) | **`H`** | `10040-Phôi xà gồ mạ`, `10041-Xà gồ` |
| **`tole-nhap.html`** (Kho Tole - Nhập) | **`S`** | `10030-Phôi tôn mạ`, `10031-Tôn`, `10022-Thép cuộn Inox`, `10091-Nhôm cuộn` |
| **`tole-xuat.html`** (Kho Tole - Xuất) | **`H`** | `10030-Phôi tôn mạ`, `10031-Tôn`, `10022-Thép cuộn Inox`, `10091-Nhôm cuộn` |

---

## 2. Thiết kế Kiến trúc & Cơ sở Dữ liệu

### 2.1. Nguồn Dữ liệu Google Sheets (`mb51`)
Trích xuất thêm 2 cột từ sheet:
- `Phân nhóm (Material group)`: Cột index 4.
- `Debit/Credit Ind.`: Cột index 15 (`S` hoặc `H`).

### 2.2. Bảng Supabase `xg_sap_mb51`
- Lưu trữ 2 trường mới vào cột `raw_data` dưới dạng JSONB:
  ```json
  {
    "material_group": "10040-Phôi xà gồ mạ",
    "debit_credit_ind": "S"
  }
  ```
- Cập nhật script `scripts/setup_xg_sap_mb51.sql` với câu lệnh mở rộng:
  ```sql
  ALTER TABLE public.xg_sap_mb51 ADD COLUMN IF NOT EXISTS material_group TEXT;
  ALTER TABLE public.xg_sap_mb51 ADD COLUMN IF NOT EXISTS debit_credit_ind TEXT;
  CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_dc ON public.xg_sap_mb51 (debit_credit_ind);
  CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_group ON public.xg_sap_mb51 (material_group);
  ```
- Khi đồng bộ (Web hoặc Python), hệ thống điền đồng thời vào cả cột tường minh (nếu bảng đã có) và cột `raw_data` để đảm bảo tương thích 100% không phát sinh lỗi schema.

### 2.3. Cập nhật Kịch bản Đồng bộ
1. **Đồng bộ qua Trình duyệt (`syncFromGoogleSheets` trong `assets/js/xg/xg-sap-lookup.js`)**:
   - Trích xuất `row[4]` (`material_group`) và `row[15]` (`debit_credit_ind`).
   - Đưa vào payload batch insert lên Supabase.
2. **Đồng bộ qua Python (`scripts/sync-mb51-to-supabase.py`)**:
   - Helper đọc cột `idx_mat_grp = col_idx('Phân nhóm (Material group)')` và `idx_dc = col_idx('Debit/Credit Ind.')`.
   - Đưa vào payload đồng bộ.

---

## 3. Thiết kế Logic Tra Cứu & Bộ Lọc (`assets/js/xg/xg-sap-lookup.js`)

### 3.1. Cấu hình Quy tắc Trang (`SAP_PAGE_RULES`)
```javascript
const SAP_PAGE_RULES = {
  'xg-nhap': {
    debitCredit: ['S'],
    allowedPrefixes: ['10040', '10041'],
    allowedGroups: ['10040-Phôi xà gồ mạ', '10041-Xà gồ'],
    warehouse: 'xg',
    direction: 'nhap',
    label: 'Xà Gồ - Nhập kho'
  },
  'xg-xuat': {
    debitCredit: ['H'],
    allowedPrefixes: ['10040', '10041'],
    allowedGroups: ['10040-Phôi xà gồ mạ', '10041-Xà gồ'],
    warehouse: 'xg',
    direction: 'xuat',
    label: 'Xà Gồ - Xuất kho'
  },
  'tole-nhap': {
    debitCredit: ['S'],
    allowedPrefixes: ['10030', '10031', '10022', '10091'],
    allowedGroups: ['10030-Phôi tôn mạ', '10031-Tôn', '10022-Thép cuộn Inox', '10091-Nhôm cuộn'],
    warehouse: 'tole',
    direction: 'nhap',
    label: 'Tole - Nhập kho'
  },
  'tole-xuat': {
    debitCredit: ['H'],
    allowedPrefixes: ['10030', '10031', '10022', '10091'],
    allowedGroups: ['10030-Phôi tôn mạ', '10031-Tôn', '10022-Thép cuộn Inox', '10091-Nhôm cuộn'],
    warehouse: 'tole',
    direction: 'xuat',
    label: 'Tole - Xuất kho'
  }
};
```

### 3.2. Nhận diện Ngữ cảnh Trang
Hàm `detectCurrentPageContext()` dựa vào `window.location.pathname`:
- Khớp chuỗi `/xg/xg-nhap` -> `'xg-nhap'`
- Khớp chuỗi `/xg/xg-xuat` -> `'xg-xuat'`
- Khớp chuỗi `/tole/tole-nhap` -> `'tole-nhap'`
- Khớp chuỗi `/tole/tole-xuat` -> `'tole-xuat'`
- Có thể truyền ghi đè qua tham số cấu hình khi khởi tạo.

### 3.3. Thuật toán Lọc và Gom nhóm Kết quả
Khi người dùng nhập số phiếu vào ô tìm kiếm:
1. Truy vấn các dòng tương ứng từ Supabase `xg_sap_mb51`.
2. Trích xuất thuộc tính của từng dòng:
   - `dc`: Lấy từ `r.debit_credit_ind || (r.raw_data && r.raw_data.debit_credit_ind) || ''`.
   - `grp`: Lấy từ `r.material_group || (r.raw_data && r.raw_data.material_group) || ''`.
3. Kiểm tra tính hợp lệ với trang hiện tại:
   - `isValidDc = rules.debitCredit.includes(dc.toUpperCase())`
   - `isValidGroup = rules.allowedPrefixes.some(p => grp.startsWith(p))`
4. **Phản hồi giao diện**:
   - Nếu có các dòng hợp lệ: Hiển thị danh sách kết quả nhóm (group) để người dùng chọn và tự động điền form.
   - Nếu tìm thấy dòng có số phiếu khớp nhưng **sai quy tắc**: Hiển thị cảnh báo trực quan trên dropdown:
     - Badge màu vàng/cam cảnh báo.
     - Nội dung thông báo rõ lý do: *"Phiếu này là phiếu Xuất kho (Credit - H) / Nhóm Tole, không được phép nhập vào màn hình Xà Gồ - Nhập kho (Debit - S)."*
     - Không cho phép người dùng click chọn hoặc tự động điền mục sai quy tắc.

---

## 4. Tích hợp Giao diện Cho `xg-xuat` & `tole-xuat`

### 4.1. Cập nhật HTML
- Trong [pages/xg/xg-xuat.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/xg/xg-xuat.html) và [pages/tole/tole-xuat.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-xuat.html):
  - Thêm nút `btnSyncGgSheet` vào thanh tiêu đề card *Thông tin chung phiếu xuất* (trong modal `#addDataModal`).
  - Nhúng script `xg-sap-lookup.js` trước thẻ đóng `</body>`.

### 4.2. Cập nhật JS (`xg-xuat.js` & `tole-xuat.js`)
- Trong `openAddDataModal()`:
  - Khởi tạo autocomplete trên ô `Phiếu xuất` (`input[name="col_3"]`):
    ```javascript
    const phieuXuatInput = commonFieldsContainer.querySelector('input[name="col_3"]');
    if (phieuXuatInput && window.XgSapLookup && window.XgSapLookup.initSapDocumentAutocomplete) {
      phieuXuatInput.placeholder = 'Gõ số phiếu xuất để tìm SAP...';
      phieuXuatInput.autocomplete = 'off';
      window.XgSapLookup.initSapDocumentAutocomplete(phieuXuatInput, formEl, 'xg-xuat'); // hoặc 'tole-xuat'
    }
    ```
  - Gắn sự kiện click cho nút `btnSyncGgSheet` kích hoạt `window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet)`.
- Khi chọn dòng SAP:
  - Tự động điền các trường chung: Số phiếu xuất, Ngày xuất, Mã công trình, Tên công trình.
  - Điền vào mặt hàng xuất đầu tiên: Mã vật tư, Tên vật tư, Batch.

---

## 5. Quy trình Kiểm thử & Xác minh

1. **Kiểm tra đồng bộ dữ liệu**:
   - Chạy đồng bộ, kiểm tra xem các dòng đã có `material_group` và `debit_credit_ind` trong `raw_data` và Supabase.
2. **Kiểm tra bộ lọc trên từng trang**:
   - Trên `xg-nhap.html`: Gõ phiếu có `Debit/Credit = S` và `Group = 10040` -> hiển thị hợp lệ; gõ phiếu có `Debit/Credit = H` hoặc `Group = 10030` -> hiển thị cảnh báo không được phép.
   - Trên `xg-xuat.html`: Gõ phiếu có `Debit/Credit = H` và `Group = 10040` -> hiển thị hợp lệ; gõ phiếu có `Debit/Credit = S` -> cảnh báo.
   - Trên `tole-nhap.html`: Gõ phiếu có `Debit/Credit = S` và `Group = 10030/10031/10022/10091` -> hiển thị hợp lệ; gõ phiếu Xà gồ -> cảnh báo.
   - Trên `tole-xuat.html`: Gõ phiếu có `Debit/Credit = H` và `Group = 10030/10031/10022/10091` -> hiển thị hợp lệ; gõ phiếu `S` -> cảnh báo.
3. **Kiểm tra đồng bộ bản build**: Chạy `npm run build` để đồng bộ sang `public/`, `dist/`, `dist-app/`.
