const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Đọc Supabase Config từ assets/js/supabase-config.js
function getSupabaseConfig() {
  const configPath = path.join(__dirname, '..', 'assets', 'js', 'supabase-config.js');
  if (!fs.existsSync(configPath)) {
    throw new Error('Không tìm thấy file supabase-config.js tại: ' + configPath);
  }
  const content = fs.readFileSync(configPath, 'utf8');
  
  const urlMatch = content.match(/const\s+SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
  const keyMatch = content.match(/const\s+SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
  
  if (!urlMatch || !keyMatch) {
    throw new Error('Không thể parse SUPABASE_URL hoặc SUPABASE_ANON_KEY từ supabase-config.js');
  }
  
  return {
    url: urlMatch[1],
    key: keyMatch[1]
  };
}

// Helper to parse dates correctly
function parseExcelDate(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    // Excel date serial
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  }
  
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    
    // Check for dd/mm/yyyy
    let parts = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (parts) {
      const d = String(parts[1]).padStart(2, '0');
      const m = String(parts[2]).padStart(2, '0');
      const y = parts[3];
      return `${y}-${m}-${d}`;
    }
    
    // Check for yyyy-mm-dd
    parts = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (parts) {
      return `${parts[1]}-${String(parts[2]).padStart(2, '0')}-${String(parts[3]).padStart(2, '0')}`;
    }
    
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  
  return null;
}

// Helper to parse numeric inputs
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  
  let text = value.toString().replace(/ kg/g, '').trim();
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

  const num = parseFloat(text);
  return isNaN(num) ? null : num;
}

// Bulk insert data helper
async function bulkInsertSupabase(url, key, tableName, rows) {
  if (rows.length === 0) {
    console.log(`Bảng ${tableName}: Không có dòng nào để import.`);
    return;
  }
  
  console.log(`Bảng ${tableName}: Đang gửi ${rows.length} dòng lên Supabase...`);
  
  const endpoint = `${url}/rest/v1/${tableName}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(rows)
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Lỗi insert bảng ${tableName}: ${response.statusText} - ${text}`);
  }
  
  console.log(`Bảng ${tableName}: Đã di chuyển thành công!`);
}

