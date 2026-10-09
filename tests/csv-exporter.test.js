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
  assert.equal(formatValueForCsv({ a: 1 }), '"{""a"":1}"');
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
