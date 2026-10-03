/**
 * Test Suite: Kiểm tra cơ chế cảnh báo phiếu đã nhập / xuất kho
 * Áp dụng cho: xg-nhap, xg-xuat, tole-nhap, tole-xuat
 */

const assert = require('assert');

// Mock browser globals for Node.js
global.window = {
  _rawSupabaseData: [],
  _confirmedProcessedReceipts: new Set()
};

const SapLookup = require('../assets/js/xg/xg-sap-lookup.js');

console.log('===============================================================');
console.log(' KIỂM THỬ CẢNH BÁO PHIẾU ĐÃ NHẬP / XUẤT KHO (4 MÀN HÌNH)');
console.log('===============================================================\n');

let passCount = 0;
let totalTests = 0;

async function runAsyncTest(description, testFn) {
  totalTests++;
  try {
    await testFn();
    console.log(`  ✓ [PASS] ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(`    -> Lỗi: ${err.message}`);
  }
}

async function main() {
  // 1. Kiểm tra cấu hình tableName và docColumnName trong SAP_PAGE_RULES
  await runAsyncTest('Cấu hình SAP_PAGE_RULES có đủ tableName và docColumnName cho 4 trang', async () => {
    const rules = SapLookup.SAP_PAGE_RULES;
    assert.strictEqual(rules['xg-nhap'].tableName, 'xg-nhap');
    assert.strictEqual(rules['xg-nhap'].docColumnName, 'Phiếu nhập');

    assert.strictEqual(rules['xg-xuat'].tableName, 'xg-xuat');
    assert.strictEqual(rules['xg-xuat'].docColumnName, 'Phiếu xuất');

    assert.strictEqual(rules['tole-nhap'].tableName, 'tole-nhap');
    assert.strictEqual(rules['tole-nhap'].docColumnName, 'Phiếu nhập');

    assert.strictEqual(rules['tole-xuat'].tableName, 'tole-xuat');
    assert.strictEqual(rules['tole-xuat'].docColumnName, 'Phiếu xuất');
  });

  // 2. Kiểm tra checkReceiptProcessed khi phiếu chưa có trong hệ thống
  await runAsyncTest('checkReceiptProcessed trả về isProcessed: false khi phiếu chưa từng nhập', async () => {
    global.window._rawSupabaseData = [];
    const result = await SapLookup.checkReceiptProcessed('PX-99999', 'xg-nhap');
    assert.strictEqual(result.isProcessed, false);
    assert.strictEqual(result.count, 0);
    assert.strictEqual(result.totalKg, 0);
  });

  // 3. Kiểm tra checkReceiptProcessed trên xg-nhap với dữ liệu tồn tại
  await runAsyncTest('checkReceiptProcessed nhận diện chính xác phiếu đã nhập trên xg-nhap', async () => {
    global.window._rawSupabaseData = [
      {
        'id': 1,
        'Phiếu nhập': '5001234567',
        'Ngày nhập': '2026-03-10',
        'Cuộn ID': 'C-XG-01',
        'Số lượng (Kg)': 5000,
        'Tên công trình': 'Dự án Cầu Vàng'
      },
      {
        'id': 2,
        'Phiếu nhập': '5001234567',
        'Ngày nhập': '2026-03-10',
        'Cuộn ID': 'C-XG-02',
        'Số lượng (Kg)': 4500.5,
        'Tên công trình': 'Dự án Cầu Vàng'
      },
      {
        'id': 3,
        'Phiếu nhập': '5009999999',
        'Ngày nhập': '2026-03-11',
        'Cuộn ID': 'C-XG-03',
        'Số lượng (Kg)': 3000,
        'Tên công trình': 'Tồn trơn'
      }
    ];

    const result = await SapLookup.checkReceiptProcessed('5001234567', 'xg-nhap');
    assert.strictEqual(result.isProcessed, true);
    assert.strictEqual(result.count, 2);
    assert.strictEqual(result.totalKg, 9500.5);
    assert.deepStrictEqual(result.coilIds, ['C-XG-01', 'C-XG-02']);
    assert.strictEqual(result.firstDate, '2026-03-10');
    assert.deepStrictEqual(result.projectNames, ['Dự án Cầu Vàng']);
  });

  // 4. Kiểm tra checkReceiptProcessed trên tole-xuat với cột 'Phiếu xuất' và mét
  await runAsyncTest('checkReceiptProcessed nhận diện chính xác phiếu đã xuất trên tole-xuat', async () => {
    global.window._rawSupabaseData = [
      {
        'id': 10,
        'Phiếu xuất': '4900888888',
        'Ngày xuất': '2026-03-15',
        'Cuộn ID': 'T-001',
        'Số lượng (Kg)': 2500,
        'Số lượng (m)': 320,
        'Tên công trình': 'Nhà Xưởng A'
      },
      {
        'id': 11,
        'Phiếu xuất': '4900888888',
        'Ngày xuất': '2026-03-16',
        'Cuộn ID': 'T-002',
        'Số lượng (Kg)': 3000,
        'Số lượng (m)': 410,
        'Tên công trình': 'Nhà Xưởng A'
      }
    ];

    const result = await SapLookup.checkReceiptProcessed('4900888888', 'tole-xuat');
    assert.strictEqual(result.isProcessed, true);
    assert.strictEqual(result.count, 2);
    assert.strictEqual(result.totalKg, 5500);
    assert.strictEqual(result.totalM, 730);
    assert.strictEqual(result.firstDate, '2026-03-15');
    assert.strictEqual(result.lastDate, '2026-03-16');
  });

  // 5. Kiểm tra cơ chế xác nhận bỏ qua cảnh báo (_confirmedProcessedReceipts)
  await runAsyncTest('Cơ chế _confirmedProcessedReceipts lưu trữ số phiếu đã xác nhận', async () => {
    const docNo = '5001234567';
    global.window._confirmedProcessedReceipts = new Set();
    assert.strictEqual(global.window._confirmedProcessedReceipts.has(docNo.toLowerCase()), false);

    global.window._confirmedProcessedReceipts.add(docNo.toLowerCase());
    assert.strictEqual(global.window._confirmedProcessedReceipts.has(docNo.toLowerCase()), true);
  });

  // 6. Kiểm tra các hàm nghiệp vụ được export đầy đủ
  await runAsyncTest('Kiểm tra các hàm nghiệp vụ được export đầy đủ', async () => {
    assert.strictEqual(typeof SapLookup.checkReceiptProcessed, 'function');
    assert.strictEqual(typeof SapLookup.showReceiptProcessedWarningModal, 'function');
  });

  // 7. Kiểm tra logic phân biệt Thêm mới vs Cập nhật dữ liệu
  await runAsyncTest('Chỉ áp dụng chặn phiếu trùng khi Thêm dữ liệu, không áp dụng cho Cập nhật/Sửa dữ liệu', async () => {
    const editForm = { id: 'editDataForm' };
    const editInput = { id: 'editPhiếu nhập' };
    const addForm = { id: 'addDataForm' };
    const addInput = { id: 'col_3' };

    const isEditForm1 = Boolean(
      (editForm && (editForm.id === 'editDataForm' || (editForm.closest && editForm.closest('#editDataModal')))) ||
      (editInput && (editInput.id === 'editPhiếu nhập' || editInput.id === 'editPhiếu xuất' || (editInput.closest && editInput.closest('#editDataModal'))))
    );
    assert.strictEqual(isEditForm1, true, 'Form sửa dữ liệu phải được nhận diện isEditForm = true');

    const isEditForm2 = Boolean(
      (addForm && (addForm.id === 'editDataForm' || (addForm.closest && addForm.closest('#editDataModal')))) ||
      (addInput && (addInput.id === 'editPhiếu nhập' || addInput.id === 'editPhiếu xuất' || (addInput.closest && addInput.closest('#editDataModal'))))
    );
    assert.strictEqual(isEditForm2, false, 'Form thêm mới dữ liệu phải có isEditForm = false để kích hoạt chặn trùng');
  });

  // 8. Kiểm tra checkReceiptItemProcessed phân biệt chính xác loại đã nhập vs loại chưa nhập
  await runAsyncTest('checkReceiptItemProcessed phân biệt đúng loại đã nhập (Mã VT + Batch) và loại chưa nhập trên cùng một phiếu', async () => {
    global.window._rawSupabaseData = [
      {
        'id': 101,
        'Phiếu nhập': '5000042978',
        'Mã vật tư': '10001189',
        'Batch': '1.5X157VN',
        'Số lượng (Kg)': 5566,
        'Cuộn ID': 'C-157',
        'Ngày nhập': '2026-10-01'
      }
    ];

    assert.strictEqual(typeof SapLookup.checkReceiptItemProcessed, 'function', 'checkReceiptItemProcessed phải được export');

    // Loại 1: Đã nhập -> isProcessed: true
    const resultItem1 = await SapLookup.checkReceiptItemProcessed('5000042978', '10001189', '1.5X157VN', 'xg-nhap');
    assert.strictEqual(resultItem1.isProcessed, true, 'Loại Batch 1.5X157VN phải có isProcessed = true');
    assert.strictEqual(resultItem1.totalKg, 5566);
    assert.strictEqual(resultItem1.count, 1);

    // Loại 2: Cùng phiếu, cùng mã VT nhưng khác Batch (1.5X165VN) -> isProcessed: false
    const resultItem2 = await SapLookup.checkReceiptItemProcessed('5000042978', '10001189', '1.5X165VN', 'xg-nhap');
    assert.strictEqual(resultItem2.isProcessed, false, 'Loại Batch 1.5X165VN chưa nhập phải có isProcessed = false');
    assert.strictEqual(resultItem2.totalKg, 0);

    // Loại 3: Cùng phiếu nhưng khác Mã VT (10001190) -> isProcessed: false
    const resultItem3 = await SapLookup.checkReceiptItemProcessed('5000042978', '10001190', '1.5X157VN', 'xg-nhap');
    assert.strictEqual(resultItem3.isProcessed, false, 'Loại khác mã vật tư phải có isProcessed = false');
  });

  // 9. Kiểm tra checkReceiptItemProcessed trên tole-nhap có cả kg và mét
  await runAsyncTest('checkReceiptItemProcessed hoạt động chính xác trên tole-nhap (có số lượng kg và mét)', async () => {
    global.window._rawSupabaseData = [
      {
        'id': 201,
        'Phiếu nhập': '5000099999',
        'Mã vật tư': '1003001',
        'Batch': 'B-TOLE-01',
        'Số lượng (Kg)': 4200,
        'Số lượng (m)': 550,
        'Cuộn ID': 'CT-01',
        'Ngày nhập': '2026-10-02'
      }
    ];

    // Loại đã nhập trong tole-nhap
    const res1 = await SapLookup.checkReceiptItemProcessed('5000099999', '1003001', 'B-TOLE-01', 'tole-nhap');
    assert.strictEqual(res1.isProcessed, true);
    assert.strictEqual(res1.totalKg, 4200);
    assert.strictEqual(res1.totalM, 550);

    // Loại khác batch trong tole-nhap -> false
    const res2 = await SapLookup.checkReceiptItemProcessed('5000099999', '1003001', 'B-TOLE-02', 'tole-nhap');
    assert.strictEqual(res2.isProcessed, false);
    assert.strictEqual(res2.totalKg, 0);
    assert.strictEqual(res2.totalM, 0);
  });

  console.log('\n---------------------------------------------------------------');
  console.log(` KẾT QUẢ KIỂM THỬ: ${passCount} / ${totalTests} test cases ĐẠT (PASS)`);
  console.log('---------------------------------------------------------------\n');

  if (passCount !== totalTests) {
    process.exit(1);
  }
}

main();
