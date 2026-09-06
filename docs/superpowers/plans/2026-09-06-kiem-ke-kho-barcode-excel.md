# Kiểm Kê Kho Barcode & Đối Soát Excel (kiem-ke.html) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng trang `pages/kiem-ke.html` kiểm kê tồn kho bằng máy quét mã vạch (USB / Camera), tự động tạo Cột ảo `[Mã vật tư]-[Batch]`, nạp file Excel cơ sở (cột G, K, O), tổng hợp SUMIF và đối soát 3 chiều (File Excel vs Supabase vs Thực tế quét).

**Architecture:** 
- Mô-đun hóa logic xử lý: `kiem-ke-engine.js` (xử lý bóc tách Cột ảo, SUMIF, đối soát 3 chiều độc lập) có unit test đầy đủ.
- Mô-đun âm thanh & bộ nhớ: `kiem-ke-storage.js` (Web Audio API beep/boop, LocalStorage session persistence).
- Giao diện người dùng: `pages/kiem-ke.html` & `assets/css/kiem-ke.css` tích hợp Bootstrap 5, Dark Mode, Auto-focus scanner, Stat Cards, 2 Tab (Bảng tổng hợp đối soát + Danh sách chi tiết cuộn).
- Điều khiển trung tâm: `assets/js/kiem-ke.js` tích hợp Supabase (cả 2 kho XG & Tole), SheetJS đọc/xuất Excel.
- Đồng bộ hệ thống: Cập nhật `sidebar.js` và `sync-dist.js`.

**Tech Stack:** 
- HTML5, Vanilla JavaScript (ES6+), Vanilla CSS
- Bootstrap 5, Bootstrap Icons
- SheetJS (`xlsx.full.min.js`)
- Supabase JS Client
- Web Audio API (Synthesizer Beep/Boop)

## Global Constraints
- Nối Cột ảo định dạng chính xác: `[Mã vật tư]-[Batch]` (ngăn cách bởi dấu `-`).
- File Excel: Cột G là Mã vật tư, Cột K là Lô (Batch), Cột O là Khối lượng/Số lượng tồn.
- Tự động lưu tạm phiên quét vào LocalStorage để không mất dữ liệu khi F5.
- Cảnh báo và từ chối quét trùng cuộn trong cùng 1 phiên kiểm kê.
- Hỗ trợ cả 2 kho (Kho Xà gồ và Kho Tole).

---

### Task 1: Engine Xử Lý Dữ Liệu & Thuật Toán SUMIF 3 Chiều (`kiem-ke-engine.js`)

**Files:**
- Create: `assets/js/kiem-ke-engine.js`
- Test: `tests/kiem-ke-engine.test.js`

**Interfaces:**
- Produces:
  - `buildVirtualKey(maVatTu, batch)` -> string (e.g. `'10001189-2.5X75VN'`)
  - `parseExcelRows(rawRows)` -> `Map<string, { virtualKey, maVatTu, batch, totalKg, count }>`
  - `aggregateSystemStock(activeRolls)` -> `Map<string, { virtualKey, maVatTu, batch, totalKg, count, rolls }>`
  - `aggregateScannedRolls(scannedList)` -> `Map<string, { virtualKey, maVatTu, batch, totalKg, count, rolls }>`
  - `reconcile3Way(excelMap, systemMap, scannedMap)` -> `Array<{ virtualKey, maVatTu, batch, tenVatTu, excelKg, excelCount, systemKg, systemCount, scannedKg, scannedCount, diffScannedVsExcelKg, diffScannedVsSystemKg, status }>`

- [ ] **Step 1: Viết test cho Engine (TDD)**

