# Kế Hoạch Triển Khai: Ngăn Chặn Xuất Kho Không Khớp Phiếu SAP MB51 (Xà Gồ & Tole)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) hoặc superpowers:executing-plans để thực thi kế hoạch này theo từng task. Mỗi bước sử dụng checkbox (`- [ ]`) để theo dõi.

**Goal:** Ngăn chặn tuyệt đối việc xuất kho trên `xg-xuat.html` và `tole-xuat.html` nếu các cuộn chọn từ tồn kho không đúng Mã vật tư, Lô (Batch) hoặc không khớp 100% khối lượng (Kg) với phiếu xuất trong SAP MB51.

**Architecture:** 
- Xây dựng module xác thực trung tâm trong `xg-sap-lookup.js` (`validateExportReceiptAgainstMb51` & `showExportReceiptMismatchModal`).
- Tích hợp ràng buộc 2 lớp vào `xg-xuat.js` và `tole-xuat.js`:
  1. Lớp 1 (Modal tồn kho): Khóa và vô hiệu hóa các cuộn sai Mã VT / Batch.
  2. Lớp 2 (Giao diện): Hiển thị đối chiếu khối lượng thời gian thực trên từng thẻ mặt hàng và thanh tổng toàn phiếu.
  3. Lớp 3 (Submit Form): Chặn cứng trước khi gọi RPC xuất kho, hiển thị modal cảnh báo chi tiết nếu sai lệch.
- Cập nhật số phiên bản script trên `xg-xuat.html` và `tole-xuat.html`, sau đó chạy `node scripts/sync-dist.js` đồng bộ toàn bộ phân phối.

**Tech Stack:** JavaScript (ES6+), Supabase Client JS, Bootstrap 5, Node.js (test runner).

## Global Constraints
- Bắt buộc phiếu xuất phải tồn tại trong bảng `xg_sap_mb51` với chiều xuất `H` (Credit) và phân hệ tương ứng.
- Bắt buộc cuộn xuất phải khớp chính xác cả Mã vật tư và Batch của thẻ mặt hàng.
- Bắt buộc tổng khối lượng của các cuộn chọn cho từng mặt hàng phải khớp 100% với số lượng MB51 (sai số tuyệt đối cho phép $|diff| < 0.05\text{ kg}$). Lệnh dư hoặc lệch thiếu đều bị chặn.
- Sau khi chỉnh sửa phải chạy `node scripts/sync-dist.js` để đồng bộ sang `dist/`, `dist-app/`, `public/`.

---

### Task 1: Module Xác Thực Phiếu Xuất MB51 & Modal Cảnh Báo (`xg-sap-lookup.js`)

**Files:**
- Modify: `assets/js/xg/xg-sap-lookup.js`
- Test: `tests/test-validate-export-receipt-mb51.js`

**Interfaces:**
- Produces:
  - `window.XgSapLookup.validateExportReceiptAgainstMb51(docNo, multiItemsData, pageContext)` -> Promise<{ isValid: boolean, docNo: string, notFoundInSap?: boolean, errors: Array<{ itemIdx: number, maVatTu: string, tenVatTu: string, batch: string, sapKg: number, actualKg: number, diff: number, reason: string }>, sapSummary: { totalSapKg: number, totalActualKg: number, totalDiff: number } }>
  - `window.XgSapLookup.showExportReceiptMismatchModal(validationResult, pageContext, onSyncCallback)` -> void

- [ ] **Step 1: Viết test suite kiểm thử hàm xác thực**

