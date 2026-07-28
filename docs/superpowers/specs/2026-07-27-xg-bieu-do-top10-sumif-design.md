# Thiết kế Kỹ thuật - Cập nhật Biểu đồ TOP 10 Vật tư Nhập / Xuất Kho Xà gồ

Tài liệu này mô tả chi tiết giải pháp cập nhật lại logic tính toán và hiển thị biểu đồ Top 10 vật tư nhập kho nhiều nhất và Top 10 vật tư xuất kho nhiều nhất trên trang `xg-bieu-do.html`.

## Bối cảnh và Yêu cầu
- Hiện tại, biểu đồ Top 10 vật tư nhập kho và xuất kho trong `xg-bieu-do.js` nhóm dữ liệu gián tiếp qua mã vật tư rồi tìm tên ngắn nhất, dẫn đến việc cộng gộp SUMIF bị phân rã hoặc hiển thị chưa thống nhất nhãn `Mã vật tư - Tên vật tư`.
- Yêu cầu của người dùng:
  1. Dựa trên dữ liệu từ Supabase bảng `xg-nhap` cho Top 10 vật tư nhập kho nhiều nhất.
  2. Dựa trên dữ liệu từ Supabase bảng `xg-xuat` cho Top 10 vật tư xuất kho nhiều nhất.
  3. Nối 2 trường `Mã vật tư - Tên vật tư` để làm nhãn/khóa định danh vật tư.
  4. Tính toán tổng số lượng nhập/xuất theo khóa định danh này như hàm `SUMIF` trong Excel.

## Thiết kế Chi tiết

### 1. Thuật toán Nối khóa vật tư (Material Key Concatenation)
Dành cho từng dòng dữ liệu trong `xg-nhap` và `xg-xuat`:
- Trích xuất `ma` (`Mã vật tư`) và `ten` (`Tên vật tư`).
- Tạo nhãn kết hợp:
  - Nếu cả `ma` và `ten` đều có giá trị và `ma !== ten`: `key = `${ma} - ${ten}``
  - Nếu `ma` và `ten` trùng nhau hoặc 1 trong 2 rỗng: lấy giá trị không rỗng (`ma || ten`).

### 2. Thuật toán SUMIF (Cộng dồn Khối lượng theo Vật tư)
- Với dữ liệu `xg-nhap` (sau khi áp dụng bộ lọc ngày nếu có):
  - Khởi tạo đối tượng `importMaterialVolumes = {}`
  - Với mỗi dòng hợp lệ, tính `key`: `importMaterialVolumes[key] = (importMaterialVolumes[key] || 0) + quantity`
- Với dữ liệu `xg-xuat` (sau khi áp dụng bộ lọc ngày nếu có):
  - Khởi tạo đối tượng `exportMaterialVolumes = {}`
  - Với mỗi dòng hợp lệ, tính `key`: `exportMaterialVolumes[key] = (exportMaterialVolumes[key] || 0) + quantity`

### 3. Hiển thị Top 10 trên Biểu đồ Chart.js
- Sắp xếp các vật tư theo tổng khối lượng giảm dần (`sort((a, b) => volumes[b] - volumes[a])`).
- Trích xuất Top 10 vật tư nhiều nhất (`slice(0, 10)`).
- Vẽ lại biểu đồ thanh nằm ngang (`indexAxis: 'y'`) cho `importMaterialChart` và `exportMaterialChart`.

## Các file cập nhật
- [xg-bieu-do.js](file:///c:/Users/thaib/M%C3%A1y%20t%C3%ADnh/web-supabase/assets/js/xg/xg-bieu-do.js)
- [xg-bieu-do.js (dist)](file:///c:/Users/thaib/M%C3%A1y%20t%C3%ADnh/web-supabase/dist-app/assets/js/xg/xg-bieu-do.js)

## Kế hoạch Kiểm thử (Verification Plan)
1. Mở trang biểu đồ Xà gồ `xg-bieu-do.html`.
2. Kiểm tra nhãn hiển thị của 2 biểu đồ Top 10 Nhập và Top 10 Xuất: Đảm bảo có dạng `Mã vật tư - Tên vật tư`.
3. Kiểm tra tính đúng đắn của số liệu SUMIF: So sánh tổng số lượng của các mã vật tư trong Top 10 với tổng số lượng thực tế trong bảng `xg-nhap` và `xg-xuat`.
4. Kiểm tra khi lọc theo khoảng thời gian "Từ ngày" - "Đến ngày": Biểu đồ Top 10 cập nhật lại số liệu SUMIF chính xác theo khoảng thời gian được lọc.
