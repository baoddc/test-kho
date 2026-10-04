/**
 * Test Suite: Kiểm thử Chọn Cuộn Thủ Công Khi Nhập Phiếu Xuất
 * Đảm bảo:
 * 1. xg-xuat.js không tự động truy vấn xg-nhap để đưa cuộn tồn kho vào rolls
 * 2. tole-xuat.js không tự động truy vấn tole-nhap để đưa cuộn tồn kho vào rolls
 * 3. pages/xg/xg-xuat.html có nút #btnEditAddRoll với nhãn "+ Chọn cuộn từ kho"
 */

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
  console.log('===============================================================');
  console.log(' KIỂM THỬ CHỌN CUỘN THỦ CÔNG KHI NHẬP PHIẾU XUẤT (XG & TOLE)');
  console.log('===============================================================\n');

  // Test 1: Kiểm tra mã nguồn xg-xuat.js không còn khối tự động tải cuộn tồn kho vào rolls
  runTest('xg-xuat.js không tự động truy vấn xg-nhap để điền rolls trong populateExportReceiptFromSap', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
    assert.ok(!content.includes("console.error('[xg-xuat] Lỗi tự động tải cuộn tồn kho:'"), 'Vẫn còn khối tự động tải cuộn tồn kho trong xg-xuat.js');
    assert.ok(content.includes('window.populateExportReceiptData = populateExportReceiptFromSap'), 'Thiếu populateExportReceiptData');
  });

  // Test 2: Kiểm tra mã nguồn tole-xuat.js không còn khối tự động tải cuộn tồn kho vào rolls
  runTest('tole-xuat.js không tự động truy vấn tole-nhap để điền rolls trong populateExportReceiptFromSap', () => {
    const content = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
    assert.ok(!content.includes("console.error('[tole-xuat] Lỗi tự động tải cuộn tồn kho:'"), 'Vẫn còn khối tự động tải cuộn tồn kho trong tole-xuat.js');
    assert.ok(content.includes('window.populateExportReceiptData = populateExportReceiptFromSap'), 'Thiếu populateExportReceiptData');
  });

  // Test 3: Kiểm tra nhãn nút modal sửa trong xg-xuat.html
  runTest('xg-xuat.html có nhãn nút btnEditAddRoll là "+ Chọn cuộn từ kho"', () => {
    const content = fs.readFileSync(path.join(__dirname, '../pages/xg/xg-xuat.html'), 'utf8');
    assert.ok(content.includes('id="btnEditAddRoll" class="btn btn-sm btn-light">+ Chọn cuộn từ kho</button>'), 'btnEditAddRoll trong xg-xuat.html chưa đổi thành "+ Chọn cuộn từ kho"');
  });

  console.log('\n---------------------------------------------------------------');
  console.log(` KẾT QUẢ: ${passedTests}/${totalTests} BÀI TEST THÀNH CÔNG`);
  console.log('---------------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main();
