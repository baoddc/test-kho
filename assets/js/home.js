/* =============================================================================
   AUTHENTICATION
   Kiểm tra và quản lý đăng nhập
   ================================================================================ */

// Kiểm tra xem đã đăng nhập chưa, nếu chưa thì quay về trang đăng nhập
const PUBLIC_PAGES = [
  'home.html',
  '5s-so-do-phoi-cuon.html',
  '5s-so-do-phe-lieu.html',
  'hse.html',
  'xg-nhap.html',
  'xg-xuat.html',
  'xg-ton.html',
  'tole-nhap.html',
  'tole-xuat.html',
  'tole-ton.html',
  'about.html'
];

/**
 * Handle restricted access attempts for guests
 * Shows alert and redirects to login page
 */
/**
 * Shows a premium centered modal for authentication required
 */
function showAuthModal() {
  // 1. Create Modal HTML if not exists
  let modal = document.getElementById('auth-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'custom-modal-backdrop';
    modal.innerHTML = `
      <div class="custom-modal-content">
        <div class="modal-premium-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M12 8v4"></path>
            <path d="M12 16h.01"></path>
          </svg>
        </div>
        <h3 class="modal-title">Yêu cầu đăng nhập</h3>
        <p class="modal-message">Bạn cần đăng nhập tài khoản để truy cập chức năng này và xem toàn bộ dữ liệu.</p>
        <div class="modal-actions">
          <button id="modal-cancel-btn" class="modal-btn btn-secondary">Quay lại</button>
          <button id="modal-login-btn" class="modal-btn btn-primary">Đăng nhập ngay</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Initial click handlers
    document.getElementById('modal-login-btn').onclick = () => {
      window.location.href = '/pages/index.html';
    };

    document.getElementById('modal-cancel-btn').onclick = () => {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';

      if (!PUBLIC_PAGES.includes(currentPage) && currentPage !== 'index.html') {
        window.location.href = '/pages/home.html';
      } else {
        modal.classList.remove('active');
      }
    };

    modal.onclick = (e) => {
      if (e.target === modal) {
        // Only allow closing if we aren't on a restricted page
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (PUBLIC_PAGES.includes(currentPage)) {
          modal.classList.remove('active');
        }
      }
    };
  }

  // 2. Inject Premium CSS if not exists
  if (!document.getElementById('auth-modal-style')) {
    const style = document.createElement('style');
    style.id = 'auth-modal-style';
    style.textContent = `
      .custom-modal-backdrop {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px);
        display: flex; align-items: center; justify-content: center; z-index: 99999;
        opacity: 0; visibility: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 20px;
      }
      .custom-modal-backdrop.active { opacity: 1; visibility: visible; }
      .custom-modal-content {
        background: #1e293b; border: 1px solid rgba(255,255,255,0.1); padding: 3rem 2.5rem;
        border-radius: 24px; width: 100%; max-width: 420px; text-align: center;
        transform: scale(0.9) translateY(20px); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      }
      .custom-modal-backdrop.active .custom-modal-content { transform: scale(1) translateY(0); }
      
      .modal-premium-icon {
        width: 70px; height: 70px; background: rgba(16, 185, 129, 0.1); color: #10b981;
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        margin: 0 auto 1.5rem; border: 1px solid rgba(16, 185, 129, 0.2);
      }
      .modal-premium-icon svg { width: 32px; height: 32px; }
      
      .modal-title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.75rem; letter-spacing: -0.5px; }
      .modal-message { color: #94a3b8; line-height: 1.6; margin-bottom: 2rem; font-size: 0.95rem; }
      
      .modal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      .modal-btn {
        padding: 0.85rem; border-radius: 12px; font-weight: 600; font-size: 0.9rem; cursor: pointer;
        transition: all 0.3s ease; border: none;
      }
      .btn-secondary { background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); }
      .btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; }
      
      .btn-primary { 
        background: linear-gradient(135deg, #10b981, #059669); color: #fff;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
      }
      .btn-primary:hover { 
        transform: translateY(-2px); 
        box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4); 
      }
    `;
    document.head.appendChild(style);
  }

  // 3. Show Modal
  setTimeout(() => modal.classList.add('active'), 10);
}

/**
 * Handle restricted access attempts for guests
 * Shows custom modal and manages flow
 */
function handleRestrictedAccess(e) {
  if (e) e.preventDefault();
  showAuthModal();
}

window.addEventListener('load', () => {
  if (window.self !== window.top) return;
  const currentUser = localStorage.getItem('currentUser');
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  if (!currentUser) {
    // 1. Check if CURRENT page is restricted
    if (!PUBLIC_PAGES.includes(currentPage) && currentPage !== 'index.html') {
      showAuthModal(); // Immediate show on landing
      return;
    }

    // 2. Intercept clicks to OTHER restricted pages
    setTimeout(() => {
      // Support both old nav links and new sidebar links
      document.querySelectorAll('nav a, .dropdown-menu a, .sidebar-link, .sidebar-sub-link, .sidebar-subsub-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes('/pages/') && !PUBLIC_PAGES.some(p => href.endsWith(p)) && !href.endsWith('index.html')) {
          link.addEventListener('click', handleRestrictedAccess);
        }
      });
    }, 300);
  }

  // Update UI for both logged-in and guest users
  const usernameEl = document.getElementById('currentUsername');
  if (usernameEl) {
    usernameEl.textContent = currentUser || 'Khách';
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    if (currentUser) {
      btnLogout.textContent = 'Đăng xuất';
      btnLogout.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.replace('/pages/index.html');
      });
    } else {
      btnLogout.textContent = 'Đăng nhập';
      // Support both old class and new topbar class
      if (btnLogout.classList.contains('btn-logout')) {
        btnLogout.className = 'btn-logout';
        btnLogout.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      } else if (btnLogout.classList.contains('topbar-logout')) {
        btnLogout.style.background = 'rgba(16,185,129,0.15)';
        btnLogout.style.borderColor = 'rgba(16,185,129,0.3)';
        btnLogout.style.color = '#6ee7b7';
      }
      btnLogout.addEventListener('click', () => {
        window.location.href = '/pages/index.html';
      });
    }
  }
});

/* =============================================================================
   DROPDOWN HIGHLIGHT FEATURE
   JavaScript-based highlight for parent dropdown when hovering on child items
   Provides better compatibility and smoother transitions
   ================================================================================ */

/**
 * Initialize dropdown highlight feature
 * Uses mouseenter/mouseleave for precise hover detection
 */
function initDropdownHighlight() {
  // Only apply on desktop (screen width > 768px)
  if (window.innerWidth <= 768) return;

  // Get all dropdown menus
  const dropdownMenus = document.querySelectorAll('.dropdown-menu');

  dropdownMenus.forEach(menu => {
    // Get the parent dropdown (level 1)
    const parentDropdown = menu.closest('.dropdown');
    if (!parentDropdown) return;

    // Get all direct child list items in this menu
    const listItems = menu.querySelectorAll(':scope > li');

    listItems.forEach(item => {
      // Mouseenter: Add highlight to parent
      item.addEventListener('mouseenter', () => {
        parentDropdown.classList.add('highlighted');

        // Also highlight level 2 parent if exists (for nested submenus)
        const level2Parent = item.closest('.dropdown-submenu');
        if (level2Parent && level2Parent !== parentDropdown) {
          level2Parent.classList.add('highlighted');
        }
      });

      // Mouseleave: Remove highlight from parent
      item.addEventListener('mouseleave', () => {
        parentDropdown.classList.remove('highlighted');

        // Remove highlight from level 2 parent
        const level2Parent = item.closest('.dropdown-submenu');
        if (level2Parent && level2Parent !== parentDropdown) {
          level2Parent.classList.remove('highlighted');
        }
      });
    });
  });
}

/**
 * Handle touch devices - use touchstart for mobile highlight
 */
function initTouchDropdownHighlight() {
  // Only apply on mobile/touch devices
  if (window.innerWidth > 768) return;

  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');

  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('touchstart', (e) => {
      const dropdown = toggle.closest('.dropdown');
      if (dropdown) {
        dropdown.classList.toggle('highlighted');
      }
    }, { passive: true });
  });
}

/**
 * Re-initialize highlight on window resize
 * Ensures feature works correctly when switching between mobile/desktop
 */
function handleResizeHighlight() {
  // Remove existing highlight classes on resize
  document.querySelectorAll('.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });

  // Re-initialize based on new screen size
  initDropdownHighlight();
  initTouchDropdownHighlight();
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  if (window.self !== window.top) return;
  initDropdownHighlight();
  initTouchDropdownHighlight();
  initARIAUpdates();

  // Re-init on resize with debounce
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResizeHighlight, 150);
  });
});

/**
 * Update ARIA attributes for accessibility
 * Handles aria-expanded state changes
 */
function initARIAUpdates() {
  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');

    if (toggle && menu) {
      // Desktop: Update aria-expanded on hover
      if (window.innerWidth > 768) {
        dropdown.addEventListener('mouseenter', () => {
          toggle.setAttribute('aria-expanded', 'true');
        });

        dropdown.addEventListener('mouseleave', () => {
          toggle.setAttribute('aria-expanded', 'false');
        });
      }

      // Mobile: Update aria-expanded on click
      toggle.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', !isExpanded);
        }
      });
    }
  });
}

/* =============================================================================
   HAMBURGER MENU & MOBILE NAVIGATION
   Xử lý menu hamburger và điều hướng trên mobile
   ================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (window.self !== window.top) return;
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');
  const dropdown5S = document.getElementById('5SDropdown');
  const xgDropdown = document.getElementById('xgDropdown');
  const toleDropdown = document.getElementById('toleDropdown');

  // Hamburger menu toggle
  if (hamburger && mainNav) {
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      hamburger.classList.toggle('active');
      mainNav.classList.toggle('active');
    });
  }

  // Dropdown click for mobile - 5S
  if (dropdown5S) {
    const dropdownToggle = dropdown5S.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          dropdown5S.classList.toggle('active');
        }
      });
    }
  }

  // Dropdown click for mobile
  if (xgDropdown) {
    const dropdownToggle = xgDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          xgDropdown.classList.toggle('active');
        }
      });
    }
  }

  // Dropdown click for mobile - Tole
  if (toleDropdown) {
    const dropdownToggle = toleDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          toleDropdown.classList.toggle('active');
        }
      });
    }
  }

  // Dropdown click for mobile - Phế liệu
  const plDropdown = document.getElementById('plDropdown');
  if (plDropdown) {
    const dropdownToggle = plDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          plDropdown.classList.toggle('active');
        }
      });
    }
  }

  // Dropdown click for mobile - Nhận từ xưởng (submenu under Phế liệu)
  const nhanTuXuong = document.getElementById('nhanTuXuong');
  if (nhanTuXuong) {
    nhanTuXuong.addEventListener('click', (e) => {
      // Only on mobile
      if (window.innerWidth <= 768) {
        e.preventDefault();
        e.stopPropagation();
        const submenu = nhanTuXuong.closest('.dropdown-submenu');
        if (submenu) {
          submenu.classList.toggle('active');
        }
      }
    });
  }

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (mainNav && !mainNav.contains(e.target) && !hamburger.contains(e.target)) {
        mainNav.classList.remove('active');
        hamburger.classList.remove('active');
      }
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && mainNav) {
      mainNav.classList.remove('active');
      hamburger.classList.remove('active');
    }
  });
});

// =============================================================================
// DDC VOICE ASSISTANT AUTO LOADER
// Tự động nhúng CSS và JS của trợ lý ảo vào các trang (trừ trang đăng nhập)
// =============================================================================
window.addEventListener('load', () => {
  // Không load trợ lý ảo nếu trang chạy bên trong iframe (để tránh lặp 2 nút trợ lý)
  if (window.self !== window.top) {
    return;
  }

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  if (currentPage === 'index.html' || currentPage === 'dang_nhap.html') {
    return;
  }

  // 1. Nhúng voice-assistant.css vào head
  if (!document.getElementById('voice-assistant-style')) {
    const link = document.createElement('link');
    link.id = 'voice-assistant-style';
    link.rel = 'stylesheet';
    link.href = '/assets/css/voice-assistant.css';
    document.head.appendChild(link);
  }

  // 2. Nhúng voice-assistant.js vào body
  if (!document.getElementById('voice-assistant-script')) {
    const script = document.createElement('script');
    script.id = 'voice-assistant-script';
    script.src = '/assets/js/voice-assistant.js';
    document.body.appendChild(script);
  }
});

// =============================================================================
// TABLE COLUMN FILTER SYSTEM (Google Sheets Style)
// =============================================================================
(function() {
  const ddcFilterState = {
    sortCol: null,         // number (index) or string (key)
    sortDir: null,         // 'asc' | 'desc'
    columnFilters: {},     // map of col -> Set of checked string values
    dateFilters: {},       // map of col -> { startStr: 'YYYY-MM-DD', endStr: 'YYYY-MM-DD' }
    lastRenderInput: null  // cache for original un-column-filtered/sorted data
  };

  let isPatched = false;

  function ddcInitMonkeyPatches() {
    const table = document.getElementById('dataTable');
    if (!table) return;

    const isPL = (typeof TABLE_COLUMNS !== 'undefined' && typeof COLUMN_DEFINITIONS !== 'undefined');
    const isXG = (typeof tableData !== 'undefined' && !isPL);

    if (!isPL && !isXG) return; // not on a data page yet or globals not ready

    if (isXG && typeof window.renderTable === 'function' && !window.renderTable.isWrapped) {
      if (typeof tableData !== 'undefined' && tableData && tableData.length > 0) {
        ddcFilterState.lastRenderInput = tableData;
      }
      const originalRenderTable = window.renderTable;
      window.renderTable = function(data, resetPage) {
        let rawData = data || tableData;
        if (rawData && rawData.length > 0) {
          ddcFilterState.lastRenderInput = rawData;
          
          const headerRow = rawData[0];
          let rowsToProcess = rawData.slice(1);
          
          // Apply column filters
          rowsToProcess = ddcApplyColumnFiltersXG(rowsToProcess, headerRow);
          
          // Apply sorting
          rowsToProcess = ddcApplySortingXG(rowsToProcess, headerRow);
          
          const processedData = [headerRow, ...rowsToProcess];
          originalRenderTable.call(this, processedData, resetPage);
        } else {
          originalRenderTable.call(this, data, resetPage);
        }
        
        // Inject filter icons
        ddcInjectFilterIcons(table, isPL);
      };
      window.renderTable.isWrapped = true;
      isPatched = true;
      console.log("Wrapped renderTable for XG/Tole successfully.");
    }
    
    if (isPL && typeof window.renderTable === 'function' && !window.renderTable.isWrapped) {
      if (typeof filteredData !== 'undefined' && filteredData && filteredData.length > 0) {
        ddcFilterState.lastRenderInput = filteredData;
      }
      const originalRenderTable = window.renderTable;
      window.renderTable = function() {
        const rawData = filteredData || [];
        if (rawData && rawData.length > 0) {
          ddcFilterState.lastRenderInput = rawData;
          
          // Apply column filters
          let processedData = ddcApplyColumnFiltersPL(rawData);
          
          // Apply sorting
          processedData = ddcApplySortingPL(processedData);
          
          const tempFiltered = filteredData;
          filteredData = processedData;
          
          originalRenderTable.apply(this, arguments);
          
          filteredData = tempFiltered;
        } else {
          originalRenderTable.apply(this, arguments);
        }
        
        // Inject filter icons
        ddcInjectFilterIcons(table, isPL);
      };
      window.renderTable.isWrapped = true;
      isPatched = true;
      console.log("Wrapped renderTable for PL successfully.");
    }

    // Hook low-level render functions to ensure filter icons are re-injected on pagination/re-rendering
    if (isXG) {
      if (typeof window.renderTableData === 'function' && !window.renderTableData.isWrapped) {
        const originalRenderTableData = window.renderTableData;
        window.renderTableData = function(data) {
          const result = originalRenderTableData.call(this, data);
          ddcInjectFilterIcons(table, isPL);
          return result;
        };
        window.renderTableData.isWrapped = true;
        console.log("Wrapped renderTableData for XG/Tole successfully.");
      }
    }

    if (isPL) {
      if (typeof window.renderTableBody === 'function' && !window.renderTableBody.isWrapped) {
        const originalRenderTableBody = window.renderTableBody;
        window.renderTableBody = function() {
          const result = originalRenderTableBody.apply(this, arguments);
          ddcInjectFilterIcons(table, isPL);
          return result;
        };
        window.renderTableBody.isWrapped = true;
        console.log("Wrapped renderTableBody for PL successfully.");
      }
      if (typeof window.renderTableData === 'function' && !window.renderTableData.isWrapped) {
        const originalRenderTableData = window.renderTableData;
        window.renderTableData = function(data) {
          const result = originalRenderTableData.call(this, data);
          ddcInjectFilterIcons(table, isPL);
          return result;
        };
        window.renderTableData.isWrapped = true;
        console.log("Wrapped renderTableData for PL successfully.");
      }
    }
    
    // Default to hidden or restored filters visibility
    if (!table.isFiltersInitialized) {
      const path = window.location.pathname;
      const visibleKey = 'ddc_filters_visible_' + path;
      const isVisible = localStorage.getItem(visibleKey) === 'true';
      if (isVisible) {
        table.classList.remove('filters-hidden');
      } else {
        table.classList.add('filters-hidden');
      }

      // Load saved filter criteria
      ddcLoadFilterStateFromStorage();

      table.isFiltersInitialized = true;

      if (ddcIsFilterActive() && ddcFilterState.lastRenderInput) {
        ddcTriggerReRender(isPL);
      }
    }

    // Hook reset filter
    const btnReset = document.getElementById('btnResetFilter');
    if (btnReset && !btnReset.isResetHooked) {
      btnReset.addEventListener('click', () => {
        ddcFilterState.sortCol = null;
        ddcFilterState.sortDir = null;
        ddcFilterState.columnFilters = {};
        ddcFilterState.dateFilters = {};
        ddcCloseDropdowns();

        // Clear saved filter criteria from localStorage
        const path = window.location.pathname;
        localStorage.removeItem('ddc_filter_criteria_' + path);

        // Re-render table with cleared filters
        ddcTriggerReRender(isPL);
      });
      btnReset.isResetHooked = true;
    }
  }

  // Helpers
  function ddcParseRowDate(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
    if (typeof raw === 'number') {
      if (raw > 0 && raw < 100000) {
        return new Date((raw - 25569) * 86400 * 1000);
      }
      return new Date(raw);
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      let parts = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (parts) {
        const day = parseInt(parts[1], 10);
        const month = parseInt(parts[2], 10) - 1;
        let year = parseInt(parts[3], 10);
        if (year < 100) year += year < 50 ? 2000 : 1900;
        return new Date(year, month, day);
      }
      parts = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (parts) {
        const year = parseInt(parts[1], 10);
        const month = parseInt(parts[2], 10) - 1;
        const day = parseInt(parts[3], 10);
        return new Date(year, month, day);
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  function ddcGetColumnHeaderFromTable(colKeyOrIdx, isPL) {
    const table = document.getElementById('dataTable');
    if (!table) return '';
    const theadThs = table.querySelectorAll('thead th');
    if (theadThs.length === 0) return '';
    
    const startIdx = (isPL || theadThs[0].querySelector('input[type="checkbox"]')) ? 1 : 0;
    
    // Check if there is a synthetic STT column
    let hasSyntheticSTT = false;
    if (!isPL && typeof tableData !== 'undefined' && tableData && tableData[0]) {
      const domDataColCount = theadThs.length - startIdx;
      const sheetColCount = tableData[0].length;
      if (domDataColCount > sheetColCount) {
        if (theadThs[startIdx] && theadThs[startIdx].textContent.trim().toUpperCase() === 'STT') {
          hasSyntheticSTT = true;
        }
      }
    }
    
    const shift = hasSyntheticSTT ? 1 : 0;
    const colIdx = isPL ? TABLE_COLUMNS.indexOf(colKeyOrIdx) : parseInt(colKeyOrIdx, 10);
    const targetIdx = colIdx + startIdx + shift;
    
    if (colIdx >= 0 && theadThs[targetIdx]) {
      const th = theadThs[targetIdx];
      const wrapper = th.querySelector('.ddc-th-wrapper');
      if (wrapper) {
        const clone = wrapper.cloneNode(true);
        const btn = clone.querySelector('.ddc-filter-btn');
        if (btn) btn.remove();
        return clone.textContent.trim();
      }
      return th.textContent.trim();
    }
    return '';
  }

  function ddcParseNumber(value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return value;
    
    let str = String(value).trim();
    if (str === '') return NaN;
    
    const hasComma = str.includes(',');
    const hasDot = str.includes('.');
    if (hasComma && hasDot) {
      if (str.indexOf('.') < str.indexOf(',')) {
        // Vietnamese locale e.g. 1.200,50
        str = str.replace(/\./g, '').replace(/,/g, '.');
      } else {
        // US locale e.g. 1,200.50
        str = str.replace(/,/g, '');
      }
    } else if (hasComma) {
      const parts = str.split(',');
      if (parts.length === 2 && parts[1].length !== 3) {
        str = str.replace(/,/g, '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (hasDot) {
      const parts = str.split('.');
      if (parts.length === 2 && (parts[1].match(/^\d{3}/) || parts[1].match(/^\d{3}\b/))) {
        str = str.replace(/\./g, '');
      }
    }
    
    str = str.replace(/[^0-9\.\-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? NaN : num;
  }

  function ddcGetFilteredRowsExcept(colKeyOrIdx, isPL) {
    if (!ddcFilterState.lastRenderInput || ddcFilterState.lastRenderInput.length === 0) return [];
    
    let rows = isPL ? ddcFilterState.lastRenderInput : ddcFilterState.lastRenderInput.slice(1);
    
    // 1. Apply column checkbox filters (except current column)
    Object.keys(ddcFilterState.columnFilters).forEach(key => {
      if (key === String(colKeyOrIdx)) return; // Skip current column
      const allowedSet = ddcFilterState.columnFilters[key];
      if (allowedSet) {
        rows = rows.filter(row => {
          const valStr = ddcGetCellString(row, key, isPL);
          return allowedSet.has(valStr);
        });
      }
    });
    
    // 2. Apply date range filters (except current column)
    Object.keys(ddcFilterState.dateFilters).forEach(key => {
      if (key === String(colKeyOrIdx)) return; // Skip current column
      const range = ddcFilterState.dateFilters[key];
      if (range) {
        const start = ddcParseLocalISO(range.startStr);
        const end = ddcParseLocalISO(range.endStr);
        if (start) start.setHours(0,0,0,0);
        if (end) end.setHours(23,59,59,999);
        
        rows = rows.filter(row => {
          const cellVal = isPL ? row[key] : row[parseInt(key, 10)];
          const cellDate = ddcParseRowDate(cellVal);
          if (!cellDate || isNaN(cellDate.getTime())) return false;
          if (start && cellDate < start) return false;
          if (end && cellDate > end) return false;
          return true;
        });
      }
    });
    
    return rows;
  }

  function ddcCompare(a, b, colKeyOrIdx, isPL) {
    let valA = isPL ? a[colKeyOrIdx] : a[colKeyOrIdx];
    let valB = isPL ? b[colKeyOrIdx] : b[colKeyOrIdx];
    
    const aEmpty = valA === null || valA === undefined || String(valA).trim() === '';
    const bEmpty = valB === null || valB === undefined || String(valB).trim() === '';
    
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    const headerText = ddcGetColumnHeaderFromTable(colKeyOrIdx, isPL).toLowerCase();
    const isStrictNumeric = headerText.includes('thời gian lưu kho') || 
                            headerText.includes('khối lượng') || 
                            headerText.includes('trọng lượng') || 
                            headerText.includes('số lượng') || 
                            headerText.includes('id') || 
                            headerText.includes('stt') || 
                            headerText === 'stt';

    if (isStrictNumeric) {
      const numA = ddcParseNumber(valA);
      const numB = ddcParseNumber(valB);
      const aNan = isNaN(numA);
      const bNan = isNaN(numB);
      if (aNan && bNan) return 0;
      if (aNan) return 1;
      if (bNan) return -1;
      return numA - numB;
    }

    let dateA = ddcParseRowDate(valA);
    let dateB = ddcParseRowDate(valB);
    if (dateA && dateB && !isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
      return dateA - dateB;
    }

    let cleanA = String(valA).replace(/,/g, '').replace(/ kg/gi, '').trim();
    let cleanB = String(valB).replace(/,/g, '').replace(/ kg/gi, '').trim();
    let numA = parseFloat(cleanA);
    let numB = parseFloat(cleanB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }

    const strA = String(valA).trim().toLowerCase();
    const strB = String(valB).trim().toLowerCase();
    return strA.localeCompare(strB, 'vi');
  }

  function ddcGetCellString(row, colKeyOrIdx, isPL) {
    let val = isPL ? row[colKeyOrIdx] : row[colKeyOrIdx];
    if (isPL) {
      if (colKeyOrIdx === 'soluong' && val !== null && val !== undefined) {
        if (typeof formatNumber === 'function') return formatNumber(val);
      }
      if (colKeyOrIdx === 'ngay' && val !== null && val !== undefined) {
        if (typeof formatDate === 'function') return formatDate(val);
      }
    } else {
      const colIdx = parseInt(colKeyOrIdx, 10);
      if (colIdx === 2 && val !== null && val !== undefined) {
        if (typeof formatDate === 'function') return formatDate(val);
      }
    }
    return val === null || val === undefined ? '' : String(val).trim();
  }

  function ddcParseLocalISO(str) {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return null;
  }

  function ddcApplyColumnFiltersXG(rows, header) {
    let filtered = [...rows];
    
    // Checkboxes
    Object.keys(ddcFilterState.columnFilters).forEach(colIdxKey => {
      const colIdx = parseInt(colIdxKey, 10);
      const allowedSet = ddcFilterState.columnFilters[colIdxKey];
      if (allowedSet) {
        filtered = filtered.filter(row => {
          const valStr = ddcGetCellString(row, colIdx, false);
          return allowedSet.has(valStr);
        });
      }
    });

    // Date range
    Object.keys(ddcFilterState.dateFilters).forEach(colIdxKey => {
      const colIdx = parseInt(colIdxKey, 10);
      const range = ddcFilterState.dateFilters[colIdxKey];
      if (range) {
        const start = ddcParseLocalISO(range.startStr);
        const end = ddcParseLocalISO(range.endStr);
        if (start) start.setHours(0,0,0,0);
        if (end) end.setHours(23,59,59,999);
        
        filtered = filtered.filter(row => {
          const cellVal = row[colIdx];
          const cellDate = ddcParseRowDate(cellVal);
          if (!cellDate || isNaN(cellDate.getTime())) return false;
          if (start && cellDate < start) return false;
          if (end && cellDate > end) return false;
          return true;
        });
      }
    });

    return filtered;
  }

  function ddcApplySortingXG(rows, header) {
    if (ddcFilterState.sortCol === null || !ddcFilterState.sortDir) {
      return rows;
    }
    const colIdx = parseInt(ddcFilterState.sortCol, 10);
    const dir = ddcFilterState.sortDir;
    const sorted = [...rows];
    sorted.sort((rowA, rowB) => {
      const comp = ddcCompare(rowA, rowB, colIdx, false);
      return dir === 'asc' ? comp : -comp;
    });
    return sorted;
  }

  function ddcApplyColumnFiltersPL(rows) {
    let filtered = [...rows];
    
    // Checkboxes
    Object.keys(ddcFilterState.columnFilters).forEach(colKey => {
      const allowedSet = ddcFilterState.columnFilters[colKey];
      if (allowedSet) {
        filtered = filtered.filter(row => {
          const valStr = ddcGetCellString(row, colKey, true);
          return allowedSet.has(valStr);
        });
      }
    });

    // Date range
    Object.keys(ddcFilterState.dateFilters).forEach(colKey => {
      const range = ddcFilterState.dateFilters[colKey];
      if (range) {
        const start = ddcParseLocalISO(range.startStr);
        const end = ddcParseLocalISO(range.endStr);
        if (start) start.setHours(0,0,0,0);
        if (end) end.setHours(23,59,59,999);
        
        filtered = filtered.filter(row => {
          const cellVal = row[colKey];
          const cellDate = ddcParseRowDate(cellVal);
          if (!cellDate || isNaN(cellDate.getTime())) return false;
          if (start && cellDate < start) return false;
          if (end && cellDate > end) return false;
          return true;
        });
      }
    });

    return filtered;
  }

  // Handle sorting for PL - sort the rows
  function ddcApplySortingPL(rows) {
    if (ddcFilterState.sortCol === null || !ddcFilterState.sortDir) {
      return rows;
    }
    const colKey = ddcFilterState.sortCol;
    const dir = ddcFilterState.sortDir;
    const sorted = [...rows];
    sorted.sort((rowA, rowB) => {
      const comp = ddcCompare(rowA, rowB, colKey, true);
      return dir === 'asc' ? comp : -comp;
    });
    return sorted;
  }

  function ddcInjectFilterIcons(table, isPL) {
    const theadThs = table.querySelectorAll('thead th');
    if (!theadThs || theadThs.length === 0) return;
    
    const startIdx = (isPL || theadThs[0].querySelector('input[type="checkbox"]')) ? 1 : 0;
    
    // Check if there is a synthetic STT column
    let hasSyntheticSTT = false;
    if (!isPL && typeof tableData !== 'undefined' && tableData && tableData[0]) {
      const domDataColCount = theadThs.length - startIdx;
      const sheetColCount = tableData[0].length;
      if (domDataColCount > sheetColCount) {
        if (theadThs[startIdx] && theadThs[startIdx].textContent.trim().toUpperCase() === 'STT') {
          hasSyntheticSTT = true;
        }
      }
    }
    
    theadThs.forEach((th, idx) => {
      if (idx < startIdx) return;
      
      // Skip synthetic STT column
      if (hasSyntheticSTT && idx === startIdx) {
        // If there's an old filter button, remove it
        const oldBtn = th.querySelector('.ddc-filter-btn');
        if (oldBtn) oldBtn.remove();
        return;
      }
      
      const resizer = th.querySelector('.col-resizer');
      
      let wrapper = th.querySelector('.ddc-th-wrapper');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'ddc-th-wrapper';
        
        const childNodes = Array.from(th.childNodes);
        childNodes.forEach(node => {
          if (node !== resizer) {
            wrapper.appendChild(node);
          }
        });
        
        if (resizer) {
          th.insertBefore(wrapper, resizer);
        } else {
          th.appendChild(wrapper);
        }
      }
      
      const shift = hasSyntheticSTT ? 1 : 0;
      const dataColIndex = idx - startIdx - shift;
      const colKeyOrIdx = isPL ? TABLE_COLUMNS[dataColIndex] : String(dataColIndex);
      
      let filterBtn = wrapper.querySelector('.ddc-filter-btn');
      if (!filterBtn) {
        filterBtn = document.createElement('button');
        filterBtn.className = 'ddc-filter-btn';
        filterBtn.title = 'Lọc cột';
        filterBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
        `;
        wrapper.appendChild(filterBtn);
        
        filterBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          ddcOpenFilterDropdown(filterBtn, dataColIndex, isPL);
        });
      } else {
        // In case the click listener was bound to old index, we re-bind it
        const newFilterBtn = filterBtn.cloneNode(true);
        filterBtn.replaceWith(newFilterBtn);
        filterBtn = newFilterBtn;
        filterBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          ddcOpenFilterDropdown(filterBtn, dataColIndex, isPL);
        });
      }
      
      const hasFilter = !!ddcFilterState.columnFilters[colKeyOrIdx] || !!ddcFilterState.dateFilters[colKeyOrIdx];
      if (hasFilter) {
        filterBtn.classList.add('active');
      } else {
        filterBtn.classList.remove('active');
      }
    });

    // Inject dynamic filter toggle button next to page controls
    ddcInjectToggleFiltersButton();
  }

  function ddcInjectToggleFiltersButton() {
    if (document.getElementById('btnToggleColumnFilters')) return;

    // Search explicitly for the action controls container in the main table column
    const btnReset = document.getElementById('btnResetFilter');
    let container = btnReset ? btnReset.closest('.d-flex.flex-wrap') : null;
    if (!container) {
      container = document.querySelector('.col-md-10 .d-flex.flex-wrap, .col-12 .d-flex.flex-wrap, .d-flex.gap-2.mb-2.flex-wrap');
    }
    if (!container) return;

    const table = document.getElementById('dataTable');
    const isHidden = table ? table.classList.contains('filters-hidden') : true;

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'btnToggleColumnFilters';
    toggleBtn.className = 'btn btn-sm btn-toggle-filters add-row-btn' + (isHidden ? ' filters-hidden' : '');
    toggleBtn.textContent = isHidden ? 'Hiện bộ lọc' : 'Ẩn bộ lọc';

    // Check if #btnResetFilter is present in this container (specific to xg-ton and tole-ton)
    let targetChild = null;
    if (btnReset && container.contains(btnReset)) {
      targetChild = btnReset;
      while (targetChild && targetChild.parentElement !== container) {
        targetChild = targetChild.parentElement;
      }
    }

    let elementToInsert = toggleBtn;
    if (targetChild && targetChild.tagName === 'DIV') {
      const wrapper = document.createElement('div');
      wrapper.appendChild(toggleBtn);
      elementToInsert = wrapper;
    }

    if (targetChild) {
      container.insertBefore(elementToInsert, targetChild);
    } else {
      container.appendChild(elementToInsert);
    }

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const table = document.getElementById('dataTable');
      if (!table) return;

      const isCurrentlyVisible = !table.classList.contains('filters-hidden');
      if (isCurrentlyVisible && ddcIsFilterActive()) {
        ddcShowAlert("Không thể ẩn bộ lọc khi có bộ lọc hoặc sắp xếp đang hoạt động!");
        return;
      }

      const isHiddenNow = table.classList.toggle('filters-hidden');
      toggleBtn.classList.toggle('filters-hidden', isHiddenNow);
      if (isHiddenNow) {
        toggleBtn.textContent = 'Hiện bộ lọc';
      } else {
        toggleBtn.textContent = 'Ẩn bộ lọc';
      }

      // Save visibility state to localStorage
      const path = window.location.pathname;
      localStorage.setItem('ddc_filters_visible_' + path, isHiddenNow ? 'false' : 'true');
    });
  }

  function ddcOpenFilterDropdown(btn, colIndex, isPL) {
    ddcCloseDropdowns();

    if (!ddcFilterState.lastRenderInput || ddcFilterState.lastRenderInput.length === 0) return;

    const colKeyOrIdx = isPL ? TABLE_COLUMNS[colIndex] : String(colIndex);

    // Compute unique values from unfiltered domain (all rows)
    const domainRows = isPL ? ddcFilterState.lastRenderInput : ddcFilterState.lastRenderInput.slice(1);
    const domainUniqueValues = Array.from(new Set(domainRows.map(row => ddcGetCellString(row, colKeyOrIdx, isPL))));

    // Compute unique values from filtered rows (excluding current column's filters)
    const relevantRows = ddcGetFilteredRowsExcept(colKeyOrIdx, isPL);
    const uniqueValuesSet = new Set();
    relevantRows.forEach(row => {
      const str = ddcGetCellString(row, colKeyOrIdx, isPL);
      uniqueValuesSet.add(str);
    });
    
    const headerText = ddcGetColumnHeaderFromTable(colKeyOrIdx, isPL).toLowerCase();
    const isStrictNumeric = headerText.includes('thời gian lưu kho') || headerText.includes('khối lượng') || headerText.includes('trọng lượng') || headerText.includes('số lượng');

    const uniqueValues = Array.from(uniqueValuesSet).sort((a, b) => {
      if (isStrictNumeric) {
        const numA = ddcParseNumber(a);
        const numB = ddcParseNumber(b);
        const aNan = isNaN(numA);
        const bNan = isNaN(numB);
        if (aNan && bNan) return 0;
        if (aNan) return 1;
        if (bNan) return -1;
        return numA - numB;
      }
      let cleanA = String(a).replace(/,/g, '').trim();
      let cleanB = String(b).replace(/,/g, '').trim();
      let numA = parseFloat(cleanA);
      let numB = parseFloat(cleanB);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, 'vi');
    });

    const activeFilterSet = ddcFilterState.columnFilters[colKeyOrIdx];
    const tempCheckedSet = activeFilterSet ? new Set(activeFilterSet) : new Set(domainUniqueValues);
    
    const isDateCol = headerText.includes('ngày') && !headerText.includes('thời gian lưu kho');

    let dateRangeHtml = '';
    if (isDateCol) {
      dateRangeHtml = `
        <hr class="ddc-filter-divider">
        <div class="ddc-date-range-container" style="display: flex; flex-direction: column; gap: 6px; padding: 4px 0;">
          <div style="font-size: 12px; font-weight: 600; color: #94a3b8; text-align: left; margin-bottom: 2px;">Lọc theo khoảng ngày:</div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="date" class="ddc-filter-date-input" id="ddcStartDate" style="flex: 1; min-width: 0; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 4px 8px; font-size: 12px; color: #fff; outline: none; box-sizing: border-box;">
            <span style="font-size: 12px; color: #94a3b8; flex-shrink: 0;">đến</span>
            <input type="date" class="ddc-filter-date-input" id="ddcEndDate" style="flex: 1; min-width: 0; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 4px 8px; font-size: 12px; color: #fff; outline: none; box-sizing: border-box;">
          </div>
        </div>
      `;
    }

    const rect = btn.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.className = 'ddc-table-filter-dropdown';
    if (isDateCol) {
      dropdown.classList.add('ddc-date-dropdown');
    }
    
    const dropdownWidth = isDateCol ? 320 : 250;
    let left = window.scrollX + rect.left - (dropdownWidth - 30) + rect.width;
    if (left < 10) left = 10;
    if (left + dropdownWidth > window.innerWidth) left = window.innerWidth - (dropdownWidth + 10);
    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${window.scrollY + rect.bottom + 6}px`;

    // Dropdown content structure
    dropdown.innerHTML = `
      <div class="ddc-filter-sort-option" id="ddcSortAsc">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
        Sắp xếp từ A đến Z
      </div>
      <div class="ddc-filter-sort-option" id="ddcSortDesc">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
        Sắp xếp từ Z đến A
      </div>
      ${dateRangeHtml}
      <hr class="ddc-filter-divider">
      <div class="ddc-filter-search-container">
        <input type="text" class="ddc-filter-search-input" id="ddcSearchInput" placeholder="Tìm kiếm...">
      </div>
      <div class="ddc-filter-actions">
        <button type="button" class="ddc-filter-action-btn" id="ddcSelectAll">Chọn tất cả</button>
        <button type="button" class="ddc-filter-action-btn clear-btn" id="ddcClearAll">Xóa</button>
      </div>
      <div class="ddc-filter-list-container" id="ddcListContainer"></div>
      <hr class="ddc-filter-divider">
      <div class="ddc-filter-footer">
        <button type="button" class="ddc-btn-cancel" id="ddcCancel">Hủy</button>
        <button type="button" class="ddc-btn-ok" id="ddcOk">OK</button>
      </div>
    `;

    document.body.appendChild(dropdown);

    const listContainer = dropdown.querySelector('#ddcListContainer');
    const searchInput = dropdown.querySelector('#ddcSearchInput');

    if (isDateCol) {
      const activeDateFilter = ddcFilterState.dateFilters[colKeyOrIdx];
      if (activeDateFilter) {
        dropdown.querySelector('#ddcStartDate').value = activeDateFilter.startStr || '';
        dropdown.querySelector('#ddcEndDate').value = activeDateFilter.endStr || '';
      }
    }

    function renderCheckboxes(filterText = '') {
      listContainer.innerHTML = '';
      const search = filterText.toLowerCase().trim();
      
      uniqueValues.forEach((val, index) => {
        const displayVal = val === '' ? '(Trống)' : val;
        if (search && !displayVal.toLowerCase().includes(search)) return;
        
        const isChecked = tempCheckedSet.has(val);
        
        const item = document.createElement('label');
        item.className = 'ddc-filter-item';
        item.innerHTML = `
          <input type="checkbox" ${isChecked ? 'checked' : ''}>
          <span class="ddc-filter-item-label" title="${escapeHtml(displayVal)}">${escapeHtml(displayVal)}</span>
        `;
        listContainer.appendChild(item);

        const cb = item.querySelector('input[type="checkbox"]');
        cb._val = val;
        cb.addEventListener('change', () => {
          if (cb.checked) {
            tempCheckedSet.add(val);
          } else {
            tempCheckedSet.delete(val);
          }
        });
      });
      
      if (listContainer.children.length === 0) {
        listContainer.innerHTML = '<div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 10px;">Không có kết quả</div>';
      }
    }

    renderCheckboxes();

    // Event listeners inside dropdown
    searchInput.addEventListener('input', () => {
      renderCheckboxes(searchInput.value);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        dropdown.querySelector('#ddcOk').click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        ddcCloseDropdowns();
      }
    });

    dropdown.querySelector('#ddcSortAsc').addEventListener('click', () => {
      ddcFilterState.sortCol = colKeyOrIdx;
      ddcFilterState.sortDir = 'asc';
      ddcCloseDropdowns();
      ddcTriggerReRender(isPL);
    });

    dropdown.querySelector('#ddcSortDesc').addEventListener('click', () => {
      ddcFilterState.sortCol = colKeyOrIdx;
      ddcFilterState.sortDir = 'desc';
      ddcCloseDropdowns();
      ddcTriggerReRender(isPL);
    });

    dropdown.querySelector('#ddcSelectAll').addEventListener('click', () => {
      listContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
        if (cb._val !== undefined) {
          tempCheckedSet.add(cb._val);
        }
      });
    });

    dropdown.querySelector('#ddcClearAll').addEventListener('click', () => {
      listContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        if (cb._val !== undefined) {
          tempCheckedSet.delete(cb._val);
        }
      });
    });

    dropdown.querySelector('#ddcCancel').addEventListener('click', () => {
      ddcCloseDropdowns();
    });

    dropdown.querySelector('#ddcOk').addEventListener('click', () => {
      if (isDateCol) {
        const startStr = dropdown.querySelector('#ddcStartDate').value;
        const endStr = dropdown.querySelector('#ddcEndDate').value;
        if (startStr || endStr) {
          ddcFilterState.dateFilters[colKeyOrIdx] = { startStr, endStr };
        } else {
          delete ddcFilterState.dateFilters[colKeyOrIdx];
        }
      }

      // Use tempCheckedSet directly — it correctly tracks the check state for ALL values,
      // including those not currently visible due to the search filter in the dropdown.
      if (tempCheckedSet.size === domainUniqueValues.length) {
        // All items checked = no filter needed
        delete ddcFilterState.columnFilters[colKeyOrIdx];
      } else if (tempCheckedSet.size === 0) {
        // Nothing checked = show nothing (keep an empty set as filter)
        ddcFilterState.columnFilters[colKeyOrIdx] = new Set();
      } else {
        ddcFilterState.columnFilters[colKeyOrIdx] = new Set(tempCheckedSet);
      }
      
      ddcCloseDropdowns();
      ddcTriggerReRender(isPL);
    });
  }

  function ddcSaveFilterStateToStorage() {
    const path = window.location.pathname;
    const criteriaKey = 'ddc_filter_criteria_' + path;
    const serializedColumnFilters = {};
    Object.keys(ddcFilterState.columnFilters).forEach(key => {
      const setVal = ddcFilterState.columnFilters[key];
      if (setVal instanceof Set) {
        serializedColumnFilters[key] = Array.from(setVal);
      } else if (Array.isArray(setVal)) {
        serializedColumnFilters[key] = setVal;
      }
    });
    const stateToSave = {
      sortCol: ddcFilterState.sortCol,
      sortDir: ddcFilterState.sortDir,
      columnFilters: serializedColumnFilters,
      dateFilters: ddcFilterState.dateFilters
    };
    localStorage.setItem(criteriaKey, JSON.stringify(stateToSave));
  }

  function ddcLoadFilterStateFromStorage() {
    const path = window.location.pathname;
    const criteriaKey = 'ddc_filter_criteria_' + path;
    const saved = localStorage.getItem(criteriaKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed) {
        ddcFilterState.sortCol = parsed.sortCol || null;
        ddcFilterState.sortDir = parsed.sortDir || null;
        ddcFilterState.columnFilters = {};
        if (parsed.columnFilters) {
          Object.keys(parsed.columnFilters).forEach(key => {
            const arr = parsed.columnFilters[key];
            if (Array.isArray(arr)) {
              ddcFilterState.columnFilters[key] = new Set(arr);
            }
          });
        }
        ddcFilterState.dateFilters = parsed.dateFilters || {};
      }
    } catch (e) {
      console.error("Failed to load filter state from storage:", e);
    }
  }

  function ddcTriggerReRender(isPL) {
    ddcSaveFilterStateToStorage();
    if (isPL) {
      if (typeof renderTable === 'function') {
        renderTable();
      }
    } else {
      if (typeof renderTable === 'function' && ddcFilterState.lastRenderInput) {
        renderTable(ddcFilterState.lastRenderInput, false);
      }
    }
  }

  function ddcCloseDropdowns() {
    document.querySelectorAll('.ddc-table-filter-dropdown').forEach(el => el.remove());
  }

  function ddcIsFilterActive() {
    const hasSorting = ddcFilterState.sortCol !== null && ddcFilterState.sortDir !== null;
    const hasColumnFilters = Object.keys(ddcFilterState.columnFilters).length > 0;
    const hasDateFilters = Object.keys(ddcFilterState.dateFilters).length > 0;
    return hasSorting || hasColumnFilters || hasDateFilters;
  }

  function ddcShowAlert(message) {
    let alertBox = document.getElementById('ddc-filter-alert');
    if (!alertBox) {
      alertBox = document.createElement('div');
      alertBox.id = 'ddc-filter-alert';
      alertBox.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: linear-gradient(135deg, #1e293b, #0f172a);
        color: #f8fafc;
        padding: 14px 20px;
        border-radius: 12px;
        border-left: 4px solid #ef4444;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
        font-family: 'Montserrat', sans-serif'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 100000;
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
      `;
      alertBox.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span class="ddc-alert-msg"></span>
      `;
      document.body.appendChild(alertBox);
    }
    
    alertBox.querySelector('.ddc-alert-msg').textContent = message;
    
    // Show toast
    alertBox.style.transform = 'translateY(0)';
    alertBox.style.opacity = '1';
    
    // Hide after 3.5 seconds
    clearTimeout(alertBox.timeoutId);
    alertBox.timeoutId = setTimeout(() => {
      alertBox.style.transform = 'translateY(100px)';
      alertBox.style.opacity = '0';
    }, 3500);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  // Click outside listener
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ddc-table-filter-dropdown') && !e.target.closest('.ddc-filter-btn')) {
      ddcCloseDropdowns();
    }
  });

  // Watch for table changes or page init
  for (let delay of [0, 50, 100, 200, 500, 1000, 2000, 4000]) {
    setTimeout(ddcInitMonkeyPatches, delay);
  }
})();

// Attach resizer handles to table header cells to allow dragging column widths
function enableColumnResize(table) {
  if (!table) return;
  const thead = table.querySelector('thead');
  if (!thead) return;
  const ths = Array.from(thead.querySelectorAll('th'));

  ths.forEach((th, index) => {
    const old = th.querySelector('.col-resizer');
    if (old) old.remove();

    th.style.position = th.style.position || 'sticky';

    const resizer = document.createElement('div');
    resizer.className = 'col-resizer';
    th.appendChild(resizer);

    let startX = 0;
    let startWidth = 0;
    let startTableWidth = 0;

    function onMouseMove(e) {
      const diff = e.clientX - startX;
      const newWidth = Math.max(40, startWidth + diff);
      th.style.width = newWidth + 'px';
      table.style.width = Math.max(startTableWidth, startTableWidth + (newWidth - startWidth)) + 'px';
      const tb = table.tBodies?.[0];
      if (tb) for (const row of tb.rows) {
        const cell = row.children[index]; if (cell) cell.style.width = newWidth + 'px';
      }
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Khóa tất cả các th khác thành width px hiện tại để tránh bị tự động dãn do table-layout
      ths.forEach(t => {
        if (!t.style.width) t.style.width = t.offsetWidth + 'px';
      });

      startX = e.clientX;
      startWidth = th.offsetWidth;
      startTableWidth = table.offsetWidth;
      table.style.width = startTableWidth + 'px';

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}


