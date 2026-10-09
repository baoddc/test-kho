# Kế Hoạch Triển Khai: Tự Động Sao Lưu Dữ Liệu Supabase Thành Các File CSV Hàng Ngày Lúc 17:00

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống sao lưu tự động toàn bộ các bảng dữ liệu Supabase thành từng file `.csv` riêng biệt (chuẩn UTF-8 BOM) lưu về máy tính hàng ngày lúc 17:00 thông qua Windows Task Scheduler, kèm bộ công cụ Batch script 1-click chạy thủ công hoặc cài đặt lịch tự động.

**Architecture:** Sử dụng Node.js CLI script làm core engine để đọc cấu hình Supabase, trích xuất dữ liệu qua PostgREST API với cơ chế phân trang tự động (Auto-Pagination), chuyển đổi sang CSV chuẩn RFC 4180 có UTF-8 BOM cho Excel; kết hợp VBScript silent runner để Windows Task Scheduler chạy ngầm êm ái lúc 17:00 hàng ngày (có cơ chế chạy bù khi mở máy), cùng các file `.bat` tương tác 1-click.

**Tech Stack:** Node.js (v18+ native `fetch`, `fs`, `path`), Windows Task Scheduler (`schtasks`), VBScript (`WScript.Shell`), Windows Batch Script (`.bat`), RFC 4180 CSV Specification.

## Global Constraints

- **Charset:** Toàn bộ file CSV phải có tiền tố UTF-8 BOM (`\uFEFF`) ở đầu file để Microsoft Excel trên Windows mở trực tiếp không lỗi tiếng Việt.
- **RFC 4180:** Các ô dữ liệu chứa dấu phẩy `,`, dấu ngoặc kép `"`, hoặc ký tự xuống dòng `\r`, `\n` phải được bao bọc trong dấu nháy kép `"` và escape dấu nháy kép thành `""`.
- **Thư mục lưu trữ:** Thư mục `backups/` nằm ở thư mục gốc của dự án và phải được thêm vào `.gitignore`.
- **Lập lịch 17:00:** Tên Task Scheduler là `DDC_Supabase_Daily_Backup_17h`, kích hoạt hàng ngày lúc 17:00 với cờ cho phép chạy bù nếu máy tính bị tắt nguồn.

---

### Task 1: Cấu Hình .gitignore & Module Chuyển Đổi CSV UTF-8 BOM Kèm Unit Tests

**Files:**
- Modify: `.gitignore`
- Create: `scripts/csv-exporter.js`
- Create: `tests/csv-exporter.test.js`

**Interfaces:**
- Produces:
  - `formatValueForCsv(val: any): string`
  - `convertJsonToCsv(records: Array<Object>): string` (trả về chuỗi CSV có tiền tố `\uFEFF`)
  - `extractSupabaseCredentials(): { url: string, anonKey: string }`

- [ ] **Step 1: Viết test kiểm tra chuyển đổi JSON sang CSV chuẩn UTF-8 BOM và đọc config Supabase**

