const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseCoilBarcode } = require('../assets/js/core/qr-scanner-service.js');
const { formatCoilBarcodeData, normalizeExcelRow } = require('./in-tem-cuon.test.js');

console.log('=== STARTING END-TO-END VERIFICATION FOR IN-TEM-CUON ===');

// 1. Verify HTML File & Essential IDs
const htmlPath = path.join(__dirname, '..', 'pages', 'tem-nhan-kiem-ke', 'in-tem-cuon.html');
assert.ok(fs.existsSync(htmlPath), 'in-tem-cuon.html must exist');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const requiredIds = [
  'sourceSelect',
  'excelFileInput',
  'btnTriggerUploadExcel',
  'btnReloadData',
  'barcodeModeSelect',
  'chkShowLogo',
  'chkShowProject',
  'rackMatrixContainer',
  'searchInput',
  'coilTableBody',
  'chkSelectAllCoils',
  'tableSelectedCount',
  'tableTotalCount',
  'labelsContainer',
  'btnPrint',
  'btnExportZip'
];

requiredIds.forEach(id => {
  assert.ok(htmlContent.includes(`id="${id}"`), `HTML must contain element with id="${id}"`);
});
console.log('✅ Step 1 passed: All 16 required interactive elements and IDs exist in in-tem-cuon.html');

// 2. Verify CSS File & Print Stylesheet
const cssPath = path.join(__dirname, '..', 'assets', 'css', 'tem-nhan-kiem-ke', 'in-tem-cuon.css');
assert.ok(fs.existsSync(cssPath), 'in-tem-cuon.css must exist');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert.ok(cssContent.includes('@media print'), 'CSS must include @media print');
assert.ok(cssContent.includes('repeat(2, 1fr)'), 'CSS must specify 2-column grid for labels');
assert.ok(cssContent.includes('page-break-inside: avoid'), 'CSS must prevent splitting cards across pages');
console.log('✅ Step 2 passed: Print stylesheet and 2-column A4 grid configured correctly');

// 3. Verify JS File & JsBarcode Configurations
const jsPath = path.join(__dirname, '..', 'assets', 'js', 'tem-nhan-kiem-ke', 'in-tem-cuon.js');
assert.ok(fs.existsSync(jsPath), 'in-tem-cuon.js must exist');
const jsContent = fs.readFileSync(jsPath, 'utf8');

assert.ok(jsContent.includes('width: 4'), 'JsBarcode must use width: 4');
assert.ok(jsContent.includes('height: 90'), 'JsBarcode must use height: 90');
assert.ok(jsContent.includes('fontSize: 35'), 'JsBarcode must use fontSize: 35');
assert.ok(jsContent.includes('displayValue: true'), 'JsBarcode must use displayValue: true');
console.log('✅ Step 3 passed: JsBarcode width 4px, height 90px, fontSize 35px explicitly configured in controller');

// 4. E2E Barcode Generation & Round-Trip Scanner Compatibility
const sampleWarehouseRolls = [
  { 'Cuộn ID': '10001189 - Cuộn 319', 'Mã vật tư': '10001189', 'Batch': '2X349VN', 'Số lượng (Kg)': 1472, 'Vị trí': 'A01' },
  { 'Cuộn ID': '10001264 - Cuộn 1',   'Mã vật tư': '10001264', 'Batch': 'VN',     'Số lượng (Kg)': 2130, 'Vị trí': 'B03' },
  { 'Cuộn ID': '10001999 - Cuộn 45',  'Mã vật tư': '10001999', 'Batch': '0.45X1200', 'Số lượng (Kg)': 3420, 'Vị trí': 'GRATING' }
];

sampleWarehouseRolls.forEach(roll => {
  const generatedBarcode = formatCoilBarcodeData(roll, 'standard');
  const parsed = parseCoilBarcode(generatedBarcode);
  assert.ok(parsed !== null, `Generated barcode "${generatedBarcode}" must be parseable by qrScannerService`);
  assert.strictEqual(parsed.maVatTu, roll['Mã vật tư'], 'Parsed maVatTu matches original');
  assert.strictEqual(parsed.batch, roll['Batch'], 'Parsed batch matches original');
  assert.strictEqual(parsed.kg, roll['Số lượng (Kg)'], 'Parsed kg matches original');
  console.log(`✅ Step 4 verified roll [${roll['Cuộn ID']}]: Barcode -> "${generatedBarcode}" -> Scanner parsed cleanly`);
});

// 5. Excel Import Simulation & Header Normalization
const mockExcelRows = [
  { 'mã vật tư': '10002222', 'Tên Hàng': 'Thép cuộn mạ kẽm Z275', 'Số Lô': 'BATCH-01', 'Mã cuộn': 'CID-001', 'khối lượng (kg)': '1500.5', 'kệ': 'A05' },
  { 'Mã VT': '10003333', 'Tên vật tư': 'Tole cuộn Bluescope', 'Batch': 'BLU-99', 'Cuộn ID': 'CID-002', 'Số lượng (Kg)': '2100', 'vị trí': 'B12' }
];

mockExcelRows.forEach((row, i) => {
  const norm = normalizeExcelRow(row);
  assert.ok(norm['Mã vật tư'].length > 0, `Row ${i} must have Mã vật tư`);
  assert.ok(norm['Batch'].length > 0, `Row ${i} must have Batch`);
  assert.ok(norm['Số lượng (Kg)'] > 0, `Row ${i} must have positive Kg`);
  assert.ok(norm['Vị trí'].length > 0, `Row ${i} must have Vị trí`);
  const bc = formatCoilBarcodeData(norm, 'standard');
  assert.ok(bc.includes(norm['Mã vật tư']), 'Barcode includes Mã VT');
  assert.ok(bc.includes(norm['Batch']), 'Barcode includes Batch');
});
console.log('✅ Step 5 passed: Excel import simulation normalized and formatted correctly');

console.log('🎉 ALL END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!');
