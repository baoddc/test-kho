# Android APK (Capacitor & GitHub Actions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi và thiết lập dự án xuất file `.apk` cài đặt cho điện thoại Android sử dụng Capacitor và quy trình GitHub Actions CI/CD tự động.

**Architecture:** Sử dụng Capacitor để đóng gói toàn bộ file HTML/CSS/JS/Assets vào trong ứng dụng Android (WebView với `https://localhost`), kết nối API Supabase trực tiếp. Thiết lập GitHub Actions tự động build ra file `app-debug.apk` và upload lên GitHub Artifacts khi push code.

**Tech Stack:** Node.js, `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, Gradle, GitHub Actions CI/CD.

## Global Constraints
- App ID: `com.ddc.khophoicuon`
- App Name: `Kho Phôi DDC`
- Web Asset Dir: `dist`
- Scheme: `https`

---

### Task 1: Cài đặt Capacitor & Cấu hình `capacitor.config.json`

**Files:**
- Modify: `package.json`
- Create: `capacitor.config.json`

- [ ] **Step 1: Cài đặt các gói phụ thuộc Capacitor**
Chạy lệnh:
```bash
npm install @capacitor/core@^6.0.0 @capacitor/cli@^6.0.0 @capacitor/android@^6.0.0 --save-dev
```

- [ ] **Step 2: Tạo tệp cấu hình `capacitor.config.json`**
Nội dung:
```json
{
  "appId": "com.ddc.khophoicuon",
  "appName": "Kho Phôi DDC",
  "webDir": "dist",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https"
  }
}
```

- [ ] **Step 3: Commit**
```bash
git add package.json package-lock.json capacitor.config.json
git commit -m "chore: add capacitor dependencies and capacitor.config.json"
```

---

### Task 2: Tạo Script gom tài nguyên web `scripts/prepare-capacitor.js`

**Files:**
- Create: `scripts/prepare-capacitor.js`
- Modify: `package.json` (thêm script `prepare:android`)

- [ ] **Step 1: Viết script `scripts/prepare-capacitor.js`**
Script sao chép `index.html`, `offline.html`, `manifest.json`, `sw.js`, thư mục `pages/`, thư mục `assets/` vào thư mục `dist/`.

- [ ] **Step 2: Thêm scripts vào `package.json`**
Thêm:
```json
"scripts": {
  "prepare:dist": "node scripts/prepare-capacitor.js",
  "prepare:android": "node scripts/prepare-capacitor.js && npx cap sync android"
}
```

- [ ] **Step 3: Chạy thử script `prepare:dist` để kiểm tra thư mục `dist/`**
Run: `npm run prepare:dist`
Expected: Tạo thành công thư mục `dist/` chứa đầy đủ `index.html`, `pages/`, `assets/`.

- [ ] **Step 4: Cập nhật `.gitignore` để bỏ qua thư mục build `dist/`**
Thêm `dist/` vào `.gitignore`.

- [ ] **Step 5: Commit**
```bash
git add scripts/prepare-capacitor.js package.json .gitignore
git commit -m "feat: add prepare script for capacitor build assets"
```

---

### Task 3: Khởi tạo nền tảng Android (`/android`) & Cấu hình Quyền, Icon

**Files:**
- Create: `android/` (sinh bởi `npx cap add android`)
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Tạo thư mục nền tảng Android**
Run: `npx cap add android`
Expected: Sinh thư mục `android/` với cấu trúc dự án Gradle chuẩn.

- [ ] **Step 2: Cập nhật quyền trong `android/app/src/main/AndroidManifest.xml`**
Đảm bảo quyền `INTERNET` và `ACCESS_NETWORK_STATE` được bật đầy đủ.

- [ ] **Step 3: Đồng bộ tài nguyên lần đầu vào Android**
Run: `npm run prepare:android`
Expected: Tài nguyên từ `dist/` được copy vào `android/app/src/main/assets/public/`.

- [ ] **Step 4: Commit**
```bash
git add android/ capacitor.config.json
git commit -m "feat(android): initialize capacitor android platform"
```

---

### Task 4: Thiết lập GitHub Actions Workflow xuất file `.apk`

**Files:**
- Create: `.github/workflows/build-apk.yml`

- [ ] **Step 1: Tạo tệp workflow `.github/workflows/build-apk.yml`**
Thiết lập các bước:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 20)
3. `actions/setup-java@v4` (Java 17 Temurin)
4. `android-actions/setup-android@v3`
5. `npm ci || npm install`
6. `npm run prepare:android`
7. `chmod +x ./android/gradlew && cd android && ./gradlew assembleDebug`
8. `actions/upload-artifact@v4` lưu `android/app/build/outputs/apk/debug/app-debug.apk`

- [ ] **Step 2: Commit workflow**
```bash
git add .github/workflows/build-apk.yml
git commit -m "ci: add github actions workflow to build and upload android apk"
```

---

### Task 5: Kiểm tra và Hướng dẫn tải APK

- [ ] **Step 1: Kiểm tra tính toàn vẹn của dự án**
Chạy `npm run prepare:android` cục bộ để đảm bảo không có lỗi runtime/build.
- [ ] **Step 2: Hướng dẫn người dùng cách đẩy git và tải file `.apk` từ tab Actions trên GitHub**
