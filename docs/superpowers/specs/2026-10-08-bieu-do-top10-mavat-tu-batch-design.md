# Thiết kế Kỹ thuật - Biểu đồ Top 10 Vật tư Nhập / Xuất Kho theo Mã vật tư + Batch

Tài liệu thiết kế chi tiết cập nhật thuật toán tính toán và hiển thị cho 2 biểu đồ:
- **TOP 10 VẬT TƯ NHẬP KHO NHIỀU NHẤT**
- **TOP 10 VẬT TƯ XUẤT KHO NHIỀU NHẤT**
trên cả hai màn hình Dashboard:
1. `xg-bieu-do.html` (Xà gồ)
2. `tole-bieu-do.html` (Tole)

---

## 1. Bối cảnh & Yêu cầu

### Vấn đề hiện tại
- Trước đây, biểu đồ Top 10 tính tổng SUMIF theo cặp `Mã vật tư - Tên vật tư`.
- Tuy nhiên, trong quản lý kho xà gồ và tôn cuộn, cùng một mã vật tư (ví dụ: `10001189`) có thể có nhiều quy cách / lô sản xuất khác nhau theo `Batch` (ví dụ: `1.5X348VN`, `1.5X145VN`, `1.8X405VN`...). Nếu gộp chung theo mã vật tư thì không phản ánh được quy cách nhập/xuất thực tế của từng lô cuộn.

### Yêu cầu mới
- Tính tổng sản lượng (kg) SUMIF dựa trên cặp định danh: **Mã vật tư + Batch**.
- Định dạng nhãn hiển thị trên trục Y của biểu đồ:
  - Dạng ngắn gọn: `Mã VT (Batch)` (ví dụ: `10001189 (1.5X348VN)`).
  - Nếu không có Batch (hoặc Batch là rỗng / `Không batch` / `-`): hiển thị `Mã VT` (hoặc `Tên VT` nếu mã rỗng).
- Tooltip khi hover vào thanh biểu đồ:
  - Hiển thị nhãn `Mã VT (Batch)`
  - Hiển thị đầy đủ `Tên vật tư` tương ứng
  - Hiển thị khối lượng kg: `Sản lượng nhập / xuất (kg): X kg`

---

## 2. Thuật toán Chi tiết

### 2.1. Xác định cột Batch động
Trong `processDataAndCreateCharts`:
- `importBatchColIndex = findColIndex(importHeaders, ['batch', 'lo', 'lô']);` (nếu không thấy, mặc định index 7 theo `COLUMN_HEADERS_NHAP`).
- `exportBatchColIndex = findColIndex(exportHeaders, ['batch', 'lo', 'lô']);` (nếu không thấy, mặc định index 7 theo `COLUMN_HEADERS_XUAT`).

### 2.2. Tạo Khóa Định danh (Key) & Thu thập Metadata
Với mỗi dòng nhập / xuất thỏa mãn bộ lọc ngày:
```javascript
const ma = importMaColIndex !== -1 ? String(row[importMaColIndex] || '').trim() : '';
const ten = importTenColIndex !== -1 ? String(row[importTenColIndex] || '').trim() : '';
const rawBatch = importBatchColIndex !== -1 ? String(row[importBatchColIndex] || '').trim() : '';
const hasBatch = rawBatch && rawBatch !== '-' && rawBatch.toLowerCase() !== 'không batch' && rawBatch.toLowerCase() !== 'khong batch';

let key = '';
if (ma && hasBatch) {
  key = `${ma} (${rawBatch})`;
} else if (ma) {
  key = ma;
} else if (hasBatch) {
  key = `Batch: ${rawBatch}`;
} else {
  key = ten || '(Không xác định)';
}

if (!importMaterialVolumes[key]) {
  importMaterialVolumes[key] = { qty: 0, ma, batch: rawBatch, ten };
}
importMaterialVolumes[key].qty += quantity;
if (ten && !importMaterialVolumes[key].ten) {
  importMaterialVolumes[key].ten = ten;
}
```
Tương tự cho dữ liệu xuất kho `exportMaterialVolumes`.

### 2.3. Sắp xếp và Vẽ Biểu đồ Chart.js
- Hàm trích xuất sản lượng: `getVolume = (val) => (typeof val === 'object' && val !== null ? (val.qty || 0) : Number(val || 0))`
- Sắp xếp giảm dần theo sản lượng và lấy Top 10:
  `const sortedMaterials = Object.keys(materialVolumes).sort((a, b) => getVolume(materialVolumes[b]) - getVolume(materialVolumes[a])).slice(0, 10);`
- Cấu hình Tooltip hiển thị:
  - `callbacks.title`: trả về `key` cùng dòng `Tên vật tư` xuống dòng.
  - `callbacks.label`: định dạng `Sản lượng: X kg`.

---

## 3. Danh sách File cần cập nhật

1. `assets/js/xg/xg-bieu-do.js`
2. `assets/js/tole/tole-bieu-do.js`
3. `tests/bieu-do-top10-batch.test.js` (Thêm bài test kiểm thử tự động)
4. Đồng bộ bản build: chạy `npm run build` để sync sang `dist/`, `dist-app/`, `public/`.

---

## 4. Kế hoạch Kiểm thử (Verification Plan)
1. **Kiểm thử tự động**: Chạy file test với node.js kiểm tra logic gom nhóm Mã VT + Batch, kiểm tra trường hợp có batch, không batch, và kiểm tra render tooltip.
2. **Kiểm thử hồi quy**: Chạy lại `tests/bieu-do-filter.test.js` để đảm bảo không làm gián đoạn các tính năng lọc ngày, KPI, dashboard khác.
3. **Kiểm tra đồng bộ**: Đảm bảo các thư mục `dist/`, `public/`, `dist-app/` đều có bản cập nhật mới nhất.
