(function() {
  'use strict';

  let deferredPrompt = null;
  let isAppInstalled = false;

  // Check if running as standalone app
  function checkIsStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
  }

  // Check if app is already installed on device
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

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js')
        .then(function(registration) {
          console.log('[PWA] ServiceWorker registered with scope:', registration.scope);
          checkAppInstalled();
        })
        .catch(function(error) {
          console.warn('[PWA] ServiceWorker registration failed:', error);
          checkAppInstalled();
        });
    });
  }

  // Handle PWA Install Prompt event from Chrome/Edge
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt event captured');
    updateInstallButton();
  });

  // Handle App Installed Event
  window.addEventListener('appinstalled', function() {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
    isAppInstalled = true;
    updateInstallButton();
  });

  // Global function to launch installed PWA app via protocol
  window.openInstalledPWA = function() {
    console.log('[PWA] Launching installed PWA app via custom protocol...');
    window.location.href = 'web+ddckho://open';
  };

  // Global function to trigger PWA installation or show instruction modal
  window.installPWA = async function() {
    if (isAppInstalled) {
      window.openInstalledPWA();
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      console.log('[PWA] User response to install prompt:', choiceResult.outcome);
      if (choiceResult.outcome === 'accepted') {
        deferredPrompt = null;
        isAppInstalled = true;
        updateInstallButton();
      }
    } else {
      showInstallInstructionsModal();
    }
  };

  function showInstallInstructionsModal() {
    // Check if modal already exists
    let modal = document.getElementById('pwa-install-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pwa-install-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        padding: 1rem;
      `;

      modal.innerHTML = `
        <div style="
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 1rem;
          max-width: 480px;
          width: 100%;
          padding: 1.75rem;
          color: #f8fafc;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          position: relative;
        ">
          <button id="close-pwa-modal" style="
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: transparent;
            border: none;
            color: #94a3b8;
            font-size: 1.5rem;
            cursor: pointer;
            line-height: 1;
          ">&times;</button>
          
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
            <img src="/assets/img/Logo-DDC.png" alt="DDC Logo" style="height: 44px; width: auto; object-fit: contain;">
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Cài đặt App DDC Kho</h3>
              <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">Hệ thống Quản lý Kho Phôi Cuộn</p>
            </div>
          </div>

          <div style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 1.25rem;">
            <p style="margin-bottom: 0.75rem;"><strong>Để cài đặt ứng dụng vào máy tính hoặc điện thoại:</strong></p>
            <ul style="padding-left: 1.25rem; margin: 0;">
              <li style="margin-bottom: 0.5rem;"><strong>Trình duyệt Chrome / Edge (Máy tính):</strong> Bấm vào biểu tượng <strong>Cài đặt App 📲</strong> hoặc dấu <strong>3 chấm ⋮</strong> ở góc phải thanh địa chỉ trình duyệt &rarr; Chọn <em>"Cài đặt DDC Kho..." (Install DDC Kho)</em>.</li>
              <li style="margin-bottom: 0.5rem;"><strong>Điện thoại Android (Chrome):</strong> Bấm nút <strong>3 chấm ⋮</strong> góc trên &rarr; Chọn <em>"Thêm vào màn hình chính" (Add to Home screen)</em>.</li>
              <li><strong>iPhone / iPad (Safari):</strong> Bấm nút <strong>Chia sẻ 📤</strong> ở chân trang &rarr; Chọn <em>"Thêm vào Màn hình chính" (Add to Home Screen)</em>.</li>
            </ul>
          </div>

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
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          ">🚀 Đã cài rồi? Mở App Ngay</button>

          <button id="pwa-modal-ok-btn" style="
            width: 100%;
            background: #2563eb;
            color: white;
            border: none;
            padding: 0.75rem;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
          ">Đã hiểu</button>
        </div>
      `;

      document.body.appendChild(modal);

      const closeModal = () => modal.style.display = 'none';
      modal.querySelector('#close-pwa-modal').onclick = closeModal;
      modal.querySelector('#pwa-modal-ok-btn').onclick = closeModal;
      modal.querySelector('#pwa-modal-open-btn').onclick = () => {
        closeModal();
        window.openInstalledPWA();
      };
      modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }

    modal.style.display = 'flex';
  }

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

  // Continuously check and sync button visibility
  function initInstallButtonController() {
    checkAppInstalled();
    updateInstallButton();
    // Re-check periodically in case sidebar is injected dynamically
    setInterval(updateInstallButton, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInstallButtonController);
  } else {
    initInstallButtonController();
  }
})();
