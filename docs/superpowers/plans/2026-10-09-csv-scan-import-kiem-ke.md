# Kế Hoạch Triển Khai: Tính Năng Nạp Cuộn Quét Bằng File .CSV (Kiểm Kê Kho)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm tính năng cho phép nạp hàng loạt danh sách cuộn quét từ file `.csv` (hoặc `.txt`) vào phiên kiểm kê kho trong `kiem-ke.html`, tự động phân tích định dạng, nối tiếp danh sách cuộn đã quét, lưu trữ cục bộ và đồng bộ hàng loạt lên Supabase.

**Architecture:** Mở rộng `KiemKeEngine` để phân tích cú pháp tệp CSV (1 cột barcode hoặc nhiều cột bảng có header); mở rộng `KiemKeStorage` với phương thức chèn hàng loạt (`insertBatchScannedRollsToSupabase`); bổ sung nút nạp CSV trên thanh công cụ và Tab 2 của `kiem-ke.html`; và kết nối sự kiện trong `kiem-ke.js` để đọc tệp, cập nhật giao diện, tính toán đối soát và thông báo kết quả.

**Tech Stack:** JavaScript (ES6+ / Vanilla JS), HTML5 FileReader API, Bootstrap 5 & Icons, Supabase JS Client, Node.js assert test runner.

## Global Constraints

- Không làm phá vỡ logic quét cuộn đơn lẻ qua súng quét mã vạch và camera hiện có.
- File CSV nạp vào phải thực hiện nối tiếp (`append`) vào danh sách cuộn hiện có trong phiên, không ghi đè danh sách cũ.
- Tự động bỏ qua dòng rỗng hoặc sai định dạng mà không gây lỗi đứng ứng dụng.
- Lưu trữ cục bộ an toàn trên `LocalStorage` ngay cả khi mất kết nối Supabase.
- Tuân thủ phân quyền `data-perm="add"` trên nút giao diện.

---

### Task 1: Bổ sung hàm Parser CSV trong KiemKeEngine (`parseCsvScannedRolls`)

**Files:**
- Modify: `assets/js/tem-nhan-kiem-ke/kiem-ke-engine.js`
- Test: `tests/kiem-ke-engine.test.js`

**Interfaces:**
- Produces: `KiemKeEngine.parseCsvScannedRolls(csvText, currentUser)` trả về `{ validRolls: Array, skippedCount: number, totalKg: number }`.

- [ ] **Step 1: Viết test kiểm thử hàm parseCsvScannedRolls**

Cập nhật `tests/kiem-ke-engine.test.js` thêm các ca kiểm thử:
```javascript
// Test 6: parseCsvScannedRolls (Dạng 1 cột - Danh sách barcode)
const singleColCsv = `
10001189-2.5X75VN-1500
10001189-2.5X75VN-1000
10001200-BATCH-01-2000.5
`;
const parsed1 = parseCsvScannedRolls(singleColCsv, 'bao.lt');
assert.strictEqual(parsed1.validRolls.length, 3);
assert.strictEqual(parsed1.totalKg, 4500.5);
assert.strictEqual(parsed1.validRolls[0].maVatTu, '10001189');
assert.strictEqual(parsed1.validRolls[0].batch, '2.5X75VN');
assert.strictEqual(parsed1.validRolls[0].kg, 1500);

// Test 7: parseCsvScannedRolls (Dạng nhiều cột có Header, dấu phẩy hoặc chấm phẩy)
const multiColCsv = `Mã vật tư,Batch,Số lượng (Kg)
10001189,2.5X75VN,1500
10001200,BATCH-01,1200,5
dòng rác không hợp lệ
`;
const parsed2 = parseCsvScannedRolls(multiColCsv, 'bao.lt');
assert.strictEqual(parsed2.validRolls.length, 2);
assert.strictEqual(parsed2.skippedCount, 1);
assert.strictEqual(parsed2.validRolls[1].kg, 1200.5);
```

- [ ] **Step 2: Chạy test để xác nhận kiểm thử thất bại (FAIL)**

Chạy: `node tests/kiem-ke-engine.test.js`
Kỳ vọng: FAIL vì `parseCsvScannedRolls` chưa được định nghĩa.

- [ ] **Step 3: Cài đặt hàm parseCsvScannedRolls trong KiemKeEngine**

Mở `assets/js/tem-nhan-kiem-ke/kiem-ke-engine.js`, bổ sung hàm `parseCsvScannedRolls(csvText, currentUser)`:
- Xử lý BOM `\uFEFF`.
- Tách dòng theo `\r\n` hoặc `\n`.
- Nhận diện delimiter: đếm tần suất `,`, `;`, `\t` trên dòng đầu tiên.
- Xử lý nếu có Header: tìm index của cột barcode, mã vật tư, batch, khối lượng.
- Xử lý nếu là dòng đơn: bóc tách qua format `MãVT-Batch-Kg` hoặc `qrScannerService.parseCoilBarcode`.
- Trả về danh sách cuộn hợp lệ và số dòng bỏ qua.
- Export hàm trong return object.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `node tests/kiem-ke-engine.test.js`
Kỳ vọng: Toàn bộ test PASS.

