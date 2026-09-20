# Tài Liệu Thiết Kế Đặc Tả: Nâng Cấp Sơ Đồ Kho Phế Liệu 5S (5s-so-do-phe-lieu)

## 1. Tổng Quan & Mục Tiêu

### 1.1. Bối cảnh
Trước đây, trang Sơ đồ kho phế liệu (`pages/5s/5s-so-do-phe-lieu.html` và `assets/js/5s/5s-so-do-phe-lieu.js`) sử dụng liên kết Google Sheet CSV tĩnh để lấy dữ liệu. Việc này không phản ánh dữ liệu thực tế đang được cập nhật liên tục trên hệ thống Supabase (`pl-can-thu`), đồng thời thiếu bộ lọc theo từng **Kỳ đổ** (Dumping periods), không có phân tích chi tiết theo xưởng và giao diện chưa hỗ trợ Dark/Light mode như chuẩn 5S hiện hành của hệ thống DDC (`5s-so-do-phoi-cuon.html`).

### 1.2. Mục tiêu
- Thay thế hoàn toàn cơ chế lấy dữ liệu từ Google Sheets CSV sang đọc trực tiếp từ bảng Supabase `pl-can-thu` thông qua thư viện kết nối chuẩn `assets/js/core/supabase-config.js`.
- Bổ sung bộ lọc **Kỳ đổ** (Dumping periods), mặc định chọn Kỳ mới nhất, kèm tùy chọn "Tất cả các kỳ đổ" và lưu kỳ đã chọn vào `sessionStorage`.
- Ánh xạ chuẩn xác từng loại phế liệu thực tế trong dữ liệu `pl-can-thu` vào 10 khu vực mặt bằng kho 5S.
- Nâng cấp giao diện đạt chuẩn cao cấp:
  - Hỗ trợ chế độ Dark Mode và Light Mode (tự động khôi phục theme theo hệ thống DDC, chống chớp trắng khi tải trang).
  - Thẻ KPI thông minh: Tổng khối lượng phế liệu trong kỳ (Tấn / kg), số khu vực cảnh báo đầy, kỳ đổ đang chọn.
  - Thanh công cụ tiện ích: Chọn kỳ đổ, ô tìm kiếm nhanh (highlight khu vực), nút làm mới nóng, nút xuất Excel `.xlsx`.
  - Tương tác khu vực: Hover xem tóm tắt thông số, Click mở **Modal chi tiết khu vực** (phân rã khối lượng theo từng Xưởng và bảng danh sách chi tiết các lần đổ).

---

## 2. Kiến Trúc & Luồng Dữ Liệu

### 2.1. Nguồn dữ liệu & Cơ chế SWR Cache
- **Bảng Supabase**: `pl-can-thu`
- **Các trường chính**:
  - `id`: Định danh bản ghi
  - `Ngày`: Ngày đổ phế liệu (`YYYY-MM-DD` hoặc `DD/MM/YYYY`)
  - `Kì đổ`: Chuỗi tên kỳ đổ (ví dụ: `Kì 8: 03/08/26 - 03/09/26`, `Kì 7: 06/07/26 - 01/08/26`,...)
  - `Xưởng`: Mã xưởng đổ phế liệu (ví dụ: `AH1`, `AH2`, `TB`, `Gia công`...)
  - `Loại phế liệu`: Tên phân loại (ví dụ: `Loại 1`, `Mỹ Thủy - Nam Anh`, `Mạt khoan`, `Dây đai`, `Thùng sơn`, `Sỉ cắt`, `Sỉ đất`, `Inox 409`...)
  - `Số lượng (kg)`: Khối lượng tính bằng kg
  - `Ghi chú`: Ghi chú kèm theo
- **Chiến lược nạp dữ liệu Stale-While-Revalidate (SWR)**:
  - Ngay khi tải trang, đọc nhanh từ `getStoredTableCache('pl-can-thu')` nếu có để vẽ sơ đồ ngay lập tức (0ms delay).
  - Đồng thời kích hoạt `fetchAllFromSupabase('pl-can-thu')` chạy ngầm. Khi dữ liệu mới về, cập nhật lại state, làm mới sơ đồ và lưu lại vào cache.

