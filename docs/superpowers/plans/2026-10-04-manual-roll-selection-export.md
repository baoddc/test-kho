# Chọn Cuộn Thủ Công Khi Nhập Phiếu Xuất (Xà Gồ & Tole) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi cơ chế điền phiếu xuất từ SAP trong phân hệ Xà Gồ và Tole để không tự động điền các cuộn tồn kho vào thẻ mặt hàng; giữ danh sách cuộn rỗng (`rolls: []`) và để thủ kho tự chọn cuộn thủ công qua nút `+ Chọn cuộn từ kho`.

**Architecture:** Tinh chỉnh hàm `populateExportReceiptFromSap` trong `xg-xuat.js` và `tole-xuat.js`, loại bỏ logic tự động truy vấn bảng nhập kho và tự động push cuộn vào `item.rolls`. Giữ nguyên việc khởi tạo thẻ mặt hàng với `rolls: []` và thông báo toast nhắc người dùng bấm `+ Chọn cuộn từ kho`. Đồng bộ nhãn nút ở modal sửa trong `xg-xuat.html`. Sau đó đồng bộ toàn bộ qua `scripts/sync-dist.js`.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, Bootstrap 5, Supabase JS Client, Node.js (test runner).

## Global Constraints
- Không tự động đưa cuộn vào thẻ mặt hàng khi chọn phiếu xuất từ SAP hoặc đồng bộ.
- Bảng cuộn của từng mặt hàng phải giữ nguyên trạng thái `rolls: []` để hiển thị hàng hướng dẫn `Chưa có cuộn nào. Vui lòng bấm "+ Chọn cuộn từ kho"`.
- Giữ nguyên các chức năng thủ công: nút `+ Chọn cuộn từ kho` (`.btn-item-pick-inv`), modal `inventoryRollsModal`, kiểm tra trùng lặp và khóa cuộn (`inventoryLockService`).
- Chạy `node scripts/sync-dist.js` để cập nhật đồng bộ các thư mục `dist/`, `dist-app/`, và `public/`.

---

### Task 1: Tạo bộ kiểm thử tự động cho việc chọn cuộn thủ công

**Files:**
- Create: `tests/test-manual-roll-selection-export.js`

**Interfaces:**
- Consumes: `populateExportReceiptFromSap` behavior contract
- Produces: Test runner verifying `rolls` array remains empty (`[]`) when `populateExportReceiptFromSap` runs, and verifying `pages/xg/xg-xuat.html` button text is `+ Chọn cuộn từ kho`

- [ ] **Step 1: Viết test runner kiểm thử thất bại ban đầu**

