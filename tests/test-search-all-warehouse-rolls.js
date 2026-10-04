// tests/test-search-all-warehouse-rolls.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function main() {
  console.log('===================================================================');
  console.log(' KIỂM THỬ TÌM KIẾM THEO SỐ KG TRONG MÃ VT VÀ BATCH ĐÓ (XG & TOLE)');
  console.log('===================================================================\n');

  // Test 1: Kiểm tra xg-xuat.js lọc theo maVatTu/batch của mục xuất khi truy vấn tồn kho
  runTest('xg-xuat.js lọc đúng mã vật tư / batch khi lấy danh sách tồn kho', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(content.includes("query.ilike('Mã vật tư', `%${maVatTu}%`)"), 'Thiếu query.ilike Mã vật tư trong openInventoryModal của xg-xuat.js');
    assert.ok(content.includes("query.ilike('Batch', `%${batch}%`)"), 'Thiếu query.ilike Batch trong openInventoryModal của xg-xuat.js');
    assert.ok(content.includes('cachedInventoryData'), 'Chưa khai báo hoặc lưu trữ cachedInventoryData trong xg-xuat.js');
  });

  // Test 2: Kiểm tra xg-xuat.js tìm kiếm trên cachedInventoryData của mã VT và batch đó
  runTest('xg-xuat.js tìm kiếm số kg và cuộn ID trong phạm vi mã vật tư và batch đó', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(content.includes("renderInventoryTable(cachedInventoryData || [], e.target.value)"), 'Thiếu gọi renderInventoryTable trên cachedInventoryData khi tìm kiếm');
    assert.ok(content.includes('tonKg') && content.includes('tonKgFormatted'), 'Thiếu logic so khớp số kg trong xg-xuat.js');
  });

  // Test 3: Kiểm tra xg-xuat.js tự động điền mã VT / tên VT / batch vào thẻ mặt hàng nếu đang trống
  runTest('xg-xuat.js tự động điền thông tin thẻ mặt hàng khi đang trống', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(content.includes('!item.maVatTu') && content.includes('item.maVatTu ='), 'Chưa có logic điền tự động maVatTu vào item trong xg-xuat.js');
  });

  // Test 4: Kiểm tra tole-xuat.js lọc theo maVatTu/batch của mục xuất khi truy vấn tồn kho
  runTest('tole-xuat.js lọc đúng mã vật tư / batch khi lấy danh sách tồn kho', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(content.includes("query.ilike('Mã vật tư', `%${maVatTu}%`)"), 'Thiếu query.ilike Mã vật tư trong openInventoryModal của tole-xuat.js');
    assert.ok(content.includes("query.ilike('Batch', `%${batch}%`)"), 'Thiếu query.ilike Batch trong openInventoryModal của tole-xuat.js');
    assert.ok(content.includes('cachedInventoryData'), 'Chưa khai báo hoặc lưu trữ cachedInventoryData trong tole-xuat.js');
  });

  // Test 5: Kiểm tra tole-xuat.js tìm kiếm trên cachedInventoryData của mã VT và batch đó
  runTest('tole-xuat.js tìm kiếm số kg và cuộn ID trong phạm vi mã vật tư và batch đó', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(content.includes("renderInventoryTable(cachedInventoryData || [], e.target.value)"), 'Thiếu gọi renderInventoryTable trên cachedInventoryData khi tìm kiếm');
    assert.ok(content.includes('tonKg') && content.includes('tonKgFormatted'), 'Thiếu logic so khớp số kg trong tole-xuat.js');
  });

  // Test 6: Kiểm tra tole-xuat.js tự động điền mã VT / tên VT / batch vào thẻ mặt hàng nếu đang trống
  runTest('tole-xuat.js tự động điền thông tin thẻ mặt hàng khi đang trống', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(content.includes('!item.maVatTu') && content.includes('item.maVatTu ='), 'Chưa có logic điền tự động maVatTu vào item trong tole-xuat.js');
  });

  // Test 7: Kiểm tra xg-xuat.js hỗ trợ tìm kiếm Tồn cuối (Kg)
  runTest('xg-xuat.js hỗ trợ tìm kiếm theo Tồn cuối (Kg)', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(content.includes('tonKg') && (content.includes("Tồn cuối (Kg)") || content.includes("tonKgVal")), 'Chưa có logic tìm kiếm theo Tồn cuối (Kg) trong xg-xuat.js');
  });

  // Test 8: Kiểm tra tole-xuat.js hỗ trợ tìm kiếm theo Tồn cuối (Kg)
  runTest('tole-xuat.js hỗ trợ tìm kiếm theo Tồn cuối (Kg)', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(content.includes('tonKg') && (content.includes("Tồn cuối (Kg)") || content.includes("tonKgVal")), 'Chưa có logic tìm kiếm theo Tồn cuối (Kg) trong tole-xuat.js');
  });

  console.log('\n-------------------------------------------------------------------');
  console.log(` KẾT QUẢ: ${passedTests}/${totalTests} BÀI TEST THÀNH CÔNG`);
  console.log('-------------------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main();
