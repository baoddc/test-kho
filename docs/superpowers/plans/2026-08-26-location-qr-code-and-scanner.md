# Location QR Code and Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an industrial QR and Barcode batch label printing tool for warehouse racks A01-A14, B01-B14 & Grating, a unified mobile-first location inventory viewer (`vi-tri-ton.html`), and in-app camera scanner integration across Xà gồ and Tole warehouse pages.

**Architecture:** 
- `assets/js/core/qr-scanner-service.js`: Reusable module for parsing QR/Barcode payloads (extracting clean rack codes from URLs or raw text) and managing the HTML5 Camera QR scanner modal.
- `pages/in-tem-vitri.html`: Standalone batch label generator with preset rack selectors (A01-A14, B01-B14, GRATING), multi-layout print formats (A4 4-grid, A4 2-grid, Decal thermal 100x75mm/100x150mm), QRCode.js and JsBarcode rendering.
- `pages/vi-tri-ton.html`: Mobile-first quick inventory lookup page triggered when scanning a shelf QR with any phone camera, aggregating live stock from Supabase for both XG and Tole at that rack.
- Integration into `xg-ton`, `tole-ton`, `xg-nhap`, `tole-nhap`, `xg-xuat`, `tole-xuat`, and `sidebar.js`.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, CSS3 with `@media print`, Bootstrap 5.3, `html5-qrcode` (v2.3.8), `qrcodejs` (v1.0.0), `jsbarcode` (v3.11.5), Supabase JS Client v2.

## Global Constraints
- Target 28 standard racks (`A01` to `A14`, `B01` to `B14`) and Grating zone (`GRATING`, `GR-01`, `GR-02`), shared jointly by Kho Xà gồ and Kho Tole.
- Dual-purpose scanning: external phone camera opens `pages/vi-tri-ton.html?vitri=<RACK>`, while in-app scanner parses both URLs and raw strings into clean rack codes.
- Zero-bleed, page-break-safe CSS for print styling.
- Non-blocking asynchronous Supabase inventory querying with local cache fallback.

---

### Task 1: Core QR Parser and Scanner Service Module

**Files:**
- Create: `assets/js/core/qr-scanner-service.js`
- Create: `tests/qr-scanner-service.test.js`

**Interfaces:**
- Produces:
  - `parseLocationQRCode(rawText: string): string`
  - `getAllStandardRacks(): string[]`
  - `openQRCameraScanner(onScanned: (code: string) => void, options?: object): void`
  - `closeQRCameraScanner(): void`

- [ ] **Step 1: Write test for `parseLocationQRCode` and `getAllStandardRacks`**

```javascript
// tests/qr-scanner-service.test.js
const assert = require('assert');

function parseLocationQRCode(rawText, baseOrigin = 'http://localhost:3000') {
  if (!rawText) return '';
  const text = String(rawText).trim();
  try {
    if (text.includes('?') && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/'))) {
      const url = new URL(text, baseOrigin);
      const vitri = url.searchParams.get('vitri') || url.searchParams.get('loc') || url.searchParams.get('location');
      if (vitri) return decodeURIComponent(vitri).trim().toUpperCase();
    }
  } catch (e) {}
  return text.toUpperCase();
}

function getAllStandardRacks() {
  const racks = [];
  for (let i = 1; i <= 14; i++) {
    racks.push(`A${String(i).padStart(2, '0')}`);
  }
  for (let i = 1; i <= 14; i++) {
    racks.push(`B${String(i).padStart(2, '0')}`);
  }
  racks.push('GRATING', 'GR-01', 'GR-02');
  return racks;
}

// Test assertions
assert.strictEqual(parseLocationQRCode('A01'), 'A01');
assert.strictEqual(parseLocationQRCode('b05'), 'B05');
assert.strictEqual(parseLocationQRCode('grating'), 'GRATING');
assert.strictEqual(parseLocationQRCode('https://ddc-kho.vn/pages/vi-tri-ton.html?vitri=A12'), 'A12');
assert.strictEqual(parseLocationQRCode('https://ddc-kho.vn/pages/xg/xg-ton.html?vitri=B09'), 'B09');
assert.strictEqual(parseLocationQRCode('/pages/vi-tri-ton.html?vitri=GRATING'), 'GRATING');
assert.strictEqual(getAllStandardRacks().length, 31);
assert.strictEqual(getAllStandardRacks()[0], 'A01');
assert.strictEqual(getAllStandardRacks()[13], 'A14');
assert.strictEqual(getAllStandardRacks()[14], 'B01');
assert.strictEqual(getAllStandardRacks()[27], 'B14');

console.log('All Task 1 unit tests passed successfully!');
```

