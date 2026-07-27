# App Download Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current PWA instruction modal in `assets/js/pwa-register.js` with a modern dual-card modal offering direct downloads for PC (.exe) and Android (.apk).

**Architecture:** Modify `showInstallInstructionsModal()` in `assets/js/pwa-register.js` to render a modal with two distinct download option cards (PC Windows setup file and Android APK file), while preserving an option to expand Web App / PWA install instructions.

**Tech Stack:** HTML, CSS in JavaScript, Vanilla JS.

## Global Constraints
- Target PC setup file: `dist-app/release/Hệ thống Quản lý Kho Phôi Cuộn - DDC Setup 1.0.0.exe` (accessible via static web path `/dist-app/release/H%E1%BB%99%20th%E1%BB%91ng%20Qu%E1%BA%A3n%20l%C3%BD%20Kho%20Ph%C3%B4i%20Cu%E1%BB%99n%20-%20DDC%20Setup%201.0.0.exe` or relative path).
- Android APK path: Configurable via constant `ANDROID_APK_URL` in `pwa-register.js`.
- Design: Dark mode (`#1e293b`), glassmorphism backdrop blur, responsive layout.

---

### Task 1: Update Modal UI in `assets/js/pwa-register.js`

**Files:**
- Modify: `assets/js/pwa-register.js:91-180`

**Interfaces:**
- Consumes: User click on `#pwa-install-btn` or `.pwa-install-btn`.
- Produces: Enhanced `showInstallInstructionsModal()` function with 2 download options.

- [ ] **Step 1: Inspect `assets/js/pwa-register.js` modal function**

Check lines 91-180 of `assets/js/pwa-register.js`.

- [ ] **Step 2: Implement updated Modal HTML with 2 Cards**

Replace `showInstallInstructionsModal()` content with dual-card download UI:
- Card 1 (Windows .exe): Link to `/dist-app/release/H%E1%BB%99%20th%E1%BB%91ng%20Qu%E1%BA%A3n%20l%C3%BD%20Kho%20Ph%C3%B4i%20Cu%E1%BB%99n%20-%20DDC%20Setup%201.0.0.exe` with `download` attribute.
- Card 2 (Android .apk): Button wired to download APK link or show notice if URL is placeholder.
- Accordion/Toggle for PWA instructions.

- [ ] **Step 3: Test Modal manually or via browser**

Verify the modal displays correctly when "Cài đặt App" is clicked.

- [ ] **Step 4: Commit changes**

```bash
git add assets/js/pwa-register.js
git commit -m "feat: implement dual-card PC and Android download modal"
```