### 2.2. Xử lý Trích xuất Kỳ đổ (Periods Extraction)
- Tự động trích xuất các giá trị duy nhất của cột `Kì đổ` từ tập dữ liệu.
- Chuẩn hóa và sắp xếp danh sách các kỳ theo số thứ tự (Kỳ 1 -> Kỳ 8,...).
- Khởi tạo giá trị `selectedPeriod`:
  - Ưu tiên 1: Giá trị lưu trong `sessionStorage.getItem('pl5s_selected_period')`.
  - Ưu tiên 2: Kỳ mới nhất (kỳ cuối cùng trong danh sách đã sắp xếp).
  - Cho phép người dùng chuyển sang `'ALL'` (Tất cả các kỳ đổ) để xem tổng dồn.

---

## 3. Quy Tắc Ánh Xạ Khu Vực Phế Liệu (Scrap Mapping Engine)

Mặt bằng kho 5S phế liệu gồm 10 khu vực với kích thước và định mức an toàn tối đa:

| ID Khu vực | Tên khu vực | Sức chứa tối đa (maxCapacity) | Đơn vị | Quy tắc ánh xạ Loại phế liệu từ `pl-can-thu` |
| :--- | :--- | :--- | :--- | :--- |
| `thung-son` | Thùng sơn | 3.5 | tấn | Chứa các chuỗi: `thùng sơn`, `vỏ thùng`, `son` |
| `go` | Gỗ vụn | 10.0 | tấn | Chứa các chuỗi: `gỗ`, `pallet`, `go` |
| `loai-1` | Loại 1 | 350.0 | tấn | Chứa các chuỗi: `loại 1`, `loai 1`, `thầu phụ`, `thau phu`, `thùng thuốc hàn` |
| `day-dai` | Dây đai | 10.0 | tấn | Chứa các chuỗi: `dây đai`, `day dai`, `đai thép` |
| `mat-khoan` | Mạt khoan | 15.0 | tấn | Chứa các chuỗi: `mạt khoan`, `mat khoan`, `dây hàn`, `day han` |
| `my-thuy` | Mỹ Thủy | 100.0 | tấn | Chứa các chuỗi: `mỹ thủy`, `my thuy`, `mỹ thuỷ`, `cầu mỹ thủy` |
| `inox` | Inox | 2.0 | tấn | Chứa các chuỗi: `inox`, `inox 304`, `inox 409`, `thép không gỉ` |
| `vo-xe` | Vỏ xe | 50 | cái | Chứa các chuỗi: `vỏ xe`, `vo xe`, `lốp xe` (tính theo cái, nếu có) |
| `tap-ket` | Tập kết sỉ & rỗng | 50.0 | tấn | Chứa các chuỗi: `sỉ cắt`, `si cat`, `sỉ đất`, `si dat`, `sắt dính sỉ`, `thùng rỗng` |
| `tram-dien` | Trạm điện AH1 | - | - | Khu vực kỹ thuật cố định, không dùng chứa phế liệu |

### Công thức tính toán & Trạng thái màu sắc:
- Đối với khu vực tính theo **tấn**: `capacity = Tổng kg / 1000`.
- Đối với khu vực tính theo **cái**: `capacity = Tổng kg` (hoặc số lượng nguyên).
- Tỷ lệ lấp đầy: `percentage = Math.min((capacity / maxCapacity) * 100, 100)`.
- Phân nhóm cảnh báo:
  - `percentage < 70%`: Xanh lá (An toàn, còn nhiều chỗ trống).
  - `70% <= percentage <= 90%`: Cam (Cảnh báo sắp đầy, cần chuẩn bị thu gom).
  - `percentage > 90%`: Đỏ (Cảnh báo đầy/quá tải, cần thu gom gấp).

---

## 4. Giao Diện & Trải Nghiệm Người Dùng (UI/UX)

### 4.1. Hệ Thống Theme & Header
- **Chế độ Sáng / Tối**:
  - Tích hợp thẻ `<script>` inline đặt trước DOM để đọc `ddc_theme` từ `localStorage` và gán thuộc tính `data-bs-theme="dark|light"` tức thì.
  - Đồng bộ bảng màu nền tối: `#0f1117` cho body, `#1a1d2d` cho app container, `#202538` cho các thẻ card.