Tạo file `tests/kiem-ke-engine.test.js`:
```javascript
const assert = require('assert');
const {
  buildVirtualKey,
  parseExcelRows,
  aggregateSystemStock,
  aggregateScannedRolls,
  reconcile3Way,
  normalizeNumber
} = require('../assets/js/kiem-ke-engine.js');

console.log('--- TEST KIEM KE ENGINE ---');

// Test 1: buildVirtualKey
assert.strictEqual(buildVirtualKey('10001189', '2.5X75VN'), '10001189-2.5X75VN');
assert.strictEqual(buildVirtualKey('  10001189  ', '  2.5X75VN  '), '10001189-2.5X75VN');
console.log('✅ Test 1 Passed: buildVirtualKey');

// Test 2: normalizeNumber
assert.strictEqual(normalizeNumber('1.250,5'), 1250.5);
assert.strictEqual(normalizeNumber('1,250.5'), 1250.5);
assert.strictEqual(normalizeNumber(2500), 2500);
assert.strictEqual(normalizeNumber(''), 0);
console.log('✅ Test 2 Passed: normalizeNumber');

// Test 3: parseExcelRows (Cột G = col 6, Cột K = col 10, Cột O = col 14 theo 0-index)
const mockRawExcel = [
  ['Header', '', '', '', '', '', 'Mã vật tư', '', '', '', 'Lô (Batch)', '', '', '', 'Số lượng'],
  ['', '', '', '', '', '', '10001189', '', '', '', '2.5X75VN', '', '', '', '1500'],
  ['', '', '', '', '', '', '10001189', '', '', '', '2.5X75VN', '', '', '', '1000'],
  ['', '', '', '', '', '', '10001200', '', '', '', 'BATCH-01', '', '', '', '2000.5']
];
const excelMap = parseExcelRows(mockRawExcel);
assert.strictEqual(excelMap.size, 2);
const item1 = excelMap.get('10001189-2.5X75VN');
assert.strictEqual(item1.totalKg, 2500);
assert.strictEqual(item1.count, 2);
console.log('✅ Test 3 Passed: parseExcelRows');

// Test 4: aggregateSystemStock
const mockSystemRolls = [
  { 'Mã vật tư': '10001189', 'Batch': '2.5X75VN', 'Số lượng (Kg)': 2500, 'Tên vật tư': 'Thép mạ kẽm' },
  { 'Mã vật tư': '10001300', 'Batch': 'BATCH-99', 'Số lượng (Kg)': 800, 'Tên vật tư': 'Tole cuộn' }
];
const systemMap = aggregateSystemStock(mockSystemRolls);
assert.strictEqual(systemMap.size, 2);
assert.strictEqual(systemMap.get('10001189-2.5X75VN').totalKg, 2500);
console.log('✅ Test 4 Passed: aggregateSystemStock');

// Test 5: reconcile3Way
const mockScannedList = [
  { maVatTu: '10001189', batch: '2.5X75VN', kg: 2500, barcode: '10001189-2.5X75VN-2500' }
];
const scannedMap = aggregateScannedRolls(mockScannedList);
const result = reconcile3Way(excelMap, systemMap, scannedMap);

assert(result.length >= 3);
const r1 = result.find(x => x.virtualKey === '10001189-2.5X75VN');
assert.strictEqual(r1.status, 'MATCH');
assert.strictEqual(r1.excelKg, 2500);
assert.strictEqual(r1.systemKg, 2500);
assert.strictEqual(r1.scannedKg, 2500);
console.log('✅ Test 5 Passed: reconcile3Way MATCH');
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `node tests/kiem-ke-engine.test.js`
Expected: FAIL (Cannot find module `../assets/js/kiem-ke-engine.js`)

- [ ] **Step 3: Triển khai file `assets/js/kiem-ke-engine.js`**

Viết code hoàn chỉnh vào `assets/js/kiem-ke-engine.js`:
```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KiemKeEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  function normalizeNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim().replace(/\s+/g, '');
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function buildVirtualKey(maVatTu, batch) {
    const ma = String(maVatTu || '').trim();
    const b = String(batch || '').trim();
    return `${ma}-${b}`;
  }

  function parseExcelRows(rawRows) {
    const map = new Map();
    if (!Array.isArray(rawRows) || rawRows.length === 0) return map;

    // Cột G = index 6, Cột K = index 10, Cột O = index 14
    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      const ma = row[6] !== undefined ? String(row[6]).trim() : '';
      const batch = row[10] !== undefined ? String(row[10]).trim() : '';
      if (!ma && !batch) continue;

      // Bỏ qua dòng tiêu đề nếu chứa chữ "Mã vật tư" hoặc "Material"
      if (ma.toLowerCase().includes('mã') || ma.toLowerCase().includes('material')) continue;

      const kg = normalizeNumber(row[14]);
      const vKey = buildVirtualKey(ma, batch);
      if (!vKey || vKey === '-') continue;

      if (!map.has(vKey)) {
        map.set(vKey, {
          virtualKey: vKey,
          maVatTu: ma,
          batch: batch,
          totalKg: 0,
          count: 0
        });
      }
      const item = map.get(vKey);
      item.totalKg = Math.round((item.totalKg + kg) * 100) / 100;
      item.count += 1;
    }
    return map;
  }

  function aggregateSystemStock(activeRolls) {
    const map = new Map();
    if (!Array.isArray(activeRolls)) return map;

    activeRolls.forEach(roll => {
      const ma = String(roll['Mã vật tư'] || '').trim();
      const batch = String(roll['Batch'] || '').trim();
      const kg = normalizeNumber(roll['Số lượng (Kg)']);
      const ten = String(roll['Tên vật tư'] || '').trim();
      const vKey = buildVirtualKey(ma, batch);
      if (!vKey || vKey === '-') return;

      if (!map.has(vKey)) {
        map.set(vKey, {
          virtualKey: vKey,
          maVatTu: ma,
          batch: batch,
          tenVatTu: ten,
          totalKg: 0,
          count: 0,
          rolls: []
        });
      }
      const item = map.get(vKey);
      if (!item.tenVatTu && ten) item.tenVatTu = ten;
      item.totalKg = Math.round((item.totalKg + kg) * 100) / 100;
      item.count += 1;
      item.rolls.push(roll);
    });
    return map;
  }

  function aggregateScannedRolls(scannedList) {
    const map = new Map();
    if (!Array.isArray(scannedList)) return map;

    scannedList.forEach(item => {
      const ma = String(item.maVatTu || '').trim();
      const batch = String(item.batch || '').trim();
      const kg = normalizeNumber(item.kg);
      const vKey = buildVirtualKey(ma, batch);
      if (!vKey || vKey === '-') return;

      if (!map.has(vKey)) {
        map.set(vKey, {
          virtualKey: vKey,
          maVatTu: ma,
          batch: batch,
          totalKg: 0,
          count: 0,
          rolls: []
        });
      }
      const agg = map.get(vKey);
      agg.totalKg = Math.round((agg.totalKg + kg) * 100) / 100;
      agg.count += 1;
      agg.rolls.push(item);
    });
    return map;
  }

  function reconcile3Way(excelMap, systemMap, scannedMap) {
    const allKeys = new Set([
      ...(excelMap ? excelMap.keys() : []),
      ...(systemMap ? systemMap.keys() : []),
      ...(scannedMap ? scannedMap.keys() : [])
    ]);

    const result = [];
    allKeys.forEach(vKey => {
      const ex = excelMap ? excelMap.get(vKey) : null;
      const sys = systemMap ? systemMap.get(vKey) : null;
      const sc = scannedMap ? scannedMap.get(vKey) : null;

      const maVatTu = (ex && ex.maVatTu) || (sys && sys.maVatTu) || (sc && sc.maVatTu) || '';
      const batch = (ex && ex.batch) || (sys && sys.batch) || (sc && sc.batch) || '';
      const tenVatTu = (sys && sys.tenVatTu) || '';

      const excelKg = ex ? ex.totalKg : 0;
      const excelCount = ex ? ex.count : 0;

      const systemKg = sys ? sys.totalKg : 0;
      const systemCount = sys ? sys.count : 0;

      const scannedKg = sc ? sc.totalKg : 0;
      const scannedCount = sc ? sc.count : 0;

      const diffScannedVsExcelKg = Math.round((scannedKg - excelKg) * 100) / 100;
      const diffScannedVsSystemKg = Math.round((scannedKg - systemKg) * 100) / 100;

      let status = 'UNSCANNED'; // Chưa quét
      if (!ex) {
        status = 'EXTRA_FILE'; // Ngoài danh mục file Excel
      } else if (scannedCount === 0) {
        status = 'UNSCANNED';
      } else if (Math.abs(diffScannedVsExcelKg) < 0.1) {
        status = 'MATCH'; // Khớp
      } else if (diffScannedVsExcelKg < 0) {
        status = 'SHORTAGE'; // Lệch thiếu
      } else {
        status = 'SURPLUS'; // Lệch thừa
      }

      result.push({
        virtualKey: vKey,
        maVatTu,
        batch,
        tenVatTu,
        excelKg,
        excelCount,
        systemKg,
        systemCount,
        scannedKg,
        scannedCount,
        diffScannedVsExcelKg,
        diffScannedVsSystemKg,
        status
      });
    });

    // Sắp xếp: Mã lệch đưa lên trước, sau đó đến mã khớp
    return result.sort((a, b) => a.virtualKey.localeCompare(b.virtualKey));
  }

  return {
    normalizeNumber,
    buildVirtualKey,
    parseExcelRows,
    aggregateSystemStock,
    aggregateScannedRolls,
    reconcile3Way
  };
}));
```

- [ ] **Step 4: Chạy lại test để xác nhận PASS**

Run: `node tests/kiem-ke-engine.test.js`
Expected: PASS all tests.

- [ ] **Step 5: Commit**

Run: `git add assets/js/kiem-ke-engine.js tests/kiem-ke-engine.test.js; git commit -m "feat: implement inventory reconciliation engine and unit tests"`

---

### Task 2: Quản Lý Bộ Nhớ LocalStorage & Âm Thanh Web Audio (`kiem-ke-storage.js`)

**Files:**
- Create: `assets/js/kiem-ke-storage.js`
- Test: `tests/kiem-ke-storage.test.js`

**Interfaces:**
- Produces:
  - `saveSession(scannedRolls, excelMetadata)`
  - `loadSession()` -> `{ scannedRolls, excelMetadata }`
  - `clearSession()`
  - `checkDuplicate(scannedRolls, barcodeOrRollId)` -> boolean
  - `playBeepSuccess()`
  - `playBoopError()`

- [ ] **Step 1: Viết test cho Storage & Duplicate check (TDD)**

Tạo file `tests/kiem-ke-storage.test.js`:
```javascript
const assert = require('assert');
const { checkDuplicate } = require('../assets/js/kiem-ke-storage.js');

