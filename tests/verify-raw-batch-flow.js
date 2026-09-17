const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- 1. KIỂM TRA MÃ NGUỒN XG-XUAT.JS VÀ TOLE-XUAT.JS ---');

const xgXuatContent = fs.readFileSync(path.join(__dirname, '../assets/js/xg/xg-xuat.js'), 'utf8');
const toleXuatContent = fs.readFileSync(path.join(__dirname, '../assets/js/tole/tole-xuat.js'), 'utf8');
const edgeOcrContent = fs.readFileSync(path.join(__dirname, '../supabase/functions/ocr-receipt/index.ts'), 'utf8');
const receiptOcrServiceContent = fs.readFileSync(path.join(__dirname, '../assets/js/core/receipt-ocr-service.js'), 'utf8');

// 1. Kiểm tra xg-xuat.js không còn gọi formatBatchForMaterialName trong populateFieldsFromOcr
assert(!xgXuatContent.includes('const batch = formatBatchForMaterialName(it.batch'), 'xg-xuat.js không được ép đổi batch của it.batch');
assert(!xgXuatContent.includes('const batch = formatBatchForMaterialName(data.batch'), 'xg-xuat.js không được ép đổi batch của data.batch');
assert(!xgXuatContent.includes('newBatch = formatBatchForMaterialName(newBatch);'), 'xg-xuat.js không được ép đổi batch khi người dùng nhập liệu');

// 2. Kiểm tra tole-xuat.js tương tự
assert(!toleXuatContent.includes('const batch = formatBatchForMaterialName(it.batch'), 'tole-xuat.js không được ép đổi batch của it.batch');
assert(!toleXuatContent.includes('const batch = formatBatchForMaterialName(data.batch'), 'tole-xuat.js không được ép đổi batch của data.batch');
assert(!toleXuatContent.includes('newBatch = formatBatchForMaterialName(newBatch);'), 'tole-xuat.js không được ép đổi batch khi người dùng nhập liệu');

// 3. Kiểm tra prompt OCR yêu cầu lấy chính xác nguyên văn
assert(edgeOcrContent.includes('Lấy chính xác nguyên văn từng ký tự như in trên phiếu xuất kho'), 'Prompt Edge Function ocr-receipt phải yêu cầu giữ nguyên văn');
assert(receiptOcrServiceContent.includes('Lấy chính xác nguyên văn từng ký tự như in trên phiếu xuất kho'), 'Prompt receipt-ocr-service.js phải yêu cầu giữ nguyên văn');

console.log('✅ Kiểm tra cú pháp và cấu trúc mã nguồn thành công!');

console.log('--- 2. KIỂM TRA MÔ PHỎNG LOGIC SINH DỮ LIỆU THẺ MẶT HÀNG ---');

// Trích xuất hàm mergeBatchIntoTenVatTu từ xg-xuat.js để test
function formatBatchForMaterialName(batch) {
  if (!batch) return '';
  batch = String(batch).trim();
  let formatted = batch.replace(/^(\d+)\s*[xX]/, '$1.0x');
  formatted = formatted.replace(/^(\d+(?:\.\d+)?)\s*[xX]/, '$1x');
  formatted = formatted.replace(/(\d)\s*[xX]\s*(\d)/g, '$1x$2');
  return formatted;
}

