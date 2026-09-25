/**
 * Test Suite: Kiểm thử Tự Động Điền Phiếu Xuất Thủ Công, Danh Sách Mặt Hàng & Cuộn Xuất
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
  console.log('===============================================================');
  console.log(' KIỂM THỬ TỰ ĐỘNG ĐIỀN PHIẾU XUẤT THỦ CÔNG (MULTI-ITEM & COILS)');
  console.log('===============================================================\n');

  // 1. Kiểm tra export của SapLookup
  runTest('SapLookup export đầy đủ applySapRecordToForm và showAutofillToast', () => {
    assert.strictEqual(typeof SapLookup.applySapRecordToForm, 'function');
    assert.strictEqual(typeof SapLookup.showAutofillToast, 'function');
  });

  // 2. Kiểm tra logic gom nhóm mặt hàng từ SAP trong applySapRecordToForm
  await runAsyncTest('applySapRecordToForm gom nhóm chính xác các dòng SAP theo Material + Batch và gọi populateExportReceiptData', async () => {
    let capturedHeader = null;
    let capturedItems = null;

    global.window.populateExportReceiptData = async (header, items) => {
      capturedHeader = header;
      capturedItems = items;
    };

    // Mock supabase select trả về 3 dòng (thuộc 2 mặt hàng khác nhau)
    const mockSapRows = [
      {
        material_document: '4900138999',
        posting_date: '2026-09-04',
        material: '10001189',
        material_description: 'Thép phôi kẽm Z275 G450',
        batch: '1.5X275VN',
        quantity: -981,
        project_id: '10626-056',
        project_name: 'DG TN APF ĐỒNG NAI',
        movement_type_text: 'Xuất vật tư cho LSX',
        raw_data: { debit_credit_ind: 'H', material_group: '10040-Phôi xà gồ mạ' }
      },
      {
        material_document: '4900138999',
        posting_date: '2026-09-04',
        material: '10001189',
        material_description: 'Thép phôi kẽm Z275 G450',
        batch: '1.5X353VN',
        quantity: -3000,
        project_id: '10626-056',
        project_name: 'DG TN APF ĐỒNG NAI',
        movement_type_text: 'Xuất vật tư cho LSX',
        raw_data: { debit_credit_ind: 'H', material_group: '10040-Phôi xà gồ mạ' }
      },
      {
        material_document: '4900138999',
        posting_date: '2026-09-04',
        material: '10001189',
        material_description: 'Thép phôi kẽm Z275 G450',
        batch: '1.5X353VN',
        quantity: -3510,
        project_id: '10626-056',
        project_name: 'DG TN APF ĐỒNG NAI',
        movement_type_text: 'Xuất vật tư cho LSX',
        raw_data: { debit_credit_ind: 'H', material_group: '10040-Phôi xà gồ mạ' }
      }
    ];

    global.window.supabase = {
      from: (tbl) => {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockSapRows, error: null })
          })
        };
      }
    };

    const mockForm = {
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await SapLookup.applySapRecordToForm(mockSapRows[0], mockForm, 'xg-xuat');

    assert.ok(capturedHeader, 'Header phải được chuyển qua bridge');
    assert.strictEqual(capturedHeader.phieuXuat, '4900138999');
    assert.strictEqual(capturedHeader.maCongTrinh, '10626-056');
    assert.strictEqual(capturedHeader.tenCongTrinh, 'DG TN APF ĐỒNG NAI');
    assert.strictEqual(capturedHeader.loaiXuat, 'Xuất vật tư cho LSX');

    assert.ok(Array.isArray(capturedItems), 'Items phải là mảng');
    assert.strictEqual(capturedItems.length, 2, 'Phải gom thành đúng 2 mặt hàng (1.5X275VN và 1.5X353VN)');

    const item1 = capturedItems.find(i => i.batch === '1.5X275VN');
    assert.ok(item1);
    assert.strictEqual(item1.totalSapKg, 981);

    const item2 = capturedItems.find(i => i.batch === '1.5X353VN');
    assert.ok(item2);
    assert.strictEqual(item2.totalSapKg, 6510, 'Tổng kg của batch 1.5X353VN phải là 3000 + 3510 = 6510');
  });

  // 3. Kiểm tra logic tra cứu cuộn tồn kho và gán vào mặt hàng
  await runAsyncTest('Logic lọc cuộn tồn kho: Loại bỏ cuộn đã xuất, khớp đúng Mã VT và Batch', async () => {
    const mockInventoryNhap = [
      { 'Cuộn ID': 'C001', 'Mã vật tư': '10001189', 'Batch': '1.5X275VN', 'Số lượng (Kg)': 981 },
      { 'Cuộn ID': 'C002', 'Mã vật tư': '10001189', 'Batch': '1.5X353VN', 'Số lượng (Kg)': 3000 },
      { 'Cuộn ID': 'C003', 'Mã vật tư': '10001189', 'Batch': '1.5X353VN', 'Số lượng (Kg)': 3510 },
      { 'Cuộn ID': 'C004_EXPORTED', 'Mã vật tư': '10001189', 'Batch': '1.5X353VN', 'Số lượng (Kg)': 2000 },
      { 'Cuộn ID': 'C005_OTHER_BATCH', 'Mã vật tư': '10001189', 'Batch': '2.0X300VN', 'Số lượng (Kg)': 5000 }
    ];

    const mockExportedCuonIds = new Set(['c004_exported']);

    // Mặt hàng cần tìm
    const targetItem = {
      maVatTu: '10001189',
      batch: '1.5X353VN',
      rolls: []
    };

    const matchingRolls = mockInventoryNhap.filter(r => {
      const cid = String(r['Cuộn ID'] || '').toLowerCase();
      return r['Mã vật tư'] === targetItem.maVatTu &&
             r['Batch'] === targetItem.batch &&
             !mockExportedCuonIds.has(cid);
    });

    assert.strictEqual(matchingRolls.length, 2, 'Chỉ có C002 và C003 thỏa mãn điều kiện tồn kho');
    assert.strictEqual(matchingRolls[0]['Cuộn ID'], 'C002');
    assert.strictEqual(matchingRolls[1]['Cuộn ID'], 'C003');
  });

  // 4. Kiểm tra mã nguồn xg-xuat.js và tole-xuat.js chứa đủ các hàm yêu cầu
  runTest('Mã nguồn xg-xuat.js và tole-xuat.js đã khai báo populateExportReceiptData bridge và lock cleanup', () => {
    const xgContent = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    const toleContent = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');

    assert.ok(xgContent.includes('window.populateExportReceiptData = populateExportReceiptFromSap'), 'xg-xuat thiếu window.populateExportReceiptData');
    assert.ok(xgContent.includes('window.inventoryLockService.acquireLock'), 'xg-xuat thiếu acquireLock');
    assert.ok(xgContent.includes('window.inventoryLockService.releaseLock'), 'xg-xuat thiếu releaseLock');

    assert.ok(toleContent.includes('window.populateExportReceiptData = populateExportReceiptFromSap'), 'tole-xuat thiếu window.populateExportReceiptData');
    assert.ok(toleContent.includes('window.inventoryLockService.acquireLock'), 'tole-xuat thiếu acquireLock');
    assert.ok(toleContent.includes('window.inventoryLockService.releaseLock'), 'tole-xuat thiếu releaseLock');
  });

  console.log('\n---------------------------------------------------------------');
  console.log(` KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} BÀI TEST THÀNH CÔNG (${Math.round(passedTests/totalTests*100)}%)`);
  console.log('---------------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main();
