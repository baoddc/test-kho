# Thiết kế Kỹ thuật: Đồng bộ Google Sheets sang Supabase & Tự động điền Form Nhập Xà Gồ

- **Ngày tạo**: 2026-09-19
- **Trạng thái**: Đã phê duyệt
- **Mục tiêu**: Đồng bộ dữ liệu SAP từ Google Sheet (sheet `mb51`) vào bảng tra cứu Supabase `xg_sap_mb51`, tích hợp tính năng tự động gợi ý/điền form và đối chiếu khối lượng cuộn trên trang `pages/xg/xg-nhap.html`.

---

## 1. Bối cảnh & Yêu cầu nghiệp vụ

### 1.1. Nguồn dữ liệu
- **Google Sheet ID**: `1BPY6k2bQuDu-RNpkRc3BhS57CuM1Ol__FYXvY8ezRjs` (sheet `mb51`).
- Dữ liệu gồm hơn 7.300 dòng xuất từ hệ thống SAP với các cột:
  - `Material Document` (Số phiếu nhập kho)
  - `Posting Date` (Ngày ghi sổ nhập)
  - `Material` (Mã vật tư)
  - `Material Description` (Tên vật tư)
  - `Batch` (Lô hàng)
  - `Quantity` (Khối lượng / Số lượng)
  - `Project ID` (Mã công trình/dự án)
  - `Project name` (Tên công trình/dự án)
  - `Movement Type`, `Storage Location`, `Vendor name`...

### 1.2. Nghiệp vụ tại kho xà gồ (`xg-nhap.html`)
- Khi thủ kho bấm **Thêm dữ liệu**:
  - Nhập **Phiếu nhập** (Material Document).
  - Hệ thống tự động tra cứu dữ liệu từ bảng trung gian Supabase `xg_sap_mb51`.
  - Nếu số phiếu có nhiều dòng: hiển thị danh sách dropdown các dòng tương ứng, gom nhóm theo `(Material + Material Description + Batch)` và hiển thị tổng `Quantity` SAP.
  - Khi chọn 1 dòng:
    - **Mã chứng từ**: mặc định `MN`
    - **Ngày nhập**: lấy từ `Posting Date` (chuẩn hóa `YYYY-MM-DD`)
    - **Phiếu nhập**: lấy từ `Material Document`
    - **Loại nhập**: mặc định `Nhà cung cấp`
    - **Mã vật tư**: lấy từ `Material`
    - **Tên vật tư**: lấy từ `Material Description`
    - **Batch**: lấy từ `Batch`
    - **Mã công trình**: lấy từ `Project ID`
    - **Tên công trình**: lấy từ `Project name`
  - **Đối chiếu khối lượng**: Tại danh sách các cuộn thực nhập, hiển thị thêm tổng khối lượng từ SAP và độ chênh lệch:
    $$\Delta = \text{Tổng kg các cuộn} - \text{Tổng kg SAP}$$
    Hiển thị cảnh báo trực quan để thủ kho kiểm tra trước khi lưu.

---

## 2. Thiết kế Kiến trúc & Cơ sở dữ liệu

### 2.1. Bảng Supabase: `xg_sap_mb51`

```sql
CREATE TABLE IF NOT EXISTS public.xg_sap_mb51 (
    id BIGSERIAL PRIMARY KEY,
    material_document TEXT NOT NULL,
    posting_date DATE,
    material TEXT,
    material_description TEXT,
    batch TEXT,
    quantity NUMERIC DEFAULT 0,
    unit TEXT,
    project_id TEXT,
    project_name TEXT,
    movement_type TEXT,
    storage_location TEXT,
    vendor_name TEXT,
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- Index tối ưu tốc độ tìm kiếm autocomplete
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_doc ON public.xg_sap_mb51 (material_document);
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_mat ON public.xg_sap_mb51 (material);
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_batch ON public.xg_sap_mb51 (batch);

-- RLS: Cho phép đọc (SELECT) công khai/xác thực cho mọi user có quyền xem xg
ALTER TABLE public.xg_sap_mb51 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cho phep xem xg_sap_mb51" ON public.xg_sap_mb51 FOR SELECT USING (true);
CREATE POLICY "Cho phep ghi xg_sap_mb51" ON public.xg_sap_mb51 FOR ALL USING (true);
```

### 2.2. Kịch bản đồng bộ: `scripts/sync-mb51-to-supabase.py`
- Sử dụng Google Service Account (`service_account.json`).
- Đọc toàn bộ dữ liệu từ sheet `mb51` của Google Sheet.
- Xử lý làm sạch:
  - Cắt khoảng trắng thừa.
  - Chuẩn hóa ngày tháng `YYYY-MM-DD`.
  - Chuyển đổi định dạng số `Quantity` (xử lý dấu phẩy thập phân kiểu Việt Nam `1619,2` thành `1619.2`).
