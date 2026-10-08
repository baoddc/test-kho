# Kế Hoạch Triển Khai: Phân Loại Xà Gồ / Tole Khi Quét Phiếu Xuất Kho (XG-XUAT & TOLE-XUAT)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động nhận diện và phân loại phiếu xuất kho thuộc Xà Gồ hay Tole khi quét ảnh qua AI Vision OCR, cảnh báo khi lệch kho xuất và hỗ trợ chuyển trang kèm dữ liệu qua SessionStorage Bridge.

**Architecture:** Bổ sung phương thức phân loại 2 tầng (`classifyReceipt`) vào `assets/js/core/receipt-ocr-service.js` (Tầng 1 tra cứu SAP MB51, Tầng 2 dự phòng theo từ khóa tên hàng). Tích hợp vào `handleReceiptImageProcess` trên `xg-xuat.js` và `tole-xuat.js` để hiển thị modal cảnh báo khi lệch kho và bàn giao dữ liệu qua `sessionStorage` sang trang đích.

**Tech Stack:** JavaScript (ES6+), Bootstrap 5 Modals & Toasts, Supabase Client JS, Node.js (Testing runner).

## Global Constraints
- Tuân thủ toàn bộ quy tắc phân loại SAP MB51: nhóm bắt đầu bằng `10040`/`10041` là Xà Gồ (`xg`), nhóm `10030`/`10031`/`10022`/`10091` là Tole (`tole`).
- Không làm ảnh hưởng đến tính năng OCR giữ nguyên văn Lô/Batch (`formatBatchForMaterialName` không can thiệp vào `batch`).
- Dữ liệu bàn giao qua `sessionStorage` có thời hạn tối đa 10 phút và tự động dọn dẹp sau khi tiếp nhận để tránh lặp lại khi người dùng refresh (F5).
- Đồng bộ toàn bộ các thay đổi sang `public/`, `dist/` và `dist-app/` qua `scripts/sync-dist.js`.

---

### Task 1: Bộ Phân Loại Phiếu Xuất 2 Tầng (`classifyReceipt`) & Test Suite Độc Lập

**Files:**
- Modify: `assets/js/core/receipt-ocr-service.js`
- Create: `tests/test-receipt-warehouse-classification.js`

**Interfaces:**
- Consumes: `receiptData` ({ phieuXuat, items: [{ maVatTu, tenVatTu, batch }] }), `currentWarehouse` ('xg' | 'tole').
- Produces: `ReceiptOcrService.classifyReceipt(receiptData, currentWarehouse)` -> Promise<{ targetWarehouse: 'xg'|'tole'|'unknown', confidence: 'sap'|'keywords'|'none', reason: string, isMatchCurrent: boolean, targetPageUrl: string, targetLabel: string }>.

- [ ] **Step 1: Viết test suite kiểm thử cho `classifyReceipt`**

Tạo file `tests/test-receipt-warehouse-classification.js`:

```javascript
const assert = require('assert');
const path = require('path');

// Mock browser window & environment
global.window = {};
require('../assets/js/core/receipt-ocr-service.js');
const ReceiptOcrService = global.window.ReceiptOcrService;

console.log('===============================================================');
console.log(' KIỂM THỬ PHÂN LOẠI PHIẾU XUẤT KHO XÀ GỒ / TOLE (OCR)');
console.log('===============================================================\n');

let passCount = 0;
let totalTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`  ✓ [PASS] ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(`    -> Lỗi: ${err.message}`);
  }
}

