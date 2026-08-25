const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

console.log('🚀 Đang chuẩn bị thư mục dist cho Capacitor...');

// 1. Tạo mới / làm sạch thư mục dist
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. Danh sách các thư mục cần sao chép
const dirsToCopy = ['assets', 'pages'];

dirsToCopy.forEach((dirName) => {
  const src = path.join(rootDir, dirName);
  const dest = path.join(distDir, dirName);
  if (fs.existsSync(src)) {
    console.log(` ↳ Sao chép thư mục: ${dirName}/`);
    fs.cpSync(src, dest, { recursive: true });
  }
});

// 3. Danh sách các tệp đơn lẻ cần sao chép
const filesToCopy = [
  'index.html',
  'offline.html',
  'manifest.json',
  'sw.js',
  'version.json'
];

filesToCopy.forEach((fileName) => {
  const src = path.join(rootDir, fileName);
  const dest = path.join(distDir, fileName);
  if (fs.existsSync(src)) {
    console.log(` ↳ Sao chép tệp: ${fileName}`);
    fs.copyFileSync(src, dest);
  }
});

// 4. Đồng bộ icon ứng dụng vào Android mipmap nếu có thư mục android
const androidResDir = path.resolve(rootDir, 'android/app/src/main/res');
const appIconSrc = path.join(rootDir, 'assets/images/icon-512.png');
const appIcon192Src = path.join(rootDir, 'assets/images/icon-192.png');

if (fs.existsSync(androidResDir) && fs.existsSync(appIconSrc)) {
  const mipmapDirs = ['mipmap-hdpi', 'mipmap-mdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
  mipmapDirs.forEach((folder) => {
    const targetDir = path.join(androidResDir, folder);
    if (fs.existsSync(targetDir)) {
      fs.copyFileSync(appIconSrc, path.join(targetDir, 'ic_launcher.png'));
      fs.copyFileSync(appIconSrc, path.join(targetDir, 'ic_launcher_round.png'));
      fs.copyFileSync(appIconSrc, path.join(targetDir, 'ic_launcher_foreground.png'));
    }
  });
  console.log(' ↳ Đã cập nhật icon ứng dụng vào Android res/mipmap!');
}

console.log('✅ Chuẩn bị tài nguyên dist thành công!');