console.log('--- TEST KIEM KE STORAGE ---');

const mockList = [
  { barcode: '10001189-2X349VN-1472', maVatTu: '10001189', batch: '2X349VN', kg: 1472, cuonId: 'ROLL-01' },
  { barcode: '10001200-BATCH2-2000', maVatTu: '10001200', batch: 'BATCH2', kg: 2000, cuonId: 'ROLL-02' }
];

assert.strictEqual(checkDuplicate(mockList, '10001189-2X349VN-1472'), true);
assert.strictEqual(checkDuplicate(mockList, 'ROLL-01'), true);
assert.strictEqual(checkDuplicate(mockList, '10001999-NEW-1000'), false);
console.log('✅ Test Passed: checkDuplicate detects existing barcode or cuonId');
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `node tests/kiem-ke-storage.test.js`

- [ ] **Step 3: Triển khai file `assets/js/kiem-ke-storage.js`**

Viết code hoàn chỉnh cho `assets/js/kiem-ke-storage.js`:
```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KiemKeStorage = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const SESSION_KEY = 'kiem_ke_scanned_rolls_session';
  const EXCEL_CACHE_KEY = 'kiem_ke_excel_cache';

  function checkDuplicate(scannedList, identifier) {
    if (!Array.isArray(scannedList) || !identifier) return false;
    const cleanId = String(identifier).trim().toLowerCase();
    return scannedList.some(item => {
      const b = String(item.barcode || '').trim().toLowerCase();
      const c = String(item.cuonId || '').trim().toLowerCase();
      return b === cleanId || (c && c === cleanId);
    });
  }

  function saveSession(scannedRolls, excelMetadata) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(scannedRolls || []));
      if (excelMetadata) {
        localStorage.setItem(EXCEL_CACHE_KEY, JSON.stringify(excelMetadata));
      }
    } catch (e) {
      console.warn('Lỗi lưu LocalStorage:', e);
    }
  }

  function loadSession() {
    if (typeof localStorage === 'undefined') return { scannedRolls: [], excelMetadata: null };
    try {
      const rawScanned = localStorage.getItem(SESSION_KEY);
      const rawExcel = localStorage.getItem(EXCEL_CACHE_KEY);
      return {
        scannedRolls: rawScanned ? JSON.parse(rawScanned) : [],
        excelMetadata: rawExcel ? JSON.parse(rawExcel) : null
      };
    } catch (e) {
      console.warn('Lỗi đọc LocalStorage:', e);
      return { scannedRolls: [], excelMetadata: null };
    }
  }

  function clearSession() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(EXCEL_CACHE_KEY);
    } catch (e) {
      console.warn('Lỗi xóa LocalStorage:', e);
    }
  }

  // Web Audio API Synthesizer
  let audioCtx = null;
  function getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playBeepSuccess() {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 (trong trẻo)
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }

  function playBoopError() {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3 (trầm)
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }

  return {
    checkDuplicate,
    saveSession,
    loadSession,
    clearSession,
    playBeepSuccess,
    playBoopError
  };
}));
```