Tạo file `tests/test-validate-export-receipt-mb51.js`:
```javascript
const assert = require('assert');

// Mock dữ liệu kiểm thử
const mockMb51Rows = [
  {
    material_document: 'PX_TEST_01',
    material: '10001189',
    material_description: 'Thép xà gồ Z275 G450',
    batch: '1.8X351VN',
    quantity: -5000,
    debit_credit_ind: 'H',
    material_group: '10040-Phôi xà gồ mạ'
  },
  {
    material_document: 'PX_TEST_01',
    material: '10001190',
    material_description: 'Thép xà gồ Z275 G350',
    batch: '2.0X351VN',
    quantity: -3000,
    debit_credit_ind: 'H',
    material_group: '10040-Phôi xà gồ mạ'
  }
];

// Logic validator thuần để test
function validateExportReceiptData(docNo, multiItemsData, mb51Rows) {
  if (!docNo || !String(docNo).trim()) {
    return { isValid: false, message: 'Vui lòng nhập số phiếu xuất' };
  }
  const cleanDoc = String(docNo).trim().toLowerCase();
  const docRows = mb51Rows.filter(r => String(r.material_document || '').toLowerCase() === cleanDoc);
  if (docRows.length === 0) {
    return { isValid: false, notFoundInSap: true, message: `Phiếu xuất ${docNo} chưa có trong dữ liệu SAP MB51` };
  }

  const sapMap = new Map();
  docRows.forEach(r => {
    const mat = String(r.material || '').trim();
    const batch = String(r.batch || '').trim();
    const key = `${mat}__${batch}`.toLowerCase();
    const qty = Math.abs(parseFloat(r.quantity) || 0);
    if (!sapMap.has(key)) {
      sapMap.set(key, { material: mat, description: r.material_description, batch, totalSapKg: qty });
    } else {
      sapMap.get(key).totalSapKg += qty;
    }
  });

  const errors = [];
  let totalSapKg = 0;
  let totalActualKg = 0;

  sapMap.forEach(item => { totalSapKg += item.totalSapKg; });

  (multiItemsData || []).forEach((item, idx) => {
    const mat = String(item.maVatTu || '').trim();
    const batch = String(item.batch || '').trim();
    const key = `${mat}__${batch}`.toLowerCase();
    const sapItem = sapMap.get(key);

    const rolls = item.rolls || [];
    let itemKg = 0;
    rolls.forEach(r => {
      const parsed = parseFloat(r.kg) || 0;
      itemKg += parsed;
      if (r.maVatTu && String(r.maVatTu).trim().toLowerCase() !== mat.toLowerCase()) {
        errors.push({ itemIdx: idx + 1, reason: `Cuộn ${r.cuonId} sai Mã VT (${r.maVatTu} khác ${mat})` });
      }
      if (r.batch && String(r.batch).trim().toLowerCase() !== batch.toLowerCase()) {
        errors.push({ itemIdx: idx + 1, reason: `Cuộn ${r.cuonId} sai Batch (${r.batch} khác ${batch})` });
      }
    });

    totalActualKg += itemKg;

    if (!sapItem) {
      errors.push({ itemIdx: idx + 1, reason: `Mặt hàng ${mat} (Lô: ${batch}) không thuộc phiếu xuất MB51` });
      return;
    }

    if (rolls.length === 0 || itemKg === 0) {
      errors.push({ itemIdx: idx + 1, maVatTu: mat, batch, sapKg: sapItem.totalSapKg, actualKg: 0, diff: -sapItem.totalSapKg, reason: 'Chưa chọn cuộn từ kho' });
      return;
    }

    const diff = Math.round((itemKg - sapItem.totalSapKg) * 100) / 100;
    if (Math.abs(diff) >= 0.05) {
      errors.push({ itemIdx: idx + 1, maVatTu: mat, batch, sapKg: sapItem.totalSapKg, actualKg: itemKg, diff, reason: diff > 0 ? `Lệch dư (+${diff} kg)` : `Lệch thiếu (${diff} kg)` });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    sapSummary: {
      totalSapKg,
      totalActualKg,
      totalDiff: Math.round((totalActualKg - totalSapKg) * 100) / 100
    }
  };
}

// Case 1: Phiếu không tồn tại
const r1 = validateExportReceiptData('PX_NOT_FOUND', [], mockMb51Rows);
assert.strictEqual(r1.isValid, false);
assert.strictEqual(r1.notFoundInSap, true);

// Case 2: Chưa chọn cuộn
const r2 = validateExportReceiptData('PX_TEST_01', [
  { maVatTu: '10001189', batch: '1.8X351VN', rolls: [] }
], mockMb51Rows);
assert.strictEqual(r2.isValid, false);
assert.strictEqual(r2.errors.length, 1);

// Case 3: Lệch số kg (Thiếu)
const r3 = validateExportReceiptData('PX_TEST_01', [
  { maVatTu: '10001189', batch: '1.8X351VN', rolls: [{ cuonId: 'C1', kg: '4000' }] }
], mockMb51Rows);
assert.strictEqual(r3.isValid, false);
assert.strictEqual(r3.errors[0].diff, -1000);

// Case 4: Khớp 100%
const r4 = validateExportReceiptData('PX_TEST_01', [
  { maVatTu: '10001189', batch: '1.8X351VN', rolls: [{ cuonId: 'C1', kg: '2500' }, { cuonId: 'C2', kg: '2500' }] },
  { maVatTu: '10001190', batch: '2.0X351VN', rolls: [{ cuonId: 'C3', kg: '3000' }] }
], mockMb51Rows);
assert.strictEqual(r4.isValid, true);
assert.strictEqual(r4.errors.length, 0);

console.log('✓ All 4 validation unit tests passed!');
```

