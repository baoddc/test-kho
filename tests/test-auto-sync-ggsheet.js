/**
 * Test Suite: Kiểm tra concurrency guard và auto-sync options trong xg-sap-lookup.js
 */

const assert = require('assert');

// Mock môi trường trình duyệt cho Node.js
global.window = {};
global.document = {
  createElement: () => ({ textContent: '', setAttribute: () => {} }),
  head: { appendChild: () => {} },
  querySelector: () => null,
  getElementById: () => null
};

const SapLookup = require('../assets/js/xg/xg-sap-lookup.js');

console.log('===============================================================');
console.log(' KIỂM THỬ CONCURRENCY GUARD & AUTO-SYNC GOOGLE SHEETS');
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
  // Test 1: Kiểm tra hàm syncFromGoogleSheets tồn tại
  runTest('Hàm syncFromGoogleSheets được xuất ra window.XgSapLookup', () => {
    assert.strictEqual(typeof SapLookup.syncFromGoogleSheets, 'function');
  });

  // Test 2: Kiểm tra hàm trả về an toàn khi Supabase chưa khởi tạo và isAuto = true
  await runAsyncTest('syncFromGoogleSheets trả về an toàn khi options.isAuto = true và supabase null', async () => {
    global.window.supabase = null;
    let toastCalled = false;
    SapLookup.showAutofillToast = (msg) => { toastCalled = true; };

    const mockBtn = { disabled: false, innerHTML: 'Sync' };
    await SapLookup.syncFromGoogleSheets(mockBtn, { isAuto: true });
    assert.strictEqual(mockBtn.disabled, false);
  });

  // Test 3: Kiểm tra Concurrency Guard khi 2 lời gọi diễn ra đồng thời
  await runAsyncTest('Cơ chế Concurrency Guard tái sử dụng promise và không gọi trùng lặp', async () => {
    let fetchCount = 0;
    global.window.supabase = {
      from: () => ({
        delete: () => ({ gt: async () => ({ error: null }) }),
        insert: async () => ({ error: null })
      })
    };

    // Mock fetch có delay để giả lập request đang chạy
    global.fetch = async () => {
      fetchCount++;
      await new Promise(r => setTimeout(r, 50));
      return {
        ok: true,
        text: async () => 'google.visualization.Query.setResponse({"table":{"rows":[]}});'
      };
    };

    const mockBtn1 = { disabled: false, innerHTML: 'Sync 1' };
    const mockBtn2 = { disabled: false, innerHTML: 'Sync 2' };

    // Kích hoạt song song
    const p1 = SapLookup.syncFromGoogleSheets(mockBtn1, { isAuto: true });
    const p2 = SapLookup.syncFromGoogleSheets(mockBtn2, { isAuto: true });

    // Cả 2 phải trả về cùng một Promise
    assert.strictEqual(p1, p2, 'Lần gọi thứ 2 phải tái sử dụng Promise của lần gọi thứ 1');

    await Promise.all([p1, p2]);

    assert.strictEqual(fetchCount, 1, 'Chỉ được fetch Google Sheets đúng 1 lần duy nhất');
    assert.strictEqual(mockBtn1.disabled, false);
    assert.strictEqual(mockBtn2.disabled, false);
  });

  console.log(`\nTổng kết: ${passCount}/${totalTests} bài test thành công.\n`);
  if (passCount !== totalTests) {
    process.exit(1);
  }
})();
