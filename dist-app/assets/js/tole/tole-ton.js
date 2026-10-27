/* =============================================================================
   TOLE-TON - SUPABASE VERSION
   Quản lý dữ liệu tồn tole từ Supabase
   Tên bảng: tole-ton (được tính toán động từ tole-nhap và tole-xuat)
================================================================================ */

// Tên bảng Supabase
const TABLE_NAME = 'tole-ton';

// Header cột (theo thứ tự trong bảng) - dùng để render bảng
const COLUMN_HEADERS = [
  'id',
  'Ngày nhập',
  'Thời gian lưu kho',
  'Vị trí',
  'Mã vật tư',
  'Tên vật tư',
  'Batch',
  'Cuộn ID',
  'Khối lượng (kg)',
  'Khối lượng (m)',
  'Mã công trình',
  'Tên công trình',
  'Ghi chú'
];

// Cột ẩn khỏi bảng hiển thị
const HIDDEN_COLUMNS = ['id'];

// Escape dữ liệu từ DB trước khi chèn vào innerHTML (chống XSS)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const displayColIndexes = COLUMN_HEADERS
  .map((col, i) => ({ col, i }))
  .filter(({ col }) => !HIDDEN_COLUMNS.includes(col))
  .map(({ i }) => i);

// ==================== PAGINATION CONFIG ====================
const ROWS_PER_PAGE = 100;
// ============================================================


/* =============================================================================
   GLOBAL VARIABLES
================================================================================ */

let currentPage = 1;
let totalPages = 1;
let tableData = [];           // trang hiện tại [header, ...rows]
let groupByMode = true;        // chế độ nhóm theo Mã vật tư - mặc định bật
const GROUP_COL = 4;           // index cột Mã vật tư (0-based)

// Tồn kho = các dòng tole-nhap có con_ton (server tự cập nhật khi xuất / xóa phiếu xuất).
// Lọc, phân trang và tính tổng ở server; trình duyệt chỉ giữ 1 trang.
const NHAP_TABLE_NAME = 'tole-nhap';
const QTY_DB_COLUMNS = { 'Khối lượng (kg)': 'Số lượng (Kg)', 'Khối lượng (m)': 'Số lượng (m)' };
const QTY_COLUMNS = Object.values(QTY_DB_COLUMNS);
const DEFAULT_ORDER = groupByMode ? [{ col: 'Mã vật tư', asc: true }, { col: 'id', asc: true }] : [{ col: 'id', asc: true }];
const pager = new SQ.ServerPager({ table: NHAP_TABLE_NAME, pageSize: ROWS_PER_PAGE, sumCols: QTY_COLUMNS, order: DEFAULT_ORDER });
let groupTotals = new Map();   // Mã vật tư → { count, sums } của cả nhóm (mọi trang)

const toleChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tole_sync_channel') : null;
let realtimeChannel = null;


/* =============================================================================
   UTILITY FUNCTIONS
================================================================================ */

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
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

function calculateStorageAge(importDateStr) {
  if (!importDateStr) return '';
  const dateObj = parseRowDate(importDateStr);
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const importDate = new Date(dateObj);
  importDate.setHours(0,0,0,0);

  const diffTime = today - importDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0;
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
  const cleanHeader = String(header || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isIdColumn = cleanHeader.includes('id');
  if (isIdColumn) {
    const parsedNum = parseNumericInput(cell);
    if (parsedNum !== null && !isNaN(parsedNum)) {
      return parsedNum.toString();
    }
  }
  const isQtyOrWeight = cleanHeader.includes('so luong') || 
                        cleanHeader.includes('trong luong') || 
                        cleanHeader.includes('khoi luong') || 
                        cleanHeader.includes('so kg') || 
                        cleanHeader.includes('so m') || 
                        cleanHeader.includes('tan') || 
                        cleanHeader.includes('ton') || 
                        cleanHeader.includes('quy doi') || 
                        cleanHeader.includes('chieu dai') ||
                        cleanHeader === 'kg' ||
                        cleanHeader === 'm';
  if (isQtyOrWeight) {
    const parsedNum = parseNumericInput(cell);
    if (parsedNum !== null && !isNaN(parsedNum)) {
      return parsedNum.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    }
  }
  return cell;
}

function rowToArray(obj) {
  return COLUMN_HEADERS.map(col => obj[col] ?? '');
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

  if (window.inventoryLockService) {
    window.inventoryLockService.init('tole');
    window.inventoryLockService.onLocksChange(() => {
      renderCurrentPage();
    });
  }

  loadSupabaseData();
  initSupabaseRealtime();
  setupBroadcastListener();
});


