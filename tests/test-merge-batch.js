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

function mergeBatchIntoTenVatTu(tenVatTu, batch) {
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

  // If name already has a dimension/batch like 1.5X348VN or 3x451VN, replace it
  const dimRegex = /\b\d+(\.\d+)?\s*[xX]\s*\d+[A-Za-z0-9]*\b/i;
  if (dimRegex.test(name)) {
    return name.replace(dimRegex, formattedBatch);
  }

  // Look for standard grade/coating markers (Z275, G450, AZ150, S450GD, SGCC, etc.)
  const gradeRegex = /(?=\b(Z\d+|G\d+|AZ\d+|AM\d+|S\d+GD|S\d+|SGCC|SGCD|SECC|SPCC|SUS\s*\d+|GI\s+Z)\b)/i;
  const gradeMatch = name.search(gradeRegex);
  if (gradeMatch !== -1) {
    const before = name.substring(0, gradeMatch).trim();
    const after = name.substring(gradeMatch).trim();
    return `${before} ${formattedBatch} ${after}`.replace(/\s+/g, ' ').trim();
  }

  // Fallback: prefix match
  const prefixRegex = /^(Thép phôi kẽm|Thép phôi|Phôi tôn kẽm|Phôi tôn|Phôi thép mạ kẽm|Phôi thép|Thép tấm cuộn|Thép cuộn|Thép Inox cuộn|Thép Inox|Tôn cuộn)(\s+|$)(.*)$/i;
  const prefixMatch = name.match(prefixRegex);
  if (prefixMatch) {
    const prefix = prefixMatch[1].trim();
    const rest = (prefixMatch[3] || '').trim();
    return rest ? `${prefix} ${formattedBatch} ${rest}`.replace(/\s+/g, ' ').trim() : `${prefix} ${formattedBatch}`;
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

// Test 5: Replacing dimension
const res5 = mergeBatchIntoTenVatTu('Thép phôi kẽm 1.5X348VN Z275 G450', '3x451VN');
console.log('Test 5 (Replace dimension):', res5);
assert.strictEqual(res5, 'Thép phôi kẽm 3.0x451VN Z275 G450');

console.log('✅ ALL TESTS PASSED WITH LOWERCASE "x"!');
