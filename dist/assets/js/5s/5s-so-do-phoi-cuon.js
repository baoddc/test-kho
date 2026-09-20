/* =============================================================================
   5S SƠ ĐỒ KHO PHÔI CUỘN - JAVASCRIPT
   Quản lý và hiển thị mặt bằng kho phôi cuộn theo thời gian thực
   Tích hợp dữ liệu từ Supabase (Kho Xà gồ & Kho Tole), lọc đa kho,
   tìm kiếm highlight, modal chi tiết kệ và xuất Excel.
================================================================================ */

// IIFE to protect global namespace while exposing necessary interfaces
(function () {
  'use strict';

  // Sơ đồ kệ tiêu chuẩn: A14 -> A01 và B14 -> B01
  const SHELVES_A = Array.from({ length: 14 }, (_, i) => {
    const num = 14 - i;
    return `A${String(num).padStart(2, '0')}`;
  });

  const SHELVES_B = Array.from({ length: 14 }, (_, i) => {
    const num = 14 - i;
    return `B${String(num).padStart(2, '0')}`;
  });

  const ALL_STANDARD_SHELVES = [...SHELVES_B, ...SHELVES_A, 'GRATING'];

  // Định mức an toàn tối đa cho từng kệ (cuộn)
  function getMaxCapacity(shelfId) {
    if (['B12', 'B13', 'B14'].includes(shelfId)) return 50;
    if (shelfId === 'GRATING') return 100;
    return 20;
  }

  // State
  let allActiveRolls = []; // Toàn bộ cuộn đang tồn trong cả 2 kho
  let currentWarehouseFilter = 'all'; // 'all' | 'xg' | 'tole'
  let searchQuery = '';
  let selectedShelfForModal = null;
  let modalFilterQuery = '';

  // Realtime & Broadcast channels
  const xgBroadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('xg_sync_channel') : null;
  const toleBroadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tole_sync_channel') : null;
  let realtimeSubscriptions = [];

  // ==================== UTILITIES ====================
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatDate(dateValue) {
    if (!dateValue) return '';
    let date = null;
    if (typeof dateValue === 'string') {
      const iso = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        date = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
      } else {
        const m = dateValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          let y = parseInt(m[3], 10);
          if (y < 100) y += y < 50 ? 2000 : 1900;
          date = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
        }
      }
    } else if (dateValue instanceof Date) {
      date = dateValue;
    }
    if (!date || isNaN(date.getTime())) return String(dateValue);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function calculateStorageDays(dateValue) {
    if (!dateValue) return 0;
    let date = null;
    if (typeof dateValue === 'string') {
      const iso = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        date = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
      } else {
        const m = dateValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          let y = parseInt(m[3], 10);
          if (y < 100) y += y < 50 ? 2000 : 1900;
          date = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
        }
      }
    } else if (dateValue instanceof Date) {
      date = dateValue;
    }
    if (!date || isNaN(date.getTime())) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diffTime = today - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  }

  /**
   * Chuẩn hóa mã kệ: A1 -> A01, A01 -> A01, B3 -> B03, Grating -> GRATING
   */
  function normalizeRackId(rawLocation) {
    if (!rawLocation) return null;
    const clean = String(rawLocation).trim().toUpperCase();
    if (!clean) return null;

    if (clean.includes('GRAT') || clean === 'GR-01' || clean === 'GR-02' || clean.includes('TẬP KẾT')) {
      return 'GRATING';
    }

    const matchA = clean.match(/^A-?0?(\d{1,2})$/);
    if (matchA) {
      const num = parseInt(matchA[1], 10);
      if (num >= 1 && num <= 14) {
        return `A${String(num).padStart(2, '0')}`;
      }
    }

    const matchB = clean.match(/^B-?0?(\d{1,2})$/);
    if (matchB) {
      const num = parseInt(matchB[1], 10);
      if (num >= 1 && num <= 14) {
        return `B${String(num).padStart(2, '0')}`;
      }
    }

    return null;
  }

  // ==================== DATA FETCHING & SYNC ====================
  async function loadWarehouseData() {
    // 1. Cố gắng lấy tức thì từ LocalStorage Cache (0ms)
    tryReadLocalCache();

    // 2. Fetch nền song song từ Supabase
    try {
      const fetchFunc = typeof window.fetchAllFromSupabase === 'function'
        ? window.fetchAllFromSupabase
        : async (tbl, col) => {
            if (!window.supabase) return [];
            let rows = [], from = 0, batchSize = 1000, hasMore = true;
            while (hasMore) {
              const { data, error } = await window.supabase
                .from(tbl)
                .select(col || '*')
                .order('id', { ascending: true })
                .range(from, from + batchSize - 1);
              if (error) throw error;
              if (data && data.length > 0) {
                rows = rows.concat(data);
                if (data.length < batchSize) hasMore = false;
                else from += batchSize;
              } else {
                hasMore = false;
              }
            }
            return rows;
          };

      const [xgNhapAll, xgXuatAll, toleNhapAll, toleXuatAll] = await Promise.all([
        fetchFunc('xg-nhap', '*').catch(() => []),
        fetchFunc('xg-xuat', '"Cuộn ID"').catch(() => []),
        fetchFunc('tole-nhap', '*').catch(() => []),
        fetchFunc('tole-xuat', '"Cuộn ID"').catch(() => [])
      ]);

      const xgExportedIds = new Set(
        xgXuatAll.map(r => String(r['Cuộn ID'] || '').trim().toLowerCase()).filter(Boolean)
      );
      const toleExportedIds = new Set(
        toleXuatAll.map(r => String(r['Cuộn ID'] || '').trim().toLowerCase()).filter(Boolean)
      );

      // Tính tồn Xà gồ
      const activeXg = xgNhapAll.filter(row => {
        const cid = String(row['Cuộn ID'] || '').trim().toLowerCase();
        return cid && !xgExportedIds.has(cid);
      }).map(row => ({
        _warehouse: 'xg',
        _warehouseName: 'Kho Xà gồ',
        id: row.id,
        cuonId: String(row['Cuộn ID'] || '').trim(),
        maVatTu: String(row['Mã vật tư'] || '').trim(),
        tenVatTu: String(row['Tên vật tư'] || '').trim(),
        batch: String(row['Batch'] || '').trim(),
        weight: parseFloat(row['Số lượng (Kg)']) || 0,
        importDate: row['Ngày nhập'] || '',
        storageDays: calculateStorageDays(row['Ngày nhập']),
        rawLocation: row['Vị trí'] || '',
        rackId: normalizeRackId(row['Vị trí']),
        projectCode: row['Mã công trình'] || '',
        projectName: row['Tên công trình'] || '',
        note: row['Ghi chú'] || ''
      }));

      // Tính tồn Tole
      const activeTole = toleNhapAll.filter(row => {
        const cid = String(row['Cuộn ID'] || '').trim().toLowerCase();
        return cid && !toleExportedIds.has(cid);
      }).map(row => ({
        _warehouse: 'tole',
        _warehouseName: 'Kho Tole',
        id: row.id,
        cuonId: String(row['Cuộn ID'] || '').trim(),
        maVatTu: String(row['Mã vật tư'] || '').trim(),
        tenVatTu: String(row['Tên vật tư'] || '').trim(),
        batch: String(row['Batch'] || '').trim(),
        weight: parseFloat(row['Số lượng (Kg)']) || 0,
        lengthM: parseFloat(row['Số lượng (m)']) || 0,
        importDate: row['Ngày nhập'] || '',
        storageDays: calculateStorageDays(row['Ngày nhập']),
        rawLocation: row['Vị trí'] || '',
        rackId: normalizeRackId(row['Vị trí']),
        projectCode: row['Mã công trình'] || '',
        projectName: row['Tên công trình'] || '',
        note: row['Ghi chú'] || ''
      }));

      allActiveRolls = [...activeXg, ...activeTole];

      // Lưu cache local để trang mở nhanh lần sau
      try {
        localStorage.setItem('cached_5s_phoi_cuon', JSON.stringify({
          timestamp: Date.now(),
          rolls: allActiveRolls
        }));
      } catch (e) {}

      finishLoadingAndRender();

    } catch (err) {
      console.error('Lỗi nạp dữ liệu tồn kho từ Supabase:', err);
      // Nếu đã có cache từ trước thì vẫn tiếp tục hiển thị
      if (allActiveRolls.length > 0) {
        finishLoadingAndRender();
      } else {
        renderErrorState(err.message || 'Không thể kết nối với cơ sở dữ liệu Supabase.');
      }
    }
  }

  function tryReadLocalCache() {
    try {
      const cached = localStorage.getItem('cached_5s_phoi_cuon');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.rolls) && parsed.rolls.length > 0) {
          allActiveRolls = parsed.rolls;
          finishLoadingAndRender();
        }
      }
    } catch (e) {}
  }

  function finishLoadingAndRender() {
    const loadingEl = document.getElementById('loading-state');
    const layoutEl = document.getElementById('main-content-layout');

    if (loadingEl) loadingEl.style.display = 'none';
    if (layoutEl) layoutEl.classList.remove('hidden');

    renderAll();
  }

  function renderErrorState(msg) {
    const loadingEl = document.getElementById('loading-state');
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div class="text-center py-10 px-4">
          <i class="bi bi-exclamation-octagon-fill text-danger text-4xl mb-3"></i>
          <h5 class="text-danger font-bold">Lỗi đồng bộ dữ liệu</h5>
          <p class="text-slate-600 text-sm max-w-md mx-auto mb-4">${msg}</p>
          <button id="btn-retry" class="btn btn-sm btn-primary rounded-lg px-4">
            <i class="bi bi-arrow-clockwise me-1"></i> Thử lại
          </button>
        </div>
      `;
      const btnRetry = document.getElementById('btn-retry');
      if (btnRetry) btnRetry.addEventListener('click', () => loadWarehouseData());
    }
  }

  // ==================== RENDERING LOGIC ====================
  function getFilteredRolls() {
    if (currentWarehouseFilter === 'xg') {
      return allActiveRolls.filter(r => r._warehouse === 'xg');
    }
    if (currentWarehouseFilter === 'tole') {
      return allActiveRolls.filter(r => r._warehouse === 'tole');
    }
    return allActiveRolls;
  }

  function renderAll() {
    renderKPIs();
    renderMap();
    if (lucide && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function renderKPIs() {
    const filtered = getFilteredRolls();
    const totalRolls = filtered.length;
    const totalWeight = filtered.reduce((sum, r) => sum + r.weight, 0);
    const totalTons = totalWeight / 1000;

    const xgRolls = allActiveRolls.filter(r => r._warehouse === 'xg');
    const toleRolls = allActiveRolls.filter(r => r._warehouse === 'tole');
    const xgWeight = xgRolls.reduce((sum, r) => sum + r.weight, 0);
    const toleWeight = toleRolls.reduce((sum, r) => sum + r.weight, 0);

    // Tính tỷ lệ sử dụng kệ
    const occupiedRacks = new Set(filtered.map(r => r.rackId).filter(Boolean));
    const totalPossibleRacks = ALL_STANDARD_SHELVES.length;
    const utilizationPct = totalPossibleRacks > 0
      ? Math.round((occupiedRacks.size / totalPossibleRacks) * 100)
      : 0;

    // Elements
    const elTotalRolls = document.getElementById('kpi-total-rolls');
    const elTotalWeight = document.getElementById('kpi-total-weight');
    const elTotalTons = document.getElementById('kpi-total-tons');
    const elRackUtil = document.getElementById('kpi-rack-utilization');

    const elXgRolls = document.getElementById('kpi-xg-rolls');
    const elXgWeight = document.getElementById('kpi-xg-weight');
    const elToleRolls = document.getElementById('kpi-tole-rolls');
    const elToleWeight = document.getElementById('kpi-tole-weight');

    const badgeAll = document.getElementById('badge-count-all');
    const badgeXg = document.getElementById('badge-count-xg');
    const badgeTole = document.getElementById('badge-count-tole');

    if (elTotalRolls) elTotalRolls.textContent = formatNumber(totalRolls);
    if (elTotalWeight) elTotalWeight.textContent = formatNumber(totalWeight);
    if (elTotalTons) elTotalTons.textContent = `${totalTons.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} tấn`;
    if (elRackUtil) elRackUtil.textContent = `${occupiedRacks.size}/${totalPossibleRacks} kệ (${utilizationPct}%)`;

    if (elXgRolls) elXgRolls.textContent = formatNumber(xgRolls.length);
    if (elXgWeight) elXgWeight.textContent = `${formatNumber(xgWeight)} Kg`;
    if (elToleRolls) elToleRolls.textContent = formatNumber(toleRolls.length);
    if (elToleWeight) elToleWeight.textContent = `${formatNumber(toleWeight)} Kg`;

    if (badgeAll) badgeAll.textContent = allActiveRolls.length;
    if (badgeXg) badgeXg.textContent = xgRolls.length;
    if (badgeTole) badgeTole.textContent = toleRolls.length;
  }

  function getSeparatorHTML() {
    return `
      <div class="shelf-separator w-full h-2 md:h-3 flex items-center px-0.5 opacity-60">
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 10">
          <defs>
            <marker id="arrowhead-left" markerWidth="3" markerHeight="3" refX="0" refY="1.5" orient="auto">
              <polygon points="3,0 0,1.5 3,3" fill="#2b6b9c" />
            </marker>
            <marker id="arrowhead-right" markerWidth="3" markerHeight="3" refX="3" refY="1.5" orient="auto">
              <polygon points="0,0 3,1.5 0,3" fill="#2b6b9c" />
            </marker>
          </defs>
          <line x1="1" y1="5" x2="99" y2="5" stroke="#2b6b9c" stroke-width="1.5" marker-start="url(#arrowhead-left)" marker-end="url(#arrowhead-right)" />
        </svg>
      </div>
    `;
  }

  function renderMap() {
    const filteredRolls = getFilteredRolls();

    // Map: rackId -> Array of rolls
    const rackMap = new Map();
    ALL_STANDARD_SHELVES.forEach(id => rackMap.set(id, []));

    const unassignedRolls = [];

    filteredRolls.forEach(roll => {
      if (roll.rackId && rackMap.has(roll.rackId)) {
        rackMap.get(roll.rackId).push(roll);
      } else {
        unassignedRolls.push(roll);
      }
    });

    // Render Dãy B (Trái) & Dãy A (Phải)
    renderShelfColumn('shelves-left', SHELVES_B, rackMap, 'left');
    renderShelfColumn('shelves-right', SHELVES_A, rackMap, 'right');

    // Render Grating
    renderGrating(rackMap.get('GRATING') || []);

    // Render Unassigned Warning
    renderUnassignedSection(unassignedRolls);

    // Áp dụng trạng thái tìm kiếm nếu có
    applySearchHighlight();
  }

  function renderShelfColumn(containerId, shelfIds, rackMap, side) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = getSeparatorHTML();

    shelfIds.forEach(shelfId => {
      const rolls = rackMap.get(shelfId) || [];
      const count = rolls.length;
      const maxCap = getMaxCapacity(shelfId);
      const isOverloaded = count > maxCap;
      const isEmpty = count === 0;

      let statusClass = 'shelf-occupied';
      if (isEmpty) statusClass = 'shelf-empty';
      else if (isOverloaded) statusClass = 'shelf-full';

      const justifyClass = side === 'left' ? 'justify-end pr-1.5 sm:pr-2.5' : 'justify-start pl-1.5 sm:pl-2.5';
      const tooltipSideClass = side === 'left' ? 'left-side' : 'right-side';

      // Preview top 4 cuộn
      let previewHTML = '';
      if (count > 0) {
        const totalKg = rolls.reduce((sum, r) => sum + r.weight, 0);
        const topRolls = rolls.slice(0, 4);
        previewHTML = `
          <div class="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 flex items-center justify-between text-xs">
            <span>Kệ ${shelfId}</span>
            <span class="badge ${isOverloaded ? 'bg-danger' : 'bg-primary'} text-[10px]">
              ${count}/${maxCap} cuộn (${formatNumber(totalKg)} Kg)
            </span>
          </div>
          <div class="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
            ${topRolls.map(r => `
              <div class="p-1.5 rounded bg-slate-50 border border-slate-100 text-[11px] flex justify-between items-center gap-2">
                <div class="min-w-0">
                  <div class="font-bold text-slate-900 truncate">${r.cuonId}</div>
                  <div class="text-slate-500 truncate text-[10px]" title="${r.maVatTu} - ${r.tenVatTu}">${r.maVatTu}</div>
                </div>
                <div class="text-end flex-shrink-0">
                  <span class="font-semibold text-red-600">${formatNumber(r.weight)} Kg</span>
                  <div class="text-[9px] text-slate-400">${r._warehouse === 'xg' ? 'XG' : 'Tole'}</div>
                </div>
              </div>
            `).join('')}
            ${count > 4 ? `<div class="text-center text-[10px] text-slate-400 italic pt-1">+ ${count - 4} cuộn khác (Nhấp để xem tất cả)</div>` : ''}
          </div>
        `;
      } else {
        previewHTML = `
          <div class="font-bold text-slate-700 border-b border-slate-100 pb-1 mb-1 text-xs">Kệ ${shelfId}</div>
          <div class="text-center py-2 text-slate-400 text-xs italic">Kệ trống, chưa có cuộn nào</div>
        `;
      }

      html += `
        <div id="shelf-${shelfId}" class="shelf-container ${side}-side relative h-8 sm:h-10 md:h-12 flex items-center ${justifyClass} cursor-pointer rounded-md ${statusClass}" data-id="${shelfId}">
          
          <!-- Circle Badge -->
          <div class="shelf-circle w-6 h-6 sm:w-8 sm:h-8 rounded-full border-[1.5px] flex items-center justify-center font-bold text-[10px] sm:text-xs md:text-sm z-10">
            ${shelfId}
          </div>

          <!-- Roll count on shelf (When occupied) -->
          ${count > 0 ? `
            <div class="shelf-mini-badge absolute ${side === 'left' ? 'left-2' : 'right-2'} text-[10px] font-bold px-1.5 py-0.5 rounded ${isOverloaded ? 'bg-red-600 text-white' : 'bg-white/80 text-slate-700'} hidden sm:block">
              ${count} cuộn
            </div>
          ` : ''}

          <!-- Search Match Badge -->
          <div class="search-match-badge hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <span class="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
              <span class="match-count">0</span> cuộn
            </span>
          </div>

          <!-- Hover Tooltip -->
          <div class="shelf-tooltip ${tooltipSideClass}">
            <div class="min-w-[240px] max-w-[320px] bg-white p-3 rounded-xl shadow-2xl border border-slate-200 text-left">
              ${previewHTML}
            </div>
          </div>

        </div>
      `;
      html += getSeparatorHTML();
    });

    container.innerHTML = html;
    bindShelfClickEvents(container);
  }

  function renderGrating(rolls) {
    const elCount = document.getElementById('grating-roll-count');
    const elKg = document.getElementById('grating-kg-count');
    const elPreview = document.getElementById('grating-preview-content');

    const count = rolls.length;
    const totalKg = rolls.reduce((sum, r) => sum + r.weight, 0);

    if (elCount) elCount.textContent = `${count} cuộn`;
    if (elKg) elKg.textContent = `${formatNumber(totalKg)} Kg`;

    if (elPreview) {
      if (count > 0) {
        const topRolls = rolls.slice(0, 4);
        elPreview.innerHTML = `
          <div class="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
            ${topRolls.map(r => `
              <div class="p-1 rounded bg-amber-50 border border-amber-200 text-[11px] flex justify-between items-center gap-2">
                <div class="min-w-0">
                  <div class="font-bold text-slate-900 truncate">${r.cuonId}</div>
                  <div class="text-slate-500 truncate text-[10px]">${r.maVatTu}</div>
                </div>
                <div class="text-end flex-shrink-0">
                  <span class="font-semibold text-amber-800">${formatNumber(r.weight)} Kg</span>
                  <div class="text-[9px] text-slate-400">${r._warehouse === 'xg' ? 'XG' : 'Tole'}</div>
                </div>
              </div>
            `).join('')}
            ${count > 4 ? `<div class="text-center text-[10px] text-amber-700 italic pt-1">+ ${count - 4} cuộn khác (Nhấp để xem)</div>` : ''}
          </div>
        `;
      } else {
        elPreview.innerHTML = `<div class="text-center py-2 text-slate-400 italic">Khu vực Grating hiện không có cuộn tập kết</div>`;
      }
    }

    const gratingArea = document.getElementById('grating-area');
    if (gratingArea) {
      gratingArea.onclick = () => openShelfDetailModal('GRATING');
    }
  }

  function renderUnassignedSection(rolls) {
    const unassignedArea = document.getElementById('unassigned-area');
    const countBadge = document.getElementById('unassigned-count-badge');
    const btnView = document.getElementById('btn-view-unassigned');

    if (!unassignedArea) return;

    if (rolls.length > 0) {
      unassignedArea.classList.remove('hidden');
      if (countBadge) countBadge.textContent = `${rolls.length} cuộn`;
      if (btnView) {
        btnView.onclick = () => openShelfDetailModal('CHƯA XẾP KỆ', rolls);
      }
    } else {
      unassignedArea.classList.add('hidden');
    }
  }

  function bindShelfClickEvents(container) {
    container.querySelectorAll('.shelf-container').forEach(el => {
      const shelfId = el.getAttribute('data-id');
      if (shelfId) {
        el.onclick = () => openShelfDetailModal(shelfId);
      }
    });
  }

  // ==================== SEARCH & HIGHLIGHT ====================
  function applySearchHighlight() {
    const query = searchQuery.trim().toLowerCase();
    const searchFeedback = document.getElementById('search-feedback');
    const clearBtn = document.getElementById('clear-search');

    if (clearBtn) {
      clearBtn.classList.toggle('hidden', query === '');
    }

    const filteredRolls = getFilteredRolls();

    if (!query) {
      if (searchFeedback) searchFeedback.classList.add('hidden');
      document.querySelectorAll('.shelf-container').forEach(el => {
        el.classList.remove('highlighted', 'dimmed');
        const badge = el.querySelector('.search-match-badge');
        if (badge) badge.classList.add('hidden');
      });
      return;
    }

    // Đếm cuộn khớp theo từng kệ
    const matchCountByShelf = new Map();
    let totalMatchedRolls = 0;

    filteredRolls.forEach(roll => {
      const textToSearch = `${roll.cuonId} ${roll.maVatTu} ${roll.tenVatTu} ${roll.batch} ${roll.projectCode}`.toLowerCase();
      if (textToSearch.includes(query)) {
        totalMatchedRolls++;
        const sId = roll.rackId || 'UNASSIGNED';
        matchCountByShelf.set(sId, (matchCountByShelf.get(sId) || 0) + 1);
      }
    });

    // Cập nhật giao diện feedback
    if (searchFeedback) {
      searchFeedback.classList.remove('hidden');
      searchFeedback.innerHTML = `Tìm thấy <strong class="text-blue-600">${totalMatchedRolls}</strong> cuộn khớp từ khóa trên <strong class="text-slate-800">${matchCountByShelf.size}</strong> vị trí kệ.`;
    }

    document.querySelectorAll('.shelf-container').forEach(el => {
      const sId = el.getAttribute('data-id');
      const matches = matchCountByShelf.get(sId) || 0;
      const matchBadge = el.querySelector('.search-match-badge');
      const countSpan = el.querySelector('.match-count');

      if (matches > 0) {
        el.classList.remove('dimmed');
        el.classList.add('highlighted');
        if (matchBadge) {
          matchBadge.classList.remove('hidden');
          if (countSpan) countSpan.textContent = matches;
        }
      } else {
        el.classList.remove('highlighted');
        el.classList.add('dimmed');
        if (matchBadge) matchBadge.classList.add('hidden');
      }
    });
  }

  // ==================== MODAL & EXCEL EXPORT ====================
  function openShelfDetailModal(shelfId, customRolls = null) {
    selectedShelfForModal = shelfId;
    modalFilterQuery = '';

    const modalSearchInput = document.getElementById('modalSearchInput');
    if (modalSearchInput) modalSearchInput.value = '';

    const modalShelfName = document.getElementById('modalShelfName');
    const modalShelfTitleCircle = document.getElementById('modalShelfTitleCircle');
    const btnLocation = document.getElementById('btnNavigateLocationLookup');

    if (modalShelfName) modalShelfName.textContent = shelfId;
    if (modalShelfTitleCircle) modalShelfTitleCircle.textContent = shelfId === 'GRATING' ? 'GR' : shelfId;

    if (btnLocation) {
      btnLocation.href = `/pages/tem-nhan-kiem-ke/vi-tri-ton.html?vitri=${encodeURIComponent(shelfId)}`;
    }

    renderModalRollsTable(customRolls);

    // Mở Bootstrap Modal
    const modalEl = document.getElementById('shelfDetailModal');
    if (modalEl && window.bootstrap && window.bootstrap.Modal) {
      const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  }

  function renderModalRollsTable(customRolls = null) {
    const tableBody = document.getElementById('modalShelfTableBody');
    const visibleCountEl = document.getElementById('modalVisibleCount');
    const rollCountHeader = document.getElementById('modalShelfRollCount');
    const totalKgHeader = document.getElementById('modalShelfTotalKg');

    if (!tableBody) return;

    let rolls = customRolls;
    if (!rolls) {
      const filtered = getFilteredRolls();
      rolls = filtered.filter(r => r.rackId === selectedShelfForModal);
    }

    const totalCount = rolls.length;
    const totalKg = rolls.reduce((sum, r) => sum + r.weight, 0);

    if (rollCountHeader) rollCountHeader.textContent = `${totalCount} cuộn`;
    if (totalKgHeader) totalKgHeader.textContent = `${formatNumber(totalKg)} Kg`;

    // Filter by modal search input if any
    let displayedRolls = rolls;
    if (modalFilterQuery.trim()) {
      const q = modalFilterQuery.trim().toLowerCase();
      displayedRolls = rolls.filter(r => {
        return `${r.cuonId} ${r.maVatTu} ${r.tenVatTu} ${r.batch} ${r.projectCode} ${r.projectName}`.toLowerCase().includes(q);
      });
    }

    if (visibleCountEl) visibleCountEl.textContent = displayedRolls.length;

    if (displayedRolls.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-6 text-slate-400 italic">
            ${totalCount === 0 ? 'Kệ này hiện chưa có cuộn nào.' : 'Không tìm thấy cuộn phù hợp với từ khóa lọc.'}
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = displayedRolls.map((roll, idx) => {
      const isXg = roll._warehouse === 'xg';
      const whBadge = isXg
        ? '<span class="badge bg-indigo-100 text-indigo-700">Xà gồ</span>'
        : '<span class="badge bg-emerald-100 text-emerald-700">Tole</span>';

      return `
        <tr>
          <td class="text-center text-slate-500 font-medium">${idx + 1}</td>
          <td>${whBadge}</td>
          <td class="font-bold text-slate-900">${roll.cuonId}</td>
          <td class="font-semibold text-slate-700">${roll.maVatTu}</td>
          <td class="text-slate-600 truncate max-w-[200px]" title="${roll.tenVatTu}">${roll.tenVatTu}</td>
          <td><span class="badge bg-slate-100 text-slate-700 border border-slate-200">${roll.batch || '--'}</span></td>
          <td class="text-end font-bold text-red-600">${formatNumber(roll.weight)}</td>
          <td class="text-center text-slate-600">${formatDate(roll.importDate)}</td>
          <td class="text-center">
            <span class="badge ${roll.storageDays > 90 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">
              ${roll.storageDays} ngày
            </span>
          </td>
          <td class="text-slate-600 truncate max-w-[150px]" title="${roll.projectCode} - ${roll.projectName}">
            ${roll.projectCode || '--'}
          </td>
        </tr>
      `;
    }).join('');
  }

  function exportShelfToExcel() {
    if (!selectedShelfForModal) return;

    const filtered = getFilteredRolls();
    const rolls = filtered.filter(r => r.rackId === selectedShelfForModal);

    if (rolls.length === 0) {
      alert(`Kệ ${selectedShelfForModal} không có dữ liệu cuộn để xuất Excel.`);
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('Thư viện SheetJS chưa được tải xong. Vui lòng thử lại sau giây lát.');
      return;
    }

    const excelData = rolls.map((r, i) => ({
      'STT': i + 1,
      'Kho': r._warehouseName,
      'Vị trí kệ': selectedShelfForModal,
      'Cuộn ID': r.cuonId,
      'Mã vật tư': r.maVatTu,
      'Tên vật tư': r.tenVatTu,
      'Batch': r.batch,
      'Khối lượng (Kg)': r.weight,
      'Ngày nhập': formatDate(r.importDate),
      'Thời gian lưu kho (ngày)': r.storageDays,
      'Mã công trình': r.projectCode,
      'Tên công trình': r.projectName,
      'Ghi chú': r.note
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Ke_${selectedShelfForModal}`);

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `Ton_Kho_Ke_${selectedShelfForModal}_${todayStr}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  // ==================== EVENT LISTENERS & SETUP ====================
  function attachGlobalEventListeners() {
    // Warehouse Filter Tabs
    document.querySelectorAll('.warehouse-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.warehouse-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentWarehouseFilter = btn.getAttribute('data-warehouse') || 'all';
        renderAll();
      });
    });

    // KPI Card Click Triggers
    document.querySelectorAll('[data-filter-trigger]').forEach(card => {
      card.addEventListener('click', () => {
        const trigger = card.getAttribute('data-filter-trigger');
        const targetBtn = document.querySelector(`.warehouse-filter-btn[data-warehouse="${trigger}"]`);
        if (targetBtn) targetBtn.click();
      });
    });

    // Search Input
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');

    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        searchQuery = e.target.value;
        applySearchHighlight();
      }, 200));
    }

    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        applySearchHighlight();
      });
    }

    // Modal Search Input
    const modalSearchInput = document.getElementById('modalSearchInput');
    if (modalSearchInput) {
      modalSearchInput.addEventListener('input', debounce((e) => {
        modalFilterQuery = e.target.value;
        renderModalRollsTable();
      }, 150));
    }

    // Export Excel Button
    const btnExportExcel = document.getElementById('btnExportShelfExcel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', exportShelfToExcel);
    }

    // Refresh Button
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        const icon = btnRefresh.querySelector('i');
        if (icon) icon.classList.add('animate-spin');
        loadWarehouseData().finally(() => {
          if (icon) icon.classList.remove('animate-spin');
        });
      });
    }

    // Broadcast channel listener
    const handleBroadcastMsg = (msg) => {
      if (msg && msg.type) {
        console.log('Received broadcast inventory event, refreshing coil map:', msg.type);
        loadWarehouseData();
      }
    };

    // Theme Toggle & Synchronization
    initThemeManagement();
  }

  // ==================== THEME MANAGEMENT ====================
  function initThemeManagement() {
    const themeBtn = document.getElementById('btn-theme-toggle');
    const themeIcon = document.getElementById('theme-toggle-icon');
    const themeText = document.getElementById('theme-toggle-text');

    function updateThemeUI(theme) {
      const isDark = theme === 'dark';
      if (themeIcon) {
        themeIcon.className = isDark ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-fill text-slate-600';
      }
      if (themeText) {
        themeText.textContent = isDark ? 'Chế độ sáng' : 'Chế độ tối';
      }
      if (themeBtn) {
        themeBtn.setAttribute('title', isDark ? 'Chuyển sang Chế độ Sáng' : 'Chuyển sang Chế độ Tối');
      }
    }

    // Read initial theme
    const currentTheme = document.documentElement.getAttribute('data-bs-theme') || localStorage.getItem('ddc_theme') || 'dark';
    document.documentElement.setAttribute('data-bs-theme', currentTheme);
    updateThemeUI(currentTheme);

    // Toggle button handler
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-bs-theme') || 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-bs-theme', next);
        localStorage.setItem('ddc_theme', next);
        updateThemeUI(next);
      });
    }

    // Listen to changes on data-bs-theme attribute (e.g. from topbar or sidebar)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.type === 'attributes' && m.attributeName === 'data-bs-theme') {
          const newTheme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
          updateThemeUI(newTheme);
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
  }

  // ==================== INITIALIZATION ====================
  window.addEventListener('DOMContentLoaded', () => {
    attachGlobalEventListeners();
    loadWarehouseData();
  });

})();