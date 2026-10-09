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

  function parseBarcodeString(text) {
    if (!text) return null;
    const clean = String(text).trim();
    if (!clean) return null;

    const globalObj = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {}));
    if (globalObj.qrScannerService && typeof globalObj.qrScannerService.parseCoilBarcode === 'function') {
      const p = globalObj.qrScannerService.parseCoilBarcode(clean);
      if (p) return p;
    }

    const parts = clean.split('-').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const rawKg = parts[parts.length - 1];
      const kg = normalizeNumber(rawKg);
      return {
        maVatTu: parts[0],
        batch: parts.slice(1, -1).join('-'),
        kg: kg,
        rawText: clean
      };
    } else if (parts.length === 2) {
      return {
        maVatTu: parts[0],
        batch: parts[1],
        kg: 0,
        rawText: clean
      };
    } else {
      return {
        maVatTu: clean,
        batch: '',
        kg: 0,
        rawText: clean
      };
    }
  }

  function splitCsvLine(line, delimiter) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  function parseCsvScannedRolls(csvText, currentUser) {
    if (!csvText || typeof csvText !== 'string') {
      return { validRolls: [], skippedCount: 0, totalKg: 0 };
    }

    let cleanText = csvText;
    if (cleanText.charCodeAt(0) === 0xFEFF) {
      cleanText = cleanText.slice(1);
    }

    const rawLines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) {
      return { validRolls: [], skippedCount: 0, totalKg: 0 };
    }

    // Tự động nhận diện delimiter
    const firstLine = rawLines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    let delimiter = ',';
    if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
    else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

    const validRolls = [];
    let skippedCount = 0;
    let totalKg = 0;

    const user = currentUser || 'guest';
    const now = new Date();
    const defaultTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // Kiểm tra dòng đầu có phải Header hay không
    const firstTokens = splitCsvLine(firstLine, delimiter).map(t => t.toLowerCase());
    let hasHeader = false;
    let colBarcodeIdx = -1;
    let colMaVtIdx = -1;
    let colBatchIdx = -1;
    let colKgIdx = -1;

    firstTokens.forEach((tok, idx) => {
      const cleanTok = tok.replace(/["']/g, '').trim();
      if (/^(barcode|mã vạch|ma vach|cuộn id|cuon id|mã tem|ma tem)$/i.test(cleanTok) || cleanTok.includes('barcode')) {
        colBarcodeIdx = idx;
        hasHeader = true;
      } else if (/^(mã vật tư|ma vat tu|mã vt|ma vt|material|mã hàng|ma hang|item)$/i.test(cleanTok) || cleanTok.startsWith('mã') || cleanTok.startsWith('ma')) {
        colMaVtIdx = idx;
        hasHeader = true;
      } else if (/^(batch|lô|lo|số lô|so lo)$/i.test(cleanTok) || cleanTok.includes('batch') || cleanTok.includes('lô')) {
        colBatchIdx = idx;
        hasHeader = true;
      } else if (/^(khối lượng|khoi luong|kg|số lượng|so luong|weight|trọng lượng|trong luong)/i.test(cleanTok) || cleanTok.includes('kg')) {
        colKgIdx = idx;
        hasHeader = true;
      }
    });

    const startIdx = hasHeader ? 1 : 0;
    const headerColsCount = hasHeader ? firstTokens.length : 0;

    for (let i = startIdx; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line) continue;

      let barcode = '';
      let maVatTu = '';
      let batch = '';
      let kg = 0;

      if (hasHeader) {
        let tokens = splitCsvLine(line, delimiter);
        // Trường hợp số lẻ thập phân không ngoặc kép trong CSV dấu phẩy (VD: 10001200,BATCH-01,1200,5)
        if (delimiter === ',' && headerColsCount > 0 && tokens.length === headerColsCount + 1 && colKgIdx === headerColsCount - 1) {
          const numPart = tokens[colKgIdx] + '.' + tokens[colKgIdx + 1];
          tokens = [...tokens.slice(0, colKgIdx), numPart];
        }

        if (colBarcodeIdx >= 0 && tokens[colBarcodeIdx]) {
          barcode = tokens[colBarcodeIdx];
        }
        if (colMaVtIdx >= 0 && tokens[colMaVtIdx]) {
          maVatTu = tokens[colMaVtIdx];
        }
        if (colBatchIdx >= 0 && tokens[colBatchIdx]) {
          batch = tokens[colBatchIdx];
        }
        if (colKgIdx >= 0 && tokens[colKgIdx] !== undefined) {
          kg = normalizeNumber(tokens[colKgIdx]);
        }

        // Nếu có barcode nhưng chưa có maVatTu/batch/kg hoặc kg = 0: bóc tách từ barcode
        if (barcode && (!maVatTu || !batch || kg === 0)) {
          const parsed = parseBarcodeString(barcode);
          if (parsed) {
            if (!maVatTu) maVatTu = parsed.maVatTu;
            if (!batch) batch = parsed.batch;
            if (kg === 0 && parsed.kg) kg = parsed.kg;
          }
        }

        // Nếu chưa có barcode mà có maVatTu + batch
        if (!barcode && maVatTu) {
          barcode = batch ? `${maVatTu}-${batch}${kg > 0 ? `-${kg}` : ''}` : maVatTu;
        }

        const parsedBarcodeInfo = barcode ? parseBarcodeString(barcode) : null;
        const hasValidBarcode = parsedBarcodeInfo && (parsedBarcodeInfo.batch || parsedBarcodeInfo.kg > 0);
        const hasValidFields = !!(maVatTu && (batch || kg > 0));

        if (!hasValidBarcode && !hasValidFields) {
          skippedCount++;
          continue;
        }
      } else {
        // Không có header (dạng 1 cột hoặc nhiều cột không tiêu đề)
        const tokens = splitCsvLine(line, delimiter);
        const firstToken = tokens[0] || '';

        // Bỏ qua nếu dòng chứa chữ tiêu đề
        if (firstToken.toLowerCase().includes('mã') || firstToken.toLowerCase().includes('material') || firstToken.toLowerCase().includes('barcode')) {
          skippedCount++;
          continue;
        }

        const parsed = parseBarcodeString(firstToken);
        if (parsed && parsed.maVatTu) {
          barcode = parsed.rawText || firstToken;
          maVatTu = parsed.maVatTu;
          batch = parsed.batch || '';
          kg = parsed.kg || 0;

          // Nếu có cột thứ 2 là kg riêng biệt
          if (tokens.length >= 2 && kg === 0) {
            const extraKg = normalizeNumber(tokens[1]);
            if (extraKg > 0) kg = extraKg;
          }
        } else {
          skippedCount++;
          continue;
        }
      }

      kg = Math.round(kg * 100) / 100;
      totalKg = Math.round((totalKg + kg) * 100) / 100;

      validRolls.push({
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        barcode: barcode || `${maVatTu}-${batch}${kg > 0 ? `-${kg}` : ''}`,
        maVatTu: maVatTu || barcode,
        batch: batch || '',
        kg: kg,
        timestamp: defaultTimeStr,
        scannedBy: user
      });
    }

    return {
      validRolls,
      skippedCount,
      totalKg
    };
  }

  return {
    normalizeNumber,
    buildVirtualKey,
    parseExcelRows,
    aggregateSystemStock,
    aggregateScannedRolls,
    reconcile3Way,
    parseBarcodeString,
    parseCsvScannedRolls
  };
}));