async function runAsyncTest(description, testFn) {
  totalTests++;
  try {
    await testFn();
    console.log(`  ✓ [PASS] ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(`    -> Lỗi: ${err.message}`);
  }
}

(async () => {
  // Test 1: Kiểm tra hàm classifyReceipt tồn tại
  runTest('ReceiptOcrService có phương thức classifyReceipt', () => {
    assert.strictEqual(typeof ReceiptOcrService.classifyReceipt, 'function');
  });

  // Test 2: Phân loại theo từ khóa tên hàng - Xà gồ
  await runAsyncTest('Phân loại Xà gồ theo từ khóa tên hàng', async () => {
    const dataXg = {
      phieuXuat: 'PX_TEST_XG_KEYWORD',
      items: [
        { maVatTu: '10001189', tenVatTu: 'Thép phôi kẽm 2.0x349VN Z275 G450', batch: '2X349VN' }
      ]
    };
    const res = await ReceiptOcrService.classifyReceipt(dataXg, 'xg');
    assert.strictEqual(res.targetWarehouse, 'xg');
    assert.strictEqual(res.isMatchCurrent, true);
    assert.strictEqual(res.targetPageUrl, '/pages/xg/xg-xuat.html');
  });

  // Test 3: Phân loại theo từ khóa tên hàng - Tole
  await runAsyncTest('Phân loại Tole theo từ khóa tên hàng', async () => {
    const dataTole = {
      phieuXuat: 'PX_TEST_TOLE_KEYWORD',
      items: [
        { maVatTu: '10002233', tenVatTu: 'Phôi tôn mạ 0.5x1200 AZ150 G550', batch: 'DOA-VN' }
      ]
    };
    const res = await ReceiptOcrService.classifyReceipt(dataTole, 'xg');
    assert.strictEqual(res.targetWarehouse, 'tole');
    assert.strictEqual(res.isMatchCurrent, false); // Quét trên xg nhưng là Tole
    assert.strictEqual(res.targetPageUrl, '/pages/tole/tole-xuat.html');
  });

  // Test 4: Tra cứu theo dữ liệu SAP MB51 (Mock Supabase client)
  await runAsyncTest('Phân loại ưu tiên qua SAP MB51', async () => {
    global.window.supabase = {
      from: (tbl) => ({
        select: () => ({
          ilike: (col, val) => {
            if (val.includes('4900111111')) {
              return Promise.resolve({
                data: [{ material_document: '4900111111', material_group: '10040-Phôi xà gồ mạ' }],
                error: null
              });
            }
            if (val.includes('4900222222')) {
              return Promise.resolve({
                data: [{ material_document: '4900222222', material_group: '10030-Phôi tôn mạ' }],
                error: null
              });
            }
            return Promise.resolve({ data: [], error: null });
          }
        })
      })
    };

    const resXgSap = await ReceiptOcrService.classifyReceipt({ phieuXuat: '4900111111', items: [] }, 'tole');
    assert.strictEqual(resXgSap.targetWarehouse, 'xg');
    assert.strictEqual(resXgSap.confidence, 'sap');
    assert.strictEqual(resXgSap.isMatchCurrent, false);

    const resToleSap = await ReceiptOcrService.classifyReceipt({ phieuXuat: '4900222222', items: [] }, 'tole');
    assert.strictEqual(resToleSap.targetWarehouse, 'tole');
    assert.strictEqual(resToleSap.confidence, 'sap');
    assert.strictEqual(resToleSap.isMatchCurrent, true);
  });

  console.log('\n---------------------------------------------------------------');
  console.log(` KẾT QUẢ KIỂM THỬ: ${passCount}/${totalTests} BÀI TEST THÀNH CÔNG (${Math.round((passCount/totalTests)*100)}%)`);
  console.log('---------------------------------------------------------------');

  if (passCount !== totalTests) {
    process.exit(1);
  }
})();
```

- [ ] **Step 2: Chạy test để xác nhận fail vì chưa có `classifyReceipt`**

Chạy lệnh: `node tests/test-receipt-warehouse-classification.js`
Kỳ vọng: Thất bại với lỗi `ReceiptOcrService.classifyReceipt is not a function`.

- [ ] **Step 3: Triển khai phương thức `classifyReceipt` trong `assets/js/core/receipt-ocr-service.js`**

Thêm phương thức `classifyReceipt` vào đối tượng `ReceiptOcrService`:

```javascript
    /**
     * Tự động nhận diện và phân loại phiếu xuất kho thuộc Xà Gồ hay Tole
     * @param {Object} receiptData - Dữ liệu phiếu đã trích xuất ({ phieuXuat, items })
     * @param {string} currentWarehouse - 'xg' hoặc 'tole'
     * @returns {Promise<{ targetWarehouse: string, confidence: string, reason: string, isMatchCurrent: boolean, targetPageUrl: string, targetLabel: string }>}
     */
    classifyReceipt: async function (receiptData, currentWarehouse) {
      const emptyResult = {
        targetWarehouse: 'unknown',
        confidence: 'none',
        reason: 'Không xác định được loại vật tư',
        isMatchCurrent: true,
        targetPageUrl: '',
        targetLabel: ''
      };

      if (!receiptData) return emptyResult;

      const docNo = String(receiptData.phieuXuat || '').trim();
      let matchedWarehouse = 'unknown';
      let confidence = 'none';
      let reason = '';

      // Tầng 1: Ưu tiên tra cứu SAP MB51 (chính xác 100%)
      if (docNo && typeof window !== 'undefined' && window.supabase) {
        try {
          const { data, error } = await window.supabase
            .from('xg_sap_mb51')
            .select('material_document, material_group, material, debit_credit_ind')
            .ilike('material_document', `%${docNo}%`)
            .limit(10);

          if (!error && Array.isArray(data) && data.length > 0) {
            for (const row of data) {
              const grp = String(row.material_group || '').trim();
              if (grp.startsWith('10040') || grp.startsWith('10041')) {
                matchedWarehouse = 'xg';
                confidence = 'sap';
                reason = `Khớp nhóm SAP MB51: ${grp}`;
                break;
              }
              if (['10030', '10031', '10022', '10091'].some(p => grp.startsWith(p))) {
                matchedWarehouse = 'tole';
                confidence = 'sap';
                reason = `Khớp nhóm SAP MB51: ${grp}`;
                break;
              }
            }
          }
        } catch (err) {
          console.warn('[ReceiptOcrService] Lỗi tra cứu SAP khi phân loại:', err);
        }
      }

      // Tầng 2: Dự phòng phân tích từ khóa Tên hàng & Mã hàng trên phiếu
      if (matchedWarehouse === 'unknown') {
        const items = Array.isArray(receiptData.items) ? receiptData.items : [];
        const fullText = items.map(it => `${it.maVatTu || ''} ${it.tenVatTu || ''}`).join(' ').toLowerCase();

        const xgRegex = /(xà gồ|xa go|thép phôi kẽm|thep phoi kem|phôi kẽm|phoi kem|phôi xà gồ|phoi xa go)/i;
        const toleRegex = /(phôi tôn|phoi ton|tôn cuộn|ton cuon|thép cuộn inox|thep cuon inox|nhôm cuộn|nhom cuon|phôi thép mạ kẽm|tole|\btôn\b|\bton\b)/i;

        if (xgRegex.test(fullText)) {
          matchedWarehouse = 'xg';
          confidence = 'keywords';
          reason = 'Tên hàng chứa quy cách Xà Gồ';
        } else if (toleRegex.test(fullText)) {
          matchedWarehouse = 'tole';
          confidence = 'keywords';
          reason = 'Tên hàng chứa quy cách Tole';
        }
      }

      const isXg = matchedWarehouse === 'xg';
      const isTole = matchedWarehouse === 'tole';
      const targetPageUrl = isXg ? '/pages/xg/xg-xuat.html' : (isTole ? '/pages/tole/tole-xuat.html' : '');
      const targetLabel = isXg ? 'Kho Xà Gồ - Xuất' : (isTole ? 'Kho Tole - Xuất' : '');
      const isMatchCurrent = matchedWarehouse === 'unknown' || (currentWarehouse ? matchedWarehouse === currentWarehouse : true);

      return {
        targetWarehouse: matchedWarehouse,
        confidence,
        reason: reason || 'Chưa phân loại rõ',
        isMatchCurrent,
        targetPageUrl,
        targetLabel
      };
    },
```

- [ ] **Step 4: Chạy lại test suite kiểm tra PASS**

Chạy lệnh: `node tests/test-receipt-warehouse-classification.js`
Kỳ vọng: Toàn bộ 4 test PASS (100%).

- [ ] **Step 5: Commit**

```bash
git add assets/js/core/receipt-ocr-service.js tests/test-receipt-warehouse-classification.js
git commit -m "feat(ocr): add classifyReceipt 2-tier classification engine"
```

---

### Task 2: Tích Hợp Cảnh Báo Lệch Kho & Bàn Giao Dữ Liệu Trên `xg-xuat.js`

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`

**Interfaces:**
- Consumes: `ReceiptOcrService.classifyReceipt(result.data, 'xg')`.
- Produces: `showReceiptMismatchWarehouseModal`, `sessionStorage.setItem('pending_receipt_handover')`, `checkPendingReceiptHandover()`.

- [ ] **Step 1: Viết hàm hiển thị Modal Cảnh Báo Lệch Kho `showReceiptMismatchWarehouseModal` trong `assets/js/xg/xg-xuat.js`**

Tạo modal cảnh báo sinh động, cung cấp nút **Chuyển sang Kho Tole & Điền dữ liệu**:

```javascript
function showReceiptMismatchWarehouseModal(classification, scannedData, file, label) {
  let modalEl = document.getElementById('receiptWarehouseMismatchModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'receiptWarehouseMismatchModal';
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.setAttribute('data-bs-backdrop', 'static');
    modalEl.style.zIndex = '10090';
    document.body.appendChild(modalEl);
  }

  const docNo = scannedData?.phieuXuat || 'Chưa rõ số phiếu';
  const targetLabel = classification.targetLabel || 'Kho Tole - Xuất';
  const reasonText = classification.reason || 'Dữ liệu nhận diện thuộc phân hệ Tole';

  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered" style="max-width: 580px;">
      <div class="modal-content shadow-lg border-0" style="border-radius: 16px; overflow: hidden; background: #1e2438; color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.15) !important;">
        <div class="modal-header py-3 px-4" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;">
          <div class="d-flex align-items-center gap-2">
            <span class="d-inline-flex align-items-center justify-content-center bg-white text-warning rounded-circle shadow-sm" style="width: 36px; height: 36px; font-size: 1.25rem;">
              <i class="bi bi-exclamation-triangle-fill"></i>
            </span>
            <div>
              <h5 class="modal-title fw-bold mb-0 text-white">PHÁT HIỆN PHIẾU XUẤT THUỘC ${escapeHtml(targetLabel.toUpperCase())}</h5>
              <small class="text-white-50">Số phiếu: <strong class="text-white">${escapeHtml(docNo)}</strong></small>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <div class="modal-body p-4 text-center">
          <div class="p-3 rounded-3 mb-3" style="background: rgba(245, 158, 11, 0.12); border: 1px dashed #f59e0b; color: #f8fafc; text-align: left;">
            <div class="d-flex align-items-center gap-2 mb-2">
              <i class="bi bi-info-circle-fill text-warning fs-5"></i>
              <strong class="text-white">Căn cứ phân loại:</strong>
              <span class="badge bg-warning text-dark">${escapeHtml(reasonText)}</span>
            </div>
            <div class="small text-white-50">
              Bạn đang ở màn hình <strong>Kho Xà Gồ - Xuất</strong>. Hệ thống tự động ngăn chặn việc điền phiếu Tole vào Kho Xà Gồ để đảm bảo tính chính xác của dữ liệu tồn kho.
            </div>
          </div>
          <p class="mb-0 text-white-50 small">Bạn có muốn chuyển sang màn hình <strong>${escapeHtml(targetLabel)}</strong> và tự động điền toàn bộ dữ liệu phiếu này không?</p>
        </div>

        <div class="modal-footer justify-content-center gap-2 py-3 px-4" style="background: #1e2438 !important; border-top: 1px solid rgba(255, 255, 255, 0.15) !important;">
          <button type="button" class="btn btn-secondary px-4" data-bs-dismiss="modal">Ở lại trang này</button>
          <button type="button" class="btn btn-primary px-4 fw-bold shadow" id="btnConfirmSwitchWarehouse">
            <i class="bi bi-box-arrow-up-right me-1"></i> Chuyển sang ${escapeHtml(targetLabel)} & Điền ngay
          </button>
        </div>
      </div>
    </div>
  `;

  const bsModal = typeof bootstrap !== 'undefined' && bootstrap.Modal
    ? bootstrap.Modal.getOrCreateInstance(modalEl)
    : null;

  const btnSwitch = modalEl.querySelector('#btnConfirmSwitchWarehouse');
  if (btnSwitch) {
    btnSwitch.onclick = () => {
      if (bsModal) bsModal.hide();
      const handoverPayload = {
        data: scannedData,
        previewDataUrl: modalEl._previewUrl || '',
        fileName: label || file?.name || 'Ảnh phiếu xuất kho',
        fromWarehouse: 'xg',
        timestamp: Date.now()
      };
      sessionStorage.setItem('pending_receipt_handover', JSON.stringify(handoverPayload));
      window.location.href = classification.targetPageUrl;
    };
  }

  if (bsModal) bsModal.show();
}
```

- [ ] **Step 2: Cập nhật hàm `handleReceiptImageProcess` trong `assets/js/xg/xg-xuat.js`**

Sau khi OCR có kết quả:
```javascript
    // Phân loại phiếu xuất Xà Gồ hay Tole
    const classification = await window.ReceiptOcrService.classifyReceipt(result.data, 'xg');
    if (!classification.isMatchCurrent && classification.targetWarehouse === 'tole') {
      const modalEl = document.getElementById('receiptWarehouseMismatchModal') || {};
      modalEl._previewUrl = result.dataUrl || URL.createObjectURL(file);
      showReceiptMismatchWarehouseModal(classification, result.data, file, label);
      return;
    }

    // Điền dữ liệu vào form nếu hợp lệ
    populateFieldsFromOcr(result.data);
```

- [ ] **Step 3: Viết hàm tiếp nhận dữ liệu `checkPendingReceiptHandover` trong `assets/js/xg/xg-xuat.js`**

Kiểm tra `sessionStorage` khi trang tải để tiếp nhận phiếu từ kho khác chuyển sang:
```javascript
function checkPendingReceiptHandover() {
  const raw = sessionStorage.getItem('pending_receipt_handover');
  if (!raw) return;
  sessionStorage.removeItem('pending_receipt_handover');

  try {
    const handover = JSON.parse(raw);
    if (!handover || !handover.data) return;
    if (Date.now() - (handover.timestamp || 0) > 10 * 60 * 1000) return; // Quá 10 phút

    setTimeout(() => {
      openAddDataModal();
      populateFieldsFromOcr(handover.data);

      const previewContainer = document.getElementById('ocrPreviewContainer');
      const previewThumb = document.getElementById('ocrPreviewThumb');
      const fileNameText = document.getElementById('ocrFileNameText');
      const dropzoneContent = document.querySelector('.ocr-dropzone-content');

      if (previewContainer && previewThumb && handover.previewDataUrl) {
        previewThumb.src = handover.previewDataUrl;
        if (fileNameText) fileNameText.textContent = handover.fileName || 'Ảnh phiếu chuyển từ kho Tole';
        if (dropzoneContent) dropzoneContent.style.display = 'none';
        previewContainer.style.display = 'flex';
      }

      showAutofillToast(`✓ Đã nhận và điền dữ liệu phiếu ${handover.data.phieuXuat || ''} chuyển từ Kho Tole!`);
    }, 300);
  } catch (err) {
    console.warn('[xg-xuat] Lỗi tiếp nhận phiếu xuất bàn giao:', err);
  }
}
```
Gọi `checkPendingReceiptHandover()` trong hàm khởi tạo `init()`.

- [ ] **Step 4: Commit**

```bash
git add assets/js/xg/xg-xuat.js
git commit -m "feat(xg-xuat): integrate receipt classification and handover bridge"
```

---

### Task 3: Tích Hợp Cảnh Báo Lệch Kho & Bàn Giao Dữ Liệu Trên `tole-xuat.js`

**Files:**
- Modify: `assets/js/tole/tole-xuat.js`

**Interfaces:**
- Consumes: `ReceiptOcrService.classifyReceipt(result.data, 'tole')`.
- Produces: `showReceiptMismatchWarehouseModal`, `sessionStorage.setItem('pending_receipt_handover')`, `checkPendingReceiptHandover()`.

- [ ] **Step 1: Viết hàm `showReceiptMismatchWarehouseModal` trong `assets/js/tole/tole-xuat.js`**

Tương tự Task 2, cảnh báo khi phiếu xuất thuộc về Kho Xà Gồ và hỗ trợ nút **Chuyển sang Kho Xà Gồ & Điền dữ liệu**:

```javascript
function showReceiptMismatchWarehouseModal(classification, scannedData, file, label) {
  let modalEl = document.getElementById('receiptWarehouseMismatchModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'receiptWarehouseMismatchModal';
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.setAttribute('data-bs-backdrop', 'static');
    modalEl.style.zIndex = '10090';
    document.body.appendChild(modalEl);
  }

  const docNo = scannedData?.phieuXuat || 'Chưa rõ số phiếu';
  const targetLabel = classification.targetLabel || 'Kho Xà Gồ - Xuất';
  const reasonText = classification.reason || 'Dữ liệu nhận diện thuộc phân hệ Xà Gồ';

  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered" style="max-width: 580px;">
      <div class="modal-content shadow-lg border-0" style="border-radius: 16px; overflow: hidden; background: #1e2438; color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.15) !important;">
        <div class="modal-header py-3 px-4" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;">
          <div class="d-flex align-items-center gap-2">
            <span class="d-inline-flex align-items-center justify-content-center bg-white text-warning rounded-circle shadow-sm" style="width: 36px; height: 36px; font-size: 1.25rem;">
              <i class="bi bi-exclamation-triangle-fill"></i>
            </span>
            <div>
              <h5 class="modal-title fw-bold mb-0 text-white">PHÁT HIỆN PHIẾU XUẤT THUỘC ${escapeHtml(targetLabel.toUpperCase())}</h5>
              <small class="text-white-50">Số phiếu: <strong class="text-white">${escapeHtml(docNo)}</strong></small>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <div class="modal-body p-4 text-center">
          <div class="p-3 rounded-3 mb-3" style="background: rgba(245, 158, 11, 0.12); border: 1px dashed #f59e0b; color: #f8fafc; text-align: left;">
            <div class="d-flex align-items-center gap-2 mb-2">
              <i class="bi bi-info-circle-fill text-warning fs-5"></i>
              <strong class="text-white">Căn cứ phân loại:</strong>
              <span class="badge bg-warning text-dark">${escapeHtml(reasonText)}</span>
            </div>
            <div class="small text-white-50">
              Bạn đang ở màn hình <strong>Kho Tole - Xuất</strong>. Hệ thống tự động ngăn chặn việc điền phiếu Xà Gồ vào Kho Tole để đảm bảo tính chính xác của dữ liệu tồn kho.
            </div>
          </div>
          <p class="mb-0 text-white-50 small">Bạn có muốn chuyển sang màn hình <strong>${escapeHtml(targetLabel)}</strong> và tự động điền toàn bộ dữ liệu phiếu này không?</p>
        </div>

        <div class="modal-footer justify-content-center gap-2 py-3 px-4" style="background: #1e2438 !important; border-top: 1px solid rgba(255, 255, 255, 0.15) !important;">
          <button type="button" class="btn btn-secondary px-4" data-bs-dismiss="modal">Ở lại trang này</button>
          <button type="button" class="btn btn-primary px-4 fw-bold shadow" id="btnConfirmSwitchWarehouse">
            <i class="bi bi-box-arrow-up-right me-1"></i> Chuyển sang ${escapeHtml(targetLabel)} & Điền ngay
          </button>
        </div>
      </div>
    </div>
  `;

  const bsModal = typeof bootstrap !== 'undefined' && bootstrap.Modal
    ? bootstrap.Modal.getOrCreateInstance(modalEl)
    : null;

  const btnSwitch = modalEl.querySelector('#btnConfirmSwitchWarehouse');
  if (btnSwitch) {
    btnSwitch.onclick = () => {
      if (bsModal) bsModal.hide();
      const handoverPayload = {
        data: scannedData,
        previewDataUrl: modalEl._previewUrl || '',
        fileName: label || file?.name || 'Ảnh phiếu xuất kho',
        fromWarehouse: 'tole',
        timestamp: Date.now()
      };
      sessionStorage.setItem('pending_receipt_handover', JSON.stringify(handoverPayload));
      window.location.href = classification.targetPageUrl;
    };
  }

  if (bsModal) bsModal.show();
}
```

- [ ] **Step 2: Cập nhật hàm `handleReceiptImageProcess` trong `assets/js/tole/tole-xuat.js`**

```javascript
    // Phân loại phiếu xuất Xà Gồ hay Tole
    const classification = await window.ReceiptOcrService.classifyReceipt(result.data, 'tole');
    if (!classification.isMatchCurrent && classification.targetWarehouse === 'xg') {
      const modalEl = document.getElementById('receiptWarehouseMismatchModal') || {};
      modalEl._previewUrl = result.dataUrl || URL.createObjectURL(file);
      showReceiptMismatchWarehouseModal(classification, result.data, file, label);
      return;
    }

    // Điền dữ liệu vào form nếu hợp lệ
    populateFieldsFromOcr(result.data);
```

- [ ] **Step 3: Viết hàm tiếp nhận dữ liệu `checkPendingReceiptHandover` trong `assets/js/tole/tole-xuat.js`**

```javascript
function checkPendingReceiptHandover() {
  const raw = sessionStorage.getItem('pending_receipt_handover');
  if (!raw) return;
  sessionStorage.removeItem('pending_receipt_handover');

  try {
    const handover = JSON.parse(raw);
    if (!handover || !handover.data) return;
    if (Date.now() - (handover.timestamp || 0) > 10 * 60 * 1000) return; // Quá 10 phút

    setTimeout(() => {
      openAddDataModal();
      populateFieldsFromOcr(handover.data);

      const previewContainer = document.getElementById('ocrPreviewContainer');
      const previewThumb = document.getElementById('ocrPreviewThumb');
      const fileNameText = document.getElementById('ocrFileNameText');
      const dropzoneContent = document.querySelector('.ocr-dropzone-content');

      if (previewContainer && previewThumb && handover.previewDataUrl) {
        previewThumb.src = handover.previewDataUrl;
        if (fileNameText) fileNameText.textContent = handover.fileName || 'Ảnh phiếu chuyển từ kho Xà Gồ';
        if (dropzoneContent) dropzoneContent.style.display = 'none';
        previewContainer.style.display = 'flex';
      }

      showAutofillToast(`✓ Đã nhận và điền dữ liệu phiếu ${handover.data.phieuXuat || ''} chuyển từ Kho Xà Gồ!`);
    }, 300);
  } catch (err) {
    console.warn('[tole-xuat] Lỗi tiếp nhận phiếu xuất bàn giao:', err);
  }
}
```
Gọi `checkPendingReceiptHandover()` trong hàm khởi tạo `init()`.

- [ ] **Step 4: Commit**

```bash
git add assets/js/tole/tole-xuat.js
git commit -m "feat(tole-xuat): integrate receipt classification and handover bridge"
```

---

### Task 4: Kiểm Thử Toàn Diện, Đồng Bộ Bản Build & Xác Minh Hệ Thống

**Files:**
- Output sync: `public/`, `dist/`, `dist-app/`

- [ ] **Step 1: Chạy kiểm thử đơn vị tự động**

Chạy lệnh: `node tests/test-receipt-warehouse-classification.js`
Kỳ vọng: 100% PASS.

- [ ] **Step 2: Chạy các bài kiểm thử liên quan trong thư mục tests**

Chạy lệnh:
```bash
node tests/test-sap-page-validation-rules.js
node tests/verify-raw-batch-flow.js
node tests/test-manual-export-autofill.js
```
Kỳ vọng: Toàn bộ các bộ kiểm thử đều PASS.

- [ ] **Step 3: Chạy script đồng bộ bản build `scripts/sync-dist.js`**

Chạy lệnh: `node scripts/sync-dist.js`
Kỳ vọng: Đồng bộ thành công sang `public/`, `dist/`, `dist-app/`.

- [ ] **Step 4: Commit**

```bash
git add public/ dist/ dist-app/
git commit -m "chore: sync distribution files for receipt warehouse classification"
```
