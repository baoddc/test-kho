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
    const isLocked = Boolean(res && res.isProcessed);
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
      String(r['Phiếu xuất']).toLowerCase() === String(doc).toLowerCase() &&
      String(r['Mã vật tư']).toLowerCase() === String(mat).toLowerCase() &&
      String(r['Batch']).toLowerCase() === String(batch).toLowerCase()
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
