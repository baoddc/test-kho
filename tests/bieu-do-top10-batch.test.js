const assert = require('assert');

console.log('--- Running Biểu Đồ Top 10 (Mã VT + Batch) Unit Tests ---');

function formatMaterialKey(ma, batch, ten) {
  const cleanMa = (ma || '').trim();
  const cleanBatch = (batch || '').trim();
  const cleanTen = (ten || '').trim();
  const hasBatch = cleanBatch && cleanBatch !== '-' && cleanBatch.toLowerCase() !== 'không batch' && cleanBatch.toLowerCase() !== 'khong batch';

  if (cleanMa && hasBatch) return `${cleanMa} (${cleanBatch})`;
  if (cleanMa) return cleanMa;
  if (hasBatch) return `Batch: ${cleanBatch}`;
  return cleanTen || '(Không xác định)';
}

function aggregateMaterialVolumes(rows, maCol, batchCol, tenCol, qtyCol) {
  const volumes = {};
  for (const row of rows) {
    const ma = row[maCol];
    const batch = row[batchCol];
    const ten = row[tenCol];
    const qty = Number(row[qtyCol]) || 0;

    const key = formatMaterialKey(ma, batch, ten);
    if (!volumes[key]) {
      volumes[key] = { qty: 0, ma, batch, ten };
    }
    volumes[key].qty += qty;
    if (ten && !volumes[key].ten) {
      volumes[key].ten = ten;
    }
  }
  return volumes;
}

// Test cases
// Case 1: Cùng mã vật tư nhưng khác batch phải tách thành 2 mục riêng biệt
const sampleRows = [
  { ma: '10001189', batch: '1.5X348VN', ten: 'Thép phôi kẽm Z275 G450', qty: 100 },
  { ma: '10001189', batch: '1.5X348VN', ten: 'Thép phôi kẽm Z275 G450', qty: 50 },
  { ma: '10001189', batch: '1.5X145VN', ten: 'Thép phôi kẽm Z275 G450', qty: 80 },
  { ma: 'B1.016216', batch: 'Không batch', ten: 'Thép phôi kẽm 2.4x426', qty: 200 },
  { ma: 'B1.016216', batch: '', ten: 'Thép phôi kẽm 2.4x426', qty: 50 },
  { ma: 'B1.142451', batch: 'VN', ten: 'Thép phôi kẽm 2.5x470', qty: 300 }
];

const aggregated = aggregateMaterialVolumes(sampleRows, 'ma', 'batch', 'ten', 'qty');

assert.strictEqual(aggregated['10001189 (1.5X348VN)'].qty, 150, 'Batch 1.5X348VN must sum to 150');
assert.strictEqual(aggregated['10001189 (1.5X145VN)'].qty, 80, 'Batch 1.5X145VN must sum to 80');
assert.strictEqual(aggregated['B1.016216'].qty, 250, 'Empty batch and "Không batch" must merge under mã VT B1.016216');
assert.strictEqual(aggregated['B1.142451 (VN)'].qty, 300, 'Batch VN must format as B1.142451 (VN)');

console.log('[PASS] All Top 10 batch aggregation unit tests passed!');
