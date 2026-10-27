/* =============================================================================
   XG-NHAP - SUPABASE VERSION
   Quản lý dữ liệu nhập xà gồ từ Supabase
   Tên bảng: xg-nhap
   Cột: id, Mã chứng từ, Ngày nhập, Phiếu nhập, Loại nhập, Mã vật tư,
         Tên vật tư, Batch, Cuộn ID, Số lượng (Kg), Vị trí,
         Mã công trình, Tên công trình, Ghi chú
================================================================================ */

// Tên bảng Supabase
const TABLE_NAME = 'xg-nhap';

// Header cột (theo thứ tự trong bảng) - dùng để render bảng
const COLUMN_HEADERS = [
  'id',
  'Mã chứng từ',
  'Ngày nhập',
  'Phiếu nhập',
  'Loại nhập',
  'Mã vật tư',
  'Tên vật tư',
  'Batch',
  'Cuộn ID',
  'Số lượng (Kg)',
  'Vị trí',
  'Mã công trình',
  'Tên công trình',
  'Ghi chú'
];

// Cột ẩn khỏi bảng hiển thị (nhưng vẫn dùng trong form)
const HIDDEN_COLUMNS = [];

// Escape dữ liệu từ DB/URL/QR trước khi chèn vào innerHTML (chống XSS)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==================== PAGINATION CONFIG ====================
const ROWS_PER_PAGE = 100;
// ============================================================



/* =============================================================================
   SCROLL & FILTER STATE MANAGEMENT
================================================================================ */

function saveScrollPosition() {
  return {
    scrollTop: window.pageYOffset || document.documentElement.scrollTop,
    scrollLeft: window.pageXOffset || document.documentElement.scrollLeft
  };
}

function restoreScrollPosition(position) {
  if (position) {
    window.scrollTo(position.scrollLeft, position.scrollTop);
  }
}

function saveFilterState() {
  const state = {
    currentPage: currentPage,
    searchInput: '',
    fromDate: '',
    toDate: '',
    typeFilters: [],
    voucherFilters: []
  };

  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) state.searchInput = searchInputEl.value;

  const fromDateEl = document.getElementById('fromDate');
  const toDateEl = document.getElementById('toDate');
  if (fromDateEl) state.fromDate = fromDateEl.value;
  if (toDateEl) state.toDate = toDateEl.value;

  const typeCheckboxes = document.querySelectorAll('#typeFilterMenu input[type="checkbox"]');
  state.typeFilters = Array.from(typeCheckboxes).map(cb => ({
    value: cb.value,
    checked: cb.checked
  }));

  const voucherCheckboxes = document.querySelectorAll('#voucherFilterMenu input[type="checkbox"]');
  state.voucherFilters = Array.from(voucherCheckboxes).map(cb => ({
    value: cb.value,
    checked: cb.checked
  }));

  return state;
}

function restoreFilterState(state) {
  if (!state) return;

  currentPage = state.currentPage || 1;

  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) searchInputEl.value = state.searchInput || '';

  const fromDateEl = document.getElementById('fromDate');
  const toDateEl = document.getElementById('toDate');
  if (fromDateEl) fromDateEl.value = state.fromDate || '';
  if (toDateEl) toDateEl.value = state.toDate || '';

  if (state.typeFilters && state.typeFilters.length > 0) {
    state.typeFilters.forEach(filter => {
      const cb = document.querySelector(`#typeFilterMenu input[value="${CSS.escape(filter.value)}"]`);
      if (cb) cb.checked = filter.checked;
    });
  }

  if (state.voucherFilters && state.voucherFilters.length > 0) {
    state.voucherFilters.forEach(filter => {
      const cb = document.querySelector(`#voucherFilterMenu input[value="${CSS.escape(filter.value)}"]`);
      if (cb) cb.checked = filter.checked;
    });
  }

  filterTable(false);
}


/* =============================================================================
   GLOBAL VARIABLES
================================================================================ */

let currentPage = 1;
let totalPages = 1;
let tableData = [];         // trang hiện tại dạng 2D array [header, ...rows]
let selectedRowIndex = -1;
let selectedRowIndexes = [];

// Lọc / phân trang / tính tổng chạy ở server, trình duyệt chỉ giữ 1 trang
const DEFAULT_ORDER = [{ col: 'id', asc: true }];
const pager = new SQ.ServerPager({ table: TABLE_NAME, pageSize: ROWS_PER_PAGE, sumCols: ['Số lượng (Kg)'], order: DEFAULT_ORDER });
const PAGE1_CACHE_KEY = TABLE_NAME + '_page1';
let voucherOptions = [];    // danh sách Mã chứng từ cho form thêm / sửa

let rollCount = 0;
let editRollCount = 0;

const xgChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('xg_sync_channel') : null;

function broadcastXgEvent(eventType, payload = {}) {
  if (xgChannel) {
    try {
      xgChannel.postMessage({ type: eventType, ...payload, timestamp: Date.now() });
    } catch (err) {
      console.warn('Broadcast error:', err);
    }
  }
}


/* =============================================================================
   LOADING OVERLAY
================================================================================ */

function showLoadingOverlay(message) {
  const existingOverlay = document.getElementById('loadingOverlay');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:9999;">
      <div style="background:#fff;padding:20px 40px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,.1);text-align:center;font-size:18px;font-weight:500;color:#333;">
        <div style="width:40px;height:40px;margin:0 auto 15px;border:4px solid #f3f3f3;border-top:4px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;"></div>
        ${message}
      </div>
    </div>
    <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.remove();
}

function updateLoadingOverlay(message) {
  const box = document.getElementById('loadingOverlay')?.firstElementChild?.firstElementChild;
  if (box && box.lastChild) box.lastChild.textContent = message;
}


/* =============================================================================
   UTILITY FUNCTIONS
================================================================================ */

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
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

function parseRowDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string') {
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let y = parseInt(m[3], 10);
      if (y < 100) y += y < 50 ? 2000 : 1900;
      return new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    }
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

function parseNumericInput(value) {
  let text = String(value ?? '').trim();
  if (!text) return null;
  text = text.replace(/\s+/g, '');
  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  if (hasComma && hasDot) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = text.split(',');
    text = parts.length === 2 ? `${parts[0]}.${parts[1]}` : text.replace(/,/g, '');
  }
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function formatCellQuantityOrWeight(cell, header) {
  if (cell === undefined || cell === null || cell === '') return '';
  const h = String(header || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (h === 'id' || h.endsWith(' id')) {
    const n = parseNumericInput(cell);
    if (n !== null) return n.toString();
  }
  const isQty = h.includes('so luong') || h.includes('trong luong') || h.includes('khoi luong') ||
    h.includes('luong (kg)') || h === 'kg';
  if (isQty) {
    const n = parseNumericInput(cell);
    if (n !== null) return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }
  return cell;
}

// Chuyển object Supabase => mảng theo COLUMN_HEADERS
function rowToArray(obj) {
  return COLUMN_HEADERS.map(col => obj[col] ?? '');
}

// Index cột Số lượng (Kg)
function findQuantityColumnIndex() {
  return COLUMN_HEADERS.indexOf('Số lượng (Kg)');
}


/* =============================================================================
   AUTHENTICATION
================================================================================ */

window.addEventListener('load', () => {
  const currentUser = localStorage.getItem('currentUser');
  const usernameEl = document.getElementById('currentUsername');
  if (usernameEl) usernameEl.textContent = currentUser || 'Khách';

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout && currentUser) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.replace('/pages/index.html');
    });
  }

  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => { window.location.href = '/'; });
  }

  const btnScanBatchLocation = document.getElementById('btnScanBatchLocation');
  if (btnScanBatchLocation) {
    btnScanBatchLocation.addEventListener('click', () => {
      if (window.qrScannerService && window.qrScannerService.openQRCameraScanner) {
        window.qrScannerService.openQRCameraScanner((scannedRack) => {
          const locInputs = document.querySelectorAll('#rollsTableBody .roll-vi-tri');
          if (locInputs.length === 0 && typeof addRollRow === 'function') {
            addRollRow('', '', scannedRack);
          } else {
            locInputs.forEach(input => { input.value = scannedRack; });
          }
        });
      } else {
        alert('Module quét mã QR chưa sẵn sàng.');
      }
    });
  }

  loadSupabaseData();
});


