const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===============================================================');
console.log(' KIỂM THỬ SỬA LỖI TỰ KHÓA CUỘN KHO XG-XUAT VÀ TOLE-XUAT');
console.log('===============================================================\n');

let totalTests = 0;
let passedTests = 0;

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

// 1. Kiểm tra populateExportReceiptFromSap không còn tự gọi acquireLock
runTest('xg-xuat.js và tole-xuat.js: populateExportReceiptFromSap không tự động khóa cuộn tồn kho', () => {
  const xgContent = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
  const toleContent = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');

  // Trích xuất hàm populateExportReceiptFromSap
  const extractPopulateFn = (code) => {
    const start = code.indexOf('async function populateExportReceiptFromSap');
    assert.ok(start !== -1, 'Không tìm thấy hàm populateExportReceiptFromSap');
    const end = code.indexOf('// Expose bridge', start);
    return code.substring(start, end !== -1 ? end : start + 3000);
  };

  const xgFn = extractPopulateFn(xgContent);
  const toleFn = extractPopulateFn(toleContent);

  assert.ok(!xgFn.includes('acquireLock'), 'xg-xuat: populateExportReceiptFromSap không được chứa acquireLock');
  assert.ok(!toleFn.includes('acquireLock'), 'tole-xuat: populateExportReceiptFromSap không được chứa acquireLock');
});

// 2. Kiểm tra logic isMe trong inventory-lock-service.js
runTest('inventory-lock-service.js: getLockStatus nhận diện chính xác isMe cho cùng currentUser', () => {
  // Mock window & localStorage
  const mockStorage = {
    currentUser: 'bao.lt'
  };
  global.localStorage = {
    getItem: (k) => mockStorage[k] || null
  };
  global.window = {
    localStorage: global.localStorage
  };

  delete require.cache[require.resolve('../assets/js/core/inventory-lock-service.js')];
  require('../assets/js/core/inventory-lock-service.js');
  const service = global.window.inventoryLockService;

  // Giả lập khóa từ DB thuộc về 'bao.lt'
  const cuonId1 = '10001508 - Cuộn 0';
  service.activeLocks.set(cuonId1.toLowerCase(), {
    cuonId: cuonId1,
    lockedBy: 'bao.lt',
    expiresAt: Date.now() + 100000
  });

  const statusSameUser = service.getLockStatus(cuonId1);
  assert.strictEqual(statusSameUser.isLocked, true, 'Cuộn phải có isLocked = true');
  assert.strictEqual(statusSameUser.isMe, true, 'Khi currentUser trùng lockedBy thì isMe phải là true');

  // Giả lập khóa từ DB thuộc về 'user_khac'
  const cuonId2 = 'Cuon Khac';
  service.activeLocks.set(cuonId2.toLowerCase(), {
    cuonId: cuonId2,
    lockedBy: 'user_khac',
    expiresAt: Date.now() + 100000
  });

  const statusOtherUser = service.getLockStatus(cuonId2);
  assert.strictEqual(statusOtherUser.isLocked, true, 'Cuộn phải có isLocked = true');
  assert.strictEqual(statusOtherUser.isMe, false, 'Khi lockedBy là người khác thì isMe phải là false');
});

// 3. Kiểm tra openInventoryModal đã gọi refreshLocks trước cleanOrphanLocks
runTest('xg-xuat.js và tole-xuat.js: openInventoryModal gọi refreshLocks trước cleanOrphanLocks', () => {
  const xgContent = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
  const toleContent = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');

  const pattern = /refreshLocks\(false\)[\s\S]*?cleanOrphanLocks/;
  assert.ok(pattern.test(xgContent), 'xg-xuat phải refreshLocks trước cleanOrphanLocks');
  assert.ok(pattern.test(toleContent), 'tole-xuat phải refreshLocks trước cleanOrphanLocks');
});

console.log('\n---------------------------------------------------------------');
console.log(` KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} BÀI TEST THÀNH CÔNG (${Math.round(passedTests/totalTests*100)}%)`);
console.log('---------------------------------------------------------------');

if (passedTests !== totalTests) {
  process.exit(1);
}
