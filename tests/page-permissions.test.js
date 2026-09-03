const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- Running Page Permissions Verification Tests ---');

const sidebarFiles = [
  path.join(__dirname, '../assets/js/components/sidebar.js'),
  path.join(__dirname, '../public/assets/js/components/sidebar.js'),
  path.join(__dirname, '../dist/assets/js/components/sidebar.js'),
  path.join(__dirname, '../dist-app/assets/js/sidebar.js'),
  path.join(__dirname, '../dist-app/assets/js/components/sidebar.js'),
];

// Helper to extract and evaluate isPageAllowed in a sandbox
function loadIsPageAllowedFromCode(code) {
  const sandbox = {
    window: {
      location: { pathname: '/', search: '', hash: '' },
      self: {},
      top: {},
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    document: {
      documentElement: { setAttribute: () => {}, getAttribute: () => 'dark' },
      createElement: () => ({
        setAttribute: () => {},
        appendChild: function(child) { this.children.push(child); },
        addEventListener: () => {},
        classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
        style: {},
        children: [],
        querySelector: () => null,
        querySelectorAll: () => []
      }),
      head: { appendChild: () => {} },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      body: {
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        insertBefore: () => {},
        appendChild: () => {},
        children: []
      }
    },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; }
    },
    URL: global.URL,
    URLSearchParams: global.URLSearchParams,
    setInterval: () => {},
    setTimeout: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} }
  };
  sandbox.window.top = sandbox.window;
  sandbox.window.self = sandbox.window;

  vm.createContext(sandbox);

  // Expose isPageAllowed to sandbox window
  const wrappedCode = code.replace(
    'function isPageAllowed(href) {',
    'window.isPageAllowed = isPageAllowed; function isPageAllowed(href) {'
  );

  vm.runInContext(wrappedCode, sandbox);
  return { isPageAllowed: sandbox.window.isPageAllowed, localStorage: sandbox.localStorage };
}

sidebarFiles.forEach((file) => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const { isPageAllowed, localStorage } = loadIsPageAllowedFromCode(content);

  assert.ok(typeof isPageAllowed === 'function', `isPageAllowed must be defined in ${file}`);

  // Test case: Regular user "bao" who only has permission for pl-phieu-in.html
  // and has pl: { canView: true, canAdd: true, canEdit: true }
  localStorage.setItem('currentUser', 'bao');
  localStorage.setItem('userAllowedPages', JSON.stringify(['/pages/home.html', '/pages/pl/pl-phieu-in.html']));
  localStorage.setItem('userGroupPermissions', JSON.stringify({
    chung: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    pl: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    xg: { canView: false, canAdd: false, canEdit: false, canDelete: false }
  }));

  // Allowed pages
  assert.strictEqual(
    isPageAllowed('/pages/pl/pl-phieu-in.html'),
    true,
    `Ticked page pl-phieu-in.html should be ALLOWED for user "bao"`
  );
  assert.strictEqual(
    isPageAllowed('/pages/home.html'),
    true,
    `Ticked page home.html should be ALLOWED for user "bao"`
  );

  // Companion page of allowed page
  assert.strictEqual(
    isPageAllowed('/pages/pl/form-in.html'),
    true,
    `Companion page form-in.html of pl-phieu-in.html should be ALLOWED`
  );

  // UNTICKED pages in the same group (PHẾ LIỆU) MUST BE BLOCKED!
  assert.strictEqual(
    isPageAllowed('/pages/pl/pl-can-thu.html'),
    false,
    `Unticked page pl-can-thu.html MUST BE BLOCKED even if groupPerms.pl.canView is true`
  );
  assert.strictEqual(
    isPageAllowed('/pages/pl/pl-da-thu.html'),
    false,
    `Unticked page pl-da-thu.html MUST BE BLOCKED even if groupPerms.pl.canView is true`
  );
  assert.strictEqual(
    isPageAllowed('/pages/pl/pl-chua-thu.html'),
    false,
    `Unticked page pl-chua-thu.html MUST BE BLOCKED even if groupPerms.pl.canView is true`
  );

  // Companion page of unticked page MUST BE BLOCKED
  assert.strictEqual(
    isPageAllowed('/pages/pl/pl-tong-hop-can-thu.html'),
    false,
    `Companion page pl-tong-hop-can-thu.html MUST BE BLOCKED because pl-can-thu is unticked`
  );

  // Unticked pages in other groups
  assert.strictEqual(
    isPageAllowed('/pages/xg/xg-nhap.html'),
    false,
    `Unticked page xg-nhap.html MUST BE BLOCKED`
  );

  // Admin page
  assert.strictEqual(
    isPageAllowed('/pages/quan-ly-user.html'),
    false,
    `quan-ly-user.html MUST BE BLOCKED for non-admin user "bao"`
  );

  console.log(`[PASS] ${path.relative(path.join(__dirname, '..'), file)} strict page permissions verified`);
});

console.log('--- ALL PAGE PERMISSION TESTS PASSED! ---');
