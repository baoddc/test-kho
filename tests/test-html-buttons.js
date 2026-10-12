const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pages = [
  { file: 'pages/xg/xg-nhap.html', addBtn: true, editBtn: true },
  { file: 'pages/xg/xg-xuat.html', addBtn: true, editBtn: true },
  { file: 'pages/tole/tole-nhap.html', addBtn: true, editBtn: true },
  { file: 'pages/tole/tole-xuat.html', addBtn: true, editBtn: true },
];

console.log('Testing HTML buttons existence...');
pages.forEach(p => {
  const content = fs.readFileSync(path.join(__dirname, '..', p.file), 'utf8');
  if (p.addBtn) {
    assert(content.includes('id="btnSyncGgSheet"'), `${p.file} phải có nút btnSyncGgSheet`);
  }
  if (p.editBtn) {
    assert(content.includes('id="btnEditSyncGgSheet"'), `${p.file} phải có nút btnEditSyncGgSheet`);
  }
});
console.log('✓ [PASS] All 4 pages have both add and edit sync buttons');
