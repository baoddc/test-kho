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
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([250, 100, 250]); } catch (e) {}
    }
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

      html5QrCodeInstance = new Html5Qrcode('qrScannerReader', {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });
      const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        ...options
      };

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
          // ignore scan frame errors
        }
      ).then(() => {
        if (statusEl) statusEl.textContent = 'Camera sẵn sàng';
      }).catch((err) => {
        console.error('Camera scan error:', err);
        if (statusEl) statusEl.textContent = 'Không thể mở camera: ' + err;
      });
    }, 300);
  }

  function parseCoilBarcode(rawText) {
    if (!rawText) return null;
    const text = String(rawText).trim();
    if (!text) return null;

    // Split by '-'
    const parts = text.split('-').map(p => p.trim()).filter(Boolean);

    // 3 or more parts: MãVT - Batch - Kg (or batch with hyphens)
    if (parts.length >= 3) {
      const maVatTu = parts[0];
      const rawKg = parts[parts.length - 1];
      const batch = parts.slice(1, parts.length - 1).join('-');

      const sanitizedKg = rawKg.replace(',', '.');
      const kg = parseFloat(sanitizedKg);
      if (!isNaN(kg) && kg > 0) {
        return {
          maVatTu,
          batch,
          kg,
          rawText: text
        };
      }

      // If last part is not a number, treat everything after maVatTu as batch
      return {
        maVatTu,
        batch: parts.slice(1).join('-'),
        kg: null,
        rawText: text
      };
    }

    // 2 parts: MãVT - Batch
    if (parts.length === 2) {
      return {
        maVatTu: parts[0],
        batch: parts[1],
        kg: null,
        rawText: text
      };
    }

    return null;
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

  const serviceExport = {
    parseLocationQRCode,
    getAllStandardRacks,
    openQRCameraScanner,
    closeQRCameraScanner,
    parseCoilBarcode,
    playBeepSound
  };

  window.qrScannerService = serviceExport;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = serviceExport;
  }

})(typeof window !== 'undefined' ? window : globalThis);
