# Tìm Kiếm Toàn Bộ Tồn Kho Trong Modal Chọn Cuộn (XG & Tole) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép ô tìm kiếm trong modal "Chọn cuộn vật tư từ Tồn Kho" tìm kiếm trên toàn bộ tồn kho khả dụng thay vì chỉ tìm trong lô/mã vật tư đã được lọc sẵn, hỗ trợ nút xóa lọc / xem tất cả kho, và tự động điền thông tin vào thẻ mặt hàng khi trống.

**Architecture:** Nâng cấp hàm `openInventoryModal` trong `xg-xuat.js` và `tole-xuat.js` để truy vấn toàn bộ dữ liệu cuộn tồn trong kho mà không giới hạn điều kiện SQL `ilike` theo mã/lô. Lưu dữ liệu vào `allInventoryData`, mặc định hiển thị ưu tiên theo mã/lô của thẻ mặt hàng. Khi người dùng nhập từ khóa vào ô tìm kiếm hoặc bấm nút "Xem tất cả kho", bảng sẽ tìm kiếm và hiển thị trên toàn bộ tồn kho. Khi người dùng chọn cuộn và bấm "Đồng ý", tự động bổ sung mã VT/tên VT/lô cho thẻ mặt hàng nếu trước đó chưa có. Đồng bộ UI và build qua `scripts/sync-dist.js`.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, Bootstrap 5, Supabase JS Client, Node.js (test runner).

## Global Constraints
- Không lọc cứng cơ sở dữ liệu theo `Mã vật tư` và `Batch` khi mở modal chọn cuộn từ kho.
- Khi ô tìm kiếm rỗng và chưa bấm xóa lọc: hiển thị danh sách lọc ưu tiên theo mã VT và batch của mặt hàng hiện tại.
- Khi ô tìm kiếm có từ khóa: tìm kiếm trên toàn bộ cuộn tồn kho (`allInventoryData`) ở các trường: `Mã vật tư`, `Tên vật tư`, `Batch`, `Cuộn ID`.
- Thêm nút "Xem tất cả kho" trên thanh tiêu đề cạnh thông tin bộ lọc (`#inventoryFilterInfo`).
- Khi bấm "Đồng ý" chọn cuộn, nếu thẻ mặt hàng đang rỗng `Mã vật tư`, `Tên vật tư` hoặc `Batch` thì tự động điền từ cuộn được chọn.
- Đồng bộ toàn bộ sang `dist/`, `dist-app/`, và `public/` qua `node scripts/sync-dist.js`.

---

### Task 1: Tạo bộ kiểm thử tự động cho tính năng tìm kiếm toàn bộ tồn kho

**Files:**
- Create: `tests/test-search-all-warehouse-rolls.js`

**Interfaces:**
- Consumes: `openInventoryModal`, `renderInventoryTable`, `inventorySearchInput` logic contract
- Produces: Test runner verifying that `xg-xuat.js` and `tole-xuat.js` load full inventory, search across all rolls, support clear filter button, and auto-populate empty item card fields.

- [ ] **Step 1: Viết test runner kiểm thử thất bại ban đầu**