/* =============================================================================
   DATA LOADING - SUPABASE
================================================================================ */

// Bộ lọc hiện tại trên giao diện → bộ lọc gửi lên server
function buildServerFilters() {
  const checkedValues = (menuId) => {
    const menu = document.getElementById(menuId);
    return menu ? Array.from(menu.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value) : [];
  };
  return {
    search: document.getElementById('searchInput')?.value?.trim() || '',
    range: [{
      col: 'Ngày nhập',
      gte: document.getElementById('fromDate')?.value || '',
      lte: document.getElementById('toDate')?.value || ''
    }],
    in: {
      'Loại nhập': checkedValues('typeFilterMenu'),
      'Mã chứng từ': checkedValues('voucherFilterMenu')
    }
  };
}

async function populateDistinctFilterDropdowns() {
  try {
    const [types, vouchers] = await Promise.all([
      SQ.distinct({ table: TABLE_NAME, col: 'Loại nhập', fresh: true }),
      SQ.distinct({ table: TABLE_NAME, col: 'Mã chứng từ', fresh: true })
    ]);
    voucherOptions = vouchers.map(v => String(v).trim()).filter(Boolean);
    populateTypeDropdownFromValues('Loại nhập', 'typeFilterMenu', 'typeFilterBtn', 'typeFilterCount', types);
    populateTypeDropdownFromValues('Mã chứng từ', 'voucherFilterMenu', 'voucherFilterBtn', 'voucherFilterCount', vouchers);
  } catch (e) {
    console.warn('Could not populate distinct filter dropdowns:', e);
  }
}

function populateTypeDropdownFromValues(headerName, menuId, btnId, countId, uniqueValuesList) {
  const menu = document.getElementById(menuId);
  const countEl = document.getElementById(countId);
  if (!menu) return;

  const currentlyChecked = new Set(
    Array.from(menu.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value)
  );

  menu.innerHTML = '';
  const idx = COLUMN_HEADERS.indexOf(headerName);
  if (idx !== -1) menu.dataset.colIndex = String(idx);

  const arr = Array.from(new Set(uniqueValuesList)).sort((a, b) => String(a).localeCompare(String(b), 'vi'));
  const ctrl = document.createElement('div');
  ctrl.className = 'd-flex gap-1 mb-2';
  const selAll = document.createElement('button');
  selAll.type = 'button'; selAll.className = 'btn btn-sm btn-link p-0'; selAll.textContent = 'Chọn tất cả';
  const clr = document.createElement('button');
  clr.type = 'button'; clr.className = 'btn btn-sm btn-link p-0 text-danger'; clr.textContent = 'Bỏ chọn';
  ctrl.appendChild(selAll); ctrl.appendChild(document.createTextNode(' · ')); ctrl.appendChild(clr);
  menu.appendChild(ctrl);

  selAll.addEventListener('click', (e) => {
    e.preventDefault();
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
    filterTable();
  });
  clr.addEventListener('click', (e) => {
    e.preventDefault();
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    if (countEl) countEl.textContent = '0';
    filterTable();
  });

  arr.forEach((v, i) => {
    const id = `typeOpt_${menuId}_${i}`;
    const wrap = document.createElement('div'); wrap.className = 'form-check';
    const input = document.createElement('input');
    input.className = 'form-check-input'; input.type = 'checkbox'; input.value = v; input.id = id;
    if (currentlyChecked.has(v)) input.checked = true;
    const label = document.createElement('label');
    label.className = 'form-check-label'; label.htmlFor = id; label.textContent = v;
    wrap.appendChild(input); wrap.appendChild(label); menu.appendChild(wrap);
    input.addEventListener('change', () => {
      if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
      filterTable();
    });
  });

  if (countEl) countEl.textContent = String(currentlyChecked.size);
}

async function loadSupabaseData() {
  setupFilterEventListeners();

  SQ.applyColumnFilters(pager, buildServerFilters(), DEFAULT_ORDER);

  // Hiển thị ngay trang 1 đã lưu của lần mở trước (khi không có bộ lọc), rồi tải mới từ server
  const cached = typeof getStoredTableCache === 'function' ? getStoredTableCache(PAGE1_CACHE_KEY) : null;
  if (cached && Array.isArray(cached.rows) && Object.keys(pager.filters).length === 0 && pager.order === DEFAULT_ORDER) {
    pager.total = cached.total || 0;
    pager.sums = cached.sums || {};
    applyPageResult({ rows: cached.rows, page: 1, totalPages: pager.totalPages, total: pager.total, sums: pager.sums });
  } else {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = '';
      loadingEl.textContent = 'Đang tải dữ liệu...';
    }
  }

  await Promise.all([populateDistinctFilterDropdowns(), reloadPage(1)]);
}

// Tải lại sau khi thêm / sửa / xóa: đếm lại tổng và giữ trang hiện tại
async function fetchDataFromSupabase(targetPage = 1) {
  pager.invalidate();
  rollNumberCache.clear();
  await reloadPage(targetPage);
}

async function reloadPage(page) {
  const loadingEl = document.getElementById('loading');
  try {
    const result = await pager.load(page);
    if (!result) return;  // đã có yêu cầu mới hơn
    applyPageResult(result);
    if (result.page === 1 && Object.keys(pager.filters).length === 0 && pager.order === DEFAULT_ORDER && typeof setStoredTableCache === 'function') {
      setStoredTableCache(PAGE1_CACHE_KEY, { rows: result.rows, total: result.total, sums: result.sums });
    }
  } catch (error) {
    console.error('Supabase error in reloadPage:', error);
    if (loadingEl && (!tableData || tableData.length <= 1)) {
      loadingEl.style.display = '';
      loadingEl.textContent = `Lỗi kết nối Supabase: ${error.message}`;
    } else {
      (window.showWarningModal || alert)(`Không tải được dữ liệu: ${error.message}`);
    }
  }
}

function applyPageResult(result) {
  currentPage = result.page;
  totalPages = result.totalPages;
  window._rawSupabaseData = result.rows;
  tableData = [COLUMN_HEADERS, ...result.rows.map((row, idx) => {
    const arr = rowToArray(row);
    arr.originalIndex = idx + 1;
    return arr;
  })];
  renderTableData(tableData);
  updatePaginationControls();
  updateQuantitySummary();

  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';
  const btnExport = document.getElementById('btnExport');
  if (btnExport) btnExport.disabled = false;
}

function setupFilterEventListeners() {
  const btnReset = document.getElementById('btnResetFilter');
  const fromInput = document.getElementById('fromDate');
  const toInput = document.getElementById('toDate');
  const searchInput = document.getElementById('searchInput');

  if (btnReset && !btnReset.isEventListenerAttached) {
    btnReset.addEventListener('click', () => {
      if (fromInput) fromInput.value = '';
      if (toInput) toInput.value = '';
      if (searchInput) searchInput.value = '';
      ['typeFilterMenu', 'voucherFilterMenu'].forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu) {
          menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
          const countId = menuId.replace('Menu', 'Count');
          const count = document.getElementById(countId);
          if (count) count.textContent = '0';
        }
      });
      filterTable(true);
    });
    btnReset.isEventListenerAttached = true;
  }

  if (fromInput && !fromInput.isEventListenerAttached) {
    fromInput.addEventListener('change', () => filterTable(true));
    fromInput.isEventListenerAttached = true;
  }
  if (toInput && !toInput.isEventListenerAttached) {
    toInput.addEventListener('change', () => filterTable(true));
    toInput.isEventListenerAttached = true;
  }
  if (searchInput && !searchInput.isEventListenerAttached) {
    searchInput.addEventListener('input', debouncedFilter);
    searchInput.isEventListenerAttached = true;
  }
}


/* =============================================================================
   TABLE RENDERING
================================================================================ */

