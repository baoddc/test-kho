# Electron Windows App (.exe) Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the "Hệ thống Quản lý Kho Phôi Cuộn - DDC" application into a native Windows Desktop application (`.exe` installer and portable package) that automatically creates Desktop and Taskbar shortcuts on Windows.

**Architecture:** Create an Electron main process (`main.js`) serving the local web application, add `electron` and `electron-builder` configuration in `package.json` with NSIS shortcut automation (`createDesktopShortcut`, `createStartMenuShortcut`), generate ICO icons, and build the distribution package.

**Tech Stack:** Electron, Electron Builder, Node.js, Express / Static File Server, NSIS.

## Global Constraints
- Target: Windows x64 (`win32` / `x64`).
- Automatic creation of Desktop Shortcut and Taskbar shortcut during installation.
- Maintain 100% compatibility with existing Supabase backend and static web files.

---

### Task 1: Create Main Electron Entry Script (`main.js`)

**Files:**
- Create: `main.js`

**Interfaces:**
- Consumes: Static assets & HTML files in root and `/pages`
- Produces: Electron Desktop Window running local HTTP server or serving files.

- [ ] **Step 1: Write `main.js` implementation**

Implement Electron `app` lifecycle, local `http` static file server on dynamic port (to avoid CORS / protocol issues with Supabase API requests), and `BrowserWindow` creation.

- [ ] **Step 2: Verify `main.js` syntax**

Run: `node -c main.js`
Expected: Clean pass.

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat(electron): add Electron main process entry point"
```

---

### Task 2: Configure `package.json` for Electron & `electron-builder`

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: `main.js`, `assets/images/icon-512.png`
- Produces: NPM scripts `npm run electron` and `npm run build:exe`

- [ ] **Step 1: Update `package.json` with main entry & build settings**

Add `"main": "main.js"`, `"scripts": { "electron": "electron .", "build:exe": "electron-builder --win" }`, and `build` configuration with NSIS settings.

- [ ] **Step 2: Verify `package.json` JSON validity**

Run: `node -e "JSON.parse(fs.readFileSync('package.json'))"`
Expected: Clean pass.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat(electron): configure package.json build settings for NSIS Windows installer"
```

---

### Task 3: Create Windows Installer & Desktop Shortcut Automation Script

**Files:**
- Create: `scripts/package-zip.js` or `scripts/create-exe-package.js`

**Interfaces:**
- Consumes: Web assets (`index.html`, `pages/`, `assets/`, `sw.js`, `manifest.json`)
- Produces: Desktop Application package & automated shortcut installer script `Install-KhoPhoiDDC.bat` that creates Desktop & Taskbar shortcut.

- [ ] **Step 1: Create automated installer & shortcut script creator**

Write `scripts/create-exe-package.js` which builds a self-contained Windows Portable / App Package bundled with a 1-click Windows Shortcut Installer (`Cai-Dat-Shortcut-Desktop.bat`) using VBScript `WScript.Shell` to create `.lnk` shortcuts on `Desktop` and `Taskbar`.

- [ ] **Step 2: Execute build package script**

Run: `node scripts/create-exe-package.js`
Expected: Output created in `dist/` or project zip.

- [ ] **Step 3: Commit**

```bash
git add scripts/
git commit -m "feat(electron): add Windows shortcut installer packaging script"
```