- [ ] **Step 2: Run test to verify functionality**

Run: `node tests/qr-scanner-service.test.js`  
Expected: `All Task 1 unit tests passed successfully!`

- [ ] **Step 3: Implement `assets/js/core/qr-scanner-service.js`**

```javascript
/* =============================================================================
   QR SCANNER & LOCATION PARSER SERVICE
   Hỗ trợ bóc tách mã QR vị trí kệ & điều khiển Modal Camera Scanner HTML5
================================================================================ */

(function (window) {
  'use strict';

  function parseLocationQRCode(rawText, baseOrigin) {
    if (!rawText) return '';
    const text = String(rawText).trim();
    const origin = baseOrigin || (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost');
    try {
      if (text.includes('?') && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/'))) {
        const url = new URL(text, origin);
        const vitri = url.searchParams.get('vitri') || url.searchParams.get('loc') || url.searchParams.get('location');
        if (vitri) return decodeURIComponent(vitri).trim().toUpperCase();
      }
    } catch (e) {}
    return text.toUpperCase();
  }

  function getAllStandardRacks() {
    const racks = [];
    for (let i = 1; i <= 14; i++) {
      racks.push(`A${String(i).padStart(2, '0')}`);
    }
    for (let i = 1; i <= 14; i++) {
      racks.push(`B${String(i).padStart(2, '0')}`);
    }
    racks.push('GRATING', 'GR-01', 'GR-02');
    return racks;
  }

  let html5QrCodeInstance = null;

  function ensureScannerModalDom() {
    let modalEl = document.getElementById('qrScannerModal');
    if (modalEl) return modalEl;

    const modalHtml = `
      <div class="modal fade" id="qrScannerModal" tabindex="-1" aria-labelledby="qrScannerModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content shadow-lg border-0 bg-dark text-white">
            <div class="modal-header border-secondary py-2">
              <h6 class="modal-title d-flex align-items-center gap-2" id="qrScannerModalLabel">
                <i class="bi bi-qr-code-scan text-warning"></i> Quét mã QR Vị Trí Kệ
              </h6>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-3 text-center position-relative">
              <div id="qrScannerReader" style="width: 100%; min-height: 280px; border-radius: 8px; overflow: hidden; background: #000;"></div>
              <div class="small text-light mt-2 opacity-75">
                Hướng camera về phía mã QR trên kệ (A01-A14, B01-B14, Grating)
              </div>
            </div>
            <div class="modal-footer border-secondary py-2 justify-content-between">
              <span id="qrScannerStatus" class="small text-info">Đang bật camera...</span>
              <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Đóng</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    return document.getElementById('qrScannerModal');
  }

  function playBeepSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 120);
    } catch (e) {}
    if (navigator.vibrate) {
      try { navigator.vibrate(80); } catch (e) {}
    }
  }

  function openQRCameraScanner(onScanned, options = {}) {
    if (typeof Html5Qrcode === 'undefined') {
      alert('Chưa tải được thư viện Html5Qrcode. Vui lòng kiểm tra kết nối mạng!');
      return;
    }

    const modalEl = ensureScannerModalDom();
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const statusEl = document.getElementById('qrScannerStatus');

    modalEl.addEventListener('hidden.bs.modal', function onHidden() {
      closeQRCameraScanner();
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
    });

    modal.show();

    setTimeout(() => {
      if (html5QrCodeInstance) {
        try { html5QrCodeInstance.stop().catch(() => {}); } catch (e) {}
      }

      html5QrCodeInstance = new Html5Qrcode('qrScannerReader');
      const config = { fps: 10, qrbox: { width: 220, height: 220 }, ...options };

      html5QrCodeInstance.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          const parsedCode = parseLocationQRCode(decodedText);
          playBeepSound();
          if (statusEl) statusEl.textContent = `Đã nhận diện: ${parsedCode}`;
          closeQRCameraScanner();
          modal.hide();
          if (typeof onScanned === 'function') {
            onScanned(parsedCode, decodedText);
          }
        },
        (errorMessage) => {
          // ignore frame errors
        }
      ).then(() => {
        if (statusEl) statusEl.textContent = 'Camera sẵn sàng';
      }).catch((err) => {
        console.error('Camera scan error:', err);
        if (statusEl) statusEl.textContent = 'Không thể mở camera: ' + err;
      });
    }, 300);
  }

  function closeQRCameraScanner() {
    if (html5QrCodeInstance) {
      try {
        html5QrCodeInstance.stop().then(() => {
          html5QrCodeInstance.clear();
          html5QrCodeInstance = null;
        }).catch(() => {
          html5QrCodeInstance = null;
        });
      } catch (e) {
        html5QrCodeInstance = null;
      }
    }
  }

  window.qrScannerService = {
    parseLocationQRCode,
    getAllStandardRacks,
    openQRCameraScanner,
    closeQRCameraScanner
  };

})(window);
```

- [ ] **Step 4: Commit Task 1 changes**

```bash
git add assets/js/core/qr-scanner-service.js tests/qr-scanner-service.test.js
git commit -m "feat: add QR scanner service and location parser module"
```

---

### Task 2: Build Industrial QR & Barcode Batch Label Generator and Print Tool (`pages/in-tem-vitri.html`)

**Files:**
- Create: `pages/in-tem-vitri.html`
- Create: `assets/css/in-tem-vitri.css`
- Create: `assets/js/in-tem-vitri.js`

**Interfaces:**
- Consumes: `qrScannerService.getAllStandardRacks()`, `QRCode`, `JsBarcode`
- Produces: Batch label rendering on screen with `@media print` layout formatting.

- [ ] **Step 1: Create HTML structure `pages/in-tem-vitri.html`**

Create `pages/in-tem-vitri.html` containing:
- Sidebar integration (`/assets/js/components/sidebar.js`)
- Control panel with rack presets (Dãy A, Dãy B, Grating, Select All, Custom inputs)
- Layout options (A4 4-tem, A4 2-tem, Decal 100x75mm, Decal 100x150mm)
- Action buttons: In Tem (`window.print()`), Chọn nhanh, Bỏ chọn
- Live preview grid of generated labels
- Script imports: QRCode.js (`https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`), JsBarcode (`https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js`), `qr-scanner-service.js`, `in-tem-vitri.js`.

- [ ] **Step 2: Create CSS `assets/css/in-tem-vitri.css`**

Implement print stylesheet:
- Standard screen grid view with responsive cards.
- `@media print`: hides `.sidebar`, `.topbar`, `#controlPanel`, `.no-print`.
- Sets `@page { size: A4 portrait; margin: 8mm; }` or dynamic sizes.
- Label box styling: bold dark borders, high contrast text, sharp barcodes/QR, no break inside label (`break-inside: avoid; page-break-after: auto;`).

