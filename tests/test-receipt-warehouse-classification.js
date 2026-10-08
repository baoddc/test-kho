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
            const dataResult = val.includes('4900111111')
              ? [{ material_document: '4900111111', material_group: '10040-Phôi xà gồ mạ' }]
              : (val.includes('4900222222')
                ? [{ material_document: '4900222222', material_group: '10030-Phôi tôn mạ' }]
                : []);
            return {
              limit: () => Promise.resolve({ data: dataResult, error: null }),
              then: (resolve) => resolve({ data: dataResult, error: null })
            };
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
