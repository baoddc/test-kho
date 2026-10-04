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
  console.log(' KIỂM THỬ TÌM KIẾM TOÀN BỘ TỒN KHO TRONG MODAL CHỌN CUỘN (XG & TOLE)');
  console.log('===================================================================\n');

  // Test 1: Kiểm tra xg-xuat.js không còn ilike cứng theo maVatTu/batch khi truy vấn xg-nhap
  runTest('xg-xuat.js không query ilike cứng mã vật tư / batch khi lấy danh sách tồn kho', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(!content.includes("query = query.ilike('Mã vật tư', `%${maVatTu}%`);"), 'Vẫn còn query.ilike Mã vật tư trong openInventoryModal của xg-xuat.js');
    assert.ok(!content.includes("query = query.ilike('Batch', `%${batch}%`);"), 'Vẫn còn query.ilike Batch trong openInventoryModal của xg-xuat.js');
    assert.ok(content.includes('allInventoryData'), 'Chưa khai báo hoặc lưu trữ allInventoryData trong xg-xuat.js');
  });

  // Test 2: Kiểm tra xg-xuat.js hỗ trợ tìm kiếm trên toàn bộ kho và nút xóa lọc
  runTest('xg-xuat.js hỗ trợ tìm kiếm toàn bộ kho và nút xóa lọc / xem tất cả', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(content.includes('btnClearInventoryFilter') || content.includes('resetInventoryFilter'), 'Thiếu xử lý nút xóa bộ lọc tồn kho trong xg-xuat.js');
    assert.ok(content.includes('allInventoryData.filter'), 'Thiếu logic lọc trên allInventoryData khi tìm kiếm trong xg-xuat.js');
  });

  // Test 3: Kiểm tra xg-xuat.js tự động điền mã VT / tên VT / batch vào thẻ mặt hàng nếu đang trống
  runTest('xg-xuat.js tự động điền thông tin thẻ mặt hàng khi đang trống', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(content.includes('!item.maVatTu') && content.includes('item.maVatTu ='), 'Chưa có logic điền tự động maVatTu vào item trong xg-xuat.js');
  });

  // Test 4: Kiểm tra tole-xuat.js không còn ilike cứng theo maVatTu/batch khi truy vấn tole-nhap
  runTest('tole-xuat.js không query ilike cứng mã vật tư / batch khi lấy danh sách tồn kho', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(!content.includes("query = query.ilike('Mã vật tư', `%${maVatTu}%`);"), 'Vẫn còn query.ilike Mã vật tư trong openInventoryModal của tole-xuat.js');
    assert.ok(!content.includes("query = query.ilike('Batch', `%${batch}%`);"), 'Vẫn còn query.ilike Batch trong openInventoryModal của tole-xuat.js');
    assert.ok(content.includes('allInventoryData'), 'Chưa khai báo hoặc lưu trữ allInventoryData trong tole-xuat.js');
  });

  // Test 5: Kiểm tra tole-xuat.js hỗ trợ tìm kiếm trên toàn bộ kho và nút xóa lọc
  runTest('tole-xuat.js hỗ trợ tìm kiếm toàn bộ kho và nút xóa lọc / xem tất cả', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(content.includes('btnClearInventoryFilter') || content.includes('resetInventoryFilter'), 'Thiếu xử lý nút xóa bộ lọc tồn kho trong tole-xuat.js');
    assert.ok(content.includes('allInventoryData.filter'), 'Thiếu logic lọc trên allInventoryData khi tìm kiếm trong tole-xuat.js');
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
