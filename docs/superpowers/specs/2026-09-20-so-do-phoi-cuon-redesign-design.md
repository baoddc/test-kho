# Thiết Kế Lại Sơ Đồ Phôi Cuộn (5S) Dựa Trên Dữ Liệu Tồn Xà Gồ & Tole (Supabase)

## 1. Mục Tiêu
Nâng cấp và chuyển đổi trang sơ đồ mặt bằng kho phôi cuộn (`pages/5s/5s-so-do-phoi-cuon.html` và `assets/js/5s/5s-so-do-phoi-cuon.js`):
- Thay thế hoàn toàn cơ chế đọc file Google Sheet CSV tĩnh cũ bằng cơ sở dữ liệu Supabase theo thời gian thực (tương tự như `xg-ton.html` và `tole-ton.html`).
- Tổng hợp dữ liệu tồn kho thực tế từ cả hai nguồn: **Kho Xà gồ** (`xg-nhap` - `xg-xuat`) và **Kho Tole** (`tole-nhap` - `tole-xuat`).
- Nâng cấp giao diện trực quan 5S hiện đại: Bổ sung thanh thống kê chỉ số (KPIs) tổng kho, bộ lọc linh hoạt `[Tất cả]`, `[Kho Xà gồ]`, `[Kho Tole]`, tìm kiếm cuộn/vật tư tự động làm nổi bật kệ, xem nhanh danh sách cuộn qua hover và mở modal chi tiết chuyên sâu khi click vào kệ kèm tính năng xuất Excel.

---

## 2. Nguồn Dữ Liệu & Kiến Trúc Xử Lý (Data Architecture)

### 2.1 Bảng Supabase & Cơ Chế Tính Tồn Thực Tế
Hệ thống sử dụng `supabase` client từ `/assets/js/core/supabase-config.js`:
- **Kho Xà gồ:**
  - `xg-nhap`: Tất cả các cuộn thép đã nhập vào kho.
  - `xg-xuat`: Các cuộn thép đã xuất kho (`Cuộn ID`).
  - *Tồn Xà gồ* = Các bản ghi `xg-nhap` có `Cuộn ID` không nằm trong danh sách xuất của `xg-xuat`.
- **Kho Tole:**
  - `tole-nhap`: Tất cả các cuộn tole đã nhập kho.
  - `tole-xuat`: Các cuộn tole đã xuất kho (`Cuộn ID`).
  - *Tồn Tole* = Các bản ghi `tole-nhap` có `Cuộn ID` không nằm trong danh sách xuất của `tole-xuat`.

### 2.2 Tối Ưu Tốc Độ Hiển Thị (0ms Cache & Background Sync)
1. **Khởi động tức thì (Instant Hydration):**
   - Đọc dữ liệu đã lưu trong localStorage thông qua `getStoredTableCache('xg-ton')` và `getStoredTableCache('tole-ton')`.
   - Nếu có cache, lập tức tính toán và render ngay sơ đồ kho trong 0ms.
2. **Nạp nền từ Supabase (Background Parallel Fetch):**
   - Gọi đồng thời qua `fetchAllFromSupabase`: `xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`.
   - Lọc các cuộn tồn còn hiệu lực và gắn cờ phân loại kho (`_warehouse: 'xg'` hoặc `_warehouse: 'tole'`).
   - Cập nhật lại cache và re-render giao diện mượt mà.
3. **Đồng bộ thời gian thực (Reactive Realtime & Broadcast):**
   - Lắng nghe sự kiện qua `BroadcastChannel('xg_sync_channel')` và `BroadcastChannel('tole_sync_channel')`.
   - Lắng nghe Supabase realtime subscription trên các bảng liên quan. Khi có thao tác nhập/xuất hoặc chuyển kệ từ bất kỳ tab/thiết bị nào, tự động cập nhật số liệu trên sơ đồ.