function renderTableData(data) {
  const table = document.getElementById('dataTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const displayColIndexes = COLUMN_HEADERS
    .map((col, i) => ({ col, i }))
    .filter(({ col }) => !HIDDEN_COLUMNS.includes(col))
    .map(({ i }) => i);

  // Header
  const headerRow = document.createElement('tr');
  const thCheckbox = document.createElement('th');
  thCheckbox.style.width = '50px';
  thCheckbox.innerHTML = '<input type="checkbox" id="selectAllCheckbox" title="Chọn tất cả">';
  headerRow.appendChild(thCheckbox);
  displayColIndexes.forEach(colIdx => {
    const th = document.createElement('th');
    th.textContent = data[0][colIdx] || '';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  setTimeout(() => {
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        document.querySelectorAll('#dataTable tbody .row-checkbox').forEach(cb => { cb.checked = e.target.checked; });
        updateSelectedRows();
      });
    }
  }, 0);

  selectedRowIndex = -1;
  selectedRowIndexes = [];
  document.getElementById('btnEditData').disabled = true;
  document.getElementById('btnDeleteData').disabled = true;
  document.getElementById('btnDeleteData').textContent = 'Xóa dữ liệu';

  const fragment = document.createDocumentFragment();

  for (let i = 1; i < data.length; i++) {
    const originalIndex = data[i].originalIndex ?? tableData.indexOf(data[i]);
    const row = document.createElement('tr');
    row.dataset.rowIndex = String(originalIndex);

    const tdCheckbox = document.createElement('td');
    tdCheckbox.innerHTML = `<input type="checkbox" class="row-checkbox" value="${originalIndex}">`;
    row.appendChild(tdCheckbox);

    displayColIndexes.forEach(colIdx => {
      const td = document.createElement('td');
      const cell = data[i][colIdx];
      const header = data[0][colIdx];
      if (header === 'Ngày nhập') {
        td.textContent = formatDate(cell);
      } else {
        td.textContent = formatCellQuantityOrWeight(cell, header);
      }
      row.appendChild(td);
    });

    row.querySelector('.row-checkbox').addEventListener('change', () => updateSelectedRows());

    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('row-checkbox')) return;
      document.querySelectorAll('#dataTable tbody tr').forEach(r => r.classList.remove('table-active'));
      row.classList.add('table-active');
      selectedRowIndex = Number(row.dataset.rowIndex);
      document.getElementById('btnEditData').disabled = false;
      document.getElementById('btnDeleteData').disabled = false;
    });

    fragment.appendChild(row);
  }

  tbody.appendChild(fragment);

  enableColumnResize(table);
  updateCellTitles(table);
}

function updateCellTitles(table) {
  if (!table) return;
  const cells = table.querySelectorAll('th, td');
  const updates = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.scrollWidth > cell.clientWidth + 1) {
      updates.push({ cell, title: (cell.textContent || '').trim() });
    } else if (cell.hasAttribute('title')) {
      updates.push({ cell, title: null });
    }
  }
  for (let i = 0; i < updates.length; i++) {
    const { cell, title } = updates[i];
    if (title !== null) cell.title = title;
    else cell.removeAttribute('title');
  }
}

function updateSelectedRows() {
  const checkboxes = document.querySelectorAll('#dataTable tbody .row-checkbox');
  selectedRowIndexes = [];
  checkboxes.forEach(cb => { if (cb.checked) selectedRowIndexes.push(parseInt(cb.value, 10)); });

  const btnEdit = document.getElementById('btnEditData');
  const btnDelete = document.getElementById('btnDeleteData');

  if (selectedRowIndexes.length > 0) {
    if (btnDelete) {
      btnDelete.disabled = false;
      btnDelete.textContent = `Xóa đã chọn (${selectedRowIndexes.length})`;
      btnDelete.removeAttribute('title');
    }
    if (btnEdit) {
      btnEdit.disabled = selectedRowIndexes.length !== 1;
      btnEdit.removeAttribute('title');
    }
  } else {
    if (btnEdit) {
      btnEdit.disabled = true;
      btnEdit.removeAttribute('title');
    }
    if (btnDelete) {
      btnDelete.disabled = true;
      btnDelete.textContent = 'Xóa dữ liệu';
      btnDelete.removeAttribute('title');
    }
  }

  selectedRowIndex = selectedRowIndexes.length === 1 ? selectedRowIndexes[0] : -1;
}

window.addEventListener('resize', () => updateCellTitles(document.getElementById('dataTable')));


/* =============================================================================
   COLUMN RESIZE
================================================================================ */

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

    let startX = 0, startWidth = 0, startTableWidth = 0;

    function onMouseMove(e) {
      const diff = e.clientX - startX;
      const newWidth = Math.max(40, startWidth + diff);
      th.style.width = newWidth + 'px';
      table.style.width = Math.max(startTableWidth, startTableWidth + (newWidth - startWidth)) + 'px';
      const tb = table.tBodies?.[0];
      if (tb) for (const row of tb.rows) { const cell = row.children[index]; if (cell) cell.style.width = newWidth + 'px'; }
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      ths.forEach(t => { if (!t.style.width) t.style.width = t.offsetWidth + 'px'; });
      startX = e.clientX; startWidth = th.offsetWidth; startTableWidth = table.offsetWidth;
      table.style.width = startTableWidth + 'px';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}


/* =============================================================================
   PAGINATION
================================================================================ */

function updatePaginationControls() {
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageSelect = document.getElementById('pageSelect');

  if (pageInfo) pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  if (pageSelect) {
    const currentVal = parseInt(pageSelect.value, 10);
    if (currentVal !== currentPage || pageSelect.options.length !== totalPages) {
      pageSelect.innerHTML = '';
      for (let i = 1; i <= totalPages; i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = `Trang ${i}`;
        if (i === currentPage) opt.selected = true;
        pageSelect.appendChild(opt);
      }
    }
  }
}

function goToPage(page) {
  const newPage = parseInt(page, 10);
  if (newPage >= 1 && newPage <= totalPages) reloadPage(newPage);
}

function nextPage() {
  if (currentPage < totalPages) reloadPage(currentPage + 1);
}

function prevPage() {
  if (currentPage > 1) reloadPage(currentPage - 1);
}

// Tổng Số lượng (Kg) + số dòng theo toàn bộ dữ liệu đang lọc (server tính trên mọi trang)
function updateQuantitySummary() {
  const valueEl = document.getElementById('totalQtyValue');
  const rowsEl = document.getElementById('totalQtyRows');
  if (!valueEl || !rowsEl) return;
  const total = Number(pager.sums['Số lượng (Kg)']) || 0;
  valueEl.textContent = total.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
  rowsEl.textContent = (pager.total || 0).toLocaleString('vi-VN');
}


/* =============================================================================
   FILTERING
================================================================================ */

const debouncedFilter = debounce(filterTable, 300);

// Lọc ở server; resetPage = false giữ trang hiện tại (vd: sau khi sửa dữ liệu)
function filterTable(resetPage = true) {
  SQ.applyColumnFilters(pager, buildServerFilters(), DEFAULT_ORDER);
  return reloadPage(resetPage ? 1 : currentPage);
}

// Bộ lọc / sắp xếp theo cột trên tiêu đề bảng (home.js) chạy ở server
window.ddcServerAdapter = {
  table: TABLE_NAME,
  column: (key) => SQ.headerColumn(COLUMN_HEADERS, key, { date: ['Ngày nhập'], number: ['id', 'Số lượng (Kg)'] }),
  baseFilters: buildServerFilters,
  reload: () => filterTable(true)
};


/* =============================================================================
   EXPORT
================================================================================ */

document.getElementById('btnExport').addEventListener('click', async () => {
  const btnExport = document.getElementById('btnExport');
  let allRows;
  try {
    if (btnExport) btnExport.disabled = true;
    showLoadingOverlay('Đang tải dữ liệu để xuất Excel...');
    allRows = await SQ.exportRows({
      table: TABLE_NAME,
      filters: pager.filters,
      onProgress: (n, total) => updateLoadingOverlay(`Đang tải ${n.toLocaleString('vi-VN')} / ${(total || n).toLocaleString('vi-VN')} dòng...`)
    });
  } catch (err) {
    alert(`Lỗi xuất Excel: ${err.message}`);
    return;
  } finally {
    hideLoadingOverlay();
    if (btnExport) btnExport.disabled = false;
  }
  if (!allRows) return;

  const exportData = [COLUMN_HEADERS, ...allRows.map(rowToArray)].map(row =>
    row.filter((_, colIdx) => !HIDDEN_COLUMNS.includes(COLUMN_HEADERS[colIdx]))
  );

  const ws = XLSX.utils.aoa_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Du lieu');

  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxWidth = 10;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
      if (cell && cell.v) { const len = String(cell.v).length; if (len > maxWidth) maxWidth = len; }
    }
    ws['!cols'] = ws['!cols'] || [];
    ws['!cols'][C] = { wch: Math.min(60, maxWidth + 2) };
  }

  XLSX.writeFile(wb, 'xg_du_lieu_nhap.xlsx');
});


