# Kế Hoạch Triển Khai: Khóa Mặt Hàng Đã Xuất Khi Quét Phiếu Xuất Kho

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi quét ảnh phiếu xuất kho (OCR) trên `xg-xuat.html` và `tole-xuat.html`, tự động đối soát với cơ sở dữ liệu để khóa các mặt hàng đã xuất trước đó (hiển thị badge khóa, vô hiệu hóa chọn cuộn), và chặn hoàn toàn nếu toàn bộ phiếu đã được xuất hết.

**Architecture:** Bổ sung bước kiểm tra trạng thái từng mặt hàng qua `window.XgSapLookup.checkReceiptItemProcessed()` ngay trong `handleReceiptImageProcess()` của `xg-xuat.js` và `tole-xuat.js`. Gán cờ `isLocked: true` và `lockInfo` vào đối tượng mặt hàng trong `multiItemsData`. Cập nhật `generateItemCardHTML()` để render badge `🔒 ĐÃ XUẤT - KHÓA`, khóa các ô input và vô hiệu hóa nút `+ Chọn cuộn từ kho`. Cập nhật sự kiện submit form để bỏ qua các mục đã khóa và chặn submit nếu không có mục nào hợp lệ.

**Tech Stack:** Vanilla JavaScript (ES6+), Supabase JS Client, Bootstrap 5 Modals/Badges, Node.js Test Runner.

## Global Constraints

- Áp dụng đồng bộ cho cả hai phân hệ: Kho Xà Gồ (`xg-xuat`) và Kho Tole (`tole-xuat`).
- Sử dụng hàm tra cứu chuẩn `window.XgSapLookup.checkReceiptItemProcessed(docNo, maVatTu, batch, pageContext)`.
- Nếu TẤT CẢ các mặt hàng đều đã xuất: Bật Modal `window.XgSapLookup.showReceiptProcessedWarningModal()` và dừng điền form.
- Nếu có MỘT SỐ mặt hàng chưa xuất: Điền form bình thường, gắn badge khóa và disable nút chọn cuộn ở các thẻ đã xuất, giữ nguyên thẻ chưa xuất.
- Khi submit form: Chỉ xuất các cuộn thuộc mặt hàng chưa bị khóa (`!item.isLocked`).
- Sau khi hoàn thành: Chạy `npm run build` (`node scripts/sync-dist.js`) để đồng bộ code sang `dist/`, `dist-app/`, `public/`.

---

### Task 1: Tạo Bộ Kiểm Thử Tự Động (Test Suite)

**Files:**
- Create: `tests/test-scan-export-receipt-lock.js`

**Interfaces:**
- Consumes: `checkReceiptItemProcessed` từ `assets/js/xg/xg-sap-lookup.js` hoặc mock logic tương đương
- Produces: Test runner kịch bản kiểm tra trạng thái khóa khi quét phiếu xuất

- [ ] **Step 1: Viết test suite cho logic kiểm tra khóa mặt hàng khi quét phiếu xuất**

Tạo file `tests/test-scan-export-receipt-lock.js`:

