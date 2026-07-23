# PWA Packaging & Install Button Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the "Hệ thống Quản lý Kho Phôi Cuộn - DDC" web application into an installable Progressive Web App (PWA) with offline detection fallback and an in-app sidebar install button.

**Architecture:** Create a `manifest.json` for web app metadata, a native Service Worker (`sw.js`) handling static asset caching (Stale-While-Revalidate) and network-first navigation with fallback to `offline.html`, a `pwa-register.js` manager script handling installation prompts, and integration into all HTML pages and navigation sidebars.

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript, Web App Manifest API, Service Worker API.

## Global Constraints
- Target platform: Standalone Progressive Web App.
- Supabase API traffic (`*.supabase.co`): Strictly Network Only to guarantee database accuracy.
- No build steps or bundlers required (pure static files server-ready for Vercel).

---

### Task 1: Create Web App Manifest & App Icon Assets

**Files:**
- Create: `manifest.json`
- Create: `assets/images/icon-192.png`
- Create: `assets/images/icon-512.png`
- Create: `assets/images/apple-touch-icon.png`

**Interfaces:**
- Consumes: None
- Produces: `manifest.json` linked via `<link rel="manifest" href="/manifest.json">`

- [ ] **Step 1: Create Web App Manifest**

Write `manifest.json` at root:
```json
{
  "name": "Hệ thống Quản lý Kho Phôi Cuộn - DDC",
  "short_name": "Kho Phôi DDC",
  "description": "Ứng dụng quản lý kho phôi cuộn và lập phiếu xuất nhập DDC",
  "start_url": "/index.html",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#1e293b",
  "orientation": "any",
  "icons": [
    {
      "src": "/assets/images/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/assets/images/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Generate PWA App Icons**

Create SVG icon or canvas script to generate standard PWA PNG icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) with DDC branding styling.

- [ ] **Step 3: Verify Manifest Syntax**

Run node check: `node -e "JSON.parse(fs.readFileSync('manifest.json'))"`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add manifest.json assets/images/
git commit -m "feat(pwa): add web app manifest and app icon assets"
```

---

### Task 2: Create Offline Fallback Page (`offline.html`)

**Files:**
- Create: `offline.html`

**Interfaces:**
- Consumes: None
- Produces: Served by Service Worker when browser navigates offline without cache.

- [ ] **Step 1: Write `offline.html`**

Create `offline.html` with clean responsive dark UI and retry button.

- [ ] **Step 2: Verify `offline.html` rendering**

Open in browser / check syntax.

- [ ] **Step 3: Commit**

```bash
git add offline.html
git commit -m "feat(pwa): create offline fallback page"
```

---

### Task 3: Create Service Worker (`sw.js`)

**Files:**
- Create: `sw.js`

**Interfaces:**
- Consumes: Static asset paths (`assets/`, `pages/`, `offline.html`)
- Produces: Service Worker intercepting fetch events and caching assets under `ddc-kho-v1`.

- [ ] **Step 1: Write `sw.js` implementation**

Implement install, activate, and fetch handlers with:
- Static cache pre-fetching (`ddc-kho-v1`)
- Network-Only bypass for Supabase API requests (`*.supabase.co`)
- Stale-While-Revalidate for CSS, JS, Images, Fonts
- Network-First for HTML navigation with fallback to cached page or `/offline.html`

- [ ] **Step 2: Commit**

```bash
git add sw.js
git commit -m "feat(pwa): implement service worker with static caching and offline fallback"
```

---

### Task 4: Create PWA Registration & Install Manager Script

**Files:**
- Create: `assets/js/pwa-register.js`

**Interfaces:**
- Consumes: Browser `beforeinstallprompt` event and Service Worker API
- Produces: `window.installPWA()` global helper, automatic SW registration, and sidebar button state handler.

- [ ] **Step 1: Write `assets/js/pwa-register.js`**

Implement SW registration, `beforeinstallprompt` event capture, standalone display detection, and sidebar install button event bindings.

- [ ] **Step 2: Commit**

```bash
git add assets/js/pwa-register.js
git commit -m "feat(pwa): create PWA registration script and install prompt manager"
```

---

### Task 5: Integrate PWA Meta Tags, Registration Script, & Sidebar Install Button

**Files:**
- Modify: `index.html`
- Modify: `pages/*.html` (All main HTML pages)
- Modify: Sidebar components / JS renderer (`assets/js/common.js` or `pages/` header/sidebar templates)

**Interfaces:**
- Consumes: `manifest.json`, `pwa-register.js`
- Produces: Installed PWA experience across all pages with "📲 Cài đặt App" button in navigation sidebar.

- [ ] **Step 1: Update HTML files with PWA meta tags & script**

Add `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, and `<script src="/assets/js/pwa-register.js" defer></script>`.

- [ ] **Step 2: Add PWA Install Button to Navigation Sidebar**

Add UI button for PWA install in sidebar navigation with ID `pwa-install-btn`.

- [ ] **Step 3: Test and verify PWA setup**

Verify manifest and service worker loading cleanly without syntax or script errors.

- [ ] **Step 4: Commit**

```bash
git add index.html pages/ assets/
git commit -m "feat(pwa): integrate PWA manifest, service worker registration, and sidebar install button across all pages"
```
