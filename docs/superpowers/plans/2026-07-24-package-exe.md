# Implementation Plan: Đóng gói dự án Quản lý Kho Phôi Cuộn DDC thành file Executable (.exe)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng gói ứng dụng web "Hệ thống Quản lý Kho Phôi Cuộn - DDC" thành ứng dụng Windows Desktop dạng tệp `.exe` (Portable EXE & NSIS Setup Installer).

**Architecture:** Sử dụng Electron shell (`dist-app/main.js`) khởi tạo server HTTP nội bộ và `electron-builder` để tạo gói cài đặt Windows native.

**Tech Stack:** Node.js, Electron, electron-builder, HTML/JS/CSS.

## Global Constraints
- Target OS: Windows (x64)
- Output formats: Portable (`.exe`) & NSIS Setup (`Setup .exe`)
- Thư mục đầu ra: `dist-app/dist/`

---

### Task 1: Đồng bộ hóa tài nguyên ứng dụng mới nhất sang `dist-app/`

**Files:**
- Modify/Sync: `dist-app/` (copy các file mới nhất từ root: `index.html`, `pages/`, `assets/`, `sw.js`, `manifest.json`)

**Interfaces:**
- Consumes: Giao diện và mã nguồn tại thư mục gốc `c:\Users\benhhc\Desktop\web-supabase`
- Produces: Bản build web sẵn sàng trong `dist-app/`

- [ ] **Step 1: Đồng bộ tài nguyên từ gốc sang `dist-app`**

Chạy PowerShell để copy cập nhật assets, pages, và file html:
```powershell
Copy-Item -Path "assets", "pages", "index.html", "sw.js", "manifest.json" -Destination "dist-app" -Recurse -Force
```

- [ ] **Step 2: Kiểm tra cấu trúc file trong `dist-app`**

Chạy kiểm tra file `dist-app/index.html` và `dist-app/main.js`.

---

### Task 2: Kiểm tra và cài đặt Electron/electron-builder dependencies

**Files:**
- Modify: `dist-app/package.json`

**Interfaces:**
- Consumes: Node package manager (`npm`)
- Produces: DevDependencies `electron` và `electron-builder` trong `dist-app/node_modules`

- [ ] **Step 1: Chạy npm install trong `dist-app`**

Chạy lệnh install các devDependencies cần thiết:
```powershell
cd dist-app; npm install electron electron-builder --save-dev
```

- [ ] **Step 2: Xắc nhận installation thành công**

Kiểm tra `dist-app/node_modules/.bin/electron-builder.cmd` tồn tại.

---

### Task 3: Thực thi build đóng gói `.exe` bằng electron-builder

**Files:**
- Modify: `dist-app/package.json`
- Create: `dist-app/dist/Hệ thống Quản lý Kho Phôi Cuộn - DDC 1.0.0.exe` (Portable)
- Create: `dist-app/dist/Hệ thống Quản lý Kho Phôi Cuộn - DDC Setup 1.0.0.exe` (Installer)

**Interfaces:**
- Consumes: `dist-app/package.json`, `dist-app/main.js`
- Produces: Các tệp thực thi `.exe` trong `dist-app/dist/`

- [ ] **Step 1: Chạy electron-builder packaging**

Thực thi lệnh build:
```powershell
cd dist-app; npx electron-builder --win
```

- [ ] **Step 2: Xắc nhận file .exe được tạo ra trong `dist-app/dist/`**

Kiểm tra sự tồn tại của file Portable `.exe` và Installer `.exe`.
