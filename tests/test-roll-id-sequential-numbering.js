const assert = require('assert');
const fs = require('fs');
const path = require('path');

function runTests() {
  console.log('===============================================================');
  console.log(' KIỂM THỬ THUẬT TOÁN ĐÁNH SỐ CUỘN ID KẾ TIẾP (MAX + 1)');
  console.log('===============================================================');

  // Đọc mã nguồn xg-nhap.js để kiểm tra tính sẵn sàng của hàm
  const xgNhapCode = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-nhap.js'), 'utf8');
  assert.ok(xgNhapCode.includes('function extractRollIndex'), 'xg-nhap.js phải định nghĩa extractRollIndex');
  assert.ok(xgNhapCode.includes('function getNextRollNumber'), 'xg-nhap.js phải định nghĩa getNextRollNumber');

  // Kiểm thử logic thuật toán
  const extractMatch = xgNhapCode.match(/function extractRollIndex\([\s\S]*?\n\}/);
  const getNextMatch = xgNhapCode.match(/function getNextRollNumber\([\s\S]*?\n\}/);
  assert.ok(extractMatch, 'Tìm thấy hàm extractRollIndex trong xg-nhap.js');
  assert.ok(getNextMatch, 'Tìm thấy hàm getNextRollNumber trong xg-nhap.js');

  const evalScope = {};
  new Function('scope', `${extractMatch[0]}; ${getNextMatch[0]}; scope.extractRollIndex = extractRollIndex; scope.getNextRollNumber = getNextRollNumber;`)(evalScope);

  const { extractRollIndex, getNextRollNumber } = evalScope;

  // 1. Kiểm tra trích xuất số cuộn
  assert.strictEqual(extractRollIndex('10001189 - Cuộn 0'), 0);
  assert.strictEqual(extractRollIndex('10001189 - Cuộn 1'), 1);
  assert.strictEqual(extractRollIndex('10001189 - Cuộn 319'), 319);
  assert.strictEqual(extractRollIndex('Cuộn 4'), 4);
  assert.strictEqual(extractRollIndex('cuon 12'), 12);
  assert.strictEqual(extractRollIndex(''), null);
  assert.strictEqual(extractRollIndex(null), null);
  console.log('  ✓ [PASS] extractRollIndex trích xuất chính xác số thứ tự cuộn');

  // 2. Vật tư mới hoàn toàn -> bắt đầu từ 0
  assert.strictEqual(getNextRollNumber('10009999', []), 0);
  console.log('  ✓ [PASS] Mã vật tư mới chưa có cuộn -> bắt đầu từ Cuộn 0');

  // 3. Đã có cuộn 1, 0, 3, 2 -> Số kế tiếp là 4
  const sampleDataOutOfOrder = [
    { 'Mã vật tư': '10001189', 'Cuộn ID': '10001189 - Cuộn 1' },
    { 'Mã vật tư': '10001189', 'Cuộn ID': '10001189 - Cuộn 0' },
    { 'Mã vật tư': '10001189', 'Cuộn ID': '10001189 - Cuộn 3' },
    { 'Mã vật tư': '10001189', 'Cuộn ID': '10001189 - Cuộn 2' },
    { 'Mã vật tư': 'OTHER_MAT', 'Cuộn ID': 'OTHER_MAT - Cuộn 99' }
  ];
  assert.strictEqual(getNextRollNumber('10001189', sampleDataOutOfOrder), 4);
  console.log('  ✓ [PASS] Đã có cuộn 1, 0, 3, 2 -> Cuộn kế tiếp là 4');

  // 4. Đã có cuộn 1, 5 (bị khuyết) -> Số kế tiếp là 6 (max + 1)
  const sampleGaps = [
    { 'Mã vật tư': '10001200', 'Cuộn ID': '10001200 - Cuộn 1' },
    { 'Mã vật tư': '10001200', 'Cuộn ID': '10001200 - Cuộn 5' }
  ];
  assert.strictEqual(getNextRollNumber('10001200', sampleGaps), 6);
  console.log('  ✓ [PASS] Đã có cuộn 1, 5 -> Cuộn kế tiếp là 6 (max + 1)');

  // 5. Loại trừ bản ghi đang sửa (excludeRowId)
  const sampleExclude = [
    { 'id': 'row-1', 'Mã vật tư': '10001200', 'Cuộn ID': '10001200 - Cuộn 1' },
    { 'id': 'row-2', 'Mã vật tư': '10001200', 'Cuộn ID': '10001200 - Cuộn 5' }
  ];
  assert.strictEqual(getNextRollNumber('10001200', sampleExclude, 'row-2'), 2);
  console.log('  ✓ [PASS] Loại trừ chính xác row_id đang sửa');

  // 6. Tính thêm extraCuonIds đang hiển thị trong modal
  assert.strictEqual(getNextRollNumber('10001200', sampleExclude, null, ['10001200 - Cuộn 6']), 7);
  console.log('  ✓ [PASS] Nhận diện cả extraCuonIds đang có trên form modal');

  console.log('---------------------------------------------------------------');
  console.log(' KẾT QUẢ: TẤT CẢ BÀI TEST THÀNH CÔNG');
  console.log('---------------------------------------------------------------');
}

runTests();
