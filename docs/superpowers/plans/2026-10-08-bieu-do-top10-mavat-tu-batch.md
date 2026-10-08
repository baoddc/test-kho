# Biểu Đồ Top 10 Vật Tư Nhập / Xuất Kho theo Mã VT + Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cập nhật logic tính toán và hiển thị biểu đồ Top 10 vật tư nhập kho và Top 10 vật tư xuất kho trên cả Xà gồ (`xg-bieu-do.html`) và Tole (`tole-bieu-do.html`) theo định danh `Mã vật tư + Batch`, với nhãn ngắn gọn `Mã VT (Batch)` và tooltip hiển thị đầy đủ tên vật tư và sản lượng kg.

**Architecture:** Trích xuất cột `Batch` động cùng với `Mã vật tư` và `Tên vật tư` trong các hàm xử lý dữ liệu biểu đồ. Gom nhóm khối lượng theo khóa `Mã VT (Batch)` (hoặc `Mã VT` nếu batch rỗng). Lưu trữ metadata (tên vật tư) để hiển thị trong tooltip của Chart.js. Chạy đồng bộ build sang `dist/`, `dist-app/`, và `public/`.

**Tech Stack:** JavaScript (ES6+), Chart.js, Node.js (test runner), VM sandbox tests.

## Global Constraints
- Không làm thay đổi các biểu đồ khác (Bar chart tháng, Pie chart cơ cấu, Line chart tồn kho cuối kỳ, Workshop chart công trình).
- Bộ lọc ngày ("Từ ngày" - "Đến ngày") phải tiếp tục hoạt động chính xác với dữ liệu Top 10 mới.
- Cấu trúc nhãn trục Y: `Mã VT (Batch)` (ví dụ: `10001189 (1.5X348VN)`). Nếu không có Batch hoặc Batch là `Không batch`/`-`: hiển thị `Mã VT`.
- Tooltip hiển thị: dòng 1 là nhãn `Mã VT (Batch)`, dòng 2 là `Tên vật tư`, dòng 3 là `Sản lượng: X kg`.

---

### Task 1: Tạo Unit Test kiểm thử logic Gom nhóm Top 10 theo Mã VT + Batch

**Files:**
- Create: `tests/bieu-do-top10-batch.test.js`

**Interfaces:**
- Consumes: Hàm xử lý nhóm dữ liệu vật tư và cấu hình tooltip Chart.js
- Produces: Test runner kiểm thử tự động xác nhận tính đúng đắn của logic

- [ ] **Step 1: Viết test file `tests/bieu-do-top10-batch.test.js`**

```javascript
const assert = require('assert');

console.log('--- Running Biểu Đồ Top 10 (Mã VT + Batch) Unit Tests ---');

function formatMaterialKey(ma, batch, ten) {
  const cleanMa = (ma || '').trim();
  const cleanBatch = (batch || '').trim();
  const cleanTen = (ten || '').trim();
  const hasBatch = cleanBatch && cleanBatch !== '-' && cleanBatch.toLowerCase() !== 'không batch' && cleanBatch.toLowerCase() !== 'khong batch';

  if (cleanMa && hasBatch) return `${cleanMa} (${cleanBatch})`;
  if (cleanMa) return cleanMa;
  if (hasBatch) return `Batch: ${cleanBatch}`;
  return cleanTen || '(Không xác định)';
}

function aggregateMaterialVolumes(rows, maCol, batchCol, tenCol, qtyCol) {
  const volumes = {};
  for (const row of rows) {
    const ma = row[maCol];
    const batch = row[batchCol];
    const ten = row[tenCol];
    const qty = Number(row[qtyCol]) || 0;

    const key = formatMaterialKey(ma, batch, ten);
    if (!volumes[key]) {
      volumes[key] = { qty: 0, ma, batch, ten };
    }
    volumes[key].qty += qty;
    if (ten && !volumes[key].ten) {
      volumes[key].ten = ten;
    }
  }
  return volumes;
}

// Test cases
// Case 1: Cùng mã vật tư nhưng khác batch phải tách thành 2 mục riêng biệt
const sampleRows = [
  { ma: '10001189', batch: '1.5X348VN', ten: 'Thép phôi kẽm Z275 G450', qty: 100 },
  { ma: '10001189', batch: '1.5X348VN', ten: 'Thép phôi kẽm Z275 G450', qty: 50 },
  { ma: '10001189', batch: '1.5X145VN', ten: 'Thép phôi kẽm Z275 G450', qty: 80 },
  { ma: 'B1.016216', batch: 'Không batch', ten: 'Thép phôi kẽm 2.4x426', qty: 200 },
  { ma: 'B1.016216', batch: '', ten: 'Thép phôi kẽm 2.4x426', qty: 50 },
  { ma: 'B1.142451', batch: 'VN', ten: 'Thép phôi kẽm 2.5x470', qty: 300 }
];

const aggregated = aggregateMaterialVolumes(sampleRows, 'ma', 'batch', 'ten', 'qty');

assert.strictEqual(aggregated['10001189 (1.5X348VN)'].qty, 150, 'Batch 1.5X348VN must sum to 150');
assert.strictEqual(aggregated['10001189 (1.5X145VN)'].qty, 80, 'Batch 1.5X145VN must sum to 80');
assert.strictEqual(aggregated['B1.016216'].qty, 250, 'Empty batch and "Không batch" must merge under mã VT B1.016216');
assert.strictEqual(aggregated['B1.142451 (VN)'].qty, 300, 'Batch VN must format as B1.142451 (VN)');

console.log('[PASS] All Top 10 batch aggregation unit tests passed!');
```

