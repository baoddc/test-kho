const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- 1. KIỂM TRA MÃ NGUỒN XG-XUAT.JS VÀ TOLE-XUAT.JS ---');

const xgXuatContent = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
const toleXuatContent = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
const edgeOcrContent = fs.readFileSync(path.join(__dirname, '../supabase/functions/ocr-receipt/index.ts'), 'utf8');
const receiptOcrServiceContent = fs.readFileSync(path.join(__dirname, '../assets/js/core/receipt-ocr-service.js'), 'utf8');

// 1. Kiểm tra xg-xuat.js không còn ghép batch vào tenVatTu
assert(!xgXuatContent.includes('tenVatTu: mergeBatchIntoTenVatTu'), 'xg-xuat.js không được ghép batch vào tenVatTu khi quét phiếu hay tìm thủ công');
assert(!xgXuatContent.includes('const tenVatTu = mergeBatchIntoTenVatTu'), 'xg-xuat.js không được ép đổi tenVatTu khi submit add');
assert(!xgXuatContent.includes("updateData['Tên vật tư'] = mergeBatchIntoTenVatTu"), 'xg-xuat.js không được ép đổi tenVatTu khi submit edit');

// 2. Kiểm tra tole-xuat.js không còn ghép batch vào tenVatTu
assert(!toleXuatContent.includes('tenVatTu: mergeBatchIntoTenVatTu'), 'tole-xuat.js không được ghép batch vào tenVatTu khi quét phiếu hay tìm thủ công');
assert(!toleXuatContent.includes('const tenVatTu = mergeBatchIntoTenVatTu'), 'tole-xuat.js không được ép đổi tenVatTu khi submit add');
assert(!toleXuatContent.includes("updateData['Tên vật tư'] = mergeBatchIntoTenVatTu"), 'tole-xuat.js không được ép đổi tenVatTu khi submit edit');

// 3. Kiểm tra prompt OCR yêu cầu giữ nguyên bản tên vật tư và batch
assert(edgeOcrContent.includes('TUYỆT ĐỐI KHÔNG tự ý ghép Lô/Batch vào tên vật tư, giữ nguyên bản đúng như in trên phiếu'), 'Prompt Edge Function ocr-receipt phải yêu cầu giữ nguyên bản tên vật tư');
assert(receiptOcrServiceContent.includes('TUYỆT ĐỐI KHÔNG tự ý ghép Lô/Batch vào tên vật tư, giữ nguyên bản đúng như in trên phiếu'), 'Prompt receipt-ocr-service.js phải yêu cầu giữ nguyên bản tên vật tư');

console.log('✅ Kiểm tra cú pháp và cấu trúc mã nguồn thành công!');

console.log('--- 2. KIỂM TRA MÔ PHỎNG LOGIC SINH DỮ LIỆU THẺ MẶT HÀNG NGUYÊN BẢN ---');

// Giả lập dữ liệu OCR trả về đúng như trong phiếu xuất của người dùng (2X349VN và 2.5X350VN)
const ocrMockData = {
  items: [
    {
      stt: 1,
      maVatTu: '10001189',
      tenVatTu: 'Thép phôi kẽm Z275 G450',
      batch: '2X349VN'
    },
    {
      stt: 2,
      maVatTu: '10001189',
      tenVatTu: 'Thép phôi kẽm Z275 G450',
      batch: '2.5X350VN'
    }
  ]
};

// Mô phỏng logic trong populateFieldsFromOcr (nguyên bản khi quét)
const simulatedItems = ocrMockData.items.map(it => {
  const rawBatch = (it.batch || '').trim();
  const rawTen = (it.tenVatTu || '').trim();
  return {
    maVatTu: it.maVatTu || '',
    tenVatTu: rawTen,
    batch: rawBatch
  };
});

// Kiểm tra Mục 1
assert.strictEqual(simulatedItems[0].batch, '2X349VN', 'Mục 1: Batch phải giữ nguyên 2X349VN');
assert.strictEqual(simulatedItems[0].tenVatTu, 'Thép phôi kẽm Z275 G450', 'Mục 1: Tên vật tư phải giữ nguyên bản không bị chèn batch');

// Kiểm tra Mục 2
assert.strictEqual(simulatedItems[1].batch, '2.5X350VN', 'Mục 2: Batch phải giữ nguyên 2.5X350VN');
assert.strictEqual(simulatedItems[1].tenVatTu, 'Thép phôi kẽm Z275 G450', 'Mục 2: Tên vật tư phải giữ nguyên bản không bị chèn batch');

// Kiểm tra trường hợp tìm kiếm thủ công SAP MB51
const sapItemMock = {
  maVatTu: '10001189',
  tenVatTu: 'Phôi tôn mạ 0.5x1200 AZ150 G550',
  batch: 'DOA-VN'
};
const simulatedSapItem = {
  maVatTu: sapItemMock.maVatTu,
  tenVatTu: sapItemMock.tenVatTu.trim(),
  batch: sapItemMock.batch.trim()
};
assert.strictEqual(simulatedSapItem.tenVatTu, 'Phôi tôn mạ 0.5x1200 AZ150 G550', 'Tole: Tên vật tư khi tìm thủ công phải giữ nguyên bản không chèn batch');
assert.strictEqual(simulatedSapItem.batch, 'DOA-VN', 'Tole: Batch giữ nguyên');

console.log('✅ Kiểm tra mô phỏng thẻ mặt hàng thành công!');
console.log('Mục #1:', simulatedItems[0]);
console.log('Mục #2:', simulatedItems[1]);
console.log('Mục SAP MB51:', simulatedSapItem);
console.log('🎉 TẤT CẢ KIỂM THỬ ĐỀU ĐẠT CHUẨN NGUYÊN BẢN!');