/* =============================================================================
   DATA LOADING - SUPABASE
================================================================================ */

// Dòng tole-nhap → dòng tồn kho hiển thị
function toTonRow(row) {
  return {
    id: row.id,
    'Ngày nhập': row['Ngày nhập'] || '',
    'Thời gian lưu kho': calculateStorageAge(row['Ngày nhập']),
    'Vị trí': row['Vị trí'] || '',
    'Mã vật tư': row['Mã vật tư'] || '',
    'Tên vật tư': row['Tên vật tư'] || '',
    'Batch': row['Batch'] || '',
    'Cuộn ID': row['Cuộn ID'] || '',
    'Khối lượng (kg)': row['Số lượng (Kg)'] || 0,
    'Khối lượng (m)': row['Số lượng (m)'] || 0,
    'Mã công trình': row['Mã công trình'] || '',
    'Tên công trình': row['Tên công trình'] || '',
    'Ghi chú': row['Ghi chú'] || ''
  };
}

function buildServerFilters() {
  return {
    ton: true,
    search: document.getElementById('searchInput')?.value?.trim() || ''
  };
}

async function loadSupabaseData() {
  setupFilterEventListeners();
  SQ.applyColumnFilters(pager, buildServerFilters(), DEFAULT_ORDER);

  // Hiển thị ngay trang 1 đã lưu của lần mở trước (khi không có bộ lọc), rồi tải mới từ server
  const cached = typeof getStoredTableCache === 'function' ? getStoredTableCache('tole-ton') : null;
  if (cached && Array.isArray(cached.rows) && isDefaultView()) {
    pager.total = cached.total || 0;
    pager.sums = cached.sums || {};
    groupTotals = new Map(cached.groups || []);
    applyPageResult({ rows: cached.rows, page: 1, totalPages: pager.totalPages });
  } else {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = '';
      loadingEl.textContent = 'Đang tải dữ liệu...';
    }
  }

  await reloadPage(1);
}

// Đang xem toàn bộ tồn kho, thứ tự mặc định (mới lưu cache trang 1 cho lần mở sau)
function isDefaultView() {
  return Object.keys(pager.filters).length === 1 && pager.filters.ton && pager.order === DEFAULT_ORDER;
}

async function reloadPage(page) {
  const loadingEl = document.getElementById('loading');
  try {
    const result = await pager.load(page);
    if (!result) return;  // đã có yêu cầu mới hơn

    // Tổng của từng nhóm Mã vật tư trên trang (tính trên toàn bộ tồn kho, không chỉ trang này)
    if (groupByMode) {
      const keys = Array.from(new Set(result.rows.map(r => r['Mã vật tư'] ?? null)));
      const groups = await SQ.group({ table: NHAP_TABLE_NAME, filters: pager.filters, groupCol: 'Mã vật tư', sumCols: QTY_COLUMNS, keys });
      groupTotals = new Map(groups.map(g => [String(g.key ?? '').trim(), g]));
    }

    applyPageResult(result);
    if (result.page === 1 && isDefaultView() && typeof setStoredTableCache === 'function') {
      setStoredTableCache('tole-ton', { rows: result.rows, total: pager.total, sums: pager.sums, groups: Array.from(groupTotals.entries()) });
    }
  } catch (error) {
    console.error('Supabase error:', error);
    if (loadingEl && (!tableData || tableData.length <= 1)) {
      loadingEl.style.display = '';
      loadingEl.textContent = `Lỗi kết nối máy chủ: ${error.message}`;
    }
  }
}