/* =============================================================================
   MODAL MANAGEMENT
================================================================================ */

function setupModalPermissions(modalEl) {
  const perms = (typeof getUserPermissions === 'function')
    ? getUserPermissions('xg')
    : { canAdd: true, canEdit: true, canDelete: true, isAdmin: true };

  if (!modalEl) return perms.isAdmin;

  const modalId = (modalEl.id || '').toLowerCase();
  let hasPerm = perms.isAdmin;

  if (modalId.includes('delete')) {
    hasPerm = perms.isAdmin || perms.canDelete;
  } else if (modalId.includes('add')) {
    hasPerm = perms.isAdmin || perms.canAdd;
  } else if (modalId.includes('edit')) {
    hasPerm = perms.isAdmin || perms.canEdit;
  } else {
    hasPerm = perms.isAdmin || perms.canEdit || perms.canAdd;
  }

  modalEl.querySelectorAll('input, select, textarea').forEach(input => { input.disabled = false; });

  const submitBtn = modalEl.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.style.display = '';

  const btnConfirmDelete = modalEl.querySelector('#btnConfirmDelete');
  if (btnConfirmDelete) btnConfirmDelete.style.display = '';

  const btnAddRollEl = modalEl.querySelector('#btnAddRoll, #btnEditAddRoll');
  if (btnAddRollEl) btnAddRollEl.style.display = '';

  modalEl.querySelectorAll('.btn-remove-roll, .btn-remove-edit-roll').forEach(btn => {
    btn.style.display = '';
  });

  // Chỉ các nút hành động có data-perm (Thêm / Cập nhật / Xóa / Đồng bộ...) bị khóa khi không có quyền:
  // bấm vào sẽ bị chặn kèm thông báo (applyElementPermissions trong supabase-config.js).
  if (typeof applyElementPermissions === 'function') applyElementPermissions('xg');

  return hasPerm;
}

// Helper: build form field
function buildFormField(colName, colIdx, currentVal, container, namePrefix) {
  const col = document.createElement('div');
  col.className = 'col-12 col-md-6';
  const label = document.createElement('label');
  label.className = 'form-label';
  const fieldName = namePrefix + colIdx;

  if (colName === 'Mã chứng từ') {
    const voucherSet = new Set(voucherOptions);
    if (currentVal !== undefined && String(currentVal).trim()) voucherSet.add(String(currentVal).trim());
    const select = document.createElement('select');
    select.className = 'form-select form-select-sm fw-bold';
    select.name = fieldName;
    select.innerHTML = '<option value="">-- Chọn mã --</option>';
    Array.from(voucherSet).sort((a, b) => a.localeCompare(b, 'vi')).forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      if (currentVal !== undefined && v === String(currentVal).trim()) opt.selected = true;
      select.appendChild(opt);
    });
    select.required = true;
    label.innerHTML = `${colName} <span class="text-danger">*</span>`;
    col.appendChild(label); col.appendChild(select);
    container.appendChild(col);
    return;
  }

  if (colName === 'Ngày nhập') {
    const dateInput = document.createElement('input');
    dateInput.className = 'form-control form-control-sm fw-bold';
    dateInput.name = fieldName; dateInput.type = 'date'; dateInput.required = true;
    if (currentVal) {
      const iso = String(currentVal).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) { dateInput.value = `${iso[1]}-${iso[2]}-${iso[3]}`; }
      else {
        const m = String(currentVal).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          let y = m[3];
          if (y.length === 2) y = (parseInt(y, 10) < 50 ? '20' : '19') + y;
          dateInput.value = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
        }
      }
    } else {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    label.innerHTML = `${colName} <span class="text-danger">*</span>`;
    col.appendChild(label); col.appendChild(dateInput);
    container.appendChild(col);
    return;
  }

  if (colName === 'Loại nhập') {
    const select = document.createElement('select');
    select.className = 'form-select form-select-sm fw-bold';
    select.name = fieldName;
    select.innerHTML = '<option value="">-- Chọn loại nhập --</option>';
    ['Nhà cung cấp', 'Xưởng sản xuất', 'Gia công ngoài', 'Công trình'].forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      if (currentVal !== undefined && v === String(currentVal).trim()) opt.selected = true;
      select.appendChild(opt);
    });
    select.required = true;
    label.innerHTML = `${colName} <span class="text-danger">*</span>`;
    col.appendChild(label); col.appendChild(select);
    container.appendChild(col);
    return;
  }

  // Default text input
  const input = document.createElement('input');
  input.className = 'form-control form-control-sm fw-bold';
  input.name = fieldName; input.type = 'text';
  if (currentVal !== undefined) input.value = currentVal;
  const isOptional = colName === 'Ghi chú';
  if (!isOptional) {
    input.required = true;
    label.innerHTML = `${colName} <span class="text-danger">*</span>`;
  } else {
    label.textContent = colName;
  }
  col.appendChild(label); col.appendChild(input);
  container.appendChild(col);
}


// ===== ADD DATA MODAL =====

function openAddDataModal() {
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();

  const modalEl = document.getElementById('addDataModal');
  if (!modalEl) return;
  setupModalPermissions(modalEl);

  const commonFieldsContainer = document.getElementById('addDataCommonFields');
  const additionalFieldsContainer = document.getElementById('addDataAdditionalFields');
  if (!commonFieldsContainer || !additionalFieldsContainer) return;
  commonFieldsContainer.innerHTML = '';
  additionalFieldsContainer.innerHTML = '';

  const rollsTableBody = document.getElementById('rollsTableBody');
  if (rollsTableBody) rollsTableBody.innerHTML = '';
  rollCount = 0;
  if (window.XgSapLookup && window.XgSapLookup.resetSapSelection) {
    window.XgSapLookup.resetSapSelection();
  }
  updateRollTotals();

  const quantityColIndex = findQuantityColumnIndex();
  // Cột trước Số lượng (bỏ id, Cuộn ID, Vị trí)
  const commonColIndices = [1, 2, 3, 4, 5, 6, 7]; // Mã CT, Ngày, Phiếu, Loại, Mã VT, Tên VT, Batch

  commonColIndices.forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, undefined, commonFieldsContainer, 'col_');
  });

  const maVatTuInput = commonFieldsContainer.querySelector('input[name="col_5"]');
  if (maVatTuInput) {
    maVatTuInput.addEventListener('input', debounce(updateRollCuonIds, 250));
  }

  // Tích hợp Autocomplete SAP cho ô Phiếu nhập (col_3)
  const phieuNhapInput = commonFieldsContainer.querySelector('input[name="col_3"]');
  if (phieuNhapInput && window.XgSapLookup && window.XgSapLookup.initSapDocumentAutocomplete) {
    phieuNhapInput.placeholder = 'Gõ số phiếu nhập để tìm SAP...';
    phieuNhapInput.setAttribute('autocomplete', 'off');
    const formEl = document.getElementById('addDataForm');
    window.XgSapLookup.initSapDocumentAutocomplete(phieuNhapInput, formEl);
  }

  // Cột sau Số lượng: Vị trí(10), Mã CT(11), Tên CT(12), Ghi chú(13) - Vị trí ở bảng cuộn
  // Chỉ render Mã công trình, Tên công trình, Ghi chú trong additional
  const additionalColIndices = [];
  for (let i = quantityColIndex + 1; i < COLUMN_HEADERS.length; i++) {
    if (!HIDDEN_COLUMNS.includes(COLUMN_HEADERS[i]) && COLUMN_HEADERS[i] !== 'Vị trí') {
      additionalColIndices.push(i);
    }
  }
  additionalColIndices.forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, undefined, additionalFieldsContainer, 'add_ext_');
  });

  modalEl.dataset.quantityColIndex = String(quantityColIndex);
  modalEl.dataset.additionalColIndices = JSON.stringify(additionalColIndices);

  const btnAddRoll = document.getElementById('btnAddRoll');
  if (btnAddRoll) btnAddRoll.onclick = () => addRollRow();

  // Nút đồng bộ Google Sheets trên card Thông tin chung
  const btnSyncGgSheet = document.getElementById('btnSyncGgSheet');
  if (btnSyncGgSheet) {
    btnSyncGgSheet.onclick = () => {
      if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
        window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet);
      }
    };
    // Tự động đồng bộ Google Sheets nền khi mở modal
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
    }
  }

  new bootstrap.Modal(modalEl).show();
}


