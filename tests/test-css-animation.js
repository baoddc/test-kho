const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cssContent = fs.readFileSync(path.join(__dirname, '../assets/css/trang-chu/home.css'), 'utf8');

console.log('Testing CSS Animation declarations...');
assert(cssContent.includes('@keyframes syncPulse3x'), 'CSS phải có khai báo @keyframes syncPulse3x');
assert(cssContent.includes('.btn-sync-pulsing-3x'), 'CSS phải có class .btn-sync-pulsing-3x');
assert(cssContent.includes('syncPulse3x 0.6s ease-in-out 3'), 'Animation phải chạy đúng 3 chu kỳ 0.6s');
console.log('✓ [PASS] CSS Animation declarations validated');