### 2.3 Chuẩn Hóa Vị Trí Kệ (Location Normalization)
- Dữ liệu vị trí trong kho có thể tồn tại ở các dạng: `A1` hoặc `A01`, `B1` hoặc `B01`, `Grating` hoặc `GR-01`, `GR-02`.
- Hàm chuẩn hóa `normalizeRackId(raw)`:
  - Bóc tách ký tự chữ và số (ví dụ `a1` $\rightarrow$ `A01`, `A1` $\rightarrow$ `A01`, `B03` $\rightarrow$ `B03`).
  - Các giá trị `GRATING`, `GR-01`, `GR-02`, `KHU VỰC GRATING` quy chuẩn về `GRATING`.
  - Hỗ trợ ánh xạ kệ từ `A01` đến `A14`, `B01` đến `B14` và `GRATING`.
  - Các cuộn chưa gán kệ hoặc vị trí khác chuẩn sẽ hiển thị trong khối cảnh báo "Chưa gán vị trí".

---

## 3. Giao Diện & Trải Nghiệm Người Dùng (UI/UX)

### 3.1 Thanh Chỉ Số Nhanh (Quick KPI Summary Banner)
Đặt tại đầu trang, cung cấp góc nhìn tổng quan:
- **Tổng số cuộn tồn:** Thống kê tổng số lượng cuộn đang có trên kệ.
- **Tổng khối lượng (Tấn / Kg):** Tổng trọng lượng phôi cuộn hiện tại.
- **Phân bổ theo kho:** Số cuộn Xà gồ (Kg) & Số cuộn Tole (Kg).
- **Tình trạng kệ:** Số kệ có hàng / Số kệ trống / Cảnh báo kệ đầy.

### 3.2 Bộ Lọc Kho & Tìm Kiếm Thông Minh
- **Bộ lọc kho:** 3 nút chuyển nhanh:
  - `[ Tất cả ]`: Hiển thị tất cả cuộn từ cả Xà gồ và Tole.
  - `[ Kho Xà gồ ]`: Chỉ tính toán và hiển thị cuộn Xà gồ trên sơ đồ.
  - `[ Kho Tole ]`: Chỉ tính toán và hiển thị cuộn Tole trên sơ đồ.
- **Thanh tìm kiếm:**
  - Ô input tìm kiếm theo `Mã vật tư`, `Tên vật tư`, `Batch`, `Cuộn ID`.
  - Kệ nào có cuộn khớp điều kiện tìm kiếm sẽ:
    - Viền sáng hiệu ứng nhịp thở (pulse animation ring).
    - Hiển thị badge số lượng cuộn tìm thấy ngay tại tâm kệ.
    - Làm mờ (dimmed) các kệ không có cuộn phù hợp để người dùng dễ tập trung.

### 3.3 Sơ Đồ Mặt Bằng Xưởng 5S (Interactive 2D Floor Map)
Bố cục tiêu chuẩn xưởng 5S:
- **Dãy B (Bên trái):** Kệ từ `B14` xuống `B01`.
  - Màu sắc kệ phản ánh mật độ: Trống (màu xám xanh nhạt), Đang chứa cuộn (màu cam pastel dịu), Kệ tải trọng cao (viền nổi bật).
- **Lối đi trung tâm:** Màu xanh sơn sàn công nghiệp 5S, chữ "LỐI ĐI GIỮA XƯỞNG" xoay dọc, biểu tượng "YOU ARE HERE".
- **Dãy A (Bên phải):** Kệ từ `A14` xuống `A01`.
- **Khu vực Grating & Tập kết hàng:** Góc dưới bên phải (sức chứa, số cuộn đang để tại sàn).
- **Đường xe vào xuất nhập hàng:** Góc dưới bên trái kèm kích thước thực tế chuẩn 5S.

### 3.4 Tương Tác Kệ (Hover & Click Modal)
- **Hover:** Tooltip gọn gàng hiển thị:
  - Tên kệ, số cuộn hiện tại / định mức, tổng trọng lượng (Kg).
  - Tóm tắt 3-5 cuộn mới nhất (Cuộn ID, Mã VT, Kg).
