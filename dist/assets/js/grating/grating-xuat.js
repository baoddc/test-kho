/* =============================================================================
   GRATING-XUAT - SUPABASE VERSION
   Quản lý dữ liệu xuất grating từ Supabase (xuất theo kg, không có Cuộn ID)
   Tên bảng: grating-xuat
   Cột: id, Mã chứng từ, Ngày xuất, Phiếu xuất, Loại xuất, Mã vật tư,
         Tên vật tư, Batch, Số lượng (Kg), Mã công trình, Tên công trình, Ghi chú
   Mỗi mặt hàng (Mã vật tư + Batch) xuất không quá tồn trong bảng grating-ton;
   database kiểm tra lại và từ chối nếu vượt tồn.
================================================================================ */

// Tên bảng Supabase
const TABLE_NAME = 'grating-xuat';

// Header cột (theo thứ tự trong bảng) - dùng để render bảng
const COLUMN_HEADERS = [
  'id',
  'Mã chứng từ',
  'Ngày xuất',
  'Phiếu xuất',
  'Loại xuất',
  'Mã vật tư',
  'Tên vật tư',
  'Batch',
  'Số lượng (Kg)',
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

const xgChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('grating_sync_channel') : null;

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
      col: 'Ngày xuất',
      gte: document.getElementById('fromDate')?.value || '',
      lte: document.getElementById('toDate')?.value || ''
    }],
    in: {
      'Loại xuất': checkedValues('typeFilterMenu'),
      'Mã chứng từ': checkedValues('voucherFilterMenu')
    }
  };
}

