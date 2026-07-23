(function() {
  'use strict';

  let deferredPrompt = null;

  // Check if running as standalone app
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true ||
                       document.referrer.includes('android-app://');

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js')
        .then(function(registration) {
          console.log('[PWA] ServiceWorker registered with scope:', registration.scope);
        })
        .catch(function(error) {
          console.warn('[PWA] ServiceWorker registration failed:', error);
        });
    });
  }

  // Handle PWA Install Prompt
  window.addEventListener('beforeinstallprompt', function(e) {
    // Prevent default browser install banner
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt event captured');

    // Show Install UI element if available
    updateInstallButtonVisibility(true);
  });

  // Handle App Installed Event
  window.addEventListener('appinstalled', function() {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
    updateInstallButtonVisibility(false);
  });

  // Global function to trigger PWA installation
  window.installPWA = async function() {
    if (!deferredPrompt) {
      alert('Ứng dụng đã được cài đặt hoặc trình duyệt chưa sẵn sàng hỗ trợ cài đặt.');
      return;
    }
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    console.log('[PWA] User response to install prompt:', choiceResult.outcome);
    if (choiceResult.outcome === 'accepted') {
      deferredPrompt = null;
      updateInstallButtonVisibility(false);
    }
  };

  function updateInstallButtonVisibility(show) {
    if (isStandalone) {
      // Hide button if already installed and running as app
      const buttons = document.querySelectorAll('#pwa-install-btn, .pwa-install-btn');
      buttons.forEach(btn => btn.style.display = 'none');
      return;
    }

    const buttons = document.querySelectorAll('#pwa-install-btn, .pwa-install-btn');
    buttons.forEach(btn => {
      if (show) {
        btn.style.display = 'inline-flex';
        btn.onclick = window.installPWA;
      } else {
        btn.style.display = 'none';
      }
    });
  }

  // Initialize visibility check on DOM load
  document.addEventListener('DOMContentLoaded', function() {
    updateInstallButtonVisibility(deferredPrompt !== null);
  });
})();
