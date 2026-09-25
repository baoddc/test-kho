const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting SAP kg reconciliation & warning modal test...');

// Read assets/js/xg/xg-sap-lookup.js
const scriptPath = path.join(__dirname, '..', 'assets', 'js', 'xg', 'xg-sap-lookup.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Set up mock window and document
const mockElements = {};
function createMockElement(id) {
  return {
    id,
    style: {},
    classList: {
      add: () => {},
      remove: () => {}
    },
    textContent: '',
    innerHTML: '',
    disabled: false,
    title: '',
    addEventListener: () => {}
  };
}

const documentMock = {
  getElementById: (id) => {
    if (!mockElements[id]) {
      mockElements[id] = createMockElement(id);
    }
    return mockElements[id];
  },
  querySelector: (sel) => {
    if (sel.includes('btnAddDataSubmit') || sel === '#addDataForm button[type="submit"]') {
      return documentMock.getElementById('btnAddDataSubmit');
    }
    if (sel.includes('btnEditDataSubmit') || sel === '#editDataForm button[type="submit"]') {
      return documentMock.getElementById('btnEditDataSubmit');
    }
    return null;
  },
  querySelectorAll: () => [],
  body: {
    appendChild: () => {}
  },
  createElement: (tag) => createMockElement(tag),
  addEventListener: () => {}
};

const windowMock = {
  _currentSelectedSapRecord: null,
  addEventListener: () => {},
  document: documentMock,
  supabase: {}
};

// Execute script in mock context
const fn = new Function('window', 'document', scriptContent);
fn(windowMock, documentMock);

assert(windowMock.XgSapLookup, 'XgSapLookup must be defined on window');
assert.strictEqual(typeof windowMock.XgSapLookup.validateSapMatch, 'function', 'validateSapMatch must be exported');
assert.strictEqual(typeof windowMock.XgSapLookup.updateSapReconciliationDisplay, 'function', 'updateSapReconciliationDisplay must be exported');

console.log('✓ XgSapLookup successfully initialized');

// Test Case 1: No SAP record active
windowMock._currentSelectedSapRecord = null;
const noSapResult = windowMock.XgSapLookup.validateSapMatch(100);
assert.strictEqual(noSapResult.valid, true, 'Without SAP record, validation should pass');

// Test Case 2: SAP record active with 1,560 kg
windowMock._currentSelectedSapRecord = {
  material_document: '5000041402',
  material: '10001189',
  batch: '1.5X100VN',
  total_quantity: 1560
};

const submitBtn = documentMock.getElementById('btnAddDataSubmit');
const badge = documentMock.getElementById('sapReconciliationBadge');

// 2a. Roll kg = 0 (Chưa nhập kg)
// Yêu cầu: Nút Thêm vẫn bấm được (disabled === false), nhưng validateSapMatch trả về false và có modalHtml
const zeroKgResult = windowMock.XgSapLookup.validateSapMatch(0);
assert.strictEqual(zeroKgResult.valid, false, '0 kg must be invalid');
assert(zeroKgResult.modalHtml.includes('KHÔNG CHO PHÉP THÊM DỮ LIỆU'), 'Modal HTML must be generated');
windowMock.XgSapLookup.updateSapReconciliationDisplay(0);
assert.strictEqual(submitBtn.disabled, false, 'Submit button MUST remain clickable (disabled=false) per user requirement');
assert(badge.innerHTML.includes('Chờ nhập kg cuộn'), 'Badge must indicate waiting for kg input');
console.log('✓ 0 kg check passed: button clickable, modalHtml ready');

// 2b. Roll kg = 780 (Lệch thiếu: -780 kg, Cuộn < SAP)
const shortKgResult = windowMock.XgSapLookup.validateSapMatch(780);
assert.strictEqual(shortKgResult.valid, false, 'Shortage (780 kg vs 1560 kg) must be invalid');
assert.strictEqual(shortKgResult.diff, -780, 'Diff should be -780');
assert(shortKgResult.modalHtml.includes('LỆCH THIẾU') || shortKgResult.modalHtml.includes('Lệch thiếu'), 'Modal HTML must report Lệch thiếu');
assert(shortKgResult.modalHtml.includes('-780'), 'Modal HTML must show diff -780 kg');
windowMock.XgSapLookup.updateSapReconciliationDisplay(780);
assert.strictEqual(submitBtn.disabled, false, 'Submit button MUST remain clickable (disabled=false)');
assert(badge.innerHTML.includes('Lệch') && badge.innerHTML.includes('Cuộn < SAP'), 'Badge must show mismatch Cuộn < SAP');
console.log('✓ Lệch thiếu check passed: button clickable, modal warning ready');

// 2c. Roll kg = 1600 (Lệch dư: +40 kg, Cuộn > SAP)
const surplusKgResult = windowMock.XgSapLookup.validateSapMatch(1600);
assert.strictEqual(surplusKgResult.valid, false, 'Surplus (1600 kg vs 1560 kg) must be invalid');
assert.strictEqual(surplusKgResult.diff, 40, 'Diff should be +40');
assert(surplusKgResult.modalHtml.includes('LỆCH DƯ') || surplusKgResult.modalHtml.includes('Lệch dư'), 'Modal HTML must report Lệch dư');
assert(surplusKgResult.modalHtml.includes('+40'), 'Modal HTML must show diff +40 kg');
windowMock.XgSapLookup.updateSapReconciliationDisplay(1600);
assert.strictEqual(submitBtn.disabled, false, 'Submit button MUST remain clickable (disabled=false)');
assert(badge.innerHTML.includes('Lệch') && badge.innerHTML.includes('Cuộn > SAP'), 'Badge must show mismatch Cuộn > SAP');
console.log('✓ Lệch dư check passed: button clickable, modal warning ready');

// 2d. Roll kg = 1560 (Khớp 100%: 0 kg) -> ĐƯỢC PHÉP THÊM
const exactKgResult = windowMock.XgSapLookup.validateSapMatch(1560);
assert.strictEqual(exactKgResult.valid, true, 'Exact match (1560 kg vs 1560 kg) must be valid');
assert.strictEqual(exactKgResult.diff, 0, 'Diff should be 0');
windowMock.XgSapLookup.updateSapReconciliationDisplay(1560);
assert.strictEqual(submitBtn.disabled, false, 'Submit button must be enabled');
assert(badge.innerHTML.includes('Khớp 100%'), 'Badge must show 100% match');
console.log('✓ Khớp hoàn toàn 100% check passed: allows add');

// 2e. Sửa dữ liệu (isEdit = true) -> KHÔNG ÁP DỤNG CẢNH BÁO, LUÔN HỢP LỆ
const editShortResult = windowMock.XgSapLookup.validateSapMatch(780, true);
assert.strictEqual(editShortResult.valid, true, 'Editing data must not be blocked by SAP reconciliation');
console.log('✓ Edit mode bypass check passed: no warning for editing existing data');

// Test Case 3: Reset SAP selection
windowMock.XgSapLookup.resetSapSelection();
assert.strictEqual(windowMock._currentSelectedSapRecord, null, 'SAP record should be cleared');
assert.strictEqual(documentMock.getElementById('sapReconciliationRow').style.display, 'none', 'SAP row should be hidden');
console.log('✓ Reset SAP selection passed');

console.log('🎉 ALL RECONCILIATION & WARNING MODAL TESTS PASSED SUCCESSFULLY!');
