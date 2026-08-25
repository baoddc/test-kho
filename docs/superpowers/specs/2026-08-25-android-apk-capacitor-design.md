# Thiết Kế Đóng Gói Ứng Dụng Android APK (Capacitor & GitHub Actions CI/CD)

## 1. Tổng quan
Tài liệu thiết kế giải pháp chuyển đổi ứng dụng web quản lý kho hiện tại thành ứng dụng di động Android dạng tệp cài đặt `.apk`. 
Ứng dụng sử dụng **Capacitor** để đóng gói toàn bộ mã nguồn frontend (HTML, CSS, JS, Assets) cục bộ vào bên trong APK, đồng thời tích hợp **GitHub Actions CI/CD** để tự động biên dịch và phát hành file `.apk` trên đám mây.

---

## 2. Kiến trúc & Thành phần hệ thống

### 2.1. Cấu trúc đóng gói cục bộ (Local Offline Assets)
- Toàn bộ giao diện frontend được gom từ các thư mục:
  - `index.html`, `pages/**`
  - `assets/**` (CSS, JS, Fonts, Images, Icons)
  - `manifest.json`
- Môi trường chạy trên Android: WebView nội bộ với lược đồ `https://localhost`, cho phép thực thi JavaScript đầy đủ và bảo mật dữ liệu phiên đăng nhập của Supabase trong `localStorage` / `sessionStorage`.
- Kết nối dữ liệu: Ứng dụng kết nối trực tiếp đến Supabase Database qua kết nối mạng Internet.

### 2.2. Cấu hình Capacitor (`capacitor.config.json`)
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

### 2.3. Tự động hóa chuẩn bị tài nguyên (`scripts/prepare-capacitor.js`)
Script phụ trợ bằng Node.js có nhiệm vụ:
1. Dọn dẹp và tạo thư mục `dist/`.
2. Sao chép toàn bộ tệp HTML, CSS, JS, assets tĩnh vào `dist/`.
3. Đồng bộ tài nguyên từ `dist/` vào thư mục `android/app/src/main/assets/public/` thông qua lệnh `npx cap sync android`.

### 2.4. Cấu hình Native Android (`android/`)
- Cấu hình tệp `android/app/src/main/AndroidManifest.xml`:
  - Quyền kết nối mạng: `<uses-permission android:name="android.permission.INTERNET" />`
  - Quyền đọc/ghi tệp cho tính năng xuất báo cáo Excel/Docx (nếu có yêu cầu trên các phiên bản Android cũ): `<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />`
- Biểu tượng ứng dụng (App Icon): Đồng bộ từ `assets/images/icon-512.png` và `assets/images/icon-192.png` vào các thư mục `mipmap-*`.

---

## 3. Quy trình Tự động hóa CI/CD (GitHub Actions)

Tạo tệp workflow `.github/workflows/build-apk.yml` với các bước:
1. **Trigger:** Khi có sự kiện `push` lên nhánh `main` hoặc kích hoạt bằng tay qua giao diện (`workflow_dispatch`).
2. **Environment:** Runner `ubuntu-latest`.
3. **Setup:**
   - Cài đặt Node.js v20.
   - Cài đặt Java JDK 17 (Eclipse Temurin).
   - Thiết lập Android SDK & Command-line Tools.
4. **Build Steps:**
   - Chạy `npm install` để cài đặt dependencies.
   - Chạy `npm run prepare:android` để gom tài nguyên web và sync vào Android.
   - Cấp quyền thực thi và chạy `./gradlew assembleDebug` trong thư mục `android/`.
5. **Artifact Output:**
   - Tải tệp `app-debug.apk` lên **GitHub Actions Artifacts** với thời hạn lưu trữ 30 ngày.
   - Cung cấp liên kết tải xuống trực tiếp trên giao diện GitHub.

---

## 4. Kế hoạch xác minh & Kiểm thử (Verification Plan)
1. **Kiểm tra cấu trúc và đồng bộ tài nguyên:**
   - Chạy thử script `npm run prepare:android` cục bộ để đảm bảo thư mục `dist/` được tạo đầy đủ, không thiếu tệp HTML hay JS.
   - Kiểm tra `npx cap sync android` chạy không có lỗi cấu hình.
2. **Kiểm tra cú pháp Workflow:**
   - Kiểm tra định dạng YAML của tệp `.github/workflows/build-apk.yml`.
3. **Kiểm tra sau khi build:**
   - Đẩy mã nguồn lên GitHub repository.
   - Xác nhận GitHub Actions chạy thành công (Status: Green).
   - Tải tệp APK từ Artifacts về điện thoại Android, cài đặt và kiểm tra:
     - Mở ứng dụng hiển thị đúng giao diện.
     - Đăng nhập và truy xuất dữ liệu từ Supabase bình thường.
