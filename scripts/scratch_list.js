const XLSX = require('xlsx');

function parseRowDate(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') {
    return new Date((raw - 25569) * 86400 * 1000);
  }
  if (typeof raw === 'string') {
    const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let d = parseInt(m[1], 10);
      let mo = parseInt(m[2], 10) - 1;
      let y = parseInt(m[3], 10);
      if (y < 100) y += y < 50 ? 2000 : 1900;
      return new Date(y, mo, d);
    }
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

function parseNumericInput(value) {
  let text = String(value ?? '').trim();
  if (!text) return 0;
  text = text.replace(/\s+/g, '');
  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  if (hasComma && hasDot) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = text.split(',');
    if (parts.length === 2) {
      text = `${parts[0]}.${parts[1]}`;
    } else {
      text = text.replace(/,/g, '');
    }
  }
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

async function main() {
  const url = 'https://docs.google.com/spreadsheets/d/1KqP0KIZmKzgKvZcCJRsTVO4lhScOGRa1OzQgE893eUU/export?format=xlsx';
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const importRollsData = XLSX.utils.sheet_to_json(workbook.Sheets['xg_nhap_ct_cuon'], { header: 1, raw: false });
  const exportRollsData = XLSX.utils.sheet_to_json(workbook.Sheets['xg_xuat_ct_cuon'], { header: 1, raw: false });

  const targetDate = new Date('2025-01-01');
  targetDate.setHours(0, 0, 0, 0);

  const imports = {};
  for (let i = 1; i < importRollsData.length; i++) {
    const row = importRollsData[i];
    if (!row || !row[4]) continue;
    const rollId = String(row[4]).trim();
    const dateIn = parseRowDate(row[0]);
    if (!dateIn) continue;
    const weight = parseNumericInput(row[6]);
    imports[rollId] = { dateIn, weight };
  }

  const exports = {};
  for (let i = 1; i < exportRollsData.length; i++) {
    const row = exportRollsData[i];
    if (!row || !row[4]) continue;
    const rollId = String(row[4]).trim();
    const dateOut = parseRowDate(row[0]);
    if (!dateOut) continue;
    exports[rollId] = dateOut;
  }

  let totalWeight = 0;
  for (const rollId in imports) {
    const imp = imports[rollId];
    if (imp.dateIn <= targetDate) {
      const expDate = exports[rollId];
      if (!expDate || expDate > targetDate) {
        totalWeight += imp.weight;
      }
    }
  }

  console.log('Actual stock weight on 2025-01-01 calculated from rolls detail sheets:', totalWeight);
}

main().catch(console.error);
