const assert = require('assert');

function formatBatchForMaterialName(batch) {
  if (!batch) return '';
  batch = String(batch).trim();
  // If batch starts with an integer before x/X (e.g. 3x451VN -> 3.0x451VN, 3X451VN -> 3.0x451VN)
  let formatted = batch.replace(/^(\d+)\s*[xX]/, '$1.0x');
  // Convert any capital 'X' used as dimension separator to lowercase 'x' (e.g. 1.5X348VN -> 1.5x348VN)
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

  // Check if batch is already inside name
  const lowerName = name.toLowerCase();
  const lowerBatch = rawBatch.toLowerCase();
  const lowerFormatted = formattedBatch.toLowerCase();
  if (lowerName.includes(lowerBatch) || lowerName.includes(lowerFormatted)) {
    // If name already contains batch but with capital X, ensure X is replaced by x in dimension
    return name.replace(/\b(\d+(?:\.\d+)?)\s*X\s*(\d+[A-Za-z0-9]*)\b/g, '$1x$2');
  }

  // If oldBatch was provided and is present in name, replace it with new formattedBatch
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

  // If name has an existing tole batch between dimension and grade marker:
  // e.g. "Phôi tôn mạ 0.5x1200 PREV_BATCH AZ150 G550" -> replace PREV_BATCH with formattedBatch
  const gradeTokens = 'Z\\d+|G\\d+|AZ\\d+|AM\\d+|S\\d+GD|S\\d+|SGCC|SGCD|SECC|SPCC|SUS\\s*\\d+|GI\\s+Z';
  const toleBatchMidRegex = new RegExp('(\\b\\d+(?:\\.\\d+)?\\s*[xX]\\s*\\d+\\s+)(?!(?:' + gradeTokens + ')\\b)([A-Za-z0-9\\-_]+)(\\s+(?:' + gradeTokens + ')\\b)', 'i');
  const midMatch = name.match(toleBatchMidRegex);
  if (midMatch) {
    return name.replace(toleBatchMidRegex, `$1${formattedBatch}$3`);
  }

  // If name already has a dimension-batch WITH letter suffix (like 1.5X348VN or 3x451VN),
  // and the new batch is ALSO a dimension-like batch (like 3x451VN), replace it.
  // CRITICAL: Pure dimensions (like 0.5x1200 without trailing letter suffix) are material sizes, NEVER replace them!
  const batchWithDimRegex = /\b\d+(\.\d+)?\s*[xX]\s*\d+[A-Za-z]+[A-Za-z0-9]*\b/i;
  const isNewBatchDim = /\b\d+(\.\d+)?\s*[xX]/i.test(formattedBatch);
  if (isNewBatchDim && batchWithDimRegex.test(name)) {
    return name.replace(batchWithDimRegex, formattedBatch);
  }

  // Look for standard grade/coating markers (Z275, G450, AZ150, S450GD, SGCC, etc.)
  const gradeRegex = new RegExp('(?=\\b(' + gradeTokens + ')\\b)', 'i');
  const gradeMatch = name.search(gradeRegex);
  if (gradeMatch !== -1) {
    const before = name.substring(0, gradeMatch).trim();
    const after = name.substring(gradeMatch).trim();
    return `${before} ${formattedBatch} ${after}`.replace(/\s+/g, ' ').trim();
  }

  // Fallback: prefix match
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

console.log('--- RUNNING VERIFICATION TESTS ---');

// Test 1: Capital X changed to lowercase x
const res1 = mergeBatchIntoTenVatTu('Thép phôi kẽm Z275 G450', '1.5X348VN');
console.log('Test 1 (1.5X348VN -> 1.5x348VN):', res1);
assert.strictEqual(res1, 'Thép phôi kẽm 1.5x348VN Z275 G450');

// Test 2: Integer 3 becomes 3.0 and x is lowercase
const res2 = mergeBatchIntoTenVatTu('Thép phôi kẽm Z275 G450', '3x451VN');
console.log('Test 2 (3x451VN -> 3.0x451VN):', res2);
assert.strictEqual(res2, 'Thép phôi kẽm 3.0x451VN Z275 G450');

// Test 3: Capital 3X451VN becomes 3.0x451VN
const res3 = mergeBatchIntoTenVatTu('Thép phôi kẽm Z275 G450', '3X451VN');
console.log('Test 3 (3X451VN -> 3.0x451VN):', res3);
assert.strictEqual(res3, 'Thép phôi kẽm 3.0x451VN Z275 G450');

// Test 4: Existing name with capital X gets converted to x
const res4 = mergeBatchIntoTenVatTu('Thép phôi kẽm 1.5X348VN Z275 G450', '1.5X348VN');
console.log('Test 4 (Existing with X converts to x):', res4);
assert.strictEqual(res4, 'Thép phôi kẽm 1.5x348VN Z275 G450');

// Test 5: Replacing dimension batch
const res5 = mergeBatchIntoTenVatTu('Thép phôi kẽm 1.5X348VN Z275 G450', '3x451VN');
console.log('Test 5 (Replace dimension batch):', res5);
assert.strictEqual(res5, 'Thép phôi kẽm 3.0x451VN Z275 G450');

// Test 6: Tole receipt item with dimensions and grade (User's exact issue)
const res6 = mergeBatchIntoTenVatTu('Phôi tôn mạ 0.5x1200 AZ150 G550', 'DOA-VN');
console.log('Test 6 (Tole 0.5x1200 + DOA-VN + AZ150 G550):', res6);
assert.strictEqual(res6, 'Phôi tôn mạ 0.5x1200 DOA-VN AZ150 G550');

// Test 7: Tole receipt item with multiline text from OCR
const res7 = mergeBatchIntoTenVatTu('Phôi tôn mạ 0.5x1200\nAZ150 G550', 'DOA-VN');
console.log('Test 7 (Tole multiline OCR):', res7);
assert.strictEqual(res7, 'Phôi tôn mạ 0.5x1200 DOA-VN AZ150 G550');

// Test 8: Tole updating batch from DOA-VN to HPH-VN
const res8 = mergeBatchIntoTenVatTu('Phôi tôn mạ 0.5x1200 DOA-VN AZ150 G550', 'HPH-VN');
console.log('Test 8 (Tole update batch):', res8);
assert.strictEqual(res8, 'Phôi tôn mạ 0.5x1200 HPH-VN AZ150 G550');

console.log('✅ ALL 8 TESTS PASSED SUCCESSFULLY!');

module.exports = { formatBatchForMaterialName, mergeBatchIntoTenVatTu };
