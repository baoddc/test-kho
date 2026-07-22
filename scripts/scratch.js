const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/benhhc/Desktop/web/assets/js';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(dir);
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('if (dropdown5S)') || content.includes('if (dropdown5s)')) {
    return;
  }

  const anchor = "const hamburger = document.getElementById('hamburger');";
  if (content.includes(anchor)) {
    if (!content.includes("getElementById('5SDropdown')")) {
      content = content.replace(anchor, "const dropdown5S = document.getElementById('5SDropdown');\n  " + anchor);
      changed = true;
    }

    const logic = `
  // Dropdown click for mobile - 5S
  if (dropdown5S) {
    const dropdownToggle = dropdown5S.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          dropdown5S.classList.toggle('active');
        }
      });
    }
  }
`;

    const listenerAnchor = "hamburger.classList.toggle('active');\n      mainNav.classList.toggle('active');\n    });\n  }";
    if (content.includes(listenerAnchor)) {
      content = content.replace(listenerAnchor, listenerAnchor + "\n" + logic);
      changed = true;
    } else {
        // Fallback for cases with different spacing/newlines
        const alternateAnchor = "mainNav.classList.toggle('active');";
        if (content.includes(alternateAnchor)) {
            // Find the end of the `});\n  }` block after this anchor
            const blockEnd = content.indexOf('  }', content.indexOf(alternateAnchor)) + 3;
            if (blockEnd > 3) {
                const startStr = content.substring(0, blockEnd);
                const endStr = content.substring(blockEnd);
                content = startStr + "\n" + logic + endStr;
                changed = true;
            }
        }
    }

    if (changed) {
      fs.writeFileSync(file, content);
      console.log('Updated ' + file);
    }
  }
});
