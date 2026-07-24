const path = require('path');
const fs = require('fs');
const packager = require(path.join(__dirname, '../dist-app/node_modules/electron-packager'));
const builder = require(path.join(__dirname, '../dist-app/node_modules/electron-builder'));

async function build() {
  const appDir = path.join(__dirname, '..', 'dist-app');
  const outDir = path.join(__dirname, '..', 'out-app-' + Date.now());

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
