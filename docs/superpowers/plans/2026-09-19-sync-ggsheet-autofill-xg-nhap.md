# Kế Hoạch Triển Khai: Đồng Bộ Google Sheets sang Supabase & Tự Động Điền Form Nhập Xà Gồ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng bộ dữ liệu SAP từ Google Sheet vào bảng Supabase `xg_sap_mb51`, tự động gợi ý và điền thông tin phiếu nhập vào form thêm dữ liệu trên `pages/xg/xg-nhap.html`, đồng thời hỗ trợ cộng dồn số lượng SAP để đối chiếu với tổng kg cuộn.

**Architecture:** 
1. Script Python `scripts/sync-mb51-to-supabase.py` sử dụng Service Account đọc dữ liệu từ sheet `mb51` của Google Sheet, chuẩn hóa và batch upsert vào bảng Supabase `xg_sap_mb51`.
2. Tạo file `DongBo_GgSheet_Supabase.bat` để người dùng có thể kích hoạt đồng bộ bất kỳ lúc nào chỉ bằng 1 cú click.
3. Tạo module tra cứu `assets/js/xg/xg-sap-lookup.js` tích hợp vào `xg-nhap.html` và `assets/js/xg/xg-nhap.js`.
4. Bổ sung autocomplete dropdown tại ô "Phiếu nhập", tự động gom nhóm các dòng trùng Material + Description + Batch, điền 8 trường dữ liệu và hiển thị bảng đối chiếu khối lượng cuộn vs khối lượng SAP.

**Tech Stack:** JavaScript (Vanilla, ES6+), Python 3 (googleapiclient, requests), Supabase REST API, Bootstrap 5.

## Global Constraints
- Bảng Supabase: `public.xg_sap_mb51`
- File HTML mục tiêu: `pages/xg/xg-nhap.html`
- File JS mục tiêu: `assets/js/xg/xg-nhap.js`
- Google Sheet ID: `1BPY6k2bQuDu-RNpkRc3BhS57CuM1Ol__FYXvY8ezRjs` (sheet `mb51`)
- Các trường tự điền: Mã chứng từ (`MN`), Ngày nhập (`Posting Date`), Phiếu nhập (`Material Document`), Loại nhập (`Nhà cung cấp`), Mã vật tư (`Material`), Tên vật tư (`Material Description`), Batch (`Batch`), Mã công trình (`Project ID`), Tên công trình (`Project name`).

---

### Task 1: Khởi tạo Bảng Supabase `xg_sap_mb51` và Script Khởi tạo SQL

**Files:**
- Create: `scripts/setup_xg_sap_mb51.sql`
- Test: Kiểm tra cấu trúc bảng qua Supabase REST API

**Interfaces:**
- Produces: Table `public.xg_sap_mb51` với các cột: `id`, `material_document`, `posting_date`, `material`, `material_description`, `batch`, `quantity`, `unit`, `project_id`, `project_name`, `movement_type`, `storage_location`, `vendor_name`, `raw_data`, `synced_at`.

- [ ] **Step 1: Viết script SQL `scripts/setup_xg_sap_mb51.sql`**
Tạo file SQL chứa lệnh `CREATE TABLE`, `CREATE INDEX`, và chính sách bảo mật RLS cho `public.xg_sap_mb51`.

- [ ] **Step 2: Thực thi tạo bảng trên Supabase**
Chạy migration qua Supabase API hoặc execute script.

- [ ] **Step 3: Kiểm tra bảng trên Supabase**
Chạy truy vấn REST API kiểm tra bảng `xg_sap_mb51` đã tồn tại và phản hồi mã 200.

- [ ] **Step 4: Commit**
```bash
git add scripts/setup_xg_sap_mb51.sql
git commit -m "feat: add sql schema for xg_sap_mb51 table"
```

---

### Task 2: Xây dựng Script Đồng Bộ Google Sheets → Supabase

**Files:**
- Create: `scripts/sync-mb51-to-supabase.py`
- Create: `DongBo_GgSheet_Supabase.bat`

**Interfaces:**
- Consumes: Google Sheets API `mb51!A:Z`, Service Account `C:\Users\benhhc\Desktop\chi-y\service_account.json` (hoặc bản copy trong project).
- Produces: Dữ liệu được upsert vào bảng `xg_sap_mb51` trên Supabase theo batch 1.000 dòng.

- [ ] **Step 1: Viết script Python `scripts/sync-mb51-to-supabase.py`**
Script đọc toàn bộ dòng từ sheet `mb51`, chuẩn hóa định dạng ngày tháng `YYYY-MM-DD`, xử lý số thực `Quantity`, lọc bỏ dòng rỗng, và đẩy vào Supabase theo chunks 1.000 dòng.

- [ ] **Step 2: Viết file kích hoạt `DongBo_GgSheet_Supabase.bat`**
Tạo file `.bat` ở thư mục gốc để người dùng có thể nhấp đúp chạy bất cứ lúc nào.

- [ ] **Step 3: Chạy thử nghiệm đồng bộ toàn bộ dữ liệu**
Chạy `python scripts/sync-mb51-to-supabase.py` và kiểm tra tổng số dòng đã đồng bộ thành công vào Supabase (> 7.000 dòng).

