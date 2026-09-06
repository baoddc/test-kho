const assert = require('assert');
const {
  buildVirtualKey,
  parseExcelRows,
  aggregateSystemStock,
  aggregateScannedRolls,
  reconcile3Way,
  normalizeNumber
} = require('../assets/js/tem-nhan-kiem-ke/kiem-ke-engine.js');

console.log('--- TEST KIEM KE ENGINE ---');

// Test 1: buildVirtualKey
assert.strictEqual(buildVirtualKey('10001189', '2.5X75VN'), '10001189-2.5X75VN');
assert.strictEqual(buildVirtualKey('  10001189  ', '  2.5X75VN  '), '10001189-2.5X75VN');
console.log('✅ Test 1 Passed: buildVirtualKey');

// Test 2: normalizeNumber
assert.strictEqual(normalizeNumber('1.250,5'), 1250.5);
assert.strictEqual(normalizeNumber('1,250.5'), 1250.5);
assert.strictEqual(normalizeNumber(2500), 2500);
assert.strictEqual(normalizeNumber(''), 0);
console.log('✅ Test 2 Passed: normalizeNumber');

// Test 3: parseExcelRows (Cột G = col 6, Cột K = col 10, Cột O = col 14 theo 0-index)
const mockRawExcel = [
  ['Header', '', '', '', '', '', 'Mã vật tư', '', '', '', 'Lô (Batch)', '', '', '', 'Số lượng'],
  ['', '', '', '', '', '', '10001189', '', '', '', '2.5X75VN', '', '', '', '1500'],
  ['', '', '', '', '', '', '10001189', '', '', '', '2.5X75VN', '', '', '', '1000'],
  ['', '', '', '', '', '', '10001200', '', '', '', 'BATCH-01', '', '', '', '2000.5']
];
const excelMap = parseExcelRows(mockRawExcel);
assert.strictEqual(excelMap.size, 2);
const item1 = excelMap.get('10001189-2.5X75VN');
assert.strictEqual(item1.totalKg, 2500);
assert.strictEqual(item1.count, 2);
console.log('✅ Test 3 Passed: parseExcelRows');

// Test 4: aggregateSystemStock
const mockSystemRolls = [
  { 'Mã vật tư': '10001189', 'Batch': '2.5X75VN', 'Số lượng (Kg)': 2500, 'Tên vật tư': 'Thép mạ kẽm' },
  { 'Mã vật tư': '10001300', 'Batch': 'BATCH-99', 'Số lượng (Kg)': 800, 'Tên vật tư': 'Tole cuộn' }
];
const systemMap = aggregateSystemStock(mockSystemRolls);
assert.strictEqual(systemMap.size, 2);
assert.strictEqual(systemMap.get('10001189-2.5X75VN').totalKg, 2500);
console.log('✅ Test 4 Passed: aggregateSystemStock');

// Test 5: reconcile3Way
const mockScannedList = [
  { maVatTu: '10001189', batch: '2.5X75VN', kg: 2500, barcode: '10001189-2.5X75VN-2500' }
];
const scannedMap = aggregateScannedRolls(mockScannedList);
const result = reconcile3Way(excelMap, systemMap, scannedMap);

assert(result.length >= 3);
const r1 = result.find(x => x.virtualKey === '10001189-2.5X75VN');
assert.strictEqual(r1.status, 'MATCH');
assert.strictEqual(r1.excelKg, 2500);
assert.strictEqual(r1.systemKg, 2500);
assert.strictEqual(r1.scannedKg, 2500);
console.log('✅ Test 5 Passed: reconcile3Way MATCH');