```javascript
const assert = require('assert');

// Giả lập logic kiểm tra từng mặt hàng khi quét OCR
async function evaluateScannedItemsLockState(docNo, items, checkFn, context) {
  if (!docNo || !Array.isArray(items) || items.length === 0) {
    return { allLocked: false, lockedCount: 0, unlockedCount: 0, itemsWithState: [] };
  }

  const checks = await Promise.all(items.map(async item => {
    return await checkFn(docNo, item.maVatTu, item.batch, context);
  }));

  let lockedCount = 0;
  const itemsWithState = items.map((item, idx) => {
    const res = checks[idx] || { isProcessed: false };
    const isLocked = Boolean(res.isProcessed);
    if (isLocked) lockedCount++;
    return {
      ...item,
      isLocked,
      lockInfo: isLocked ? res : null
    };
  });

  const allLocked = items.length > 0 && lockedCount === items.length;
  const unlockedCount = items.length - lockedCount;

  return {
    allLocked,
    lockedCount,
    unlockedCount,
    itemsWithState
  };
}

// Chạy test cases
async function runTests() {
  console.log('🧪 Bắt đầu kiểm thử logic khóa mặt hàng khi quét phiếu xuất...');

  // Mock database
  const exportedDatabase = [
    { 'Phiếu xuất': 'PX001', 'Mã vật tư': '10001189', 'Batch': '1.8X351VN', 'Số lượng (Kg)': 2500 },
    { 'Phiếu xuất': 'PX002', 'Mã vật tư': '10002222', 'Batch': '2.0X400VN', 'Số lượng (Kg)': 1800 }
  ];

  const mockCheckItemFn = async (doc, mat, batch, ctx) => {
    const match = exportedDatabase.find(r => 
      r['Phiếu xuất'].toLowerCase() === doc.toLowerCase() &&
      r['Mã vật tư'].toLowerCase() === mat.toLowerCase() &&
      r['Batch'].toLowerCase() === batch.toLowerCase()
    );
    if (match) {
      return { isProcessed: true, totalKg: match['Số lượng (Kg)'], count: 1 };
    }
    return { isProcessed: false, totalKg: 0, count: 0 };
  };

  // Case 1: Phiếu xuất mới hoàn toàn (chưa xuất mục nào)
  const case1 = await evaluateScannedItemsLockState(
    'PX999',
    [{ maVatTu: '10001189', batch: '1.8X351VN' }],
    mockCheckItemFn,
    'xg-xuat'
  );
  assert.strictEqual(case1.allLocked, false, 'Case 1: Không được khóa phiếu mới');
  assert.strictEqual(case1.lockedCount, 0, 'Case 1: Số mục khóa phải là 0');
  assert.strictEqual(case1.itemsWithState[0].isLocked, false);
  console.log('✓ Case 1 Pass: Phiếu xuất mới không bị khóa');

  // Case 2: Phiếu xuất đã xuất toàn bộ 100%
  const case2 = await evaluateScannedItemsLockState(
    'PX001',
    [{ maVatTu: '10001189', batch: '1.8X351VN' }],
    mockCheckItemFn,
    'xg-xuat'
  );
  assert.strictEqual(case2.allLocked, true, 'Case 2: Phải nhận diện allLocked = true');
  assert.strictEqual(case2.lockedCount, 1, 'Case 2: Số mục khóa phải là 1');
  assert.strictEqual(case2.itemsWithState[0].isLocked, true);
  console.log('✓ Case 2 Pass: Phiếu xuất đã xuất toàn bộ kích hoạt allLocked');

  // Case 3: Phiếu có 2 mặt hàng (1 đã xuất, 1 chưa xuất)
  const case3 = await evaluateScannedItemsLockState(
    'PX001',
    [
      { maVatTu: '10001189', batch: '1.8X351VN' }, // Đã xuất
      { maVatTu: '10009999', batch: '3.0X500VN' }  // Chưa xuất
    ],
    mockCheckItemFn,
    'xg-xuat'
  );
  assert.strictEqual(case3.allLocked, false, 'Case 3: allLocked phải là false');
  assert.strictEqual(case3.lockedCount, 1, 'Case 3: Số mục khóa là 1');
  assert.strictEqual(case3.unlockedCount, 1, 'Case 3: Số mục chưa khóa là 1');
  assert.strictEqual(case3.itemsWithState[0].isLocked, true, 'Case 3: Mục 1 phải bị khóa');
  assert.strictEqual(case3.itemsWithState[1].isLocked, false, 'Case 3: Mục 2 phải mở');
  console.log('✓ Case 3 Pass: Phiếu xuất một phần khóa chính xác từng mục');

  console.log('🎉 Toàn bộ test cases passed!');
}

runTests().catch(err => {
  console.error('❌ Test thất bại:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Chạy kiểm thử để xác minh logic**

Run: `node tests/test-scan-export-receipt-lock.js`  
Expected: In ra `🎉 Toàn bộ test cases passed!`

- [ ] **Step 3: Commit Task 1**

```bash
git add tests/test-scan-export-receipt-lock.js
git commit -m "test(ocr): add automated tests for item-level export receipt locking"
```

---

### Task 2: Triển Khai Khóa Mặt Hàng Trên XG-XUAT (`assets/js/xg/xg-xuat.js`)

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`

**Interfaces:**
- Consumes: `window.XgSapLookup.checkReceiptItemProcessed`, `window.XgSapLookup.showReceiptProcessedWarningModal`
- Modifies: `handleReceiptImageProcess`, `populateFieldsFromOcr`, `generateItemCardHTML`, `renderItemCards`, submit `addDataForm`

- [ ] **Step 1: Cập nhật `handleReceiptImageProcess` trong `assets/js/xg/xg-xuat.js`**

Trong `handleReceiptImageProcess(file, label)`:
Ngay sau khi OCR trích xuất thành công và vượt qua kiểm tra phân loại kho, bổ sung logic kiểm tra đối soát từng mặt hàng:

