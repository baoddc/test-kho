/**
 * Test Suite: Kiểm tra quy tắc phân loại & ràng buộc dữ liệu SAP MB51 (Google Sheets)
 * Áp dụng cho: xg-nhap, xg-xuat, tole-nhap, tole-xuat
 */

const assert = require('assert');
const path = require('path');

// Mock window object for Node.js environment
global.window = {};

const SapLookup = require('../assets/js/xg/xg-sap-lookup.js');

console.log('===============================================================');
console.log(' KIỂM THỬ RÀNG BUỘC PHÂN LOẠI SAP GOOGLE SHEETS (MB51)');
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

// 1. Kiểm tra cấu hình SAP_PAGE_RULES
runTest('Cấu hình SAP_PAGE_RULES chứa đủ 4 trang', () => {
  const rules = SapLookup.SAP_PAGE_RULES;
  assert.ok(rules['xg-nhap'], 'Thiếu xg-nhap');
  assert.ok(rules['xg-xuat'], 'Thiếu xg-xuat');
  assert.ok(rules['tole-nhap'], 'Thiếu tole-nhap');
  assert.ok(rules['tole-xuat'], 'Thiếu tole-xuat');

  assert.deepStrictEqual(rules['xg-nhap'].debitCredit, ['S']);
  assert.deepStrictEqual(rules['xg-xuat'].debitCredit, ['H']);
  assert.deepStrictEqual(rules['tole-nhap'].debitCredit, ['S']);
  assert.deepStrictEqual(rules['tole-xuat'].debitCredit, ['H']);
});

// 2. Kiểm tra nhận diện ngữ cảnh trang
runTest('Hàm detectCurrentPageContext nhận diện chính xác', () => {
  assert.strictEqual(SapLookup.detectCurrentPageContext('xg-xuat'), 'xg-xuat');
  assert.strictEqual(SapLookup.detectCurrentPageContext('tole-nhap'), 'tole-nhap');
  
  global.window.location = { pathname: '/pages/xg/xg-xuat.html' };
  assert.strictEqual(SapLookup.detectCurrentPageContext(), 'xg-xuat');

  global.window.location = { pathname: '/pages/tole/tole-nhap.html' };
  assert.strictEqual(SapLookup.detectCurrentPageContext(), 'tole-nhap');

  global.window.location = { pathname: '/pages/tole/tole-xuat.html' };
  assert.strictEqual(SapLookup.detectCurrentPageContext(), 'tole-xuat');

  global.window.location = { pathname: '/pages/xg/xg-nhap.html' };
  assert.strictEqual(SapLookup.detectCurrentPageContext(), 'xg-nhap');
});

// 3. Kiểm tra trích xuất thuộc tính từ raw_data JSONB
runTest('Trích xuất thuộc tính từ trường trực tiếp hoặc raw_data', () => {
  const fromDirect = SapLookup.extractSapRowAttributes({
    debit_credit_ind: 'S',
    material_group: '10040-Phôi xà gồ mạ'
  });
  assert.strictEqual(fromDirect.dc, 'S');
  assert.strictEqual(fromDirect.group, '10040-Phôi xà gồ mạ');

  const fromRaw = SapLookup.extractSapRowAttributes({
    raw_data: {
      debit_credit_ind: 'h',
      material_group: '10030-Phôi tôn mạ'
    }
  });
  assert.strictEqual(fromRaw.dc, 'H');
  assert.strictEqual(fromRaw.group, '10030-Phôi tôn mạ');
});

