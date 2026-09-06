const assert = require('assert');

function parseLocationQRCode(rawText, baseOrigin = 'http://localhost:3000') {
  if (!rawText) return '';
  const text = String(rawText).trim();
  try {
    if (text.includes('?') && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/'))) {
      const url = new URL(text, baseOrigin);
      const vitri = url.searchParams.get('vitri') || url.searchParams.get('loc') || url.searchParams.get('location');
      if (vitri) return decodeURIComponent(vitri).trim().toUpperCase();
    }
  } catch (e) {}
  return text.toUpperCase();
}

function getAllStandardRacks() {
  const racks = [];
  for (let i = 1; i <= 14; i++) {
    racks.push(`A${String(i).padStart(2, '0')}`);
  }
  for (let i = 1; i <= 14; i++) {
    racks.push(`B${String(i).padStart(2, '0')}`);
  }
  racks.push('GRATING', 'GR-01', 'GR-02');
  return racks;
}

// Test assertions
assert.strictEqual(parseLocationQRCode('A01'), 'A01');
assert.strictEqual(parseLocationQRCode('b05'), 'B05');
assert.strictEqual(parseLocationQRCode('grating'), 'GRATING');
assert.strictEqual(parseLocationQRCode('https://ddc-kho.vn/pages/vi-tri-ton.html?vitri=A12'), 'A12');
assert.strictEqual(parseLocationQRCode('https://ddc-kho.vn/pages/tem-nhan-kiem-ke/vi-tri-ton.html?vitri=A12'), 'A12');
assert.strictEqual(parseLocationQRCode('https://ddc-kho.vn/pages/xg/xg-ton.html?vitri=B09'), 'B09');
assert.strictEqual(parseLocationQRCode('/pages/vi-tri-ton.html?vitri=GRATING'), 'GRATING');
assert.strictEqual(parseLocationQRCode('/pages/tem-nhan-kiem-ke/vi-tri-ton.html?vitri=GRATING'), 'GRATING');
assert.strictEqual(getAllStandardRacks().length, 31);
assert.strictEqual(getAllStandardRacks()[0], 'A01');
assert.strictEqual(getAllStandardRacks()[13], 'A14');
assert.strictEqual(getAllStandardRacks()[14], 'B01');
assert.strictEqual(getAllStandardRacks()[27], 'B14');

console.log('All Task 1 unit tests passed successfully!');
