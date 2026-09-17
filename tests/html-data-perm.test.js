const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- Running HTML Data-Perm & Enforcer Tests ---');

const configFile = path.join(__dirname, '../assets/js/core/supabase-config.js');
assert.ok(fs.existsSync(configFile), 'assets/js/core/supabase-config.js must exist');

function createTestSandbox(pathname, currentUser, userGroupPerms, elements = []) {
  const sandbox = {
    window: {
      supabase: { createClient: () => ({}) },
      location: { pathname, href: 'http://localhost' + pathname },
      currentUser: currentUser,
      addEventListener: (event, handler) => {
        if (event === 'DOMContentLoaded') {
          sandbox._domLoadedHandler = handler;
        }
      }
    },
    document: {
      querySelectorAll: (sel) => {
        if (sel === '[data-perm]') {
          return elements;
        }
        return [];
      },
      addEventListener: (event, handler) => {
        if (event === 'DOMContentLoaded') {
          sandbox._domLoadedHandler = handler;
        }
      }
    },
    localStorage: {
      _data: {
        currentUser: currentUser,
        userGroupPermissions: JSON.stringify(userGroupPerms || {}),
        userAllowedPages: JSON.stringify(['*'])
      },
      getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; }
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (fn) => fn()
  };

  sandbox.window.top = sandbox.window;
  sandbox.window.self = sandbox.window;

  vm.createContext(sandbox);
  const code = fs.readFileSync(configFile, 'utf8');
  vm.runInContext(code, sandbox);

  return sandbox;
}

// Test 1: Admin bao.lt keeps all buttons visible
{
  const elements = [
    { id: 'btnAdd', dataset: { perm: 'add' }, style: {}, setAttribute: function(k, v) { this[k] = v; } },
    { id: 'btnEdit', dataset: { perm: 'edit' }, style: {}, setAttribute: function(k, v) { this[k] = v; } },
    { id: 'btnDelete', dataset: { perm: 'delete' }, style: {}, setAttribute: function(k, v) { this[k] = v; } }
  ];

  const sandbox = createTestSandbox('/pages/xg/xg-nhap.html', 'bao.lt', {
    xg: { canView: true, canAdd: true, canEdit: true, canDelete: true }
  }, elements);

  assert.ok(typeof sandbox.window.applyElementPermissions === 'function', 'applyElementPermissions must be a function');
  sandbox.window.applyElementPermissions();

  assert.strictEqual(elements[0].style.display, undefined, 'Admin should keep add button visible');
  assert.strictEqual(elements[1].style.display, undefined, 'Admin should keep edit button visible');
  assert.strictEqual(elements[2].style.display, undefined, 'Admin should keep delete button visible');
  console.log('[PASS] Test 1: Admin bao.lt has all buttons visible');
}

// Test 2: User with only canAdd: false and canDelete: false
{
  const elements = [
    { id: 'btnAdd', dataset: { perm: 'add' }, style: {}, setAttribute: function(k, v) { this[k] = v; } },
    { id: 'btnEdit', dataset: { perm: 'edit' }, style: {}, setAttribute: function(k, v) { this[k] = v; } },
    { id: 'btnDelete', dataset: { perm: 'delete' }, style: {}, setAttribute: function(k, v) { this[k] = v; } }
  ];

  const sandbox = createTestSandbox('/pages/xg/xg-nhap.html', 'user_test', {
    xg: { canView: true, canAdd: false, canEdit: true, canDelete: false }
  }, elements);

  sandbox.window.applyElementPermissions();

  assert.strictEqual(elements[0].style.display, 'none', 'data-perm="add" must be hidden when canAdd is false');
  assert.strictEqual(elements[1].style.display, undefined, 'data-perm="edit" must remain visible when canEdit is true');
  assert.strictEqual(elements[2].style.display, 'none', 'data-perm="delete" must be hidden when canDelete is false');
  console.log('[PASS] Test 2: Elements correctly hidden based on userGroupPermissions for xg');
}

// Test 3: URL detection for tem_qr group
{
  const elements = [
    { id: 'btnExcel', dataset: { perm: 'add' }, style: {}, setAttribute: function(k, v) { this[k] = v; } },
    { id: 'btnReset', dataset: { perm: 'delete' }, style: {}, setAttribute: function(k, v) { this[k] = v; } }
  ];

  const sandbox = createTestSandbox('/pages/tem-nhan-kiem-ke/kiem-ke.html', 'user_test', {
    tem_qr: { canView: true, canAdd: true, canEdit: false, canDelete: false }
  }, elements);

  sandbox.window.applyElementPermissions();

  assert.strictEqual(elements[0].style.display, undefined, 'tem_qr canAdd is true, so add remains visible');
  assert.strictEqual(elements[1].style.display, 'none', 'tem_qr canDelete is false, so delete is hidden');
  console.log('[PASS] Test 3: Correctly detects tem_qr group from URL /pages/tem-nhan-kiem-ke/kiem-ke.html');
}

// Test 4: Verify HTML files contain data-perm attributes
{
  const targetHtmlFiles = [
    'pages/xg/xg-nhap.html',
    'pages/xg/xg-xuat.html',
    'pages/tole/tole-nhap.html',
    'pages/tole/tole-xuat.html',
    'pages/pl/pl-can-thu.html',
    'pages/pl/pl-da-thu.html',
    'pages/pl/pl-chua-thu.html',
    'pages/pl/pl-phieu-in.html',
    'pages/tem-nhan-kiem-ke/kiem-ke.html',
    'pages/tem-nhan-kiem-ke/in-tem-vitri.html',
    'pages/tem-nhan-kiem-ke/in-tem-cuon.html'
  ];

  targetHtmlFiles.forEach(relPath => {
    const filePath = path.join(__dirname, '..', relPath);
    assert.ok(fs.existsSync(filePath), `File ${relPath} must exist`);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(
      content.includes('data-perm='),
      `File ${relPath} must contain at least one data-perm attribute`
    );
    console.log(`[PASS] Verified data-perm in ${relPath}`);
  });
}

console.log('--- ALL HTML DATA-PERM & ENFORCER TESTS PASSED! ---');
