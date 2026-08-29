const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Running Sidebar Visibility Verification Tests ---');

const sidebarFiles = [
  path.join(__dirname, '../assets/js/components/sidebar.js'),
  path.join(__dirname, '../public/assets/js/components/sidebar.js'),
  path.join(__dirname, '../dist/assets/js/components/sidebar.js'),
  path.join(__dirname, '../dist-app/assets/js/sidebar.js'),
  path.join(__dirname, '../dist-app/assets/js/components/sidebar.js'),
];

sidebarFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');

  // Verify that isSidebarItemVisible contains the updated logic
  assert.ok(content.includes('function isSidebarItemVisible(item)'), `File ${file} must define isSidebarItemVisible`);
  assert.ok(
    content.includes("if (onlyAdmin || isQuanLyUser) {\n      return currentUser === 'bao.lt';\n    }") ||
    content.includes("if (onlyAdmin || isQuanLyUser) {\r\n      return currentUser === 'bao.lt';\r\n    }"),
    `File ${file} must restrict quan-ly-user only to bao.lt`
  );
  assert.ok(
    !content.substring(content.indexOf('function isSidebarItemVisible'), content.indexOf('function isPageAllowed')).includes('return isPageAllowed(href);'),
    `isSidebarItemVisible in ${file} should NOT filter regular pages with isPageAllowed`
  );

  console.log(`[PASS] ${path.relative(path.join(__dirname, '..'), file)} visibility verified`);
});

console.log('--- ALL SIDEBAR VISIBILITY TESTS PASSED! ---');
