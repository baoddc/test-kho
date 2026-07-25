(function () {
  const CURRENT_VERSION = '1.0.0';
  window.APP_VERSION = CURRENT_VERSION;

  const SUPABASE_URL = 'https://ahcethtonjwktjtmxzog.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_zxmsB9cyjDwi9ai9Vw-s1w_QlqKMG0S';

  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  let isToastShown = false;
  let latestVersionData = null;
  let activeAnnouncements = [];
  let currentModalTab = 'announcements'; // 'announcements' | 'admin'

  async function ensureSupabaseClient() {
    if (window.supabase && typeof window.supabase.from === 'function') {
      return window.supabase;
    }
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return window.supabase;
    }

    if (!window._supabaseLoadingPromise) {
      window._supabaseLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => {
          if (window.supabase && typeof window.supabase.createClient === 'function') {
            window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            resolve(window.supabase);
          } else {
            reject(new Error('Supabase SDK loaded but createClient not found'));
          }
        };
        script.onerror = () => reject(new Error('Failed to load Supabase SDK from CDN'));
        document.head.appendChild(script);
      });
    }

    try {
      return await window._supabaseLoadingPromise;
    } catch (e) {
      console.warn('ensureSupabaseClient error:', e);
      return null;
    }
  }

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

  function getReadAnnouncementIds() {
    try {
      const stored = localStorage.getItem('read_announcements');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function markAnnouncementAsRead(id) {
    try {
      const ids = getReadAnnouncementIds();
      if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem('read_announcements', JSON.stringify(ids));
      }
    } catch (e) {}
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
      html[data-bs-theme="light"] .topbar-bell-btn,
      [data-bs-theme="light"] .topbar-bell-btn {
        background: rgba(15, 23, 42, 0.06);
        border: 1px solid rgba(15, 23, 42, 0.15);
        color: #334155;
      }
      html[data-bs-theme="light"] .topbar-bell-btn:hover,
      [data-bs-theme="light"] .topbar-bell-btn:hover {
        background: rgba(15, 23, 42, 0.12);
        color: #0f172a;
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
      html[data-bs-theme="light"] .topbar-bell-btn.has-update .bell-icon,
      [data-bs-theme="light"] .topbar-bell-btn.has-update .bell-icon {
        color: #d97706;
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
        max-width: 380px;
        width: calc(100vw - 48px);
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
        color: #cbd5e1;
        line-height: 1.5;
        margin-bottom: 14px;
        white-space: pre-wrap;
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

      /* System Announcement Badges & Admin Elements */
      .announcement-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .announcement-badge.maintenance {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.4);
      }
      .announcement-badge.update {
        background: rgba(139, 92, 246, 0.2);
        color: #c084fc;
        border: 1px solid rgba(139, 92, 246, 0.4);
      }
      .announcement-badge.info {
        background: rgba(59, 130, 246, 0.2);
        color: #93c5fd;
        border: 1px solid rgba(59, 130, 246, 0.4);
      }
      .announcement-badge.warning {
        background: rgba(245, 158, 11, 0.2);
        color: #fde047;
        border: 1px solid rgba(245, 158, 11, 0.4);
      }
    `;
    document.head.appendChild(style);
  }

  function getAnnouncementMeta(type) {
    switch (type) {
      case 'maintenance':
        return { icon: '🛠️', bg: 'linear-gradient(135deg, #ef4444, #b91c1c)', label: 'Bảo trì hệ thống' };
      case 'update':
        return { icon: '🚀', bg: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', label: 'Cập nhật tính năng' };
      case 'warning':
        return { icon: '⚠️', bg: 'linear-gradient(135deg, #f59e0b, #d97706)', label: 'Cảnh báo' };
      default:
        return { icon: '📢', bg: 'linear-gradient(135deg, #10b981, #059669)', label: 'Thông báo chung' };
    }
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Vừa xong';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
    return `${Math.floor(diffSec / 86400)} ngày trước`;
  }

  async function fetchAnnouncements() {
    try {
      const client = await ensureSupabaseClient();
      if (!client || typeof client.from !== 'function') return [];

      const currentUser = localStorage.getItem('currentUser');
      const isAdmin = currentUser === 'bao.lt';

      let query = client.from('system_announcements').select('*').order('created_at', { ascending: false });
      if (!isAdmin) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Failed to fetch announcements:', error);
        return [];
      }

      const now = new Date();
      const valid = (data || []).filter(item => {
        if (!isAdmin && !item.is_active) return false;
        if (item.expires_at && new Date(item.expires_at) <= now) return false;
        return true;
      });

      activeAnnouncements = valid;

      // Check unread announcements for bell indicator & toast
      const readIds = getReadAnnouncementIds();
      const unreadList = activeAnnouncements.filter(a => a.is_active && !readIds.includes(a.id));

      const hasAppUpdate = latestVersionData && compareVersions(latestVersionData.version, CURRENT_VERSION) > 0;
      updateBellUI(unreadList.length > 0 || hasAppUpdate);

      if (unreadList.length > 0 && !isToastShown) {
        showAnnouncementToast(unreadList[0]);
      }

      return activeAnnouncements;
    } catch (e) {
      console.warn('Error in fetchAnnouncements:', e);
      return [];
    }
  }

  function showAnnouncementToast(announcement) {
    if (isToastShown) return;
    isToastShown = true;
    injectStyles();

    const meta = getAnnouncementMeta(announcement.type);
    const toast = document.createElement('div');
    toast.className = 'update-toast';
    toast.id = 'system-announcement-toast';
    toast.innerHTML = `
      <div class="update-toast-header">
        <div class="update-toast-icon" style="background: ${meta.bg}">${meta.icon}</div>
        <div class="update-toast-title">${announcement.title}</div>
      </div>
      <div class="update-toast-body">${announcement.content}</div>
      <div class="update-toast-actions">
        <button class="btn-update-now" id="btnAnnouncementView">🔍 Xem chi tiết</button>
        <button class="btn-update-dismiss" id="btnAnnouncementDismiss">Bỏ qua</button>
      </div>
    `;

    document.body.appendChild(toast);

    document.getElementById('btnAnnouncementView').addEventListener('click', () => {
      markAnnouncementAsRead(announcement.id);
      toast.remove();
      showVersionModal();
    });

    document.getElementById('btnAnnouncementDismiss').addEventListener('click', () => {
      markAnnouncementAsRead(announcement.id);
      toast.remove();
    });
  }

  async function renderModalContent(modalContainer) {
    const currentUser = localStorage.getItem('currentUser');
    const isAdmin = currentUser === 'bao.lt';

    const hasNewVersion = latestVersionData && compareVersions(latestVersionData.version, CURRENT_VERSION) > 0;
    const serverVer = latestVersionData ? latestVersionData.version : CURRENT_VERSION;
    const notes = latestVersionData ? (latestVersionData.releaseNotes || 'Hệ thống Quản lý Kho Phôi Cuộn - DDC.') : 'Đã kết nối máy chủ phiên bản.';

    // Mark current active announcements as read when modal opens
    activeAnnouncements.forEach(a => markAnnouncementAsRead(a.id));
    updateBellUI(hasNewVersion);

    modalContainer.innerHTML = `
      <div style="
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 1.25rem;
        max-width: 520px;
        width: 100%;
        padding: 1.5rem;
        color: #f8fafc;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        position: relative;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
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

        <!-- Modal Header -->
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            flex-shrink: 0;
          ">🔔</div>
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Trung tâm Thông báo</h3>
            <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">DDC Kho - Phôi Cuộn System</p>
          </div>
        </div>

        <!-- Navigation Tabs (If Admin) -->
        ${isAdmin ? `
          <div style="
            display: flex;
            gap: 0.5rem;
            background: rgba(15, 23, 42, 0.6);
            padding: 4px;
            border-radius: 10px;
            margin-bottom: 1rem;
          ">
            <button id="tabBtnAnnouncements" style="
              flex: 1;
              padding: 7px 12px;
              border: none;
              border-radius: 8px;
              font-size: 0.85rem;
              font-weight: 600;
              cursor: pointer;
              background: ${currentModalTab === 'announcements' ? '#3b82f6' : 'transparent'};
              color: ${currentModalTab === 'announcements' ? '#ffffff' : '#94a3b8'};
              transition: all 0.2s ease;
            ">📢 Thông báo hệ thống</button>
            <button id="tabBtnAdmin" style="
              flex: 1;
              padding: 7px 12px;
              border: none;
              border-radius: 8px;
              font-size: 0.85rem;
              font-weight: 600;
              cursor: pointer;
              background: ${currentModalTab === 'admin' ? '#3b82f6' : 'transparent'};
              color: ${currentModalTab === 'admin' ? '#ffffff' : '#94a3b8'};
              transition: all 0.2s ease;
            ">⚙️ Quản lý (Admin bao.lt)</button>
          </div>
        ` : ''}

        <!-- Tab Body Container -->
        <div style="flex: 1; overflow-y: auto; padding-right: 4px;" id="modalTabContent">
          ${currentModalTab === 'admin' && isAdmin ? renderAdminTabHTML() : renderUserTabHTML(hasNewVersion, serverVer, notes)}
        </div>

        <!-- Modal Footer -->
        <div style="margin-top: 1rem; display: flex; justify-content: flex-end;">
          <button id="btnModalClose" style="
            background: rgba(255, 255, 255, 0.08);
            color: #cbd5e1;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 0.6rem 1.25rem;
            border-radius: 0.6rem;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
          ">Đóng</button>
        </div>
      </div>
    `;

    // Event Bindings
    modalContainer.querySelector('#close-version-modal').onclick = () => modalContainer.style.display = 'none';
    modalContainer.querySelector('#btnModalClose').onclick = () => modalContainer.style.display = 'none';
    modalContainer.onclick = (e) => { if (e.target === modalContainer) modalContainer.style.display = 'none'; };

    if (isAdmin) {
      const tabAnnBtn = modalContainer.querySelector('#tabBtnAnnouncements');
      const tabAdmBtn = modalContainer.querySelector('#tabBtnAdmin');
      if (tabAnnBtn && tabAdmBtn) {
        tabAnnBtn.onclick = () => {
          currentModalTab = 'announcements';
          renderModalContent(modalContainer);
        };
        tabAdmBtn.onclick = () => {
          currentModalTab = 'admin';
          renderModalContent(modalContainer);
        };
      }

      if (currentModalTab === 'admin') {
        bindAdminTabEvents(modalContainer);
      }
    }

    const updateBtn = modalContainer.querySelector('#btnModalUpdateNow');
    if (updateBtn) {
      updateBtn.onclick = () => window.location.reload(true);
    }
  }

  function renderUserTabHTML(hasNewVersion, serverVer, notes) {
    let announcementsHTML = '';
    if (activeAnnouncements.length === 0) {
      announcementsHTML = `
        <div style="text-align: center; color: #64748b; padding: 1.5rem 0; font-size: 0.85rem;">
          Không có thông báo hệ thống mới nào.
        </div>
      `;
    } else {
      announcementsHTML = activeAnnouncements.map(item => {
        const meta = getAnnouncementMeta(item.type);
        return `
          <div style="
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 0.75rem;
            padding: 0.85rem 1rem;
            margin-bottom: 0.75rem;
          ">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span class="announcement-badge ${item.type}">${meta.icon} ${meta.label}</span>
              <span style="font-size: 0.75rem; color: #64748b;">${formatTimeAgo(item.created_at)}</span>
            </div>
            <div style="font-weight: 600; font-size: 0.92rem; color: #f8fafc; margin-bottom: 0.25rem;">${item.title}</div>
            <div style="font-size: 0.83rem; color: #94a3b8; line-height: 1.5; white-space: pre-wrap;">${item.content}</div>
          </div>
        `;
      }).join('');
    }

    return `
      <!-- System Announcements Section -->
      <div style="margin-bottom: 1.25rem;">
        <div style="font-size: 0.85rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px;">
          📢 Thông báo từ Admin
        </div>
        ${announcementsHTML}
      </div>

      <!-- App Version Info Section -->
      <div style="
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0.75rem;
        padding: 0.85rem 1rem;
      ">
        <div style="font-size: 0.85rem; font-weight: 700; color: #94a3b8; margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px;">
          💻 Phiên bản ứng dụng
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.85rem;">
          <span style="color: #94a3b8;">Phiên bản hiện tại:</span>
          <strong style="color: #38bdf8;">v${CURRENT_VERSION}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem; font-size: 0.85rem;">
          <span style="color: #94a3b8;">Phiên bản máy chủ:</span>
          <strong style="color: ${hasNewVersion ? '#f59e0b' : '#10b981'};">v${serverVer}</strong>
        </div>
        ${hasNewVersion ? `
          <button id="btnModalUpdateNow" style="
            width: 100%;
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            color: white;
            border: none;
            padding: 0.6rem;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          ">⚡ Cập nhật ứng dụng ngay</button>
        ` : `
          <div style="
            padding: 0.35rem 0.6rem;
            border-radius: 0.4rem;
            font-size: 0.8rem;
            font-weight: 600;
            text-align: center;
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
          ">✅ Bạn đang sử dụng phiên bản mới nhất</div>
        `}
      </div>
    `;
  }

  function renderAdminTabHTML() {
    const listHTML = activeAnnouncements.length === 0 ? `
      <div style="text-align: center; color: #64748b; padding: 1rem 0; font-size: 0.85rem;">
        Chưa có thông báo nào trong hệ thống.
      </div>
    ` : activeAnnouncements.map(item => `
      <div style="
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0.6rem;
        padding: 0.75rem;
        margin-bottom: 0.6rem;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
      ">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <span class="announcement-badge ${item.type}">${item.type}</span>
            <span style="font-weight: 600; font-size: 0.88rem; color: #f8fafc;">${item.title}</span>
          </div>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.35rem; white-space: pre-wrap;">${item.content}</div>
          <div style="font-size: 0.72rem; color: #64748b;">Tạo lúc: ${new Date(item.created_at).toLocaleString('vi-VN')}</div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
          <button class="btnToggleActive" data-id="${item.id}" data-active="${item.is_active}" style="
            background: ${item.is_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
            color: ${item.is_active ? '#34d399' : '#fca5a5'};
            border: 1px solid ${item.is_active ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
          ">
            ${item.is_active ? '🟢 Đang bật' : '🔴 Tạm ẩn'}
          </button>
          <button class="btnDeleteAnnouncement" data-id="${item.id}" style="
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.3);
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            cursor: pointer;
          ">🗑️ Xóa</button>
        </div>
      </div>
    `).join('');

    return `
      <!-- Form Create Announcement -->
      <div style="
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0.75rem;
        padding: 1rem;
        margin-bottom: 1.25rem;
      ">
        <div style="font-size: 0.88rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.75rem;">
          ➕ Đăng thông báo mới (Admin bao.lt)
        </div>

        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.6rem;">
          <input type="text" id="adminAnnTitle" placeholder="Tiêu đề thông báo..." style="
            flex: 2;
            background: #0f172a;
            border: 1px solid #334155;
            color: #ffffff;
            padding: 0.5rem 0.75rem;
            border-radius: 0.5rem;
            font-size: 0.83rem;
          " />
          <select id="adminAnnType" style="
            flex: 1;
            background: #0f172a;
            border: 1px solid #334155;
            color: #ffffff;
            padding: 0.5rem 0.5rem;
            border-radius: 0.5rem;
            font-size: 0.83rem;
          ">
            <option value="maintenance">🛠️ Bảo trì</option>
            <option value="update">🚀 Cập nhật</option>
            <option value="info" selected>📢 Thông báo</option>
            <option value="warning">⚠️ Cảnh báo</option>
          </select>
        </div>

        <textarea id="adminAnnContent" rows="3" placeholder="Nội dung thông báo chi tiết..." style="
          width: 100%;
          background: #0f172a;
          border: 1px solid #334155;
          color: #ffffff;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.83rem;
          margin-bottom: 0.6rem;
          resize: vertical;
          box-sizing: border-box;
        "></textarea>

        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select id="adminAnnExpiry" style="
            flex: 1;
            background: #0f172a;
            border: 1px solid #334155;
            color: #ffffff;
            padding: 0.5rem 0.5rem;
            border-radius: 0.5rem;
            font-size: 0.83rem;
          ">
            <option value="0">Tự động ẩn: Không hết hạn</option>
            <option value="24">Tự động ẩn: Sau 24 giờ</option>
            <option value="72">Tự động ẩn: Sau 3 ngày</option>
            <option value="168">Tự động ẩn: Sau 7 ngày</option>
          </select>
          <button id="btnAdminCreateAnn" style="
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 0.83rem;
            cursor: pointer;
            white-space: nowrap;
          ">🚀 Đăng ngay</button>
        </div>
        <div id="adminAnnStatusMsg" style="font-size: 0.78rem; margin-top: 0.4rem; display: none;"></div>
      </div>

      <!-- Existing Announcements Management -->
      <div>
        <div style="font-size: 0.85rem; font-weight: 700; color: #94a3b8; margin-bottom: 0.5rem;">
          📋 Danh sách thông báo đã đăng
        </div>
        ${listHTML}
      </div>
    `;
  }

  function bindAdminTabEvents(modalContainer) {
    const btnCreate = modalContainer.querySelector('#btnAdminCreateAnn');
    const msgEl = modalContainer.querySelector('#adminAnnStatusMsg');

    if (btnCreate) {
      btnCreate.onclick = async () => {
        const title = modalContainer.querySelector('#adminAnnTitle').value.trim();
        const type = modalContainer.querySelector('#adminAnnType').value;
        const content = modalContainer.querySelector('#adminAnnContent').value.trim();
        const expiryHours = parseInt(modalContainer.querySelector('#adminAnnExpiry').value, 10);

        if (!title || !content) {
          msgEl.style.display = 'block';
          msgEl.style.color = '#f87171';
          msgEl.textContent = '❌ Vui lòng nhập tiêu đề và nội dung thông báo.';
          return;
        }

        btnCreate.disabled = true;
        btnCreate.textContent = '⏳ Đang đăng...';

        let expiresAt = null;
        if (expiryHours > 0) {
          expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000).toISOString();
        }

        try {
          const client = await ensureSupabaseClient();
          if (!client) throw new Error('Không thể kết nối Supabase SDK. Vui lòng kiểm tra kết nối mạng.');

          const { error } = await client.from('system_announcements').insert([{
            title,
            type,
            content,
            is_active: true,
            created_by: 'bao.lt',
            expires_at: expiresAt
          }]);

          if (error) throw error;

          msgEl.style.display = 'block';
          msgEl.style.color = '#34d399';
          msgEl.textContent = '✅ Đăng thông báo thành công!';

          await fetchAnnouncements();
          setTimeout(() => renderModalContent(modalContainer), 600);
        } catch (err) {
          msgEl.style.display = 'block';
          msgEl.style.color = '#f87171';
          msgEl.textContent = '❌ Lỗi khi đăng: ' + (err.message || err);
          btnCreate.disabled = false;
          btnCreate.textContent = '🚀 Đăng ngay';
        }
      };
    }

    modalContainer.querySelectorAll('.btnToggleActive').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const currentActive = btn.getAttribute('data-active') === 'true';
        btn.disabled = true;
        btn.textContent = '⏳...';

        try {
          const client = await ensureSupabaseClient();
          if (!client) throw new Error('Không thể kết nối Supabase SDK.');

          await client.from('system_announcements').update({ is_active: !currentActive }).eq('id', id);
          await fetchAnnouncements();
          renderModalContent(modalContainer);
        } catch (e) {
          alert('Lỗi cập nhật trạng thái: ' + (e.message || e));
        }
      };
    });

    modalContainer.querySelectorAll('.btnDeleteAnnouncement').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return;
        btn.disabled = true;

        try {
          const client = await ensureSupabaseClient();
          if (!client) throw new Error('Không thể kết nối Supabase SDK.');

          await client.from('system_announcements').delete().eq('id', id);
          await fetchAnnouncements();
          renderModalContent(modalContainer);
        } catch (e) {
          alert('Lỗi xóa thông báo: ' + (e.message || e));
        }
      };
    });
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

    modal.style.display = 'flex';
    renderModalContent(modal);
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
        <div class="update-toast-icon" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6)">🚀</div>
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
      bellBtn.title = 'Có thông báo mới / bản cập nhật!';
    } else {
      bellBtn.classList.remove('has-update');
      bellBtn.title = 'Thông báo hệ thống (v' + CURRENT_VERSION + ')';
    }
  }

  async function checkUpdate() {
    try {
      const response = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      latestVersionData = data;
      const hasAppUpdate = data && data.version && compareVersions(data.version, CURRENT_VERSION) > 0;
      if (hasAppUpdate) {
        updateBellUI(true);
        showUpdateToast(data);
      }
    } catch (err) {
      // Silently ignore network or offline errors
    }

    await fetchAnnouncements();
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

    checkUpdate();
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