```javascript
// tests/test-manual-roll-selection-export.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function main() {
  console.log('===============================================================');
  console.log(' KIỂM THỬ CHỌN CUỘN THỦ CÔNG KHI NHẬP PHIẾU XUẤT (XG & TOLE)');
  console.log('===============================================================\n');

  // Test 1: Kiểm tra mã nguồn xg-xuat.js không còn khối tự động tải cuộn tồn kho vào rolls
  runTest('xg-xuat.js không tự động truy vấn xg-nhap để điền rolls trong populateExportReceiptFromSap', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(!content.includes("console.error('[xg-xuat] Lỗi tự động tải cuộn tồn kho:'"), 'Vẫn còn khối tự động tải cuộn tồn kho trong xg-xuat.js');
    assert.ok(content.includes('window.populateExportReceiptData = populateExportReceiptFromSap'), 'Thiếu populateExportReceiptData');
  });

  // Test 2: Kiểm tra mã nguồn tole-xuat.js không còn khối tự động tải cuộn tồn kho vào rolls
  runTest('tole-xuat.js không tự động truy vấn tole-nhap để điền rolls trong populateExportReceiptFromSap', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(!content.includes("console.error('[tole-xuat] Lỗi tự động tải cuộn tồn kho:'"), 'Vẫn còn khối tự động tải cuộn tồn kho trong tole-xuat.js');
    assert.ok(content.includes('window.populateExportReceiptData = populateExportReceiptFromSap'), 'Thiếu populateExportReceiptData');
  });

  // Test 3: Kiểm tra nhãn nút modal sửa trong xg-xuat.html
  runTest('xg-xuat.html có nhãn nút btnEditAddRoll là "+ Chọn cuộn từ kho"', () => {
    const content = fs.readFileSync(path.join(__dirname, '../pages/xg/xg-xuat.html'), 'utf8');
    assert.ok(content.includes('id="btnEditAddRoll" class="btn btn-sm btn-light">+ Chọn cuộn từ kho</button>'), 'btnEditAddRoll trong xg-xuat.html chưa đổi thành "+ Chọn cuộn từ kho"');
  });

  console.log('\n---------------------------------------------------------------');
  console.log(` KẾT QUẢ: ${passedTests}/${totalTests} BÀI TEST THÀNH CÔNG`);
  console.log('---------------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `node tests/test-manual-roll-selection-export.js`
Expected: FAIL với assertion lỗi do mã nguồn chưa được chỉnh sửa.

- [ ] **Step 3: Commit file test**

```bash
git add tests/test-manual-roll-selection-export.js
git commit -m "test: add test suite for manual roll selection in export receipt"
```

---

### Task 2: Chỉnh sửa `xg-xuat.js` và `xg-xuat.html`

**Files:**
- Modify: `assets/js/xg/xg-xuat.js:1565-1625`
- Modify: `pages/xg/xg-xuat.html:237`

**Interfaces:**
- Consumes: `headerInfo`, `itemsGrouped` in `populateExportReceiptFromSap`
- Produces: Item cards with empty `rolls: []` and toast prompting user to select rolls manually

- [ ] **Step 1: Chỉnh sửa `assets/js/xg/xg-xuat.js`**
Trong hàm `populateExportReceiptFromSap`:
Bỏ đoạn truy vấn tự động `xg-nhap` ở Bước 3.
Gọi `renderItemCards()` và highlight thẻ mặt hàng.
Cập nhật thông báo toast hướng dẫn bấm `+ Chọn cuộn từ kho`.

- [ ] **Step 2: Chỉnh sửa `pages/xg/xg-xuat.html`**
Đổi dòng 237:
`<button type="button" id="btnEditAddRoll" class="btn btn-sm btn-light">+ Thêm cuộn</button>`
thành:
`<button type="button" id="btnEditAddRoll" class="btn btn-sm btn-light">+ Chọn cuộn từ kho</button>`

- [ ] **Step 3: Chạy test kiểm tra tiến độ**

Run: `node tests/test-manual-roll-selection-export.js`
Expected: Test 1 và Test 3 PASS, Test 2 FAIL (do `tole-xuat.js` chưa sửa).

- [ ] **Step 4: Commit**

```bash
git add assets/js/xg/xg-xuat.js pages/xg/xg-xuat.html
git commit -m "feat(xg-xuat): disable auto-fill warehouse rolls in export receipt"
```

---

### Task 3: Chỉnh sửa `tole-xuat.js`

**Files:**
- Modify: `assets/js/tole/tole-xuat.js:1564-1623`

**Interfaces:**
- Consumes: `headerInfo`, `itemsGrouped` in `populateExportReceiptFromSap`
- Produces: Item cards with empty `rolls: []` and toast prompting user to select rolls manually

- [ ] **Step 1: Chỉnh sửa `assets/js/tole/tole-xuat.js`**
Trong hàm `populateExportReceiptFromSap`:
Bỏ đoạn truy vấn tự động `tole-nhap` ở Bước 3.
Gọi `renderItemCards()` và highlight thẻ mặt hàng.
Cập nhật thông báo toast hướng dẫn bấm `+ Chọn cuộn từ kho`.

- [ ] **Step 2: Chạy test suite**

Run: `node tests/test-manual-roll-selection-export.js`
Expected: Tất cả 3 test PASS (3/3).

- [ ] **Step 3: Commit**

```bash
git add assets/js/tole/tole-xuat.js
git commit -m "feat(tole-xuat): disable auto-fill warehouse rolls in export receipt"
```

---

### Task 4: Đồng bộ build và kiểm thử toàn diện

**Files:**
- Run: `scripts/sync-dist.js`
- Test: `tests/test-manual-roll-selection-export.js`
- Test: `tests/test-manual-export-autofill.js`

- [ ] **Step 1: Chạy script đồng bộ phân phối**

Run: `node scripts/sync-dist.js`
Expected: Thông báo "Full synchronization completed successfully!" đồng bộ sang `dist/`, `dist-app/`, `public/`.

- [ ] **Step 2: Chạy lại toàn bộ test suites liên quan**

Run: `node tests/test-manual-roll-selection-export.js`
Run: `node tests/test-manual-export-autofill.js`
Expected: Cả 2 test runner đều PASS 100%.

- [ ] **Step 3: Commit và hoàn tất**

```bash
git add dist/ dist-app/ public/
git commit -m "build: sync dist and public files for manual roll selection in export receipt"
```
