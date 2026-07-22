const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix Col 1
  content = content.replace(/(\/\/ Column 1:[\s\S]*?)(col\.appendChild\(label\);\s*col\.appendChild\(select\);)/g, (match, p1, p2) => {
    if (match.includes('select.required = true;')) return match;
    return p1 + "select.required = true;\n      label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class=\"text-danger\">*</span>`;\n      " + p2;
  });

  // Fix Col 2
  content = content.replace(/(\/\/ Column 2:[\s\S]*?)(col\.appendChild\(label\);\s*col\.appendChild\(dateInput\);)/g, (match, p1, p2) => {
    if (match.includes('dateInput.required = true;')) return match;
    return p1 + "dateInput.required = true;\n      label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class=\"text-danger\">*</span>`;\n      " + p2;
  });

  // Fix Col 3
  content = content.replace(/(\/\/ Column 3:[\s\S]*?)(col\.appendChild\(label\);\s*col\.appendChild\(select\);)/g, (match, p1, p2) => {
    if (match.includes('select.required = true;')) return match;
    return p1 + "select.required = true;\n        label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class=\"text-danger\">*</span>`;\n        " + p2;
  });

  // Fix Col Default text input (Common fields loop end)
  const defaultTextField = `// Default: text input
    const input = document.createElement('input');
    input.className = 'form-control form-control-sm fw-bold';
    input.name = \`col_\${colIdx}\`;
    input.type = 'text';

    // Make required if not Note or Roll ID
    const hName = headers[colIdx] ? String(headers[colIdx]).toLowerCase().trim() : '';
    if (!hName.includes('ghi chú') && !hName.includes('cuộn id') && !hName.includes('mã vật tư')) {
      input.required = true;
      label.innerHTML = \`\${headers[colIdx] || \`Cột \${colIdx + 1}\`} <span class="text-danger">*</span>\`;
    } else if (hName.includes('mã vật tư') && file.includes('xuat')) {
      input.required = true;
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
      label.innerHTML = \`\${headers[colIdx] || \`Cột \${colIdx + 1}\`} <span class="text-danger">*</span>\`;
    } else {
      label.textContent = headers[colIdx] || \`Cột \${colIdx + 1}\`;
    }

    col.appendChild(label); 
    col.appendChild(input); 
    commonFieldsContainer.appendChild(col);
  });`;

  content = content.replace(/\/\/ Default: text input[\s\S]*?commonFieldsContainer\.appendChild\(col\);\s*\}\);/g, defaultTextField);

  // Fix Additional columns
  const additionalFieldReplace = `} else {
      // Make required if not Ghi chú
      const headerName = (headers[i] || \`Cột \${i+1}\`).toLowerCase().trim();
      if (!headerName.includes('ghi chú') && !headerName.includes('cuộn id')) {
        label.innerHTML = \`\${headers[i] || \`Cột \${i + 1}\`} <span class="text-danger">*</span>\`;
        input = document.createElement('input');
        input.className = 'form-control form-control-sm fw-bold';
        input.name = \`col_\${i}\`;
        input.type = 'text';
        input.required = true;
      } else {
        label.textContent = headers[i] || \`Cột \${i + 1}\`;
        input = document.createElement('input');
        input.className = 'form-control form-control-sm fw-bold';
        input.name = \`col_\${i}\`;
        input.type = 'text';
      }
    }`;

  content = content.replace(/\} else \{\s*label\.textContent = headers\[i\] \|\| `Cột \$\{i\+1\}`;[\s\S]*?input\.type = 'text';\s*\}/g, additionalFieldReplace);
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed', file);
}

fixFile('C:/Users/benhhc/Desktop/web/assets/js/tole/tole-nhap.js');
fixFile('C:/Users/benhhc/Desktop/web/assets/js/tole/tole-xuat.js');