```javascript
// tests/test-search-all-warehouse-rolls.js
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
  console.log('===================================================================');
  console.log(' KIỂM THỬ TÌM KIẾM TOÀN BỘ TỒN KHO TRONG MODAL CHỌN CUỘN (XG & TOLE)');
  console.log('===================================================================\n');

  // Test 1: Kiểm tra xg-xuat.js không còn ilike cứng theo maVatTu/batch khi truy vấn xg-nhap
  runTest('xg-xuat.js không query ilike cứng mã vật tư / batch khi lấy danh sách tồn kho', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(!content.includes("query = query.ilike('Mã vật tư', `%${maVatTu}%`);"), 'Vẫn còn query.ilike Mã vật tư trong openInventoryModal của xg-xuat.js');
    assert.ok(!content.includes("query = query.ilike('Batch', `%${batch}%`);"), 'Vẫn còn query.ilike Batch trong openInventoryModal của xg-xuat.js');
    assert.ok(content.includes('allInventoryData'), 'Chưa khai báo hoặc lưu trữ allInventoryData trong xg-xuat.js');
  });

  // Test 2: Kiểm tra xg-xuat.js hỗ trợ tìm kiếm trên toàn bộ kho và nút xóa lọc
  runTest('xg-xuat.js hỗ trợ tìm kiếm toàn bộ kho và nút xóa lọc / xem tất cả', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(content.includes('btnClearInventoryFilter') || content.includes('resetInventoryFilter'), 'Thiếu xử lý nút xóa bộ lọc tồn kho trong xg-xuat.js');
    assert.ok(content.includes('allInventoryData.filter'), 'Thiếu logic lọc trên allInventoryData khi tìm kiếm trong xg-xuat.js');
  });

  // Test 3: Kiểm tra xg-xuat.js tự động điền mã VT / tên VT / batch vào thẻ mặt hàng nếu đang trống
  runTest('xg-xuat.js tự động điền thông tin thẻ mặt hàng khi đang trống', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(content.includes('!item.maVatTu') && content.includes('item.maVatTu ='), 'Chưa có logic điền tự động maVatTu vào item trong xg-xuat.js');
  });

  // Test 4: Kiểm tra tole-xuat.js không còn ilike cứng theo maVatTu/batch khi truy vấn tole-nhap
  runTest('tole-xuat.js không query ilike cứng mã vật tư / batch khi lấy danh sách tồn kho', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(!content.includes("query = query.ilike('Mã vật tư', `%${maVatTu}%`);"), 'Vẫn còn query.ilike Mã vật tư trong openInventoryModal của tole-xuat.js');
    assert.ok(!content.includes("query = query.ilike('Batch', `%${batch}%`);"), 'Vẫn còn query.ilike Batch trong openInventoryModal của tole-xuat.js');
    assert.ok(content.includes('allInventoryData'), 'Chưa khai báo hoặc lưu trữ allInventoryData trong tole-xuat.js');
  });

  // Test 5: Kiểm tra tole-xuat.js hỗ trợ tìm kiếm trên toàn bộ kho và nút xóa lọc
  runTest('tole-xuat.js hỗ trợ tìm kiếm toàn bộ kho và nút xóa lọc / xem tất cả', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(content.includes('btnClearInventoryFilter') || content.includes('resetInventoryFilter'), 'Thiếu xử lý nút xóa bộ lọc tồn kho trong tole-xuat.js');
    assert.ok(content.includes('allInventoryData.filter'), 'Thiếu logic lọc trên allInventoryData khi tìm kiếm trong tole-xuat.js');
  });

  // Test 6: Kiểm tra tole-xuat.js tự động điền mã VT / tên VT / batch vào thẻ mặt hàng nếu đang trống
  runTest('tole-xuat.js tự động điền thông tin thẻ mặt hàng khi đang trống', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(content.includes('!item.maVatTu') && content.includes('item.maVatTu ='), 'Chưa có logic điền tự động maVatTu vào item trong tole-xuat.js');
  });

  console.log('\n-------------------------------------------------------------------');
  console.log(` KẾT QUẢ: ${passedTests}/${totalTests} BÀI TEST THÀNH CÔNG`);
  console.log('-------------------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `node tests/test-search-all-warehouse-rolls.js`
Expected: FAIL 0/6 tests.

- [ ] **Step 3: Commit file test**

```bash
git add tests/test-search-all-warehouse-rolls.js
git commit -m "test: add test suite for searching all warehouse rolls in export receipt"
```

---

### Task 2: Cập nhật `xg-xuat.js` và `xg-xuat.html`

**Files:**
- Modify: `assets/js/xg/xg-xuat.js:1936-2385`
- Modify: `pages/xg/xg-xuat.html:314-325`

**Interfaces:**
- Consumes: Supabase `xg-nhap`, `xg-xuat`
- Produces: `allInventoryData`, `openInventoryModal`, dynamic search across all rolls, filter clear button, auto-filling empty card fields on confirmation.

- [ ] **Step 1: Cập nhật `openInventoryModal`, `renderInventoryTable`, `inventorySearchInput` và `btnConfirmInventorySelection` trong `assets/js/xg/xg-xuat.js`**
  - Khai báo biến module `let allInventoryData = [];` và `let isInventoryFilterCleared = false;`.
  - Trong `openInventoryModal`:
    - Bỏ các dòng `.ilike('Mã vật tư', ...)` và `.ilike('Batch', ...)`.
    - Tải toàn bộ cuộn tồn kho và lưu vào `allInventoryData`.
    - Thiết lập hàm cập nhật tiêu đề bộ lọc `renderInventoryFilterInfo()` kèm nút `<button id="btnClearInventoryFilter" class="btn btn-sm btn-outline-light ms-2 py-0 px-2 rounded-pill" style="font-size: 0.75rem;"><i class="bi bi-x-circle me-1"></i>Xem tất cả kho</button>`.
    - Khi hiển thị ban đầu: nếu `maVatTu` hoặc `batch` có giá trị và chưa xóa lọc thì lọc từ `allInventoryData` để hiển thị trong `cachedInventoryData`.
  - Trong sự kiện click nút `#btnClearInventoryFilter`:
    - Đặt `isInventoryFilterCleared = true`.
    - Cập nhật tiêu đề sang "Đang hiển thị toàn bộ tồn kho".
    - Render toàn bộ `allInventoryData`.
  - Trong sự kiện input `#inventorySearchInput`:
    - Nếu ô tìm kiếm có giá trị: Lọc trên `allInventoryData` (tìm kiếm không dấu / có dấu trên Mã VT, Tên VT, Batch, Cuộn ID).
    - Nếu ô tìm kiếm rỗng: nếu `isInventoryFilterCleared` thì render toàn bộ `allInventoryData`, ngược lại lọc theo `maVatTu` / `batch` ban đầu.
  - Trong `btnConfirmInventorySelection`:
    - Nếu thẻ mặt hàng đang rỗng `maVatTu`, `tenVatTu` hoặc `batch`, tự động điền từ cuộn được chọn đầu tiên:
      ```javascript
      if (!item.maVatTu && firstRollData['Mã vật tư']) item.maVatTu = firstRollData['Mã vật tư'];
      if (!item.tenVatTu && firstRollData['Tên vật tư']) item.tenVatTu = firstRollData['Tên vật tư'];
      if (!item.batch && firstRollData['Batch']) item.batch = firstRollData['Batch'];
      ```