function mergeBatchIntoTenVatTu(tenVatTu, batch, oldBatch) {
  if (!tenVatTu && !batch) return '';
  if (!batch || !String(batch).trim()) return (tenVatTu || '').trim();

  const formattedBatch = formatBatchForMaterialName(batch);
  const rawBatch = String(batch).trim();
  let name = (tenVatTu || '').trim();

  if (!name) return formattedBatch;

  const lowerName = name.toLowerCase();
  const lowerBatch = rawBatch.toLowerCase();
  const lowerFormatted = formattedBatch.toLowerCase();
  if (lowerName.includes(lowerBatch) || lowerName.includes(lowerFormatted)) {
    return name.replace(/\b(\d+(?:\.\d+)?)\s*X\s*(\d+[A-Za-z0-9]*)\b/g, '$1x$2');
  }

  if (oldBatch && String(oldBatch).trim()) {
    const rawOld = String(oldBatch).trim();
    const formattedOld = formatBatchForMaterialName(rawOld);
    if (name.includes(rawOld)) {
      return name.replace(rawOld, formattedBatch);
    }
    if (name.includes(formattedOld)) {
      return name.replace(formattedOld, formattedBatch);
    }
  }

  const gradeTokens = 'Z\\d+|G\\d+|AZ\\d+|AM\\d+|S\\d+GD|S\\d+|SGCC|SGCD|SECC|SPCC|SUS\\s*\\d+|GI\\s+Z';
  const toleBatchMidRegex = new RegExp('(\\b\\d+(?:\\.\\d+)?\\s*[xX]\\s*\\d+\\s+)(?!(?:' + gradeTokens + ')\\b)([A-Za-z0-9\\-_]+)(\\s+(?:' + gradeTokens + ')\\b)', 'i');
  const midMatch = name.match(toleBatchMidRegex);
  if (midMatch) {
    return name.replace(toleBatchMidRegex, `$1${formattedBatch}$3`);
  }

  const batchWithDimRegex = /\b\d+(\.\d+)?\s*[xX]\s*\d+[A-Za-z]+[A-Za-z0-9]*\b/i;
  const isNewBatchDim = /\b\d+(\.\d+)?\s*[xX]/i.test(formattedBatch);
  if (isNewBatchDim && batchWithDimRegex.test(name)) {
    return name.replace(batchWithDimRegex, formattedBatch);
  }

  const gradeRegex = new RegExp('(?=\\b(' + gradeTokens + ')\\b)', 'i');
  const gradeMatch = name.search(gradeRegex);
  if (gradeMatch !== -1) {
    const before = name.substring(0, gradeMatch).trim();
    const after = name.substring(gradeMatch).trim();
    return `${before} ${formattedBatch} ${after}`.replace(/\s+/g, ' ').trim();
  }

  const prefixRegex = /^(Thép phôi kẽm|Thép phôi|Phôi tôn kẽm|Phôi tôn mạ|Phôi tôn|Phôi thép mạ kẽm|Phôi thép|Thép tấm cuộn|Thép cuộn|Thép Inox cuộn|Thép Inox|Tôn cuộn)(\s+|$)(.*)$/i;
  const prefixMatch = name.match(prefixRegex);
  if (prefixMatch) {
    const prefix = prefixMatch[1].trim();
    const rest = (prefixMatch[3] || '').trim();
    if (rest) {
      const dimMatch = rest.match(/^(\d+(?:\.\d+)?\s*[xX]\s*\d+)(.*)$/);
      if (dimMatch) {
        const dimStr = dimMatch[1].replace(/\s*[xX]\s*/, 'x');
        const remaining = dimMatch[2].trim();
        return remaining ? `${prefix} ${dimStr} ${formattedBatch} ${remaining}`.replace(/\s+/g, ' ').trim() : `${prefix} ${dimStr} ${formattedBatch}`;
      }
      return `${prefix} ${formattedBatch} ${rest}`.replace(/\s+/g, ' ').trim();
    }
    return `${prefix} ${formattedBatch}`;
  }

  return `${name} ${formattedBatch}`.trim();
}

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

// Mô phỏng logic trong populateFieldsFromOcr
const simulatedItems = ocrMockData.items.map(it => {
  const rawBatch = (it.batch || '').trim();
  const rawTen = (it.tenVatTu || '').trim();
  return {
    maVatTu: it.maVatTu || '',
    tenVatTu: mergeBatchIntoTenVatTu(rawTen, rawBatch),
    batch: rawBatch
  };
});

// Kiểm tra Mục 1
assert.strictEqual(simulatedItems[0].batch, '2X349VN', 'Mục 1: Batch phải giữ nguyên 2X349VN (chữ X hoa, không thêm .0)');
assert.strictEqual(simulatedItems[0].tenVatTu, 'Thép phôi kẽm 2.0x349VN Z275 G450', 'Mục 1: Tên vật tư phải có quy cách 2.0x349VN');

// Kiểm tra Mục 2
assert.strictEqual(simulatedItems[1].batch, '2.5X350VN', 'Mục 2: Batch phải giữ nguyên 2.5X350VN (chữ X hoa)');
assert.strictEqual(simulatedItems[1].tenVatTu, 'Thép phôi kẽm 2.5x350VN Z275 G450', 'Mục 2: Tên vật tư phải có quy cách 2.5x350VN');

// Kiểm tra Mục 3: Tole với kích thước 0.5x1200 và batch DOA-VN
const toleMerged = mergeBatchIntoTenVatTu('Phôi tôn mạ 0.5x1200 AZ150 G550', 'DOA-VN');
assert.strictEqual(toleMerged, 'Phôi tôn mạ 0.5x1200 DOA-VN AZ150 G550', 'Tole: Tên vật tư phải giữ nguyên kích thước 0.5x1200 và ghép DOA-VN');

console.log('✅ Kiểm tra mô phỏng thẻ mặt hàng thành công!');
console.log('Mục #1:', simulatedItems[0]);
console.log('Mục #2:', simulatedItems[1]);
console.log('Mục Tole:', toleMerged);
console.log('🎉 TẤT CẢ KIỂM THỬ ĐỀU ĐẠT CHUẨN!');
