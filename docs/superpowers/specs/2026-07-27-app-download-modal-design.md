# Design Spec: App Download Modal (PC .exe & Android .apk)

## Goal
Replace the default PWA instruction modal with a dual-option app download modal when users click the "Cài đặt App" (Install App) button on the web sidebar.

## Functional Requirements
1. **Trigger**: Clicking `#pwa-install-btn` or `.pwa-install-btn` (labeled "Cài đặt App").
2. **Modal Dialog UI**:
   - Modern dark-themed backdrop with blur.
   - Header with DDC Logo, Title: "Tải Ứng Dụng Quản Lý Kho Phôi Cuộn", and a Close button (X).
   - **Option 1: Windows PC (.exe)**
     - Displays Windows icon / PC graphic.
     - Title: "Dành cho Máy tính (PC / Laptop)"
     - Subtitle/Description: "File cài đặt .exe chính thức cho Windows 10/11"
     - Primary Button: "📥 Tải bản PC (.exe)"
     - Action: Initiates browser download of `Hệ thống Quản lý Kho Phôi Cuộn - DDC Setup 1.0.0.exe`.
   - **Option 2: Android (.apk)**
     - Displays Android phone graphic.
     - Title: "Dành cho Điện thoại (Android)"
     - Subtitle/Description: "File cài đặt .apk cho điện thoại & máy tính bảng Android"
     - Primary Button: "📥 Tải bản Android (.apk)"
     - Action: Initiates browser download or opens link configured via `ANDROID_APK_URL` constant (defaults to `#` or custom notification if APK link is not yet configured).
3. **PWA Instruction Link (Secondary)**:
   - A subtle collapsible/button at the bottom: "ℹ️ Hoặc cài đặt trực tiếp qua trình duyệt (Web App / PWA)" which toggles the step-by-step PWA install guidance.

## File & Asset Changes
1. `assets/js/pwa-register.js`: Update `showInstallInstructionsModal()` to render the dual download cards UI.
2. Setup file URL configuration:
   - PC setup file path linked in modal.

## User Flow
1. User clicks "Cài đặt App" in sidebar.
2. Download Modal pops up showing PC (.exe) and Android (.apk) cards.
3. User clicks "Tải bản PC (.exe)" &rarr; browser downloads setup executable.
4. User clicks "Tải bản Android (.apk)" &rarr; browser downloads APK file (or alerts user if APK is being updated).
