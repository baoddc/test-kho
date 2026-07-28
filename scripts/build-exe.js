const path = require('path');
const fs = require('fs');
const packager = require(path.join(__dirname, '../dist-app/node_modules/electron-packager'));
const builder = require(path.join(__dirname, '../dist-app/node_modules/electron-builder'));

async function build() {
  const appDir = path.join(__dirname, '..', 'dist-app');
  const outDir = path.join(__dirname, '..', 'out-app-' + Date.now());

  console.log('[Build Script] Syncing assets, and pages to dist-app...');
  console.log('[Build Script] NOTE: dist-app/version.json is NOT overwritten (Solution B - it defines the .exe version)');
  try {
    // ⚠️ KHÔNG copy version.json từ root vào dist-app.
    // dist-app/version.json phải được cập nhật thủ công khi build .exe mới.
    // fs.copyFileSync(path.join(__dirname, '../version.json'), path.join(appDir, 'version.json'));

    // Copy assets nhưng KHÔNG đè update-checker.js (vì Solution B dùng version.json)
    // update-checker.js đã giống nhau ở cả hai nơi nên copy cũng an toàn
    fs.cpSync(path.join(__dirname, '../assets'), path.join(appDir, 'assets'), { recursive: true });
    fs.cpSync(path.join(__dirname, '../pages'), path.join(appDir, 'pages'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, '../index.html'), path.join(appDir, 'index.html'));
  } catch (err) {
    console.warn('[Build Script Warning] Failed to copy assets/pages files:', err.message);
  }

  console.log('[Build Script] Packaging Electron app to:', outDir);
  const appPaths = await packager({
    dir: appDir,
    out: outDir,
    name: 'KhoPhoiDDC',
    platform: 'win32',
    arch: 'x64',
    icon: path.join(appDir, 'assets', 'images', 'icon.ico'),
    overwrite: true,
    ignore: (file) => {
      if (!file) return false;
      const normalized = file.replace(/\\/g, '/');
      return normalized.startsWith('/dist') || normalized.startsWith('/release') || normalized.startsWith('/build-exe');
    }
  });

  console.log('[Build Script] Prepackaged at:', appPaths[0]);
  console.log('[Build Script] Building Portable & Setup .exe...');
  
  await builder.build({
    targets: builder.Platform.WINDOWS.createTarget(['nsis', 'portable']),
    prepackaged: appPaths[0],
    projectDir: appDir
  });

  console.log('[Build Script] Cleaning up temp out folder...');
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup error
  }

  console.log('[Build Script] SUCCESSFULLY CREATED BOTH .EXE FILES!');
}

build().catch(err => {
  console.error('[Build Script Error]', err);
  process.exit(1);
});
