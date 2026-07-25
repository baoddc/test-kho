# Auto-Update Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai hệ thống tự động kiểm tra và hiển thị thông báo cập nhật (Auto-Update Toast Notification) cho ứng dụng Desktop (.exe) và Web khi có phiên bản code mới được deploy.

**Architecture:** Tạo file `/version.json` làm nguồn dữ liệu phiên bản trên server. Viết module client `assets/js/update-checker.js` tự động fetch ngầm `/version.json` theo chu kỳ 5 phút, so sánh phiên bản và hiển thị Glassmorphic Floating Toast để người dùng 1-click Cập nhật ngay (`location.reload(true)`). Cập nhật script build `.exe` để tự động copy `version.json` vào `dist-app/`.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, Glassmorphism CSS3, Electron Builder.

## Global Constraints

- Không làm gián đoạn trải nghiệm người dùng khi đang nhập dữ liệu (thông báo ở dạng Toast không nảy popup modal làm ngắt quãng thao tác).
- Tự động bỏ qua lỗi ngầm khi mất mạng hoặc không kết nối được server Vercel.
- Đảm bảo tương thích hoàn hảo giữa bản Web Vercel và bản Desktop `.exe` Electron.

---

### Task 1: Version File & Core Update Checker Module

**Files:**
- Create: `version.json`
- Create: `assets/js/update-checker.js`

**Interfaces:**
- Consumes: `/version.json?t=<timestamp>`
- Produces: `window.APP_VERSION`, `window.initUpdateChecker()`

- [ ] **Step 1: Create `version.json` at project root**

```json
{
  "version": "1.0.0",
  "buildTime": "2026-07-25T14:00:00Z",
  "releaseNotes": "Cập nhật hệ thống Quản lý Kho Phôi Cuộn - DDC.",
  "minExeVersion": "1.0.0"
}
```

- [ ] **Step 2: Create `assets/js/update-checker.js`**

```javascript
(function () {
  const CURRENT_VERSION = '1.0.0';
  window.APP_VERSION = CURRENT_VERSION;

  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  let isToastShown = false;

  function compareVersions(v1, v2) {
    const p1 = String(v1).split('.').map(Number);
    const p2 = String(v2).split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  function injectStyles() {
    if (document.getElementById('update-checker-styles')) return;
    const style = document.createElement('style');
    style.id = 'update-checker-styles';
    style.textContent = `
      .update-toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        max-width: 360px;
        background: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        padding: 18px 20px;
        color: #f8fafc;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.2);
        animation: updateToastSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      @keyframes updateToastSlideUp {
        from { opacity: 0; transform: translateY(30px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .update-toast-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      .update-toast-icon {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      }
      .update-toast-title {
        font-weight: 600;
        font-size: 15px;
        color: #ffffff;
      }
      .update-toast-body {
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.5;
        margin-bottom: 14px;
      }
      .update-toast-actions {
        display: flex;
        gap: 10px;
      }
      .btn-update-now {
        flex: 1;
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        color: #ffffff;
        border: none;
        padding: 8px 14px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      }
      .btn-update-now:hover {
        opacity: 0.95;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
      }
      .btn-update-dismiss {
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 8px 12px;
        border-radius: 10px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .btn-update-dismiss:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    `;
    document.head.appendChild(style);
  }

  function showUpdateToast(data) {
    if (isToastShown) return;
    isToastShown = true;
    injectStyles();

    const toast = document.createElement('div');
    toast.className = 'update-toast';
    toast.id = 'app-update-toast';
    toast.innerHTML = `
      <div class="update-toast-header">
        <div class="update-toast-icon">🚀</div>
        <div class="update-toast-title">Đã có phiên bản mới (v${data.version})</div>
      </div>
      <div class="update-toast-body">
        ${data.releaseNotes || 'Tính năng và giao diện đã được cập nhật.'}
      </div>
      <div class="update-toast-actions">
        <button class="btn-update-now" id="btnAppUpdateNow">⚡ Cập nhật ngay</button>
        <button class="btn-update-dismiss" id="btnAppUpdateDismiss">Bỏ qua</button>
      </div>
    `;

    document.body.appendChild(toast);

    document.getElementById('btnAppUpdateNow').addEventListener('click', () => {
      window.location.reload(true);
    });

    document.getElementById('btnAppUpdateDismiss').addEventListener('click', () => {
      toast.remove();
    });
  }

  async function checkUpdate() {
    try {
      const response = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.version && compareVersions(data.version, CURRENT_VERSION) > 0) {
        showUpdateToast(data);
      }
    } catch (err) {
      // Silently ignore network / offline errors
    }
  }

  function init() {
    // Delay first check slightly so it doesn't block critical page render
    setTimeout(checkUpdate, 3000);
    setInterval(checkUpdate, CHECK_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.initUpdateChecker = checkUpdate;
})();
```

- [ ] **Step 3: Test `update-checker.js` locally**

Run node script to verify json structure:
```powershell
node -e "console.log(require('./version.json'))"
```

- [ ] **Step 4: Commit Task 1**

```bash
git add version.json assets/js/update-checker.js
git commit -m "feat: add version.json and auto-update checker script"
```

---

### Task 2: Import Update Checker into Sidebar & Login Page

**Files:**
- Modify: `assets/js/sidebar.js`
- Modify: `pages/index.html`

- [ ] **Step 1: Update `assets/js/sidebar.js` to dynamically load `update-checker.js`**

Add at the top of `assets/js/sidebar.js`:
```javascript
// Load update-checker script automatically if not loaded
if (!document.getElementById('update-checker-script')) {
  const updateScript = document.createElement('script');
  updateScript.id = 'update-checker-script';
  updateScript.src = '/assets/js/update-checker.js';
  updateScript.defer = true;
  document.head.appendChild(updateScript);
}
```

- [ ] **Step 2: Update `pages/index.html` to include `update-checker.js`**

Add script tag before `</body>`:
```html
<script src="/assets/js/update-checker.js" defer></script>
```

- [ ] **Step 3: Commit Task 2**

```bash
git add assets/js/sidebar.js pages/index.html
git commit -m "feat: integrate auto-update checker in sidebar and login page"
```

---

### Task 3: Sync Version & Update Assets to `dist-app/` and Build Script

**Files:**
- Modify: `scripts/build-exe.js`
- Create/Sync: `dist-app/version.json`
- Create/Sync: `dist-app/assets/js/update-checker.js`

- [ ] **Step 1: Update `scripts/build-exe.js` to copy `version.json` and assets into `dist-app/`**

Ensure `build-exe.js` copies root `version.json` and assets to `dist-app/` before running Electron Packager.

```javascript
// In build-exe.js before packaging:
fs.copyFileSync(
  path.join(__dirname, '../version.json'),
  path.join(__dirname, '../dist-app/version.json')
);
```

- [ ] **Step 2: Copy current `version.json` and `update-checker.js` into `dist-app/`**

Copy `version.json` -> `dist-app/version.json`
Copy `assets/js/update-checker.js` -> `dist-app/assets/js/update-checker.js`

- [ ] **Step 3: Test build script sync**

Run:
```powershell
node scripts/build-exe.js
```

- [ ] **Step 4: Commit Task 3**

```bash
git add scripts/build-exe.js dist-app/version.json dist-app/assets/js/update-checker.js
git commit -m "feat: sync version.json and update-checker to dist-app build process"
```
