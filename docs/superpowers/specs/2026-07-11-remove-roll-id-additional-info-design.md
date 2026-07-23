# Thiết kế: Loại bỏ mục Cuộn ID ở phần Thông tin bổ sung (XG - Xuất & XG - Nhập)

Mục tiêu: Loại bỏ ô nhập "Cuộn ID" ở phần "Thông tin bổ sung" trong popup Thêm và Sửa dữ liệu của hai phân hệ **Kho Xà gồ - Xuất (xg-xuat)** và **Kho Xà gồ - Nhập (xg-nhap)**. Ô nhập này là dư thừa vì thông tin Cuộn ID đã được nhập trực tiếp theo từng cuộn trong bảng danh sách cuộn.

---

## Chi tiết thiết kế

Chúng ta sẽ áp dụng phương án ẩn phần tử HTML trong giao diện bằng cách thiết lập `display: none` trên cột chứa input tương ứng. Phương án này giúp:
- Ẩn hoàn toàn trường dữ liệu khỏi tầm nhìn của người dùng ở phần "Thông tin bổ sung".
- Giữ nguyên các input ẩn trong DOM để không phá vỡ logic thu thập dữ liệu form theo thứ tự chỉ số cột (`col_i`).
- Tránh rủi ro lệch cột hoặc mất dữ liệu khi submit dữ liệu qua Google Apps Script API.

### Các file cần sửa đổi:
1. [xg-xuat.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat.js)
2. [xg-nhap.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-nhap.js)

---

## Chi tiết các thay đổi trong Code

### 1. Phân hệ XG - Xuất (`xg-xuat.js`)

#### 1.1. Trong hàm `openAddDataModal`
Tìm vòng lặp render các cột bổ sung và thêm điều kiện ẩn nếu là cột `cuộn id`.

```javascript
// Thay đổi trong openAddDataModal:
  for (let i = quantityColIndex + 1; i < headers.length; i++) {
    const headerName = (headers[i] || `Cột ${i + 1}`).toLowerCase().trim();
    const normHeader = normalizeHeaderText(headers[i]);

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';
    const label = document.createElement('label');
    label.className = 'form-label';

    let input;
    if (normHeader === 'so cuon' || normHeader.includes('so cuon')) {
      // Ẩn số cuộn
      col.style.display = 'none';
      ...
    } else if (normHeader === 'cuon id' || normHeader.includes('cuon id')) {
      // Ẩn cuộn id trong Thông tin bổ sung
      col.style.display = 'none';
      label.textContent = headers[i] || 'Cuộn ID';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = '';
    } else {
      ...
    }
```

#### 1.2. Trong hàm `openEditDataModal`
Áp dụng logic ẩn tương tự cho modal sửa dữ liệu để giữ lại giá trị cũ của dòng đang sửa mà không hiển thị ra giao diện.

```javascript
// Thay đổi trong openEditDataModal:
  for (let i = quantityColIndex + 1; i < headers.length; i++) {
    const headerName = (headers[i] || `Cột ${i + 1}`).toLowerCase().trim();
    const normHeader = normalizeHeaderText(headers[i]);

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';
    const label = document.createElement('label');
    label.className = 'form-label';

    let input;
    if (normHeader === 'so cuon' || normHeader.includes('so cuon')) {
      // Ẩn số cuộn
      col.style.display = 'none';
      ...
    } else if (normHeader === 'cuon id' || normHeader.includes('cuon id')) {
      // Ẩn cuộn id trong Thông tin bổ sung
      col.style.display = 'none';
      label.textContent = headers[i] || 'Cuộn ID';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = rowData[i] ?? '';
    } else {
      ...
    }
```

---

### 2. Phân hệ XG - Nhập (`xg-nhap.js`)

Thực hiện chỉnh sửa tương tự như trên cho hai hàm `openAddDataModal` và `openEditDataModal` trong file `xg-nhap.js`.

---

## Kế hoạch kiểm thử (Verification Plan)

### Kiểm thử thủ công:
1. Mở trang **Kho Xà gồ - Xuất**.
2. Click **Thêm dữ liệu**:
   - Xác nhận: Mục "Cuộn ID" không hiển thị trong phần **Thông tin bổ sung**.
   - Thêm một số cuộn từ kho tồn (chọn cuộn, xác nhận Cuộn ID xuất hiện ở bảng danh sách cuộn), nhập thông tin và bấm **Thêm**.
   - Xác nhận: Dữ liệu được đẩy lên Google Sheets chính xác và cột Cuộn ID trên bảng hiển thị đúng Cuộn ID đã chọn.
3. Click chọn một dòng và bấm **Sửa dữ liệu**:
   - Xác nhận: Mục "Cuộn ID" không hiển thị trong phần **Thông tin bổ sung**.
   - Thay đổi một thông tin (ví dụ: ghi chú) và bấm **Cập nhật**.
   - Xác nhận: Giá trị Cuộn ID của dòng đó được giữ nguyên, không bị xóa hay thay đổi.
4. Lặp lại các bước 1-3 cho trang **Kho Xà gồ - Nhập**.