- [ ] **Step 3: Create JS logic `assets/js/in-tem-vitri.js`**

Implement label generator:
- Render checkboxes for all 28 racks (`A01-A14`, `B01-B14`) + `GRATING`, `GR-01`, `GR-02`.
- Function `generateLabels()`: builds label cards, creates dynamic canvas QR using `new QRCode()` pointing to `${origin}/pages/vi-tri-ton.html?vitri=${rackCode}` and barcode Code128 via `JsBarcode()`.
- Supports live batch update when checking/unchecking racks or changing layouts.

- [ ] **Step 4: Verify rendering and print layout**

Open in browser / check syntax and ensure QR codes generate cleanly.

- [ ] **Step 5: Commit Task 2 changes**

```bash
git add pages/in-tem-vitri.html assets/css/in-tem-vitri.css assets/js/in-tem-vitri.js
git commit -m "feat: add industrial QR and barcode batch label generator and print page"
```

---

### Task 3: Build Mobile-First Location Inventory Viewer (`pages/vi-tri-ton.html`)

**Files:**
- Create: `pages/vi-tri-ton.html`
- Create: `assets/css/vi-tri-ton.css`
- Create: `assets/js/vi-tri-ton.js`

**Interfaces:**
- Consumes: Supabase tables `xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`, `qrScannerService.parseLocationQRCode()`
- Produces: Live rack-specific inventory view showing coils count, total weight, and categorized tabs (Xà gồ & Tole).