// 4. Kiểm tra quy tắc TRANG XÀ GỒ NHẬP (xg-nhap)
runTest('Quy tắc xg-nhap: Chỉ nhận S và nhóm 10040, 10041', () => {
  // Hợp lệ: S + 10040
  const valid1 = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'S',
    material_group: '10040-Phôi xà gồ mạ'
  }, 'xg-nhap');
  assert.strictEqual(valid1.isValid, true);

  // Hợp lệ: S + 10041
  const valid2 = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'S',
    material_group: '10041-Xà gồ'
  }, 'xg-nhap');
  assert.strictEqual(valid2.isValid, true);

  // Không hợp lệ: H (Xuất) thay vì S
  const invalidDc = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'H',
    material_group: '10040-Phôi xà gồ mạ'
  }, 'xg-nhap');
  assert.strictEqual(invalidDc.isValid, false);
  assert.strictEqual(invalidDc.isDcMatch, false);

  // Không hợp lệ: Nhóm Tole thay vì Xà gồ
  const invalidGroup = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'S',
    material_group: '10030-Phôi tôn mạ'
  }, 'xg-nhap');
  assert.strictEqual(invalidGroup.isValid, false);
  assert.strictEqual(invalidGroup.isGroupMatch, false);
});

// 5. Kiểm tra quy tắc TRANG XÀ GỒ XUẤT (xg-xuat)
runTest('Quy tắc xg-xuat: Chỉ nhận H và nhóm 10040, 10041', () => {
  const valid1 = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'H',
    material_group: '10040-Phôi xà gồ mạ'
  }, 'xg-xuat');
  assert.strictEqual(valid1.isValid, true);

  const invalidDc = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'S',
    material_group: '10040-Phôi xà gồ mạ'
  }, 'xg-xuat');
  assert.strictEqual(invalidDc.isValid, false);

  const invalidGroup = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'H',
    material_group: '10031-Tôn'
  }, 'xg-xuat');
  assert.strictEqual(invalidGroup.isValid, false);
});

// 6. Kiểm tra quy tắc TRANG TOLE NHẬP (tole-nhap)
runTest('Quy tắc tole-nhap: Chỉ nhận S và nhóm 10030, 10031, 10022, 10091', () => {
  const toleGroups = [
    '10030-Phôi tôn mạ',
    '10031-Tôn',
    '10022-Thép cuộn Inox',
    '10091-Nhôm cuộn'
  ];

  toleGroups.forEach(grp => {
    const res = SapLookup.validateSapRecordAgainstContext({
      debit_credit_ind: 'S',
      material_group: grp
    }, 'tole-nhap');
    assert.strictEqual(res.isValid, true, `Thất bại tại nhóm ${grp}`);
  });

  // Chặn phiếu H
  const invalidDc = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'H',
    material_group: '10030-Phôi tôn mạ'
  }, 'tole-nhap');
  assert.strictEqual(invalidDc.isValid, false);

  // Chặn phiếu Xà gồ
  const invalidXg = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'S',
    material_group: '10040-Phôi xà gồ mạ'
  }, 'tole-nhap');
  assert.strictEqual(invalidXg.isValid, false);
});

// 7. Kiểm tra quy tắc TRANG TOLE XUẤT (tole-xuat)
runTest('Quy tắc tole-xuat: Chỉ nhận H và nhóm 10030, 10031, 10022, 10091', () => {
  const toleGroups = [
    '10030-Phôi tôn mạ',
    '10031-Tôn',
    '10022-Thép cuộn Inox',
    '10091-Nhôm cuộn'
  ];

  toleGroups.forEach(grp => {
    const res = SapLookup.validateSapRecordAgainstContext({
      debit_credit_ind: 'H',
      material_group: grp
    }, 'tole-xuat');
    assert.strictEqual(res.isValid, true, `Thất bại tại nhóm ${grp}`);
  });

  // Chặn phiếu S
  const invalidDc = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'S',
    material_group: '10030-Phôi tôn mạ'
  }, 'tole-xuat');
  assert.strictEqual(invalidDc.isValid, false);

  // Chặn phiếu Xà gồ
  const invalidXg = SapLookup.validateSapRecordAgainstContext({
    debit_credit_ind: 'H',
    material_group: '10041-Xà gồ'
  }, 'tole-xuat');
  assert.strictEqual(invalidXg.isValid, false);
});

console.log('\n---------------------------------------------------------------');
console.log(` KẾT QUẢ KIỂM THỬ: ${passCount}/${totalTests} BÀI TEST THÀNH CÔNG (${Math.round((passCount/totalTests)*100)}%)`);
console.log('---------------------------------------------------------------');

if (passCount !== totalTests) {
  process.exit(1);
}