- [ ] **Step 2: Chạy kiểm thử để xác nhận pass**

Run: `node tests/bieu-do-top10-batch.test.js`
Expected: `[PASS] All Top 10 batch aggregation unit tests passed!`

- [ ] **Step 3: Commit Task 1**

```bash
git add tests/bieu-do-top10-batch.test.js
git commit -m "test: add unit tests for top 10 materials aggregation by code and batch"
```

---

### Task 2: Cập nhật Biểu đồ Top 10 trong `assets/js/xg/xg-bieu-do.js`

**Files:**
- Modify: `assets/js/xg/xg-bieu-do.js`

**Interfaces:**
- Consumes: Cột `Batch` từ `importHeaders` và `exportHeaders`
- Produces: `importMaterialVolumes` và `exportMaterialVolumes` theo key `Mã VT (Batch)` và Chart tooltips có `Tên VT`

- [ ] **Step 1: Cập nhật `processDataAndCreateCharts` trong `assets/js/xg/xg-bieu-do.js`**
  - Thêm `importBatchColIndex` và `exportBatchColIndex`.
  - Thay đổi cách tính `key` cho `importMaterialVolumes` và `exportMaterialVolumes`.

- [ ] **Step 2: Cập nhật `createImportMaterialChart` và `createExportMaterialChart` trong `assets/js/xg/xg-bieu-do.js`**
  - Hỗ trợ sắp xếp theo `getVolume(materialVolumes[m])`.
  - Bổ sung cấu hình tooltip `callbacks.title` hiển thị cả `key` và `Tên vật tư`.

- [ ] **Step 3: Chạy lại `tests/bieu-do-filter.test.js` để xác nhận file không có lỗi cú pháp**

Run: `node tests/bieu-do-filter.test.js`
Expected: PASS

- [ ] **Step 4: Commit Task 2**

```bash
git add assets/js/xg/xg-bieu-do.js
git commit -m "feat(xg): update top 10 charts to aggregate by material code and batch"
```

---

### Task 3: Cập nhật Biểu đồ Top 10 trong `assets/js/tole/tole-bieu-do.js`

**Files:**
- Modify: `assets/js/tole/tole-bieu-do.js`

**Interfaces:**
- Consumes: Cột `Batch` từ `importHeaders` và `exportHeaders` trong `tole-bieu-do.js`
- Produces: `importMaterialVolumes` và `exportMaterialVolumes` theo key `Mã VT (Batch)` và Chart tooltips có `Tên VT`

- [ ] **Step 1: Cập nhật `processDataAndCreateCharts` trong `assets/js/tole/tole-bieu-do.js`**
  - Thêm `importBatchColIndex` và `exportBatchColIndex`.
  - Thay đổi cách tính `key` cho `importMaterialVolumes` và `exportMaterialVolumes`.

- [ ] **Step 2: Cập nhật `createImportMaterialChart` và `createExportMaterialChart` trong `assets/js/tole/tole-bieu-do.js`**
  - Hỗ trợ sắp xếp theo `getVolume(materialVolumes[m])`.
  - Bổ sung cấu hình tooltip `callbacks.title` hiển thị cả `key` và `Tên vật tư`.

- [ ] **Step 3: Chạy lại `tests/bieu-do-filter.test.js`**

Run: `node tests/bieu-do-filter.test.js`
Expected: PASS

- [ ] **Step 4: Commit Task 3**

```bash
git add assets/js/tole/tole-bieu-do.js
git commit -m "feat(tole): update top 10 charts to aggregate by material code and batch"
```

---

### Task 4: Chạy Đồng bộ Bản Build & Kiểm tra Toàn diện

**Files:**
- Modify: `dist/*`, `dist-app/*`, `public/*` (thông qua sync script)

- [ ] **Step 1: Chạy `npm run build`**

Run: `npm run build`
Expected: `✅ [Sync Script] Full synchronization completed successfully!`

- [ ] **Step 2: Chạy toàn bộ test suite**

Run: `node tests/bieu-do-filter.test.js` và `node tests/bieu-do-top10-batch.test.js`
Expected: Toàn bộ bài test đều PASS

- [ ] **Step 3: Commit Task 4**

```bash
git add dist dist-app public
git commit -m "build: synchronize updated top 10 chart bundles to dist, dist-app and public"
```