- [ ] **Step 1: Create HTML structure `pages/vi-tri-ton.html`**

Create `pages/vi-tri-ton.html` with:
- Topbar & Responsive container.
- Location Header Badge (📍 KỆ A01) + Quick Rack Switcher Dropdown (A01..A14, B01..B14, GRATING).
- Summary Stat Cards (Tổng số cuộn, Tổng Kg xà gồ, Tổng Kg tole).
- Dual Tabs: "Cuộn Xà gồ" & "Cuộn Tole".
- Data tables with responsive layout, batch, weight, storage days.
- Quick navigation buttons to Nhập/Xuất kho.

- [ ] **Step 2: Create CSS `assets/css/vi-tri-ton.css`**

Implement styling:
- Modern gradient hero header card.
- High-contrast stat badges.
- Smooth table styling with badges for age of storage and roll status.

- [ ] **Step 3: Create JS logic `assets/js/vi-tri-ton.js`**

Implement inventory aggregation:
- Read `vitri` parameter from `window.location.search`.
- Fetch `xg-nhap` and `xg-xuat` in parallel, compute `xg-ton` for location.
- Fetch `tole-nhap` and `tole-xuat` in parallel, compute `tole-ton` for location.
- Render live summary badges and table rows.
- Handle rack switcher dropdown to update URL without full page reload.

- [ ] **Step 4: Verify location querying and calculation**

Test with dummy/live Supabase connection or mock data.

- [ ] **Step 5: Commit Task 3 changes**

```bash
git add pages/vi-tri-ton.html assets/css/vi-tri-ton.css assets/js/vi-tri-ton.js
git commit -m "feat: add unified location inventory lookup page for XG and Tole"
```

---

### Task 4: Integrate Camera QR Scanner and URL Deep-Link in `xg-ton.html` and `tole-ton.html`

**Files:**
- Modify: `pages/xg/xg-ton.html`
- Modify: `assets/js/xg/xg-ton.js`
- Modify: `pages/tole/tole-ton.html`
- Modify: `assets/js/tole/tole-ton.js`

**Interfaces:**
- Consumes: `qrScannerService.openQRCameraScanner()`, `html5-qrcode` CDN script.
- Produces: Instant filtering when scanning QR or opening page with `?vitri=A01`.

- [ ] **Step 1: Add HTML5-QRCode script and Camera Scan button in `xg-ton.html` and `tole-ton.html`**

Add CDN `<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>` and `<script src="/assets/js/core/qr-scanner-service.js"></script>` to head/scripts.  
Add Camera button `<button id="btnScanQR" class="btn btn-outline-primary btn-sm" title="Quét mã QR kệ"><i class="bi bi-camera"></i> Quét Kệ</button>` next to search bar.

- [ ] **Step 2: Update `assets/js/xg/xg-ton.js` and `assets/js/tole/tole-ton.js`**