async function populateDistinctFilterDropdowns() {
  try {
    const [types, vouchers] = await Promise.all([
      SQ.distinct({ table: TABLE_NAME, col: 'Loại xuất', fresh: true }),
      SQ.distinct({ table: TABLE_NAME, col: 'Mã chứng từ', fresh: true })
    ]);
    voucherOptions = vouchers.map(v => String(v).trim()).filter(Boolean);
    populateTypeDropdownFromValues('Loại xuất', 'typeFilterMenu', 'typeFilterBtn', 'typeFilterCount', types);
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
      loadingEl.textContent = `Lỗi kết nối máy chủ: ${error.message}`;
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
      if (header === 'Ngày xuất') {
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
  column: (key) => SQ.headerColumn(COLUMN_HEADERS, key, { date: ['Ngày xuất'], number: ['id', 'Số lượng (Kg)'] }),
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

  XLSX.writeFile(wb, 'grating_du_lieu_xuat.xlsx');
});


/* =============================================================================
   MODAL MANAGEMENT
================================================================================ */

function setupModalPermissions(modalEl) {
  const perms = (typeof getUserPermissions === 'function')
    ? getUserPermissions('grating')
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


  // Chỉ các nút hành động có data-perm (Thêm / Cập nhật / Xóa / Đồng bộ...) bị khóa khi không có quyền:
  // bấm vào sẽ bị chặn kèm thông báo (applyElementPermissions trong supabase-config.js).
  if (typeof applyElementPermissions === 'function') applyElementPermissions('grating');

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

  if (colName === 'Ngày xuất') {
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

  if (colName === 'Loại xuất') {
    const select = document.createElement('select');
    select.className = 'form-select form-select-sm fw-bold';
    select.name = fieldName;
    select.innerHTML = '<option value="">-- Chọn loại xuất --</option>';
    ['Xưởng sản xuất', 'Điều chuyển', 'Gia công ngoài', 'Công trình'].forEach(v => {
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
// Phiếu xuất grating: mỗi mặt hàng = 1 Mã vật tư + Batch + số kg xuất (không có cuộn).
// Tồn khả dụng lấy từ bảng grating-ton; database chặn lần nữa nếu xuất vượt tồn.

const TON_TABLE_NAME = 'grating-ton';
const COMMON_COL_INDICES = [1, 2, 3, 4];          // Mã chứng từ, Ngày xuất, Phiếu xuất, Loại xuất
const ITEM_COL_INDICES = [5, 6, 7];               // Mã vật tư, Tên vật tư, Batch
let exportItems = [];                             // [{ maVatTu, tenVatTu, batch, kg, sapKg, tonKg }]

function gratingKey(maVatTu, batch) {
  return `${String(maVatTu || '').trim().toLowerCase()}|${String(batch || '').trim().toLowerCase()}`;
}

function newExportItem(data = {}) {
  return {
    maVatTu: data.maVatTu || '',
    tenVatTu: data.tenVatTu || '',
    batch: data.batch || '',
    kg: data.kg ?? '',
    sapKg: data.sapKg ?? null,
    tonKg: data.tonKg ?? null
  };
}

function additionalColIndices() {
  const quantityColIndex = findQuantityColumnIndex();
  const list = [];
  for (let i = quantityColIndex + 1; i < COLUMN_HEADERS.length; i++) {
    if (!HIDDEN_COLUMNS.includes(COLUMN_HEADERS[i])) list.push(i);
  }
  return list;
}

// Tồn hiện tại của các khóa (mã + batch) đang có trong danh sách
async function fetchTonForKeys(keys) {
  const unique = Array.from(new Set(keys.filter(k => k && k !== '|')));
  const map = new Map();
  if (unique.length === 0) return map;
  const res = await SQ.rows({
    table: TON_TABLE_NAME,
    filters: { in: { ton_key: unique } },
    order: [{ col: 'id', asc: true }],
    limit: Math.min(1000, unique.length),
    withTotal: false,
    columns: ['ton_key', 'Số lượng (Kg)', 'Tên vật tư']
  });
  res.rows.forEach(r => map.set(r.ton_key, r));
  return map;
}

async function refreshItemsTon() {
  try {
    const map = await fetchTonForKeys(exportItems.map(it => gratingKey(it.maVatTu, it.batch)));
    exportItems.forEach(it => {
      const ton = map.get(gratingKey(it.maVatTu, it.batch));
      it.tonKg = ton ? Number(ton['Số lượng (Kg)']) || 0 : (it.maVatTu ? 0 : null);
      if (!it.tenVatTu && ton && ton['Tên vật tư']) it.tenVatTu = ton['Tên vật tư'];
    });
  } catch (err) {
    console.warn('[grating-xuat] Không lấy được tồn kho:', err);
  }
  renderExportItems();
}

function renderExportItems() {
  const tbody = document.getElementById('exportItemsBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  exportItems.forEach((it, idx) => {
    const kg = parseNumericInput(it.kg);
    const over = it.tonKg !== null && kg !== null && kg > it.tonKg + 0.0005;
    const sapDiff = it.sapKg !== null && kg !== null ? Math.round((kg - it.sapKg) * 1000) / 1000 : null;
    const tr = document.createElement('tr');
    tr.dataset.index = String(idx);
    tr.innerHTML = `
      <td class="text-center">${idx + 1}</td>
      <td><input type="text" class="form-control form-control-sm item-ma" required placeholder="Mã vật tư" value="${escapeHtml(it.maVatTu)}"></td>
      <td><input type="text" class="form-control form-control-sm item-ten" placeholder="Tên vật tư" value="${escapeHtml(it.tenVatTu)}"></td>
      <td><input type="text" class="form-control form-control-sm item-batch" placeholder="Batch" value="${escapeHtml(it.batch)}"></td>
      <td class="text-end ${it.tonKg === 0 ? 'text-danger fw-bold' : ''}">${it.tonKg === null ? '<span class="text-muted">—</span>' : formatCellQuantityOrWeight(it.tonKg, 'Số lượng (Kg)')}</td>
      <td class="text-end">${it.sapKg === null ? '<span class="text-muted">—</span>' : formatCellQuantityOrWeight(it.sapKg, 'Số lượng (Kg)')}</td>
      <td>
        <input type="number" class="form-control form-control-sm item-kg ${over ? 'is-invalid' : ''}" step="any" min="0" inputmode="decimal" required placeholder="Số kg" value="${escapeHtml(it.kg)}">
        ${over ? '<div class="invalid-feedback d-block">Vượt tồn</div>' : ''}
        ${sapDiff !== null && Math.abs(sapDiff) >= 0.05 ? `<div class="small text-warning">Lệch SAP ${sapDiff > 0 ? '+' : ''}${formatCellQuantityOrWeight(sapDiff, 'Số lượng (Kg)')} kg</div>` : ''}
      </td>
      <td class="text-center">
        <button type="button" class="btn btn-sm btn-outline-danger btn-remove-item" title="Bỏ mặt hàng" ${exportItems.length <= 1 ? 'disabled' : ''}>✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  updateExportTotals();
}

function updateExportTotals() {
  let totalKg = 0, totalSap = 0, hasSap = false;
  exportItems.forEach(it => {
    totalKg += parseNumericInput(it.kg) || 0;
    if (it.sapKg !== null) { hasSap = true; totalSap += it.sapKg; }
  });
  const fmt = v => formatCellQuantityOrWeight(Math.round(v * 1000) / 1000, 'Số lượng (Kg)') || '0';
  const el = (id) => document.getElementById(id);
  if (el('exportItemsCount')) el('exportItemsCount').textContent = String(exportItems.length);
  if (el('exportTotalKg')) el('exportTotalKg').textContent = fmt(totalKg);
  if (el('exportSapWrapper')) el('exportSapWrapper').style.display = hasSap ? '' : 'none';
  if (el('exportSapKg')) el('exportSapKg').textContent = fmt(totalSap);
}

// Điền phiếu từ SAP MB51 (xg-sap-lookup gọi khi chọn số phiếu xuất ở ô gợi ý)
window.populateExportReceiptData = async function (headerInfo, itemsGrouped) {
  const form = document.getElementById('addDataForm');
  if (!form) return;
  const setVal = (selector, value) => {
    const inp = form.querySelector(selector);
    if (inp && value !== undefined && value !== null && value !== '') inp.value = value;
  };
  const maChungTu = form.querySelector('select[name="col_1"]');
  if (maChungTu && headerInfo.maChungTu) {
    if (!Array.from(maChungTu.options).some(o => o.value === headerInfo.maChungTu)) {
      maChungTu.appendChild(new Option(headerInfo.maChungTu, headerInfo.maChungTu));
    }
    maChungTu.value = headerInfo.maChungTu;
  }
  setVal('input[name="col_2"]', headerInfo.ngayXuat);
  setVal('input[name="col_3"]', headerInfo.phieuXuat);
  const loai = form.querySelector('select[name="col_4"]');
  if (loai && headerInfo.loaiXuat) {
    if (!Array.from(loai.options).some(o => o.value === headerInfo.loaiXuat)) {
      loai.appendChild(new Option(headerInfo.loaiXuat, headerInfo.loaiXuat));
    }
    loai.value = headerInfo.loaiXuat;
  }
  setVal(`input[name="add_ext_${COLUMN_HEADERS.indexOf('Mã công trình')}"]`, headerInfo.maCongTrinh);
  setVal(`input[name="add_ext_${COLUMN_HEADERS.indexOf('Tên công trình')}"]`, headerInfo.tenCongTrinh);

  // Grating xuất theo kg: lấy luôn số kg trên phiếu SAP làm số kg xuất
  exportItems = (itemsGrouped || []).map(g => newExportItem({
    maVatTu: g.maVatTu, tenVatTu: g.tenVatTu, batch: g.batch,
    kg: Math.round((Number(g.totalSapKg) || 0) * 1000) / 1000, sapKg: Number(g.totalSapKg) || 0
  }));
  if (exportItems.length === 0) exportItems = [newExportItem()];
  renderExportItems();
  await refreshItemsTon();
  if (window.XgSapLookup && window.XgSapLookup.showAutofillToast) {
    window.XgSapLookup.showAutofillToast(`Đã điền ${exportItems.length} mặt hàng từ phiếu SAP ${headerInfo.phieuXuat || ''}`);
  }
};

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

  if (window.XgSapLookup && window.XgSapLookup.resetSapSelection) {
    window.XgSapLookup.resetSapSelection();
  }

  COMMON_COL_INDICES.forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, undefined, commonFieldsContainer, 'col_');
  });
  additionalColIndices().forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, undefined, additionalFieldsContainer, 'add_ext_');
  });

  // Gõ số phiếu xuất → gợi ý từ SAP MB51 (nhóm 10060-Grating) và tự điền mặt hàng
  const phieuXuatInput = commonFieldsContainer.querySelector('input[name="col_3"]');
  if (phieuXuatInput && window.XgSapLookup && window.XgSapLookup.initSapDocumentAutocomplete) {
    phieuXuatInput.setAttribute('autocomplete', 'off');
    window.XgSapLookup.initSapDocumentAutocomplete(phieuXuatInput, document.getElementById('addDataForm'), 'grating-xuat');
    // Khóa mọi trường cho tới khi số phiếu có trên Google Sheets (SAP MB51 đã đồng bộ)
    if (window.XgSapLookup.initReceiptGate) window.XgSapLookup.initReceiptGate(document.getElementById('addDataForm'), phieuXuatInput, 'grating-xuat');
  }

  exportItems = [newExportItem()];
  renderExportItems();

  const btnSyncGgSheet = document.getElementById('btnSyncGgSheet');
  if (btnSyncGgSheet && window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
    btnSyncGgSheet.onclick = () => window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet);
    window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
  }

  new bootstrap.Modal(modalEl).show();
}

// Bảng mặt hàng: sửa trực tiếp trong ô; đổi mã / batch thì tra lại tồn
document.addEventListener('input', (e) => {
  const tr = e.target.closest && e.target.closest('#exportItemsBody tr');
  if (!tr) return;
  const it = exportItems[Number(tr.dataset.index)];
  if (!it) return;
  if (e.target.classList.contains('item-kg')) { it.kg = e.target.value; updateExportTotals(); }
  if (e.target.classList.contains('item-ten')) it.tenVatTu = e.target.value;
  if (e.target.classList.contains('item-ma')) it.maVatTu = e.target.value;
  if (e.target.classList.contains('item-batch')) it.batch = e.target.value;
});

document.addEventListener('change', (e) => {
  const tr = e.target.closest && e.target.closest('#exportItemsBody tr');
  if (!tr) return;
  if (e.target.classList.contains('item-ma') || e.target.classList.contains('item-batch')) refreshItemsTon();
  if (e.target.classList.contains('item-kg')) renderExportItems();
});

document.addEventListener('click', (e) => {
  const removeBtn = e.target.closest && e.target.closest('#exportItemsBody .btn-remove-item');
  if (removeBtn) {
    const idx = Number(removeBtn.closest('tr').dataset.index);
    exportItems.splice(idx, 1);
    if (exportItems.length === 0) exportItems = [newExportItem()];
    renderExportItems();
  }
  if (e.target.closest && e.target.closest('#btnAddExportItem')) {
    exportItems.push(newExportItem());
    renderExportItems();
  }
  if (e.target.closest && e.target.closest('#btnPickFromTon')) openTonPicker();
});


// ===== CHỌN MÃ TỪ TỒN KHO =====

let tonPickerSeq = 0;

async function loadTonPicker() {
  const tbody = document.getElementById('tonPickerBody');
  const info = document.getElementById('tonPickerInfo');
  if (!tbody) return;
  const seq = ++tonPickerSeq;
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Đang tải tồn kho...</td></tr>';
  try {
    const res = await SQ.rows({
      table: TON_TABLE_NAME,
      filters: { range: [{ col: 'Số lượng (Kg)', gt: '0' }], search: document.getElementById('tonPickerSearch')?.value?.trim() || '' },
      order: [{ col: 'Mã vật tư', asc: true }, { col: 'id', asc: true }],
      limit: 200,
      withTotal: true
    });
    if (seq !== tonPickerSeq) return;
    if (info) info.textContent = res.total > res.rows.length ? `Hiện ${res.rows.length} / ${res.total} mã, gõ để tìm thêm` : `${res.total} mã còn tồn`;
    tbody.innerHTML = res.rows.length ? '' : '<tr><td colspan="6" class="text-center text-muted py-3">Không có mã nào còn tồn</td></tr>';
    res.rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.dataset.row = JSON.stringify({ maVatTu: r['Mã vật tư'] || '', tenVatTu: r['Tên vật tư'] || '', batch: r['Batch'] || '', tonKg: Number(r['Số lượng (Kg)']) || 0 });
      tr.innerHTML = `
        <td>${escapeHtml(r['Mã vật tư'])}</td>
        <td>${escapeHtml(r['Tên vật tư'])}</td>
        <td>${escapeHtml(r['Batch'])}</td>
        <td class="text-end fw-bold">${formatCellQuantityOrWeight(r['Số lượng (Kg)'], 'Số lượng (Kg)')}</td>
        <td>${escapeHtml(r['Vị trí'])}</td>
        <td class="text-end">${escapeHtml(formatDate(r['Ngày nhập']))}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    if (seq === tonPickerSeq) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">Lỗi tải tồn kho: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openTonPicker() {
  const modalEl = document.getElementById('tonPickerModal');
  if (!modalEl) return;
  const search = document.getElementById('tonPickerSearch');
  if (search) search.value = '';
  loadTonPicker();
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

document.getElementById('tonPickerSearch')?.addEventListener('input', debounce(loadTonPicker, 300));

// Bấm 1 dòng tồn → thêm mặt hàng (điền vào dòng trống đầu tiên nếu có), số kg mặc định = toàn bộ tồn
document.getElementById('tonPickerBody')?.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-row]');
  if (!tr) return;
  const picked = JSON.parse(tr.dataset.row);
  const key = gratingKey(picked.maVatTu, picked.batch);
  if (exportItems.some(it => gratingKey(it.maVatTu, it.batch) === key)) {
    alert(`Mã ${picked.maVatTu} (Batch: ${picked.batch || 'trống'}) đã có trong phiếu.`);
    return;
  }
  const emptyIdx = exportItems.findIndex(it => !String(it.maVatTu).trim());
  const item = newExportItem({ ...picked, kg: picked.tonKg });
  if (emptyIdx >= 0) exportItems[emptyIdx] = item; else exportItems.push(item);
  renderExportItems();
  bootstrap.Modal.getInstance(document.getElementById('tonPickerModal'))?.hide();
});


// ===== EDIT DATA MODAL =====
// Sửa 1 dòng xuất: tồn khả dụng = tồn hiện tại + số kg đang sửa (nếu giữ nguyên mã + batch)

let editOriginal = null;

async function updateEditTonInfo() {
  const info = document.getElementById('editTonInfo');
  if (!info || !editOriginal) return;
  const form = document.getElementById('editDataForm');
  const ma = form.querySelector('input[name="col_5"]')?.value || '';
  const batch = form.querySelector('input[name="col_7"]')?.value || '';
  const key = gratingKey(ma, batch);
  info.textContent = 'Đang tra tồn...';
  try {
    const map = await fetchTonForKeys([key]);
    const ton = Number(map.get(key)?.['Số lượng (Kg)']) || 0;
    const available = ton + (key === editOriginal.key ? editOriginal.kg : 0);
    info.innerHTML = `Tồn khả dụng cho dòng này: <strong>${formatCellQuantityOrWeight(available, 'Số lượng (Kg)') || '0'} kg</strong>`;
    info.dataset.available = String(available);
  } catch (err) {
    info.textContent = `Không tra được tồn: ${err.message}`;
    delete info.dataset.available;
  }
}

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

  const rowData = tableData[selectedRowIndex];
  const quantityColIndex = findQuantityColumnIndex();

  const hiddenIdInput = document.createElement('input');
  hiddenIdInput.type = 'hidden'; hiddenIdInput.name = 'row_id';
  hiddenIdInput.value = rowData[0] ?? '';
  commonFieldsContainer.appendChild(hiddenIdInput);

  [...COMMON_COL_INDICES, ...ITEM_COL_INDICES].forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, rowData[colIdx], commonFieldsContainer, 'col_');
  });
  additionalColIndices().forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, rowData[colIdx], additionalFieldsContainer, 'edit_ext_');
  });

  const kgValue = parseNumericInput(rowData[quantityColIndex]) || 0;
  const kgInput = document.getElementById('editKgInput');
  if (kgInput) kgInput.value = kgValue ? String(kgValue) : '';

  editOriginal = { key: gratingKey(rowData[5], rowData[7]), kg: kgValue };
  ['col_5', 'col_7'].forEach(name => {
    commonFieldsContainer.querySelector(`input[name="${name}"]`)?.addEventListener('change', updateEditTonInfo);
  });
  updateEditTonInfo();

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
  if (typeof applyElementPermissions === 'function') applyElementPermissions('grating');

  new bootstrap.Modal(modalEl).show();
}