- [ ] **Step 2: Cập nhật `pages/xg/xg-xuat.html`**
  - Đảm bảo header modal `#inventoryRollsModal` có cấu trúc hiển thị thông tin lọc và nút bấm gọn gàng, rõ nét.

- [ ] **Step 3: Chạy test runner kiểm tra tiến độ**

Run: `node tests/test-search-all-warehouse-rolls.js`
Expected: 3/6 tests PASS (Test 1, 2, 3 PASS; Test 4, 5, 6 FAIL).

- [ ] **Step 4: Commit**

```bash
git add assets/js/xg/xg-xuat.js pages/xg/xg-xuat.html
git commit -m "feat(xg-xuat): enable searching all warehouse rolls and clearing filters in inventory modal"
```

---

### Task 3: Cập nhật `tole-xuat.js` và `tole-xuat.html`

**Files:**
- Modify: `assets/js/tole/tole-xuat.js:1941-2390`
- Modify: `pages/tole/tole-xuat.html:316-327`

**Interfaces:**
- Consumes: Supabase `tole-nhap`, `tole-xuat`
- Produces: `allInventoryData`, `openInventoryModal`, dynamic search across all rolls, filter clear button, auto-filling empty card fields on confirmation.

- [ ] **Step 1: Cập nhật `openInventoryModal`, `renderInventoryTable`, `inventorySearchInput` và `btnConfirmInventorySelection` trong `assets/js/tole/tole-xuat.js`**
  - Khai báo biến module `let allInventoryData = [];` và `let isInventoryFilterCleared = false;`.
  - Trong `openInventoryModal`:
    - Bỏ các dòng `.ilike('Mã vật tư', ...)` và `.ilike('Batch', ...)`.
    - Tải toàn bộ cuộn tồn kho và lưu vào `allInventoryData`.
    - Thiết lập hàm cập nhật tiêu đề bộ lọc `renderInventoryFilterInfo()` kèm nút `#btnClearInventoryFilter`.
    - Khi hiển thị ban đầu: nếu `maVatTu` hoặc `batch` có giá trị và chưa xóa lọc thì lọc từ `allInventoryData` để hiển thị trong `cachedInventoryData`.
  - Trong sự kiện click nút `#btnClearInventoryFilter`:
    - Đặt `isInventoryFilterCleared = true`.
    - Cập nhật tiêu đề sang "Đang hiển thị toàn bộ tồn kho".
    - Render toàn bộ `allInventoryData`.
  - Trong sự kiện input `#inventorySearchInput`:
    - Nếu ô tìm kiếm có giá trị: Lọc trên `allInventoryData` (tìm kiếm trên Mã VT, Tên VT, Batch, Cuộn ID).
    - Nếu ô tìm kiếm rỗng: nếu `isInventoryFilterCleared` thì render toàn bộ `allInventoryData`, ngược lại lọc theo `maVatTu` / `batch` ban đầu.
  - Trong `btnConfirmInventorySelection`:
    - Nếu thẻ mặt hàng đang rỗng `maVatTu`, `tenVatTu` hoặc `batch`, tự động điền từ cuộn được chọn đầu tiên.

- [ ] **Step 2: Cập nhật `pages/tole/tole-xuat.html`**
  - Đảm bảo header modal `#inventoryRollsModal` có cấu trúc hiển thị thông tin lọc và nút bấm gọn gàng, rõ nét.

- [ ] **Step 3: Chạy test runner kiểm tra toàn bộ**

Run: `node tests/test-search-all-warehouse-rolls.js`
Expected: Tất cả 6/6 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add assets/js/tole/tole-xuat.js pages/tole/tole-xuat.html
git commit -m "feat(tole-xuat): enable searching all warehouse rolls and clearing filters in inventory modal"
```

---

### Task 4: Kiểm thử hồi quy, đồng bộ bản phân phối và hoàn tất

**Files:**
- Run: `scripts/sync-dist.js`
- Test: `tests/test-search-all-warehouse-rolls.js`
- Test: `tests/test-manual-roll-selection-export.js`
- Test: `tests/test-manual-export-autofill.js`

- [ ] **Step 1: Đồng bộ hóa toàn bộ sang `dist/`, `dist-app/`, `public/`**

Run: `node scripts/sync-dist.js`
Expected: `✅ [Sync Script] Full synchronization completed successfully!`

- [ ] **Step 2: Chạy lại toàn bộ test suite để đảm bảo không bị lỗi hồi quy**

Run: `node tests/test-search-all-warehouse-rolls.js`
Run: `node tests/test-manual-roll-selection-export.js`
Run: `node tests/test-manual-export-autofill.js`
Expected: Toàn bộ bài test đều PASS 100%.

- [ ] **Step 3: Commit hoàn tất**

```bash
git add dist/ dist-app/ public/
git commit -m "build: sync dist and public files for searching all warehouse rolls"
```