async function main() {
  const { url, key } = getSupabaseConfig();
  console.log('Supabase URL:', url);
  
  const sheetId = '1iGS7srFqOvP44NATaR26lOQEtCQIsjKFU9PG-TQ1otE';
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
  
  console.log('Đang tải file Google Sheets...');
  const res = await fetch(spreadsheetUrl);
  if (!res.ok) throw new Error('Không thể tải file Google Sheets: ' + res.statusText);
  const arrayBuffer = await res.arrayBuffer();
  
  console.log('Đang parse file Excel...');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const tableMappings = [
    { sheetName: 'DDC-can-thu', tableName: 'pl-can-thu', type: 'pl' },
    { sheetName: 'DDC-chua-thu', tableName: 'pl-chua-thu', type: 'pl' },
    { sheetName: 'DDC-da-thu', tableName: 'pl-da-thu', type: 'pl' },
    { sheetName: 'data', tableName: 'pl-phieu-in', type: 'phieu-in' },
    { sheetName: 'them-dropdown', tableName: 'pl-mathang', type: 'mathang' }
  ];
  
  for (const mapping of tableMappings) {
    const ws = workbook.Sheets[mapping.sheetName];
    if (!ws) {
      console.warn(`Không tìm thấy sheet name: ${mapping.sheetName}. Bỏ qua.`);
      continue;
    }
    
    const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (jsonData.length === 0) {
      console.warn(`Sheet ${mapping.sheetName} rỗng. Bỏ qua.`);
      continue;
    }
    
    // Tìm dòng header thực sự
    let headerRowIndex = 0;
    while (headerRowIndex < jsonData.length) {
      const row = jsonData[headerRowIndex];
      if (row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
        break;
      }
      headerRowIndex++;
    }
    
    if (headerRowIndex >= jsonData.length) {
      console.warn(`Không tìm thấy header hợp lệ trong sheet ${mapping.sheetName}. Bỏ qua.`);
      continue;
    }
    
    const headers = jsonData[headerRowIndex].map(h => String(h || '').trim());
    console.log(`Sheet: ${mapping.sheetName} | Headers:`, headers);
    
    const rowsToInsert = [];
    
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) {
        continue;
      }
      
      const record = {};
      headers.forEach((header, colIdx) => {
        if (header) {
          record[header] = row[colIdx];
        }
      });
      
      if (mapping.type === 'pl') {
        // Map headers to DB columns
        const normalized = {};
        
        // Cần map đúng các trường: Ngày, Kì đổ, Xưởng, Loại phế liệu, Số lượng (kg), Ghi chú, Cột 8 (Kì đổ_Xưởng_Loại phế liệu)
        const dateKey = Object.keys(record).find(k => k.toLowerCase().includes('ngày') || k.toLowerCase().includes('ngay'));
        const kidoKey = Object.keys(record).find(k => k.toLowerCase().includes('kì đổ') || k.toLowerCase().includes('kido') || k.toLowerCase().includes('ki đổ'));
        const xuongKey = Object.keys(record).find(k => k.toLowerCase().includes('xưởng') || k.toLowerCase().includes('xuong'));
        const loaiKey = Object.keys(record).find(k => k.toLowerCase().includes('loại phế liệu') || k.toLowerCase().includes('loai') || k.toLowerCase().includes('loại'));
        const slKey = Object.keys(record).find(k => k.toLowerCase().includes('số lượng') || k.toLowerCase().includes('soluong') || k.toLowerCase().includes('kg'));
        const noteKey = Object.keys(record).find(k => k.toLowerCase().includes('ghi chú') || k.toLowerCase().includes('ghichu'));
        const col8Key = Object.keys(record).find(k => k.toLowerCase().includes('cột 8') || k.toLowerCase().includes('column8') || k.toLowerCase().includes('kì đổ_xưởng'));
        
        normalized['Ngày'] = dateKey ? parseExcelDate(record[dateKey]) : null;
        normalized['Kì đổ'] = kidoKey ? String(record[kidoKey]).trim() : '';
        normalized['Xưởng'] = xuongKey ? String(record[xuongKey]).trim() : '';
        normalized['Loại phế liệu'] = loaiKey ? String(record[loaiKey]).trim() : '';
        normalized['Số lượng (kg)'] = slKey ? parseNumber(record[slKey]) : 0;
        normalized['Ghi chú'] = noteKey ? String(record[noteKey]).trim() : '';
        
        // Cột 8
        const col8Val = col8Key ? String(record[col8Key]).trim() : '';
        normalized['Cột 8 (Kì đổ_Xưởng_Loại phế liệu)'] = col8Val || `${normalized['Kì đổ']}_${normalized['Xưởng']}_${normalized['Loại phế liệu']}`;
        
        // Chỉ lưu nếu có dữ liệu chính
        if (normalized['Xưởng'] || normalized['Loại phế liệu'] || normalized['Ngày']) {
          rowsToInsert.push(normalized);
        }
      } 
      
      else if (mapping.type === 'phieu-in') {
        const normalized = {};
        // Map: Ngày, Số phiếu, Bên nhận/ Xưởng/Đội, Loại xuất, Mặt hàng, ĐVT, Trọng lượng hàng, Số xe, Mã công trình, Tên công trình
        const sophieuKey = Object.keys(record).find(k => k.toLowerCase().includes('số phiếu') || k.toLowerCase().includes('sophieu'));
        const soxeKey = Object.keys(record).find(k => k.toLowerCase().includes('số xe') || k.toLowerCase().includes('soxe'));
        const ngayKey = Object.keys(record).find(k => k.toLowerCase().includes('ngày') || k.toLowerCase().includes('ngay'));
        const bennhanKey = Object.keys(record).find(k => k.toLowerCase().includes('bên nhận') || k.toLowerCase().includes('bennhan') || k.toLowerCase().includes('xưởng') || k.toLowerCase().includes('đội'));
        const loaixuatKey = Object.keys(record).find(k => k.toLowerCase().includes('loại xuất') || k.toLowerCase().includes('loaixuat'));
        const mathangKey = Object.keys(record).find(k => k.toLowerCase().includes('mặt hàng') || k.toLowerCase().includes('mathang'));
        const dvtKey = Object.keys(record).find(k => k.toLowerCase().includes('đvt') || k.toLowerCase().includes('dvt'));
        const trongluongKey = Object.keys(record).find(k => k.toLowerCase().includes('trọng lượng') || k.toLowerCase().includes('trongluong') || k.toLowerCase().includes('khối lượng'));
        const macongtrinhKey = Object.keys(record).find(k => k.toLowerCase().includes('mã công trình') || k.toLowerCase().includes('macongtrinh'));
        const tencongtrinhKey = Object.keys(record).find(k => k.toLowerCase().includes('tên công trình') || k.toLowerCase().includes('tencongtrinh'));
        
        normalized['Ngày'] = ngayKey ? parseExcelDate(record[ngayKey]) : null;
        normalized['Số phiếu'] = sophieuKey ? String(record[sophieuKey]).trim() : '';
        normalized['Bên nhận/ Xưởng/Đội'] = bennhanKey ? String(record[bennhanKey]).trim() : '';
        normalized['Loại xuất'] = loaixuatKey ? String(record[loaixuatKey]).trim() : '';
        normalized['Mặt hàng'] = mathangKey ? String(record[mathangKey]).trim() : '';
        normalized['ĐVT'] = dvtKey ? String(record[dvtKey]).trim() : '';
        normalized['Trọng lượng hàng'] = trongluongKey ? parseNumber(record[trongluongKey]) : null;
        normalized['Số xe'] = soxeKey ? String(record[soxeKey]).trim() : '';
        normalized['Mã công trình'] = macongtrinhKey ? String(record[macongtrinhKey]).trim() : '';
        normalized['Tên công trình'] = tencongtrinhKey ? String(record[tencongtrinhKey]).trim() : '';
        
        if (normalized['Số phiếu'] || normalized['Mặt hàng']) {
          rowsToInsert.push(normalized);
        }
      } 
      
      else if (mapping.type === 'mathang') {
        const normalized = {};
        // dropdown columns: name, unit, code (từ Array hoặc Object)
        // Header trong Excel là gì? Có thể là: "Mặt hàng" hoặc "name", "ĐVT" hoặc "unit", "Mã" hoặc "code"
        const nameKey = Object.keys(record).find(k => k.toLowerCase().includes('mặt hàng') || k.toLowerCase().includes('name') || k.toLowerCase().includes('tên'));
        const unitKey = Object.keys(record).find(k => k.toLowerCase().includes('đvt') || k.toLowerCase().includes('unit') || k.toLowerCase().includes('đơn vị'));
        const codeKey = Object.keys(record).find(k => k.toLowerCase().includes('mã') || k.toLowerCase().includes('code'));
        
        normalized['name'] = nameKey ? String(record[nameKey]).trim() : '';
        normalized['unit'] = unitKey ? String(record[unitKey]).trim() : 'KG';
        normalized['code'] = codeKey ? String(record[codeKey]).trim() : '';
        
        if (normalized['name']) {
          rowsToInsert.push(normalized);
        }
      }
    }
    
    // Thực hiện bulk insert lên Supabase
    try {
      await bulkInsertSupabase(url, key, mapping.tableName, rowsToInsert);
    } catch (err) {
      console.error(`Lỗi khi import bảng ${mapping.tableName}:`, err.message);
      throw err;
    }
  }
  
  console.log('MIGRATION COMPLETE!');
}

main().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
