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
 * Gửi thông báo Windows Toast Notification (nhẹ nhàng qua PowerShell)
 */
function sendWindowsNotification(title, message) {
  try {
    const { exec } = require('child_process');
    const safeTitle = title.replace(/'/g, "''");
    const safeMsg = message.replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -Command "[reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null; $notify = New-Object System.Windows.Forms.NotifyIcon; $notify.Icon = [System.Drawing.SystemIcons]::Information; $notify.BalloonTipTitle = '${safeTitle}'; $notify.BalloonTipText = '${safeMsg}'; $notify.Visible = $True; $notify.ShowBalloonTip(5000); Start-Sleep -Seconds 6; $notify.Dispose()"`;
    exec(psCmd, { windowsHide: true });
  } catch (_) {}
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

  // Gửi thông báo Windows Toast nếu chạy tự động hoặc khi có cờ silent
  if (isSilent) {
    const notifTitle = summary.failedTables === 0 ? 'Sao lưu Supabase thành công' : 'Sao lưu Supabase có cảnh báo';
    const notifMsg = `Đã lưu ${summary.successfulTables}/${summary.totalTables} bảng dữ liệu vào thư mục backups/`;
    sendWindowsNotification(notifTitle, notifMsg);
  }

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
  sendWindowsNotification,
  executeBackup
};
