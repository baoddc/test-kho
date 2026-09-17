# In Tem Cuộn Barcode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng trang web công cụ `pages/tem-nhan-kiem-ke/in-tem-cuon.html` và các file CSS, JS tương ứng để tạo và in mã vạch Barcode Code 128 (width: 4px, height: 90px, font: 35px) cho các cuộn xà gồ và tole từ Supabase hoặc file Excel tồn kho, in 2 tem trên một hàng ngang khổ A4 chạy dài xuống hết trang.

**Architecture:** Sử dụng kiến trúc module độc lập chuẩn của dự án: giao diện HTML Bootstrap 5, CSS layout & `@media print` 2 cột A4, JS controller nạp tồn từ Supabase (`xg-nhap`/`xg-xuat` & `tole-nhap`/`tole-xuat`) hoặc nạp từ SheetJS (file Excel), sinh barcode Code 128 qua `JsBarcode`, hỗ trợ xuất ZIP qua `JSZip` + `FileSaver`, tích hợp menu điều hướng và phân quyền hệ thống.

**Tech Stack:** HTML5, CSS3 (Vanilla CSS + Bootstrap 5 + Bootstrap Icons), JavaScript (ES6+), Supabase JS, SheetJS (xlsx), JsBarcode, JSZip, FileSaver.js.

## Global Constraints
- Độ rộng vạch Barcode: `width = 4`
- Chiều cao vạch Barcode: `height = 90`
- Kích thước font chữ Barcode: `fontSize = 35` (hiển thị text bên dưới mã vạch, `displayValue = true`)
- Bố cục in: 2 tem theo mặt ngang khổ A4 (`grid-template-columns: repeat(2, 1fr)`), chạy dọc xuống liên tục
- Định dạng Barcode mặc định: `{Mã vật tư}-{Batch}-{Khối lượng}` (Ví dụ: `10001189-2.5X75VN-2570`), kèm switch chuyển sang `{Cuộn ID}` nếu cần
- Đồng bộ tự động sang `dist/`, `dist-app/`, `public/` qua `scripts/sync-dist.js`

---

### Task 1: Unit Tests for Coil Barcode Formatter & Excel Parser Logic

**Files:**
- Create: `tests/in-tem-cuon.test.js`

**Interfaces:**
- Produces: `formatCoilBarcodeData(row, mode)` helper function and `parseExcelInventory(sheetData)` mapper.

- [ ] **Step 1: Write test file `tests/in-tem-cuon.test.js`**

