# Camera Haptic Feedback & Omnidirectional Scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm phản hồi rung (Haptic feedback 100ms) khi camera quét thành công và mở rộng khả năng quét đa hướng (cả hướng dọc lẫn ngang) cho tất cả các hệ thống camera trong ứng dụng.

**Architecture:** Sử dụng Web Vibration API (`navigator.vibrate(100)`) tích hợp cùng âm thanh bíp thành công; chuyển cấu hình vùng quét `qrbox` của `Html5Qrcode` sang dạng vuông linh hoạt và kích hoạt native `useBarCodeDetectorIfSupported: true` để giải mã mã vạch ở mọi góc quay.

**Tech Stack:** Vanilla JavaScript (ES6+), Html5Qrcode v2.3.8, HTML5 Web Audio API, Web Vibration API.

## Global Constraints
- Rung an toàn: luôn bọc try/catch kiểm tra `navigator.vibrate`.
- Khung quét: hỗ trợ xoay dọc và ngang mượt mà, không bị cắt góc.
- Đồng bộ: chạy `npm run build` sau khi sửa để sync ra `public/`, `dist/`, và `dist-app/`.

---

### Task 1: Thêm Haptic Feedback vào `kiem-ke-storage.js`

**Files:**
- Modify: `assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js:82-98`

**Interfaces:**
- Consumes: Web Vibration API `navigator.vibrate`
- Produces: `playBeepSuccess()` vừa phát âm thanh A5 vừa kích hoạt rung 100ms

- [ ] **Step 1: Viết mã rung trong `playBeepSuccess`**
Trong `assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js`, bổ sung `navigator.vibrate(100)`:
```javascript
  function playBeepSuccess() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(100); } catch (e) {}
    }
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 (trong trẻo)
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }
```

- [ ] **Step 2: Commit Task 1**
```bash
git add assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js
git commit -m "feat(kiem-ke): add haptic vibration feedback to playBeepSuccess"
```

---

### Task 2: Nâng cấp Camera Kiểm Kê Kho quét đa hướng & rung trong `kiem-ke.js`

**Files:**
- Modify: `assets/js/tem-nhan-kiem-ke/kiem-ke.js:838-885`

**Interfaces:**
- Consumes: `Html5Qrcode`, `playBeepSuccess`, `navigator.vibrate`
- Produces: Camera quét dọc/ngang linh hoạt với `qrbox` vuông và native BarcodeDetector

- [ ] **Step 1: Cập nhật cấu hình Html5Qrcode trong `startCameraScanner`**
Thay đổi `qrbox` sang hàm tính toán vuông thích ứng và thêm `experimentalFeatures`:
```javascript
        html5QrCodeScanner = new Html5Qrcode('cameraScannerReader', {
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
        const config = {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.72);
            return {
              width: Math.max(220, Math.min(edge, 300)),
              height: Math.max(220, Math.min(edge, 300))
            };
          },
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        };
```
Trong `onScanSuccess`, bổ sung thêm rung haptic trực tiếp:
```javascript
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(100); } catch (e) {}
          }
```

- [ ] **Step 2: Commit Task 2**
```bash
git add assets/js/tem-nhan-kiem-ke/kiem-ke.js
git commit -m "feat(kiem-ke): enable omnidirectional scanning and haptic buzz for inventory camera"
```

---

### Task 3: Nâng cấp Camera Gán Vị Trí Cuộn Thép trong `vi-tri-ton.js`

**Files:**
- Modify: `assets/js/tem-nhan-kiem-ke/vi-tri-ton.js:346-370`, `756-785`

**Interfaces:**
- Consumes: `Html5Qrcode`, `playBeepSoundLocal`
- Produces: Camera cuộn tồn quét dọc/ngang với `qrbox` vuông và rung haptic tin cậy

- [ ] **Step 1: Cập nhật `playBeepSoundLocal` có rung an toàn**
Bổ sung `navigator.vibrate(100)` vào `playBeepSoundLocal` trước khi phát beep.

- [ ] **Step 2: Cập nhật cấu hình camera trong `startCoilCameraScanner`**
Khởi tạo `Html5Qrcode` với `experimentalFeatures: { useBarCodeDetectorIfSupported: true }` và `qrbox` vuông linh hoạt. Trong callback nhận diện thành công gọi `navigator.vibrate(100)`.

- [ ] **Step 3: Commit Task 3**
```bash
git add assets/js/tem-nhan-kiem-ke/vi-tri-ton.js
git commit -m "feat(vi-tri-ton): add haptic vibration and omnidirectional scanning for coil camera"
```

---

### Task 4: Chuẩn hóa Haptic Feedback & BarcodeDetector trong `qr-scanner-service.js`

**Files:**
- Modify: `assets/js/core/qr-scanner-service.js:85-88`, `112-120`

**Interfaces:**
- Consumes: `Html5Qrcode`
- Produces: Rung 100ms chuẩn hóa và kích hoạt `useBarCodeDetectorIfSupported: true`

- [ ] **Step 1: Chuẩn hóa nhịp rung 100ms và cấu hình engine**
Trong `playBeepSound()`: `navigator.vibrate(100)`.
Trong `openQRCameraScanner()`: truyền `experimentalFeatures: { useBarCodeDetectorIfSupported: true }` cho instance và config.

- [ ] **Step 2: Commit Task 4**
```bash
git add assets/js/core/qr-scanner-service.js
git commit -m "feat(qr-scanner): standardize 100ms haptic buzz and native barcode detector"
```

---

### Task 5: Đồng bộ Bản Dựng & Xác Minh Toàn Hệ Thống

**Files:**
- Build: `scripts/sync-dist.js`
- Target: `public/`, `dist/`, `dist-app/`

- [ ] **Step 1: Chạy build đồng bộ**
Run: `npm run build`
Verify output files in `public/`, `dist/`, `dist-app/` match the source files.

- [ ] **Step 2: Kiểm tra cú pháp JavaScript**
Run: `node -c assets/js/tem-nhan-kiem-ke/kiem-ke.js`
Run: `node -c assets/js/tem-nhan-kiem-ke/kiem-ke-storage.js`
Run: `node -c assets/js/tem-nhan-kiem-ke/vi-tri-ton.js`
Run: `node -c assets/js/core/qr-scanner-service.js`

- [ ] **Step 3: Commit bản dựng đồng bộ**
```bash
git add public/ dist/ dist-app/
git commit -m "chore: sync omnidirectional and haptic scanner updates to dist directories"
```
