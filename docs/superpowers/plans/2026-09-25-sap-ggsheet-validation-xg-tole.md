# Kế Hoạch Triển Khai: Phân Loại & Ràng Buộc Dữ Liệu SAP MB51 (Google Sheets) Cho Kho Xà Gồ và Tole

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai cơ chế phân loại và ràng buộc dữ liệu tra cứu từ Google Sheets (sheet `mb51`) vào 4 trang `xg-nhap.html`, `xg-xuat.html`, `tole-nhap.html`, `tole-xuat.html` dựa trên cột `Debit/Credit Ind.` (S vs H) và cột `Phân nhóm (Material group)`.

**Architecture:**
- Dữ liệu đồng bộ từ Google Sheets được trích xuất thêm 2 cột: `Phân nhóm (Material group)` (Index 4) và `Debit/Credit Ind.` (Index 15), lưu vào `raw_data` JSONB trên bảng Supabase `xg_sap_mb51`.
- Module `assets/js/xg/xg-sap-lookup.js` bổ sung cấu hình quy tắc theo ngữ cảnh trang `SAP_PAGE_RULES`, tự động nhận diện trang (`xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`) và lọc dữ liệu tra cứu đa tầng.
- Tích hợp autocomplete và nút đồng bộ vào cả 2 trang xuất (`xg-xuat` và `tole-xuat`), cảnh báo trực quan khi người dùng nhập phiếu không đúng nghiệp vụ hoặc không đúng kho.

**Tech Stack:** JavaScript (ES6+), Supabase REST API, Python 3, Node.js Test Suite.

## Global Constraints
- `Debit/Credit Ind. == 'S'`: Chỉ được phép nhập vào `xg-nhap` và `tole-nhap`.
- `Debit/Credit Ind. == 'H'`: Chỉ được phép nhập vào `xg-xuat` và `tole-xuat`.
- `Phân nhóm` bắt đầu bằng `10040` (`10040-Phôi xà gồ mạ`) hoặc `10041` (`10041-Xà gồ`): Chỉ được phép nhập vào `xg-nhap` và `xg-xuat`.
- `Phân nhóm` bắt đầu bằng `10030`, `10031`, `10022`, hoặc `10091`: Chỉ được phép nhập vào `tole-nhap` và `tole-xuat`.
- Giữ nguyên các chức năng hiện tại của form và bảng đối chiếu khối lượng.
- Luôn chạy `node scripts/sync-dist.js` để đồng bộ source vào `public/`, `dist/`, `dist-app/`.

---

### Task 1: Cập Nhật Python Sync Script & File Setup SQL

**Files:**
- Modify: `scripts/sync-mb51-to-supabase.py`
- Modify: `scripts/setup_xg_sap_mb51.sql`

**Interfaces:**
- Produces: `raw_data` chứa `{"material_group": str, "debit_credit_ind": str}` trong payload gửi lên Supabase `xg_sap_mb51`.

- [ ] **Step 1: Cập nhật `scripts/setup_xg_sap_mb51.sql`**
Bổ sung các lệnh `ALTER TABLE` và `CREATE INDEX` cho 2 trường `material_group` và `debit_credit_ind`.

```sql
ALTER TABLE public.xg_sap_mb51 ADD COLUMN IF NOT EXISTS material_group TEXT;
ALTER TABLE public.xg_sap_mb51 ADD COLUMN IF NOT EXISTS debit_credit_ind TEXT;
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_dc ON public.xg_sap_mb51 (debit_credit_ind);
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_group ON public.xg_sap_mb51 (material_group);
```

- [ ] **Step 2: Cập nhật `scripts/sync-mb51-to-supabase.py`**
Đọc 2 cột `Phân nhóm (Material group)` và `Debit/Credit Ind.` từ sheet `mb51`, chuẩn hóa giá trị và đưa vào `record['raw_data'] = {'material_group': group_val, 'debit_credit_ind': dc_val}`.

- [ ] **Step 3: Chạy thử script Python để kiểm tra cú pháp**

Run: `python -m py_compile scripts/sync-mb51-to-supabase.py`
Expected: Thoát mã 0 không có lỗi cú pháp.