function applyPageResult(result) {
  currentPage = result.page;
  totalPages = result.totalPages;
  const tonRows = result.rows.map(toTonRow);
  window._rawSupabaseData = tonRows;
  tableData = [COLUMN_HEADERS, ...tonRows.map(rowToArray)];
  renderCurrentPage();

  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';
  const btnExport = document.getElementById('btnExport');
  if (btnExport) btnExport.disabled = false;
}

/* =============================================================================
   REALTIME & BROADCAST REACTIVE INVENTORY SYNC
================================================================================ */

function setupBroadcastListener() {
  if (!toleChannel) return;
  toleChannel.onmessage = (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;
    handleToleSyncEvent(msg.type, msg);
  };
}

function initSupabaseRealtime() {
  if (!window.supabase || realtimeChannel) return;
  try {
    realtimeChannel = window.supabase
      .channel('public:tole_realtime_ton')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tole-xuat' }, (payload) => {
        handleRealtimeXuatChange(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tole-nhap' }, (payload) => {
        handleRealtimeNhapChange(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[tole-ton] Supabase Realtime connected');
        }
      });
  } catch (err) {
    console.warn('[tole-ton] Realtime subscription error:', err);
  }
}

// Nhập / xuất ở tab khác hoặc máy khác → tải lại trang đang xem (server đã cập nhật con_ton)
function handleToleSyncEvent(type) {
  if (type && type.startsWith('TOLE_')) debouncedReloadQuietly();
}

function handleRealtimeXuatChange() {
  debouncedReloadQuietly();
}

function handleRealtimeNhapChange() {
  debouncedReloadQuietly();
}

const debouncedReloadQuietly = debounce(() => {
  reloadInventoryDataQuietly();
}, 400);

async function reloadInventoryDataQuietly() {
  pager.invalidate();
  await reloadPage(currentPage);
}

