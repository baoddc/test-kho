/* =============================================================================
   SIDEBAR JAVASCRIPT
   Xử lý: toggle sidebar, chi tiết các tab, accordion submenus, active state, theme toggle (light/dark)
   ============================================================================= */

(function () {
  'use strict';

  // ============================================================
  // THEME INITIALIZATION
  // ============================================================

  // Auto load update-checker script for version notifications
  if (!document.getElementById('update-checker-script')) {
    const updateScript = document.createElement('script');
    updateScript.id = 'update-checker-script';
    updateScript.src = '/assets/js/update-checker.js';
    updateScript.defer = true;
    document.head.appendChild(updateScript);
  }

  const savedTheme = localStorage.getItem('ddc_theme') || 'dark';
  document.documentElement.setAttribute('data-bs-theme', savedTheme);

  // ============================================================
  // IFRAME DETECTION & PREPARATION
  // ============================================================

  let isTabIframe = false;
  try {
    isTabIframe = window.name === 'tab-iframe' || (window.frameElement && window.frameElement.classList.contains('tab-iframe'));
  } catch (e) {
    isTabIframe = false;
  }
  const isIframe = (window.self !== window.top) && isTabIframe;

  function ensureMobileCSS() {
    if (!document.querySelector('link[href*="mobile-responsive.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/assets/css/mobile-responsive.css';
      document.head.appendChild(link);
    }
  }

  function ensurePWATags() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#1e293b';
      document.head.appendChild(meta);
    }
    if (!document.querySelector('script[src*="pwa-register.js"]')) {
      const script = document.createElement('script');
      script.src = '/assets/js/pwa-register.js';
      script.defer = true;
      document.head.appendChild(script);
    }
  }

  function initTableSpaceSaver() {
    const isCollapsedSaved = localStorage.getItem('ddc_table_tools_collapsed') === 'true';

    const actionBars = document.querySelectorAll('.d-flex.align-items-center.gap-2.mb-2, .action-buttons, .button-group');

    actionBars.forEach(bar => {
      const btnCount = bar.querySelectorAll('.btn, button, a.btn').length;
      if (btnCount >= 2 && !bar.classList.contains('table-space-saver')) {
        bar.classList.add('table-space-saver');
        if (isCollapsedSaved) {
          bar.classList.add('is-collapsed');
        }

        const titleRow = document.querySelector('.d-flex.align-items-center.mb-2, h5.text-primary') || bar.parentElement;
        if (titleRow && !titleRow.querySelector('.btn-space-toggle')) {
          const toggleBtn = document.createElement('button');
          toggleBtn.className = 'btn-space-toggle ms-auto';
          toggleBtn.type = 'button';
          toggleBtn.innerHTML = isCollapsedSaved
            ? '<span>🛠️ Hiện công cụ</span>'
            : '<span>👁️ Ẩn công cụ</span>';

          toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const nowCollapsed = bar.classList.toggle('is-collapsed');
            localStorage.setItem('ddc_table_tools_collapsed', nowCollapsed ? 'true' : 'false');
            toggleBtn.innerHTML = nowCollapsed
              ? '<span>🛠️ Hiện công cụ</span>'
              : '<span>👁️ Ẩn công cụ</span>';
          });

          titleRow.appendChild(toggleBtn);
        }
      }
    });
  }

  function checkRoutePermissionInIframe() {
    const page = window.location.pathname;
    if (page.endsWith('dang_nhap.html') || page === '/' || page.endsWith('/index.html') || page.endsWith('home.html')) return;

    if (!isPageAllowed(page)) {
      // Vô hiệu hóa toàn bộ nút thao tác và ô nhập dữ liệu trên trang iframe lập tức
      document.querySelectorAll('.btn, button, input, select, textarea').forEach(el => {
        el.disabled = true;
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.3';
      });

      let overlay = document.getElementById('iframeAccessDeniedOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'iframeAccessDeniedOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#f8fafc;text-align:center;padding:20px;';
        overlay.innerHTML = `
          <div style="margin-bottom:1rem;color:#f59e0b;">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h4 style="font-weight:700;margin-bottom:0.5rem;color:#f8fafc;">Không có quyền truy cập</h4>
          <p style="color:#94a3b8;max-width:420px;line-height:1.5;margin-bottom:1.5rem;font-size:0.95rem;">Quyền truy cập trang này đã bị Quản trị viên thu hồi. Vui lòng quay lại Trang chủ.</p>
        `;
        document.body.appendChild(overlay);
      }

      showAccessDeniedModal('Rất tiếc! Tài khoản của bạn đã bị thu hồi quyền truy cập vào trang này.', () => {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'PERM_REVOKED', url: page }, '*');
        } else {
          window.location.href = '/pages/home.html';
        }
      });

      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'PERM_REVOKED', url: page }, '*');
      }
    }
  }

  if (isIframe) {
    document.body.classList.add('in-iframe');
    ensureMobileCSS();

    // Hide old horizontal header if it exists
    document.addEventListener('DOMContentLoaded', () => {
      ensureMobileCSS();
      initTableSpaceSaver();
      checkRoutePermissionInIframe();
      const header = document.querySelector('header');
      if (header) header.style.display = 'none';

      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.style.marginTop = '0';
        mainContent.style.marginLeft = '0';
        mainContent.style.paddingTop = '10px';
      }
    });

    // Đồng bộ kiểm tra lại quyền nếu localStorage thay đổi
    window.addEventListener('storage', (e) => {
      if (e.key === 'userAllowedPages' || e.key === 'userGroupPermissions') {
        checkRoutePermissionInIframe();
      }
    });

    // Đồng bộ định kỳ quyền từ máy chủ ngay trong iframe mỗi 2 giây
    setInterval(() => {
      reloadUserPermissionsAndSidebar();
      checkRoutePermissionInIframe();
    }, 2000);

    return; // Stop initialization of main shell sidebar
  }

  // ============================================================
  // TABS & THEME STATE
  // ============================================================

  let tabs = [];
  let activeTabId = 'tab-home';
  const SIDEBAR_COLLAPSED_KEY = 'ddc_sidebar_collapsed';

  // ============================================================
  // SVG ICONS
  // ============================================================

  const CHEVRON_SVG = `<svg class="sidebar-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  const SUN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-toggle-icon"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const MOON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-toggle-icon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  // ============================================================
  // HELPERS
  // ============================================================

  function getCurrentPage() {
    return window.location.pathname;
  }

  function isActive(href) {
    if (!href || href === '#') return false;
    const path = getCurrentPage();
    return path === href || path.endsWith(href) || href.endsWith(path.split('/').pop());
  }

  function isPageAllowed(href) {
    if (!href || href === '#' || href.startsWith('#') || href.startsWith('javascript:')) return true;
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return true;
    if (currentUser === 'bao.lt') return true;

    // Trang chủ mặc định luôn được phép
    if (href.endsWith('home.html')) return true;

    let allowedPages = [];
    try {
      allowedPages = JSON.parse(localStorage.getItem('userAllowedPages') || '[]');
    } catch (e) {
      allowedPages = [];
    }

    if (allowedPages.includes('*')) return true;

    let groupPerms = {};
    try {
      groupPerms = JSON.parse(localStorage.getItem('userGroupPermissions') || '{}');
    } catch (e) {
      groupPerms = {};
    }

    const cleanHref = href.split('?')[0];
    const hrefFile = cleanHref.split('/').pop().replace('.html', '').replace('-supabase', '');

    // 1. Kiểm tra xem trang có nằm trực tiếp trong allowedPages hay không
    const isDirectlyAllowed = Array.isArray(allowedPages) && allowedPages.some(page => {
      const cleanPage = page.split('?')[0];
      if (cleanHref === cleanPage || cleanHref.endsWith(cleanPage)) return true;

      const pageFile = cleanPage.split('/').pop().replace('.html', '').replace('-supabase', '');
      return hrefFile === pageFile;
    });

    if (isDirectlyAllowed) return true;

    // 2. Nếu không nằm trực tiếp trong allowedPages, kiểm tra theo quyền Nhóm (canView)
    if (cleanHref.includes('/xg/')) return !!(groupPerms.xg && groupPerms.xg.canView);
    if (cleanHref.includes('/tole/')) return !!(groupPerms.tole && groupPerms.tole.canView);
    if (cleanHref.includes('/5s/')) return !!(groupPerms['5s'] && groupPerms['5s'].canView);
    if (cleanHref.includes('/pl/')) return !!(groupPerms.pl && groupPerms.pl.canView);
    if (cleanHref.endsWith('cong-viec.html')) return !!(groupPerms.chung && groupPerms.chung.canView);
    if (cleanHref.endsWith('quan-ly-user.html')) return !!(groupPerms.admin && groupPerms.admin.canView);

    return false;
  }

  function showAccessDeniedModal(msg, onConfirm) {
    let modalEl = document.getElementById('accessDeniedModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'accessDeniedModal';
      modalEl.className = 'modal fade';
      modalEl.setAttribute('tabindex', '-1');
      modalEl.setAttribute('aria-hidden', 'true');
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content text-center p-4" style="background-color: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
            <div class="mb-3 text-warning">
              <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto; display: block;">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h5 class="fw-bold mb-2" style="color: #f8fafc; font-size: 1.15rem;">Không có quyền truy cập</h5>
            <p id="accessDeniedMsg" class="text-muted small mb-4" style="color: #94a3b8 !important; line-height: 1.5;">${msg || 'Rất tiếc! Bạn không có quyền truy cập trang này.'}</p>
            <div>
              <button type="button" id="btnConfirmAccessDenied" class="btn btn-primary px-3 py-2 fw-semibold" style="border-radius: 8px; width: 100%; font-size: 0.9rem;">
                Đồng ý / Quay về Trang chủ
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    } else {
      const msgEl = modalEl.querySelector('#accessDeniedMsg');
      if (msgEl) msgEl.textContent = msg || 'Rất tiếc! Bạn không có quyền truy cập trang này.';
    }

    const btnConfirm = modalEl.querySelector('#btnConfirmAccessDenied');
    
    // Check if bootstrap is available
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const bsModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
      btnConfirm.onclick = () => {
        bsModal.hide();
        if (typeof onConfirm === 'function') onConfirm();
      };
      bsModal.show();
    } else {
      alert(msg || 'Rất tiếc! Bạn không có quyền truy cập trang này.');
      if (typeof onConfirm === 'function') onConfirm();
    }
  }

  function checkRoutePermission() {
    const page = window.location.pathname;
    if (page.endsWith('dang_nhap.html') || page === '/' || page.endsWith('/index.html') || page.endsWith('home.html')) return;
    if (!isPageAllowed(page)) {
      setTimeout(() => {
        showAccessDeniedModal('Rất tiếc! Tài khoản của bạn chưa được cấp quyền truy cập vào trang này.', () => {
          window.location.href = '/pages/home.html';
        });
      }, 100);
    }
  }

  // ============================================================
  // BUILD SIDEBAR HTML
  // ============================================================

  const NAV_ITEMS = [
    {
      id: 'nav-5s',
      label: '5S',
      icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
      children: [
        { label: 'Sơ đồ kho Phôi cuộn', href: '/pages/5s/5s-so-do-phoi-cuon.html' },
        { label: 'Sơ đồ kho Phế liệu', href: '/pages/5s/5s-so-do-phe-lieu.html' },
        { label: 'HSE', href: '/pages/5s/hse.html' },
      ]
    },
    {
      id: 'nav-xg',
      label: 'XÀ GỒ',
      icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      children: [
        { label: 'Nhập - XG', href: '/pages/xg/xg-nhap.html' },
        { label: 'Xuất - XG', href: '/pages/xg/xg-xuat.html' },
        { label: 'Tồn - XG', href: '/pages/xg/xg-ton.html' },
        { label: 'Biểu đồ - XG', href: '/pages/xg/xg-bieu-do.html' },
      ]
    },
    {
      id: 'nav-tole',
      label: 'TOLE',
      icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
      children: [
        { label: 'Nhập - Tole', href: '/pages/tole/tole-nhap.html' },
        { label: 'Xuất - Tole', href: '/pages/tole/tole-xuat.html' },
        { label: 'Tồn - Tole', href: '/pages/tole/tole-ton.html' },
        { label: 'Biểu đồ - Tole', href: '/pages/tole/tole-bieu-do.html' },
      ]
    },
    {
      id: 'nav-grating',
      label: 'GRATING',
      href: '#grating',
      icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="8" y2="18"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="16" y1="6" x2="16" y2="18"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/></svg>`,
    },
    {
      id: 'nav-pl',
      label: 'PHẾ LIỆU',
      icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.34"/></svg>`,
      children: [
        {
          label: 'Nhận từ xưởng',
          id: 'nav-pl-nhanTuXuong',
          children: [
            { label: 'PL - Cần thu', href: '/pages/pl/pl-can-thu.html' },
            { label: 'PL - Đã thu', href: '/pages/pl/pl-da-thu.html' },
            { label: 'PL - Chưa thu', href: '/pages/pl/pl-chua-thu.html' },
          ]
        },
        { label: 'Xuất bán/Xuất trả', href: '/pages/pl/pl-phieu-in.html' },
      ]
    },
    {
      id: 'nav-about',
      label: 'GIỚI THIỆU',
      href: '/pages/about.html',
      icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    },
    {
      id: 'nav-cong-viec',
      label: 'CÔNG VIỆC & NHẮC HẸN',
      href: '/pages/cong-viec.html',
      icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg>`,
    },
    {
      id: 'nav-quan-ly-user',
      label: 'QUẢN LÝ NGƯỜI DÙNG',
      href: '/pages/quan-ly-user.html',
      onlyAdmin: true,
      icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>`,
    },
  ];

  function buildSubSubGroup(children, groupId) {
    const allowedChildren = children.filter(c => isPageAllowed(c.href));
    if (allowedChildren.length === 0) return null;

    const ul = document.createElement('ul');
    ul.className = 'sidebar-subsub-group';
    ul.id = groupId + '-sub';

    allowedChildren.forEach(child => {
      const li = document.createElement('li');
      li.className = 'sidebar-sub-item';
      const a = document.createElement('a');
      a.className = 'sidebar-subsub-link';
      a.href = child.href;
      a.textContent = child.label;
      if (isActive(child.href)) {
        a.classList.add('active');
      }
      li.appendChild(a);
      ul.appendChild(li);
    });
    return ul;
  }

  function buildSubGroup(children, groupId) {
    const ul = document.createElement('ul');
    ul.className = 'sidebar-group';
    ul.id = groupId;

    let hasActiveChild = false;
    let visibleChildCount = 0;

    children.forEach((child, i) => {
      if (child.children) {
        // Sub-group (level 3)
        const subId = groupId + '-sub' + i;
        const subGroup = buildSubSubGroup(child.children, subId);
        if (!subGroup || subGroup.children.length === 0) return;

        visibleChildCount++;
        const btn = document.createElement('button');
        btn.className = 'sidebar-sub-link';
        btn.innerHTML = child.label + CHEVRON_SVG;
        btn.setAttribute('aria-expanded', 'false');

        const subActive = child.children.some(sc => isActive(sc.href));
        if (subActive) {
          subGroup.classList.add('open');
          btn.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
          hasActiveChild = true;
        }

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const isOpen = subGroup.classList.contains('open');
          subGroup.classList.toggle('open', !isOpen);
          btn.classList.toggle('open', !isOpen);
          btn.setAttribute('aria-expanded', String(!isOpen));
        });

        const li = document.createElement('li');
        li.className = 'sidebar-sub-item';
        li.appendChild(btn);
        li.appendChild(subGroup);
        ul.appendChild(li);
      } else {
        if (!isPageAllowed(child.href)) return;

        visibleChildCount++;
        const li = document.createElement('li');
        li.className = 'sidebar-sub-item';
        const a = document.createElement('a');
        a.className = 'sidebar-sub-link';
        a.href = child.href;
        a.textContent = child.label;
        if (isActive(child.href)) {
          a.classList.add('active');
          hasActiveChild = true;
        }
        li.appendChild(a);
        ul.appendChild(li);
      }
    });

    return { ul, hasActiveChild, visibleChildCount };
  }

  function buildSidebarNav() {
    const nav = document.createElement('div');
    nav.className = 'sidebar-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');

    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.padding = '0';
    ul.style.margin = '0';

    NAV_ITEMS.forEach(item => {
      if (item.onlyAdmin && localStorage.getItem('currentUser') !== 'bao.lt') {
        return;
      }

      if (item.children) {
        // Collapsible group
        const groupId = item.id + '-group';
        const { ul: subUl, hasActiveChild, visibleChildCount } = buildSubGroup(item.children, groupId);
        if (visibleChildCount === 0) return;

        const li = document.createElement('li');
        li.className = 'sidebar-item';

        const btn = document.createElement('button');
        btn.className = 'sidebar-link';
        btn.innerHTML = item.icon + `<span>${item.label}</span>` + CHEVRON_SVG;
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', groupId);

        if (hasActiveChild) {
          subUl.classList.add('open');
          btn.classList.add('open', 'active');
          btn.setAttribute('aria-expanded', 'true');
        }

        btn.addEventListener('click', () => {
          const isOpen = subUl.classList.contains('open');
          subUl.classList.toggle('open', !isOpen);
          btn.classList.toggle('open', !isOpen);
          btn.setAttribute('aria-expanded', String(!isOpen));
        });

        li.appendChild(btn);
        li.appendChild(subUl);
        ul.appendChild(li);
      } else {
        if (!isPageAllowed(item.href)) return;

        const li = document.createElement('li');
        li.className = 'sidebar-item';

        // Simple nav link
        const a = document.createElement('a');
        a.className = 'sidebar-link';
        a.href = item.href || '#';
        a.innerHTML = item.icon + `<span>${item.label}</span>`;
        if (isActive(item.href)) {
          a.classList.add('active');
        }
        li.appendChild(a);
        ul.appendChild(li);
      }
    });

    nav.appendChild(ul);
    return nav;
  }

  // ============================================================
  // INJECT SIDEBAR INTO PAGE
  // ============================================================

  function injectSidebar() {
    if (document.querySelector('.sidebar')) return;

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.setAttribute('id', 'mainSidebar');
    sidebar.setAttribute('role', 'navigation');
    sidebar.setAttribute('aria-label', 'Sidebar navigation');

    // Header (logo)
    const header = document.createElement('a');
    header.className = 'sidebar-header';
    header.href = '/pages/home.html';
    header.setAttribute('title', 'DDC Kho');
    header.innerHTML = `
      <img src="/assets/img/Logo-DDC.png" alt="DDC Logo" class="sidebar-logo-img" style="height: 36px; width: auto; object-fit: contain;">
    `;
    sidebar.appendChild(header);

    // Nav
    sidebar.appendChild(buildSidebarNav());

    // Footer
    const footer = document.createElement('div');
    footer.className = 'sidebar-footer';

    const savedTheme = localStorage.getItem('ddc_theme') || 'dark';
    const themeIcon = savedTheme === 'light' ? MOON_SVG : SUN_SVG;
    const themeTitle = savedTheme === 'light' ? 'Chế độ tối' : 'Chế độ sáng';

    footer.innerHTML = `
      <div class="sidebar-footer-divider"></div>
      <div class="sidebar-pwa-box" style="padding: 0.5rem 0.25rem 0.75rem 0.25rem;">
        <button id="pwa-install-btn" class="sidebar-install-btn pwa-install-btn" style="
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #ffffff;
          border: 1px solid #3b82f6;
          border-radius: 0.6rem;
          padding: 0.65rem 0.75rem;
          font-weight: 600;
          font-size: 0.88rem;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
          transition: all 0.2s ease;
        ">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>📲 Cài đặt App DDC Kho</span>
        </button>
      </div>
      <div class="sidebar-footer-top">
        <div class="sidebar-user-badge">
          <div class="sidebar-user-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="sidebar-user-info">
            <span class="sidebar-user-label">Tài khoản</span>
            <span class="sidebar-user-name" id="currentUsername">...</span>
          </div>
        </div>
        <button class="sidebar-theme-btn" id="themeToggleBtn" aria-label="Toggle theme" title="${themeTitle}">
          ${themeIcon}
        </button>
      </div>
      <div class="sidebar-footer-bottom">
        <button id="btnLogout" class="sidebar-logout-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Đăng xuất</span>
        </button>
      </div>
      <p class="sidebar-footer-text">© 2026 DDC Kho</p>
    `;
    sidebar.appendChild(footer);

    const logoutBtn = sidebar.querySelector('#btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        performUserLogout();
      });
    }

    // Overlay (mobile)
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebarOverlay';

    document.body.insertBefore(overlay, document.body.firstChild);
    document.body.insertBefore(sidebar, overlay.nextSibling);
  }

  // ============================================================
  // INJECT TOPBAR
  // ============================================================

  function injectTopbar() {
    if (document.querySelector('.topbar')) return;

    const topbar = document.createElement('div');
    topbar.className = 'topbar';
    topbar.id = 'mainTopbar';

    const pageTitle = document.title || 'DDC Warehouse';

    topbar.innerHTML = `
      <button class="topbar-toggle" id="sidebarToggle" aria-label="Toggle sidebar" title="Toggle sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <span class="topbar-title">${pageTitle}</span>
      <div class="topbar-actions" style="display: flex; align-items: center; gap: 10px; margin-left: auto;">
        <button id="updateNotificationBell" class="topbar-bell-btn" title="Thông báo phiên bản" aria-label="Thông báo phiên bản">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bell-icon">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span class="bell-badge" id="updateBellBadge"></span>
        </button>
      </div>
    `;

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.insertAdjacentElement('afterend', topbar);
    } else {
      document.body.insertBefore(topbar, document.body.firstChild);
    }
  }

  // ============================================================
  // WRAP CONTENT & INIT MULTI-TAB
  // ============================================================

  function wrapContent() {
    if (document.querySelector('.main-wrapper')) return;

    const children = Array.from(document.body.children).filter(el => {
      return !el.classList.contains('sidebar') &&
        !el.classList.contains('topbar') &&
        !el.classList.contains('sidebar-overlay') &&
        el.tagName !== 'SCRIPT' &&
        el.id !== 'auth-modal';
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'main-wrapper';

    // Create tab-bar
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-bar';
    tabBar.id = 'mainTabBar';

    // Create tab-content container
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content-container';
    tabContent.id = 'mainTabContent';

    // Create initial pane for current page contents
    const homePane = document.createElement('div');
    homePane.className = 'tab-pane active';
    homePane.id = 'pane-tab-home';

    children.forEach(child => {
      homePane.appendChild(child);
    });

    tabContent.appendChild(homePane);
    wrapper.appendChild(tabBar);
    wrapper.appendChild(tabContent);

    document.body.appendChild(wrapper);

    // Register initial default tab
    tabs.push({
      id: 'tab-home',
      title: 'Trang chủ',
      url: window.location.pathname + window.location.search,
      paneEl: homePane,
      tabEl: null
    });

    initTabs();
  }

  // ============================================================
  // TAB FUNCTIONALITY
  // ============================================================

  function createTabElement(tab) {
    const tabBar = document.getElementById('mainTabBar');
    const tabEl = document.createElement('div');
    tabEl.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '');
    tabEl.setAttribute('data-tab-id', tab.id);

    const tabTitle = document.createElement('span');
    tabTitle.className = 'tab-item-title';
    tabTitle.textContent = tab.title;
    tabEl.appendChild(tabTitle);

    if (tab.id === 'tab-home') {
      tabEl.addEventListener('click', () => {
        switchTab(tab.id);
      });
    } else {
      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-item-close';
      closeBtn.innerHTML = '✕';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });
      tabEl.appendChild(closeBtn);

      // Make dynamic tabs draggable via Pointer Events
      tabEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return; // Only left click
        if (e.target.closest('.tab-item-close')) return;

        e.preventDefault();
        tabEl.setPointerCapture(e.pointerId);

        const startX = e.clientX;
        let hasMoved = false;

        const dynamicTabs = Array.from(tabBar.querySelectorAll('.tab-item:not([data-tab-id="tab-home"])'));
        const draggedIdx = dynamicTabs.indexOf(tabEl);

        const draggedWidth = tabEl.offsetWidth;
        const tabWidth = draggedWidth + 4;

        const initialOffsets = dynamicTabs.map(el => el.offsetLeft);
        const initialCenters = dynamicTabs.map((el, idx) => initialOffsets[idx] + el.offsetWidth / 2);

        tabEl.classList.add('dragging');

        dynamicTabs.forEach(sibling => {
          if (sibling !== tabEl) {
            sibling.classList.add('swapping');
          }
        });

        let currentClientX = startX;
        let rAFId = null;

        const updateDragPosition = () => {
          const deltaX = currentClientX - startX;

          tabEl.style.transform = `translateX(${deltaX}px)`;

          const draggedCenter = initialOffsets[draggedIdx] + draggedWidth / 2 + deltaX;

          dynamicTabs.forEach((sibling, i) => {
            if (sibling === tabEl) return;

            const siblingCenter = initialCenters[i];
            if (i > draggedIdx && draggedCenter > siblingCenter) {
              sibling.style.transform = `translateX(-${tabWidth}px)`;
            } else if (i < draggedIdx && draggedCenter < siblingCenter) {
              sibling.style.transform = `translateX(${tabWidth}px)`;
            } else {
              sibling.style.transform = '';
            }
          });

          rAFId = null;
        };

        const onPointerMove = (moveEvent) => {
          currentClientX = moveEvent.clientX;
          if (Math.abs(currentClientX - startX) > 4) {
            hasMoved = true;
          }

          if (!hasMoved) return;

          if (rAFId === null) {
            rAFId = requestAnimationFrame(updateDragPosition);
          }
        };

        const onPointerUp = (upEvent) => {
          tabEl.releasePointerCapture(upEvent.pointerId);
          tabEl.removeEventListener('pointermove', onPointerMove);
          tabEl.removeEventListener('pointerup', onPointerUp);
          tabEl.removeEventListener('pointercancel', onPointerUp);

          if (rAFId !== null) {
            cancelAnimationFrame(rAFId);
          }

          tabEl.classList.remove('dragging');

          if (hasMoved) {
            let finalIdx = draggedIdx;
            dynamicTabs.forEach((sibling, i) => {
              if (sibling === tabEl) return;
              const transform = sibling.style.transform;
              if (i > draggedIdx && transform.includes('-')) {
                finalIdx++;
              } else if (i < draggedIdx && transform && !transform.includes('-')) {
                finalIdx--;
              }
            });

            const targetSibling = dynamicTabs[finalIdx];
            if (finalIdx !== draggedIdx && targetSibling) {
              if (finalIdx > draggedIdx) {
                tabBar.insertBefore(tabEl, targetSibling.nextSibling);
              } else {
                tabBar.insertBefore(tabEl, targetSibling);
              }
            }
          }

          dynamicTabs.forEach(sibling => {
            sibling.classList.remove('swapping');
            sibling.style.transform = '';
          });
          tabEl.style.transform = '';

          const DOMTabs = Array.from(tabBar.querySelectorAll('.tab-item'));
          const newTabs = [];
          DOMTabs.forEach(el => {
            const id = el.getAttribute('data-tab-id');
            const found = tabs.find(t => t.id === id);
            if (found) newTabs.push(found);
          });
          tabs = newTabs;

          if (!hasMoved) {
            switchTab(tab.id);
          }
        };

        tabEl.addEventListener('pointermove', onPointerMove);
        tabEl.addEventListener('pointerup', onPointerUp);
        tabEl.addEventListener('pointercancel', onPointerUp);
      });
    }

    tab.tabEl = tabEl;
    return tabEl;
  }

  function initTabs() {
    const tabBar = document.getElementById('mainTabBar');
    if (!tabBar) return;

    tabBar.innerHTML = '';

    tabs.forEach(tab => {
      const tabEl = createTabElement(tab);
      tabBar.appendChild(tabEl);
    });
  }

  function switchTab(tabId) {
    const targetTab = tabs.find(t => t.id === tabId);
    if (!targetTab) return;

    activeTabId = tabId;

    tabs.forEach(tab => {
      if (tab.tabEl) {
        tab.tabEl.classList.toggle('active', tab.id === tabId);
      }
      if (tab.paneEl) {
        tab.paneEl.classList.toggle('active', tab.id === tabId);
      }
    });

    updateSidebarActiveState(targetTab.url);
  }

  function updateSidebarActiveState(url) {
    const cleanUrlPath = url.split('?')[0];

    document.querySelectorAll('.sidebar-link, .sidebar-sub-link, .sidebar-subsub-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href !== '#') {
        const cleanHrefPath = href.split('?')[0];
        const isMatch = cleanUrlPath === cleanHrefPath ||
          cleanUrlPath.endsWith(cleanHrefPath) ||
          cleanHrefPath.endsWith(cleanUrlPath.split('/').pop());

        link.classList.toggle('active', isMatch);

        if (isMatch) {
          let parent = link.parentElement;
          while (parent && !parent.classList.contains('sidebar-nav')) {
            if (parent.classList.contains('sidebar-group') || parent.classList.contains('sidebar-subsub-group')) {
              parent.classList.add('open');
              const toggleBtn = parent.previousElementSibling;
              if (toggleBtn && (toggleBtn.classList.contains('sidebar-link') || toggleBtn.classList.contains('sidebar-sub-link'))) {
                toggleBtn.classList.add('open');
                toggleBtn.setAttribute('aria-expanded', 'true');
              }
            }
            parent = parent.parentElement;
          }
        }
      }
    });
  }

  function openTab(url, title) {
    if (!isPageAllowed(url)) {
      showAccessDeniedModal('Rất tiếc! Tài khoản của bạn chưa được cấp quyền truy cập vào trang này.');
      return;
    }

    const normalizedUrl = url.startsWith('/') ? url : '/' + url;

    let existingTab = tabs.find(t => {
      const normTUrl = t.url.startsWith('/') ? t.url : '/' + t.url;
      return normTUrl.split('?')[0] === normalizedUrl.split('?')[0];
    });

    if (existingTab) {
      switchTab(existingTab.id);
      return;
    }

    const tabId = 'tab-' + Date.now();
    const tabContent = document.getElementById('mainTabContent');
    const tabBar = document.getElementById('mainTabBar');
    if (!tabContent || !tabBar) return;

    const paneEl = document.createElement('div');
    paneEl.className = 'tab-pane';
    paneEl.id = 'pane-' + tabId;

    const iframe = document.createElement('iframe');
    iframe.className = 'tab-iframe';
    iframe.name = 'tab-iframe';
    iframe.setAttribute('loading', 'lazy');
    iframe.src = url;
    iframe.setAttribute('frameborder', '0');

    const tabObj = {
      id: tabId,
      title: title,
      url: url,
      paneEl: paneEl,
      tabEl: null
    };

    iframe.addEventListener('load', () => {
      try {
        const currentTheme = localStorage.getItem('ddc_theme') || 'dark';
        if (iframe.contentDocument) {
          iframe.contentDocument.documentElement.setAttribute('data-bs-theme', currentTheme);
        }

        const currentUrl = iframe.contentWindow.location.pathname + iframe.contentWindow.location.search;
        tabObj.url = currentUrl;

        if (activeTabId === tabId) {
          updateSidebarActiveState(currentUrl);
        }
      } catch (e) {
        console.warn('Could not sync theme or URL to iframe on load', e);
      }
    });

    paneEl.appendChild(iframe);
    tabContent.appendChild(paneEl);

    const tabEl = createTabElement(tabObj);
    tabBar.appendChild(tabEl);

    tabs.push(tabObj);

    switchTab(tabId);
  }

  function closeTab(tabId) {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1 || tabId === 'tab-home') return;

    const tab = tabs[tabIndex];

    if (tab.paneEl) {
      const iframe = tab.paneEl.querySelector('iframe');
      if (iframe) {
        try {
          iframe.src = 'about:blank';
          if (iframe.contentWindow && iframe.contentWindow.document) {
            iframe.contentWindow.document.write('');
            iframe.contentWindow.close();
          }
        } catch (e) { }
      }
      tab.paneEl.remove();
    }

    if (tab.tabEl) tab.tabEl.remove();

    tabs.splice(tabIndex, 1);

    if (activeTabId === tabId) {
      const prevTab = tabs[Math.max(0, tabIndex - 1)];
      if (prevTab) {
        switchTab(prevTab.id);
      }
    }
  }

  // ============================================================
  // SIDEBAR LINK CLICK INTERCEPTION
  // ============================================================

  function initLinkInterception() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      const isSidebarLink = link.classList.contains('sidebar-link') ||
        link.classList.contains('sidebar-sub-link') ||
        link.classList.contains('sidebar-subsub-link');
      const isLogoLink = link.classList.contains('sidebar-header');

      if ((isSidebarLink || isLogoLink) && href && href !== '#' && !href.startsWith('javascript:')) {
        if (href.includes('home.html')) {
          e.preventDefault();
          switchTab('tab-home');
          return;
        }

        if (href.includes('/pages/') && !href.endsWith('index.html')) {
          e.preventDefault();

          let title = link.querySelector('span') ? link.querySelector('span').textContent : link.textContent;
          title = title.replace('✕', '').trim();

          openTab(href, title);
        }
      }
    });
  }

  // ============================================================
  // SIDEBAR TOGGLE
  // ============================================================

  function initToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('mainSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!toggle || !sidebar) return;

    const isMobile = () => window.innerWidth <= 768;

    toggle.addEventListener('click', () => {
      if (isMobile()) {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
      } else {
        const collapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
      }
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('active');
    });

    if (!isMobile()) {
      const wasCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
      if (wasCollapsed) {
        document.body.classList.add('sidebar-collapsed');
      }
    }

    window.addEventListener('resize', () => {
      if (!isMobile()) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
      }
    });
  }

  // ============================================================
  // THEME TOGGLE LOGIC
  // ============================================================

  function initThemeToggle() {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (!themeBtn) return;

    themeBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      setSystemTheme(newTheme);
    });
  }

  function setSystemTheme(theme) {
    // 1. Update shell theme
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('ddc_theme', theme);

    // 2. Update toggle button icon and title attribute
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'light' ? MOON_SVG : SUN_SVG;
      themeBtn.setAttribute('title', theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng');
    }

    // 3. Sync theme to all active open iframes
    document.querySelectorAll('.tab-iframe').forEach(iframe => {
      try {
        if (iframe.contentWindow && iframe.contentDocument) {
          iframe.contentDocument.documentElement.setAttribute('data-bs-theme', theme);
        }
      } catch (err) {
        console.warn('Could not sync theme to iframe due to cross-origin or load timing', err);
      }
    });
  }

  // ============================================================
  // REAL-TIME SIDEBAR PERMISSION RELOAD (NO PAGE REFRESH REQUIRED)
  // ============================================================

  function updateSidebarNav() {
    const sidebar = document.getElementById('mainSidebar');
    if (!sidebar) return;
    const oldNav = sidebar.querySelector('.sidebar-nav');
    if (oldNav) {
      const newNav = buildSidebarNav();
      sidebar.replaceChild(newNav, oldNav);
    }
  }

  function closeRevokedTabs() {
    const revokedTabs = tabs.filter(t => t.id !== 'tab-home' && !isPageAllowed(t.url));
    revokedTabs.forEach(t => {
      closeTab(t.id);
    });
  }

  async function fetchUserPermissionsFromSupabase(username) {
    const SUPABASE_URL = 'https://ahcethtonjwktjtmxzog.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_zxmsB9cyjDwi9ai9Vw-s1w_QlqKMG0S';
    
    // 1. Thử gọi RPC admin_get_users để bypass RLS
    try {
      const resRpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_get_users`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),
        cache: 'no-store'
      });
      if (resRpc.ok) {
        const users = await resRpc.json();
        if (Array.isArray(users)) {
          const matched = users.find(u => u.username === username);
          if (matched) return matched;
        }
      }
    } catch (e) {
      console.warn('Error fetching via RPC admin_get_users:', e);
    }

    // 2. Fallback: Trực tiếp qua REST Endpoint bảng users
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=allowed_pages,can_view,can_add,can_edit,can_delete`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        cache: 'no-store'
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data && data.length > 0) ? data[0] : null;
    } catch (e) {
      console.warn('Error fetching user perms via REST:', e);
      return null;
    }
  }

  function getPermChecksum(rawAllowed, sysPerms) {
    let pages = [];
    let groups = {};

    if (typeof rawAllowed === 'string') {
      try {
        rawAllowed = JSON.parse(rawAllowed);
      } catch (e) {}
    }

    if (Array.isArray(rawAllowed)) {
      pages = rawAllowed.slice().sort();
    } else if (rawAllowed && typeof rawAllowed === 'object') {
      pages = Array.isArray(rawAllowed.pages) ? rawAllowed.pages.slice().sort() : [];
      groups = rawAllowed.groups || {};
    }

    const sortedGroupsStr = Object.keys(groups).sort().map(k => {
      const g = groups[k] || {};
      return `${k}:${!!(g.canView || g.can_view)},${!!(g.canAdd || g.can_add)},${!!(g.canEdit || g.can_edit)},${!!(g.canDelete || g.can_delete)}`;
    }).join('|');

    const pagesStr = pages.join(',');
    const sysPermsStr = sysPerms ? `${!!(sysPerms.canView || sysPerms.can_view)},${!!(sysPerms.canAdd || sysPerms.can_add)},${!!(sysPerms.canEdit || sysPerms.can_edit)},${!!(sysPerms.canDelete || sysPerms.can_delete)}` : '';

    return `P:[${pagesStr}]|G:[${sortedGroupsStr}]|S:[${sysPermsStr}]`;
  }

  function performUserLogout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('userAllowedPages');
    localStorage.removeItem('userGroupPermissions');
    localStorage.removeItem('userPermHash');
    localStorage.removeItem('userPermChecksum');
    localStorage.setItem('userForceLoggedOut', Date.now().toString());

    const loginUrl = '/pages/dang_nhap.html';
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = loginUrl;
      } else {
        window.location.href = loginUrl;
      }
    } catch (e) {
      window.location.href = loginUrl;
    }
  }

  function forceLogoutUser(reason) {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser || currentUser === 'bao.lt') return;

    // Tự động nhấn nút Đăng xuất (#btnLogout) và đăng xuất tức thì không cần chờ thao tác thủ công
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout && typeof btnLogout.click === 'function') {
      btnLogout.click();
    }
    performUserLogout();
  }

  async function reloadUserPermissionsAndSidebar() {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser || currentUser === 'bao.lt') return;

    try {
      let data = await fetchUserPermissionsFromSupabase(currentUser);

      if (!data) {
        let client = null;
        if (typeof window.ensureSupabaseClient === 'function') {
          client = await window.ensureSupabaseClient();
        } else if (window.supabase && typeof window.supabase.from === 'function') {
          client = window.supabase;
        }

        if (client && typeof client.from === 'function') {
          const res = await client
            .from('users')
            .select('allowed_pages, can_view, can_add, can_edit, can_delete')
            .eq('username', currentUser)
            .single();
          if (!res.error && res.data) data = res.data;
        }
      }

      if (data) {
        let rawAllowed = data.allowed_pages;
        if (typeof rawAllowed === 'string') {
          try {
            rawAllowed = JSON.parse(rawAllowed);
          } catch (e) {}
        }

        // Tính toán Checksum chuẩn hóa của quyền hiện tại trên DB
        const serverChecksum = getPermChecksum(data.allowed_pages, data);
        const currentChecksum = localStorage.getItem('userPermChecksum');

        if (currentChecksum === null) {
          // Lần đầu khởi tạo checksum
          localStorage.setItem('userPermChecksum', serverChecksum);
        } else if (currentChecksum !== serverChecksum) {
          // QUYỀN TRUY CẬP ĐÃ THAY ĐỔI (CẤP THÊM HOẶC THU HỒI)!
          // NGAY LẬP TỨC ĐĂNG XUẤT THEO ĐÚNG YÊU CẦU CỦA KHÁCH HÀNG!
          forceLogoutUser('Quyền truy cập của bạn đã được Quản trị viên thay đổi. Vui lòng đăng nhập lại để áp dụng phân quyền mới!');
          return;
        }

        if (Array.isArray(rawAllowed)) {
          localStorage.setItem('userAllowedPages', JSON.stringify(rawAllowed));
          localStorage.removeItem('userGroupPermissions');
        } else if (rawAllowed && typeof rawAllowed === 'object') {
          localStorage.setItem('userAllowedPages', JSON.stringify(rawAllowed.pages || []));
          if (rawAllowed.groups) {
            localStorage.setItem('userGroupPermissions', JSON.stringify(rawAllowed.groups));
          } else {
            localStorage.removeItem('userGroupPermissions');
          }
        } else {
          localStorage.setItem('userAllowedPages', '[]');
          localStorage.removeItem('userGroupPermissions');
        }

        localStorage.setItem('userPermissions', JSON.stringify({
          canView: data.can_view,
          canAdd: data.can_add,
          canEdit: data.can_edit,
          canDelete: data.can_delete
        }));

        // Tái tạo thanh sidebar ngay lập tức không cần reload trang
        updateSidebarNav();

        // Đóng ngay các tab iframe đang mở của các trang bị thu hồi quyền
        closeRevokedTabs();

        // Kiểm tra nếu trang hiện tại bị thu hồi quyền thì cảnh báo & chuyển về Trang chủ
        checkRoutePermission();
      } else {
        // Tài khoản không còn tồn tại trên máy chủ Supabase (Đã bị Admin xóa)
        // TỰ ĐỘNG ĐĂNG XUẤT LẬP TỨC NGAY VỀ TRANG ĐĂNG NHẬP!
        forceLogoutUser('Tài khoản của bạn đã bị xóa khỏi hệ thống bởi Quản trị viên!');
        return;
      }
    } catch (e) {
      console.warn('Error reloading user permissions:', e);
    }
  }

  window.renderSidebarMenu = updateSidebarNav;
  window.reloadUserPermissionsAndSidebar = reloadUserPermissionsAndSidebar;
  window.forceLogoutUser = forceLogoutUser;

  // ============================================================
  // INITIALIZE
  // ============================================================

  function init() {
    checkRoutePermission();
    ensureMobileCSS();
    ensurePWATags();
    initTableSpaceSaver();
    injectSidebar();
    injectTopbar();
    wrapContent();
    initToggle();
    initLinkInterception();
    initThemeToggle();

    // Lắng nghe tín hiệu thu hồi quyền gửi từ iframe
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'PERM_REVOKED') {
        reloadUserPermissionsAndSidebar();
      }
    });

    // Lắng nghe sự kiện thay đổi localStorage trên cùng trình duyệt (đa tab)
    window.addEventListener('storage', (e) => {
      if (e.key === 'currentUser' && !e.newValue) {
        forceLogoutUser();
      } else if (e.key === 'userAllowedPages' || e.key === 'userGroupPermissions' || e.key === 'userPermissions') {
        updateSidebarNav();
        closeRevokedTabs();
      }
    });

    // Tự động đồng bộ quyền người dùng từ Supabase định kỳ (mỗi 3 giây)
    setInterval(() => {
      reloadUserPermissionsAndSidebar();
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