- Sử dụng Supabase REST API đẩy dữ liệu theo batch (1.000 dòng/lần).
- Tạo file batch `DongBo_GgSheet_Supabase.bat` để chạy 1-click bất kỳ lúc nào trên máy tính.

---

## 3. Thiết kế Giao diện & Trải nghiệm Người dùng (`xg-nhap.html` & `xg-nhap.js`)

### 3.1. Ô tìm kiếm Phiếu nhập thông minh
- Tại form **Thêm dữ liệu**, ô input `Phiếu nhập` (tên field: `col_3`):
  - Khi người dùng nhập từ 2-3 ký tự trở lên:
    - Kích hoạt cơ chế debounce (300ms).
    - Gọi API Supabase: `supabase.from('xg_sap_mb51').select('*').ilike('material_document', `%${query}%`).limit(50)`.
    - Gom nhóm dữ liệu trả về theo: `material_document + '||' + material + '||' + (batch || '')`.
    - Tính tổng số lượng SAP:
      $$\text{total\_qty} = \sum \text{quantity}$$
  - Hiển thị danh sách dropdown gồm các thẻ:
    - Số phiếu: `4900145548`
    - Mã VT & Tên: `10000003 - Thép tấm 1.5mm SPHC`
    - Batch: `1X2VN`
    - Tổng SAP: `1.855 kg`
    - Dự án: `10725-009 - DG XK VIOLA...`

### 3.2. Logic Tự Động Điền (Autofill)
Khi người dùng click chọn 1 mục từ dropdown:
1. Gán giá trị vào form:
   - `Mã chứng từ`: `'MN'` (hoặc chọn sẵn option MN trong dropdown).
   - `Ngày nhập`: `posting_date` (`YYYY-MM-DD`).
   - `Phiếu nhập`: `material_document`.
   - `Loại nhập`: `'Nhà cung cấp'`.
   - `Mã vật tư`: `material`.
   - `Tên vật tư`: `material_description`.
   - `Batch`: `batch`.
   - `Mã công trình`: `project_id`.
   - `Tên công trình`: `project_name`.
2. Ẩn dropdown gợi ý.
3. Kích hoạt tính lại mã cuộn tự động (`updateRollCuonIds()`) dựa trên `Mã vật tư` mới.

### 3.3. Khu vực Đối chiếu Khối lượng SAP
- Tại phần chân bảng cuộn (`#rollsTable tfoot`):
  - Hiển thị thêm 2 dòng:
    1. **Tổng kg SAP (Phiếu nhập)**: `Y kg` (lấy từ tổng số lượng của mục đã chọn).
    2. **Chênh lệch (Cuộn - SAP)**: `(X - Y) kg`.
       - Nếu $X = Y$: Badge màu xanh lá `Khớp 100% (0 kg)`.
       - Nếu $X \neq Y$: Badge màu cam/đỏ `Lệch: ±... kg` giúp thủ kho kiểm tra lại trọng lượng các cuộn.

---

## 4. Xử lý Lỗi & Trường hợp Ngoại lệ (Edge Cases)

| Tình huống | Cách xử lý |
|---|---|
| Phiếu nhập không có trên Google Sheet / Supabase | Cho phép thủ kho tự nhập thủ công bình thường như cũ, không chặn. |
| Mạng chập chờn khi tìm kiếm autocomplete | Giữ nguyên dữ liệu người dùng vừa gõ, hiển thị thông báo nhỏ "Không kết nối được bảng SAP". |
| Số lượng SAP có dấu âm (`-942`) do xuất/trừ kho | Lấy giá trị tuyệt đối $|Quantity|$ hoặc giữ nguyên số dương của lô nhập. |
| 1 phiếu có nhiều dòng trùng cả Mã VT và Batch | Cộng dồn `Quantity` tất cả các dòng đó lại thành 1 tổng duy nhất để đối chiếu. |

---

## 5. Kế hoạch Kiểm thử & Xác nhận
1. **Kiểm tra đồng bộ**:
   - Chạy script đồng bộ dữ liệu thực tế từ Google Sheet sang Supabase.
   - Kiểm tra số lượng dòng và nội dung trong bảng `xg_sap_mb51`.
2. **Kiểm tra Autofill trên giao diện**:
   - Mở modal Thêm dữ liệu trên `xg-nhap.html`.
   - Gõ thử mã phiếu đơn dòng (ví dụ `4900143837`).
   - Gõ thử mã phiếu đa dòng (ví dụ `4900145548`).
   - Kiểm tra việc điền tự động 8 trường dữ liệu.
3. **Kiểm tra đối chiếu khối lượng**:
   - Thêm các dòng cuộn với số kg khác nhau, kiểm tra tổng kg cuộn so với tổng kg SAP và hiển thị chênh lệch.
