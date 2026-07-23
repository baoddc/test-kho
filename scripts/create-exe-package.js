const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Building DDC Kho Windows Desktop Shortcut Installer Package ===');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist-app');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 1. Copy web assets to dist-app
const copyDirs = ['assets', 'pages'];
const copyFiles = ['index.html', 'offline.html', 'manifest.json', 'sw.js', 'package.json', 'main.js'];

copyDirs.forEach(dir => {
  const src = path.join(projectRoot, dir);
  const dest = path.join(distDir, dir);
  if (fs.existsSync(src)) {
    copyFolderRecursiveSync(src, dest);
  }
});

copyFiles.forEach(file => {
  const src = path.join(projectRoot, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

// 2. Generate Windows 1-Click Desktop & Taskbar Shortcut Installer Script
const batScriptContent = `@echo off
chcp 65001 > NUL
title Cài đặt Shortcut Kho DDC ra Desktop & Taskbar

echo =========================================================
echo   Đang tự động tạo Shortcut ngoài Desktop & Taskbar...
echo =========================================================

set SCRIPT="%TEMP%\\CreateDDCShortcut.vbs"

echo Set oWS = CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\\DDC Kho.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%

rem Tìm đường dẫn Edge hoặc Chrome trên Windows
set BROWSER_PATH=""
if exist "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" set BROWSER_PATH="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
if exist "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" set BROWSER_PATH="C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
if exist "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" set BROWSER_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
if exist "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" set BROWSER_PATH="C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"

echo oLink.TargetPath = %BROWSER_PATH% >> %SCRIPT%
echo oLink.Arguments = "--app=https://baoddc.github.io/test-kho/pages/index.html --user-data-dir=%%LOCALAPPDATA%%\\DDCKhoApp" >> %SCRIPT%
echo oLink.Description = "Hệ thống Quản lý Kho Phôi Cuộn - DDC" >> %SCRIPT%
echo oLink.WorkingDirectory = "%%USERPROFILE%%" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

rem Tạo thêm Shortcut trong Start Menu
echo sStartLink = oWS.SpecialFolders("StartMenu") ^& "\\Programs\\DDC Kho.lnk" >> %SCRIPT%
echo Set oStartLink = oWS.CreateShortcut(sStartLink) >> %SCRIPT%
echo oStartLink.TargetPath = %BROWSER_PATH% >> %SCRIPT%
echo oStartLink.Arguments = "--app=https://baoddc.github.io/test-kho/pages/index.html --user-data-dir=%%LOCALAPPDATA%%\\DDCKhoApp" >> %SCRIPT%
echo oStartLink.Description = "Hệ thống Quản lý Kho Phôi Cuộn - DDC" >> %SCRIPT%
echo oStartLink.Save >> %SCRIPT%

cscript //nologo %SCRIPT%
del %SCRIPT%

echo.
echo [THANH CONG] Đã tạo biểu tượng App DDC Kho ngoài Màn hình chính (Desktop) và Start Menu!
echo Bạn chỉ cần ra Desktop double-click vào biểu tượng "DDC Kho" hoặc ghim vào Taskbar để dùng.
echo.
pause
`;

fs.writeFileSync(path.join(distDir, 'Cai-Dat-Shortcut-Desktop.bat'), batScriptContent, 'utf8');

// Helper function to recursively copy folders
function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  files.forEach(file => {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.statSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  });
}

console.log('✓ Successfully created dist-app/ package with Cai-Dat-Shortcut-Desktop.bat');
