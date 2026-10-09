/**
 * Test Suite: Kiểm thử Tích Hợp Toàn Diện (E2E) Tính Năng Nạp Cuộn Quét Bằng File .CSV
 * Áp dụng cho: pages/tem-nhan-kiem-ke/kiem-ke.html & các module liên quan
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const KiemKeEngine = require('../assets/js/tem-nhan-kiem-ke/kiem-ke-engine.js');
const KiemKeStorage = require('../assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js');

console.log('======================================================================');
console.log(' KIỂM THỬ E2E: TÍNH NĂNG NẠP CUỘN QUÉT BẰNG FILE .CSV (KIỂM KÊ KHO)  ');
console.log('======================================================================\n');

async function main() {
  // 1. Kiểm tra xuất hàm cần thiết
  assert.strictEqual(typeof KiemKeEngine.parseCsvScannedRolls, 'function', 'parseCsvScannedRolls phải là hàm');
  assert.strictEqual(typeof KiemKeStorage.insertBatchScannedRollsToSupabase, 'function', 'insertBatchScannedRollsToSupabase phải là hàm');
  console.log('✅ Bước 1: Các module KiemKeEngine và KiemKeStorage export đầy đủ hàm mới.');

  // 2. Kiểm tra HTML kiem-ke.html có đầy đủ nút và input file CSV
  const htmlPath = path.join(__dirname, '../pages/tem-nhan-kiem-ke/kiem-ke.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  assert(htmlContent.includes('id="csvScanFileInput"'), 'Phải có input csvScanFileInput trên toolbar chính');
  assert(htmlContent.includes('id="csvScanFileInputTab"'), 'Phải có input csvScanFileInputTab tại Tab 2');
  assert(htmlContent.includes('data-perm="add"'), 'Nút nạp CSV phải có phân quyền data-perm="add"');
  console.log('✅ Bước 2: Giao diện kiem-ke.html có đầy đủ 2 vị trí nút nạp CSV chuẩn phân quyền.');

  // 3. Khởi tạo dữ liệu cơ sở Excel và Hệ thống Supabase
  const mockExcelRows = [
    ['Header', '', '', '', '', '', 'Mã vật tư', '', '', '', 'Lô (Batch)', '', '', '', 'Số lượng (Kg)'],
    ['', '', '', '', '', '', '10001189', '', '', '', '2.5X75VN', '', '', '', '2500'],
    ['', '', '', '', '', '', '10001200', '', '', '', 'BATCH-01', '', '', '', '2000']
  ];
  const excelMap = KiemKeEngine.parseExcelRows(mockExcelRows);
  assert.strictEqual(excelMap.size, 2);

  const mockSystemRolls = [
    { 'Mã vật tư': '10001189', 'Batch': '2.5X75VN', 'Số lượng (Kg)': 2500, 'Tên vật tư': 'Thép cuộn mạ' },
    { 'Mã vật tư': '10001200', 'Batch': 'BATCH-01', 'Số lượng (Kg)': 2000, 'Tên vật tư': 'Tole cuộn' }
  ];
  const systemMap = KiemKeEngine.aggregateSystemStock(mockSystemRolls);
  assert.strictEqual(systemMap.size, 2);

  // Đối soát ban đầu: Chưa quét cuộn nào
  let scannedRolls = [];
  let scannedMap = KiemKeEngine.aggregateScannedRolls(scannedRolls);
  let reconcile = KiemKeEngine.reconcile3Way(excelMap, systemMap, scannedMap);
  assert.strictEqual(reconcile.length, 2);
  assert.strictEqual(reconcile[0].status, 'UNSCANNED');
  assert.strictEqual(reconcile[1].status, 'UNSCANNED');
  console.log('✅ Bước 3: Khởi tạo Excel cơ sở và Hệ thống: Ban đầu trạng thái UNSCANNED chuẩn xác.');

  // 4. Giả lập thủ kho quét trước 1 cuộn thủ công
  scannedRolls.push({
    id: 'MANUAL-1',
    barcode: '10001189-2.5X75VN-1000',
    maVatTu: '10001189',
    batch: '2.5X75VN',
    kg: 1000,
    timestamp: '10:00:00',
    scannedBy: 'bao.lt'
  });
  scannedMap = KiemKeEngine.aggregateScannedRolls(scannedRolls);
  reconcile = KiemKeEngine.reconcile3Way(excelMap, systemMap, scannedMap);
  const item1BeforeCsv = reconcile.find(x => x.virtualKey === '10001189-2.5X75VN');
  assert.strictEqual(item1BeforeCsv.status, 'SHORTAGE');
  assert.strictEqual(item1BeforeCsv.diffScannedVsExcelKg, -1500);
  console.log('✅ Bước 4: Quét thủ công 1 cuộn (1000kg): Đối soát báo SHORTAGE (-1500kg) chính xác.');

  // 5. Giả lập nạp file CSV kiểm kê thực tế
  // File CSV kết hợp: 1 cuộn dạng barcode đơn, 1 cuộn dạng bảng nhiều cột, 1 dòng rỗng và 1 dòng rác
  const mockCsvContent = `\uFEFFMã vật tư,Batch,Khối lượng (Kg)
10001189,2.5X75VN,1500
10001200,BATCH-01,2000

dòng ghi chú lỗi không hợp lệ
`;
  const parseResult = KiemKeEngine.parseCsvScannedRolls(mockCsvContent, 'bao.lt');
  assert.strictEqual(parseResult.validRolls.length, 2, 'Phải bóc tách được đúng 2 cuộn hợp lệ');
  assert.strictEqual(parseResult.skippedCount, 1, 'Phải bỏ qua 1 dòng rác');
  assert.strictEqual(parseResult.totalKg, 3500, 'Tổng kg trong file CSV phải là 3500 kg');
  console.log('✅ Bước 5: Parse CSV thông minh: Đọc 2 cuộn hợp lệ (3500kg), bỏ qua dòng rỗng và rác.');

  // 6. Giả lập cơ chế Nối tiếp (Append) vào danh sách cuộn hiện tại
  scannedRolls = [...parseResult.validRolls, ...scannedRolls];
  assert.strictEqual(scannedRolls.length, 3, 'Tổng số cuộn sau khi nối tiếp phải là 3 cuộn');

  scannedMap = KiemKeEngine.aggregateScannedRolls(scannedRolls);
  reconcile = KiemKeEngine.reconcile3Way(excelMap, systemMap, scannedMap);

  const r1 = reconcile.find(x => x.virtualKey === '10001189-2.5X75VN');
  const r2 = reconcile.find(x => x.virtualKey === '10001200-BATCH-01');

  assert.strictEqual(r1.scannedKg, 2500, 'Mã 10001189-2.5X75VN phải đạt 2500kg (1000 thủ công + 1500 CSV)');
  assert.strictEqual(r1.status, 'MATCH', 'Mã 10001189-2.5X75VN phải chuyển sang MATCH');

  assert.strictEqual(r2.scannedKg, 2000, 'Mã 10001200-BATCH-01 phải đạt 2000kg');
  assert.strictEqual(r2.status, 'MATCH', 'Mã 10001200-BATCH-01 phải chuyển sang MATCH');
  console.log('✅ Bước 6: Cơ chế Nối tiếp (Append) & Đối soát 3 chiều: Cả 2 mã chuyển trạng thái MATCH 100%.');

  // 7. Giả lập Batch Insert lên Supabase nền
  let supabaseInsertedPayloads = [];
  global.window = {
    supabase: {
      from: (table) => {
        assert.strictEqual(table, 'kiem_ke_scans');
        return {
          insert: (payloadChunk) => {
            supabaseInsertedPayloads.push(payloadChunk);
            return {
              select: async () => ({
                data: payloadChunk.map((p, i) => ({ id: 500 + i, created_at: new Date().toISOString() })),
                error: null
              })
            };
          }
        };
      }
    }
  };

  const syncedRolls = await KiemKeStorage.insertBatchScannedRollsToSupabase(parseResult.validRolls);
  assert.strictEqual(syncedRolls.length, 2);
  assert.strictEqual(syncedRolls[0].id, '500');
  assert.strictEqual(syncedRolls[1].id, '501');
  assert.strictEqual(supabaseInsertedPayloads.length, 1);
  assert.strictEqual(supabaseInsertedPayloads[0].length, 2);
  console.log('✅ Bước 7: Đồng bộ hàng loạt lên Supabase nền (insertBatchScannedRollsToSupabase) thành công.');

  console.log('\n🎉 TOÀN BỘ CÁC CA KIỂM THỬ E2E CHO TÍNH NĂNG NẠP CSV ĐÃ THÀNH CÔNG RỰC RỠ!');
}

main().catch(err => {
  console.error('\n❌ E2E Test Suite Thất Bại:', err);
  process.exit(1);
});
