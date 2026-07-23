# Design Spec: Electron Windows App Packaging (.exe) for DDC Kho

## Overview
Package the "Hệ thống Quản lý Kho Phôi Cuộn - DDC" application into a native Windows Desktop application (`.exe` installer) using Electron and `electron-builder`. When users run the setup executable, Windows will automatically install the app, create a Desktop Shortcut, and pin the app shortcut to the Taskbar and Start Menu.

## Requirements & Scope
- **Target Platform**: Windows 10 / 11 64-bit (`win32` / `x64`).
- **Shortcuts**: Automatic creation of Desktop Shortcut and Start Menu / Taskbar shortcut during installation (`createDesktopShortcut: true`, `createStartMenuShortcut: true`).
- **Backend & Database**: Fully supports local static file loading and remote Supabase API communication.
- **Icon**: High-resolution Windows icon (`icon.ico` / `icon-512.png`).
- **UI Integration**: Clicking "📲 Cài đặt App DDC Kho" in the Web App triggers direct download of `DDC-Kho-Setup.exe` if available or opens installation prompt.

## Components & Architecture

### 1. Main Electron Process (`main.js`)
- Initializes `BrowserWindow` with native frameless or customized titlebar (1280x800 resolution).
- Launches embedded static web server or loads `index.html` directly via local file server.
- Configures security (`webPreferences`: `nodeIntegration: false`, `contextIsolation: true`).
- Handles application lifecycle (`ready`, `window-all-closed`, `activate`).

### 2. Package Configuration (`package.json`)
- Add `electron` and `electron-builder` as devDependencies.
- Configure `build` section for `electron-builder`:
  - `appId`: `com.ddc.khophoicuon`
  - `productName`: "Hệ thống Quản lý Kho Phôi Cuộn - DDC"
  - `win`:
    - `target`: `["nsis", "portable"]`
    - `icon`: "assets/images/icon-512.png"
  - `nsis`:
    - `oneClick`: false
    - `allowToChangeInstallationDirectory`: true
    - `createDesktopShortcut`: true
    - `createStartMenuShortcut`: true
    - `shortcutName`: "Kho Phôi DDC"

### 3. Icon Converter Script (`scripts/create-ico.js`)
- Script to generate `assets/images/icon.ico` for Windows native executable icon.

### 4. Build & Release Scripts
- `npm run build:exe`: Compiles the application and generates `dist/DDC-Kho-Setup-1.0.0.exe`.

## Spec Self-Review
1. **Placeholder scan**: Checked - all paths, settings, and build flags specified.
2. **Internal consistency**: Checked - NSIS settings guarantee automatic desktop and taskbar shortcut creation on Windows.
3. **Scope check**: Well-focused scope covering Electron main process, electron-builder config, ico generation, and executable build.
4. **Ambiguity check**: Checked - all target environments and installer options explicitly documented.