```javascript
const assert = require('assert');

// Logic under test
function formatCoilBarcodeData(row, mode = 'standard') {
  if (!row) return '';
  if (mode === 'cuon_id') {
    return String(row['Cuộn ID'] || row['cuon_id'] || '').trim();
  }
  const maVt = String(row['Mã vật tư'] || row['ma_vat_tu'] || row['Mã VT'] || '').trim();
  const batch = String(row['Batch'] || row['batch'] || row['Lô'] || '').trim();
  const rawKg = row['Số lượng (Kg)'] ?? row['Khối lượng (kg)'] ?? row['kg'] ?? row['Khoi_luong_kg'] ?? 0;
  const numKg = Math.round(Number(String(rawKg).replace(',', '.')) || 0);
  if (!maVt && !batch) return '';
  return `${maVt}-${batch}-${numKg}`;
}

function normalizeExcelRow(rawRow) {
  const row = {};
  for (const key of Object.keys(rawRow)) {
    const cleanKey = key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (cleanKey.includes('ma vat tu') || cleanKey === 'ma vt' || cleanKey === 'mavt') {
      row['Mã vật tư'] = String(rawRow[key] || '').trim();
    } else if (cleanKey.includes('ten vat tu') || cleanKey.includes('ten hang') || cleanKey === 'tenvt') {
      row['Tên vật tư'] = String(rawRow[key] || '').trim();
    } else if (cleanKey === 'batch' || cleanKey.includes('so lo') || cleanKey === 'lo') {
      row['Batch'] = String(rawRow[key] || '').trim();
    } else if (cleanKey.includes('cuon id') || cleanKey.includes('ma cuon') || cleanKey === 'cuonid') {
      row['Cuộn ID'] = String(rawRow[key] || '').trim();
    } else if (cleanKey.includes('so luong') || cleanKey.includes('khoi luong') || cleanKey.includes('kg')) {
      row['Số lượng (Kg)'] = Number(String(rawRow[key] || 0).replace(',', '.')) || 0;
    } else if (cleanKey.includes('vi tri') || cleanKey === 'ke' || cleanKey === 'vitri') {
      row['Vị trí'] = String(rawRow[key] || '').trim().toUpperCase();
    } else if (cleanKey.includes('ngay nhap')) {
      row['Ngày nhập'] = String(rawRow[key] || '').trim();
    }
  }
  return row;
}

console.log('--- RUNNING TESTS FOR IN-TEM-CUON LOGIC ---');

// Test 1: Barcode string standard mode
const sampleRow1 = {
  'Mã vật tư': '10001189',
  'Batch': '2.5X75VN',
  'Số lượng (Kg)': 2570.4,
  'Cuộn ID': '10001189 - Cuộn 101'
};
assert.strictEqual(formatCoilBarcodeData(sampleRow1, 'standard'), '10001189-2.5X75VN-2570');
console.log('✅ Test 1 passed: Standard barcode string format correct');

// Test 2: Barcode string cuon_id mode
assert.strictEqual(formatCoilBarcodeData(sampleRow1, 'cuon_id'), '10001189 - Cuộn 101');
console.log('✅ Test 2 passed: Cuộn ID barcode string format correct');

// Test 3: Excel header normalization
const rawExcelRow = {
  'MÃ VẬT TƯ': '10001234',
  'TÊN HÀNG HÓA': 'XÀ GỒ MẠ KẼM C200',
  'Số Lô': 'BATCH-99',
  'Mã Cuộn': 'CUON-991',
  'Khối lượng (kg)': '1850.5',
  'Vị Trí': 'a02'
};
const normalized = normalizeExcelRow(rawExcelRow);
assert.strictEqual(normalized['Mã vật tư'], '10001234');
assert.strictEqual(normalized['Tên vật tư'], 'XÀ GỒ MẠ KẼM C200');
assert.strictEqual(normalized['Batch'], 'BATCH-99');
assert.strictEqual(normalized['Cuộn ID'], 'CUON-991');
assert.strictEqual(normalized['Số lượng (Kg)'], 1850.5);
assert.strictEqual(normalized['Vị trí'], 'A02');
console.log('✅ Test 3 passed: Excel header normalization correct');

console.log('🎉 ALL IN-TEM-CUON TESTS PASSED!');
```

- [ ] **Step 2: Run test with node**

Run: `node tests/in-tem-cuon.test.js`
Expected: PASS with 3 test cases verified

- [ ] **Step 3: Commit**

```bash
git add tests/in-tem-cuon.test.js
git commit -m "test: add unit tests for coil barcode formatting and excel normalization"
```

---

### Task 2: CSS Stylesheet & Print Layout (`in-tem-cuon.css`)

**Files:**
- Create: `assets/css/tem-nhan-kiem-ke/in-tem-cuon.css`

**Features:**
- Responsive UI controls, scrollable cuộn table matrix.
- High-contrast industrial design for coil label cards.
- Barcode SVG container sizing (accommodating 4px width & 90px height barcode).
- `@media print` with 2-column grid layout for A4 (`repeat(2, 1fr)`), `break-inside: avoid` / `page-break-inside: avoid`, full hiding of header, sidebar, control panel, search boxes.

- [ ] **Step 1: Create `assets/css/tem-nhan-kiem-ke/in-tem-cuon.css`**
- [ ] **Step 2: Verify CSS syntax and layout rules**
- [ ] **Step 3: Commit**

```bash
git add assets/css/tem-nhan-kiem-ke/in-tem-cuon.css
git commit -m "feat: add stylesheet and A4 2-column print layout for in-tem-cuon"
```

---

### Task 3: JavaScript Controller (`in-tem-cuon.js`)

**Files:**
- Create: `assets/js/tem-nhan-kiem-ke/in-tem-cuon.js`

