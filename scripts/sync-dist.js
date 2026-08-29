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

  // 1. Sync assets, pages, home, dang_nhap, login to dist
  console.log('[Sync Script] Syncing to dist/...');
  syncDirectory(path.join(rootDir, 'assets'), path.join(distDir, 'assets'));
  syncDirectory(path.join(rootDir, 'pages'), path.join(distDir, 'pages'));
  syncDirectory(path.join(rootDir, 'home'), path.join(distDir, 'home'));
  syncDirectory(path.join(rootDir, 'dang_nhap'), path.join(distDir, 'dang_nhap'));
  syncDirectory(path.join(rootDir, 'login'), path.join(distDir, 'login'));

  const staticFiles = [
    'index.html',
    'home.html',
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
  syncDirectory(path.join(rootDir, 'home'), path.join(distAppDir, 'home'));
  syncDirectory(path.join(rootDir, 'dang_nhap'), path.join(distAppDir, 'dang_nhap'));
  syncDirectory(path.join(rootDir, 'login'), path.join(distAppDir, 'login'));

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
