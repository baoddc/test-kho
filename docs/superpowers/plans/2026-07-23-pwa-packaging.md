# PWA Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package `web-supabase` into a Progressive Web App (PWA) allowing desktop and mobile users to install and run the warehouse management app natively with smart caching and offline fallback.

**Architecture:** Add `manifest.json` for app configuration, PWA icons, a Service Worker `sw.js` implementing Cache-First for static assets and Network-First for dynamic HTML/Supabase API calls, an `offline.html` fallback page, and `assets/js/pwa-register.js` for automatic registration and install prompt UI.

**Tech Stack:** HTML5, Vanilla JavaScript, Service Worker API, Web App Manifest API.

## Global Constraints

- Must preserve existing vanilla HTML/JS structure without adding build framework requirements.
- Must work seamlessly on Chrome, Edge, Safari (Windows Desktop & Mobile).
- Must cache static assets while serving live data from Supabase (`*.supabase.co`).

---

### Task 1: Generate & Create PWA Icons

**Files:**
- Create: `assets/icons/icon-192x192.png`
- Create: `assets/icons/icon-512x512.png`
- Create: `assets/icons/icon-maskable.png`

**Interfaces:**
- Produces: App icons referenced by `manifest.json` and Apple touch icon `<link>`.

- [ ] **Step 1: Create PWA icons in assets/icons directory**

Ensure `assets/icons/` folder exists and contains valid PNG icons for 192x192, 512x512, and maskable formats representing the DDC Warehouse brand.

- [ ] **Step 2: Verify icon files exist**

Run: `Test-Path assets/icons/icon-192x192.png; Test-Path assets/icons/icon-512x512.png`
Expected: `True` for both.

- [ ] **Step 3: Commit**

```bash
git add assets/icons/
git commit -m "feat(pwa): add PWA app icons (192x192, 512x512, maskable)"
```

---

### Task 2: Create Web App Manifest (`manifest.json`)

**Files:**
- Create: `manifest.json`

**Interfaces:**
- Consumes: Icon paths from `assets/icons/`
- Produces: `manifest.json` for browser app installation.

- [ ] **Step 1: Create manifest.json at project root**

```json
{
  "name": "Hệ thống Quản lý Kho Phôi Cuộn - DDC",
  "short_name": "Kho DDC",
  "description": "Ứng dụng Quản lý Kho Phôi Cuộn - Công ty DDC",
  "start_url": "/pages/index.html",
  "display": "standalone",
  "background_color": "#f8f9fa",
  "theme_color": "#0d6efd",
  "orientation": "any",
  "icons": [
    {
      "src": "/assets/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 2: Verify manifest.json syntax**

Run: `node -e "JSON.parse(fs.readFileSync('manifest.json'))"`
Expected: Clean exit without error.

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat(pwa): create Web App Manifest manifest.json"
```

---

### Task 3: Create Offline Fallback Page (`offline.html`)

**Files:**
- Create: `offline.html`

**Interfaces:**
- Produces: `offline.html` page to serve when network is unavailable and page is not cached.

