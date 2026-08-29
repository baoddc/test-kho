const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- Running Biểu Đồ Dashboard Filter Verification Tests ---');

const xgBieuDoPath = path.join(__dirname, '../assets/js/xg/xg-bieu-do.js');
const toleBieuDoPath = path.join(__dirname, '../assets/js/tole/tole-bieu-do.js');

const filesToTest = [
  { name: 'xg-bieu-do.js', path: xgBieuDoPath },
  { name: 'tole-bieu-do.js', path: toleBieuDoPath },
  { name: 'dist/xg-bieu-do.js', path: path.join(__dirname, '../dist/assets/js/xg/xg-bieu-do.js') },
  { name: 'dist/tole-bieu-do.js', path: path.join(__dirname, '../dist/assets/js/tole/tole-bieu-do.js') }
];

// Test 1: Verify debounce is defined and no syntax/reference errors in files
filesToTest.forEach(({ name, path: filePath }) => {
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify debounce is defined
  assert.ok(
    content.includes('function debounce(func, wait)'),
    `File ${name} must define debounce function`
  );

  // Mock a browser environment to evaluate the script in a sandbox
  const domElements = {
    fromDate: { value: '', addEventListener: () => {} },
    toDate: { value: '', addEventListener: () => {} },
    btnApplyFilter: { addEventListener: () => {} },
    btnResetFilter: { addEventListener: () => {} },
    totalImport: { textContent: '' },
    totalExport: { textContent: '' },
    inventoryBegin: { textContent: '' },
    inventoryTurnover: { textContent: '' },
    inventoryDSI: { textContent: '' },
    averageStockAge: { textContent: '' },
    importNCC: { textContent: '' },
    importXuong: { textContent: '' },
    importGiaCong: { textContent: '' },
    importCongTrinh: { textContent: '' },
    exportXuong: { textContent: '' },
    exportDieuChuyen: { textContent: '' },
    exportGiaCong: { textContent: '' },
    exportCongTrinh: { textContent: '' },
    loading: { style: {}, textContent: '' }
  };

  const sandbox = {
    window: {
      addEventListener: () => {},
      location: { href: '', replace: () => {} }
    },
    document: {
      addEventListener: () => {},
      readyState: 'complete',
      getElementById: (id) => domElements[id] || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      documentElement: { getAttribute: () => 'dark' }
    },
    localStorage: {
      getItem: () => 'test_user',
      removeItem: () => {}
    },
    console: {
      log: () => {},
      error: () => {},
      warn: () => {}
    },
    MutationObserver: function() {
      return { observe: () => {}, disconnect: () => {} };
    },
    BroadcastChannel: function() {
      return { onmessage: null, postMessage: () => {} };
    },
    supabase: {
      channel: () => ({ on: function() { return this; }, subscribe: () => {} }),
      from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }) })
    },
    Chart: function() {
      return { destroy: () => {}, update: () => {} };
    }
  };

  vm.createContext(sandbox);

  try {
    vm.runInContext(content, sandbox);
    console.log(`[PASS] ${name} parsed and evaluated successfully without ReferenceError`);
  } catch (err) {
    assert.fail(`Evaluation of ${name} failed: ${err.message}`);
  }

  // Test 2: Verify parseRowDate logic in the evaluated context
  const parseRowDate = sandbox.parseRowDate;
  assert.ok(typeof parseRowDate === 'function', `parseRowDate must be a function in ${name}`);

  // Test ISO format YYYY-MM-DD
  const dateIso = parseRowDate('2026-05-15');
  assert.strictEqual(dateIso.getFullYear(), 2026);
  assert.strictEqual(dateIso.getMonth(), 4); // 0-indexed May
  assert.strictEqual(dateIso.getDate(), 15);

  // Test Vietnamese format DD/MM/YYYY
  const dateVn = parseRowDate('25/12/2025');
  assert.strictEqual(dateVn.getFullYear(), 2025);
  assert.strictEqual(dateVn.getMonth(), 11); // December
  assert.strictEqual(dateVn.getDate(), 25);

  // Test Dash format DD-MM-YYYY
  const dateDash = parseRowDate('05-08-2025');
  assert.strictEqual(dateDash.getFullYear(), 2025);
  assert.strictEqual(dateDash.getMonth(), 7); // August
  assert.strictEqual(dateDash.getDate(), 5);

  // Test null / undefined / empty
  assert.strictEqual(parseRowDate(''), null);
  assert.strictEqual(parseRowDate(null), null);
  assert.strictEqual(parseRowDate(undefined), null);

  console.log(`[PASS] ${name} parseRowDate correctly parses ISO, Vietnamese, and Dash dates`);

  // Test 3: Verify isDateInRange logic
  const isDateInRange = sandbox.isDateInRange;
  assert.ok(typeof isDateInRange === 'function', `isDateInRange must be a function in ${name}`);

  // No filter set
  domElements.fromDate.value = '';
  domElements.toDate.value = '';
  assert.strictEqual(isDateInRange(new Date(2026, 4, 15)), true);

  // Set filter range: 2026-05-01 to 2026-05-31
  domElements.fromDate.value = '2026-05-01';
  domElements.toDate.value = '2026-05-31';

  assert.strictEqual(isDateInRange(new Date(2026, 4, 15)), true, 'Date within range should return true');
  assert.strictEqual(isDateInRange(new Date(2026, 4, 1)), true, 'From boundary date should return true');
  assert.strictEqual(isDateInRange(new Date(2026, 4, 31)), true, 'To boundary date should return true');
  assert.strictEqual(isDateInRange(new Date(2026, 3, 30)), false, 'Date before range should return false');
  assert.strictEqual(isDateInRange(new Date(2026, 5, 1)), false, 'Date after range should return false');

  console.log(`[PASS] ${name} isDateInRange accurately enforces date filter boundaries`);
});

console.log('--- ALL BIỂU ĐỒ FILTER TESTS PASSED SUCCESSFULLY! ---');
