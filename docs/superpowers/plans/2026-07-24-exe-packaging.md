# Packaging Windows Executable (.exe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the DDC Inventory Management App into Windows Installer (`.exe` NSIS) and Portable (`.exe`) with Live Web Sync & Offline Fallback capability.

**Architecture:** Electron app loading remote online URL with fallback to embedded local HTTP server for offline resilience. Packaged via `electron-builder`.

**Tech Stack:** Node.js, Electron v43, Electron-Builder v26.

## Global Constraints
- Target platform: Windows x64 (`win32`).
- Output formats: `nsis` (Installer) and `portable` (Standalone EXE).
- Output directory: `dist-app/release`.

---

### Task 1: Prepare Môi Trường & Đồng Bộ Files Sang `dist-app`

**Files:**
- Modify/Sync: `dist-app/` (synced from root `pages/`, `assets/`, `index.html`, `manifest.json`, `sw.js`)

**Interfaces:**
- Consumes: Root repository static assets and HTML pages.
- Produces: Complete static bundle in `dist-app/` ready for Electron bundling.

- [ ] **Step 1: Install Electron dependencies inside dist-app**

Run command in PowerShell:
```powershell
cd dist-app; npm install
```

- [ ] **Step 2: Sync latest files from root to dist-app**

Run PowerShell script to copy root HTML/JS/CSS to `dist-app`:
```powershell
Copy-Item -Path "pages", "assets", "index.html", "manifest.json", "sw.js" -Destination "dist-app" -Recurse -Force
```

- [ ] **Step 3: Verify dist-app structure**

Verify `dist-app/main.js`, `dist-app/package.json`, and `dist-app/pages/` exist.

---

### Task 2: Build & Verify Windows `.exe` Packages

**Files:**
- Create: `dist-app/release/Kho Phôi DDC Setup 1.0.0.exe`
- Create: `dist-app/release/Kho Phôi DDC 1.0.0.exe`

**Interfaces:**
- Consumes: `dist-app/package.json`, `dist-app/main.js`, static app files in `dist-app`.
- Produces: Executable Windows installer and portable binary.

- [ ] **Step 1: Run electron-builder**

Run command:
```powershell
cd dist-app; npx electron-builder --win
```

- [ ] **Step 2: Verify built binaries in release folder**

Check if `dist-app/release/Kho Phôi DDC Setup 1.0.0.exe` and `dist-app/release/Kho Phôi DDC 1.0.0.exe` exist and have valid file sizes (>50MB).

- [ ] **Step 3: Test execution of Portable EXE**

Verify that the `.exe` launches cleanly without errors.