- [ ] **Step 5: Commit thay đổi**

```bash
git add assets/js/tem-nhan-kiem-ke/kiem-ke-engine.js tests/kiem-ke-engine.test.js
git commit -m "feat(kiem-ke): implement parseCsvScannedRolls in KiemKeEngine"
```

---

### Task 2: Bổ sung phương thức Batch Insert trong KiemKeStorage (`insertBatchScannedRollsToSupabase`)

**Files:**
- Modify: `assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js`
- Test: `tests/kiem-ke-storage.test.js`

**Interfaces:**
- Produces: `KiemKeStorage.insertBatchScannedRollsToSupabase(rollItems)` trả về `Promise<Array>`.

- [ ] **Step 1: Viết test kiểm thử cho insertBatchScannedRollsToSupabase**

Mở `tests/kiem-ke-storage.test.js`, thêm mock Supabase client và kiểm thử việc chia nhỏ batch (chunking) khi nạp hàng loạt:
```javascript
// Test: insertBatchScannedRollsToSupabase
const mockRolls = [
  { barcode: 'B1-BATCH1-100', maVatTu: 'B1', batch: 'BATCH1', kg: 100 },
  { barcode: 'B2-BATCH2-200', maVatTu: 'B2', batch: 'BATCH2', kg: 200 }
];
// Kiểm tra hàm tồn tại và xử lý mảng rỗng / mảng có phần tử an toàn
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Chạy: `node tests/kiem-ke-storage.test.js`
Kỳ vọng: FAIL vì `insertBatchScannedRollsToSupabase` chưa tồn tại.

- [ ] **Step 3: Cài đặt hàm insertBatchScannedRollsToSupabase**

Mở `assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js`:
- Định nghĩa `async function insertBatchScannedRollsToSupabase(rollItems)`:
  - Nếu `!Array.isArray(rollItems) || rollItems.length === 0` return `rollItems`.
  - Kiểm tra `getSupabaseClient()`. Nếu không có, return `rollItems`.
  - Chia nhỏ mảng theo kích thước chunk `CHUNK_SIZE = 100`.
  - Duyệt từng chunk, map thành payload `{ barcode, ma_vat_tu, batch, kg, scanned_by }`.
  - Gọi `await client.from(TABLE_NAME).insert(payloadChunk).select()`.
  - Ghép các ID và `created_at` trả về gán vào `rollItems`.
  - Bắt lỗi ngoại lệ và log cảnh báo mà không làm gián đoạn luồng.
- Export trong return object của `KiemKeStorage`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `node tests/kiem-ke-storage.test.js`
Kỳ vọng: PASS.

- [ ] **Step 5: Commit thay đổi**

```bash
git add assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js tests/kiem-ke-storage.test.js
git commit -m "feat(kiem-ke): add insertBatchScannedRollsToSupabase in KiemKeStorage"
```

---

### Task 3: Bổ sung nút Nạp File CSV trên Giao Diện `kiem-ke.html`

**Files:**
- Modify: `pages/tem-nhan-kiem-ke/kiem-ke.html`

**Interfaces:**
- Produces: Element `#csvScanFileInput` (type file) và nút bấm liên kết trên thanh công cụ và Tab 2.

- [ ] **Step 1: Cập nhật giao diện thanh công cụ chính**

Trong `pages/tem-nhan-kiem-ke/kiem-ke.html`:
Tại cụm quét Barcode trung tâm (ngay cạnh `#btnOpenScannerCamera`), thêm:
```html
<label for="csvScanFileInput" data-perm="add" class="btn btn-sm btn-outline-warning shadow-sm d-inline-flex align-items-center gap-1 text-nowrap px-2" style="cursor: pointer;" title="Nạp danh sách cuộn quét từ file .CSV">
  <i class="bi bi-filetype-csv"></i> <span class="d-none d-md-inline">Nạp CSV</span>
</label>
<input type="file" id="csvScanFileInput" accept=".csv, .txt" class="d-none">
```

- [ ] **Step 2: Cập nhật giao diện tại Tab 2 (Cuộn Đã Quét)**

Tại hàng tiêu đề Tab 2, bên cạnh nút `#btnClearFeedOnly`, thêm:
```html
<label for="csvScanFileInputTab" data-perm="add" class="btn btn-sm btn-outline-warning shadow-sm d-inline-flex align-items-center gap-1 text-nowrap" style="cursor: pointer;" title="Nạp nhanh từ file .CSV">
  <i class="bi bi-filetype-csv"></i> Nạp file .CSV
</label>
<input type="file" id="csvScanFileInputTab" accept=".csv, .txt" class="d-none">
```

- [ ] **Step 3: Kiểm tra cấu trúc HTML và phân quyền**

Chạy: `node tests/html-data-perm.test.js`
Kỳ vọng: PASS, không vi phạm cú pháp thuộc tính phân quyền.