- [ ] **Step 2: Chạy test kiểm tra**

Chạy: `node tests/test-validate-export-receipt-mb51.js`
Kỳ vọng: In ra `✓ All 4 validation unit tests passed!`

- [ ] **Step 3: Cài đặt `validateExportReceiptAgainstMb51` & `showExportReceiptMismatchModal` trong `assets/js/xg/xg-sap-lookup.js`**

Thêm các hàm vào `assets/js/xg/xg-sap-lookup.js` và expose lên `window.XgSapLookup`.

- [ ] **Step 4: Commit Task 1**

```bash
git add tests/test-validate-export-receipt-mb51.js assets/js/xg/xg-sap-lookup.js
git commit -m "feat(sap-lookup): add export receipt mb51 validator and mismatch modal"
```

---

### Task 2: Ràng Buộc & Khóa Cuộn Ngay Tại Modal Chọn Tồn Kho (`xg-xuat.js` & `tole-xuat.js`)

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`
- Modify: `assets/js/tole/tole-xuat.js`

**Interfaces:**
- Consumes:
  - `openInventoryModal(target, maVatTu, batch, itemIndex)`
  - `renderInventoryTable(data, searchVal)`
  - `btnConfirmInventorySelection` event handler

- [ ] **Step 1: Cập nhật `openInventoryModal` trong `xg-xuat.js`**
  - Lưu biến `lockedMaVatTu = maVatTu`, `lockedBatch = batch`.
  - Cập nhật hiển thị tiêu đề modal: `Đang lọc theo phiếu MB51: Mã VT: ... | Lô (Batch): ... (Bắt buộc khớp)`.

- [ ] **Step 2: Cập nhật `renderInventoryTable` trong `xg-xuat.js`**
  - Duyệt các dòng tồn kho: Nếu có `lockedMaVatTu` hoặc `lockedBatch`:
    - Nếu cuộn có `Mã vật tư != lockedMaVatTu` hoặc `Batch != lockedBatch`:
      - Đặt `cb.disabled = true`.
      - Cột trạng thái hiển thị: `<span class="badge bg-secondary">Không khớp mặt hàng</span>`.

- [ ] **Step 3: Cập nhật `btnConfirmInventorySelection` trong `xg-xuat.js`**
  - Kiểm tra các checkbox được chọn: Nếu bất kỳ cuộn nào sai Mã VT / Batch: Báo `alert` và từ chối thêm.

- [ ] **Step 4: Thực hiện tương tự cho `assets/js/tole/tole-xuat.js`**
  - Áp dụng các cập nhật tương ứng vào `tole-xuat.js`.

- [ ] **Step 5: Commit Task 2**

```bash
git add assets/js/xg/xg-xuat.js assets/js/tole/tole-xuat.js
git commit -m "feat(xuat): lock inventory rolls selection strictly to mb51 item and batch"
```

---

### Task 3: Hiển Thị Đối Chiếu SAP MB51 Thời Gian Thực Trên Thẻ Mặt Hàng

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`
- Modify: `assets/js/tole/tole-xuat.js`

**Interfaces:**
- `generateItemCardHTML(item, index, totalItems)`: render thanh đối chiếu MB51
- `updateMultiItemTotals()`: cập nhật khối lượng, badge trạng thái của từng thẻ và toàn phiếu