Tạo file `tests/csv-exporter.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatValueForCsv, convertJsonToCsv, extractSupabaseCredentials } = require('../scripts/csv-exporter.js');

test('formatValueForCsv escapes commas, quotes, and newlines correctly', () => {
  assert.equal(formatValueForCsv('Hello, World'), '"Hello, World"');
  assert.equal(formatValueForCsv('He said "Hi"'), '"He said ""Hi"""');
  assert.equal(formatValueForCsv("Line1\nLine2"), '"Line1\nLine2"');
  assert.equal(formatValueForCsv(null), '');
  assert.equal(formatValueForCsv(undefined), '');
  assert.equal(formatValueForCsv(1234.5), '1234.5');
  assert.equal(formatValueForCsv({ a: 1 }), '"{\\"a\\":1}"');
});

test('convertJsonToCsv generates valid CSV with UTF-8 BOM and unified headers', () => {
  const data = [
    { id: 1, 'Mã vật tư': 'VT001', 'Tên hàng': 'Xà gồ C200, dày 2mm', 'Ghi chú': 'Đạt' },
    { id: 2, 'Mã vật tư': 'VT002', 'Tên hàng': 'Tole mạ kẽm "AZ100"', 'Ghi chú': 'Ưu tiên\nXuất gấp' }
  ];

  const csv = convertJsonToCsv(data);
  // Verify UTF-8 BOM prefix
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');

  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], 'id,Mã vật tư,Tên hàng,Ghi chú');
  assert.equal(lines[1], '1,VT001,"Xà gồ C200, dày 2mm",Đạt');
  assert.equal(lines[2], '2,VT002,"Tole mạ kẽm ""AZ100""","Ưu tiên\nXuất gấp"');
});

test('convertJsonToCsv handles empty array', () => {
  const csv = convertJsonToCsv([]);
  assert.equal(csv, '\uFEFF');
});

test('extractSupabaseCredentials reads valid credentials from supabase-config.js', () => {
  const creds = extractSupabaseCredentials();
  assert.ok(creds.url && creds.url.startsWith('https://'), 'URL must be a valid https link');
  assert.ok(creds.anonKey && creds.anonKey.length > 20, 'Anon key must be valid');
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại vì chưa tạo script**

Chạy lệnh: `node --test tests/csv-exporter.test.js`
Kỳ vọng: Lỗi `Cannot find module '../scripts/csv-exporter.js'`.

- [ ] **Step 3: Triển khai `scripts/csv-exporter.js` và cập nhật `.gitignore`**

1. Cập nhật `.gitignore` (thêm dòng `backups/` vào cuối file).
2. Tạo file `scripts/csv-exporter.js`:
```javascript
const fs = require('fs');
const path = require('path');

/**
 * Format a single field value according to RFC 4180
 * @param {any} val 
 * @returns {string}
 */
function formatValueForCsv(val) {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  } else {
    val = String(val);
  }

  // If string contains comma, double-quote, or newline, wrap in quotes and escape quotes
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Converts array of JSON objects to a CSV string prefixed with UTF-8 BOM (\uFEFF)
 * @param {Array<Object>} records 
 * @returns {string}
 */
function convertJsonToCsv(records) {
  const BOM = '\uFEFF';
  if (!Array.isArray(records) || records.length === 0) {
    return BOM;
  }

  // Collect all unique header keys across all records
  const headersSet = new Set();
  records.forEach(rec => {
    if (rec && typeof rec === 'object') {
      Object.keys(rec).forEach(k => headersSet.add(k));
    }
  });

  const headers = Array.from(headersSet);
  const headerLine = headers.map(h => formatValueForCsv(h)).join(',');

  const rows = records.map(rec => {
    return headers.map(h => formatValueForCsv(rec[h])).join(',');
  });

  return BOM + [headerLine, ...rows].join('\r\n');
}

/**
 * Extracts Supabase URL and Anon Key from project configuration file
 * @returns {{ url: string, anonKey: string }}
 */
function extractSupabaseCredentials() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return {
      url: process.env.SUPABASE_URL.trim(),
      anonKey: process.env.SUPABASE_ANON_KEY.trim()
    };
  }

  const candidates = [
    path.join(__dirname, '..', 'assets', 'js', 'core', 'supabase-config.js'),
    path.join(__dirname, '..', 'assets', 'js', 'supabase-config.js'),
    path.join(__dirname, '..', 'public', 'assets', 'js', 'core', 'supabase-config.js')
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const urlMatch = content.match(/const\s+SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
      const keyMatch = content.match(/const\s+SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
      if (urlMatch && keyMatch) {
        return {
          url: urlMatch[1].trim(),
          anonKey: keyMatch[1].trim()
        };
      }
    }
  }

  throw new Error('Không tìm thấy cấu hình SUPABASE_URL và SUPABASE_ANON_KEY trong file supabase-config.js');
}

