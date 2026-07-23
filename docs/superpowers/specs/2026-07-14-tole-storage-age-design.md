# Thiết kế tính toán Số ngày lưu kho trung bình của Tồn kho (Tole)

Tài liệu này đặc tả thiết kế thay đổi cách tính toán chỉ số **Số ngày lưu kho trung bình của Tồn kho** hiển thị tại trang Biểu đồ tổng quan Tole (`tole-bieu-do.html` / `tole-bieu-do.js`) sao cho khớp hoàn toàn với trung bình cộng của cột **Thời gian lưu kho** trong file/trang Tồn kho Tole (`tole-ton.html` / `tole-ton-supabase.js`).

## Hiện trạng và Vấn đề
- Trên trang Tồn kho (`tole-ton`), cột "Thời gian lưu kho" của mỗi cuộn tôn được tính bằng số ngày nguyên từ **Ngày nhập** đến **Ngày hiện tại (hôm nay)**, quy về `00:00:00.000` giờ local và lấy phần nguyên (`Math.floor`).
- Trên trang Biểu đồ (`tole-bieu-do`), chỉ số "SỐ NGÀY LƯU KHO TB CỦA TỒN KHO" đang được tính toán theo biến `evaluationEndDate` (bộ lọc "Đến ngày", mặc định là ngày hôm nay lúc `23:59:59.999`). Việc này dẫn đến:
  1. Chỉ số bị tính lẻ (có phần thập phân do chênh lệch giờ) trước khi chia trung bình.
  2. Bị lọc bớt các dòng nằm ngoài khoảng lọc của biểu đồ.
  3. Giá trị hiển thị lệch so với trung bình thực tế hiển thị trên trang Tồn kho.

## Thiết kế Giải pháp
- Thay đổi logic tính toán `averageStockAge` trong hàm `processDataAndCreateCharts` ở file `tole-bieu-do.js`.
- Việc tính toán này sẽ lặp qua toàn bộ dòng của `tonData` mà không lọc theo `evaluationEndDate`.
- Sử dụng mốc ngày hôm nay (`today` lúc `00:00:00.000` giờ địa phương) và ngày nhập (`importDate` lúc `00:00:00.000` giờ địa phương) để tính hiệu số ngày nguyên, giống hệt hàm `calculateStorageAge` bên `tole-ton-supabase.js`.

### Logic chi tiết
```javascript
  let totalStockAgeDays = 0;
  let stockCount = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < tonData.length; i++) {
    const row = tonData[i];
    if (!row || row.length === 0) continue;
    const isEmpty = row.every(cell => !cell || String(cell).trim() === '');
    if (isEmpty) continue;

    const dateIn = parseRowDate(row[tonDateColIndex]);
    if (dateIn) {
      const importDate = new Date(dateIn);
      importDate.setHours(0, 0, 0, 0);
      const diffTime = today - importDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const storageDays = diffDays >= 0 ? diffDays : 0;
      
      totalStockAgeDays += storageDays;
      stockCount++;
    }
  }

  const averageStockAge = stockCount > 0 ? (totalStockAgeDays / stockCount) : 0;
```

## Kế hoạch kiểm thử
1. Mở trang Biểu đồ tổng quan Tole (`tole-bieu-do.html`), ghi lại giá trị hiển thị ở ô "SỐ NGÀY LƯU KHO TB CỦA TỒN KHO".
2. Mở trang Tồn kho Tole (`tole-ton.html`), tính toán trung bình cộng thực tế của cột "Thời gian lưu kho".
3. Xác nhận hai giá trị trùng khớp nhau sau khi cập nhật mã nguồn.