- [ ] **Step 4: Chạy lại test để xác nhận PASS**

Run: `node tests/kiem-ke-storage.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

Run: `git add assets/js/kiem-ke-storage.js tests/kiem-ke-storage.test.js; git commit -m "feat: implement session storage and web audio feedback for inventory scanner"`

---

### Task 3: Giao Diện Người Dùng & CSS Tối Ưu (`pages/kiem-ke.html`, `assets/css/kiem-ke.css`)

**Files:**
- Create: `pages/kiem-ke.html`
- Create: `assets/css/kiem-ke.css`

**UI Requirements:**
- Thiết kế Dark theme đồng bộ với hệ thống DDC.
- Header Top Bar gồm: Nút Nạp Excel (`input[type="file"]`), Ô nhập Barcode tự động focus, Nút Camera QR, Nút Làm mới Supabase, Nút Xuất Excel, Nút Xóa phiên quét.
- 5 Thẻ thống kê: Tổng Batch, Tồn File Excel (Kg | Dòng), Tồn Hệ thống (Kg | Cuộn), Đã Quét (Kg | Cuộn), Trạng thái Đối soát (Khớp vs Lệch).
- 2 Tabs:
  - Tab 1: Bảng tổng hợp Cột ảo (STT, Cột ảo, Tên VT, File Excel, Hệ thống, Đã quét, Lệch vs File, Lệch vs Hệ thống, Trạng thái) kèm Bộ lọc & Ô tìm kiếm.
  - Tab 2: Danh sách chi tiết cuộn đã quét (STT, Giờ quét, Barcode gốc, Mã VT, Batch, Khối lượng tem, Nút Xóa).
- Modal Camera Scanner và Modal xác nhận xóa phiên quét.

- [ ] **Step 1: Tạo file CSS `assets/css/kiem-ke.css`**
- [ ] **Step 2: Tạo file HTML `pages/kiem-ke.html`**
- [ ] **Step 3: Kiểm tra cấu trúc HTML và liên kết CSS/JS**
- [ ] **Step 4: Commit**

Run: `git add pages/kiem-ke.html assets/css/kiem-ke.css; git commit -m "feat(ui): add layout and styling for inventory audit page"`

---

### Task 4: Bộ Điều Khiển Chính & Tích Hợp Supabase, Máy Quét, SheetJS (`assets/js/kiem-ke.js`)

**Files:**
- Create: `assets/js/kiem-ke.js`

**Requirements:**
- Tự động tải song song tồn kho 2 kho: `xg-nhap`/`xg-xuat` và `tole-nhap`/`tole-xuat`.
- Nạp và phân tích file Excel bằng `XLSX.read(data, { type: 'array' })`, lấy Sheet đầu tiên và parse mảng dòng.
- Lắng nghe sự kiện súng quét mã vạch trên `#barcodeInput` (sự kiện `keydown` Enter, giữ focus liên tục).
- Hỗ trợ Camera Scanner thông qua `Html5Qrcode`.
- Tự động tính toán lại SUMIF và re-render bảng khi có cuộn mới hoặc file Excel mới.
- Xuất báo cáo Excel 2 sheet: `Tong_Hop_Doi_Soat` và `Chi_Tiet_Cuon_Quet`.