// ===== EDIT DATA MODAL =====

function openEditDataModal() {
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();

  if (selectedRowIndex < 0 || selectedRowIndex >= tableData.length) {
    alert('Vui lòng chọn một dòng để sửa');
    return;
  }

  const modalEl = document.getElementById('editDataModal');
  if (!modalEl) return;
  setupModalPermissions(modalEl);

  const commonFieldsContainer = document.getElementById('editDataCommonFields');
  const additionalFieldsContainer = document.getElementById('editDataAdditionalFields');
  if (!commonFieldsContainer || !additionalFieldsContainer) return;
  commonFieldsContainer.innerHTML = '';
  additionalFieldsContainer.innerHTML = '';

  const editRollsTableBody = document.getElementById('editRollsTableBody');
  if (editRollsTableBody) editRollsTableBody.innerHTML = '';
  editRollCount = 0;
  if (window.XgSapLookup && window.XgSapLookup.resetSapSelection) {
    window.XgSapLookup.resetSapSelection();
  }
  updateEditRollTotals();

  const rowData = tableData[selectedRowIndex];
  const quantityColIndex = findQuantityColumnIndex();
  const commonColIndices = [1, 2, 3, 4, 5, 6, 7];

  // Hidden id
  const hiddenIdInput = document.createElement('input');
  hiddenIdInput.type = 'hidden'; hiddenIdInput.name = 'row_id';
  hiddenIdInput.value = rowData[0] ?? '';
  commonFieldsContainer.appendChild(hiddenIdInput);

  commonColIndices.forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, rowData[colIdx], commonFieldsContainer, 'col_');
  });

  const maVatTuInput = commonFieldsContainer.querySelector('input[name="col_5"]');
  if (maVatTuInput) {
    maVatTuInput.addEventListener('input', debounce(updateEditRollCuonIds, 250));
  }

  // Tích hợp Autocomplete SAP cho ô Phiếu nhập trong modal Sửa
  const phieuNhapEditInput = commonFieldsContainer.querySelector('input[name="col_3"]');
  if (phieuNhapEditInput && window.XgSapLookup && window.XgSapLookup.initSapDocumentAutocomplete) {
    phieuNhapEditInput.placeholder = 'Gõ số phiếu nhập để tìm SAP...';
    phieuNhapEditInput.setAttribute('autocomplete', 'off');
    const formEl = document.getElementById('editDataForm');
    window.XgSapLookup.initSapDocumentAutocomplete(phieuNhapEditInput, formEl);
  }

  // Existing roll data
  const existingKg = rowData[quantityColIndex] ? String(parseNumericInput(rowData[quantityColIndex]) || '') : '';
  const cuonIdIdx = COLUMN_HEADERS.indexOf('Cuộn ID');
  const viTriIdx = COLUMN_HEADERS.indexOf('Vị trí');
  const existingCuonId = cuonIdIdx >= 0 ? String(rowData[cuonIdIdx] || '').trim() : '';
  const existingViTri = viTriIdx >= 0 ? String(rowData[viTriIdx] || '').trim() : '';
  addEditRollRow(existingCuonId, existingKg, existingViTri);

  const additionalColIndices = [];
  for (let i = quantityColIndex + 1; i < COLUMN_HEADERS.length; i++) {
    if (!HIDDEN_COLUMNS.includes(COLUMN_HEADERS[i]) && COLUMN_HEADERS[i] !== 'Vị trí') {
      additionalColIndices.push(i);
    }
  }
  additionalColIndices.forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, rowData[colIdx], additionalFieldsContainer, 'edit_ext_');
  });

  modalEl.dataset.quantityColIndex = String(quantityColIndex);
  modalEl.dataset.additionalColIndices = JSON.stringify(additionalColIndices);

  const btnEditAddRoll = document.getElementById('btnEditAddRoll');
  if (btnEditAddRoll) btnEditAddRoll.onclick = () => addEditRollRow();

  // Nút đồng bộ Google Sheets trên card Thông tin chung modal Sửa
  const btnEditSyncGgSheet = document.getElementById('btnEditSyncGgSheet');
  if (btnEditSyncGgSheet) {
    btnEditSyncGgSheet.onclick = () => {
      if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
        window.XgSapLookup.syncFromGoogleSheets(btnEditSyncGgSheet);
      }
    };
    // Tự động đồng bộ Google Sheets nền khi mở modal sửa
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnEditSyncGgSheet, { isAuto: true });
    }
  }

  new bootstrap.Modal(modalEl).show();
}


// ===== DELETE DATA MODAL =====

function openDeleteDataModal() {
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();

  updateSelectedRows();

  if (selectedRowIndexes.length === 0) {
    alert('Vui lòng chọn ít nhất một dòng để xóa');
    return;
  }

  const modalBody = document.querySelector('#deleteDataModal .modal-body p');
  if (modalBody) {
    modalBody.textContent = selectedRowIndexes.length === 1
      ? 'Bạn có chắc chắn muốn xóa dòng dữ liệu này? Hành động này không thể hoàn tác.'
      : `Bạn có chắc chắn muốn xóa ${selectedRowIndexes.length} dòng dữ liệu đã chọn? Hành động này không thể hoàn tác.`;
  }

  const modalEl = document.getElementById('deleteDataModal');
  if (!modalEl) return;

  // Nút "Xóa" luôn hiện; người không có quyền bấm vào sẽ bị chặn kèm thông báo (data-perm="delete")
  if (typeof applyElementPermissions === 'function') applyElementPermissions('xg');

  new bootstrap.Modal(modalEl).show();
}


/* =============================================================================
   ROLL MANAGEMENT
================================================================================ */