- **Thanh Header KPI**:
  - Tiêu đề chính: SƠ ĐỒ KHO PHẾ LIỆU - 5S.
  - KPI 1: Tổng trọng lượng phế liệu trong kỳ (Tấn / kg).
  - KPI 2: Số khu vực cảnh báo đầy / quá tải (>90%).
  - KPI 3: Số khu vực an toàn (<70%).
  - KPI 4: Kỳ đổ đang xem & thời điểm đồng bộ gần nhất.

### 4.2. Thanh Công Cụ (Toolbar)
- **Dropdown chọn Kỳ đổ**: `<select id="period-filter">`, tự động tạo danh sách kỳ, có icon lịch và hiển thị kỳ đang chọn.
- **Ô Tìm kiếm**: `<input id="search-input">`, debounce 250ms, tự động làm nổi bật (highlight đường viền neon và hiệu ứng phóng to nhẹ) khu vực có tên hoặc loại phế liệu/xưởng trùng khớp.
- **Nút Làm mới**: Biểu tượng Lucide `refresh-cw`, xoay tròn khi đang fetch lại từ Supabase.
- **Nút Xuất Excel**: Xuất toàn bộ danh sách phế liệu chi tiết trong kỳ ra file `.xlsx` bao gồm các cột: STT, Ngày, Kỳ đổ, Xưởng, Loại phế liệu, Số lượng (kg), Ghi chú, Phân bổ khu vực 5S.
- **Nút Chuyển Theme**: Nút toggle Dark/Light mode linh hoạt.

### 4.3. Sơ Đồ Mặt Bằng & Tương Tác
- Giữ nguyên tỷ lệ chuẩn chính xác 96m x 11m của mặt bằng kho phế liệu.
- Thẻ khu vực hiển thị: Tên khu vực, khối lượng hiện tại / sức chứa tối đa, thanh tiến trình màu sắc động.
- **Thanh bên phải (Right Sidebar)**: Hiển thị danh sách tóm tắt nhanh trạng thái 9 khu vực phế liệu.
- **Modal Chi Tiết Khu Vực**:
  - Mở lên khi click vào bất kỳ khu vực nào trên sơ đồ hoặc thanh bên.
  - Header modal: Tên khu vực, sức chứa tối đa, tổng tấn đang chứa, thanh đo tỷ lệ % trực quan.
  - Tab 1 - **Phân rã theo Xưởng**: Thống kê tổng kg từng xưởng (AH1, AH2...) đã đổ vào khu vực này kèm thanh % tỷ trọng.
  - Tab 2 - **Danh sách chi tiết lần đổ**: Bảng chi tiết từng dòng dữ liệu: STT, Ngày, Xưởng, Loại phế liệu, Khối lượng (kg), Ghi chú.

---

## 5. Kế Hoạch Kiểm Thử & Xác Minh

1. **Kiểm thử tích hợp Supabase**:
   - Xác minh truy vấn dữ liệu từ bảng `pl-can-thu` hoạt động bình thường, lấy đúng các cột dữ liệu.
2. **Kiểm thử bộ lọc Kỳ đổ**:
   - Chuyển đổi giữa Kỳ 1, Kỳ 2... Kỳ 8 và "Tất cả các kỳ đổ".
   - Xác nhận khối lượng và sơ đồ cập nhật chính xác theo từng kỳ tương ứng với số liệu trên trang `pl-can-thu.html`.
3. **Kiểm thử Modal chi tiết**:
   - Kiểm tra click vào các ô Mỹ Thủy, Loại 1, Mạt khoan, Tập kết... mở đúng modal với danh sách phân rã theo xưởng chuẩn xác.
4. **Kiểm thử Dark/Light Theme**:
   - Đổi qua lại giữa Dark và Light mode, kiểm tra độ tương phản, các thẻ KPI, toolbar và modal.
5. **Kiểm thử Đồng bộ build**:
   - Chạy `node scripts/sync-dist.js` để đồng bộ file sang `dist/`, `public/`, `dist-app/`.
