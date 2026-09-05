const assert = require('assert');

// Import or require parseCoilBarcode
let parseCoilBarcode;
try {
  const qrService = require('../assets/js/core/qr-scanner-service.js');
  parseCoilBarcode = qrService.parseCoilBarcode;
} catch (e) {
  // If not exported yet
}

console.log('--- RUNNING COIL BARCODE PARSER TESTS ---');

assert(typeof parseCoilBarcode === 'function', 'parseCoilBarcode must be a function exported by qr-scanner-service.js');

// Test 1: Standard 3 parts format (Mã VT-Batch-Khối lượng)
const res1 = parseCoilBarcode('10001189-2X349VN-1472');
assert.deepStrictEqual(res1, {
  maVatTu: '10001189',
  batch: '2X349VN',
  kg: 1472,
  rawText: '10001189-2X349VN-1472'
});
console.log('✅ Test 1 Passed: Standard format 10001189-2X349VN-1472');

// Test 2: Batch containing hyphens
const res2 = parseCoilBarcode('10001189-2X-349VN-1472.5');
assert.deepStrictEqual(res2, {
  maVatTu: '10001189',
  batch: '2X-349VN',
  kg: 1472.5,
  rawText: '10001189-2X-349VN-1472.5'
});
console.log('✅ Test 2 Passed: Batch with hyphen 10001189-2X-349VN-1472.5');

// Test 3: Decimal weight with comma (e.g. 2130,5)
const res3 = parseCoilBarcode('10001264-VN-2130,5');
assert.deepStrictEqual(res3, {
  maVatTu: '10001264',
  batch: 'VN',
  kg: 2130.5,
  rawText: '10001264-VN-2130,5'
});
console.log('✅ Test 3 Passed: Comma decimal weight 10001264-VN-2130,5');

// Test 4: Trimming spaces around delimiters
const res4 = parseCoilBarcode('  10001244 - 2X349VN - 2310  ');
assert.strictEqual(res4.maVatTu, '10001244');
assert.strictEqual(res4.batch, '2X349VN');
assert.strictEqual(res4.kg, 2310);
console.log('✅ Test 4 Passed: Extra whitespace handled properly');

// Test 5: Two parts format (Mã VT-Batch without weight)
const res5 = parseCoilBarcode('10001189-2X349VN');
assert.deepStrictEqual(res5, {
  maVatTu: '10001189',
  batch: '2X349VN',
  kg: null,
  rawText: '10001189-2X349VN'
});
console.log('✅ Test 5 Passed: 2-part format 10001189-2X349VN');

// Test 6: Invalid inputs
assert.strictEqual(parseCoilBarcode(''), null);
assert.strictEqual(parseCoilBarcode(null), null);
assert.strictEqual(parseCoilBarcode('A01'), null);
assert.strictEqual(parseCoilBarcode('10001189'), null);
console.log('✅ Test 6 Passed: Single part invalid inputs return null');

console.log('🎉 ALL COIL BARCODE PARSER TESTS PASSED!');
