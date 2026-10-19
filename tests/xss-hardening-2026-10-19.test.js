const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- Running XSS Hardening (2026-10-19) Tests ---');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

// 1. sidebar.js: ?openTab= chỉ chấp nhận URL cùng origin
const sidebar = read('assets/js/components/sidebar.js');
const fnStart = sidebar.indexOf('function isSafeTabUrl(url)');
assert.ok(fnStart !== -1, 'sidebar.js must define isSafeTabUrl');
const fnSrc = sidebar.slice(fnStart, sidebar.indexOf('\n  }\n', fnStart) + 4);
const ctx = { window: { location: { origin: 'https://baoddc.com', protocol: 'https:' } }, URL };
vm.runInNewContext(fnSrc + '\nthis.isSafeTabUrl = isSafeTabUrl;', ctx);

assert.strictEqual(ctx.isSafeTabUrl('/pages/xg/xg-nhap.html'), true);
assert.strictEqual(ctx.isSafeTabUrl('pages/xg/xg-nhap'), true);
assert.strictEqual(ctx.isSafeTabUrl('https://baoddc.com/pages/trang-chu/about.html'), true);
assert.strictEqual(ctx.isSafeTabUrl('javascript:alert(1)'), false);
assert.strictEqual(ctx.isSafeTabUrl('JaVaScRiPt:alert(1)'), false);
assert.strictEqual(ctx.isSafeTabUrl('data:text/html,<script>alert(1)</script>'), false);
assert.strictEqual(ctx.isSafeTabUrl('https://evil.com/pages/trang-chu/about.html'), false);
assert.strictEqual(ctx.isSafeTabUrl('//evil.com/pages/x.html'), false);
assert.strictEqual(ctx.isSafeTabUrl(''), false);
assert.ok(/function openTab\(url, title, updateHistory = true\) \{\s*if \(!isSafeTabUrl\(url\)\)/.test(sidebar),
  'openTab must reject unsafe URLs before doing anything else');
console.log('[PASS] sidebar.js isSafeTabUrl blocks javascript:/data:/cross-origin URLs');

// 2. Các giá trị từ URL/QR/DB không còn được chèn thô vào thuộc tính value=""
const mustEscape = {
  'assets/js/xg/xg-nhap.js': ['value="${viTri}"', 'value="${cuonId}"'],
  'assets/js/tole/tole-nhap.js': ['value="${viTri}"', 'value="${cuonId}"'],
  'assets/js/xg/xg-xuat.js': ['value="${item.tenVatTu', '${lockStatus.lockedBy}', '<td>${tenVatTu}</td>'],
  'assets/js/tole/tole-xuat.js': ['value="${item.tenVatTu', '${lockStatus.lockedBy}', '<td>${tenVatTu}</td>'],
  'assets/js/pl/pl-phieu-in.js': ['html += `<td>${cellValue}</td>`'],
  'assets/js/tem-nhan-kiem-ke/vi-tri-ton.js': ['Mã <strong>"${trimmed}"</strong>'],
  'assets/js/tem-nhan-kiem-ke/in-tem-cuon.js': ["${coil['Tên vật tư'] || ''}</small>"],
};
Object.entries(mustEscape).forEach(([rel, patterns]) => {
  const src = read(rel);
  assert.ok(src.includes('function escapeHtml('), `${rel} must define escapeHtml`);
  patterns.forEach((p) => assert.ok(!src.includes(p), `${rel} still contains unescaped: ${p}`));
  console.log(`[PASS] ${rel} escapes untrusted values`);
});

// 3. escapeHtml chặn thoát khỏi thuộc tính
const xgNhap = read('assets/js/xg/xg-nhap.js');
const escSrc = xgNhap.slice(xgNhap.indexOf('function escapeHtml('), xgNhap.indexOf('\n}\n', xgNhap.indexOf('function escapeHtml(')) + 3);
const escCtx = {};
vm.runInNewContext(escSrc + '\nthis.escapeHtml = escapeHtml;', escCtx);
assert.strictEqual(escCtx.escapeHtml('"><img src=x onerror=alert(1)>'), '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
assert.strictEqual(escCtx.escapeHtml(null), '');
assert.strictEqual(escCtx.escapeHtml(0), '0');
console.log('[PASS] escapeHtml neutralizes attribute breakout');

console.log('--- ALL XSS HARDENING TESTS PASSED! ---');
