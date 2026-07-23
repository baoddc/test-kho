// Service Worker Registration & PWA Install Prompt
(function () {
  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.error('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // 2. Handle PWA Install Prompt
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
  });

  function showInstallPromotion() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0d6efd;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 99999;
      font-family: inherit;
    `;
    banner.innerHTML = `
      <span>📲 Cài đặt Ứng dụng Kho DDC</span>
      <button id="pwa-install-btn" style="background:white; color:#0d6efd; border:none; padding:6px 14px; border-radius:4px; font-weight:bold; cursor:pointer;">Cài đặt</button>
      <button id="pwa-close-btn" style="background:transparent; color:white; border:none; font-size:16px; cursor:pointer;">✕</button>
    `;

    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      banner.style.display = 'none';
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User choice outcome:', outcome);
        deferredPrompt = null;
      }
    });

    document.getElementById('pwa-close-btn').addEventListener('click', () => {
      banner.style.display = 'none';
    });
  }
})();
