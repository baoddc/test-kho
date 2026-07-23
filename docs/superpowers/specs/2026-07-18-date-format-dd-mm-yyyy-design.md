# Thiết kế đồng bộ định dạng ngày tháng hiển thị thành dd/mm/yyyy

Tài liệu này đặc tả thiết kế thay đổi định dạng hiển thị cột ngày tháng trên toàn bộ giao diện hệ thống từ `yyyy/mm/dd` hoặc `dd/mm/yy` thành `dd/mm/yyyy`.

## Yêu cầu người dùng
- Định dạng hiển thị các cột ngày tháng trên hệ thống (bảng dữ liệu, giao diện người dùng) phải là `dd/mm/yyyy` (ví dụ: `18/07/2026`).
- Chỉ thay đổi định dạng hiển thị trên giao diện, không làm ảnh hưởng đến dữ liệu lưu trữ dưới cơ sở dữ liệu Supabase hay logic sinh mã số phiếu.

## Các tệp tin cần chỉnh sửa

### 1. Phân hệ kết nối Supabase (Xà gồ & Tole)
Chỉnh sửa hàm `formatDate` trả về `${day}/${month}/${year}` thay vì `${year}/${month}/${day}` trong các file:
- `assets/js/xg/xg-xuat-supabase.js`
- `assets/js/xg/xg-ton-supabase.js`
- `assets/js/xg/xg-nhap-supabase.js`
- `assets/js/tole/tole-xuat-supabase.js`
- `assets/js/tole/tole-ton-supabase.js`
- `assets/js/tole/tole-nhap-supabase.js`

### 2. Phân hệ Offline (Xà gồ & Tole) và Trợ lý ảo
Chỉnh sửa hàm `formatDate` để giữ nguyên năm 4 chữ số (loại bỏ `.slice(-2)`) trong các file:
- `assets/js/xg/xg-xuat.js`
- `assets/js/xg/xg-ton.js`
- `assets/js/xg/xg-nhap.js`
- `assets/js/tole/tole-xuat.js`
- `assets/js/tole/tole-ton.js`
- `assets/js/tole/tole-nhap.js`
- `assets/js/voice-assistant.js`

### 3. Phân hệ Phế liệu (PL)
Chỉnh sửa hàm `formatDate` và `formatDateDisplay` giữ nguyên năm 4 chữ số (loại bỏ `.slice(-2)`) trong các file:
- `assets/js/pl/pl-can-thu.js`
- `assets/js/pl/pl-da-thu.js`
- `assets/js/pl/pl-chua-thu.js`
- `assets/js/pl/pl-tong-hop-can-thu.js`
- `assets/js/pl/pl-tong-hop-da-thu.js`
- `assets/js/pl/pl-tong-hop-chua-thu.js`
- `assets/js/pl/pl-phieu-in.js`

## Kế hoạch kiểm thử & xác minh

### Xác minh thủ công
- Truy cập từng trang quản lý trên giao diện (ví dụ: Nhập kho Xà gồ, Tồn kho Xà gồ, Xuất kho Xà gồ, tương tự với Tole và Phế liệu).
- Kiểm tra các dòng dữ liệu ngày nhập, ngày xuất hiển thị đúng định dạng `dd/mm/yyyy` thay vì định dạng cũ.
- Kiểm tra chức năng Lọc theo ngày hoạt động chính xác với định dạng mới.
