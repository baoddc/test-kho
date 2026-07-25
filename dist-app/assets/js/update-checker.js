(function () {
  const CURRENT_VERSION = '1.0.0';
  window.APP_VERSION = CURRENT_VERSION;

  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  let isToastShown = false;

  function compareVersions(v1, v2) {
    const p1 = String(v1).split('.').map(Number);
    const p2 = String(v2).split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  function injectStyles() {
    if (document.getElementById('update-checker-styles')) return;
    const style = document.createElement('style');
    style.id = 'update-checker-styles';
    style.textContent = `
      .update-toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        max-width: 360px;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        padding: 18px 20px;
        color: #f8fafc;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.25);
        animation: updateToastSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      @keyframes updateToastSlideUp {
        from { opacity: 0; transform: translateY(30px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .update-toast-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      .update-toast-icon {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      }
      .update-toast-title {
        font-weight: 600;
        font-size: 15px;
        color: #ffffff;
      }
      .update-toast-body {
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.5;
        margin-bottom: 14px;
      }
      .update-toast-actions {
        display: flex;
        gap: 10px;
      }
      .btn-update-now {
        flex: 1;
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        color: #ffffff;
        border: none;
        padding: 9px 14px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      }
      .btn-update-now:hover {
        opacity: 0.95;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
      }
      .btn-update-dismiss {
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 9px 14px;
        border-radius: 10px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .btn-update-dismiss:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    `;
    document.head.appendChild(style);
  }

  function showUpdateToast(data) {
    if (isToastShown) return;
    isToastShown = true;
    injectStyles();

    const toast = document.createElement('div');
    toast.className = 'update-toast';
    toast.id = 'app-update-toast';
    toast.innerHTML = `
      <div class="update-toast-header">
        <div class="update-toast-icon">🚀</div>
        <div class="update-toast-title">Đã có phiên bản mới (v${data.version})</div>
      </div>
      <div class="update-toast-body">
        ${data.releaseNotes || 'Tính năng và giao diện đã được cập nhật.'}
      </div>
      <div class="update-toast-actions">
        <button class="btn-update-now" id="btnAppUpdateNow">⚡ Cập nhật ngay</button>
        <button class="btn-update-dismiss" id="btnAppUpdateDismiss">Bỏ qua</button>
      </div>
    `;

    document.body.appendChild(toast);

    document.getElementById('btnAppUpdateNow').addEventListener('click', () => {
      window.location.reload(true);
    });

    document.getElementById('btnAppUpdateDismiss').addEventListener('click', () => {
      toast.remove();
    });
  }

  async function checkUpdate() {
    try {
      const response = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.version && compareVersions(data.version, CURRENT_VERSION) > 0) {
        showUpdateToast(data);
      }
    } catch (err) {
      // Silently ignore network or offline errors
    }
  }

  function init() {
    setTimeout(checkUpdate, 3000);
    setInterval(checkUpdate, CHECK_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.initUpdateChecker = checkUpdate;
})();
