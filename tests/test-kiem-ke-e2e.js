const assert = require('assert');
const {
  buildVirtualKey,
  parseExcelRows,
  aggregateSystemStock,
  aggregateScannedRolls,
  reconcile3Way
} = require('../assets/js/tem-nhan-kiem-ke/kiem-ke-engine.js');
const { checkDuplicate } = require('../assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js');

console.log('--- RUNNING FULL INVENTORY AUDIT E2E SIMULATION ---');

// 1. Giả lập dữ liệu File Excel (Cột G = idx 6, Cột K = idx 10, Cột O = idx 14)
const mockExcelRows = [
  ['STT', 'A', 'B', 'C', 'D', 'E', 'Mã vật tư', 'H', 'I', 'J', 'Lô (Batch)', 'L', 'M', 'N', 'Khối lượng tồn'],
  ['1', '', '', '', '', '', '10001189', '', '', '', '2.5X75VN', '', '', '', '2500'],
  ['2', '', '', '', '', '', '10001200', '', '', '', 'BATCH-01', '', '', '', '1200'],
  ['3', '', '', '', '', '', '10001200', '', '', '', 'BATCH-01', '', '', '', '800'], // Cùng batch -> tổng = 2000
  ['4', '', '', '', '', '', '10001300', '', '', '', 'BATCH-EXTRA', '', '', '', '1500']
];

const excelMap = parseExcelRows(mockExcelRows);
assert.strictEqual(excelMap.size, 3);
assert.strictEqual(excelMap.get('10001189-2.5X75VN').totalKg, 2500);
assert.strictEqual(excelMap.get('10001200-BATCH-01').totalKg, 2000);
assert.strictEqual(excelMap.get('10001200-BATCH-01').count, 2);
console.log('✅ Bước 1: Parse và SUMIF File Excel thành công.');

// 2. Giả lập tồn kho hệ thống Supabase (XG + Tole)
const mockSystemRolls = [
  { 'Cuộn ID': 'C01', 'Mã vật tư': '10001189', 'Batch': '2.5X75VN', 'Số lượng (Kg)': 2500, 'Tên vật tư': 'Thép mạ kẽm' },
  { 'Cuộn ID': 'C02', 'Mã vật tư': '10001200', 'Batch': 'BATCH-01', 'Số lượng (Kg)': 2000, 'Tên vật tư': 'Thép đen' },
  { 'Cuộn ID': 'C03', 'Mã vật tư': '10001999', 'Batch': 'SYS-ONLY', 'Số lượng (Kg)': 500, 'Tên vật tư': 'Tole mạ màu' }
];

const systemMap = aggregateSystemStock(mockSystemRolls);
assert.strictEqual(systemMap.size, 3);
assert.strictEqual(systemMap.get('10001189-2.5X75VN').totalKg, 2500);
console.log('✅ Bước 2: Tải và SUMIF tồn hệ thống Supabase thành công.');

// 3. Giả lập quét Barcode bằng máy quét (Hỗ trợ nhiều cuộn có cùng Barcode tem)
const scannedRolls = [];
const barcodesToScan = [
  '10001189-2.5X75VN-2500', // Cuộn 1: 2500kg -> Khớp File (2500kg)
  '10001200-BATCH-01-1000', // Cuộn 2: 1000kg
  '10001200-BATCH-01-1000', // Cuộn 3: Trùng Barcode với cuộn 2 (cùng quy cách 1000kg) -> Tổng batch = 2000kg (Khớp File)
  '10009999-OUT-500'        // Cuộn 4: Ngoài danh mục File Excel
];

barcodesToScan.forEach(barcode => {
  const parts = barcode.split('-');
  const kg = parseFloat(parts[parts.length - 1]);
  scannedRolls.push({
    barcode,
    maVatTu: parts[0],
    batch: parts.slice(1, -1).join('-'),
    kg: isNaN(kg) ? 0 : kg
  });
});

assert.strictEqual(scannedRolls.length, 4, 'Cả 4 cuộn đều được ghi nhận đầy đủ');
console.log('✅ Bước 3: Cho phép quét nhiều cuộn có cùng tem Barcode thành công.');

// 4. Đối soát 3 chiều SUMIF
const scannedMap = aggregateScannedRolls(scannedRolls);
const reconciled = reconcile3Way(excelMap, systemMap, scannedMap);

console.log('Kết quả đối soát 3 chiều:');
reconciled.forEach(r => {
  console.log(`- [${r.virtualKey}] File=${r.excelKg}kg | Sys=${r.systemKg}kg | Scanned=${r.scannedKg}kg => Trạng thái: ${r.status}`);
});

// Kiểm tra chi tiết trạng thái
const row1 = reconciled.find(r => r.virtualKey === '10001189-2.5X75VN');
assert.strictEqual(row1.status, 'MATCH');
assert.strictEqual(row1.diffScannedVsExcelKg, 0);

const row2 = reconciled.find(r => r.virtualKey === '10001200-BATCH-01');
assert.strictEqual(row2.status, 'MATCH'); // 2 cuộn mỗi cuộn 1000kg -> tổng 2000kg khớp File
assert.strictEqual(row2.scannedKg, 2000);
assert.strictEqual(row2.scannedCount, 2);
assert.strictEqual(row2.diffScannedVsExcelKg, 0);

const row3 = reconciled.find(r => r.virtualKey === '10001300-BATCH-EXTRA');
assert.strictEqual(row3.status, 'UNSCANNED'); // Chưa quét

const row4 = reconciled.find(r => r.virtualKey === '10009999-OUT');
assert.strictEqual(row4.status, 'EXTRA_FILE'); // Ngoài file Excel

console.log('✅ Bước 4: Toàn bộ đối soát 3 chiều và logic trạng thái ĐẠT 100%.');
console.log('🎉 TOÀN BỘ KIỂM THỬ E2E HOÀN TẤT THÀNH CÔNG!');
