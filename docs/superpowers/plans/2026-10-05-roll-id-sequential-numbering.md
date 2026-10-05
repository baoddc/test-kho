# Kế Hoạch Triển Khai: Đánh Số Cuộn ID Kế Tiếp Theo Số Cuộn Lớn Nhất (Xà Gồ & Tole)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cập nhật thuật toán tính Cuộn ID khi thêm hoặc sửa cuộn trong `xg-nhap` và `tole-nhap` để tự động lấy số cuộn kế tiếp từ số cuộn lớn nhất hiện có (`max + 1`), bắt đầu từ `Cuộn 0` nếu chưa có cuộn nào.

**Architecture:** Tạo hàm trích xuất regex số cuộn `extractRollIndex` và hàm tính số cuộn tiếp theo `getNextRollNumber`. Tích hợp vào `updateRollCuonIds()` và `updateEditRollCuonIds()` trong `assets/js/xg/xg-nhap.js` và `assets/js/tole/tole-nhap.js`. Giữ nguyên cơ chế kế thừa Cuộn ID trong `xg-xuat.js` và `tole-xuat.js`. Đồng bộ sang `dist/`, `dist-app/`, `public/` qua `scripts/sync-dist.js`.

**Tech Stack:** JavaScript (ES6+), Node.js (Test runner & sync script), Supabase Client.

## Global Constraints
- Naming convention: `${maVatTu} - Cuộn ${N}`.
- Nếu Mã vật tư chưa có cuộn nào: Cuộn đầu tiên là `Cuộn 0`.
- Nếu đã có cuộn (ví dụ: `1, 0, 3, 2`): số kế tiếp là `max(1, 0, 3, 2) + 1 = 4`.
- Modal Sửa: Giữ nguyên `Cuộn ID` ban đầu của dòng đang sửa, chỉ sinh mã nối tiếp cho các dòng mới được thêm vào.
- Không thay đổi hành vi kế thừa của trang Xuất (`xg-xuat`, `tole-xuat`).

---

### Task 1: Tạo bộ kiểm thử tự động cho thuật toán tính số Cuộn ID kế tiếp

**Files:**
- Create: `tests/test-roll-id-sequential-numbering.js`

**Interfaces:**
- Consumes: `extractRollIndex(cuonId)` và `getNextRollNumber(maVatTu, rawData, excludeRowId, extraCuonIds)`.
- Produces: Test suite Node.js kiểm thử độc lập logic trích xuất và tính số cuộn.

- [x] **Step 1: Viết bài test kiểm thử thất bại (Failing Test)**