module.exports = {
  formatValueForCsv,
  convertJsonToCsv,
  extractSupabaseCredentials
};
```

- [ ] **Step 4: Chạy lại test xác nhận PASS**

Chạy lệnh: `node --test tests/csv-exporter.test.js`
Kỳ vọng: Toàn bộ 4 test suites đều PASS 100%.

- [ ] **Step 5: Commit git Task 1**

```bash
git add .gitignore scripts/csv-exporter.js tests/csv-exporter.test.js
git commit -m "feat(backup): add csv exporter with utf-8 bom and unit test suite"
```

---

### Task 2: Xây Dựng Core Backup Engine Với Phân Trang Tự Động (Auto-Pagination)

**Files:**
- Create: `scripts/backup-supabase-to-csv.js`
- Test: `tests/backup-engine.test.js`

**Interfaces:**
- Consumes: `convertJsonToCsv`, `extractSupabaseCredentials` từ `scripts/csv-exporter.js`
- Produces:
  - `fetchTableAllRows(supabaseUrl, anonKey, tableName, options): Promise<Array<Object>>`
  - `executeBackup(options): Promise<Object>` (kết quả summary)

- [ ] **Step 1: Viết test cho engine sao lưu với mock HTTP server**

Tạo file `tests/backup-engine.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { fetchTableAllRows, executeBackup } = require('../scripts/backup-supabase-to-csv.js');

