# Direct Launch Installed PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Direct user to launch installed PWA app via custom protocol handler (`web+ddckho://open`) when clicking the install/launch button in standard browser mode.

**Architecture:** Add `"protocol_handlers"` in `manifest.json`. Upgrade `assets/js/pwa-register.js` to auto-detect installed state via `navigator.getInstalledRelatedApps()`, update button labels dynamically to "🚀 Mở App DDC Kho", handle protocol triggering, and add fallback links in the install instruction modal.

**Tech Stack:** Vanilla JavaScript (ES6+), PWA Manifest v2/v3, Custom Protocol Handler (`web+ddckho`).

## Global Constraints
- Custom protocol name MUST be `web+ddckho` (compliant with web standard custom protocol naming `web+...`).
- Preserve existing PWA install fallback when not installed or supported.

---

### Task 1: Add Custom Protocol Handler to Manifests

**Files:**
- Modify: `manifest.json`
- Modify: `dist-app/manifest.json`

**Interfaces:**
- Produces: OS/Browser protocol binding `web+ddckho://` pointing to `/index.html?launcher=pwa&url=%s`.

- [ ] **Step 1: Update `manifest.json`**

Add `"protocol_handlers"` block:
```json
  "protocol_handlers": [
    {
      "protocol": "web+ddckho",
      "url": "/index.html?launcher=pwa&url=%s"
    }
  ]
```

- [ ] **Step 2: Update `dist-app/manifest.json`**

Ensure `dist-app/manifest.json` contains the exact same `"protocol_handlers"` block.

- [ ] **Step 3: Verify JSON validity**

Verify both JSON files parse cleanly.

---

### Task 2: Implement Installed Detection & Direct Launch in `pwa-register.js`

**Files:**
- Modify: `assets/js/pwa-register.js`
- Modify: `dist-app/assets/js/pwa-register.js`

**Interfaces:**
- Consumes: `web+ddckho` protocol, `navigator.getInstalledRelatedApps()`
- Produces: `window.openInstalledPWA()`, `window.installPWA()`, dynamic button label switching.

- [ ] **Step 1: Add `isInstalled` detection and `openInstalledPWA()` in `assets/js/pwa-register.js`**

Add detection logic:
```javascript
let isAppInstalled = false;

async function checkAppInstalled() {
  if ('getInstalledRelatedApps' in navigator) {
    try {
      const relatedApps = await navigator.getInstalledRelatedApps();
      if (relatedApps && relatedApps.length > 0) {
        isAppInstalled = true;
        updateInstallButton();
      }
    } catch (e) {
      console.warn('[PWA] Error checking installed related apps:', e);
    }
  }
}
```

Add launcher function:
```javascript
window.openInstalledPWA = function() {
  console.log('[PWA] Attempting to open installed app via protocol...');
  window.location.href = 'web+ddckho://open';
};
```

Update `updateInstallButton()`:
```javascript
function updateInstallButton() {
  const isStandalone = checkIsStandalone();
  const buttons = document.querySelectorAll('#pwa-install-btn, .pwa-install-btn');
  
  buttons.forEach(btn => {
    if (isStandalone) {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'inline-flex';
      if (isAppInstalled) {
        btn.innerHTML = '🚀 Mở App DDC Kho';
        btn.onclick = window.openInstalledPWA;
      } else {
        btn.innerHTML = '📲 Cài đặt App';
        btn.onclick = window.installPWA;
      }
    }
  });
}
```

Add fallback button inside `showInstallInstructionsModal()`:
```html
<button id="pwa-modal-open-btn" style="
  width: 100%;
  background: #10b981;
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 0.5rem;
">🚀 Đã cài rồi? Mở App Ngay</button>
```
And bind `modal.querySelector('#pwa-modal-open-btn').onclick = window.openInstalledPWA;`.

- [ ] **Step 2: Copy/sync changes to `dist-app/assets/js/pwa-register.js`**

Ensure `dist-app/assets/js/pwa-register.js` is identical.

- [ ] **Step 3: Verification**

Test in browser console by verifying syntax and functions exist on `window`.