- [ ] **Step 1: Cập nhật `generateItemCardHTML` trong `xg-xuat.js`**
  - Tạo thanh hiển thị: Số kg MB51 yêu cầu (`item.sapKg`), Số kg thực xuất (`totalItemKg`), Badge trạng thái (Chưa chọn cuộn / Khớp 100% / Lệch thiếu / Lệch dư).

- [ ] **Step 2: Cập nhật `updateMultiItemTotals` trong `xg-xuat.js`**
  - Tính toán chênh lệch từng mặt hàng và cập nhật badge theo thời gian thực mỗi khi thêm/xóa/đổi số kg cuộn.
  - Cập nhật tổng khối lượng toàn phiếu MB51 và badge khớp toàn phiếu trên `#globalTotals`.

- [ ] **Step 3: Đồng bộ cho `assets/js/tole/tole-xuat.js`**
  - Áp dụng các cập nhật tương tự vào `tole-xuat.js`.

- [ ] **Step 4: Commit Task 3**

```bash
git add assets/js/xg/xg-xuat.js assets/js/tole/tole-xuat.js
git commit -m "feat(xuat): add real-time mb51 reconciliation display to item cards"
```

---

### Task 4: Chặn Cứng Tại Sự Kiện Submit Form Xuất Kho (`addDataForm` & `editDataForm`)

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`
- Modify: `assets/js/tole/tole-xuat.js`
- Modify: `pages/xg/xg-xuat.html`
- Modify: `pages/tole/tole-xuat.html`

**Interfaces:**
- Consumes:
  - `window.XgSapLookup.validateExportReceiptAgainstMb51`
  - `window.XgSapLookup.showExportReceiptMismatchModal`

- [ ] **Step 1: Tích hợp kiểm tra chặn trong sự kiện submit `addDataForm` của `xg-xuat.js`**
  - Lấy số phiếu xuất `col_3`.
  - Gọi `validateExportReceiptAgainstMb51(phieuXuat, multiItemsData, 'xg-xuat')`.
  - Nếu `!checkResult.isValid`:
    - Dừng tiến trình, trả lại nút submit, ẩn loading overlay.
    - Gọi `showExportReceiptMismatchModal(checkResult, 'xg-xuat', syncCallback)`.
    - `return;`.

- [ ] **Step 2: Tích hợp kiểm tra chặn trong sự kiện submit `editDataForm` của `xg-xuat.js`**
  - Lấy số phiếu xuất, Mã VT, Batch và số kg đang sửa.
  - Đối chiếu với dòng tương ứng trong MB51.
  - Nếu chưa khớp 100%: Dừng cập nhật và hiển thị modal cảnh báo.

- [ ] **Step 3: Đồng bộ logic submit cho `assets/js/tole/tole-xuat.js`**
  - Áp dụng kiểm tra chặn hoàn toàn tương tự cho `tole-xuat.js`.

- [ ] **Step 4: Nâng phiên bản cache script trên `xg-xuat.html` và `tole-xuat.html`**
  - Đổi query version của `xg-sap-lookup.js`, `xg-xuat.js`, `tole-xuat.js` lên `?v=2.0.8`.

- [ ] **Step 5: Commit Task 4**

```bash
git add assets/js/xg/xg-xuat.js assets/js/tole/tole-xuat.js pages/xg/xg-xuat.html pages/tole/tole-xuat.html
git commit -m "feat(xuat): enforce mb51 export validation hard-gate on form submit"
```

---

### Task 5: Đồng Bộ Phân Phối & Kiểm Thử Toàn Diện

**Files:**
- Run: `node scripts/sync-dist.js`

- [ ] **Step 1: Chạy script đồng bộ phân phối**
  - Lệnh: `node scripts/sync-dist.js`
  - Xác nhận: Toàn bộ file đã được đồng bộ tự động sang `dist/`, `dist-app/`, `public/`.

- [ ] **Step 2: Chạy kiểm thử tự động toàn diện**
  - Chạy lại các file test trong `tests/` để đảm bảo không bị lỗi hồi quy.

- [ ] **Step 3: Commit Task 5**

```bash
git add dist/ dist-app/ public/
git commit -m "chore: sync distribution files for mb51 export validation"
```