function setupFilterEventListeners() {
  if (window._toleTonFilterInitialized) return;
  window._toleTonFilterInitialized = true;

  const btnReset = document.getElementById('btnResetFilter');
  const searchInput = document.getElementById('searchInput');
  const btnScanQR = document.getElementById('btnScanQR');

  // Check URL Query Param for vitri (Location Deep-link) — loadSupabaseData đọc ô tìm kiếm ngay sau đó
  const urlParams = new URLSearchParams(window.location.search);
  const vitriParam = urlParams.get('vitri') || urlParams.get('loc') || urlParams.get('location');
  if (vitriParam && searchInput) {
    const cleanRack = window.qrScannerService ? window.qrScannerService.parseLocationQRCode(vitriParam) : vitriParam.trim().toUpperCase();
    searchInput.value = cleanRack;
  }

  if (btnScanQR) {
    btnScanQR.addEventListener('click', () => {
      if (window.qrScannerService && window.qrScannerService.openQRCameraScanner) {
        window.qrScannerService.openQRCameraScanner((scannedRack) => {
          if (searchInput) {
            searchInput.value = scannedRack;
            filterTable(true);
          }
        });
      } else {
        alert('Module quét mã QR chưa sẵn sàng.');
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      filterTable(true);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', debouncedFilter);
  }
}


/* =============================================================================
   TABLE RENDERING
================================================================================ */

// Vẽ lại trang hiện tại (không tải lại server), vd: khi trạng thái khóa cuộn thay đổi
function renderCurrentPage() {
  if (groupByMode) {
    renderGroupedTable(tableData);
  } else {
    renderTableData(tableData);
  }
  updatePaginationControls();
  updateQuantitySummary();
}

function renderTableData(data) {
  const table = document.getElementById('dataTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (!data || data.length < 2) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = displayColIndexes.length;
    td.textContent = 'Không tìm thấy kết quả phù hợp';
    td.style.textAlign = 'center';
    td.style.padding = '20px';
    td.style.color = '#666';
    td.style.fontStyle = 'italic';
    td.style.backgroundColor = '#f9f9f9';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const headerRow = document.createElement('tr');
  displayColIndexes.forEach(colIdx => {
    const th = document.createElement('th');
    th.textContent = data[0][colIdx] || '';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const fragment = document.createDocumentFragment();
  for (let i = 1; i < data.length; i++) {
    const row = document.createElement('tr');
    const cuonId = String(data[i][7] || '').trim();
    const lockStatus = window.inventoryLockService ? window.inventoryLockService.getLockStatus(cuonId) : { isLocked: false };
    if (lockStatus.isLocked) {
      row.classList.add('table-warning');
      row.style.backgroundColor = 'rgba(255, 193, 7, 0.18)';
    }

    displayColIndexes.forEach(colIdx => {
      const td = document.createElement('td');
      const cell = data[i][colIdx];
      if (colIdx === 1) { // 'Ngày nhập' is index 1
        td.textContent = formatDate(cell);
      } else if (colIdx === 7 && lockStatus.isLocked) {
        const formatted = formatCellQuantityOrWeight(cell, data[0][colIdx]);
        td.innerHTML = `${escapeHtml(formatted)} <span class="badge bg-warning text-dark ms-1" style="font-size: 0.75rem;"><i class="bi bi-hourglass-split"></i> ${escapeHtml(lockStatus.lockedBy)} đang soạn</span>`;
      } else {
        td.textContent = formatCellQuantityOrWeight(cell, data[0][colIdx]);
      }
      row.appendChild(td);
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
      if (tb) for (const row of tb.rows) {
        const cell = row.children[index]; if (cell) cell.style.width = newWidth + 'px';
      }
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

function nextPage() { if (currentPage < totalPages) reloadPage(currentPage + 1); }
function prevPage() { if (currentPage > 1) reloadPage(currentPage - 1); }

// Tổng Khối lượng (kg) + số cuộn theo toàn bộ tồn kho đang lọc (server tính trên mọi trang)
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

const debouncedFilter = debounce(() => filterTable(true), 300);

// Tìm kiếm ở server trên toàn bộ tồn kho; resetPage = false giữ trang hiện tại
function filterTable(resetPage = true) {
  SQ.applyColumnFilters(pager, buildServerFilters(), DEFAULT_ORDER);
  return reloadPage(resetPage ? 1 : currentPage);
}

// Bộ lọc / sắp xếp theo cột trên tiêu đề bảng (home.js) chạy ở server
window.ddcServerAdapter = {
  table: NHAP_TABLE_NAME,
  column: (key) => {
    const header = COLUMN_HEADERS[parseInt(key, 10)];
    if (QTY_DB_COLUMNS[header]) return { name: QTY_DB_COLUMNS[header], type: 'number' };
    return SQ.headerColumn(COLUMN_HEADERS, key, {
      date: ['Ngày nhập'],
      number: ['id'],
      age: { 'Thời gian lưu kho': 'Ngày nhập' }
    });
  },
  baseFilters: buildServerFilters,
  reload: () => filterTable(true)
};


/* =============================================================================
   GROUPING
================================================================================ */

function showNoResultsMessage(message) {
  const table = document.getElementById('dataTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  thead.innerHTML = '';
  tbody.innerHTML = '';

  // Giữ dòng tiêu đề để vẫn bấm được nút lọc cột khi bộ lọc không còn dòng nào
  const headerRow = document.createElement('tr');
  displayColIndexes.forEach(colIdx => {
    const th = document.createElement('th');
    th.textContent = COLUMN_HEADERS[colIdx] || '';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = displayColIndexes.length;
  td.textContent = message;
  td.style.textAlign = 'center';
  td.style.padding = '20px';
  td.style.color = '#666';
  td.style.fontStyle = 'italic';
  td.style.backgroundColor = '#f9f9f9';
  tr.appendChild(td);
  tbody.appendChild(tr);

  const paginationDiv = document.querySelector('.d-flex.align-items-center.justify-content-end');
  if (paginationDiv) paginationDiv.style.display = 'none';

  if (typeof window.ddcRefreshFilterIcons === 'function') window.ddcRefreshFilterIcons();
}

function renderGroupedTable(data) {
  if (!data || data.length < 2) {
    showNoResultsMessage('Không tìm thấy kết quả phù hợp');
    return;
  }

  const table = document.getElementById('dataTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headers = data[0];
  const rows = data.slice(1);

  // Identify numeric columns
  const numericCols = [];
  for (let c = 0; c < headers.length; c++) {
    let numCount = 0;
    for (const row of rows) {
      const v = parseNumericInput(row[c]);
      if (v !== null) numCount++;
    }
    if (numCount > rows.length * 0.3 && c !== GROUP_COL) numericCols.push(c);
  }

  // Header
  const headerRow = document.createElement('tr');
  displayColIndexes.forEach(colIdx => {
    const th = document.createElement('th');
    th.textContent = headers[colIdx] || '';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Grouping
  const groups = new Map();
  for (const row of rows) {
    const key = String(row[GROUP_COL] ?? '').trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const fragment = document.createDocumentFragment();
  for (const [key, groupRows] of groups) {
    // Dòng tổng của nhóm lấy từ server: đúng cho cả nhóm kể cả khi nhóm trải qua nhiều trang
    const groupInfo = groupTotals.get(key);
    const summaryRow = new Array(headers.length).fill('');
    for (let c = 0; c < headers.length; c++) {
      if (c === GROUP_COL) {
        summaryRow[c] = groupRows[0][c] ?? '';
      } else if (QTY_DB_COLUMNS[headers[c]]) {
        const total = groupInfo ? Number(groupInfo.sums?.[QTY_DB_COLUMNS[headers[c]]]) || 0 : 0;
        summaryRow[c] = Number.isInteger(total) ? total.toLocaleString('vi-VN') : total.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
      }
    }

    const tr = document.createElement('tr');
    tr.className = 'group-summary-row';

    displayColIndexes.forEach(colIndex => {
      const td = document.createElement('td');
      td.textContent = summaryRow[colIndex] ?? '';
      if (numericCols.includes(colIndex)) td.style.textAlign = 'center';
      tr.appendChild(td);
    });
    fragment.appendChild(tr);

    for (const row of groupRows) {
      const dtr = document.createElement('tr');
      dtr.className = 'group-detail-row';

      const cuonId = String(row[7] || '').trim();
      const lockStatus = window.inventoryLockService ? window.inventoryLockService.getLockStatus(cuonId) : { isLocked: false };
      if (lockStatus.isLocked) {
        dtr.classList.add('table-warning');
        dtr.style.backgroundColor = 'rgba(255, 193, 7, 0.18)';
      }

      displayColIndexes.forEach(colIndex => {
        const td = document.createElement('td');
        const cell = row[colIndex];
        if (colIndex === 1) { // 'Ngày nhập' is index 1
          td.textContent = formatDate(cell);
        } else if (colIndex === 7 && lockStatus.isLocked) { // 'Cuộn ID'
          const formatted = formatCellQuantityOrWeight(cell, headers[colIndex]);
          td.innerHTML = `${escapeHtml(formatted)} <span class="badge bg-warning text-dark ms-1" style="font-size: 0.75rem;"><i class="bi bi-hourglass-split"></i> ${escapeHtml(lockStatus.lockedBy)} đang soạn</span>`;
        } else {
          td.textContent = formatCellQuantityOrWeight(cell, headers[colIndex]);
        }
        if (numericCols.includes(colIndex)) td.style.textAlign = 'right';
        dtr.appendChild(td);
      });
      fragment.appendChild(dtr);
    }
  }
  tbody.appendChild(fragment);

  // Tồn kho phân trang ở server nên luôn hiện thanh chuyển trang
  const paginationDiv = document.querySelector('.d-flex.align-items-center.justify-content-end');
  if (paginationDiv) paginationDiv.style.display = '';

  if (data && data.length >= 2) {
    enableColumnResize(table);
    updateCellTitles(table);
  }

  // Nút lọc / sắp xếp kiểu Excel trên tiêu đề cột (home.js, lọc ở server qua ddcServerAdapter)
  if (typeof window.ddcRefreshFilterIcons === 'function') window.ddcRefreshFilterIcons();
}


/* =============================================================================
   EXPORT
================================================================================ */

document.getElementById('btnExport').addEventListener('click', async () => {
  const btnExport = document.getElementById('btnExport');
  let allRows;
  try {
    if (btnExport) btnExport.disabled = true;
    allRows = await SQ.exportRows({ table: NHAP_TABLE_NAME, filters: pager.filters });
  } catch (err) {
    alert(`Lỗi xuất Excel: ${err.message}`);
    return;
  } finally {
    if (btnExport) btnExport.disabled = false;
  }
  if (!allRows) return;

  const exportData = [COLUMN_HEADERS, ...allRows.map(toTonRow).map(rowToArray)].map(row =>
    row.filter((_, colIdx) => !HIDDEN_COLUMNS.includes(COLUMN_HEADERS[colIdx]))
  );
  const ws = XLSX.utils.aoa_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dữ liệu");

  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxWidth = 10;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
      if (cell && cell.v) {
        const len = String(cell.v).length;
        if (len > maxWidth) maxWidth = len;
      }
    }
    ws['!cols'] = ws['!cols'] || [];
    ws['!cols'][C] = { wch: Math.min(60, maxWidth + 2) };
  }

  XLSX.writeFile(wb, "tole_du_lieu_ton.xlsx");
});


/* =============================================================================
   EVENT LISTENERS
================================================================================ */

document.addEventListener('click', (e) => {
  const id = e.target && e.target.id;
  if (!id) return;
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
      hamburger.classList.remove('active');
    }
  });

  initRowDetailPopup();
});


/* =============================================================================
   ROW DETAIL POPUP
================================================================================ */

function initRowDetailPopup() {
  const table = document.getElementById('dataTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    if (row.querySelector('th')) return;
    if (row.cells.length === 1 && row.cells[0].colSpan > 1) return;
    showRowDetail(row);
  });
}

function showRowDetail(row) {
  const table = document.getElementById('dataTable');
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => {
    const clone = th.cloneNode(true);
    const resizer = clone.querySelector('.col-resizer');
    if (resizer) resizer.remove();
    return clone.textContent.trim();
  });

  const cells = Array.from(row.cells).map(td => td.textContent.trim());
  const modalBody = document.getElementById('rowDetailContent');
  if (!modalBody) return;

  let html = `
    <div class="alert alert-info py-2 px-3 mb-4" style="font-size: 0.8rem; border-radius: 8px;">
      <i class="bi bi-info-circle me-1"></i> 
      Dữ liệu chỉ sửa đổi tạm thời để đối chiếu, <strong>không được lưu</strong> vào hệ thống.
    </div>
    <div class="detail-grid">`;
  
  const isSummary = row.classList.contains('group-summary-row');
  
  headers.forEach((header, index) => {
    const value = cells[index];
    if (isSummary && (!value || value === '')) return;
    if (header.toLowerCase() === 'id') return;

    if (header) {
      const isLongText = (value && String(value).length > 50);
      const inputHtml = isLongText 
        ? `<textarea class="form-control detail-input" rows="2">${escapeHtml(value || '')}</textarea>`
        : `<input type="text" class="form-control detail-input" value="${escapeHtml(value || '')}" placeholder="---">`;

      html += `
        <div class="detail-item ${isLongText ? 'grid-col-2' : ''}">
          <span class="detail-label">${header}</span>
          ${inputHtml}
        </div>`;
    }
  });
  html += '</div>';

  modalBody.innerHTML = html;

  const modalEl = document.getElementById('rowDetailModal');
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}
