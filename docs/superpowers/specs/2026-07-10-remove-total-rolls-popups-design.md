# Thiết kế: Loại bỏ mục Tổng số cuộn trong tất cả các popup

Mục tiêu: Loại bỏ sự hiển thị của mục "Tổng số cuộn" trong tất cả các popup (modal thêm/sửa dữ liệu) của cả 4 phân hệ (XG - Nhập, XG - Xuất, Tole - Nhập, Tole - Xuất) mà không làm ảnh hưởng đến logic JavaScript và lưu dữ liệu.

## Chi tiết thay đổi

### 1. HTML Modals (Hộp thoại)
Thêm class `d-none` (Bootstrap 5) vào thẻ `<tr>` chứa "Tổng số cuộn" của cả bảng Thêm (`rollsTable`) và Sửa (`editRollsTable`).

Các file cần sửa:
- [xg-xuat.html](file:///c:/Users/benhhc/Desktop/web/pages/xg/xg-xuat.html)
- [xg-nhap.html](file:///c:/Users/benhhc/Desktop/web/pages/xg/xg-nhap.html)
- [tole-xuat.html](file:///c:/Users/benhhc/Desktop/web/pages/tole/tole-xuat.html)
- [tole-nhap.html](file:///c:/Users/benhhc/Desktop/web/pages/tole/tole-nhap.html)

Ví dụ thay đổi:
```html
<tr class="table-info d-none">
  <td class="text-end fw-bold">Tổng số cuộn:</td>
  <td class="fw-bold" id="totalRollsCount">0</td>
  <td></td>
</tr>
```

### 2. JavaScript (Input fields tự động)
Trong các vòng lặp tạo input bổ sung khi mở modal (`openAddDataModal` và `openEditDataModal`), nếu tên cột là "số cuộn", thiết lập hiển thị của cột bọc ngoài (`col`) thành ẩn (`display = 'none'`).

Các file cần sửa:
- [xg-xuat.js](file:///c:/Users/benhhc/Desktop/web/assets/js/xg/xg-xuat.js)
- [xg-nhap.js](file:///c:/Users/benhhc/Desktop/web/assets/js/xg/xg-nhap.js)
- [tole-xuat.js](file:///c:/Users/benhhc/Desktop/web/assets/js/tole/tole-xuat.js)
- [tole-nhap.js](file:///c:/Users/benhhc/Desktop/web/assets/js/tole/tole-nhap.js)

Ví dụ thay đổi:
```javascript
if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
  col.style.display = 'none'; // Ẩn cột bọc ngoài chứa input
  label.textContent = 'Tổng số cuộn';
  input = document.createElement('input');
  ...
}
```

## Phương án kiểm thử thủ công
1. Mở trang web ứng dụng.
2. Bấm vào nút "Thêm dữ liệu" hoặc "Sửa dữ liệu" (sau khi chọn dòng) của bất kỳ phân hệ nào.
3. Xác nhận:
   - Trong bảng Danh sách cuộn, dòng "Tổng số cuộn:" đã bị ẩn.
   - Trong phần Thông tin bổ sung, ô nhập "Tổng số cuộn" đã bị ẩn.
4. Thử thêm/sửa một số cuộn và bấm lưu.
5. Xác nhận dữ liệu được lưu thành công lên bảng tính Google Sheets và giá trị Số cuộn vẫn được tính toán chính xác trên giao diện chính.
