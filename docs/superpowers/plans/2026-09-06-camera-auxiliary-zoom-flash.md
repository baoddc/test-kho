# Camera Auxiliary Selection, Zoom (0.6x - 3.0x), and Flashlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bộ điều khiển camera nổi trực tiếp trên khung quét mã vạch hỗ trợ chuyển đổi camera phụ/chính, thu phóng zoom (từ 0.6x, 0.7x, 0.8x, 0.9x đến 3.0x) và bật/tắt đèn flash cho cả 2 trang Kiểm Kê Tồn Kho và Tra Cứu Vị Trí Cuộn.

**Architecture:** Xây dựng module dùng chung `assets/js/core/camera-controller.js` bao bọc và nâng cấp đối tượng `Html5Qrcode`. Module này quản lý danh sách camera, chuyển đổi thiết bị, điều khiển `videoTrack.applyConstraints({ advanced: [{ torch, zoom }] })` với cơ chế fallback CSS digital zoom khi phần cứng không hỗ trợ. Tích hợp trực tiếp vào `kiem-ke.js` và `vi-tri-ton.js`.

**Tech Stack:** HTML5, CSS3 Glassmorphism, Bootstrap 5 & Bootstrap Icons, WebRTC MediaStreamTrack API, Html5Qrcode library.

## Global Constraints

- Hỗ trợ dải zoom góc rộng từ 0.6x đến 3.0x (bước nhảy 0.1x).
- Tự động nhận diện camera phụ (Ultra-wide / Telephoto / Front / Back).
- Bật/tắt đèn Flash an toàn, tự động ẩn hoặc vô hiệu hóa nếu thiết bị không hỗ trợ.
- Giao diện overlay bán trong suốt nổi ngay trên khung hình camera, không chiếm diện tích bên ngoài.
- Đồng bộ toàn bộ sang `public/`, `dist/`, `dist-app/` qua `scripts/sync-dist.js`.

---

### Task 1: Thiết Kế CSS Cho Thanh Điều Khiển Nổi Trên Khung Camera

**Files:**
- Modify: `assets/css/pages/kiem-ke.css`
- Modify: `assets/css/pages/vi-tri-ton.css`

**Interfaces:**
- Produces CSS classes: `.camera-overlay-container`, `.camera-top-toolbar`, `.camera-cam-btn`, `.camera-cam-btn.active-torch`, `.camera-zoom-bar`, `.camera-zoom-preset-btn`, `.camera-zoom-slider`.

- [ ] **Step 1: Thêm CSS điều khiển camera vào `assets/css/pages/kiem-ke.css`**

Thêm các lớp định kiểu overlay kính mờ (glassmorphism), các nút tròn nổi ở góc trên (Flash ⚡, Đổi camera 🔄) và thanh zoom ở cạnh dưới khung video:

```css
/* Camera Controls Overlay */
.camera-overlay-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
}
.camera-overlay-wrapper #cameraScannerReader,
.camera-overlay-wrapper #coilCameraReader {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
}
.camera-overlay-toolbar-top {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 8px;
}
.cam-overlay-btn {
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #f8fafc;
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}
.cam-overlay-btn:hover {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(255, 255, 255, 0.4);
}
.cam-overlay-btn.torch-active {
  background: #f59e0b;
  color: #000;
  font-weight: bold;
  border-color: #fbbf24;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.6);
}
.cam-overlay-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.camera-overlay-zoom-bar {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  padding: 5px 12px;
  max-width: 92%;
}
.camera-zoom-presets {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cam-zoom-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #cbd5e1;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 12px;
  padding: 2px 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.cam-zoom-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
.cam-zoom-btn.active {
  background: #3b82f6;
  color: #fff;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}
.camera-zoom-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.camera-zoom-slider {
  width: 140px;
  height: 4px;
  accent-color: #3b82f6;
  cursor: pointer;
}
.camera-zoom-val-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #38bdf8;
  min-width: 32px;
  text-align: center;
}
```

- [ ] **Step 2: Thêm CSS tương tự vào `assets/css/pages/vi-tri-ton.css`**

- [ ] **Step 3: Commit**

```bash
git add assets/css/pages/kiem-ke.css assets/css/pages/vi-tri-ton.css
git commit -m "style: add camera overlay controls and zoom slider styling"
```

---

### Task 2: Phát Triển Module `CameraController` Dùng Chung

**Files:**
- Create: `assets/js/core/camera-controller.js`