function extractRollIndex(cuonId) {
  if (!cuonId || typeof cuonId !== 'string') return null;
  const match = cuonId.match(/(?:Cuộn|cuon)\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

// Số cuộn kế tiếp của 1 mã vật tư tính ở server trên toàn bảng (không chỉ trang đang xem).
// Cache theo mã để gõ phím / thêm dòng không gọi server lặp lại; xóa cache sau mỗi lần ghi.
const rollNumberCache = new Map();
let rollIdRequestToken = 0;

function fetchNextRollNumber(maVatTu, excludeRowId = null) {
  const key = `${String(maVatTu).trim().toLowerCase()}|${excludeRowId || ''}`;
  if (!rollNumberCache.has(key)) {
    rollNumberCache.set(key, SQ.nextRollNumber(TABLE_NAME, maVatTu, excludeRowId).catch(err => {
      rollNumberCache.delete(key);
      throw err;
    }));
  }
  return rollNumberCache.get(key);
}

// Như cũ: lớn nhất trong (các cuộn đã có của mã vật tư + các Cuộn ID thêm vào) rồi + 1; chưa có thì 0
async function getNextRollNumber(maVatTu, excludeRowId = null, extraCuonIds = []) {
  if (!maVatTu) return 0;
  const serverNext = await fetchNextRollNumber(maVatTu, excludeRowId);
  const extraNumbers = (extraCuonIds || []).map(extractRollIndex).filter(num => num !== null && !isNaN(num));
  const extraNext = extraNumbers.length ? Math.max(...extraNumbers) + 1 : 0;
  return Math.max(serverNext, extraNext);
}

async function updateRollCuonIds() {
  const maVatTuInput = document.querySelector('#addDataCommonFields input[name="col_5"]');
  if (!maVatTuInput) return;
  const maVatTu = maVatTuInput.value.trim();
  const token = ++rollIdRequestToken;
  if (!maVatTu) {
    document.querySelectorAll('#rollsTableBody .roll-cuon-id').forEach(input => { input.value = ''; });
    return;
  }

  let startNum;
  try {
    startNum = await getNextRollNumber(maVatTu);
  } catch (err) {
    console.warn('[xg-nhap] Không lấy được số cuộn kế tiếp:', err);
    return;
  }
  if (token !== rollIdRequestToken || maVatTuInput.value.trim() !== maVatTu) return;

  document.querySelectorAll('#rollsTableBody tr').forEach((row, index) => {
    const cuonIdInput = row.querySelector('.roll-cuon-id');
    if (cuonIdInput) {
      cuonIdInput.value = `${maVatTu} - Cuộn ${startNum + index}`;
    }
  });
}

let editRollIdRequestToken = 0;

async function updateEditRollCuonIds() {
  const maVatTuInput = document.querySelector('#editDataCommonFields input[name="col_5"]');
  if (!maVatTuInput) return;
  const maVatTu = maVatTuInput.value.trim();
  const token = ++editRollIdRequestToken;
  if (!maVatTu) {
    document.querySelectorAll('#editRollsTableBody .edit-roll-cuon-id').forEach(input => { input.value = ''; });
    return;
  }

  const rowId = document.querySelector('#editDataCommonFields input[name="row_id"]')?.value;
  const rows = Array.from(document.querySelectorAll('#editRollsTableBody tr'));
  if (rows.length === 0) return;

  // Thu thập các Cuộn ID đã có sẵn trong modal (dòng đầu tiên là dòng gốc)
  const existingModalCuonIds = [];
  rows.forEach((row, idx) => {
    const inp = row.querySelector('.edit-roll-cuon-id');
    const val = inp ? inp.value.trim() : '';
    if (idx === 0 && val) {
      existingModalCuonIds.push(val);
    }
  });

  let nextNum;
  try {
    nextNum = await getNextRollNumber(maVatTu, rowId, existingModalCuonIds);
  } catch (err) {
    console.warn('[xg-nhap] Không lấy được số cuộn kế tiếp:', err);
    return;
  }
  if (token !== editRollIdRequestToken || maVatTuInput.value.trim() !== maVatTu) return;

  Array.from(document.querySelectorAll('#editRollsTableBody tr')).forEach((row, index) => {
    const cuonIdInput = row.querySelector('.edit-roll-cuon-id');
    if (!cuonIdInput) return;
    
    // Nếu là dòng đầu tiên và đã có giá trị gốc hợp lệ thì không ghi đè
    if (index === 0 && cuonIdInput.value.trim()) {
      return;
    }

    cuonIdInput.value = `${maVatTu} - Cuộn ${nextNum}`;
    nextNum++;
  });
}

function addRollRow(cuonId = '', kgValue = '', viTri = '') {
  rollCount++;
  const tbody = document.getElementById('rollsTableBody');
  const tr = document.createElement('tr');
  tr.dataset.rollId = rollCount;

  if (!viTri) {
    const urlParams = new URLSearchParams(window.location.search);
    const vitriParam = urlParams.get('vitri') || urlParams.get('loc') || urlParams.get('location');
    if (vitriParam) {
      viTri = window.qrScannerService ? window.qrScannerService.parseLocationQRCode(vitriParam) : vitriParam.trim().toUpperCase();
    }
  }

  tr.innerHTML = `
    <td class="text-center roll-stt">${rollCount}</td>
    <td><input type="text" class="form-control form-control-sm roll-cuon-id" readonly placeholder="Cuộn ID" value="${escapeHtml(cuonId)}"></td>
    <td><input type="number" class="form-control form-control-sm roll-kg" step="any" min="0" inputMode="decimal" required placeholder="Nhập số kg" value="${escapeHtml(kgValue)}"></td>
    <td>
      <div class="input-group input-group-sm">
        <input type="text" class="form-control form-control-sm roll-vi-tri" required placeholder="Vị trí" value="${escapeHtml(viTri)}">
        <button type="button" class="btn btn-outline-secondary btn-scan-row-loc" title="Quét mã QR vị trí"><i class="bi bi-qr-code-scan"></i></button>
      </div>
    </td>
    <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger btn-remove-roll">X</button></td>
  `;
  tbody.appendChild(tr);

  const btnScanLoc = tr.querySelector('.btn-scan-row-loc');
  if (btnScanLoc) {
    btnScanLoc.addEventListener('click', () => {
      if (window.qrScannerService && window.qrScannerService.openQRCameraScanner) {
        window.qrScannerService.openQRCameraScanner((scannedRack) => {
          const locInput = tr.querySelector('.roll-vi-tri');
          if (locInput) locInput.value = scannedRack;
        });
      }
    });
  }

  tr.querySelector('.btn-remove-roll').addEventListener('click', () => { 
    tr.remove(); 
    updateRollNumbers(); 
    updateRollTotals(); 
    updateRollCuonIds(); 
  });
  tr.querySelector('.roll-kg').addEventListener('input', updateRollTotals);
  
  if (!cuonId) {
    updateRollCuonIds();
  }
  updateRollTotals();
}

function updateRollNumbers() {
  document.querySelectorAll('#rollsTableBody tr').forEach((row, i) => { row.querySelector('.roll-stt').textContent = i + 1; });
}

function updateRollTotals() {
  let totalKg = 0, rollsWithKg = 0;
  document.querySelectorAll('#rollsTableBody tr').forEach(row => {
    const kgInput = row.querySelector('.roll-kg');
    if (kgInput && kgInput.value) {
      const parsed = parseNumericInput(kgInput.value);
      if (parsed !== null && parsed > 0) { totalKg += parsed; rollsWithKg++; }
    }
  });
  const totalRollsEl = document.getElementById('totalRollsCount');
  const totalKgEl = document.getElementById('totalKg');
  if (totalRollsEl) totalRollsEl.textContent = rollsWithKg;
  if (totalKgEl) totalKgEl.textContent = totalKg.toFixed(2).replace('.', ',');

  // Đối chiếu khối lượng SAP
  if (window.XgSapLookup && typeof window.XgSapLookup.updateSapReconciliationDisplay === 'function') {
    window.XgSapLookup.updateSapReconciliationDisplay(totalKg);
  }
}

function addEditRollRow(cuonId = '', kgValue = '', viTri = '') {
  editRollCount++;
  const tbody = document.getElementById('editRollsTableBody');
  const tr = document.createElement('tr');
  tr.dataset.rollId = editRollCount;
  tr.innerHTML = `
    <td class="text-center edit-roll-stt">${editRollCount}</td>
    <td><input type="text" class="form-control form-control-sm edit-roll-cuon-id" readonly placeholder="Cuộn ID" value="${escapeHtml(cuonId)}"></td>
    <td><input type="number" class="form-control form-control-sm edit-roll-kg" step="any" min="0" inputMode="decimal" required placeholder="Nhập số kg" value="${escapeHtml(kgValue)}"></td>
    <td>
      <div class="input-group input-group-sm">
        <input type="text" class="form-control form-control-sm edit-roll-vi-tri" required placeholder="Vị trí" value="${escapeHtml(viTri)}">
        <button type="button" class="btn btn-outline-secondary btn-scan-edit-row-loc" title="Quét mã QR vị trí"><i class="bi bi-qr-code-scan"></i></button>
      </div>
    </td>
    <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger btn-remove-edit-roll">X</button></td>
  `;
  tbody.appendChild(tr);

  const btnScanEditLoc = tr.querySelector('.btn-scan-edit-row-loc');
  if (btnScanEditLoc) {
    btnScanEditLoc.addEventListener('click', () => {
      if (window.qrScannerService && window.qrScannerService.openQRCameraScanner) {
        window.qrScannerService.openQRCameraScanner((scannedRack) => {
          const locInput = tr.querySelector('.edit-roll-vi-tri');
          if (locInput) locInput.value = scannedRack;
        });
      }
    });
  }

  tr.querySelector('.btn-remove-edit-roll').addEventListener('click', () => { 
    tr.remove(); 
    updateEditRollNumbers(); 
    updateEditRollTotals(); 
    updateEditRollCuonIds(); 
  });
  tr.querySelector('.edit-roll-kg').addEventListener('input', updateEditRollTotals);
  
  if (!cuonId) {
    updateEditRollCuonIds();
  }
  updateEditRollTotals();
}

function updateEditRollNumbers() {
  document.querySelectorAll('#editRollsTableBody tr').forEach((row, i) => { row.querySelector('.edit-roll-stt').textContent = i + 1; });
}

function updateEditRollTotals() {
  let totalKg = 0, rollsWithKg = 0;
  document.querySelectorAll('#editRollsTableBody tr').forEach(row => {
    const kgInput = row.querySelector('.edit-roll-kg');
    if (kgInput && kgInput.value) {
      const parsed = parseNumericInput(kgInput.value);
      if (parsed !== null && parsed > 0) { totalKg += parsed; rollsWithKg++; }
    }
  });
  const totalRollsEl = document.getElementById('editTotalRollsCount');
  const totalKgEl = document.getElementById('editTotalKg');
  if (totalRollsEl) totalRollsEl.textContent = rollsWithKg;
  if (totalKgEl) totalKgEl.textContent = totalKg.toFixed(2).replace('.', ',');

  // Đối chiếu khối lượng SAP trong modal Sửa
  if (window.XgSapLookup && typeof window.XgSapLookup.updateSapReconciliationDisplay === 'function') {
    window.XgSapLookup.updateSapReconciliationDisplay(totalKg, true);
  }
}


/* =============================================================================
   FORM HANDLERS - SUPABASE CRUD
================================================================================ */

document.addEventListener('submit', async (e) => {
  try {
    // ===== ADD DATA =====
    if (e.target && e.target.id === 'addDataForm') {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : 'Thêm';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang thêm...'; }
      showLoadingOverlay('Đang thêm dữ liệu...');

      // Lấy dữ liệu cuộn
      const rollDataList = [];
      document.querySelectorAll('#rollsTableBody tr').forEach(row => {
        const kgInput = row.querySelector('.roll-kg');
        if (kgInput && kgInput.value) {
          const parsed = parseNumericInput(kgInput.value);
          if (parsed !== null && parsed > 0) {
            rollDataList.push({
              kg: parsed,
              cuonId: row.querySelector('.roll-cuon-id')?.value.trim() || '',
              viTri: row.querySelector('.roll-vi-tri')?.value.trim() || ''
            });
          }
        }
      });

      if (rollDataList.length === 0) {
        alert('Vui lòng nhập ít nhất một cuộn với số kg > 0');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
        hideLoadingOverlay(); return;
      }

      // Kiểm tra khớp hoàn toàn số kg với SAP: chỉ khớp 100% mới được thêm
      const totalRollKg = rollDataList.reduce((sum, r) => sum + (r.kg || 0), 0);
      if (window.XgSapLookup) {
        const phieuNhapVal = (form.querySelector('input[name="col_3"]')?.value || '').trim();

        // Phiếu nhập phải có trên Google Sheets (dữ liệu SAP MB51 đã đồng bộ, đúng phân hệ) mới được nhập
        let sapReceiptGroups = null;
        if (typeof window.XgSapLookup.findReceiptInSap === 'function') {
          const sapReceipt = await window.XgSapLookup.findReceiptInSap(phieuNhapVal, 'xg-nhap');
          if (!sapReceipt.found) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
            hideLoadingOverlay();
            window.XgSapLookup.showExportReceiptMismatchModal({
              docNo: phieuNhapVal || '(chưa nhập)',
              notFoundInSap: true,
              lookupError: sapReceipt.error,
              otherContextGroups: sapReceipt.otherContextGroups
            }, 'xg-nhap', () => window.XgSapLookup.syncFromGoogleSheets(document.getElementById('btnSyncGgSheet')));
            return;
          }
          sapReceiptGroups = sapReceipt.groups;
          // Đã sửa ô Phiếu nhập sau khi chọn gợi ý SAP → bỏ bản ghi cũ, tra lại theo phiếu hiện tại
          const selectedDoc = String(window._currentSelectedSapRecord?.material_document || '').trim().toLowerCase();
          if (selectedDoc && selectedDoc !== phieuNhapVal.toLowerCase()) window._currentSelectedSapRecord = null;
        }

        if (!window._currentSelectedSapRecord && phieuNhapVal) {
          try {
            const exact = sapReceiptGroups || window.XgSapLookup.groupSapMb51Rows(await window.XgSapLookup.querySapMb51(phieuNhapVal))
              .filter(g => String(g.material_document || '').toLowerCase() === phieuNhapVal.toLowerCase());
            if (exact.length > 0) {
              const maVatTuVal = (form.querySelector('input[name="col_5"]')?.value || '').trim().toLowerCase();
              const matchedGroup = exact.find(g => !maVatTuVal || String(g.material || '').toLowerCase() === maVatTuVal) || exact[0];
              if (matchedGroup) {
                window._currentSelectedSapRecord = matchedGroup;
                if (typeof updateRollTotals === 'function') updateRollTotals();
              }
            }
          } catch (err) {
            console.warn('[xg-nhap] Không thể tra cứu SAP trước khi lưu:', err);
          }
        }

        if (typeof window.XgSapLookup.validateSapMatch === 'function') {
          const sapCheck = window.XgSapLookup.validateSapMatch(totalRollKg, false);
          if (!sapCheck.valid) {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
            }
            hideLoadingOverlay();
            if (typeof window.showWarningModal === 'function') {
              window.showWarningModal(sapCheck.modalHtml || sapCheck.message, 'Cảnh báo không cho phép thêm');
            } else {
              alert(sapCheck.message);
            }
            return;
          }
        }
      }

      // Kiểm tra nếu loại hàng trong phiếu nhập đã có trong kho -> CHẶN LOẠI ĐÃ NHẬP
      const phieuNhapInputVal = (form.querySelector('input[name="col_3"]')?.value || '').trim();
      const maVatTuInputVal = (form.querySelector('input[name="col_5"]')?.value || '').trim();
      const batchInputVal = (form.querySelector('input[name="col_7"]')?.value || '').trim();

      if (phieuNhapInputVal && window.XgSapLookup && typeof window.XgSapLookup.checkReceiptItemProcessed === 'function') {
        const procCheck = await window.XgSapLookup.checkReceiptItemProcessed(phieuNhapInputVal, maVatTuInputVal, batchInputVal, 'xg-nhap');
        if (procCheck && procCheck.isProcessed) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
          hideLoadingOverlay();
          window.XgSapLookup.showReceiptProcessedWarningModal({
            docNo: phieuNhapInputVal,
            pageContext: 'xg-nhap',
            processedInfo: procCheck,
            sapRecord: window._currentSelectedSapRecord || {
              material: maVatTuInputVal,
              batch: batchInputVal
            },
            onCancel: () => {
              if (typeof window.XgSapLookup.resetSapSelection === 'function') {
                window.XgSapLookup.resetSapSelection();
              }
            }
          });
          return;
        }
      }

      // Lấy dữ liệu chung từ form
      const commonData = {};
      form.querySelectorAll('#addDataCommonFields input[name^="col_"], #addDataCommonFields select[name^="col_"]').forEach(inp => {
        const colIdx = parseInt(inp.name.replace('col_', ''), 10);
        commonData[COLUMN_HEADERS[colIdx]] = inp.value || null;
      });

      // Lấy dữ liệu bổ sung
      const extData = {};
      form.querySelectorAll('#addDataAdditionalFields input[name^="add_ext_"], #addDataAdditionalFields select[name^="add_ext_"]').forEach(inp => {
        const colIdx = parseInt(inp.name.replace('add_ext_', ''), 10);
        extData[COLUMN_HEADERS[colIdx]] = inp.value || null;
      });

      // Kiểm tra trùng Cuộn ID trong cùng danh sách nhập
      const inputCuonIds = rollDataList.map(r => (r.cuonId || '').trim().toLowerCase()).filter(Boolean);
      const duplicateInBatch = inputCuonIds.filter((item, index) => inputCuonIds.indexOf(item) !== index);
      if (duplicateInBatch.length > 0) {
        alert(`⚠️ Cuộn ID "${duplicateInBatch[0]}" bị nhập trùng lặp nhiều lần trong danh sách!`);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
        hideLoadingOverlay(); return;
      }

      // Tạo records cho Supabase
      const recordsToInsert = rollDataList.map(roll => ({
        ...commonData,
        ...extData,
        'Cuộn ID': roll.cuonId || null,
        'Số lượng (Kg)': roll.kg,
        'Vị trí': roll.viTri || null
      }));

      const { data: insertedData, error } = await supabase
        .from(TABLE_NAME).insert(recordsToInsert).select();

      if (error) {
        if (error.code === '23505' || (error.message && error.message.includes('unique'))) {
          throw new Error('Một hoặc nhiều Cuộn ID đã tồn tại trong hệ thống. Vui lòng kiểm tra lại!');
        }
        throw error;
      }

      if (typeof clearStoredTableCache === 'function') {
        clearStoredTableCache('xg-ton');
      }

      broadcastXgEvent('XG_NHAP_INSERT', {
        records: insertedData || []
      });

      await populateDistinctFilterDropdowns();
      await fetchDataFromSupabase(currentPage);

      bootstrap.Modal.getInstance(document.getElementById('addDataModal'))?.hide();
      form.reset();
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
      hideLoadingOverlay();
      if (window._savedFilterState) { restoreFilterState(window._savedFilterState); window._savedFilterState = null; }
      if (window._savedScrollPosition) { restoreScrollPosition(window._savedScrollPosition); window._savedScrollPosition = null; }
    }

    // ===== EDIT DATA =====
    else if (e.target && e.target.id === 'editDataForm') {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : 'Cập nhật';

      const rawToEdit = window._rawSupabaseData && window._rawSupabaseData[selectedRowIndex - 1];
      if (typeof isRecordLocked === 'function' && isRecordLocked(rawToEdit)) {
        const rowId = rawToEdit?.id || (tableData[selectedRowIndex] ? tableData[selectedRowIndex][0] : selectedRowIndex);
        (window.showWarningModal || alert)(`Dữ liệu (ID: ${rowId}) đã được nhập quá 24 giờ. Hệ thống không cho phép cập nhật.`);
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang cập nhật...'; }
      showLoadingOverlay('Đang cập nhật dữ liệu...');

      const rowId = form.querySelector('input[name="row_id"]')?.value;
      if (!rowId) {
        alert('Không tìm thấy ID dòng'); hideLoadingOverlay();
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
        return;
      }

      // Lấy dữ liệu cuộn
      const rollKgValues = [], rollCuonIds = [], rollViTris = [];
      document.querySelectorAll('#editRollsTableBody tr').forEach(row => {
        const kgInput = row.querySelector('.edit-roll-kg');
        if (kgInput && kgInput.value) {
          const parsed = parseNumericInput(kgInput.value);
          if (parsed !== null && parsed > 0) {
            rollKgValues.push(parsed);
            rollCuonIds.push(row.querySelector('.edit-roll-cuon-id')?.value.trim() || '');
            rollViTris.push(row.querySelector('.edit-roll-vi-tri')?.value.trim() || '');
          }
        }
      });

      if (rollKgValues.length === 0) {
        alert('Vui lòng nhập ít nhất một cuộn với số kg > 0');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
        hideLoadingOverlay(); return;
      }

      const updateData = {};
      form.querySelectorAll('#editDataCommonFields input[name^="col_"], #editDataCommonFields select[name^="col_"]').forEach(inp => {
        const colIdx = parseInt(inp.name.replace('col_', ''), 10);
        updateData[COLUMN_HEADERS[colIdx]] = inp.value || null;
      });
      form.querySelectorAll('#editDataAdditionalFields input[name^="edit_ext_"], #editDataAdditionalFields select[name^="edit_ext_"]').forEach(inp => {
        const colIdx = parseInt(inp.name.replace('edit_ext_', ''), 10);
        updateData[COLUMN_HEADERS[colIdx]] = inp.value || null;
      });

      const totalKg = rollKgValues.reduce((sum, kg) => sum + kg, 0);
      updateData['Số lượng (Kg)'] = totalKg;
      updateData['Cuộn ID'] = rollCuonIds.filter(Boolean).join(', ') || null;
      updateData['Vị trí'] = rollViTris.filter(Boolean).join(', ') || null;
      delete updateData['id'];

      const { data: updatedData, error } = await supabase
        .from(TABLE_NAME).update(updateData).eq('id', rowId).select();

      if (error) throw error;

      if (typeof clearStoredTableCache === 'function') {
        clearStoredTableCache('xg-ton');
      }

      broadcastXgEvent('XG_NHAP_UPDATE', {
        record: updatedData ? updatedData[0] : null
      });

      await populateDistinctFilterDropdowns();
      await fetchDataFromSupabase(currentPage);

      selectedRowIndex = -1;
      document.getElementById('btnEditData').disabled = true;
      document.getElementById('btnDeleteData').disabled = true;

      bootstrap.Modal.getInstance(document.getElementById('editDataModal'))?.hide();
      form.reset();

      if (window._savedFilterState) { restoreFilterState(window._savedFilterState); window._savedFilterState = null; }
      if (window._savedScrollPosition) { restoreScrollPosition(window._savedScrollPosition); window._savedScrollPosition = null; }
      hideLoadingOverlay();
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
    }

  } catch (err) {
    console.error('Form submit error:', err);
    hideLoadingOverlay();
    alert(`Lỗi: ${err.message}`);
    const submitBtn = e.target?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = false;
  }
});


