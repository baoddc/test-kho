const fs = require('fs');
const path = require('path');

const rootDir = 'c:/Users/benhhc/Desktop/web';

function getAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const htmlFiles = getAllHtmlFiles(rootDir);

htmlFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // We look for the <header> block and replace href="#blog" with href="/pages/about.html"
  const headerMatch = content.match(/<header>([\s\S]*?)<\/header>/);
  if (headerMatch) {
    let headerHtml = headerMatch[0];
    let newHeaderHtml = headerHtml.replace(/href="#blog"/g, 'href="/pages/about.html"');
    
    // Also fix the active state if we are inside about.html
    if (filePath.endsWith('about.html')) {
      newHeaderHtml = newHeaderHtml.replace(/href="\/pages\/about\.html">ABOUT<\/a>/g, 'href="/pages/about.html" class="active-nav" style="color: #00d9ff;">GIỚI THIỆU</a>');
    }
    
    content = content.replace(headerHtml, newHeaderHtml);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ABOUT link: ${filePath}`);
  }
});
