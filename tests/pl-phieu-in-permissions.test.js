const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- Testing pl-phieu-in.js modal permissions across all distributions ---');

const filePaths = [
  path.join(__dirname, '..', 'assets', 'js', 'pl', 'pl-phieu-in.js'),
  path.join(__dirname, '..', 'public', 'assets', 'js', 'pl', 'pl-phieu-in.js'),
  path.join(__dirname, '..', 'dist', 'assets', 'js', 'pl', 'pl-phieu-in.js'),
  path.join(__dirname, '..', 'dist-app', 'assets', 'js', 'pl', 'pl-phieu-in.js')
];

function createMockElement(id = '', tag = 'div') {
  const children = [];
  const classList = new Set();
  const el = {
    id,
    tagName: tag.toUpperCase(),
    disabled: false,
    style: { display: '' },
    children,
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      contains: (c) => classList.has(c)
    },
    querySelectorAll: (selector) => {
      const results = [];
      const match = (item) => {
        if (selector.includes('input') && item.tagName === 'INPUT') results.push(item);
        if (selector.includes('button[type="submit"]') && item.tagName === 'BUTTON' && item.type === 'submit') results.push(item);
        if (selector.includes('#btnEditAddRowModal') && item.id === 'btnEditAddRowModal') results.push(item);
        if (selector.includes('#btnConfirmDelete') && item.id === 'btnConfirmDelete') results.push(item);
        if (selector.includes('.btn-remove-edit-row') && item.classList.contains('btn-remove-edit-row')) results.push(item);
        if (selector.includes('.btn-add-new-item') && item.classList.contains('btn-add-new-item')) results.push(item);
        item.children.forEach(match);
      };
      children.forEach(match);
      return results;
    },
    querySelector: (selector) => {
      const all = el.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    },
    appendChild: (child) => {
      children.push(child);
      return child;
    }
  };
  return el;
}

filePaths.forEach((fp) => {
  if (!fs.existsSync(fp)) return;
  const code = fs.readFileSync(fp, 'utf8');

  // Test 1: User 'bao' with canEdit = true opening editDataModal
  {
    const modalEl = createMockElement('editDataModal', 'div');
    const input1 = createMockElement('input1', 'input');
    const submitBtn = createMockElement('submitBtn', 'button');
    submitBtn.type = 'submit';
    modalEl.appendChild(input1);
    modalEl.appendChild(submitBtn);

    const localStorageData = {
      currentUser: 'bao',
      userGroupPermissions: JSON.stringify({
        pl: { canView: true, canAdd: true, canEdit: true, canDelete: false }
      })
    };

    const sandbox = {
      window: {},
      localStorage: {
        getItem: (k) => localStorageData[k] || null
      },
      getUserPermissions: (grp) => {
        const raw = localStorageData.userGroupPermissions;
        if (raw) {
          const g = JSON.parse(raw)[grp];
          if (g) return { ...g, isAdmin: false };
        }
        return { canView: true, canAdd: false, canEdit: false, canDelete: false, isAdmin: false };
      },
      console: { log: () => {}, error: () => {} }
    };
    sandbox.window.getUserPermissions = sandbox.getUserPermissions;
    vm.createContext(sandbox);

    const setupModalPermissionsMatch = code.match(/function setupModalPermissions\(modalEl\)[\s\S]*?\n\}/);
    assert(setupModalPermissionsMatch, `setupModalPermissions function not found in ${fp}`);
    vm.runInContext(setupModalPermissionsMatch[0], sandbox);

    const hasPerm = sandbox.setupModalPermissions(modalEl);
    assert.strictEqual(hasPerm, true, `Expected hasPerm=true in ${fp}`);
    assert.strictEqual(input1.disabled, false, `Expected input NOT disabled in ${fp}`);
    assert.strictEqual(submitBtn.style.display, '', `Expected submitBtn visible in ${fp}`);
  }

  // Test 2: User without canEdit opening editDataModal
  {
    const modalEl = createMockElement('editDataModal', 'div');
    const input1 = createMockElement('input1', 'input');
    const submitBtn = createMockElement('submitBtn', 'button');
    submitBtn.type = 'submit';
    modalEl.appendChild(input1);
    modalEl.appendChild(submitBtn);

    const localStorageData = {
      currentUser: 'viewonly_user',
      userGroupPermissions: JSON.stringify({
        pl: { canView: true, canAdd: false, canEdit: false, canDelete: false }
      })
    };

    const sandbox = {
      window: {},
      localStorage: {
        getItem: (k) => localStorageData[k] || null
      },
      getUserPermissions: (grp) => {
        const raw = localStorageData.userGroupPermissions;
        if (raw) {
          const g = JSON.parse(raw)[grp];
          if (g) return { ...g, isAdmin: false };
        }
        return { canView: true, canAdd: false, canEdit: false, canDelete: false, isAdmin: false };
      },
      console: { log: () => {}, error: () => {} }
    };
    sandbox.window.getUserPermissions = sandbox.getUserPermissions;
    vm.createContext(sandbox);

    const setupModalPermissionsMatch = code.match(/function setupModalPermissions\(modalEl\)[\s\S]*?\n\}/);
    vm.runInContext(setupModalPermissionsMatch[0], sandbox);

    const hasPerm = sandbox.setupModalPermissions(modalEl);
    assert.strictEqual(hasPerm, false, `Expected hasPerm=false when canEdit=false in ${fp}`);
    assert.strictEqual(input1.disabled, true, `Expected input disabled when canEdit=false in ${fp}`);
    assert.strictEqual(submitBtn.style.display, 'none', `Expected submitBtn hidden when canEdit=false in ${fp}`);
  }

  console.log(`[PASS] ${path.relative(process.cwd(), fp)} passed all modal permission tests!`);
});

console.log('--- ALL PL PHIEU IN MODAL PERMISSION TESTS PASSED! ---');