**Interfaces:**
- Class/Object: `window.CameraController`
- Methods:
  - `new CameraController(options)`: `options = { containerId, readerId, html5QrCode, onCameraChanged, onStatus }`
  - `init()`: Lấy danh sách camera (`Html5Qrcode.getCameras()`), render overlay DOM, gắn sự kiện.
  - `attachTrack(mediaStreamTrack)`: Gắn track đang chạy từ Html5Qrcode để truy xuất `capabilities`.
  - `toggleTorch()`: Bật / tắt đèn Flash.
  - `switchCamera()`: Chuyển sang camera kế tiếp (hoặc camera góc rộng 0.6x khi cần).
  - `setZoom(zoomFactor)`: Đặt mức zoom (từ 0.6 đến 3.0), áp dụng hardware zoom hoặc digital CSS transform.
  - `destroy()`: Dọn dẹp DOM overlay và ngắt các listener.

- [ ] **Step 1: Viết mã module `assets/js/core/camera-controller.js`**

```javascript
/**
 * CameraController - Bộ điều khiển camera phụ, zoom in/out (0.6x - 3.0x) và đèn flash
 */
(function (window) {
  'use strict';

  class CameraController {
    constructor(options) {
      this.container = typeof options.container === 'string' 
        ? document.getElementById(options.container) 
        : options.container;
      this.readerId = options.readerId;
      this.html5QrCode = options.html5QrCode || null;
      this.onCameraChanged = options.onCameraChanged || null;
      
      this.cameras = [];
      this.currentCameraIndex = 0;
      this.isTorchOn = false;
      this.currentZoom = 1.0;
      this.minZoom = 0.6;
      this.maxZoom = 3.0;
      this.stepZoom = 0.1;
      this.videoTrack = null;
      this.hasHardwareZoom = false;
      this.hasHardwareTorch = false;
      
      this.overlayEl = null;
    }

    async init() {
      if (!this.container) return;
      try {
        if (typeof Html5Qrcode !== 'undefined' && Html5Qrcode.getCameras) {
          this.cameras = await Html5Qrcode.getCameras();
        }
      } catch (e) {
        console.warn('Lỗi lấy danh sách camera:', e);
      }
      this.renderOverlay();
      this.bindEvents();
    }

    renderOverlay() {
      if (this.overlayEl) this.overlayEl.remove();

      this.overlayEl = document.createElement('div');
      this.overlayEl.className = 'camera-overlay-controls';
      this.overlayEl.innerHTML = `
        <div class="camera-overlay-toolbar-top">
          <button type="button" class="cam-overlay-btn" id="btnCamSwitch" title="Đổi camera" style="${this.cameras.length > 1 ? '' : 'display:none;'}">
            <i class="bi bi-arrow-repeat"></i>
            <span id="camLabelBadge" style="font-size:0.75rem;">Đổi Cam</span>
          </button>
          <button type="button" class="cam-overlay-btn" id="btnCamTorch" title="Bật/Tắt Flash">
            <i class="bi bi-lightning-charge"></i>
            <span style="font-size:0.75rem;">Flash</span>
          </button>
        </div>

        <div class="camera-overlay-zoom-bar">
          <div class="camera-zoom-presets">
            <button type="button" class="cam-zoom-btn" data-zoom="0.6">0.6x</button>
            <button type="button" class="cam-zoom-btn" data-zoom="0.8">0.8x</button>
            <button type="button" class="cam-zoom-btn active" data-zoom="1.0">1.0x</button>
            <button type="button" class="cam-zoom-btn" data-zoom="2.0">2.0x</button>
          </div>
          <div class="camera-zoom-slider-row">
            <button type="button" class="btn btn-sm btn-link text-white p-0 text-decoration-none" id="btnZoomOut" title="Zoom Out" style="font-size: 1rem; line-height: 1;">
              <i class="bi bi-dash-circle"></i>
            </button>
            <input type="range" class="camera-zoom-slider" id="cameraZoomRange" min="0.6" max="3.0" step="0.1" value="1.0">
            <button type="button" class="btn btn-sm btn-link text-white p-0 text-decoration-none" id="btnZoomIn" title="Zoom In" style="font-size: 1rem; line-height: 1;">
              <i class="bi bi-plus-circle"></i>
            </button>
            <span class="camera-zoom-val-badge" id="zoomValBadge">1.0x</span>
          </div>
        </div>
      `;

      this.container.style.position = 'relative';
      this.container.appendChild(this.overlayEl);
      this.updateCamLabel();
    }

    bindEvents() {
      const btnTorch = this.overlayEl.querySelector('#btnCamTorch');
      if (btnTorch) {
        btnTorch.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleTorch();
        });
      }

      const btnSwitch = this.overlayEl.querySelector('#btnCamSwitch');
      if (btnSwitch) {
        btnSwitch.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.switchCamera();
        });
      }

      const presetBtns = this.overlayEl.querySelectorAll('.cam-zoom-btn');
      presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const z = parseFloat(btn.getAttribute('data-zoom'));
          this.setZoom(z);
        });
      });

      const rangeInput = this.overlayEl.querySelector('#cameraZoomRange');
      if (rangeInput) {
        rangeInput.addEventListener('input', (e) => {
          const z = parseFloat(e.target.value);
          this.setZoom(z, false);
        });
      }

      const btnZoomOut = this.overlayEl.querySelector('#btnZoomOut');
      if (btnZoomOut) {
        btnZoomOut.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.setZoom(Math.max(this.minZoom, Math.round((this.currentZoom - 0.2) * 10) / 10));
        });
      }

      const btnZoomIn = this.overlayEl.querySelector('#btnZoomIn');
      if (btnZoomIn) {
        btnZoomIn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.setZoom(Math.min(this.maxZoom, Math.round((this.currentZoom + 0.2) * 10) / 10));
        });
      }
    }

    updateRunningTrack() {
      try {
        const reader = document.getElementById(this.readerId);
        if (!reader) return;
        const video = reader.querySelector('video');
        if (video && video.srcObject) {
          const tracks = video.srcObject.getVideoTracks();
          if (tracks && tracks.length > 0) {
            this.videoTrack = tracks[0];
            const caps = typeof this.videoTrack.getCapabilities === 'function' ? this.videoTrack.getCapabilities() : {};
            this.hasHardwareTorch = !!caps.torch;
            this.hasHardwareZoom = !!caps.zoom;
            if (caps.zoom) {
              if (caps.zoom.min !== undefined && caps.zoom.min < 1) {
                this.minZoom = Math.max(0.5, caps.zoom.min);
              }
              if (caps.zoom.max !== undefined) {
                this.maxZoom = Math.min(5.0, caps.zoom.max);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Lỗi lấy capabilities của videoTrack:', e);
      }
    }

    async toggleTorch() {
      this.updateRunningTrack();
      this.isTorchOn = !this.isTorchOn;
      const btnTorch = this.overlayEl ? this.overlayEl.querySelector('#btnCamTorch') : null;

      try {
        if (this.videoTrack && this.hasHardwareTorch) {
          await this.videoTrack.applyConstraints({
            advanced: [{ torch: this.isTorchOn }]
          });
        } else if (this.html5QrCode && typeof this.html5QrCode.applyVideoConstraints === 'function') {
          await this.html5QrCode.applyVideoConstraints({
            advanced: [{ torch: this.isTorchOn }]
          });
        }
      } catch (err) {
        console.warn('Thiết bị không hỗ trợ bật Flash:', err);
        this.isTorchOn = false;
      }

      if (btnTorch) {
        if (this.isTorchOn) {
          btnTorch.classList.add('torch-active');
          btnTorch.querySelector('i').className = 'bi bi-lightning-charge-fill';
        } else {
          btnTorch.classList.remove('torch-active');
          btnTorch.querySelector('i').className = 'bi bi-lightning-charge';
        }
      }
    }

    async setZoom(zoomLevel, updateSlider = true) {
      this.updateRunningTrack();
      const z = Math.max(this.minZoom, Math.min(this.maxZoom, Math.round(zoomLevel * 10) / 10));
      this.currentZoom = z;

      // Update UI
      if (this.overlayEl) {
        const badge = this.overlayEl.querySelector('#zoomValBadge');
        if (badge) badge.textContent = `${z.toFixed(1)}x`;

        if (updateSlider) {
          const slider = this.overlayEl.querySelector('#cameraZoomRange');
          if (slider) slider.value = z;
        }

        const presetBtns = this.overlayEl.querySelectorAll('.cam-zoom-btn');
        presetBtns.forEach(btn => {
          const pz = parseFloat(btn.getAttribute('data-zoom'));
          if (Math.abs(pz - z) < 0.05) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      }

      // Check for ultra-wide camera switch if z <= 0.6 and we have multiple cameras
      if (z <= 0.6 && this.cameras.length > 1) {
        const wideIndex = this.cameras.findIndex(c => /wide|ultra|0\.6|góc rộng/i.test(c.label));
        if (wideIndex !== -1 && wideIndex !== this.currentCameraIndex) {
          this.currentCameraIndex = wideIndex;
          if (typeof this.onCameraChanged === 'function') {
            this.onCameraChanged(this.cameras[wideIndex].id);
            this.updateCamLabel();
            return;
          }
        }
      }

      // Apply Hardware Zoom
      let appliedHardware = false;
      try {
        if (this.videoTrack && this.hasHardwareZoom) {
          await this.videoTrack.applyConstraints({
            advanced: [{ zoom: z }]
          });
          appliedHardware = true;
        } else if (this.html5QrCode && typeof this.html5QrCode.applyVideoConstraints === 'function') {
          await this.html5QrCode.applyVideoConstraints({
            advanced: [{ zoom: z }]
          });
          appliedHardware = true;
        }
      } catch (e) {
        appliedHardware = false;
      }

      // Digital CSS Zoom fallback / combination
      const reader = document.getElementById(this.readerId);
      if (reader) {
        const video = reader.querySelector('video');
        if (video) {
          if (!appliedHardware || z < 1.0) {
            // Apply CSS scale
            video.style.transformOrigin = 'center center';
            video.style.transform = `scale(${z})`;
            video.style.transition = 'transform 0.15s ease-out';
          } else {
            video.style.transform = 'none';
          }
        }
      }
    }

    switchCamera() {
      if (!this.cameras || this.cameras.length <= 1) return;
      this.currentCameraIndex = (this.currentCameraIndex + 1) % this.cameras.length;
      const targetCam = this.cameras[this.currentCameraIndex];
      this.updateCamLabel();
      if (typeof this.onCameraChanged === 'function') {
        this.onCameraChanged(targetCam.id);
      }
    }

    updateCamLabel() {
      if (!this.overlayEl || !this.cameras || this.cameras.length === 0) return;
      const badge = this.overlayEl.querySelector('#camLabelBadge');
      if (badge) {
        const cam = this.cameras[this.currentCameraIndex];
        const label = cam ? (cam.label || `Cam ${this.currentCameraIndex + 1}`) : 'Đổi Cam';
        // Shorten label
        const shortLabel = label.length > 12 ? label.substring(0, 10) + '..' : label;
        badge.textContent = shortLabel;
      }
    }

    destroy() {
      if (this.overlayEl) {
        this.overlayEl.remove();
        this.overlayEl = null;
      }
      this.videoTrack = null;
    }
  }

  window.CameraController = CameraController;
})(window);
```

