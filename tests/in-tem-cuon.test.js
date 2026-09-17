const assert = require('assert');
const {
  formatCoilBarcodeData,
  normalizeExcelRow,
  calculateStorageAge,
  sortCoilsByStorageAge,
  parseRowDate
} = require('../assets/js/tem-nhan-kiem-ke/in-tem-cuon.js');

console.log('--- RUNNING TESTS FOR IN-TEM-CUON LOGIC ---');

// Test 1: Barcode string standard mode
const sampleRow1 = {
  'Mã vật tư': '10001189',
  'Batch': '2.5X75VN',
  'Số lượng (Kg)': 2570.4,
  'Cuộn ID': '10001189 - Cuộn 101'
};
assert.strictEqual(formatCoilBarcodeData(sampleRow1, 'standard'), '10001189-2.5X75VN-2570');
console.log('✅ Test 1 passed: Standard barcode string format correct');

// Test 2: Barcode string cuon_id mode
assert.strictEqual(formatCoilBarcodeData(sampleRow1, 'cuon_id'), '10001189 - Cuộn 101');
console.log('✅ Test 2 passed: Cuộn ID barcode string format correct');

// Test 3: Excel header normalization including storage age
const rawExcelRow = {
  'MÃ VẬT TƯ': '10001234',
  'TÊN HÀNG HÓA': 'XÀ GỒ MẠ KẼM C200',
  'Số Lô': 'BATCH-99',
  'Mã Cuộn': 'CUON-991',
  'Khối lượng (kg)': '1850.5',
  'Vị Trí': 'a02',
  'Thời gian lưu kho': '45',
  'Ngày nhập': '2024-01-10',
  'Tên Công Trình': 'Dự Án Sunwah'
};
const normalized = normalizeExcelRow(rawExcelRow);
assert.strictEqual(normalized['Mã vật tư'], '10001234');
assert.strictEqual(normalized['Tên vật tư'], 'XÀ GỒ MẠ KẼM C200');
assert.strictEqual(normalized['Batch'], 'BATCH-99');
assert.strictEqual(normalized['Cuộn ID'], 'CUON-991');
assert.strictEqual(normalized['Số lượng (Kg)'], 1850.5);
assert.strictEqual(normalized['Vị trí'], 'A02');
assert.strictEqual(normalized['Thời gian lưu kho'], 45);
assert.strictEqual(normalized['Ngày nhập'], '2024-01-10');
assert.strictEqual(normalized['Tên công trình'], 'Dự Án Sunwah');
console.log('✅ Test 3 passed: Excel header normalization correct');

// Test 4: calculateStorageAge calculation
const today = new Date();
today.setHours(0, 0, 0, 0);

// Exactly 10 days ago
const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);
const isoStr = `${tenDaysAgo.getFullYear()}-${String(tenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(tenDaysAgo.getDate()).padStart(2, '0')}`;
const ageIso = calculateStorageAge(isoStr);
assert.strictEqual(ageIso, 10, 'Should calculate exactly 10 days');

// Fallback days support
const ageFallback = calculateStorageAge(null, '60');
assert.strictEqual(ageFallback, 60, 'Should use fallback days when no date string is provided');
console.log('✅ Test 4 passed: calculateStorageAge correctly computes days');

// Test 5: sortCoilsByStorageAge ascending (từ nhỏ đến lớn)
const unsortedCoils = [
  { 'Cuộn ID': 'Cuộn 4', _storageAge: 120 },
  { 'Cuộn ID': 'Cuộn 1', _storageAge: 5 },
  { 'Cuộn ID': 'Cuộn 3', _storageAge: 45 },
  { 'Cuộn ID': 'Cuộn 5', _storageAge: null },
  { 'Cuộn ID': 'Cuộn 2', _storageAge: 15 }
];

const sortedAsc = sortCoilsByStorageAge(unsortedCoils, true);
assert.strictEqual(sortedAsc[0]['Cuộn ID'], 'Cuộn 1', 'Smallest storage age (5) should be first');
assert.strictEqual(sortedAsc[1]['Cuộn ID'], 'Cuộn 2', 'Second smallest storage age (15) should be second');
assert.strictEqual(sortedAsc[2]['Cuộn ID'], 'Cuộn 3', 'Third storage age (45) should be third');
assert.strictEqual(sortedAsc[3]['Cuộn ID'], 'Cuộn 4', 'Storage age (120) should be fourth');
assert.strictEqual(sortedAsc[4]['Cuộn ID'], 'Cuộn 5', 'Null storage age should be placed at the end');
console.log('✅ Test 5 passed: sortCoilsByStorageAge correctly sorts ascending (nhỏ đến lớn)');

console.log('🎉 ALL IN-TEM-CUON UNIT TESTS PASSED!');

module.exports = {
  formatCoilBarcodeData,
  normalizeExcelRow,
  calculateStorageAge,
  sortCoilsByStorageAge,
  parseRowDate
};