test('fetchTableAllRows paginates across multiple batches when records > 1000', async () => {
  // Tạo server HTTP mock trả về 1050 dòng (đợt 1: 1000 dòng, đợt 2: 50 dòng)
  const server = http.createServer((req, res) => {
    const range = req.headers['range'];
    if (range === '0-999') {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
      res.writeHead(206, {
        'Content-Type': 'application/json',
        'Content-Range': '0-999/1050'
      });
      res.end(JSON.stringify(items));
    } else if (range === '1000-1999') {
      const items = Array.from({ length: 50 }, (_, i) => ({ id: 1000 + i + 1, name: `Row ${1000 + i + 1}` }));
      res.writeHead(206, {
        'Content-Type': 'application/json',
        'Content-Range': '1000-1049/1050'
      });
      res.end(JSON.stringify(items));
    } else {
      res.writeHead(400);
      res.end('Bad Range');
    }
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const mockUrl = `http://localhost:${port}`;

  try {
    const rows = await fetchTableAllRows(mockUrl, 'test-key', 'mock_table', { batchSize: 1000 });
    assert.equal(rows.length, 1050, 'Must have fetched all 1050 rows across pagination batches');
    assert.equal(rows[0].id, 1);
    assert.equal(rows[1049].id, 1050);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('executeBackup exports tables into timestamped directory with backup-summary.json', async () => {
  const tempBackupDir = path.join(__dirname, 'temp_backup_test');
  if (fs.existsSync(tempBackupDir)) {
    fs.rmSync(tempBackupDir, { recursive: true, force: true });
  }

  // Chạy executeBackup với danh sách bảng tùy chỉnh và mock fetch
  const mockFetcher = async (url, key, table) => {
    return [{ id: 1, table_name: table, created_at: '2026-10-09' }];
  };

  const summary = await executeBackup({
    baseDir: tempBackupDir,
    tables: ['table_a', 'table_b'],
    fetcher: mockFetcher,
    isManual: true
  });

  assert.equal(summary.successfulTables, 2);
  assert.equal(summary.failedTables, 0);
  assert.ok(fs.existsSync(summary.targetFolder));
  assert.ok(fs.existsSync(path.join(summary.targetFolder, 'table_a.csv')));
  assert.ok(fs.existsSync(path.join(summary.targetFolder, 'table_b.csv')));
  assert.ok(fs.existsSync(path.join(summary.targetFolder, 'backup-summary.json')));

  // Dọn dẹp
  fs.rmSync(tempBackupDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại vì chưa tạo `backup-supabase-to-csv.js`**

Chạy lệnh: `node --test tests/backup-engine.test.js`
Kỳ vọng: Thất bại.

- [ ] **Step 3: Triển khai hoàn chỉnh `scripts/backup-supabase-to-csv.js`**

Tạo file `scripts/backup-supabase-to-csv.js`:
```javascript
const fs = require('fs');
const path = require('path');
const { formatValueForCsv, convertJsonToCsv, extractSupabaseCredentials } = require('./csv-exporter.js');

// Danh sách các bảng nghiệp vụ cần sao lưu mặc định
const DEFAULT_TABLES = [
  'xg-nhap',
  'xg-xuat',
  'tole-nhap',
  'tole-xuat',
  'pl-can-thu',
  'pl-chua-thu',
  'pl-da-thu',
  'pl-phieu-in',
  'pl-mathang',
  'xg_sap_mb51',
  'kiem_ke_scans',
  'cong_viec',
  'system_announcements'
];

/**
 * Tải toàn bộ dòng dữ liệu từ một bảng qua PostgREST REST API với pagination
 */
async function fetchTableAllRows(supabaseUrl, anonKey, tableName, options = {}) {
  const batchSize = options.batchSize || 1000;
  const timeoutMs = options.timeoutMs || 30000;
  let allRows = [];
  let from = 0;
  let totalCount = null;

  while (true) {
    const to = from + batchSize - 1;
    const url = `${supabaseUrl}/rest/v1/${encodeURIComponent(tableName)}?select=*`;
    
    let attempt = 0;
    let res = null;
    let lastErr = null;

    while (attempt < 3) {
      attempt++;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        res = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Range': `${from}-${to}`,
            'Prefer': 'count=exact'
          },
          signal: controller.signal
        });
        clearTimeout(timer);
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    if (!res) {
      throw new Error(`Lỗi kết nối tới bảng '${tableName}' sau 3 lần thử: ${lastErr?.message}`);
    }

    if (!res.ok && res.status !== 206) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Supabase API trả về mã lỗi ${res.status} cho bảng '${tableName}': ${errText}`);
    }

    // Đọc Content-Range: "0-999/1393"
    const contentRange = res.headers.get('content-range');
    if (contentRange && contentRange.includes('/')) {
      const totalPart = contentRange.split('/')[1];
      if (totalPart && totalPart !== '*') {
        totalCount = parseInt(totalPart, 10);
      }
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    allRows = allRows.concat(data);

    if (totalCount !== null && allRows.length >= totalCount) {
      break;
    }

    if (data.length < batchSize) {
      break;
    }

    from += batchSize;
  }

  return allRows;
}

/**
 * Sinh tên thư mục sao lưu theo ngày giờ
 */
function getBackupFolderName(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${yyyy}-${MM}-${dd}_${HH}h${mm}`;
}

/**
 * Thực thi sao lưu dữ liệu toàn bộ danh sách bảng
 */
async function executeBackup(options = {}) {
  const startTime = Date.now();
  const baseDir = options.baseDir || path.join(__dirname, '..', 'backups');
  const tables = options.tables || DEFAULT_TABLES;
  const isSilent = !!options.silent;
  const fetcher = options.fetcher || ((url, key, table) => fetchTableAllRows(url, key, table, options));

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const folderName = getBackupFolderName();
  const targetFolder = path.join(baseDir, folderName);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  let creds;
  try {
    creds = extractSupabaseCredentials();
  } catch (e) {
    if (!options.fetcher) throw e;
    creds = { url: 'mock', anonKey: 'mock' };
  }

  const logFile = path.join(baseDir, 'backup.log');
  const writeLog = (msg) => {
    const logLine = `[${new Date().toISOString()}] ${msg}\n`;
    try { fs.appendFileSync(logFile, logLine, 'utf8'); } catch (_) {}
    if (!isSilent) console.log(msg);
  };

  writeLog(`=== BẮT ĐẦU SAO LƯU SUPABASE (${tables.length} bảng) ===`);
  writeLog(`Thư mục lưu trữ: ${targetFolder}`);

  const summary = {
    backupDate: new Date().toISOString(),
    targetFolder,
    totalTables: tables.length,
    successfulTables: 0,
    failedTables: 0,
    tables: {},
    errors: {}
  };

  for (const table of tables) {
    try {
      if (!isSilent) process.stdout.write(`Đang tải bảng '${table}'... `);
      const rows = await fetcher(creds.url, creds.anonKey, table);
      const csvContent = convertJsonToCsv(rows);
      const filePath = path.join(targetFolder, `${table}.csv`);
      fs.writeFileSync(filePath, csvContent, 'utf8');

      const sizeBytes = fs.statSync(filePath).size;
      summary.tables[table] = {
        rows: rows.length,
        fileSizeBytes: sizeBytes,
        fileName: `${table}.csv`
      };
      summary.successfulTables++;
      if (!isSilent) console.log(`✓ Xong (${rows.length} dòng, ${(sizeBytes / 1024).toFixed(1)} KB)`);
    } catch (err) {
      summary.failedTables++;
      summary.errors[table] = err.message;
      writeLog(`✗ Lỗi bảng '${table}': ${err.message}`);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  summary.durationSeconds = parseFloat(durationSec);
  summary.status = summary.failedTables === 0 ? 'success' : (summary.successfulTables > 0 ? 'partial' : 'failed');

  const summaryPath = path.join(targetFolder, 'backup-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  writeLog(`=== HOÀN TẤT SAO LƯU: Thành công ${summary.successfulTables}/${summary.totalTables} bảng trong ${durationSec} giây ===\n`);

  return summary;
}

// Nếu chạy trực tiếp từ dòng lệnh
if (require.main === module) {
  const isSilent = process.argv.includes('--silent');
  executeBackup({ silent: isSilent })
    .then(summary => {
      if (summary.failedTables > 0 && !isSilent) {
        console.warn(`Cảnh báo: Có ${summary.failedTables} bảng bị lỗi. Xem chi tiết tại backup-summary.json`);
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('Lỗi nghiêm trọng trong tiến trình backup:', err);
      process.exit(1);
    });
}

module.exports = {
  DEFAULT_TABLES,
  fetchTableAllRows,
  getBackupFolderName,
  executeBackup
};
```

- [ ] **Step 4: Chạy test xác nhận PASS**

Chạy lệnh: `node --test tests/backup-engine.test.js`
Kỳ vọng: PASS 100%.

- [ ] **Step 5: Commit git Task 2**

```bash
git add scripts/backup-supabase-to-csv.js tests/backup-engine.test.js
git commit -m "feat(backup): add core supabase backup engine with auto-pagination and summary"
```

---

### Task 3: Tích Hợp Windows Toast Notification & Silent Runner

**Files:**
- Create: `scripts/run-backup-silent.vbs`
- Modify: `scripts/backup-supabase-to-csv.js`

**Interfaces:**
- Produces: `scripts/run-backup-silent.vbs` (chạy script Node.js trong chế độ ẩn màn hình)

- [ ] **Step 1: Thêm Windows Notification vào `scripts/backup-supabase-to-csv.js` khi hoàn tất**

Bổ sung hàm gửi Windows Toast Notification bằng PowerShell nhẹ nhàng khi sao lưu hoàn tất:
```javascript
function sendWindowsNotification(title, message) {
  try {
    const { exec } = require('child_process');
    // Escape single quotes for PowerShell
    const safeTitle = title.replace(/'/g, "''");
    const safeMsg = message.replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -Command "[reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null; $notify = New-Object System.Windows.Forms.NotifyIcon; $notify.Icon = [System.Drawing.SystemIcons]::Information; $notify.BalloonTipTitle = '${safeTitle}'; $notify.BalloonTipText = '${safeMsg}'; $notify.Visible = $True; $notify.ShowBalloonTip(5000); Start-Sleep -Seconds 6; $notify.Dispose()"`;
    exec(psCmd, { windowsHide: true });
  } catch (_) {}
}
```

- [ ] **Step 2: Tạo file `scripts/run-backup-silent.vbs`**

Tạo file `scripts/run-backup-silent.vbs` để chạy ngầm không hiện cửa sổ command prompt đen:
```vbscript
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

cmd = "node """ & scriptDir & "\backup-supabase-to-csv.js"" --silent"
WshShell.CurrentDirectory = projectDir
WshShell.Run cmd, 0, False
```

- [ ] **Step 3: Chạy thử nghiệm cú pháp VBScript và kiểm tra không văng lỗi**

Chạy lệnh: `cscript //nologo scripts/run-backup-silent.vbs`
Kỳ vọng: Không có lỗi cú pháp, lệnh chạy mượt mà.

- [ ] **Step 4: Commit git Task 3**

```bash
git add scripts/run-backup-silent.vbs scripts/backup-supabase-to-csv.js
git commit -m "feat(backup): add windows notification and silent vbs runner for task scheduler"
```

---

### Task 4: Xây Dựng Bộ Công Cụ Batch Script 1-Click

**Files:**
- Create: `cai-dat-lich-backup-17h.bat`
- Create: `huy-lich-backup-17h.bat`
- Create: `Backup_Supabase_Ngay.bat`

**Interfaces:**
- Produces:
  - `cai-dat-lich-backup-17h.bat`: Đăng ký task `DDC_Supabase_Daily_Backup_17h` với trigger 17:00 hàng ngày và catch-up run.
  - `huy-lich-backup-17h.bat`: Xóa task `DDC_Supabase_Daily_Backup_17h`.
  - `Backup_Supabase_Ngay.bat`: Chạy backup trực tiếp tức thì với giao diện bảng thông tin đẹp mắt.

- [ ] **Step 1: Tạo file `cai-dat-lich-backup-17h.bat`**

Tạo file `cai-dat-lich-backup-17h.bat` ở thư mục gốc:
```bat
@echo off
chcp 65001 >nul
title CÀI ĐẶT LỊCH TỰ ĐỘNG SAO LƯU SUPABASE - 17:00 HÀNG NGÀY
echo =====================================================================
echo       CÀI ĐẶT LỊCH TỰ ĐỘNG SAO LƯU DỮ LIỆU SUPABASE SANG CSV
echo                (TỰ ĐỘNG CHẠY VÀO 17:00 MỖI NGÀY)
echo =====================================================================
echo.

set TASK_NAME=DDC_Supabase_Daily_Backup_17h
set SCRIPT_DIR=%~dp0
set VBS_PATH=%SCRIPT_DIR%scripts\run-backup-silent.vbs

echo [*] Đang kiểm tra đường dẫn VBScript: %VBS_PATH%
if not exist "%VBS_PATH%" (
    echo [!] KHÔNG TÌM THẤY FILE: %VBS_PATH%
    echo     Vui lòng kiểm tra lại cấu trúc thư mục dự án!
    goto :END
)

echo [*] Đang đăng ký tác vụ vào Windows Task Scheduler...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$taskName = '%TASK_NAME%';" ^
  "$vbs = '%VBS_PATH%';" ^
  "$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('\"' + $vbs + '\"');" ^
  "$trigger = New-ScheduledTaskTrigger -Daily -At 17:00;" ^
  "$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;" ^
  "Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null;" ^
  "Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Tu dong sao luu cac bang Supabase sang CSV ve may tinh luc 17h hang ngay' | Out-Null;"

if %ERRORLEVEL% equ 0 (
    echo.
    echo =====================================================================
    echo [✓] ĐÃ CÀI ĐẶT THÀNH CÔNG LỊCH TỰ ĐỘNG SAO LƯU LÚC 17:00 HÀNG NGÀY!
    echo.
    echo     - Tên tác vụ: %TASK_NAME%
    echo     - Thời gian chạy: 17:00 (5 giờ chiều) mỗi ngày
    echo     - Chế độ chạy bù: Bật (Tự động sao lưu ngay khi bật máy nếu 17h tắt máy)
    echo     - Chế độ chạy: Ngầm trong nền (không làm phiền màn hình làm việc)
    echo     - Thư mục lưu: %SCRIPT_DIR%backups\
    echo =====================================================================
) else (
    echo.
    echo [!] CÓ LỖI XẢY RA KHI ĐĂNG KÝ TASK SCHEDULER!
    echo     Vui lòng nhấp chuột phải vào file này và chọn 'Run as administrator'.
)

:END
echo.
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
```

- [ ] **Step 2: Tạo file `huy-lich-backup-17h.bat`**

Tạo file `huy-lich-backup-17h.bat`:
```bat
@echo off
chcp 65001 >nul
title HỦY LỊCH SAO LƯU SUPABASE
echo =====================================================================
echo              HỦY LỊCH TỰ ĐỘNG SAO LƯU DỮ LIỆU SUPABASE
echo =====================================================================
echo.

set TASK_NAME=DDC_Supabase_Daily_Backup_17h

echo [*] Đang gỡ bỏ tác vụ '%TASK_NAME%' khỏi Windows Task Scheduler...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unregister-ScheduledTask -TaskName '%TASK_NAME%' -Confirm:$false -ErrorAction Stop" >nul 2>&1

if %ERRORLEVEL% equ 0 (
    echo [✓] Đã hủy thành công lịch tự động sao lưu '%TASK_NAME%'.
) else (
    echo [i] Lịch tự động '%TASK_NAME%' không tồn tại hoặc đã được gỡ trước đó.
)

echo.
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
```

- [ ] **Step 3: Tạo file `Backup_Supabase_Ngay.bat`**

Tạo file `Backup_Supabase_Ngay.bat`:
```bat
@echo off
chcp 65001 >nul
title SAO LƯU DỮ LIỆU SUPABASE SANG CSV - KHO DDC
echo =====================================================================
echo         HỆ THỐNG SAO LƯU DỮ LIỆU TỪ SUPABASE VỀ MÁY TÍNH
echo                   (MỖI BẢNG LÀ 1 FILE .CSV RIÊNG)
echo =====================================================================
echo.

node "%~dp0scripts\backup-supabase-to-csv.js"

echo.
echo =====================================================================
echo Hoàn tất phiên sao lưu. File CSV được lưu tại thư mục backups\
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
```

- [ ] **Step 4: Commit git Task 4**

```bash
git add cai-dat-lich-backup-17h.bat huy-lich-backup-17h.bat Backup_Supabase_Ngay.bat
git commit -m "feat(backup): add 1-click batch scripts for scheduling and manual backup"
```

---

### Task 5: Kiểm Thử Toàn Diện (E2E Integration Test) & Xác Minh Dữ Liệu

**Files:**
- Execute: `scripts/backup-supabase-to-csv.js`
- Test: Kiểm tra dữ liệu thực tế tại thư mục `backups/` và kiểm tra lệnh `schtasks`

- [ ] **Step 1: Chạy kiểm thử đơn vị tự động**

Chạy lệnh: `node --test tests/*.test.js`
Kỳ vọng: Tất cả các file test `tests/csv-exporter.test.js` và `tests/backup-engine.test.js` đều PASS.

- [ ] **Step 2: Chạy trích xuất thực tế từ Supabase bằng lệnh Node.js**

Chạy lệnh: `node scripts/backup-supabase-to-csv.js`
Kỳ vọng:
- Trích xuất thành công toàn bộ 13 bảng.
- Hiển thị đầy đủ số dòng của từng bảng:
  - `xg-nhap`: ~1.393 dòng
  - `xg-xuat`: ~1.161 dòng
  - `tole-nhap`: ~818 dòng
  - `tole-xuat`: ~634 dòng
  - `pl-can-thu`: ~866 dòng
  - `pl-phieu-in`: ~1.339 dòng
  - v.v.
- Thư mục `backups/YYYY-MM-DD_HHhmm/` được tạo với đủ 13 file `.csv` và 1 file `backup-summary.json`.

- [ ] **Step 3: Kiểm tra UTF-8 BOM và nội dung file CSV**

Chạy script kiểm tra byte đầu của các file CSV:
```bash
node -e "const fs=require('fs'); const dir=fs.readdirSync('backups').filter(d=>fs.statSync('backups/'+d).isDirectory())[0]; const f='backups/'+dir+'/xg-nhap.csv'; const b=fs.readFileSync(f); console.log('BOM:', b.slice(0,3).toString('hex') === 'efbbbf' ? 'OK (UTF-8 BOM)' : 'FAIL');"
```
Kỳ vọng: `BOM: OK (UTF-8 BOM)`.

- [ ] **Step 4: Kiểm tra đăng ký Task Scheduler trên hệ thống**

Chạy lệnh PowerShell đăng ký và truy vấn:
`powershell -Command "Get-ScheduledTask -TaskName 'DDC_Supabase_Daily_Backup_17h'"`
Kỳ vọng: Trạng thái `Ready`.

- [ ] **Step 5: Commit hoàn tất dự án**

```bash
git add .
git commit -m "chore(backup): verify end-to-end backup execution and scheduling"
```
