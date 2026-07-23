# Electron Windows (.exe) Packaging & Sidebar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the web application into a standalone Windows Desktop Application (`.exe` installer) using Electron and add a direct download button on the sidebar right above the user profile footer.

**Architecture:** Implement `main.js` for Electron main process creating a desktop window, configure `electron-builder` in `package.json` to generate `DDC-Kho-Setup-1.0.0.exe`, place installer in `/assets/downloads/`, and update `assets/js/sidebar.js` and `assets/css/sidebar.css` to display the download button at the exact location marked in user feedback.

**Tech Stack:** JavaScript, Node.js, Electron, Electron-Builder, HTML5/CSS3.

## Global Constraints
- Target platform: Windows Desktop Executable Installer (`.exe`).
- Sidebar Button Position: Placed directly above the user profile section in `sidebar-footer` (above `<div class="sidebar-user-badge">`).
- Hide button automatically when running inside Electron desktop environment.

---

### Task 1: Create Electron Main Process (`main.js`) & Update `package.json`

**Files:**
- Create: `main.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: Local app files (`index.html`)
- Produces: Electron desktop window loading web application.

- [ ] **Step 1: Create `main.js`**

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Hệ thống Quản lý Kho Phôi Cuộn - DDC',
    icon: path.join(__dirname, 'assets/images/icon-512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.maximize();
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 2: Update `package.json` for Electron**

Set `"main": "main.js"`, add scripts `"electron": "electron ."` and `"dist": "electron-builder --win nsis"`.

- [ ] **Step 3: Verify syntax**

Run: `node -c main.js`
Expected: Clean output.

- [ ] **Step 4: Commit**

```bash
git add main.js package.json
git commit -m "feat(electron): add main process and electron configuration"
```

---

### Task 2: Build Executable Package & Set Up `/assets/downloads/`

**Files:**
- Create: `assets/downloads/DDC-Kho-Setup-1.0.0.exe` (or executable script wrapper)

**Interfaces:**
- Consumes: Electron app structure
- Produces: Downloadable Windows setup executable located at `/assets/downloads/DDC-Kho-Setup-1.0.0.exe`.

- [ ] **Step 1: Create `assets/downloads/` directory and standalone installer bundle**

Generate downloadable Windows app setup executable script package in `/assets/downloads/DDC-Kho-Setup-1.0.0.exe`.

- [ ] **Step 2: Commit**

```bash
git add assets/downloads/
git commit -m "feat(electron): add downloadable Windows installer package"
```

---

### Task 3: Add Download Executable Button to Sidebar UI at Exact Marked Location

**Files:**
- Modify: `assets/js/sidebar.js`
- Modify: `assets/css/sidebar.css`

**Interfaces:**
- Consumes: `/assets/downloads/DDC-Kho-Setup-1.0.0.exe`
- Produces: "💻 Tải App Windows (.exe)" button rendered right above the user profile footer.

- [ ] **Step 1: Update `sidebar.js` footer HTML structure**

In `sidebar.js`, insert the download button right above `sidebar-footer-top`:
```javascript
      <div class="sidebar-footer-divider"></div>
      <a href="/assets/downloads/DDC-Kho-Setup-1.0.0.exe" download="DDC-Kho-Setup-1.0.0.exe" id="btnDownloadExe" class="sidebar-exe-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>💻 Tải App Windows (.exe)</span>
      </a>
```

Add detection in `sidebar.js` to hide `#btnDownloadExe` if `navigator.userAgent.includes('Electron')`.

- [ ] **Step 2: Add CSS styling in `assets/css/sidebar.css`**

Add CSS rule for `.sidebar-exe-btn` with gradient background, rounded corners, padding, hover transitions, and text alignment matching dark/light themes.

- [ ] **Step 3: Verify syntax**

Run: `node -c assets/js/sidebar.js`

- [ ] **Step 4: Commit**

```bash
git add assets/js/sidebar.js assets/css/sidebar.css
git commit -m "feat(ui): add Windows exe download button to sidebar directly above user profile"
```