- [ ] **Step 4: Commit thay đổi Task 1**

```bash
git add scripts/setup_xg_sap_mb51.sql scripts/sync-mb51-to-supabase.py
git commit -m "feat(sync): extract material_group and debit_credit_ind in sync script and SQL setup"
```

---

### Task 2: Cập Nhật Module `assets/js/xg/xg-sap-lookup.js` với Quy Tắc Ràng Buộc Đa Trang

**Files:**
- Modify: `assets/js/xg/xg-sap-lookup.js`

**Interfaces:**
- Consumes: Cấu hình `SAP_PAGE_RULES` và `raw_data` từ Supabase.
- Produces: `initSapDocumentAutocomplete(inputEl, formEl, pageContext)` với bộ lọc kiểm soát theo đúng 4 trang:
  - `xg-nhap`: Debit `S`, Group `10040` | `10041`
  - `xg-xuat`: Credit `H`, Group `10040` | `10041`
  - `tole-nhap`: Debit `S`, Group `10030` | `10031` | `10022` | `10091`
  - `tole-xuat`: Credit `H`, Group `10030` | `10031` | `10022` | `10091`

- [ ] **Step 1: Viết cấu hình `SAP_PAGE_RULES` và hàm `detectCurrentPageContext()`**
Định nghĩa ma trận các điều kiện cho 4 trang và hàm helper nhận diện context từ URL hoặc tham số.

- [ ] **Step 2: Cập nhật hàm `syncFromGoogleSheets()`**
Trích xuất cột Index 4 (`Phân nhóm`) và Index 15 (`Debit/Credit Ind.`) từ Google GViz JSON và lưu vào `raw_data` của từng bản ghi gửi lên Supabase.

- [ ] **Step 3: Cập nhật hàm `groupSapMb51Rows()` và bộ lọc hiển thị Dropdown**
- Bổ sung `material_group` và `debit_credit_ind` vào từng nhóm kết quả.
- Khi người dùng gõ tìm kiếm, phân tách thành:
  - Danh sách dòng hợp lệ cho trang hiện tại.
  - Danh sách dòng không hợp lệ (thuộc trang khác / loại khác).
- Nếu không có dòng hợp lệ nhưng có dòng bị chặn: Render thông báo cảnh báo màu vàng/cam ghi rõ lý do (ví dụ: *"Phiếu này là phiếu Xuất kho (Credit Ind: H) / Nhóm Tole, không được phép nhập vào màn hình Xà Gồ - Nhập kho (Debit Ind: S)"*).
- Không cho phép click chọn mục bị chặn.

- [ ] **Step 4: Cập nhật hàm `applySapRecordToForm()` hỗ trợ cả Phiếu Nhập (`MN`) và Phiếu Xuất (`PX`)**
Nếu context là `xg-xuat` hoặc `tole-xuat`:
- Gán mã chứng từ `PX`.
- Điền số phiếu vào `input[name="col_3"]`.
- Điền ngày vào `input[name="col_2"]`.
- Điền mã công trình, tên công trình.
- Điền thông tin mặt hàng vào thẻ item đầu tiên nếu có (`multiItemsData` hoặc form mặt hàng).

- [ ] **Step 5: Commit thay đổi Task 2**

```bash
git add assets/js/xg/xg-sap-lookup.js
git commit -m "feat(sap-lookup): implement strict Debit/Credit and Material Group validation rules"
```

---

### Task 3: Tích Hợp Vào Trang Kho Xà Gồ Xuất (`xg-xuat.html` & `xg-xuat.js`)

**Files:**
- Modify: `pages/xg/xg-xuat.html`
- Modify: `assets/js/xg/xg-xuat.js`

**Interfaces:**
- Produces: Nút `btnSyncGgSheet` và autocomplete trên ô Phiếu xuất (`input[name="col_3"]`).