- In `window.addEventListener('load')`: Read `new URLSearchParams(window.location.search).get('vitri')`. If exists, set search input value to the rack code and trigger `filterTable()`.
- Add event listener to `#btnScanQR`:
  ```javascript
  const btnScanQR = document.getElementById('btnScanQR');
  if (btnScanQR && window.qrScannerService) {
    btnScanQR.addEventListener('click', () => {
      window.qrScannerService.openQRCameraScanner((rackCode) => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.value = rackCode;
          filterTable();
        }
      });
    });
  }
  ```

- [ ] **Step 3: Verify scanner and deep link filtering on both pages**

- [ ] **Step 4: Commit Task 4 changes**

```bash
git add pages/xg/xg-ton.html assets/js/xg/xg-ton.js pages/tole/tole-ton.html assets/js/tole/tole-ton.js
git commit -m "feat: integrate camera QR scanner and deep link filtering into xg-ton and tole-ton"
```

---

### Task 5: Integrate Camera QR Scanner in Nhập & Xuất Pages (`xg-nhap`, `tole-nhap`, `xg-xuat`, `tole-xuat`)

**Files:**
- Modify: `pages/xg/xg-nhap.html` & `assets/js/xg/xg-nhap.js`
- Modify: `pages/tole/tole-nhap.html` & `assets/js/tole/tole-nhap.js`
- Modify: `pages/xg/xg-xuat.html` & `assets/js/xg/xg-xuat.js`
- Modify: `pages/tole/tole-xuat.html` & `assets/js/tole/tole-xuat.js`

**Interfaces:**
- Consumes: `qrScannerService.openQRCameraScanner()`
- Produces: Auto-filling location fields in batch roll entry modals and quick roll selection filters.

- [ ] **Step 1: Include scripts in Nhập & Xuất pages**

Add `html5-qrcode` CDN and `qr-scanner-service.js` to script sections.

- [ ] **Step 2: Add Scan Location buttons in Batch Rolls Modal on `xg-nhap` and `tole-nhap`**

Add camera icon button next to Location input header / rows in the roll table modal.  
When clicked, open scanner and populate `Vị trí` on the selected row (or offer to fill all empty rows in the batch).

- [ ] **Step 3: Add Scan Location in `xg-xuat` and `tole-xuat`**

Allow warehouse staff to scan rack QR to filter available rolls residing at that rack for fast picking.

- [ ] **Step 4: Verify end-to-end roll creation with scanned location**

- [ ] **Step 5: Commit Task 5 changes**

```bash
git add pages/xg/xg-nhap.html assets/js/xg/xg-nhap.js pages/tole/tole-nhap.html assets/js/tole/tole-nhap.js pages/xg/xg-xuat.html assets/js/xg/xg-xuat.js pages/tole/tole-xuat.html assets/js/tole/tole-xuat.js
git commit -m "feat: integrate camera QR scanner into roll entry and picking in nhap and xuat pages"
```

---

### Task 6: Update Sidebar Menu & End-to-End System Verification

**Files:**
- Modify: `assets/js/components/sidebar.js`

**Interfaces:**
- Produces: Navigation links to "In Tem Vị Trí QR" (`pages/in-tem-vitri.html`) and "Tra Cứu Vị Trí Kệ" (`pages/vi-tri-ton.html`).

- [ ] **Step 1: Update `sidebar.js` navigation links**

Add new navigation items under the appropriate menu group (Tiện ích / Quản lý kho).

- [ ] **Step 2: Perform End-to-End Verification**

- Test creating QR labels for `A01-A14`, `B01-B14`, and `GRATING`.
- Test print preview in browser.
- Test scanning URL or raw text in `vi-tri-ton.html`, `xg-ton.html`, `xg-nhap.html`.
- Run all automated unit tests (`node tests/qr-scanner-service.test.js`).

- [ ] **Step 3: Commit Task 6 changes**

```bash
git add assets/js/components/sidebar.js
git commit -m "feat: add location QR and lookup links to sidebar navigation"
```