```javascript
    // Kiểm tra trạng thái xuất kho của các mặt hàng trong phiếu xuất
    const scannedDocNo = String(result.data.phieuXuat || '').trim();
    let scannedItems = Array.isArray(result.data.items) && result.data.items.length > 0
      ? result.data.items
      : [{ maVatTu: result.data.maVatTu || '', tenVatTu: result.data.tenVatTu || '', batch: result.data.batch || '' }];

    if (scannedDocNo && window.XgSapLookup && typeof window.XgSapLookup.checkReceiptItemProcessed === 'function') {
      const lockChecks = await Promise.all(scannedItems.map(async it => {
        const mat = String(it.maVatTu || '').trim();
        const batch = String(it.batch || '').trim();
        return await window.XgSapLookup.checkReceiptItemProcessed(scannedDocNo, mat, batch, 'xg-xuat');
      }));

      let lockedCount = 0;
      scannedItems = scannedItems.map((it, idx) => {
        const checkRes = lockChecks[idx];
        const isLocked = Boolean(checkRes && checkRes.isProcessed);
        if (isLocked) lockedCount++;
        return {
          ...it,
          isLocked,
          lockInfo: isLocked ? checkRes : null
        };
      });

      result.data.items = scannedItems;

      // Nếu TẤT CẢ các mặt hàng đều đã xuất -> Bật modal chặn hoàn toàn
      if (scannedItems.length > 0 && lockedCount === scannedItems.length) {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        const wholeProc = await window.XgSapLookup.checkReceiptProcessed(scannedDocNo, 'xg-xuat');
        window.XgSapLookup.showReceiptProcessedWarningModal({
          docNo: scannedDocNo,
          pageContext: 'xg-xuat',
          processedInfo: wholeProc,
          sapRecord: window._currentSelectedSapRecord,
          onCancel: () => {
            resetOcrDropzoneUI();
          }
        });
        return;
      }

      // Nếu có một số mặt hàng đã xuất và một số chưa xuất -> Hiển thị toast cảnh báo
      if (lockedCount > 0) {
        if (window.XgSapLookup && window.XgSapLookup.showAutofillToast) {
          window.XgSapLookup.showAutofillToast(`⚠️ Phát hiện ${lockedCount}/${scannedItems.length} mặt hàng đã xuất kho trước đó (đã khóa). Vui lòng chọn cuộn cho ${scannedItems.length - lockedCount} mặt hàng còn lại.`);
        }
      }
    }
```

- [ ] **Step 2: Cập nhật `populateFieldsFromOcr` để bảo lưu `isLocked` và `lockInfo`**

Trong `populateFieldsFromOcr(data)`:
Khi tạo `multiItemsData`, giữ nguyên các trường `isLocked` và `lockInfo`:

```javascript
  if (Array.isArray(data.items) && data.items.length > 0) {
    multiItemsData = data.items.map(it => {
      const rawBatch = (it.batch || '').trim();
      const rawTen = (it.tenVatTu || '').trim();
      return {
        id: Math.random().toString(36).slice(2),
        maVatTu: it.maVatTu || '',
        tenVatTu: rawTen,
        batch: rawBatch,
        rolls: [],
        isLocked: Boolean(it.isLocked),
        lockInfo: it.lockInfo || null
      };
    });
  }
```

- [ ] **Step 3: Cập nhật `generateItemCardHTML` và `renderItemCards` hiển thị trạng thái khóa**

1. Trong `generateItemCardHTML(item, index, totalItems)`:
   - Nếu `item.isLocked`:
     - Badge tiêu đề: `<span class="badge bg-danger text-white border border-danger-subtle me-1"><i class="bi bi-shield-lock-fill me-1"></i>ĐÃ XUẤT (${item.lockInfo?.totalKg ? formatNumericValue(item.lockInfo.totalKg) : '0'} kg) - KHÓA</span>`
     - Thêm class CSS hoặc style: `border: 1px dashed rgba(239, 68, 68, 0.45); background: #fff8f8;`
     - Thêm thuộc tính `readonly` và `style="cursor: not-allowed; background-color: #f8fafc;"` vào các ô `item-ma-vt`, `item-ten-vt`, `item-batch`.
     - Nút chọn cuộn:
       `<button type="button" class="btn btn-sm btn-secondary py-1 px-2" disabled title="Mặt hàng này đã xuất kho, không thể chọn cuộn thêm"><i class="bi bi-lock-fill me-1"></i>Đã khóa mục</button>`
     - Trong bảng cuộn: nếu `item.isLocked && rolls.length === 0`:
       Hiển thị dòng thông báo:
       `<tr><td colspan="4" class="text-center text-danger py-2 small" style="background: rgba(239, 68, 68, 0.08);"><i class="bi bi-shield-lock-fill me-1"></i>Mặt hàng này đã xuất trước đó (${item.lockInfo?.totalKg ? formatNumericValue(item.lockInfo.totalKg) : '0'} kg, ${item.lockInfo?.count || 0} cuộn). Đã khóa để chống xuất trùng.</td></tr>`
