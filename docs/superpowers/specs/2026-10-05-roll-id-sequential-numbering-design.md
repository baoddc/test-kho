# Thiết Kế: Sinh Mã Cuộn ID Kế Tiếp Theo Số Cuộn Lớn Nhất (Xà Gồ & Tole)

## 1. Bối cảnh & Mục tiêu
- **Hiện trạng**: Trong giao diện Nhập Xà Gồ (`xg-nhap`) và Nhập Tole (`tole-nhap`), hàm `updateRollCuonIds` và `updateEditRollCuonIds` đang tính số thứ tự cuộn kế tiếp bằng cách lấy tổng số lượng cuộn (`existingCount = filter(Mã vật tư).length`) và gán:
  ```javascript
  cuonIdInput.value = `${maVatTu} - Cuộn ${existingCount + index}`;
  ```
- **Vấn đề**: Khi các cuộn trong kho không liên tục (ví dụ: đã xóa cuộn ở giữa, hoặc thứ tự cuộn là 1, 0, 3, 2), việc dùng `length` để cộng dồn sẽ gây ra trùng lặp Cuộn ID hoặc nhảy sai số.
- **Yêu cầu**: Cuộn ID mới phải được đánh số kế tiếp theo số Cuộn ID lớn nhất hiện có của Mã vật tư đó:
  - Ví dụ: Đã có các cuộn `1, 0, 3, 2` thì cuộn thêm kế tiếp sẽ là `Cuộn 4`.
  - Nếu đã có cuộn `1, 5` thì cuộn kế tiếp sẽ là `Cuộn 6`.
  - Nếu Mã vật tư hoàn toàn mới (chưa có cuộn nào trong hệ thống): bắt đầu từ `Cuộn 0` (`${maVatTu} - Cuộn 0`).
  - Khi thêm nhiều dòng cuộn cùng lúc trên form: các cuộn tiếp theo sẽ tăng dần liên tiếp (`max + 1`, `max + 2`, `max + 3`, ...).
  - Đối với trang Xuất (`xg-xuat`, `tole-xuat`): chỉ kế thừa Cuộn ID có sẵn từ kho nhập, không sinh mã mới.

---

## 2. Chi tiết kỹ thuật & Thuật toán

### 2.1. Hàm trích xuất số cuộn (`extractRollIndex`)
Hỗ trợ nhận diện số nguyên sau từ khóa `Cuộn` (không phân biệt chữ hoa, chữ thường hoặc khoảng trắng):
```javascript
function extractRollIndex(cuonId) {
  if (!cuonId || typeof cuonId !== 'string') return null;
  const match = cuonId.match(/(?:Cuộn|cuon)\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}
```

### 2.2. Hàm tính số thứ tự cuộn khởi điểm kế tiếp (`getNextRollNumber`)
```javascript
function getNextRollNumber(maVatTu, rawData = [], excludeRowId = null, extraCuonIds = []) {
  if (!maVatTu) return 0;
  const cleanMa = String(maVatTu).trim().toLowerCase();
  
  const existingNumbers = [];

  // 1. Quét từ dữ liệu Supabase hiện có
  if (Array.isArray(rawData)) {
    rawData.forEach(row => {
      if (excludeRowId && String(row['id']) === String(excludeRowId)) return;
      if (String(row['Mã vật tư'] || '').trim().toLowerCase() === cleanMa) {
        const num = extractRollIndex(row['Cuộn ID']);
        if (num !== null && !isNaN(num)) {
          existingNumbers.push(num);
        }
      }
    });
  }

  // 2. Quét các Cuộn ID bổ sung (nếu có trong modal)
  if (Array.isArray(extraCuonIds)) {
    extraCuonIds.forEach(cid => {
      const num = extractRollIndex(cid);
      if (num !== null && !isNaN(num)) {
        existingNumbers.push(num);
      }
    });
  }

  // 3. Nếu chưa có cuộn nào, bắt đầu từ 0
  if (existingNumbers.length === 0) return 0;

  // 4. Trả về max + 1
  return Math.max(...existingNumbers) + 1;
}
```

---

## 3. Phạm vi triển khai

### 3.1. File `assets/js/xg/xg-nhap.js`
- Tích hợp `extractRollIndex` và `getNextRollNumber`.
- Cập nhật hàm `updateRollCuonIds()`:
  - Lấy `startNum = getNextRollNumber(maVatTu, window._rawSupabaseData)`.
  - Đánh số lại các dòng trong `#rollsTableBody`:
    ```javascript
    cuonIdInput.value = `${maVatTu} - Cuộn ${startNum + index}`;
    ```
- Cập nhật hàm `updateEditRollCuonIds()`:
  - Khi mở modal Sửa (`editDataModal`), dòng đầu tiên (dòng hiện tại) giữ nguyên `Cuộn ID` ban đầu.
  - Khi thêm dòng mới (`+ Thêm cuộn`), các dòng mới sẽ được đánh số kế tiếp dựa trên `max` của DB (loại trừ `row_id` đang sửa) và số cuộn của dòng ban đầu.

### 3.2. File `assets/js/tole/tole-nhap.js`
- Tích hợp tương tự như `xg-nhap.js` với các hàm `extractRollIndex`, `getNextRollNumber`, `updateRollCuonIds()` và `updateEditRollCuonIds()`.

### 3.3. File `assets/js/xg/xg-xuat.js` và `assets/js/tole/tole-xuat.js`
- Giữ nguyên cơ chế kế thừa Cuộn ID từ tồn kho (`xg-nhap` / `tole-nhap`).
- Dọn dẹp các hàm thừa không dùng đến nếu có để đảm bảo mã nguồn tinh gọn.

### 3.4. Kiểm thử tự động (Automated Tests)
- Tạo file kiểm thử `tests/test-roll-id-sequential-numbering.js` bao quát:
  1. Trường hợp vật tư hoàn toàn mới -> bắt đầu từ `Cuộn 0`.
  2. Trường hợp đã có cuộn không theo thứ tự `1, 0, 3, 2` -> số kế tiếp là `4`.
  3. Trường hợp có cuộn bị khuyết (ví dụ `1, 5`) -> số kế tiếp là `6`.
  4. Trường hợp thêm nhiều cuộn cùng lúc -> các cuộn tăng liên tiếp (`max + 1`, `max + 2`, ...).
  5. Trường hợp sửa cuộn trong modal Sửa -> dòng gốc giữ nguyên, các cuộn thêm mới nối tiếp chính xác.

### 3.5. Đồng bộ phân phối (Build Sync)
- Chạy `node scripts/sync-dist.js` để đồng bộ thay đổi từ `assets/` sang `dist/`, `dist-app/`, và `public/`.

---

## 4. Kế hoạch kiểm thử & Tiêu chí nghiệm thu (Acceptance Criteria)
1. Mở modal thêm dữ liệu `xg-nhap` và `tole-nhap`.
2. Chọn mã vật tư đã có cuộn 0, 1, 2, 3 -> Cuộn đầu tiên hiển thị `... - Cuộn 4`.
3. Bấm "+ Thêm cuộn" -> Cuộn thứ hai hiển thị `... - Cuộn 5`.
4. Chọn mã vật tư chưa từng có trong kho -> Cuộn đầu tiên hiển thị `... - Cuộn 0`.
5. Tất cả bài test mới và cũ đều pass 100%.
