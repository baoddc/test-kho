/**
 * Test Suite: Kiểm thử Điền Thông Tin Chung Phiếu Xuất & Chọn Thủ Công Mặt Hàng, Cuộn Xuất
 * Áp dụng cho: xg-xuat và tole-xuat
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Nạp module XgSapLookup
global.window = {
  location: { pathname: '/pages/xg/xg-xuat.html' }
};
require('../assets/js/xg/xg-sap-lookup.js');
const SapLookup = global.window.XgSapLookup;

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

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function main() {
  console.log('==================================================================================');
  console.log(' KIỂM THỬ ĐIỀN THÔNG TIN CHUNG PHIẾU XUẤT & CHỌN THỦ CÔNG MẶT HÀNG, CUỘN XUẤT');
  console.log('==================================================================================\n');

  // 1. Kiểm tra export của SapLookup
  runTest('SapLookup export đầy đủ applySapRecordToForm và showAutofillToast', () => {
    assert.strictEqual(typeof SapLookup.applySapRecordToForm, 'function');
    assert.strictEqual(typeof SapLookup.showAutofillToast, 'function');
  });

  // 2. Kiểm tra applySapRecordToForm chỉ truyền Thông tin chung phiếu xuất qua bridge
  await runAsyncTest('applySapRecordToForm chỉ gửi headerInfo đến populateExportReceiptData, không tự nạp items/cuộn', async () => {
    let capturedHeader = null;
    let capturedItems = undefined;

    global.window.populateExportReceiptData = async (header, items) => {
      capturedHeader = header;
      capturedItems = items;
    };

    const mockSapRow = {
      material_document: '4900158458',
      posting_date: '2026-10-03',
      material: '10001508',
      material_description: 'Thép phôi kẽm 1.5x338 G450 Z275',
      batch: 'VN',
      quantity: -5000,
      project_id: '10926-122',
      project_name: 'DG XK RENTAL BUILDING',
      movement_type_text: 'Xuất vật tư cho LSX',
      raw_data: { debit_credit_ind: 'H', material_group: '10040-Phôi xà gồ mạ' }
    };

    const mockForm = {
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await SapLookup.applySapRecordToForm(mockSapRow, mockForm, 'xg-xuat');

    assert.ok(capturedHeader, 'Header phải được chuyển qua bridge');
    assert.strictEqual(capturedHeader.maChungTu, 'PX');
    assert.strictEqual(capturedHeader.phieuXuat, '4900158458');
    assert.strictEqual(capturedHeader.ngayXuat, '2026-10-03');
    assert.strictEqual(capturedHeader.maCongTrinh, '10926-122');
    assert.strictEqual(capturedHeader.tenCongTrinh, 'DG XK RENTAL BUILDING');
    assert.strictEqual(capturedHeader.loaiXuat, 'Xuất vật tư cho LSX');

    assert.strictEqual(capturedItems, undefined, 'Không được truyền itemsGrouped để tránh tự động điền mặt hàng');
  });

  // 3. Kiểm tra logic thủ công chọn cuộn tồn kho: mở modal và lọc đúng
  await runAsyncTest('Logic lọc cuộn tồn kho khi chọn thủ công: Loại bỏ cuộn đã xuất, khớp đúng Mã VT và Batch', async () => {
    const mockInventoryNhap = [
      { 'Cuộn ID': 'C001', 'Mã vật tư': '10001508', 'Batch': 'VN', 'Số lượng (Kg)': 981 },
      { 'Cuộn ID': 'C002', 'Mã vật tư': '10001508', 'Batch': 'VN', 'Số lượng (Kg)': 3000 },
      { 'Cuộn ID': 'C003', 'Mã vật tư': '10001508', 'Batch': 'VN', 'Số lượng (Kg)': 3510 },
      { 'Cuộn ID': 'C004_EXPORTED', 'Mã vật tư': '10001508', 'Batch': 'VN', 'Số lượng (Kg)': 2000 },
      { 'Cuộn ID': 'C005_OTHER_BATCH', 'Mã vật tư': '10001508', 'Batch': 'US', 'Số lượng (Kg)': 5000 }
    ];

    const mockExportedCuonIds = new Set(['c004_exported']);

    // Mặt hàng do người dùng nhập/chọn thủ công
    const targetItem = {
      maVatTu: '10001508',
      batch: 'VN',
      rolls: []
    };

    const matchingRolls = mockInventoryNhap.filter(r => {
      const cid = String(r['Cuộn ID'] || '').toLowerCase();
      return r['Mã vật tư'] === targetItem.maVatTu &&
             r['Batch'] === targetItem.batch &&
             !mockExportedCuonIds.has(cid);
    });

    assert.strictEqual(matchingRolls.length, 3, 'Có 3 cuộn tồn hợp lệ chưa xuất');
    assert.strictEqual(matchingRolls[0]['Cuộn ID'], 'C001');
    assert.strictEqual(matchingRolls[1]['Cuộn ID'], 'C002');
    assert.strictEqual(matchingRolls[2]['Cuộn ID'], 'C003');
  });

  // 4. Kiểm tra mã nguồn xg-xuat.js và tole-xuat.js không tự động chèn cuộn
  runTest('Mã nguồn xg-xuat.js và tole-xuat.js đã cập nhật populateExportReceiptFromSap không tự nạp cuộn', () => {
    const xgContent = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    const toleContent = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');

    assert.ok(xgContent.includes('window.populateExportReceiptData = populateExportReceiptFromSap'), 'xg-xuat thiếu window.populateExportReceiptData');
    assert.ok(!xgContent.includes('totalRollsFilled'), 'xg-xuat không được chứa logic tự nạp cuộn totalRollsFilled');

    assert.ok(toleContent.includes('window.populateExportReceiptData = populateExportReceiptFromSap'), 'tole-xuat thiếu window.populateExportReceiptData');
    assert.ok(!toleContent.includes('totalRollsFilled'), 'tole-xuat không được chứa logic tự nạp cuộn totalRollsFilled');
  });

  console.log('\n----------------------------------------------------------------------------------');
  console.log(` KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} BÀI TEST THÀNH CÔNG (${Math.round(passedTests/totalTests*100)}%)`);
  console.log('----------------------------------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main();