- **Click vào kệ:** Mở **Modal Chi Tiết Kệ (Bootstrap Modal)**:
  - Tiêu đề modal: Tên kệ kèm số lượng cuộn và tổng Kg.
  - Bộ lọc tìm kiếm nhanh bên trong modal.
  - Bảng danh sách cuộn đầy đủ:
    - `STT`
    - `Kho` (Badge xanh dương XG hoặc xanh lá Tole)
    - `Cuộn ID`
    - `Mã vật tư`
    - `Tên vật tư`
    - `Batch`
    - `Khối lượng (Kg)`
    - `Ngày nhập`
    - `Tuổi kho (ngày)`
    - `Mã công trình` / `Tên công trình`
  - Nút **Xuất Excel (.xlsx)**: Sử dụng SheetJS (`XLSX.writeFile`) xuất toàn bộ danh sách cuộn của kệ thành file Excel chuẩn.
  - Nút **Mở trang Quét cuộn / Tra cứu vị trí**: Chuyển hướng sang `/pages/tem-nhan-kiem-ke/vi-tri-ton.html?vitri=[Tên_Kệ]`.

---

## 4. Chi Tiết Thay Đổi Kỹ Thuật (Implementation Details)

### 4.1 `pages/5s/5s-so-do-phoi-cuon.html`
- Thay thế thư viện PapaParse CSV bằng:
  - Bootstrap 5.3.3 CSS & JS (cho Modal và styling chuẩn)
  - Bootstrap Icons & Lucide Icons
  - SheetJS (`xlsx.full.min.js`)
  - Supabase client (`@supabase/supabase-js@2`)
  - `/assets/js/core/supabase-config.js`
  - `/assets/js/core/inventory-lock-service.js`
  - `/assets/js/core/qr-scanner-service.js`
- Tích hợp cấu trúc Sidebar, Topbar và khung chứa app đáp ứng linh hoạt từ Mobile đến Desktop màn hình rộng.

### 4.2 `assets/js/5s/5s-so-do-phoi-cuon.js`
- Quản lý trạng thái:
  - `activeFilter`: `'all' | 'xg' | 'tole'`
  - `warehouseState`: Map các kệ `A01`..`A14`, `B01`..`B14`, `GRATING`, `UNASSIGNED`
  - `rawXgTon`, `rawToleTon`
- Hàm tính toán:
  - `normalizeRackCode(code)`
  - `calculateStorageDays(importDate)`
  - `formatNumber(num)`
- Hàm render:
  - `renderKpiHeader()`
  - `renderMapLayout()`
  - `renderShelfItem()`
  - `openShelfDetailModal(shelfId)`
  - `exportShelfExcel(shelfId)`

### 4.3 `assets/css/5s/5s-so-do-phoi-cuon.css`
- Tối ưu animation: Pulse highlight khi tìm kiếm, hover effect mượt mà, định dạng bảng cuộn trong modal, custom scrollbar.

---

## 5. Kế Hoạch Xác Minh & Kiểm Thử (Verification Plan)
1. **Kiểm tra nạp dữ liệu:**
   - Đảm bảo tải thành công từ cache (0ms) và fetch đầy đủ từ Supabase.
   - So sánh số lượng tồn kho với `xg-ton.html` và `tole-ton.html` để đảm bảo số liệu khớp 100%.
2. **Kiểm tra bộ lọc kho:**
   - Chuyển đổi giữa `[ Tất cả ]`, `[ Kho Xà gồ ]`, `[ Kho Tole ]` và xác nhận số liệu hiển thị trên các kệ cập nhật chính xác.
3. **Kiểm tra tìm kiếm:**
   - Gõ thử mã vật tư, mã cuộn, kiểm tra các kệ phát sáng chính xác.
4. **Kiểm tra Modal & Xuất Excel:**
   - Click vào kệ bất kỳ (ví dụ `B10`, `B13`, `A01`, `Grating`), kiểm tra modal mở lên hiển thị đầy đủ thông tin cuộn.
   - Bấm nút xuất file Excel và kiểm tra nội dung file tải về.
5. **Kiểm tra tính tương thích thiết bị:**
   - Kiểm tra hiển thị tốt trên Desktop, Tablet và Mobile.
