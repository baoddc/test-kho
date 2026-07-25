(function () {
  const CURRENT_VERSION = '1.0.0';
  window.APP_VERSION = CURRENT_VERSION;

  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  let isToastShown = false;
  let latestVersionData = null;

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
      .topbar-bell-btn {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        color: #e2e8f0;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .topbar-bell-btn:hover {
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
        transform: translateY(-1px);
      }
      .topbar-bell-btn .bell-icon {
        width: 18px;
        height: 18px;
        transition: transform 0.2s ease;
      }
      .topbar-bell-btn.has-update .bell-icon {
        animation: bellRing 1.5s infinite ease-in-out;
        color: #f59e0b;
      }
      @keyframes bellRing {
        0%, 100% { transform: rotate(0); }
        10%, 30%, 50%, 70%, 90% { transform: rotate(12deg); }
        20%, 40%, 60%, 80% { transform: rotate(-12deg); }
      }
      .topbar-bell-btn .bell-badge {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 8px;
        height: 8px;
        background-color: #ef4444;
        border-radius: 50%;
        display: none;
        box-shadow: 0 0 8px #ef4444;
      }
      .topbar-bell-btn.has-update .bell-badge {
        display: block;
      }

      /* Update Toast */
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

  function showVersionModal() {
    injectStyles();
    let modal = document.getElementById('version-info-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'version-info-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        padding: 1rem;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      document.body.appendChild(modal);
    }

    const hasNewVersion = latestVersionData && compareVersions(latestVersionData.version, CURRENT_VERSION) > 0;
    const serverVer = latestVersionData ? latestVersionData.version : CURRENT_VERSION;
    const notes = latestVersionData ? (latestVersionData.releaseNotes || 'Hệ thống Quản lý Kho Phôi Cuộn - DDC.') : 'Đã kết nối máy chủ phiên bản.';

    modal.innerHTML = `
      <div style="
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 1.25rem;
        max-width: 440px;
        width: 100%;
        padding: 1.75rem;
        color: #f8fafc;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        position: relative;
      ">
        <button id="close-version-modal" style="
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
          <div style="
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
          ">🔔</div>
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Thông tin Phiên bản App</h3>
            <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">DDC Kho - Phôi Cuộn System</p>
          </div>
        </div>

        <div style="
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 1rem;
          margin-bottom: 1.25rem;
        ">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem;">
            <span style="color: #94a3b8;">Phiên bản hiện tại:</span>
            <strong style="color: #38bdf8;">v${CURRENT_VERSION}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.9rem;">
            <span style="color: #94a3b8;">Phiên bản máy chủ:</span>
            <strong style="color: ${hasNewVersion ? '#f59e0b' : '#10b981'};">v${serverVer}</strong>
          </div>
          <div style="
            padding: 0.4rem 0.75rem;
            border-radius: 0.5rem;
            font-size: 0.82rem;
            font-weight: 600;
            text-align: center;
            background: ${hasNewVersion ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'};
            color: ${hasNewVersion ? '#fbbf24' : '#34d399'};
            border: 1px solid ${hasNewVersion ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'};
          ">
            ${hasNewVersion ? '🚀 Đã có phiên bản mới sẵn sàng cập nhật!' : '✅ Bạn đang sử dụng phiên bản mới nhất'}
          </div>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <p style="margin: 0 0 0.4rem 0; font-size: 0.85rem; font-weight: 600; color: #cbd5e1;">Ghi chú cập nhật:</p>
          <div style="
            font-size: 0.85rem;
            color: #94a3b8;
            line-height: 1.5;
            background: rgba(15, 23, 42, 0.6);
            padding: 0.75rem;
            border-radius: 0.5rem;
            max-height: 100px;
            overflow-y: auto;
          ">${notes}</div>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          ${hasNewVersion ? `
            <button id="btnModalUpdateNow" style="
              flex: 1;
              background: linear-gradient(135deg, #2563eb, #7c3aed);
              color: white;
              border: none;
              padding: 0.75rem;
              border-radius: 0.6rem;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
            ">⚡ Cập nhật ngay</button>
          ` : `
            <button id="btnModalRecheck" style="
              flex: 1;
              background: #334155;
              color: white;
              border: none;
              padding: 0.75rem;
              border-radius: 0.6rem;
              font-weight: 600;
              cursor: pointer;
            ">🔄 Kiểm tra lại</button>
          `}
          <button id="btnModalClose" style="
            background: rgba(255, 255, 255, 0.08);
            color: #cbd5e1;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 0.75rem 1.25rem;
            border-radius: 0.6rem;
            font-weight: 600;
            cursor: pointer;
          ">Đóng</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const closeModal = () => modal.style.display = 'none';
    modal.querySelector('#close-version-modal').onclick = closeModal;
    modal.querySelector('#btnModalClose').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const updateBtn = modal.querySelector('#btnModalUpdateNow');
    if (updateBtn) {
      updateBtn.onclick = () => window.location.reload(true);
    }

    const recheckBtn = modal.querySelector('#btnModalRecheck');
    if (recheckBtn) {
      recheckBtn.onclick = async () => {
        recheckBtn.textContent = '⏳ Đang kiểm tra...';
        await checkUpdate();
        showVersionModal();
      };
    }
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

  function updateBellUI(hasUpdate) {
    const bellBtn = document.getElementById('updateNotificationBell');
    if (!bellBtn) return;
    if (hasUpdate) {
      bellBtn.classList.add('has-update');
      bellBtn.title = 'Đã có phiên bản mới! Bấm để cập nhật';
    } else {
      bellBtn.classList.remove('has-update');
      bellBtn.title = 'Thông báo phiên bản (v' + CURRENT_VERSION + ')';
    }
  }

  async function checkUpdate() {
    try {
      const response = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      latestVersionData = data;
      if (data && data.version && compareVersions(data.version, CURRENT_VERSION) > 0) {
        updateBellUI(true);
        showUpdateToast(data);
      } else {
        updateBellUI(false);
      }
    } catch (err) {
      // Silently ignore network or offline errors
    }
  }

  function bindBellEventListener() {
    const bellBtn = document.getElementById('updateNotificationBell');
    if (bellBtn && !bellBtn.__updateListenerAttached) {
      bellBtn.__updateListenerAttached = true;
      bellBtn.addEventListener('click', showVersionModal);
    }
  }

  function init() {
    injectStyles();
    bindBellEventListener();
    setInterval(bindBellEventListener, 1000);

    setTimeout(checkUpdate, 2000);
    setInterval(checkUpdate, CHECK_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.initUpdateChecker = checkUpdate;
  window.showVersionModal = showVersionModal;
})();