Tạo file `tests/test-roll-id-sequential-numbering.js`:
```javascript
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Trích xuất hoặc nạp hàm kiểm thử
function runTests() {
  console.log('===============================================================');
  console.log(' KIỂM THỬ THUẬT TOÁN ĐÁNH SỐ CUỘN ID KẾ TIẾP (MAX + 1)');
  console.log('===============================================================');

  // Đọc mã nguồn xg-nhap.js để kiểm tra tính sẵn sàng của hàm
  const xgNhapCode = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-nhap.js'), 'utf8');
  assert.ok(xgNhapCode.includes('function extractRollIndex'), 'xg-nhap.js phải định nghĩa extractRollIndex');
  assert.ok(xgNhapCode.includes('function getNextRollNumber'), 'xg-nhap.js phải định nghĩa getNextRollNumber');

  // Kiểm thử logic thuật toán
  const extractMatch = xgNhapCode.match(/function extractRollIndex\([\s\S]*?\n\}/);
  const getNextMatch = xgNhapCode.match(/function getNextRollNumber\([\s\S]*?\n\}/);
  assert.ok(extractMatch, 'Tìm thấy hàm extractRollIndex trong xg-nhap.js');
  assert.ok(getNextMatch, 'Tìm thấy hàm getNextRollNumber trong xg-nhap.js');

  const evalScope = {};
  new Function('scope', `${extractMatch[0]}; ${getNextMatch[0]}; scope.extractRollIndex = extractRollIndex; scope.getNextRollNumber = getNextRollNumber;`)(evalScope);

  const { extractRollIndex, getNextRollNumber } = evalScope;

  // 1. Kiểm tra trích xuất số cuộn
  assert.strictEqual(extractRollIndex('10001189 - Cuộn 0'), 0);
  assert.strictEqual(extractRollIndex('10001189 - Cuộn 1'), 1);
  assert.strictEqual(extractRollIndex('10001189 - Cuộn 319'), 319);
  assert.strictEqual(extractRollIndex('Cuộn 4'), 4);
  assert.strictEqual(extractRollIndex('cuon 12'), 12);
  assert.strictEqual(extractRollIndex(''), null);
  assert.strictEqual(extractRollIndex(null), null);
  console.log('  ✓ [PASS] extractRollIndex trích xuất chính xác số thứ tự cuộn');

  // 2. Vật tư mới hoàn toàn -> bắt đầu từ 0
  assert.strictEqual(getNextRollNumber('10009999', []), 0);
  console.log('  ✓ [PASS] Mã vật tư mới chưa có cuộn -> bắt đầu từ Cuộn 0');

  // 3. Đã có cuộn 1, 0, 3, 2 -> Số kế tiếp là 4
  const sampleDataOutOfOrder = [
    { 'Mã vật tư': '10001189', 'Cuộn ID': '10001189 - Cuộn 1' },
    { 'Mã vật tư': '10001189', 'Cuộn ID': '10001189 - Cuộn 0' },
    { 'Mã vật tư': '10001189', 'Cuộn ID': '10001189 - Cuộn 3' },
    { 'Mã vật tư': '10001189', 'Cuộn ID': '10001189 - Cuộn 2' },
    { 'Mã vật tư': 'OTHER_MAT', 'Cuộn ID': 'OTHER_MAT - Cuộn 99' }
  ];
  assert.strictEqual(getNextRollNumber('10001189', sampleDataOutOfOrder), 4);
  console.log('  ✓ [PASS] Đã có cuộn 1, 0, 3, 2 -> Cuộn kế tiếp là 4');

  // 4. Đã có cuộn 1, 5 (bị khuyết) -> Số kế tiếp là 6 (max + 1)
  const sampleGaps = [
    { 'Mã vật tư': '10001200', 'Cuộn ID': '10001200 - Cuộn 1' },
    { 'Mã vật tư': '10001200', 'Cuộn ID': '10001200 - Cuộn 5' }
  ];
  assert.strictEqual(getNextRollNumber('10001200', sampleGaps), 6);
  console.log('  ✓ [PASS] Đã có cuộn 1, 5 -> Cuộn kế tiếp là 6 (max + 1)');

  // 5. Loại trừ bản ghi đang sửa (excludeRowId)
  const sampleExclude = [
    { 'id': 'row-1', 'Mã vật tư': '10001200', 'Cuộn ID': '10001200 - Cuộn 1' },
    { 'id': 'row-2', 'Mã vật tư': '10001200', 'Cuộn ID': '10001200 - Cuộn 5' }
  ];
  assert.strictEqual(getNextRollNumber('10001200', sampleExclude, 'row-2'), 2);
  console.log('  ✓ [PASS] Loại trừ chính xác row_id đang sửa');

  // 6. Tính thêm extraCuonIds đang hiển thị trong modal
  assert.strictEqual(getNextRollNumber('10001200', sampleExclude, null, ['10001200 - Cuộn 6']), 7);
  console.log('  ✓ [PASS] Nhận diện cả extraCuonIds đang có trên form modal');

  console.log('---------------------------------------------------------------');
  console.log(' KẾT QUẢ: TẤT CẢ BÀI TEST THÀNH CÔNG');
  console.log('---------------------------------------------------------------');
}

runTests();
```

- [x] **Step 2: Chạy bài test để xác nhận test thất bại (Failing)**

Run: `node tests/test-roll-id-sequential-numbering.js`
Expected: FAIL với thông báo `xg-nhap.js phải định nghĩa extractRollIndex`.

- [x] **Step 3: Commit file test**

```bash
git add tests/test-roll-id-sequential-numbering.js
git commit -m "test: add unit test for roll ID sequential numbering logic"
```

---

### Task 2: Triển khai thuật toán sinh Cuộn ID trong `assets/js/xg/xg-nhap.js`

**Files:**
- Modify: `assets/js/xg/xg-nhap.js:1320-1375`

**Interfaces:**
- Produces: `extractRollIndex(cuonId)`, `getNextRollNumber(maVatTu, rawData, excludeRowId, extraCuonIds)`, cập nhật `updateRollCuonIds()` và `updateEditRollCuonIds()`.

- [x] **Step 1: Cập nhật `assets/js/xg/xg-nhap.js`**

