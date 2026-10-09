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
    isManual: true,
    silent: true
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
