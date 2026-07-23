# Design Spec: PWA Packaging & Install Button Integration for DDC Kho

## Overview
Transform the "Hệ thống Quản lý Kho Phôi Cuộn - DDC" web application into a Progressive Web App (PWA). This allows warehouse operators and users to install the web app directly onto Desktop (Windows/macOS) and Mobile (Android/iOS) devices without requiring an app store, featuring instant asset caching, offline detection fallback, and an in-app sidebar install button.

## Requirements & Scope
- **Target Platform**: Progressive Web App (PWA) running standalone without browser address bar frame.
- **Offline Strategy**: Network-first for dynamic Supabase database queries; Stale-while-revalidate / Cache-first for all static assets (CSS, JS, Images, HTML, Icons).
- **Fallback**: Custom `offline.html` page displayed when navigation occurs without network connectivity and no cache exists.
- **UI Integration**: In-app "📲 Cài đặt App" button on the navigation sidebar allowing users to trigger browser PWA install prompt with one click. Automatic detection hiding the button when already running in `standalone` mode.

## Components & Architecture

### 1. Web App Manifest (`manifest.json`)
Located at project root (`/manifest.json`).
- `name`: "Hệ thống Quản lý Kho Phôi Cuộn - DDC"
- `short_name`: "Kho Phôi DDC"
- `start_url`: "/index.html"
- `display`: "standalone"
- `background_color`: "#0f172a"
- `theme_color`: "#1e293b"
- `icons`:
  - 192x192 PNG (`/assets/images/icon-192.png`)
  - 512x512 PNG (`/assets/images/icon-512.png`)
  - Apple Touch Icon 180x180 PNG (`/assets/images/apple-touch-icon.png`)

### 2. Service Worker (`sw.js`)
Located at project root (`/sw.js`).
- `CACHE_NAME`: `ddc-kho-v1`
- **Pre-cached URLs**:
  - `/index.html`
  - `/offline.html`
  - `/manifest.json`
  - Core CSS & JS in `/assets/`
  - HTML pages in `/pages/`
- **Routing & Fetch Strategy**:
  - `*.supabase.co` calls: **Network Only** (pass through straight to Supabase API to guarantee real-time data accuracy).
  - Static Assets (`.css`, `.js`, `.png`, `.jpg`, `.svg`, `.woff2`): **Stale-While-Revalidate**.
  - HTML Navigation: **Network First**, fallback to Cached HTML page, fallback to `/offline.html`.

### 3. Offline Fallback (`offline.html`)
Clean UI page explaining network connection is unavailable and providing a retry button.

### 4. PWA Registration & Install Manager (`assets/js/pwa-register.js`)
- Handles Service Worker registration on load.
- Captures `beforeinstallprompt` event.
- Exposes `window.installPWA()` function.
- Dynamically updates sidebar install button state (visible when installable, hidden when already installed).

### 5. HTML Integration
Include manifest link and script tags in all HTML files:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1e293b">
<link rel="apple-touch-icon" href="/assets/images/apple-touch-icon.png">
<script src="/assets/js/pwa-register.js" defer></script>
```

## Spec Self-Review
1. **Placeholder scan**: Checked - no TBD, TODO, or vague statements. All paths and configurations are fully specified.
2. **Internal consistency**: Checked - cache strategies match Supabase database real-time needs and UI install flow requirements.
3. **Scope check**: Well-focused scope covering PWA manifest, service worker, offline fallback, registration script, and UI sidebar integration.
4. **Ambiguity check**: Checked - all behaviors for offline, online, and PWA installation state are explicitly defined.