/* =============================================================================
   DELETE HANDLER
================================================================================ */

document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'btnConfirmDelete') {
    e.preventDefault(); e.stopPropagation();

    updateSelectedRows();
    if (selectedRowIndexes.length === 0) { alert('Không có dòng nào được chọn'); return; }

    const lockedItems = [];
    selectedRowIndexes.forEach(idx => {
      const raw = window._rawSupabaseData && window._rawSupabaseData[idx - 1];
      if (typeof isRecordLocked === 'function' && isRecordLocked(raw)) {
        const rowId = raw?.id || (tableData[idx] ? tableData[idx][0] : idx);
        lockedItems.push(`ID: ${rowId}`);
      }
    });

    if (lockedItems.length > 0) {
      const msg = lockedItems.length === 1
        ? `Dữ liệu (${lockedItems[0]}) đã nhập quá 24 giờ. Hệ thống không cho phép xóa.`
        : `Không thể xóa. Các dòng dữ liệu sau đã nhập quá 24 giờ:\n• ${lockedItems.join('\n• ')}`;
      (window.showWarningModal || alert)(msg);
      return;
    }

    const btnConfirm = document.getElementById('btnConfirmDelete');
    const originalText = btnConfirm.textContent;
    btnConfirm.disabled = true; btnConfirm.textContent = 'Đang xóa...';
    showLoadingOverlay('Đang xóa dữ liệu...');

    try {
      const sortedIndexes = selectedRowIndexes.slice().sort((a, b) => b - a);
      const idsToDelete = sortedIndexes
        .filter(idx => idx > 0 && idx < tableData.length)
        .map(idx => tableData[idx][0])
        .filter(id => id !== undefined && id !== null && id !== '');

      if (idsToDelete.length > 0) {
        const { error } = await supabase.from(TABLE_NAME).delete().in('id', idsToDelete);
        if (error) throw error;
      }

      if (typeof clearStoredTableCache === 'function') {
        clearStoredTableCache('xg-ton');
      }

      broadcastXgEvent('XG_NHAP_DELETE', {
        ids: idsToDelete
      });

      await populateDistinctFilterDropdowns();
      await fetchDataFromSupabase(currentPage);

      bootstrap.Modal.getInstance(document.getElementById('deleteDataModal'))?.hide();
      selectedRowIndexes = []; selectedRowIndex = -1;
      document.getElementById('btnEditData').disabled = true;
      document.getElementById('btnDeleteData').disabled = true;

      if (window._savedFilterState) { restoreFilterState(window._savedFilterState); window._savedFilterState = null; }
      if (window._savedScrollPosition) { restoreScrollPosition(window._savedScrollPosition); window._savedScrollPosition = null; }
      hideLoadingOverlay();

    } catch (err) {
      console.error('Delete error:', err);
      alert(`Lỗi xóa: ${err.message}`);
      hideLoadingOverlay();
    } finally {
      btnConfirm.disabled = false; btnConfirm.textContent = originalText;
    }
  }
});


/* =============================================================================
   EVENT LISTENERS
================================================================================ */

document.addEventListener('click', (e) => {
  const id = e.target && e.target.id;
  if (!id) return;
  if (id === 'btnAddData') openAddDataModal();
  if (id === 'btnEditData') openEditDataModal();
  if (id === 'btnDeleteData') openDeleteDataModal();
  if (id === 'prevPage') prevPage();
  if (id === 'nextPage') nextPage();
});

document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'pageSelect') goToPage(e.target.value);
});


/* =============================================================================
   HAMBURGER MENU & MOBILE NAVIGATION
================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');

  if (hamburger && mainNav) {
    hamburger.addEventListener('click', (e) => { e.preventDefault(); });
  }

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && mainNav && hamburger) {
      if (!mainNav.contains(e.target) && !hamburger.contains(e.target)) {
        mainNav.classList.remove('active');
        hamburger.classList.remove('active');
      }
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && mainNav) {
      mainNav.classList.remove('active');
      if (hamburger) hamburger.classList.remove('active');
    }
  });
});
