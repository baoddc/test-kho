/* =============================================================================
   UPDATE CHECKER & NOTIFICATION BELL
   Tự động kiểm tra phiên bản mới từ version.json, hiển thị Chuông Thông Báo 🔔 
   và hỗ trợ người dùng cập nhật ứng dụng 1-click.
   ============================================================================= */

(function () {
  'use strict';

  const CURRENT_APP_VERSION = '1.0.0'; // Version của bản build hiện tại
  let serverVersionInfo = null;

  // 1. Inject Styles cho Chuông & Modal Thông Báo
  function injectStyles() {
    const styleId = 'update-checker-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Update Bell Floating / Header Icon */
      .update-bell-container {
        position: fixed;
        top: 12px;
        right: 24px;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .update-bell-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0ea5e9, #2563eb);
        color: #ffffff;
        border: none;
        box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .update-bell-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 25px rgba(37, 99, 235, 0.6);
      }

      .update-bell-btn svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
      }

      /* Ringing animation when update is available */
      .update-bell-btn.has-update {
        background: linear-gradient(135deg, #f59e0b, #ef4444);
        box-shadow: 0 4px 20px rgba(239, 68, 68, 0.5);
        animation: bellRing 2s infinite ease-in-out;
      }

      @keyframes bellRing {
        0%, 100% { transform: rotate(0deg); }
        10%, 30%, 50% { transform: rotate(14deg); }
        20%, 40% { transform: rotate(-14deg); }
        60% { transform: rotate(0deg); }
      }

      .update-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        background-color: #dc2626;
        color: white;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 10px;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      }

      /* Update Toast Banner */
      .update-toast {
        position: fixed;
        top: 74px;
        right: 24px;
        background: #1e293b;
        color: #f8fafc;
        border: 1px solid #334155;
        border-left: 4px solid #10b981;
        padding: 12px 18px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 9998;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 340px;
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .update-toast-content {
        font-size: 13px;
        line-height: 1.4;
      }

      .update-toast-title {
        font-weight: 700;
        color: #38bdf8;
        margin-bottom: 2px;
      }

      .update-toast-btn {
        background: #0284c7;
        color: white;
        border: none;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  // 2. Tạo UI Chuông Thông Báo
  function renderBellUI() {
    if (document.getElementById('update-bell-container')) return;

    const container = document.createElement('div');
    container.id = 'update-bell-container';
    container.className = 'update-bell-container';

    container.innerHTML = `
      <button id="update-bell-btn" class="update-bell-btn" title="Thông tin phiên bản">
        <svg viewBox="0 0 24 24">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        <span id="update-badge" class="update-badge" style="display: none;">MỚI</span>
      </button>
    `;

    document.body.appendChild(container);

    document.getElementById('update-bell-btn').addEventListener('click', showUpdateModal);
  }

  // 3. Hiển thị Toast khi có bản mới
  function showUpdateToast(version) {
    if (document.getElementById('update-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'update-toast';
    toast.className = 'update-toast';
    toast.innerHTML = `
      <div class="update-toast-content">
        <div class="update-toast-title">🎉 Đã có phiên bản mới v${version}!</div>
        <div>Nhấn để cập nhật các tính năng và cải tiến mới nhất.</div>
        <button class="update-toast-btn" onclick="document.getElementById('update-bell-btn').click();">Xem & Cập nhật ngay</button>
      </div>
    `;
    document.body.appendChild(toast);
  }

  // 4. Hiển thị Modal Cập nhật
  function showUpdateModal() {
    const isNew = serverVersionInfo && serverVersionInfo.version !== CURRENT_APP_VERSION;
    const versionText = serverVersionInfo ? serverVersionInfo.version : CURRENT_APP_VERSION;
    const changelogList = (serverVersionInfo && serverVersionInfo.changelog)
      ? serverVersionInfo.changelog.map(item => `<li>${item}</li>`).join('')
      : '<li>Cập nhật hệ thống và sửa lỗi nhỏ.</li>';

    const modalId = 'update-info-modal';
    let existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();

    const modalHTML = `
      <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content text-start" style="border-radius: 16px; overflow: hidden; border: none;">
            <div class="modal-header ${isNew ? 'bg-warning text-dark' : 'bg-primary text-white'} p-4">
              <h5 class="modal-title fw-bold mb-0">
                ${isNew ? '🚀 Phát hiện Phiên bản Mới v' + versionText : 'ℹ️ Thông tin Phiên bản (v' + CURRENT_APP_VERSION + ')'}
              </h5>
              <button type="button" class="btn-close ${isNew ? '' : 'btn-close-white'}" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
              <p class="mb-2 text-secondary">
                ${isNew ? 'Phiên bản mới nhất đã sẵn sàng áp dụng:' : 'Bạn đang sử dụng phiên bản mới nhất của ứng dụng Kho DDC.'}
              </p>
              <div class="p-3 bg-body-tertiary rounded-3 mb-3">
                <h6 class="fw-bold mb-2">📌 Nội dung cập nhật (Changelog):</h6>
                <ul class="mb-0 ps-3 text-secondary" style="font-size: 14px;">
                  ${changelogList}
                </ul>
              </div>
              ${isNew ? '<div class="alert alert-info py-2 px-3 fs-6 mb-0">💡 Bấm nút bên dưới để tải lại và cập nhật ngay lập tức.</div>' : ''}
            </div>
            <div class="modal-footer bg-body-tertiary px-4 py-3">
              ${isNew ? `
                <button type="button" class="btn btn-secondary px-4" data-bs-dismiss="modal">Để sau</button>
                <button type="button" id="btn-apply-update" class="btn btn-success fw-bold px-4">⚡ Cập nhật ngay</button>
              ` : `
                <button type="button" class="btn btn-primary px-4" data-bs-dismiss="modal">Đóng</button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const bsModal = new bootstrap.Modal(document.getElementById(modalId));
    bsModal.show();

    const applyBtn = document.getElementById('btn-apply-update');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        applyBtn.disabled = true;
        applyBtn.innerHTML = '⌛ Đang cập nhật...';
        setTimeout(() => {
          window.location.reload(true);
        }, 500);
      });
    }
  }

  // 5. Kiểm tra phiên bản từ Server
  async function checkForUpdates() {
    try {
      const versionUrl = window.location.pathname.includes('/pages/') 
        ? '../version.json?t=' + Date.now() 
        : './version.json?t=' + Date.now();
      const res = await fetch(versionUrl);
      if (!res.ok) return;

      const data = await res.json();
      serverVersionInfo = data;

      if (data.version && data.version !== CURRENT_APP_VERSION) {
        console.log(`[UpdateChecker] New version available: v${data.version} (Current: v${CURRENT_APP_VERSION})`);
        
        const bellBtn = document.getElementById('update-bell-btn');
        const badge = document.getElementById('update-badge');

        if (bellBtn) bellBtn.classList.add('has-update');
        if (badge) badge.style.display = 'block';

        showUpdateToast(data.version);
      }
    } catch (err) {
      console.warn('[UpdateChecker] Cannot check version:', err.message);
    }
  }

  function init() {
    injectStyles();
    renderBellUI();
    checkForUpdates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
