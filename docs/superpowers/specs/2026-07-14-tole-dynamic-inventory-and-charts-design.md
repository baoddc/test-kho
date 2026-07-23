# Thiết kế Chi tiết - Sửa đổi Logic Tồn kho và Biểu đồ Phân hệ Tole (Supabase)

Tài liệu này mô tả chi tiết thiết kế kỹ thuật nhằm khắc phục các lỗi liên quan đến việc hiển thị tồn kho và vẽ biểu đồ tồn kho trong phân hệ Tole.

## Hiện trạng & Vấn đề cần giải quyết
1. **Lấy sai dữ liệu bảng**: Tệp `tole-ton-supabase.js` đang truy vấn dữ liệu từ bảng xà gồ (`xg-nhap` và `xg-xuat`) thay vì bảng của tole (`tole-nhap` và `tole-xuat`).
2. **Sai cấu trúc ánh xạ cột**: 
   * Bảng `tole-nhap` dùng các trường định lượng là `Số lượng (Kg)` và `Số lượng (m)`.
   * Cấu trúc hiển thị tồn kho (`COLUMN_HEADERS` của `tole-ton`) và bảng database `tole-ton` dùng `Khối lượng (kg)` và `Khối lượng (m)`.
   * Việc không ánh xạ đúng khóa khiến bảng tồn kho động hiển thị các cột khối lượng trống (rỗng).
3. **Biểu đồ Tole tải bảng tĩnh**: Tệp `tole-bieu-do.js` đang tải bảng tĩnh `tole-ton` thay vì tính toán động từ dữ liệu giao dịch nhập/xuất thực tế, dẫn đến việc số liệu biểu đồ bị rỗng hoặc không đồng bộ.
4. **Lỗi copy-paste nhãn file xuất Excel**: Một số tệp javascript tole-nhap và tole-xuat vẫn còn xuất file excel dưới tên `xg_du_lieu_...`.

---

## Giải pháp Đề xuất

Chúng ta sẽ thực hiện theo **Phương án A: Tính toán động toàn phần ở phía client-side**.

### 1. Trang Tồn Kho (`tole-ton-supabase.js`)
* Thay đổi nguồn dữ liệu tải về:
  * Gọi API tải dữ liệu từ `tole-nhap` (toàn bộ các cột) và `tole-xuat` (chỉ cần cột `Cuộn ID` để so khớp).
* Thực hiện logic lọc động:
  ```javascript
  const exportedCuonIds = new Set(
    xuatAll
      .map(row => String(row['Cuộn ID'] || '').trim().toLowerCase())
      .filter(cuonId => cuonId !== '')
  );

  const tonData = nhapAll.filter(row => {
    const cuonId = String(row['Cuộn ID'] || '').trim().toLowerCase();
    if (!cuonId) return false;
    return !exportedCuonIds.has(cuonId);
  });
  ```
* Thực hiện ánh xạ trường dữ liệu sang cấu trúc Tồn kho:
  ```javascript
  const processedTon = tonData.map(row => {
    return {
      id: row.id,
      'Ngày nhập': row['Ngày nhập'] || '',
      'Thời gian lưu kho': calculateStorageAge(row['Ngày nhập']),
      'Vị trí': row['Vị trí'] || '',
      'Mã vật tư': row['Mã vật tư'] || '',
      'Tên vật tư': row['Tên vật tư'] || '',
      'Batch': row['Batch'] || '',
      'Cuộn ID': row['Cuộn ID'] || '',
      'Khối lượng (kg)': row['Số lượng (Kg)'] || 0,
      'Mã công trình': row['Mã công trình'] || '',
      'Tên công trình': row['Tên công trình'] || '',
      'Khối lượng (m)': row['Số lượng (m)'] || 0,
      'Ghi chú': row['Ghi chú'] || ''
    };
  });
  ```

### 2. Trang Biểu Đồ (`tole-bieu-do.js`)
* Sửa đổi hàm `loadAllData()` để tải dữ liệu song song từ `tole-nhap` và `tole-xuat`. Bỏ truy vấn bảng tĩnh `tole-ton`.
* Tính toán tồn kho động ngay khi khởi động để cung cấp dữ liệu cho mảng `tonData`:
  * Sử dụng cùng thuật toán lọc `Cuộn ID` chưa xuất và chuyển đổi các trường `Số lượng (Kg)` thành `Khối lượng (kg)` và `Số lượng (m)` thành `Khối lượng (m)`.
  * Đảm bảo các chỉ số KPIs (Vòng quay tồn kho, số ngày tồn trung bình) hoạt động ổn định trên tập dữ liệu động này.

### 3. File Liên Quan
* Sửa các chuỗi tên file xuất xlsx trong `tole-nhap-supabase.js` và `tole-xuat-supabase.js` thành `tole_du_lieu_nhap.xlsx` và `tole_du_lieu_xuat.xlsx`.
* Dọn dẹp comment thừa có chứa tiền tố `XG` trong các tệp tole này.

---

## Kế hoạch Kiểm thử (Verification Plan)
1. **Kiểm tra dữ liệu tồn kho**: Truy cập `pages/tole/tole-ton.html`, xác nhận dữ liệu tồn kho tole tải thành công, các cột "Khối lượng (kg)" và "Khối lượng (m)" hiển thị đúng số liệu thực tế từ bảng nhập (những cuộn chưa xuất).
2. **Kiểm tra biểu đồ**: Truy cập `pages/tole/tole-bieu-do.html`, xác nhận biểu đồ hoạt động bình thường, các chỉ số tồn kho đầu kì, cuối kì, vòng quay tồn kho tính toán chính xác trên dữ liệu động.
3. **Kiểm tra tải Excel**: Thử nhấn nút tải excel trên các trang Nhập, Xuất, Tồn và xác nhận tên file tải về bắt đầu bằng `tole_...` thay vì `xg_...`.