- [ ] **Step 2: Commit**

```bash
git add assets/js/core/camera-controller.js
git commit -m "feat: implement CameraController for auxiliary cameras, zoom, and torch"
```

---

### Task 3: Tích Hợp `CameraController` Vào Trang Kiểm Kê Tồn Kho (`kiem-ke.html` & `kiem-ke.js`)

**Files:**
- Modify: `pages/tem-nhan-kiem-ke/kiem-ke.html:30-40` (import camera-controller.js)
- Modify: `assets/js/tem-nhan-kiem-ke/kiem-ke.js:826-928`

- [ ] **Step 1: Import `camera-controller.js` trong `pages/tem-nhan-kiem-ke/kiem-ke.html`**

```html
<script src="../../assets/js/core/camera-controller.js"></script>
```

- [ ] **Step 2: Khởi tạo và liên kết `cameraController` trong `assets/js/tem-nhan-kiem-ke/kiem-ke.js`**

Khai báo biến `let cameraController = null;` và trong hàm `startCameraScanner(selectedDeviceId)`:
- Khởi tạo `cameraController = new CameraController(...)`
- Khi người dùng đổi camera: gọi lại `startCameraScanner(newDeviceId)` mượt mà.
- Khi đóng scanner (`stopCameraScanner`): gọi `cameraController.destroy()`.

