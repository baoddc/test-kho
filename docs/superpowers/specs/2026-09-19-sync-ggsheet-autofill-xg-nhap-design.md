# Tài Liệu Thiết Kế: Đồng Bộ Google Sheet Sang Supabase & Tự Động Điền Form xg-nhap

- **Ngày tạo**: 2026-09-19
- **Trạng thái**: Đã thống nhất thiết kế
- **Tác giả**: Antigravity & Người dùng

---

## 1. Mục Tiêu
1. Xây dựng bảng trung gian lưu dữ liệu SAP từ Google Sheet (`mb51`) trên Supabase: `xg_sap_mb51`.
2. Bổ sung nút **"Đồng bộ Google Sheet"** trên giao diện `pages/xg/xg-nhap.html` để đồng bộ dữ liệu trực tiếp từ Google Sheet sang bảng `xg_sap_mb51` trên Supabase.
3. Khi người dùng mở modal "Thêm dữ liệu" trên `xg-nhap.html` và nhập **"Phiếu nhập"** (Material Document):
   - Tìm kiếm trong dữ liệu `xg_sap_mb51`.
   - Gộp các dòng có cùng `(Material, Material Description, Batch)` và cộng dồn `Quantity`.
   - Hiển thị danh sách gợi ý dropdown để người dùng chọn.
   - Khi chọn: tự động điền các trường chung (`Mã chứng từ: MN`, `Ngày nhập`, `Phiếu nhập`, `Loại nhập: Nhà cung cấp`, `Mã vật tư`, `Tên vật tư`, `Batch`, `Mã công trình`, `Tên công trình`) và điền tổng `Quantity` vào ô "Số kg" của cuộn đầu tiên, cập nhật "Cuộn ID".

---

## 2. Thiết Kế Cơ Sở Dữ Liệu: Bảng `xg_sap_mb51`

### Cấu trúc bảng SQL
```sql
CREATE TABLE IF NOT EXISTS public.xg_sap_mb51 (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    material_document TEXT NOT NULL,
    posting_date DATE,
    material TEXT,
    material_description TEXT,
    batch TEXT,
    quantity NUMERIC,
    project_id TEXT,
    project_name TEXT,
    storage_location TEXT,
    movement_type TEXT,
    movement_type_text TEXT,
    vendor_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index để tối ưu tìm kiếm theo Phiếu nhập
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_doc ON public.xg_sap_mb51 (material_document);
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_mat ON public.xg_sap_mb51 (material);

-- Cấp quyền truy cập cho anon / authenticated
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.xg_sap_mb51 TO anon, authenticated, service_role;
```

---

## 3. Kiến Trúc Đồng Bộ Dữ Liệu từ Google Sheet

### 3.1 Nguồn dữ liệu Google Sheet
- URL: `https://docs.google.com/spreadsheets/d/1BPY6k2bQuDu-RNpkRc3BhS57CuM1Ol__FYXvY8ezRjs/edit?gid=0#gid=0`
- Sheet nguồn: `mb51` (gid=0)
- Phương thức đọc: Google Visualization API (`/gviz/tq?tqx=out:json&gid=0`) hoặc CSV export (`/export?format=csv&gid=0`).
- Phương án dự phòng: Cung cấp script Node/Python `scripts/sync-ggsheet-mb51.js` sử dụng service account hiện có nếu trình duyệt gặp sự cố CORS/quyền xem.

### 3.2 Quy trình đồng bộ trên giao diện web
1. Người dùng bấm nút **"Đồng bộ Google Sheet"** (`#btnSyncGSheet`) trên thanh công cụ `xg-nhap.html`.
2. Hiển thị modal/overlay tiến trình: Đang tải dữ liệu từ Google Sheet...
3. Parse các cột theo đúng cấu trúc:
   - `Material Document` -> `material_document`
   - `Posting Date` -> `posting_date` (chuẩn hóa `YYYY-MM-DD`)
   - `Material` -> `material`
   - `Material Description` -> `material_description`
   - `Batch` -> `batch`
   - `Quantity` -> `quantity` (chuyển đổi số thực, loại bỏ dấu phân cách hàng nghìn)
   - `Project ID` -> `project_id`
   - `Project name` -> `project_name`
   - `Storage Location` -> `storage_location`
   - `Movement Type` -> `movement_type`
   - `Movement Type Text` -> `movement_type_text`
   - `Vendor name` -> `vendor_name`
4. Ghi đè hoặc upsert vào bảng `xg_sap_mb51` theo lô (chunk 500 dòng/request) để đảm bảo tốc độ và tránh timeout.
5. Cập nhật cache cục bộ và thông báo cho người dùng: *"Đã đồng bộ thành công X dòng từ Google Sheet."*

---

## 4. Thiết Kế Tự Động Điền Form (Autofill)

### 4.1 Quy trình tương tác người dùng
1. Người dùng bấm nút **"Thêm dữ liệu"** để mở modal `addDataModal`.
2. Tại ô **"Phiếu nhập"** (`col_3`), khi người dùng gõ từ 3 ký tự trở lên:
   - Hệ thống lọc dữ liệu từ bảng `xg_sap_mb51` theo tiền tố/chứa `material_document`.
   - Gom nhóm (Group by) theo bộ ba `(material, material_description, batch)`.
   - Tính tổng `quantity = sum(quantity)` của nhóm.
   - Hiển thị danh sách gợi ý dropdown dạng floating menu ngay dưới ô nhập.
3. Khi người dùng click chọn 1 mục trong dropdown:
   - **Mã chứng từ** (`col_1`): Gán `'MN'`
   - **Ngày nhập** (`col_2`): Gán giá trị `posting_date` (định dạng `YYYY-MM-DD`)
   - **Phiếu nhập** (`col_3`): Gán số phiếu đã chọn
   - **Loại nhập** (`col_4`): Gán `'Nhà cung cấp'`
   - **Mã vật tư** (`col_5`): Gán `material`
   - **Tên vật tư** (`col_6`): Gán `material_description`
   - **Batch** (`col_7`): Gán `batch`
   - **Mã công trình** (`add_ext_11`): Gán `project_id`
   - **Tên công trình** (`add_ext_12`): Gán `project_name`
   - **Danh sách cuộn**:
     - Nếu chưa có dòng cuộn nào, tạo tự động 1 dòng cuộn.
     - Dòng cuộn đầu tiên: ô "Số kg" (`.roll-kg`) được điền giá trị tuyệt đối của tổng `quantity`.
     - Kích hoạt sự kiện để cập nhật tổng kg (`updateRollTotals()`) và tự động sinh `Cuộn ID` (`updateRollCuonIds()`).

---

## 5. Xử Lý Ngoại Lệ & Kiểm Thử
- Khi Google Sheet chưa được chia sẻ hoặc mất mạng: Hiển thị thông báo hướng dẫn rõ ràng.
- Xử lý số âm/dương trong `Quantity`: Do SAP ghi nhận xuất (-) và nhập (+), hệ thống lấy tổng số dương hoặc tổng giá trị tuyệt đối hợp lý theo ngữ cảnh nhập kho.
- Trường hợp người dùng gõ số phiếu không có trong hệ thống: Cho phép nhập tự do bình thường, không chặn form.