**Features:**
- Fetch data from Supabase (`xg-nhap`/`xg-xuat` for Kho Xà gồ, `tole-nhap`/`tole-xuat` for Kho Tole) with pagination batching.
- File upload listener: Read Excel (`SheetJS.read`), normalize columns, merge or switch data.
- Rack filter matrix (A01-A14, B01-B14, Grating) + text search input (debounce 250ms).
- Selection manager: Select all / Deselect all / Select visible / Select by rack.
- Barcode generator using `JsBarcode`:
  - `format: 'CODE128'`
  - `width: 4`
  - `height: 90`
  - `fontSize: 35`
  - `displayValue: true`
  - `fontOptions: 'bold'`
- ZIP export: Convert SVG barcodes to PNG via OffscreenCanvas / Canvas, pack into `.zip` via `JSZip` and download via `FileSaver`.
- Print trigger: `window.print()` with shortcut Ctrl + P.

- [ ] **Step 1: Create `assets/js/tem-nhan-kiem-ke/in-tem-cuon.js`**
- [ ] **Step 2: Run syntax verification on the script**
- [ ] **Step 3: Commit**

```bash
git add assets/js/tem-nhan-kiem-ke/in-tem-cuon.js
git commit -m "feat: add in-tem-cuon controller logic for inventory loading and barcode generation"
```

---

### Task 4: HTML View (`in-tem-cuon.html`)

**Files:**
- Create: `pages/tem-nhan-kiem-ke/in-tem-cuon.html`

**Features:**
- Semantic Bootstrap 5 structure with standard DDC navbar, breadcrumb, control panel, inventory source switcher (Kho Xà gồ / Kho Tole / Nạp Excel).
- Rack filter buttons & keyword search box.
- Table of selectable rolls with badges (Mã VT, Batch, Cuộn ID, Trọng lượng Kg, Vị trí).
- Live preview label container (`#labelsContainer`) rendering 2-column label cards.
- Script tags for Bootstrap, SheetJS, JsBarcode, JSZip, FileSaver, Supabase client, qr-scanner-service, sidebar.js, in-tem-cuon.js.
- Action buttons have `data-perm="add"` or `data-perm="view"` according to permission rules.

- [ ] **Step 1: Create `pages/tem-nhan-kiem-ke/in-tem-cuon.html`**
- [ ] **Step 2: Verify HTML tag pairing and asset paths**
- [ ] **Step 3: Commit**

```bash
git add pages/tem-nhan-kiem-ke/in-tem-cuon.html
git commit -m "feat: create in-tem-cuon.html view page"
```

---

### Task 5: Integration with Navigation, Permissions & Build Sync

**Files:**
- Modify: `assets/js/components/sidebar.js` (add in-tem-cuon link in menu and standalone paths)
- Modify: `pages/quan-ly-user.html` and `assets/js/quan-ly-user.js` (add permission checkbox for `/pages/tem-nhan-kiem-ke/in-tem-cuon.html`)
- Modify: `tests/html-data-perm.test.js` (add page to permission test suite)
- Run: `npm run build` (`node scripts/sync-dist.js`) to sync all new and updated files to `dist/`, `dist-app/`, and `public/`

- [ ] **Step 1: Update `sidebar.js`**
- [ ] **Step 2: Update `quan-ly-user.html` & `quan-ly-user.js`**
- [ ] **Step 3: Update `tests/html-data-perm.test.js`**
- [ ] **Step 4: Run build sync `npm run build`**
- [ ] **Step 5: Run permission tests `node tests/html-data-perm.test.js`**
- [ ] **Step 6: Commit**

```bash
git add assets/js/components/sidebar.js pages/quan-ly-user.html assets/js/quan-ly-user.js tests/html-data-perm.test.js dist/ dist-app/ public/
git commit -m "feat: integrate in-tem-cuon into sidebar, user permissions, and sync dist"
```

---

### Task 6: End-to-End Verification & Walkthrough

**Files:**
- Create: `tests/test-in-tem-cuon-e2e.js`

- [ ] **Step 1: Write and run automated E2E test verifying barcode generation, barcode format parsing, and batch selection**
- [ ] **Step 2: Verify browser rendering and print stylesheet**
- [ ] **Step 3: Create Walkthrough documentation**
