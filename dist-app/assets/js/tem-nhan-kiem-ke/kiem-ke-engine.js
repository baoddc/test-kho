(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KiemKeEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  function normalizeNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim().replace(/\s+/g, '');
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function buildVirtualKey(maVatTu, batch) {
    const ma = String(maVatTu || '').trim();
    const b = String(batch || '').trim();
    return `${ma}-${b}`;
  }

  function parseExcelRows(rawRows) {
    const map = new Map();
    if (!Array.isArray(rawRows) || rawRows.length === 0) return map;

    // Cột G = index 6, Cột K = index 10, Cột O = index 14
    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      const ma = row[6] !== undefined ? String(row[6]).trim() : '';
      const batch = row[10] !== undefined ? String(row[10]).trim() : '';
      if (!ma && !batch) continue;

      // Bỏ qua dòng tiêu đề nếu chứa chữ "Mã vật tư" hoặc "Material"
      if (ma.toLowerCase().includes('mã') || ma.toLowerCase().includes('material')) continue;

      // Cột H (index 7) là Tên vật tư trong file Excel nếu có
      let ten = '';
      if (row[7] !== undefined && row[7] !== null) {
        const t = String(row[7]).trim();
        if (t && !t.toLowerCase().includes('tên') && !t.toLowerCase().includes('description')) {
          ten = t;
        }
      }

      const kg = normalizeNumber(row[14]);
      const vKey = buildVirtualKey(ma, batch);
      if (!vKey || vKey === '-') continue;

      if (!map.has(vKey)) {
        map.set(vKey, {
          virtualKey: vKey,
          maVatTu: ma,
          batch: batch,
          tenVatTu: ten,
          totalKg: 0,
          count: 0
        });
      }
      const item = map.get(vKey);
      if (!item.tenVatTu && ten) item.tenVatTu = ten;
      item.totalKg = Math.round((item.totalKg + kg) * 100) / 100;
      item.count += 1;
    }
    return map;
  }

  function aggregateSystemStock(activeRolls) {
    const map = new Map();
    if (!Array.isArray(activeRolls)) return map;

    activeRolls.forEach(roll => {
      const ma = String(roll['Mã vật tư'] || '').trim();
      const batch = String(roll['Batch'] || '').trim();
      const kg = normalizeNumber(roll['Số lượng (Kg)']);
      const ten = String(roll['Tên vật tư'] || '').trim();
      const vKey = buildVirtualKey(ma, batch);
      if (!vKey || vKey === '-') return;

      if (!map.has(vKey)) {
        map.set(vKey, {
          virtualKey: vKey,
          maVatTu: ma,
          batch: batch,
          tenVatTu: ten,
          totalKg: 0,
          count: 0,
          rolls: []
        });
      }
      const item = map.get(vKey);
      if (!item.tenVatTu && ten) item.tenVatTu = ten;
      item.totalKg = Math.round((item.totalKg + kg) * 100) / 100;
      item.count += 1;
      item.rolls.push(roll);
    });
    return map;
  }

  function aggregateScannedRolls(scannedList) {
    const map = new Map();
    if (!Array.isArray(scannedList)) return map;

    scannedList.forEach(item => {
      const ma = String(item.maVatTu || '').trim();
      const batch = String(item.batch || '').trim();
      const kg = normalizeNumber(item.kg);
      const vKey = buildVirtualKey(ma, batch);
      if (!vKey || vKey === '-') return;

      if (!map.has(vKey)) {
        map.set(vKey, {
          virtualKey: vKey,
          maVatTu: ma,
          batch: batch,
          totalKg: 0,
          count: 0,
          rolls: []
        });
      }
      const agg = map.get(vKey);
      agg.totalKg = Math.round((agg.totalKg + kg) * 100) / 100;
      agg.count += 1;
      agg.rolls.push(item);
    });
    return map;
  }

  function reconcile3Way(excelMap, systemMap, scannedMap) {
    const allKeys = new Set([
      ...(excelMap ? excelMap.keys() : []),
      ...(systemMap ? systemMap.keys() : []),
      ...(scannedMap ? scannedMap.keys() : [])
    ]);

    // Tạo từ điển tên vật tư theo Mã vật tư
    const matNameDict = new Map();
    if (systemMap) {
      systemMap.forEach(v => {
        if (v.maVatTu && v.tenVatTu && !matNameDict.has(v.maVatTu)) {
          matNameDict.set(v.maVatTu, v.tenVatTu);
        }
      });
    }
    if (excelMap) {
      excelMap.forEach(v => {
        if (v.maVatTu && v.tenVatTu && !matNameDict.has(v.maVatTu)) {
          matNameDict.set(v.maVatTu, v.tenVatTu);
        }
      });
    }

    const result = [];
    allKeys.forEach(vKey => {
      const ex = excelMap ? excelMap.get(vKey) : null;
      const sys = systemMap ? systemMap.get(vKey) : null;
      const sc = scannedMap ? scannedMap.get(vKey) : null;

      const maVatTu = (ex && ex.maVatTu) || (sys && sys.maVatTu) || (sc && sc.maVatTu) || '';
      const batch = (ex && ex.batch) || (sys && sys.batch) || (sc && sc.batch) || '';
      const tenVatTu = (sys && sys.tenVatTu) || (ex && ex.tenVatTu) || matNameDict.get(maVatTu) || '';

      const excelKg = ex ? ex.totalKg : 0;
      const excelCount = ex ? ex.count : 0;

      const systemKg = sys ? sys.totalKg : 0;
      const systemCount = sys ? sys.count : 0;

      const scannedKg = sc ? sc.totalKg : 0;
      const scannedCount = sc ? sc.count : 0;

      const diffScannedVsExcelKg = Math.round((scannedKg - excelKg) * 100) / 100;
      const diffScannedVsSystemKg = Math.round((scannedKg - systemKg) * 100) / 100;

      let status = 'UNSCANNED'; // Chưa quét
      if (!ex) {
        status = 'EXTRA_FILE'; // Ngoài danh mục file Excel
      } else if (scannedCount === 0) {
        status = 'UNSCANNED';
      } else if (Math.abs(diffScannedVsExcelKg) < 0.1) {
        status = 'MATCH'; // Khớp
      } else if (diffScannedVsExcelKg < 0) {
        status = 'SHORTAGE'; // Lệch thiếu
      } else {
        status = 'SURPLUS'; // Lệch thừa
      }

      result.push({
        virtualKey: vKey,
        maVatTu,
        batch,
        tenVatTu,
        excelKg,
        excelCount,
        systemKg,
        systemCount,
        scannedKg,
        scannedCount,
        diffScannedVsExcelKg,
        diffScannedVsSystemKg,
        status
      });
    });

    // Sắp xếp: Mã lệch đưa lên trước, sau đó đến mã khớp
    return result.sort((a, b) => a.virtualKey.localeCompare(b.virtualKey));
  }

  return {
    normalizeNumber,
    buildVirtualKey,
    parseExcelRows,
    aggregateSystemStock,
    aggregateScannedRolls,
    reconcile3Way
  };
}));
