const assert = require('assert');

// Mock dữ liệu MB51
const mockMb51Rows = [
  {
    material_document: 'PX_TEST_01',
    material: '10001189',
    material_description: 'Thép xà gồ Z275 G450',
    batch: '1.8X351VN',
    quantity: -5000,
    debit_credit_ind: 'H',
    material_group: '10040-Phôi xà gồ mạ'
  },
  {
    material_document: 'PX_TEST_01',
    material: '10001190',
    material_description: 'Thép xà gồ Z275 G350',
    batch: '2.0X351VN',
    quantity: -3000,
    debit_credit_ind: 'H',
    material_group: '10040-Phôi xà gồ mạ'
  }
];

/**
 * Hàm logic xác thực dùng chung
 */
function validateExportReceiptData(docNo, multiItemsData, mb51Rows) {
  if (!docNo || !String(docNo).trim()) {
    return { isValid: false, message: 'Vui lòng nhập số phiếu xuất' };
  }
  const cleanDoc = String(docNo).trim().toLowerCase();
  const docRows = (mb51Rows || []).filter(r => String(r.material_document || '').toLowerCase() === cleanDoc);
  if (docRows.length === 0) {
    return { isValid: false, notFoundInSap: true, message: `Phiếu xuất ${docNo} chưa tồn tại trong dữ liệu SAP MB51` };
  }

  const sapMap = new Map();
  docRows.forEach(r => {
    const mat = String(r.material || '').trim();
    const batch = String(r.batch || '').trim();
    const key = `${mat}__${batch}`.toLowerCase();
    const qty = Math.abs(parseFloat(r.quantity) || 0);
    if (!sapMap.has(key)) {
      sapMap.set(key, { material: mat, description: r.material_description, batch, totalSapKg: qty });
    } else {
      sapMap.get(key).totalSapKg += qty;
    }
  });

  const errors = [];
  let totalSapKg = 0;
  let totalActualKg = 0;

  sapMap.forEach(item => { totalSapKg += item.totalSapKg; });

  (multiItemsData || []).forEach((item, idx) => {
    const mat = String(item.maVatTu || '').trim();
    const batch = String(item.batch || '').trim();
    const key = `${mat}__${batch}`.toLowerCase();
    const sapItem = sapMap.get(key);

    const rolls = item.rolls || [];
    let itemKg = 0;
    rolls.forEach(r => {
      const parsed = parseFloat(r.kg) || 0;
      itemKg += parsed;
      if (r.maVatTu && String(r.maVatTu).trim().toLowerCase() !== mat.toLowerCase()) {
        errors.push({ itemIdx: idx + 1, reason: `Cuộn ${r.cuonId} sai Mã VT (${r.maVatTu} khác ${mat})` });
      }
      if (r.batch && String(r.batch).trim().toLowerCase() !== batch.toLowerCase()) {
        errors.push({ itemIdx: idx + 1, reason: `Cuộn ${r.cuonId} sai Batch (${r.batch} khác ${batch})` });
      }
    });

    totalActualKg += itemKg;

    if (!sapItem) {
      errors.push({ itemIdx: idx + 1, reason: `Mặt hàng ${mat} (Lô: ${batch}) không thuộc phiếu xuất MB51` });
      return;
    }

    if (rolls.length === 0 || itemKg === 0) {
      errors.push({ itemIdx: idx + 1, maVatTu: mat, batch, sapKg: sapItem.totalSapKg, actualKg: 0, diff: -sapItem.totalSapKg, reason: 'Chưa chọn cuộn từ kho' });
      return;
    }

    const diff = Math.round((itemKg - sapItem.totalSapKg) * 100) / 100;
    if (Math.abs(diff) >= 0.05) {
      errors.push({ itemIdx: idx + 1, maVatTu: mat, batch, sapKg: sapItem.totalSapKg, actualKg: itemKg, diff, reason: diff > 0 ? `Lệch dư (+${diff} kg)` : `Lệch thiếu (${diff} kg)` });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    sapSummary: {
      totalSapKg,
      totalActualKg,
      totalDiff: Math.round((totalActualKg - totalSapKg) * 100) / 100
    }
  };
}

// Case 1: Phiếu không tồn tại
const r1 = validateExportReceiptData('PX_NOT_FOUND', [], mockMb51Rows);
assert.strictEqual(r1.isValid, false);
assert.strictEqual(r1.notFoundInSap, true);

// Case 2: Chưa chọn cuộn
const r2 = validateExportReceiptData('PX_TEST_01', [
  { maVatTu: '10001189', batch: '1.8X351VN', rolls: [] }
], mockMb51Rows);
assert.strictEqual(r2.isValid, false);
assert.strictEqual(r2.errors.length, 1);

// Case 3: Lệch số kg (Thiếu)
const r3 = validateExportReceiptData('PX_TEST_01', [
  { maVatTu: '10001189', batch: '1.8X351VN', rolls: [{ cuonId: 'C1', kg: '4000' }] }
], mockMb51Rows);
assert.strictEqual(r3.isValid, false);
assert.strictEqual(r3.errors[0].diff, -1000);

// Case 4: Khớp 100%
const r4 = validateExportReceiptData('PX_TEST_01', [
  { maVatTu: '10001189', batch: '1.8X351VN', rolls: [{ cuonId: 'C1', kg: '2500' }, { cuonId: 'C2', kg: '2500' }] },
  { maVatTu: '10001190', batch: '2.0X351VN', rolls: [{ cuonId: 'C3', kg: '3000' }] }
], mockMb51Rows);
assert.strictEqual(r4.isValid, true);
assert.strictEqual(r4.errors.length, 0);

console.log('✓ All 4 validation unit tests passed!');
