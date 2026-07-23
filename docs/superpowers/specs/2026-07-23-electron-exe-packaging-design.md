# Design Spec: Electron Windows (.exe) Packaging & Sidebar Download Link

## Overview
Package the "Hệ thống Quản lý Kho Phôi Cuộn - DDC" web application into a native Windows Desktop Application (.exe installer) using Electron and Electron-Builder. Provide a direct download button ("💻 Tải App Windows (.exe)") placed on the Navigation Sidebar directly above the user profile footer (at the exact location specified in user feedback).

## Requirements & Scope
- **Desktop Application Packaging**: Build a Windows installer (`.exe`) that installs the DDC Kho app on Windows 10/11 with desktop shortcut, start menu entry, and standalone window frame.
- **Download Hosting**: Store the downloadable installer executable (`DDC-Kho-Setup-1.0.0.exe`) in `/assets/downloads/` so clicking the sidebar download button initiates an instant local file download without external dependencies.
- **Sidebar UI Placement**: Place the download button inside the sidebar footer right above the user account badge (`<div class="sidebar-user-badge">`), styled matching the app design system with hover states and download icon.

## Components & Architecture

### 1. Main Electron Process (`main.js`)
- Root file: `/main.js`
- Spawns BrowserWindow with dimensions 1280x800.
- Loads root entry point `index.html` or local HTTP server / static files.
- Sets window title "Hệ thống Quản lý Kho Phôi Cuộn - DDC" and custom window icon (`assets/images/icon-512.png` / `assets/images/icon.ico`).

### 2. Electron Build Configuration (`package.json`)
- Add devDependencies: `electron`, `electron-builder`.
- Configure `build` section in `package.json`:
  ```json
  "build": {
    "appId": "com.ddc.khophoi",
    "productName": "DDC Kho",
    "win": {
      "target": "nsis",
      "icon": "assets/images/icon-512.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "DDC Kho"
    }
  }
  ```
- NPM Scripts: `"dist": "electron-builder --win nsis"`

### 3. Executable File Location
- Build output copied/linked to: `assets/downloads/DDC-Kho-Setup-1.0.0.exe`

### 4. Sidebar UI Button Integration (`assets/js/sidebar.js` & `assets/css/sidebar.css`)
- Inject downloadable link inside `sidebar.js`:
  ```html
  <a href="/assets/downloads/DDC-Kho-Setup-1.0.0.exe" download="DDC-Kho-Setup-1.0.0.exe" id="btnDownloadExe" class="sidebar-download-exe-btn">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    <span>💻 Tải App Windows (.exe)</span>
  </a>
  ```
- Positioned right above the user profile section in `sidebar-footer`.
- Hidden automatically when running inside Electron (`window.navigator.userAgent.includes('Electron')`).

## Spec Self-Review
1. **Placeholder scan**: Checked - no TBD, TODO, or vague statements. All paths and build target scripts are fully specified.
2. **Internal consistency**: Checked - button position matches screenshot request, download links match asset path.
3. **Scope check**: Well-focused scope covering Electron main script, builder config, executable packaging, and sidebar placement.
4. **Ambiguity check**: Checked - exact location above user profile section and hiding inside Electron environment explicitly defined.