Thêm các hàm `extractRollIndex` và `getNextRollNumber`, đồng thời nâng cấp `updateRollCuonIds()` và `updateEditRollCuonIds()`:
```javascript
function extractRollIndex(cuonId) {
  if (!cuonId || typeof cuonId !== 'string') return null;
  const match = cuonId.match(/(?:Cuộn|cuon)\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function getNextRollNumber(maVatTu, rawData = [], excludeRowId = null, extraCuonIds = []) {
  if (!maVatTu) return 0;
  const cleanMa = String(maVatTu).trim().toLowerCase();
  const existingNumbers = [];

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

  if (Array.isArray(extraCuonIds)) {
    extraCuonIds.forEach(cid => {
      const num = extractRollIndex(cid);
      if (num !== null && !isNaN(num)) {
        existingNumbers.push(num);
      }
    });
  }

  if (existingNumbers.length === 0) return 0;
  return Math.max(...existingNumbers) + 1;
}

function updateRollCuonIds() {
  const maVatTuInput = document.querySelector('#addDataCommonFields input[name="col_5"]');
  if (!maVatTuInput) return;
  const maVatTu = maVatTuInput.value.trim();
  if (!maVatTu) {
    document.querySelectorAll('#rollsTableBody .roll-cuon-id').forEach(input => { input.value = ''; });
    return;
  }

  const startNum = getNextRollNumber(maVatTu, window._rawSupabaseData || []);

  document.querySelectorAll('#rollsTableBody tr').forEach((row, index) => {
    const cuonIdInput = row.querySelector('.roll-cuon-id');
    if (cuonIdInput) {
      cuonIdInput.value = `${maVatTu} - Cuộn ${startNum + index}`;
    }
  });
}

function updateEditRollCuonIds() {
  const maVatTuInput = document.querySelector('#editDataCommonFields input[name="col_5"]');
  if (!maVatTuInput) return;
  const maVatTu = maVatTuInput.value.trim();
  if (!maVatTu) {
    document.querySelectorAll('#editRollsTableBody .edit-roll-cuon-id').forEach(input => { input.value = ''; });
    return;
  }

  const rowId = document.querySelector('#editDataCommonFields input[name="row_id"]')?.value;
  const rows = Array.from(document.querySelectorAll('#editRollsTableBody tr'));
  if (rows.length === 0) return;

  // Thu thập các Cuộn ID đã có sẵn trong modal (ví dụ dòng đầu tiên là dòng gốc)
  const existingModalCuonIds = [];
  rows.forEach((row, idx) => {
    const inp = row.querySelector('.edit-roll-cuon-id');
    const val = inp ? inp.value.trim() : '';
    // Nếu dòng có sẵn Cuộn ID và là dòng đầu tiên, giữ nguyên
    if (idx === 0 && val) {
      existingModalCuonIds.push(val);
    }
  });

  let nextNum = getNextRollNumber(maVatTu, window._rawSupabaseData || [], rowId, existingModalCuonIds);

  rows.forEach((row, index) => {
    const cuonIdInput = row.querySelector('.edit-roll-cuon-id');
    if (!cuonIdInput) return;
    
    // Nếu là dòng đầu tiên và đã có giá trị gốc hợp lệ thì không ghi đè
    if (index === 0 && cuonIdInput.value.trim()) {
      return;
    }

    cuonIdInput.value = `${maVatTu} - Cuộn ${nextNum}`;
    nextNum++;
  });
}
```

- [x] **Step 2: Chạy bài test xác nhận Task 1 vượt qua (PASS)**

Run: `node tests/test-roll-id-sequential-numbering.js`
Expected: PASS cả 6 trường hợp kiểm thử.

- [x] **Step 3: Commit**

```bash
git add assets/js/xg/xg-nhap.js
git commit -m "feat(xg-nhap): implement sequential roll ID numbering based on max existing roll"
```

---

### Task 3: Triển khai thuật toán sinh Cuộn ID trong `assets/js/tole/tole-nhap.js`

**Files:**
- Modify: `assets/js/tole/tole-nhap.js:1190-1240`

**Interfaces:**
- Produces: Cập nhật hàm `extractRollIndex`, `getNextRollNumber`, `updateRollCuonIds` và `updateEditRollCuonIds` trong `tole-nhap.js`.

- [x] **Step 1: Cập nhật `assets/js/tole/tole-nhap.js`**

Tích hợp `extractRollIndex`, `getNextRollNumber`, `updateRollCuonIds` và `updateEditRollCuonIds` tương ứng với logic chuẩn đã hoàn thiện ở Task 2.

- [x] **Step 2: Bổ sung assertion kiểm tra `tole-nhap.js` vào file test**

Cập nhật `tests/test-roll-id-sequential-numbering.js` để kiểm tra cả `tole-nhap.js` có chứa `extractRollIndex` và `getNextRollNumber`.
Run: `node tests/test-roll-id-sequential-numbering.js`
Expected: PASS 100%.

- [x] **Step 3: Commit**

```bash
git add assets/js/tole/tole-nhap.js tests/test-roll-id-sequential-numbering.js
git commit -m "feat(tole-nhap): implement sequential roll ID numbering based on max existing roll"
```

---

### Task 4: Kiểm tra phân hệ Xuất, đồng bộ phân phối Build Sync và chạy toàn bộ Test

**Files:**
- Verify: `assets/js/xg/xg-xuat.js`, `assets/js/tole/tole-xuat.js`
- Sync: `scripts/sync-dist.js` (đồng bộ sang `dist/`, `dist-app/`, `public/`)

- [x] **Step 1: Kiểm tra `xg-xuat.js` và `tole-xuat.js`**

Đảm bảo hai file không tự ý sinh mã Cuộn ID mà kế thừa chính xác Cuộn ID đã có từ `inventoryRollsModal`.

- [x] **Step 2: Chạy script đồng bộ phân phối**

Run: `node scripts/sync-dist.js`
Expected: Hoàn thành sync toàn bộ từ `assets/` và `pages/` sang `dist/`, `dist-app/`, `public/`.

- [x] **Step 3: Chạy toàn bộ các bài test liên quan**

Run:
```bash
node tests/test-roll-id-sequential-numbering.js
node tests/test-manual-roll-selection-export.js
node tests/in-tem-cuon.test.js
```
Expected: Tất cả bài test đều PASS.

- [x] **Step 4: Commit và hoàn thành**

```bash
git add dist/ dist-app/ public/
git commit -m "build: sync distribution for roll ID sequential numbering"
```
