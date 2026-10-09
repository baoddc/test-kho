const assert = require('assert');
const { checkDuplicate, insertBatchScannedRollsToSupabase } = require('../assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js');

console.log('--- TEST KIEM KE STORAGE ---');

const mockList = [
  { barcode: '10001189-2X349VN-1472', maVatTu: '10001189', batch: '2X349VN', kg: 1472, cuonId: 'ROLL-01' },
  { barcode: '10001200-BATCH2-2000', maVatTu: '10001200', batch: 'BATCH2', kg: 2000, cuonId: 'ROLL-02' }
];

assert.strictEqual(checkDuplicate(mockList, '10001189-2X349VN-1472'), true);
assert.strictEqual(checkDuplicate(mockList, 'ROLL-01'), true);
assert.strictEqual(checkDuplicate(mockList, '10001999-NEW-1000'), false);
console.log('✅ Test Passed: checkDuplicate detects existing barcode or cuonId');

// Test insertBatchScannedRollsToSupabase
async function testBatchInsert() {
  assert.strictEqual(typeof insertBatchScannedRollsToSupabase, 'function');

  // Test with mock Supabase client
  const insertedChunks = [];
  global.window = {
    supabase: {
      from: (tbl) => {
        assert.strictEqual(tbl, 'kiem_ke_scans');
        return {
          insert: (payload) => {
            insertedChunks.push(payload);
            return {
              select: async () => {
                const res = payload.map((p, idx) => ({
                  id: 100 + idx,
                  barcode: p.barcode,
                  created_at: '2026-10-09T11:00:00Z'
                }));
                return { data: res, error: null };
              }
            };
          }
        };
      }
    }
  };

  const rollsToInsert = [
    { barcode: 'B1-BATCH1-100', maVatTu: 'B1', batch: 'BATCH1', kg: 100 },
    { barcode: 'B2-BATCH2-200', maVatTu: 'B2', batch: 'BATCH2', kg: 200 }
  ];

  const result = await insertBatchScannedRollsToSupabase(rollsToInsert);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].id, '100');
  assert.strictEqual(result[1].id, '101');
  assert.strictEqual(insertedChunks.length, 1);
  assert.strictEqual(insertedChunks[0].length, 2);
  console.log('✅ Test Passed: insertBatchScannedRollsToSupabase chunks and updates records');
}

testBatchInsert().catch(err => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});