- [ ] **Step 4: Commit**
```bash
git add scripts/sync-mb51-to-supabase.py DongBo_GgSheet_Supabase.bat
git commit -m "feat: add ggsheet mb51 to supabase sync script and batch runner"
```

---

### Task 3: Tích Hợp Autocomplete và Tự Động Điền Form Trên `xg-nhap.html`

**Files:**
- Create: `assets/js/xg/xg-sap-lookup.js`
- Modify: `pages/xg/xg-nhap.html` (nhúng script `xg-sap-lookup.js`)
- Modify: `assets/js/xg/xg-nhap.js` (gắn sự kiện tìm kiếm khi gõ Phiếu nhập)

**Interfaces:**
- Consumes: Supabase table `xg_sap_mb51`.
- Produces: Dropdown autocomplete hiển thị kết quả tìm kiếm theo `material_document`, gom nhóm theo `Material + Description + Batch` kèm `total_sap_quantity`. Khi click chọn, tự điền 8 trường dữ liệu vào form.

- [ ] **Step 1: Xây dựng module `assets/js/xg/xg-sap-lookup.js`**
Hàm tìm kiếm dữ liệu `searchSapDocuments(query)` với debounce, hàm gom nhóm `groupSapResults(rows)`, và hàm render dropdown popup.

- [ ] **Step 2: Nhúng script vào `pages/xg/xg-nhap.html` và thêm CSS cho dropdown autocomplete**
Thêm tag `<script src="/assets/js/xg/xg-sap-lookup.js">` và style cho floating autocomplete menu.

- [ ] **Step 3: Gắn sự kiện ô "Phiếu nhập" trong `openAddDataModal` của `assets/js/xg/xg-nhap.js`**
Khi người dùng gõ vào ô `Phiếu nhập` (tên input: `col_3`), kích hoạt tìm kiếm và hiển thị dropdown. Khi click chọn, tự động điền các ô:
- Mã chứng từ = `MN`
- Ngày nhập = `posting_date`
- Phiếu nhập = `material_document`
- Loại nhập = `Nhà cung cấp`
- Mã vật tư = `material`
- Tên vật tư = `material_description`
- Batch = `batch`
- Mã công trình = `project_id`
- Tên công trình = `project_name`
Và gọi `updateRollCuonIds()` để tự động cập nhật Cuộn ID.

- [ ] **Step 4: Commit**
```bash
git add assets/js/xg/xg-sap-lookup.js pages/xg/xg-nhap.html assets/js/xg/xg-nhap.js
git commit -m "feat: implement sap document autocomplete and autofill in xg-nhap"
```

---

### Task 4: Thêm Bảng Đối Chiếu Khối Lượng SAP vs Khối Lượng Cuộn

**Files:**
- Modify: `pages/xg/xg-nhap.html` hoặc `assets/js/xg/xg-nhap.js` (tfoot của `#rollsTable`)

**Interfaces:**
- Consumes: `tong_kg_sap` từ dòng SAP đã chọn và `totalKg` từ danh sách cuộn nhập.
- Produces: Hiển thị dòng "Tổng kg SAP: [Y kg]" và "Chênh lệch: [X - Y kg]" kèm badge màu cảnh báo trực quan.

- [ ] **Step 1: Bổ sung dòng hiển thị khối lượng SAP vào `#rollsTable`**
Thêm hàng `Tổng kg SAP` và hàng `Chênh lệch (Cuộn - SAP)` vào tfoot của bảng cuộn trong modal Thêm dữ liệu.

- [ ] **Step 2: Cập nhật hàm `updateRollTotals()`**
Mỗi khi số kg của cuộn thay đổi hoặc khi dòng SAP được chọn, tính lại chênh lệch:
$\Delta = \text{totalKg} - \text{sapKg}$.
Nếu $\Delta == 0$: hiển thị badge xanh "Khớp 100%". Nếu $\Delta \neq 0$: hiển thị badge cảnh báo kèm số kg chênh lệch.

- [ ] **Step 3: Commit**
```bash
git add pages/xg/xg-nhap.html assets/js/xg/xg-nhap.js
git commit -m "feat: add sap quantity and coil weight reconciliation in modal"
```

---

### Task 5: Kiểm Thử Toàn Diện và Bàn Giao

**Files:**
- Verification only

- [ ] **Step 1: Kiểm thử đồng bộ dữ liệu**
Chạy lại script đồng bộ và đảm bảo không có lỗi dữ liệu.

- [ ] **Step 2: Kiểm thử giao diện web `xg-nhap.html`**
Mở giao diện trên trình duyệt:
1. Bấm "Thêm dữ liệu".
2. Gõ phiếu nhập `4900145548` -> Kiểm tra hiển thị dropdown các dòng có cùng phiếu nhập.
3. Chọn 1 dòng -> Kiểm tra 8 trường dữ liệu được điền đầy đủ và chính xác.
4. Thêm cuộn và nhập số kg -> Kiểm tra hiển thị đối chiếu kg cuộn vs kg SAP và mức chênh lệch.

- [ ] **Step 3: Cập nhật tài liệu hướng dẫn sử dụng**
Viết tài liệu tóm tắt vào `walkthrough.md` hoặc README.
