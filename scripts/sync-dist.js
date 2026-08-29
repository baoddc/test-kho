const fs = require('fs');
const path = require('path');

function syncDirectory(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Copy/update files from src to dest
  fs.cpSync(srcDir, destDir, { recursive: true });
}

function syncFile(srcFile, destFile) {
  if (!fs.existsSync(srcFile)) return;
  const destDir = path.dirname(destFile);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(srcFile, destFile);
}

function runSync() {
  const rootDir = path.join(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');
  const distAppDir = path.join(rootDir, 'dist-app');

  console.log('[Sync Script] 🚀 Starting full synchronization...');

  // 1. Sync assets & pages to dist
  console.log('[Sync Script] Syncing to dist/...');
  syncDirectory(path.join(rootDir, 'assets'), path.join(distDir, 'assets'));
  syncDirectory(path.join(rootDir, 'pages'), path.join(distDir, 'pages'));

  const staticFiles = [
    'index.html',
    'offline.html',
    'manifest.json',
    'sw.js',
    'version.json',
    'vercel.json'
  ];

  staticFiles.forEach(file => {
    syncFile(path.join(rootDir, file), path.join(distDir, file));
  });

  // 2. Sync to dist-app
  console.log('[Sync Script] Syncing to dist-app/...');
  syncDirectory(path.join(rootDir, 'assets'), path.join(distAppDir, 'assets'));
  syncDirectory(path.join(rootDir, 'pages'), path.join(distAppDir, 'pages'));

  const staticAppFiles = [
    'index.html',
    'offline.html',
    'manifest.json',
    'sw.js',
    'version.json'
  ];

  staticAppFiles.forEach(file => {
    syncFile(path.join(rootDir, file), path.join(distAppDir, file));
  });

  console.log('✅ [Sync Script] Full synchronization completed successfully!');
}

runSync();
