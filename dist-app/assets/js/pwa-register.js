(function() {
  'use strict';

  let deferredPrompt = null;
  let isAppInstalled = false;

  // Check if running as standalone app or Electron desktop app
  function checkIsStandalone() {
    const isElectron = /Electron/i.test(navigator.userAgent) ||
                       !!window.electron ||
                       (window.process && window.process.type === 'renderer') ||
                       window.location.protocol === 'file:';
    return isElectron ||
           window.matchMedia('(display-mode: standalone)').matches ||
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
    showInstallInstructionsModal();
  };

  // Configurable Android APK download link
  const ANDROID_APK_URL = '';

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
          max-width: 500px;
          width: 100%;
          padding: 1.5rem 1.75rem;
          color: #f8fafc;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          position: relative;
          font-family: inherit;
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
          
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
            <img src="/assets/img/Logo-DDC.png" alt="DDC Logo" style="height: 40px; width: auto; object-fit: contain;" onerror="this.style.display='none'">
            <div>
              <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700; color: #ffffff;">Tải Ứng Dụng DDC Kho</h3>
              <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">Hệ thống Quản lý Kho Phôi Cuộn</p>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.25rem;">
            <!-- Option 1: PC (.exe / .rar) -->
            <div style="
              background: rgba(30, 41, 59, 0.7);
              border: 1px solid #3b82f6;
              border-radius: 0.75rem;
              padding: 1rem;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 1rem;
              flex-wrap: wrap;
            ">
              <div style="display: flex; align-items: center; gap: 0.85rem;">
                <div style="
                  width: 44px;
                  height: 44px;
                  border-radius: 0.6rem;
                  background: rgba(59, 130, 246, 0.15);
                  color: #3b82f6;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 1.5rem;
                  flex-shrink: 0;
                ">🖥️</div>
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Dành cho PC (Windows)</div>
                  <div style="font-size: 0.8rem; color: #94a3b8;">Bản cài đặt .exe hoặc file nén .rar</div>
                </div>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <a href="/dist-app/release/H%E1%BB%99%20th%E1%BB%91ng%20Qu%E1%BA%A3n%20l%C3%BD%20Kho%20Ph%C3%B4i%20Cu%E1%BB%99n%20-%20DDC%20Setup%201.0.0.exe" download="Hệ thống Quản lý Kho Phôi Cuộn - DDC Setup 1.0.0.exe" id="pwa-download-pc-btn" style="
                  background: #2563eb;
                  color: white;
                  text-decoration: none;
                  padding: 0.55rem 0.85rem;
                  border-radius: 0.5rem;
                  font-weight: 600;
                  font-size: 0.82rem;
                  display: inline-flex;
                  align-items: center;
                  gap: 0.35rem;
                  white-space: nowrap;
                  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                ">📥 Tải .exe</a>
                <a href="/dist-app/release/H%E1%BB%99%20th%E1%BB%91ng%20Qu%E1%BA%A3n%20l%C3%BD%20Kho%20Ph%C3%B4i%20Cu%E1%BB%99n%20-%20DDC%20Setup%201.0.0.rar" download="Hệ thống Quản lý Kho Phôi Cuộn - DDC Setup 1.0.0.rar" id="pwa-download-rar-btn" style="
                  background: rgba(37, 99, 235, 0.15);
                  color: #60a5fa;
                  border: 1px solid #3b82f6;
                  text-decoration: none;
                  padding: 0.55rem 0.85rem;
                  border-radius: 0.5rem;
                  font-weight: 600;
                  font-size: 0.82rem;
                  display: inline-flex;
                  align-items: center;
                  gap: 0.35rem;
                  white-space: nowrap;
                " title="Dùng khi máy tính bị chặn tải file .exe">📦 Tải .rar</a>
              </div>
            </div>

            <!-- Option 2: Android (.apk) -->
            <div style="
              background: rgba(30, 41, 59, 0.7);
              border: 1px solid #10b981;
              border-radius: 0.75rem;
              padding: 1rem;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 1rem;
            ">
              <div style="display: flex; align-items: center; gap: 0.85rem;">
                <div style="
                  width: 44px;
                  height: 44px;
                  border-radius: 0.6rem;
                  background: rgba(16, 185, 129, 0.15);
                  color: #10b981;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 1.5rem;
                  flex-shrink: 0;
                ">📱</div>
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Dành cho Android</div>
                  <div style="font-size: 0.8rem; color: #94a3b8;">Bản cài đặt ứng dụng .apk</div>
                </div>
              </div>
              <button id="pwa-download-apk-btn" style="
                background: #059669;
                color: white;
                border: none;
                padding: 0.6rem 1rem;
                border-radius: 0.5rem;
                font-weight: 600;
                font-size: 0.85rem;
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
                cursor: pointer;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
              ">📥 Tải .apk</button>
          </div>

        </div>
      `;

      document.body.appendChild(modal);

      const closeModal = () => modal.style.display = 'none';
      modal.querySelector('#close-pwa-modal').onclick = closeModal;
      modal.onclick = (e) => { if (e.target === modal) closeModal(); };

      const apkBtn = modal.querySelector('#pwa-download-apk-btn');
      if (apkBtn) {
        apkBtn.onclick = function() {
          if (ANDROID_APK_URL && ANDROID_APK_URL !== '#') {
            window.location.href = ANDROID_APK_URL;
          } else {
            alert('File Android (.apk) đang được chuẩn bị và sẽ sớm phát hành!');
          }
        };
      }
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
