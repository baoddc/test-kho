const path = require('path');
const fs = require('fs');
const packager = require(path.join(__dirname, '../dist-app/node_modules/electron-packager'));
const builder = require(path.join(__dirname, '../dist-app/node_modules/electron-builder'));

async function build() {
  const appDir = path.join(__dirname, '..', 'dist-app');
  const outDir = path.join(__dirname, '..', 'out-app-' + Date.now());

  // 1. Xử lý phiên bản build (ưu tiên tham số truyền vào > version.json ở root)
  let targetVersion = process.argv[2];
  const rootVersionPath = path.join(__dirname, '..', 'version.json');
  let rootVersionObj = {};
  if (fs.existsSync(rootVersionPath)) {
    try {
      rootVersionObj = JSON.parse(fs.readFileSync(rootVersionPath, 'utf8'));
    } catch (e) {}
  }

  if (!targetVersion) {
    targetVersion = rootVersionObj.version || '1.0.0';
  }

  console.log(`[Build Script] 📦 Target App Version: v${targetVersion}`);

  // Cập nhật version trong dist-app/package.json (để electron-builder đặt tên .exe & registry version)
  const distPkgPath = path.join(appDir, 'package.json');
  if (fs.existsSync(distPkgPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(distPkgPath, 'utf8'));
    pkgJson.version = targetVersion;
    fs.writeFileSync(distPkgPath, JSON.stringify(pkgJson, null, 2), 'utf8');
    console.log(`[Build Script] Updated dist-app/package.json version -> ${targetVersion}`);
  }

  // Cập nhật dist-app/version.json cho Electron App tự kiểm tra version
  const distVerPath = path.join(appDir, 'version.json');
  const newDistVer = {
    version: targetVersion,
    buildTime: new Date().toISOString(),
    releaseNotes: `Phiên bản PC app (v${targetVersion}).`,
    minExeVersion: rootVersionObj.minExeVersion || "1.0.0"
  };
  fs.writeFileSync(distVerPath, JSON.stringify(newDistVer, null, 2), 'utf8');
  console.log(`[Build Script] Updated dist-app/version.json -> ${targetVersion}`);

  console.log('[Build Script] Syncing assets, and pages to dist-app...');
  try {
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
