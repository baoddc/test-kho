# Thiết Kế Hệ Thống Tạo & In Tem Barcode Cuộn Xà Gồ & Tole (in-tem-cuon)

## 1. Tổng Quan Mục Tiêu
Cung cấp trang web công cụ chuyên dụng `pages/tem-nhan-kiem-ke/in-tem-cuon.html` (kèm các tệp CSS và JS tương ứng) trong phân hệ Tem Nhãn & Kiểm Kê để tạo, xem trước, tải ảnh ZIP và in ấn hàng loạt tem mã vạch (Barcode Code 128) cho các cuộn xà gồ và tole đang tồn kho hoặc từ file Excel tồn kho được chọn.

## 2. Yêu Cầu Kỹ Thuật Chi Tiết

### 2.1. Nguồn Dữ Liệu Tồn Kho ("File tồn tương ứng được chọn")
- **Nguồn 1: Trực tiếp từ CSDL Supabase**
  - Người dùng có thể chọn giữa **Kho Xà gồ** hoặc **Kho Tole**.
  - Logic tính tồn kho đồng bộ với toàn hệ thống:
    - Kho Xà gồ: Lấy toàn bộ `xg-nhap`, loại bỏ các cuộn có `Cuộn ID` đã xuất trong `xg-xuat`.
    - Kho Tole: Lấy toàn bộ `tole-nhap`, loại bỏ các cuộn có `Cuộn ID` đã xuất trong `tole-xuat`.
- **Nguồn 2: Tải lên File Excel Tồn kho (`.xlsx`, `.xls`)**
  - Nút bấm tải lên file Excel trực tiếp từ máy tính.
  - Sử dụng thư viện `SheetJS (xlsx)` đọc dữ liệu bảng tính.
  - Tự động map các cột: `Mã vật tư` (hoặc `Mã VT`), `Tên vật tư` (hoặc `Tên hàng`), `Batch` (hoặc `Lô`), `Cuộn ID` (hoặc `Mã cuộn`), `Số lượng (Kg)` / `Khối lượng (kg)` (và `Khối lượng (m)` nếu có), `Vị trí`, `Ngày nhập`.
  - Hiển thị thông báo số lượng cuộn đọc được từ file và nạp vào danh sách chọn in.

### 2.2. Quy Chuẩn Kỹ Thuật Mã Vạch (JsBarcode Code 128)
Theo đúng yêu cầu kỹ thuật:
- **Độ rộng vạch (`width`):** `4px`
- **Chiều cao vạch (`height`):** `90px`
- **Kích thước font chữ dưới mã vạch (`fontSize`):** `35px`
- **Hiển thị text (`displayValue`):** `true`
- **Định dạng dữ liệu mã hóa:**
  - *Mặc định (Chuẩn quét kiểm kê & vị trí):* `{Mã vật tư}-{Batch}-{Khối lượng}` (Ví dụ: `10001189-2.5X75VN-2570`). Khối lượng được chuẩn hóa thành số nguyên hoặc làm tròn để đảm bảo định dạng mã vạch sạch và máy quét barcode/camera giải mã nhanh chóng.
  - *Tùy chọn bổ sung:* Cho phép chuyển đổi chế độ mã hóa sang `{Cuộn ID}` qua toggle switch nếu cần in tem theo định danh cuộn ID.

### 2.3. Bố Cục & In Ấn A4
- **Bố cục hiển thị & in ấn:**
  - In **2 tem theo mặt ngang của giấy A4** (Grid 2 cột) và **chạy dài xuống liên tục đến hết trang**.
  - Tự động ngắt trang (`page-break-inside: avoid; break-inside: avoid;`) đảm bảo mỗi tem nằm trọn vẹn trong trang, không bị cắt đôi.
- **Nội dung hiển thị trên mỗi nhãn tem:**
  - Header tem: Logo DDC + Tiêu đề đơn vị (KHO XÀ GỒ / KHO TOLE - ĐẠI DŨNG).
  - Tên vật tư (chữ in hoa đậm, kích thước lớn, tương phản cao để đọc từ xa).
  - Khung thông tin cuộn:
    - Mã vật tư | Batch | Cuộn ID
    - Khối lượng: ... Kg (kèm ... mét nếu là tole)
    - Vị trí kệ lưu trữ | Ngày nhập kho
  - Khung mã vạch: SVG Barcode Code 128 tạo bởi `JsBarcode` theo đúng cấu hình width: 4px, height: 90px, fontSize: 35px.

### 2.4. Tiện Ích Người Dùng
- Bộ lọc theo Vị trí (chọn nhanh theo Kệ A01-A14, B01-B14, Grating...).
- Ô tìm kiếm tức thì theo từ khóa (Mã VT, Tên VT, Batch, Cuộn ID).
- Checkbox chọn tất cả / bỏ chọn / chọn từng cuộn, có badge đếm số lượng tem đang chọn.
- Nút **"In Danh Sách Tem (Ctrl + P)"**: Kích hoạt hộp thoại in của trình duyệt (`window.print()`), ẩn toàn bộ thanh công cụ không cần thiết qua `@media print`.
- Nút **"Tải tất cả ảnh Barcode (.ZIP)"**: Tự động chuyển đổi các SVG Barcode sang canvas PNG và đóng gói thành file `.zip` tải về qua `JSZip` + `FileSaver`.

## 3. Cấu Trúc File & Vị Trí Lưu Trữ
1. `pages/tem-nhan-kiem-ke/in-tem-cuon.html`: Giao diện trang HTML.
2. `assets/css/tem-nhan-kiem-ke/in-tem-cuon.css`: CSS styling & `@media print`.
3. `assets/js/tem-nhan-kiem-ke/in-tem-cuon.js`: JavaScript xử lý nghiệp vụ, tải tồn kho, đọc Excel, sinh Barcode.
4. Cập nhật `assets/js/components/sidebar.js`: Thêm link menu điều hướng "In tem Barcode Cuộn" trong phân hệ Tem Nhãn & Kiểm Kê.
5. Cập nhật `pages/quan-ly-user.html` & `assets/js/quan-ly-user.js`: Thêm quyền truy cập cho trang `in-tem-cuon.html`.
6. Đồng bộ toàn bộ sang `dist/`, `dist-app/`, `public/` qua script `npm run build`.

## 4. Kế Hoạch Kiểm Thử (Verification Plan)
1. **Kiểm tra tải dữ liệu:**
   - Tải dữ liệu tồn kho Xà gồ từ Supabase -> kiểm tra danh sách cuộn hiển thị chính xác.
   - Chuyển sang Kho Tole -> kiểm tra dữ liệu tồn tole hiển thị đúng.
   - Tải thử file Excel tồn kho -> xác nhận dữ liệu từ file Excel được nạp thành công.
2. **Kiểm tra tạo mã vạch:**
   - Xác minh mã vạch được sinh với `width: 4`, `height: 90`, `fontSize: 35`, text hiển thị rõ ràng bên dưới.
   - Xác minh chuỗi mã vạch khớp chuẩn `{Mã vật tư}-{Batch}-{Khối lượng}` (ví dụ thử nghiệm quét với `parseCoilBarcode`).
3. **Kiểm tra in ấn:**
   - Mở bản xem trước in (Print Preview): Xác nhận 2 tem trên một hàng ngang, căn chỉnh đều đặn, không bị tràn lề, tự động ngắt trang chuẩn.
4. **Kiểm tra xuất file ZIP:**
   - Chọn vài cuộn và tải ZIP -> mở file ZIP kiểm tra các file ảnh PNG bên trong.