- [ ] **Step 3: Commit**

```bash
git add pages/tem-nhan-kiem-ke/kiem-ke.html assets/js/tem-nhan-kiem-ke/kiem-ke.js
git commit -m "feat: integrate CameraController with zoom and torch into kiem-ke page"
```

---

### Task 4: Tích Hợp `CameraController` Vào Trang Tra Cứu Vị Trí Cuộn (`vi-tri-ton.html` & `vi-tri-ton.js`)

**Files:**
- Modify: `pages/tem-nhan-kiem-ke/vi-tri-ton.html`
- Modify: `assets/js/tem-nhan-kiem-ke/vi-tri-ton.js`

- [ ] **Step 1: Import `camera-controller.js` trong `pages/tem-nhan-kiem-ke/vi-tri-ton.html`**
- [ ] **Step 2: Khởi tạo và liên kết `cameraController` trong `assets/js/tem-nhan-kiem-ke/vi-tri-ton.js`**
- [ ] **Step 3: Commit**

```bash
git add pages/tem-nhan-kiem-ke/vi-tri-ton.html assets/js/tem-nhan-kiem-ke/vi-tri-ton.js
git commit -m "feat: integrate CameraController into vi-tri-ton page"
```

---

### Task 5: Đồng Bộ Toàn Bộ Sang `public/`, `dist/`, `dist-app/` & Kiểm Thử Toàn Diện

**Files:**
- Execute: `node scripts/sync-dist.js`

- [ ] **Step 1: Chạy script đồng bộ file `node scripts/sync-dist.js`**
- [ ] **Step 2: Kiểm tra cú pháp javascript và sự toàn vẹn của các file sau khi sync**
- [ ] **Step 3: Commit toàn bộ các thư mục phân phối `public/`, `dist/`, `dist-app/`**

```bash
git add .
git commit -m "chore: sync distribution files for camera controls upgrade"
```