- [ ] **Step 1: Cập nhật `pages/xg/xg-xuat.html`**
- Thêm nút `btnSyncGgSheet` vào header card Thông tin chung phiếu xuất:
  ```html
  <button type="button" id="btnSyncGgSheet" class="btn btn-sm btn-light text-primary fw-bold" title="Đồng bộ dữ liệu mới nhất từ Google Sheets">
    <i class="bi bi-arrow-repeat me-1"></i> Đồng bộ Google Sheets
  </button>
  ```
- Nhúng script `xg-sap-lookup.js` vào cuối file HTML trước `</body>`.

- [ ] **Step 2: Cập nhật `assets/js/xg/xg-xuat.js`**
- Trong `openAddDataModal()`:
  - Khởi tạo autocomplete cho `input[name="col_3"]` với context `'xg-xuat'`.
  - Gắn sự kiện click cho `btnSyncGgSheet`.
- Trong hàm điền mặt hàng, hỗ trợ cập nhật thẻ mặt hàng khi chọn phiếu từ SAP.

- [ ] **Step 3: Commit thay đổi Task 3**

```bash
git add pages/xg/xg-xuat.html assets/js/xg/xg-xuat.js
git commit -m "feat(xg-xuat): integrate SAP MB51 autocomplete and Google Sheets sync button"
```

---

### Task 4: Tích Hợp Vào Trang Kho Tole Xuất (`tole-xuat.html` & `tole-xuat.js`)

**Files:**
- Modify: `pages/tole/tole-xuat.html`
- Modify: `assets/js/tole/tole-xuat.js`

**Interfaces:**
- Produces: Nút `btnSyncGgSheet` và autocomplete trên ô Phiếu xuất (`input[name="col_3"]`).

- [ ] **Step 1: Cập nhật `pages/tole/tole-xuat.html`**
- Thêm nút `btnSyncGgSheet` vào header card Thông tin chung phiếu xuất.
- Nhúng script `xg-sap-lookup.js` vào cuối file HTML.

- [ ] **Step 2: Cập nhật `assets/js/tole/tole-xuat.js`**
- Trong `openAddDataModal()`:
  - Khởi tạo autocomplete cho `input[name="col_3"]` với context `'tole-xuat'`.
  - Gắn sự kiện click cho `btnSyncGgSheet`.
- Cập nhật hàm gán dữ liệu mặt hàng từ SAP vào thẻ xuất đầu tiên.

- [ ] **Step 3: Commit thay đổi Task 4**

```bash
git add pages/tole/tole-xuat.html assets/js/tole/tole-xuat.js
git commit -m "feat(tole-xuat): integrate SAP MB51 autocomplete and Google Sheets sync button"
```

---

### Task 5: Viết Bộ Test Kiểm Thử Tự Động & Đồng Bộ Toàn Bộ Bản Build

**Files:**
- Create: `tests/test-sap-page-validation-rules.js`
- Run: `node scripts/sync-dist.js`

- [ ] **Step 1: Viết test suite `tests/test-sap-page-validation-rules.js`**
Tạo file kiểm thử Node.js kiểm tra logic lọc của cả 4 trường hợp:
1. `xg-nhap`: Cho phép `S` + `10040`/`10041`. Chặn `H`, chặn `10030`/`10031`/`10022`/`10091`.
2. `xg-xuat`: Cho phép `H` + `10040`/`10041`. Chặn `S`, chặn nhóm Tole.
3. `tole-nhap`: Cho phép `S` + nhóm Tole. Chặn `H`, chặn nhóm Xà gồ.
4. `tole-xuat`: Cho phép `H` + nhóm Tole. Chặn `S`, chặn nhóm Xà gồ.

- [ ] **Step 2: Chạy bộ kiểm thử tự động**

Run: `node tests/test-sap-page-validation-rules.js`
Expected: PASS 100% tất cả các kịch bản kiểm thử.

- [ ] **Step 3: Chạy build đồng bộ dự án sang `public/`, `dist/`, `dist-app/`**

Run: `npm run build`
Expected: `Full synchronization completed successfully!`

- [ ] **Step 4: Commit Task 5**

```bash
git add tests/test-sap-page-validation-rules.js public/ dist/ dist-app/
git commit -m "test: add comprehensive test suite for SAP page validation rules and sync build artifacts"
```
