const fs = require('fs');
const files = [
  'C:/Users/benhhc/Desktop/web/assets/js/pl/pl-phieu-in.js',
  'C:/Users/benhhc/Desktop/web/assets/js/tole/tole-bieu-do.js',
  'C:/Users/benhhc/Desktop/web/assets/js/tole/tole-ton.js',
  'C:/Users/benhhc/Desktop/web/assets/js/xg/xg-ton.js',
  'C:/Users/benhhc/Desktop/web/assets/js/xg/xg-xuat.js'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
     content = content.replace('    }\n\n  // Dropdown click for mobile - 5S\n  if (dropdown5S) {', '    });\n  }\n\n  // Dropdown click for mobile - 5S\n  if (dropdown5S) {');
     content = content.replace('    }\n  }\n\n);\n  }', '    }\n  }');
     fs.writeFileSync(f, content);
     console.log('Force fixed ', f);
});