- [ ] **Step 1: Triển khai file `assets/js/kiem-ke.js`**
- [ ] **Step 2: Viết test kịch bản hoàn chỉnh E2E (`tests/test-kiem-ke-e2e.js`)**
- [ ] **Step 3: Chạy test E2E để xác nhận hoạt động**

Run: `node tests/test-kiem-ke-e2e.js`
Expected: PASS

- [ ] **Step 4: Commit**

Run: `git add assets/js/kiem-ke.js tests/test-kiem-ke-e2e.js; git commit -m "feat: implement main controller for inventory audit with Supabase and Excel export"`

---

### Task 5: Tích Hợp Điều Hướng Sidebar & Đồng Bộ Bản Phân Phối

**Files:**
- Modify: `assets/js/components/sidebar.js`
- Modify: `scripts/sync-dist.js` (nếu cần)

- [ ] **Step 1: Thêm mục menu 'Kiểm kê Tồn kho' vào `sidebar.js` dưới nhóm 'TEM QR, KIỂM KÊ'**
- [ ] **Step 2: Chạy build đồng bộ `npm run build`**

Run: `npm run build`
Expected: Copy toàn bộ `pages/kiem-ke.html`, `assets/css/kiem-ke.css`, `assets/js/kiem-ke*.js` vào `dist`, `dist-app`, `public`.

- [ ] **Step 3: Kiểm tra toàn bộ test suite**

Run: `node tests/kiem-ke-engine.test.js; node tests/kiem-ke-storage.test.js; node tests/test-kiem-ke-e2e.js`
Expected: Tất cả bài test đều PASS 100%.

- [ ] **Step 4: Commit & Hoàn tất**

Run: `git add assets/js/components/sidebar.js dist/ dist-app/ public/; git commit -m "feat: add inventory audit to sidebar navigation and sync distributions"`