/* =============================================================================
   FORM HANDLERS - SUPABASE CRUD
================================================================================ */

function readFormFields(form, selector, prefix) {
  const data = {};
  form.querySelectorAll(selector).forEach(inp => {
    const colIdx = parseInt(inp.name.replace(prefix, ''), 10);
    data[COLUMN_HEADERS[colIdx]] = inp.value || null;
  });
  return data;
}

document.addEventListener('submit', async (e) => {
  try {
    // ===== ADD DATA =====
    if (e.target && e.target.id === 'addDataForm') {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : 'Thêm dữ liệu';
      const restore = () => {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
        hideLoadingOverlay();
      };
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang kiểm tra...'; }
      showLoadingOverlay('Đang kiểm tra tồn kho...');

      // Mặt hàng hợp lệ: có mã vật tư và số kg > 0; tra lại tồn mới nhất trước khi kiểm tra
      await refreshItemsTon();
      const problems = [];
      const seen = new Set();
      const items = [];
      exportItems.forEach((it, idx) => {
        const kg = parseNumericInput(it.kg);
        const ma = String(it.maVatTu || '').trim();
        const label = `Dòng ${idx + 1}${ma ? ` (${ma})` : ''}`;
        if (!ma && (kg === null || kg === 0)) return;  // dòng trống
        if (!ma) { problems.push(`${label}: chưa nhập mã vật tư`); return; }
        if (kg === null || kg <= 0) { problems.push(`${label}: số kg phải lớn hơn 0`); return; }
        const key = gratingKey(ma, it.batch);
        if (seen.has(key)) { problems.push(`${label}: trùng mã + batch với dòng khác`); return; }
        seen.add(key);
        if (it.tonKg !== null && kg > it.tonKg + 0.0005) {
          problems.push(`${label}: xuất ${formatCellQuantityOrWeight(kg, 'Số lượng (Kg)')} kg vượt tồn ${formatCellQuantityOrWeight(it.tonKg, 'Số lượng (Kg)') || '0'} kg`);
          return;
        }
        items.push({ ...it, maVatTu: ma, batch: String(it.batch || '').trim(), kg });
      });

      if (problems.length) {
        restore();
        alert(`Chưa lưu được, cần sửa:\n• ${problems.slice(0, 10).join('\n• ')}`);
        return;
      }
      if (items.length === 0) {
        restore();
        alert('Vui lòng nhập ít nhất một mặt hàng với số kg > 0');
        return;
      }

      // Đối chiếu SAP MB51: tổng kg từng mã + batch phải khớp phiếu (giống xuất xà gồ / tole)
      const phieuXuatVal = (form.querySelector('input[name="col_3"]')?.value || '').trim();
      if (phieuXuatVal && window.XgSapLookup && typeof window.XgSapLookup.validateExportReceiptAgainstMb51 === 'function') {
        const checkResult = await window.XgSapLookup.validateExportReceiptAgainstMb51(phieuXuatVal, items.map((it, idx) => ({
          maVatTu: it.maVatTu,
          tenVatTu: it.tenVatTu,
          batch: it.batch,
          rolls: [{ id: `item_${idx}`, kg: it.kg, maVatTu: it.maVatTu, batch: it.batch }]
        })), 'grating-xuat');
        if (!checkResult.isValid) {
          restore();
          window.XgSapLookup.showExportReceiptMismatchModal(checkResult, 'grating-xuat', () => {
            if (window.XgSapLookup.syncFromGoogleSheets) window.XgSapLookup.syncFromGoogleSheets(document.getElementById('btnSyncGgSheet'));
          });
          return;
        }
      }

      if (submitBtn) submitBtn.textContent = 'Đang thêm...';
      updateLoadingOverlay(`Đang thêm ${items.length} mặt hàng...`);

      const commonData = readFormFields(form, '#addDataCommonFields input[name^="col_"], #addDataCommonFields select[name^="col_"]', 'col_');
      const extData = readFormFields(form, '#addDataAdditionalFields input[name^="add_ext_"], #addDataAdditionalFields select[name^="add_ext_"]', 'add_ext_');
      const recordsToInsert = items.map(it => ({
        ...commonData,
        ...extData,
        'Mã vật tư': it.maVatTu,
        'Tên vật tư': String(it.tenVatTu || '').trim() || null,
        'Batch': it.batch || null,
        'Số lượng (Kg)': it.kg
      }));

      // Gửi 1 lần: database kiểm tra tồn từng mã, thiếu tồn thì không lưu dòng nào
      const { data: insertedData, error } = await supabase.from(TABLE_NAME).insert(recordsToInsert).select();
      if (error) throw error;

      if (typeof clearStoredTableCache === 'function') clearStoredTableCache(TON_TABLE_NAME);
      broadcastXgEvent('GRATING_XUAT_INSERT', { records: insertedData || [] });

      await populateDistinctFilterDropdowns();
      await fetchDataFromSupabase(currentPage);

      bootstrap.Modal.getInstance(document.getElementById('addDataModal'))?.hide();
      form.reset();
      restore();
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

      const rowId = form.querySelector('input[name="row_id"]')?.value;
      const kg = parseNumericInput(document.getElementById('editKgInput')?.value);
      if (!rowId) { alert('Không tìm thấy ID dòng'); return; }
      if (kg === null || kg <= 0) { alert('Số kg xuất phải lớn hơn 0'); return; }

      const available = Number(document.getElementById('editTonInfo')?.dataset.available);
      if (Number.isFinite(available) && kg > available + 0.0005) {
        alert(`Số kg xuất (${formatCellQuantityOrWeight(kg, 'Số lượng (Kg)')} kg) vượt tồn khả dụng (${formatCellQuantityOrWeight(available, 'Số lượng (Kg)') || '0'} kg).`);
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang cập nhật...'; }
      showLoadingOverlay('Đang cập nhật dữ liệu...');

      const updateData = {
        ...readFormFields(form, '#editDataCommonFields input[name^="col_"], #editDataCommonFields select[name^="col_"]', 'col_'),
        ...readFormFields(form, '#editDataAdditionalFields input[name^="edit_ext_"], #editDataAdditionalFields select[name^="edit_ext_"]', 'edit_ext_'),
        'Số lượng (Kg)': kg
      };
      delete updateData['id'];

      const { data: updatedData, error } = await supabase.from(TABLE_NAME).update(updateData).eq('id', rowId).select();
      if (error) throw error;

      if (typeof clearStoredTableCache === 'function') clearStoredTableCache(TON_TABLE_NAME);
      broadcastXgEvent('GRATING_XUAT_UPDATE', { record: updatedData ? updatedData[0] : null });

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
        clearStoredTableCache('grating-ton');
      }

      broadcastXgEvent('GRATING_XUAT_DELETE', {
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
