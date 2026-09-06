const assert = require('assert');
const { checkDuplicate } = require('../assets/js/kiem-ke-storage.js');

console.log('--- TEST KIEM KE STORAGE ---');

const mockList = [
  { barcode: '10001189-2X349VN-1472', maVatTu: '10001189', batch: '2X349VN', kg: 1472, cuonId: 'ROLL-01' },
  { barcode: '10001200-BATCH2-2000', maVatTu: '10001200', batch: 'BATCH2', kg: 2000, cuonId: 'ROLL-02' }
];

assert.strictEqual(checkDuplicate(mockList, '10001189-2X349VN-1472'), true);
assert.strictEqual(checkDuplicate(mockList, 'ROLL-01'), true);
assert.strictEqual(checkDuplicate(mockList, '10001999-NEW-1000'), false);
console.log('✅ Test Passed: checkDuplicate detects existing barcode or cuonId');
