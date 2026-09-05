const assert = require('assert');
const { parseCoilBarcode } = require('../assets/js/core/qr-scanner-service.js');

// Mock warehouse data similar to what's shown in the user's screenshot
const mockXgNhap = [
  { 'Cuộn ID': '10001189 - Cuộn 319', 'Mã vật tư': '10001189', 'Batch': '2X349VN', 'Số lượng (Kg)': 1472, 'Vị trí': 'A01', 'Ngày nhập': '2026-07-06' },
  { 'Cuộn ID': '10001189 - Cuộn 320', 'Mã vật tư': '10001189', 'Batch': '2X349VN', 'Số lượng (Kg)': 1474, 'Vị trí': 'A01', 'Ngày nhập': '2026-07-06' },
  { 'Cuộn ID': '10001189 - Cuộn 321', 'Mã vật tư': '10001189', 'Batch': '2X349VN', 'Số lượng (Kg)': 1466, 'Vị trí': 'A01', 'Ngày nhập': '2026-07-06' },
  { 'Cuộn ID': '10001189 - Cuộn 322', 'Mã vật tư': '10001189', 'Batch': '2X349VN', 'Số lượng (Kg)': 1500, 'Vị trí': 'B02', 'Ngày nhập': '2026-07-07' },
  { 'Cuộn ID': '10001264 - Cuộn 1',   'Mã vật tư': '10001264', 'Batch': 'VN',     'Số lượng (Kg)': 2130, 'Vị trí': 'A01', 'Ngày nhập': '2025-09-25' }
];

const mockXgXuat = [
  // Suppose Cuộn 322 was already exported
  { 'Cuộn ID': '10001189 - Cuộn 322' }
];

console.log('--- TESTING E2E LOGIC FOR COIL SCAN & BATCH STOCK CALCULATION ---');

// 1. Parse Barcode
const barcode = '10001189-2X349VN-1472';
const parsed = parseCoilBarcode(barcode);
assert(parsed !== null);
assert.strictEqual(parsed.maVatTu, '10001189');
assert.strictEqual(parsed.batch, '2X349VN');
assert.strictEqual(parsed.kg, 1472);
console.log('✅ 1. Barcode parsed successfully:', parsed);

// 2. Filter Active Rolls across Warehouse
const exportedSet = new Set(mockXgXuat.map(r => r['Cuộn ID'].trim().toLowerCase()));
const activeWarehouseRolls = mockXgNhap.filter(r => !exportedSet.has(r['Cuộn ID'].trim().toLowerCase()));

assert.strictEqual(activeWarehouseRolls.length, 4); // 5 total - 1 exported = 4 active
console.log('✅ 2. Active warehouse inventory calculated: 4 rolls active');

// 3. Match by Mã VT + Batch
const normMa = parsed.maVatTu.toLowerCase();
const normBatch = parsed.batch.toLowerCase();

const matchingRolls = activeWarehouseRolls.filter(r => 
  String(r['Mã vật tư']).trim().toLowerCase() === normMa &&
  String(r['Batch']).trim().toLowerCase() === normBatch
);

assert.strictEqual(matchingRolls.length, 3); // Cuộn 319, 320, 321
const totalBatchKg = matchingRolls.reduce((sum, r) => sum + r['Số lượng (Kg)'], 0);
assert.strictEqual(totalBatchKg, 1472 + 1474 + 1466); // 4412
console.log(`✅ 3. Warehouse total for batch ${parsed.batch}: ${matchingRolls.length} cuộn | ${totalBatchKg} Kg`);

// 4. Match with Current Rack 'A01'
const currentRack = 'A01';
const currentRackRolls = matchingRolls.filter(r => r['Vị trí'].toUpperCase() === currentRack);
assert.strictEqual(currentRackRolls.length, 3);
const currentRackKg = currentRackRolls.reduce((sum, r) => sum + r['Số lượng (Kg)'], 0);
assert.strictEqual(currentRackKg, 4412);
console.log(`✅ 4. Current rack (${currentRack}) stock for batch: ${currentRackRolls.length} cuộn | ${currentRackKg} Kg`);

// 5. Test exact weight match with scanned roll
const matchedWeightRolls = matchingRolls.filter(r => Math.abs(r['Số lượng (Kg)'] - parsed.kg) < 0.05);
assert.strictEqual(matchedWeightRolls.length, 1);
assert.strictEqual(matchedWeightRolls[0]['Cuộn ID'], '10001189 - Cuộn 319');
console.log('✅ 5. Identified matched roll with scanned weight: 10001189 - Cuộn 319');

console.log('🎉 ALL END-TO-END BUSINESS LOGIC VERIFICATIONS PASSED!');
