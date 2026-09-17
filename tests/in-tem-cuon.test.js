const assert = require('assert');

// Logic under test: helper functions for in-tem-cuon
function formatCoilBarcodeData(row, mode = 'standard') {
  if (!row) return '';
  if (mode === 'cuon_id') {
    return String(row['Cuộn ID'] || row['cuon_id'] || row['CuonID'] || '').trim();
  }
  const maVt = String(row['Mã vật tư'] || row['ma_vat_tu'] || row['Mã VT'] || '').trim();
  const batch = String(row['Batch'] || row['batch'] || row['Lô'] || '').trim();
  const rawKg = row['Số lượng (Kg)'] ?? row['Khối lượng (kg)'] ?? row['kg'] ?? row['Khoi_luong_kg'] ?? 0;
  const numKg = Math.round(Number(String(rawKg).replace(',', '.')) || 0);
  if (!maVt && !batch) return '';
  return `${maVt}-${batch}-${numKg}`;
}

function normalizeExcelRow(rawRow) {
  const row = {};
  for (const key of Object.keys(rawRow)) {
    const cleanKey = key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (cleanKey.includes('ma vat tu') || cleanKey === 'ma vt' || cleanKey === 'mavt') {
      row['Mã vật tư'] = String(rawRow[key] || '').trim();
    } else if (cleanKey.includes('ten vat tu') || cleanKey.includes('ten hang') || cleanKey === 'tenvt') {
      row['Tên vật tư'] = String(rawRow[key] || '').trim();
    } else if (cleanKey === 'batch' || cleanKey.includes('so lo') || cleanKey === 'lo') {
      row['Batch'] = String(rawRow[key] || '').trim();
    } else if (cleanKey.includes('cuon id') || cleanKey.includes('ma cuon') || cleanKey === 'cuonid') {
      row['Cuộn ID'] = String(rawRow[key] || '').trim();
    } else if (cleanKey.includes('so luong') || cleanKey.includes('khoi luong') || cleanKey.includes('kg')) {
      row['Số lượng (Kg)'] = Number(String(rawRow[key] || 0).replace(',', '.')) || 0;
    } else if (cleanKey.includes('vi tri') || cleanKey === 'ke' || cleanKey === 'vitri') {
      row['Vị trí'] = String(rawRow[key] || '').trim().toUpperCase();
    } else if (cleanKey.includes('ngay nhap')) {
      row['Ngày nhập'] = String(rawRow[key] || '').trim();
    } else if (cleanKey.includes('cong trinh')) {
      row['Tên công trình'] = String(rawRow[key] || '').trim();
    }
  }
  return row;
}

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

// Test 3: Excel header normalization
const rawExcelRow = {
  'MÃ VẬT TƯ': '10001234',
  'TÊN HÀNG HÓA': 'XÀ GỒ MẠ KẼM C200',
  'Số Lô': 'BATCH-99',
  'Mã Cuộn': 'CUON-991',
  'Khối lượng (kg)': '1850.5',
  'Vị Trí': 'a02',
  'Tên Công Trình': 'Dự Án Sunwah'
};
const normalized = normalizeExcelRow(rawExcelRow);
assert.strictEqual(normalized['Mã vật tư'], '10001234');
assert.strictEqual(normalized['Tên vật tư'], 'XÀ GỒ MẠ KẼM C200');
assert.strictEqual(normalized['Batch'], 'BATCH-99');
assert.strictEqual(normalized['Cuộn ID'], 'CUON-991');
assert.strictEqual(normalized['Số lượng (Kg)'], 1850.5);
assert.strictEqual(normalized['Vị trí'], 'A02');
assert.strictEqual(normalized['Tên công trình'], 'Dự Án Sunwah');
console.log('✅ Test 3 passed: Excel header normalization correct');

console.log('🎉 ALL IN-TEM-CUON UNIT TESTS PASSED!');

module.exports = {
  formatCoilBarcodeData,
  normalizeExcelRow
};