2. Trong `renderItemCards()`:
   - Không gắn sự kiện `openInventoryModal` nếu `item.isLocked`.
   - Vô hiệu hóa hoặc ẩn nút `Xóa mục` nếu `item.isLocked` để tránh xóa nhầm dữ liệu đối soát.

- [ ] **Step 4: Cập nhật Submit `addDataForm` trong `assets/js/xg/xg-xuat.js`**

Trong sự kiện submit form:
- Chỉ duyệt các item có `!item.isLocked`:
  ```javascript
  const activeItems = multiItemsData.filter(it => !it.isLocked);
  ```
- Nếu `activeItems.length === 0`:
  ```javascript
  alert('Tất cả mặt hàng trong phiếu xuất này đều đã được xuất kho trước đó (đã khóa). Không có mặt hàng mới nào để xuất.');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
  hideLoadingOverlay();
  return;
  ```
- Duyệt cuộn từ `activeItems` thay vì duyệt tất cả items.

- [ ] **Step 5: Kiểm tra và Commit Task 2**

```bash
git add assets/js/xg/xg-xuat.js
git commit -m "feat(xg-xuat): lock already exported items on receipt image scan"
```

---

### Task 3: Triển Khai Khóa Mặt Hàng Trên TOLE-XUAT (`assets/js/tole/tole-xuat.js`)

**Files:**
- Modify: `assets/js/tole/tole-xuat.js`

**Interfaces:**
- Consumes: `window.XgSapLookup.checkReceiptItemProcessed`, `window.XgSapLookup.showReceiptProcessedWarningModal`
- Modifies: `handleReceiptImageProcess`, `populateFieldsFromOcr`, `generateItemCardHTML`, `renderItemCards`, submit `addDataForm`

- [ ] **Step 1: Cập nhật `handleReceiptImageProcess` trong `assets/js/tole/tole-xuat.js`**

Áp dụng logic tương tự Task 2 với context `'tole-xuat'`:
- Duyệt `scannedItems` qua `window.XgSapLookup.checkReceiptItemProcessed(scannedDocNo, mat, batch, 'tole-xuat')`.
- Nếu tất cả đã xuất -> Bật modal `showReceiptProcessedWarningModal` với `pageContext: 'tole-xuat'` và dừng.
- Nếu một phần đã xuất -> Gán `isLocked: true`, hiển thị toast cảnh báo và chuyển sang `populateFieldsFromOcr`.

- [ ] **Step 2: Cập nhật `populateFieldsFromOcr`, `generateItemCardHTML` và `renderItemCards` trong `tole-xuat.js`**

- Giữ nguyên `isLocked` và `lockInfo` trong `multiItemsData`.
- Hiển thị badge `🔒 ĐÃ XUẤT (${lockKg} kg) - KHÓA` trên header thẻ.
- Khóa `readonly` các ô Mã VT, Tên VT, Batch.
- Disable nút `+ Chọn cuộn từ kho` của thẻ bị khóa.
- Bảng cuộn (5 cột của Tole: STT, Cuộn ID, Số kg, Số mét, Xóa) hiển thị dòng thông báo đã khóa.

- [ ] **Step 3: Cập nhật Submit `addDataForm` trong `tole-xuat.js`**

- Chỉ thu thập cuộn từ các mặt hàng `!item.isLocked`.
- Chặn gửi form nếu tất cả các mặt hàng đều bị khóa.

- [ ] **Step 4: Kiểm tra và Commit Task 3**

```bash
git add assets/js/tole/tole-xuat.js
git commit -m "feat(tole-xuat): lock already exported items on receipt image scan"
```

---

### Task 4: Chạy Kiểm Thử, Build Đồng Bộ và Xác Minh Toàn Diện

**Files:**
- Test: `tests/test-scan-export-receipt-lock.js`
- Build targets: `dist/`, `dist-app/`, `public/`

- [ ] **Step 1: Chạy bộ kiểm thử tự động**

Run: `node tests/test-scan-export-receipt-lock.js`  
Expected: Tất cả assertions thành công, exit code 0.

- [ ] **Step 2: Chạy lệnh build đồng bộ dự án**

Run: `npm run build` (`node scripts/sync-dist.js`)  
Expected: Sao chép đồng bộ toàn bộ file đã chỉnh sửa sang `dist/`, `dist-app/` và `public/` thành công không có lỗi.

- [ ] **Step 3: Kiểm tra trạng thái git**

Run: `git status`  
Expected: Chỉ có các thay đổi liên quan đến `xg-xuat.js`, `tole-xuat.js`, test và các thư mục sync build.

- [ ] **Step 4: Commit hoàn tất**

```bash
git add .
git commit -m "chore(build): sync export receipt lock feature across all distribution folders"
```