- [ ] **Step 4: Commit thay đổi**

```bash
git add pages/tem-nhan-kiem-ke/kiem-ke.html
git commit -m "feat(kiem-ke): add csv scan input controls to kiem-ke.html"
```

---

### Task 4: Kết nối sự kiện và logic Controller trong `kiem-ke.js`

**Files:**
- Modify: `assets/js/tem-nhan-kiem-ke/kiem-ke.js`

**Interfaces:**
- Consumes: `KiemKeEngine.parseCsvScannedRolls`, `KiemKeStorage.insertBatchScannedRollsToSupabase`, `KiemKeStorage.saveSession`.

- [ ] **Step 1: Lấy các DOM elements mới**

Lấy `csvScanFileInput` và `csvScanFileInputTab`.

- [ ] **Step 2: Định nghĩa hàm xử lý `handleCsvScanUpload(file)`**

```javascript
function handleCsvScanUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const text = evt.target.result;
      const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || 'guest';
      const parseResult = window.KiemKeEngine.parseCsvScannedRolls(text, currentUser);

      if (!parseResult || !parseResult.validRolls || parseResult.validRolls.length === 0) {
        showToast('File CSV không chứa dữ liệu cuộn quét hợp lệ.', 'warning');
        return;
      }

      const newRolls = parseResult.validRolls;
      // Nối tiếp (append) vào danh sách cuộn hiện tại (đưa lên đầu để hiển thị mới nhất)
      scannedRolls = [...newRolls, ...scannedRolls];

      // Lưu ngay vào LocalStorage
      window.KiemKeStorage.saveSession(scannedRolls, excelMeta);

      // Cập nhật giao diện ngay lập tức
      recalculateAndRender();
      window.KiemKeStorage.playBeepSuccess();

      let msg = `Đã nạp thành công ${newRolls.length} cuộn từ file CSV (Tổng ${formatKg(parseResult.totalKg)} kg).`;
      if (parseResult.skippedCount > 0) {
        msg += ` Bỏ qua ${parseResult.skippedCount} dòng không hợp lệ.`;
      }
      showToast(msg, 'success');

      // Chạy nền đồng bộ batch lên Supabase
      if (window.KiemKeStorage && typeof window.KiemKeStorage.insertBatchScannedRollsToSupabase === 'function') {
        window.KiemKeStorage.insertBatchScannedRollsToSupabase(newRolls).then(synced => {
          console.log(`Đã đồng bộ ${synced.length} cuộn quét lên Supabase.`);
        }).catch(err => {
          console.warn('Lỗi đồng bộ batch lên Supabase:', err);
        });
      }
    } catch (err) {
      console.error('Lỗi đọc file CSV:', err);
      showToast('Lỗi khi đọc file CSV: ' + err.message, 'danger');
    }
  };
  reader.readAsText(file, 'UTF-8');
}
```

- [ ] **Step 3: Gắn sự kiện `change` cho cả 2 input file**

Gắn sự kiện `change` cho `csvScanFileInput` và `csvScanFileInputTab`, đồng thời reset `e.target.value = ''` sau khi đọc để cho phép người dùng chọn lại cùng file nếu muốn.

- [ ] **Step 4: Commit thay đổi**

```bash
git add assets/js/tem-nhan-kiem-ke/kiem-ke.js
git commit -m "feat(kiem-ke): wire csv file upload handling and batch sync in kiem-ke.js"
```

---

### Task 5: Kiểm Thử Toàn Diện (End-to-End Test Suite)

**Files:**
- Create: `tests/test-kiem-ke-csv-import.js`

- [ ] **Step 1: Viết test suite toàn diện**

Tạo file `tests/test-kiem-ke-csv-import.js` bao gồm:
1. Parse CSV 1 cột (danh sách barcode thuần).
2. Parse CSV nhiều cột (có dấu phẩy, dấu chấm phẩy, số thập phân phẩy/chấm).
3. Test việc bỏ qua dòng rỗng hoặc sai cú pháp và tính toán `skippedCount`.
4. Test tính năng nối tiếp (`append`) vào `scannedRolls` mà không làm mất cuộn đã quét trước đó.
5. Test đối soát 3 chiều sau khi nạp CSV khớp chính xác với File Excel cơ sở và Hệ thống.

- [ ] **Step 2: Chạy kiểm thử tự động**

Chạy: `node tests/test-kiem-ke-csv-import.js`
Kỳ vọng: 100% các bước đều PASS.

- [ ] **Step 3: Chạy lại toàn bộ test suite kiểm kê**

Chạy:
```bash
node tests/kiem-ke-engine.test.js
node tests/kiem-ke-storage.test.js
node tests/test-kiem-ke-e2e.js
node tests/test-kiem-ke-csv-import.js
```
Kỳ vọng: Tất cả đều PASS.

- [ ] **Step 4: Commit và hoàn tất**

```bash
git add tests/test-kiem-ke-csv-import.js
git commit -m "test(kiem-ke): add comprehensive e2e test suite for csv scan import"
```
