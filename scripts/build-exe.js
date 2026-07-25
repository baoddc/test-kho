const path = require('path');
const fs = require('fs');
const packager = require(path.join(__dirname, '../dist-app/node_modules/electron-packager'));
const builder = require(path.join(__dirname, '../dist-app/node_modules/electron-builder'));

async function build() {
  const appDir = path.join(__dirname, '..', 'dist-app');
  const outDir = path.join(__dirname, '..', 'out-app-' + Date.now());

  console.log('[Build Script] Syncing version.json & update-checker.js to dist-app...');
  try {
    fs.copyFileSync(path.join(__dirname, '../version.json'), path.join(appDir, 'version.json'));
    const jsDistDir = path.join(appDir, 'assets', 'js');
    if (!fs.existsSync(jsDistDir)) fs.mkdirSync(jsDistDir, { recursive: true });
    fs.copyFileSync(path.join(__dirname, '../assets/js/update-checker.js'), path.join(jsDistDir, 'update-checker.js'));
    fs.copyFileSync(path.join(__dirname, '../assets/js/sidebar.js'), path.join(jsDistDir, 'sidebar.js'));
    fs.copyFileSync(path.join(__dirname, '../assets/js/pwa-register.js'), path.join(jsDistDir, 'pwa-register.js'));
  } catch (err) {
    console.warn('[Build Script Warning] Failed to copy version/assets files:', err.message);
  }

  console.log('[Build Script] Packaging Electron app to:', outDir);
  const appPaths = await packager({
    dir: appDir,
    out: outDir,
    platform: 'win32',
    arch: 'x64',
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
