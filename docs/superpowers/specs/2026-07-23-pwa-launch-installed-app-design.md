# Spec: Open Installed PWA App Directly On Click

## Problem Statement
When users visit the DDC Kho web application via a standard web browser (Chrome/Edge/Safari), if they have already installed the PWA onto their device, clicking the install button currently presents an instruction popup on how to install the app. Users expect that if the app is already installed, clicking the button or link should directly open the installed PWA application.

## User Experience & Requirements
1. **Auto-detection of Installed App**:
   - Detect if the user has already installed the PWA on their desktop or mobile device.
2. **Dynamic Button State**:
   - If running inside PWA standalone mode: Hide the button.
   - If running in standard browser AND app is installed: Change button text/action to **"🚀 Mở App DDC Kho"** (Open App).
   - If running in standard browser AND app is NOT installed: Keep button as **"📲 Cài đặt App"** (Install App).
3. **Direct App Launch**:
   - When clicking **"🚀 Mở App DDC Kho"**, launch the installed PWA directly using custom protocol handler `web+ddckho://open`.
4. **Fallback in Instruction Modal**:
   - In the instruction modal, include a direct "Mở App DDC Kho (Nếu đã cài đặt)" button for devices or browsers where `getInstalledRelatedApps` auto-detection might be restricted.

## Technical Architecture

### 1. Web App Manifest (`manifest.json` & `dist-app/manifest.json`)
Add `protocol_handlers` configuration:
```json
"protocol_handlers": [
  {
    "protocol": "web+ddckho",
    "url": "/index.html?launcher=pwa&url=%s"
  }
]
```

### 2. PWA Registration & Launch Logic (`assets/js/pwa-register.js` & `dist-app/assets/js/pwa-register.js`)
- Maintain internal state `isInstalled`.
- Check `navigator.getInstalledRelatedApps()` on page load. If it returns registered app, set `isInstalled = true`.
- Listen to `appinstalled` event to dynamically set `isInstalled = true`.
- Implement `openInstalledPWA()`:
  - Executes `window.location.href = 'web+ddckho://open'` or fallback `window.open('web+ddckho://open', '_self')`.
- Update `updateInstallButton()`:
  - If standalone: hide.
  - Else if `isInstalled`: show button with text "🚀 Mở App", onClick triggers `openInstalledPWA()`.
  - Else: show button with text "📲 Cài đặt App", onClick triggers `installPWA()`.

## Verification Plan
1. Test button state rendering in browser mode.
2. Test protocol handler registration in manifest.
3. Test direct launch functionality and fallback modal behavior.
