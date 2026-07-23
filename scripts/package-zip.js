const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Packaging project into ddc-kho-app.zip...');

const rootDir = path.join(__dirname, '..');
const zipPath = path.join(rootDir, 'ddc-kho-app.zip');

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

try {
  // Use PowerShell Compress-Archive
  const command = `powershell -Command "Compress-Archive -Path '${rootDir}\\index.html', '${rootDir}\\manifest.json', '${rootDir}\\sw.js', '${rootDir}\\offline.html', '${rootDir}\\package.json', '${rootDir}\\assets', '${rootDir}\\pages' -DestinationPath '${zipPath}' -Force"`;
  execSync(command, { stdio: 'inherit' });
  console.log('Successfully created ddc-kho-app.zip!');
} catch (err) {
  console.error('Error creating zip archive:', err);
}