- [ ] **Step 1: Create offline.html at project root**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mất kết nối - Kho DDC</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background-color: #f8f9fa;
      color: #333;
      text-align: center;
      padding: 20px;
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #0d6efd; margin-bottom: 10px; }
    p { color: #6c757d; max-width: 400px; line-height: 1.5; }
    button {
      margin-top: 20px;
      padding: 10px 24px;
      background-color: #0d6efd;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
    }
    button:hover { background-color: #0b5ed7; }
  </style>
</head>
<body>
  <div class="icon">📶❌</div>
  <h1>Không có kết nối Internet</h1>
  <p>Hệ thống Quản lý Kho DDC hiện đang không có kết nối mạng. Vui lòng kiểm tra lại đường truyền WiFi/4G của bạn.</p>
  <button onclick="window.location.reload()">Thử lại</button>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add offline.html
git commit -m "feat(pwa): add offline.html fallback page"
```

---

### Task 4: Create Service Worker (`sw.js`)

**Files:**
- Create: `sw.js`

**Interfaces:**
- Consumes: Asset list to pre-cache
- Produces: Service Worker script handling fetching, caching, and offline fallback.

- [ ] **Step 1: Create sw.js at project root**

```javascript
const CACHE_NAME = 'ddc-kho-v1';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Smart Caching Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests or Supabase API (always network first)
  if (request.method !== 'GET' || url.hostname.includes('supabase.co')) {
    return;
  }

  // Static Assets (CSS, JS, Images, Fonts) -> Cache-First
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'image' || 
      request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached response and fetch updated version in background
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {/* Ignore network error for background update */});
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML Pages -> Network-First with Cache / Offline fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/offline.html');
          }
        });
      })
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add sw.js
git commit -m "feat(pwa): add sw.js Service Worker implementation"
```

---

### Task 5: Create Registration Script & Install Prompt UI (`assets/js/pwa-register.js`)

**Files:**
- Create: `assets/js/pwa-register.js`

**Interfaces:**
- Consumes: Service Worker `/sw.js` and `beforeinstallprompt` browser event.
- Produces: Service Worker registration and interactive "Install App" button in UI.

- [ ] **Step 1: Create assets/js/pwa-register.js**

```javascript
// Service Worker Registration & PWA Install Prompt
(function () {
  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.error('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // 2. Handle PWA Install Prompt
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
  });

  function showInstallPromotion() {
    // Inject PWA install banner if not already present
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0d6efd;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 99999;
      font-family: inherit;
    `;
    banner.innerHTML = `
      <span>📲 Cài đặt Ứng dụng Kho DDC</span>
      <button id="pwa-install-btn" style="background:white; color:#0d6efd; border:none; padding:6px 14px; border-radius:4px; font-weight:bold; cursor:pointer;">Cài đặt</button>
      <button id="pwa-close-btn" style="background:transparent; color:white; border:none; font-size:16px; cursor:pointer;">✕</button>
    `;

    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      banner.style.display = 'none';
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User choice outcome:', outcome);
        deferredPrompt = null;
      }
    });

    document.getElementById('pwa-close-btn').addEventListener('click', () => {
      banner.style.display = 'none';
    });
  }
})();
```

- [ ] **Step 2: Commit**

```bash
git add assets/js/pwa-register.js
git commit -m "feat(pwa): add PWA SW registration & install prompt UI script"
```

---

### Task 6: Integrate PWA tags into HTML pages

**Files:**
- Modify: `index.html`
- Modify: `pages/index.html`
- Modify: `pages/dang_nhap.html`
- Modify: `pages/about.html`
- Modify: `pages/home.html`

**Interfaces:**
- Consumes: `manifest.json`, `assets/js/pwa-register.js`, `assets/icons/icon-192x192.png`.

- [ ] **Step 1: Add PWA head meta tags & script to HTML files**

Insert the following inside `<head>` of HTML files:
```html
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0d6efd">
  <link rel="apple-touch-icon" href="/assets/icons/icon-192x192.png">
  <script src="/assets/js/pwa-register.js" defer></script>
```

- [ ] **Step 2: Verify HTML tags**

Grep for `pwa-register.js` across HTML files.

- [ ] **Step 3: Commit**

```bash
git add index.html pages/*.html
git commit -m "feat(pwa): integrate manifest and SW registration in HTML pages"
```

---

### Task 7: Verification & Testing

- [ ] **Step 1: Serve application locally**

Run: `npx serve .` or `npm run dev`

- [ ] **Step 2: Verify PWA Manifest & SW in Chrome DevTools Application Tab**
  - Verify Manifest loads correctly with icons.
  - Verify Service Worker registers and activates cleanly.

- [ ] **Step 3: Final Commit & Cleanup**

```bash
git status
```
