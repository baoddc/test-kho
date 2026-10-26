/* =============================================================================
   GRATING-TON - SUPABASE VERSION
   Tồn kho grating theo Mã vật tư + Batch (bảng grating-ton, do trigger ở database
   tính từ grating-nhap − grating-xuat). Grating không có cuộn nên mỗi dòng là 1 mã
   + batch; "Ngày nhập" là ngày của lô cũ nhất còn tồn (xuất theo FIFO).
================================================================================ */

const TABLE_NAME = 'grating-ton';

// Cột hiển thị (theo thứ tự). "Thời gian lưu kho" tính từ "Ngày nhập".
const COLUMN_HEADERS = [
  'Mã vật tư',
  'Tên vật tư',
  'Batch',
  'Số lượng (Kg)',
  'Nhập (Kg)',
  'Xuất (Kg)',
  'Ngày nhập',
  'Thời gian lưu kho',
  'Vị trí',
  'Mã công trình',
  'Tên công trình'
];

const QTY_COLUMNS = ['Số lượng (Kg)', 'Nhập (Kg)', 'Xuất (Kg)'];
const ROWS_PER_PAGE = 100;

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


/* =============================================================================
   GLOBAL VARIABLES
================================================================================ */

let currentPage = 1;
let totalPages = 1;
let tableData = [];           // trang hiện tại [header, ...rows]

const DEFAULT_ORDER = [{ col: 'Mã vật tư', asc: true }, { col: 'id', asc: true }];
const pager = new SQ.ServerPager({ table: TABLE_NAME, pageSize: ROWS_PER_PAGE, sumCols: ['Số lượng (Kg)'], order: DEFAULT_ORDER });

const gratingChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('grating_sync_channel') : null;


/* =============================================================================
   UTILITY FUNCTIONS
================================================================================ */

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  const iso = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : String(dateValue);
}

// Số ngày từ ngày nhập (lô cũ nhất còn tồn) tới hôm nay
function storageDays(dateValue) {
  const iso = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return '';
  const start = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - start) / 86400000));
}

function formatKg(value) {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '';
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function rowToArray(row) {
  return COLUMN_HEADERS.map(col => (col === 'Thời gian lưu kho' ? storageDays(row['Ngày nhập']) : (row[col] ?? '')));
}

function showLoadingOverlay(message) {
  hideLoadingOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:9999;">
      <div style="background:#fff;padding:20px 40px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,.1);text-align:center;font-size:18px;font-weight:500;color:#333;">
        <div style="width:40px;height:40px;margin:0 auto 15px;border:4px solid #f3f3f3;border-top:4px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;"></div>
        <span>${escapeHtml(message)}</span>
      </div>
    </div>
    <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  document.getElementById('loadingOverlay')?.remove();
}

function updateLoadingOverlay(message) {
  const span = document.querySelector('#loadingOverlay span');
  if (span) span.textContent = message;
}


/* =============================================================================
   DATA LOADING
================================================================================ */

// Mặc định chỉ hiện mã còn tồn; bật "Hiện cả mã đã hết tồn" để xem toàn bộ lịch sử
function buildServerFilters() {
  const showEmpty = document.getElementById('showEmptyToggle')?.checked;
  return {
    search: document.getElementById('searchInput')?.value?.trim() || '',
    range: showEmpty ? [] : [{ col: 'Số lượng (Kg)', gt: '0' }]
  };
}

async function reloadPage(page) {
  const loadingEl = document.getElementById('loading');
  try {
    const result = await pager.load(page);
    if (!result) return;  // đã có yêu cầu mới hơn
    currentPage = result.page;
    totalPages = result.totalPages;
    tableData = [COLUMN_HEADERS, ...result.rows.map(rowToArray)];
    renderTableData(tableData);
    updatePaginationControls();
    updateQuantitySummary();
    if (loadingEl) loadingEl.style.display = 'none';
    const btnExport = document.getElementById('btnExport');
    if (btnExport) btnExport.disabled = false;
  } catch (error) {
    console.error('Supabase error in reloadPage:', error);
    if (loadingEl) {
      loadingEl.style.display = '';
      loadingEl.textContent = `Lỗi kết nối Supabase: ${error.message}`;
    }
  }
}

function filterTable(resetPage = true) {
  SQ.applyColumnFilters(pager, buildServerFilters(), DEFAULT_ORDER);
  return reloadPage(resetPage ? 1 : currentPage);
}

// Tải lại khi trang Nhập / Xuất grating (tab khác) vừa ghi dữ liệu
const reloadAfterChange = debounce(() => { pager.invalidate(); reloadPage(currentPage); }, 500);
if (gratingChannel) gratingChannel.onmessage = () => reloadAfterChange();

// Bộ lọc / sắp xếp theo cột trên tiêu đề bảng (home.js) chạy ở server
window.ddcServerAdapter = {
  table: TABLE_NAME,
  column: (key) => SQ.headerColumn(COLUMN_HEADERS, key, {
    date: ['Ngày nhập'],
    number: QTY_COLUMNS,
    age: { 'Thời gian lưu kho': 'Ngày nhập' }
  }),
  baseFilters: buildServerFilters,
  reload: () => filterTable(true)
};


/* =============================================================================
   TABLE RENDERING
================================================================================ */

function renderTableData(data) {
  const table = document.getElementById('dataTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headerRow = document.createElement('tr');
  data[0].forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  if (data.length < 2) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = data[0].length;
    td.className = 'text-center text-muted fst-italic py-3';
    td.textContent = 'Không có mã grating nào phù hợp';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (let i = 1; i < data.length; i++) {
    const tr = document.createElement('tr');
    data[i].forEach((cell, colIdx) => {
      const header = data[0][colIdx];
      const td = document.createElement('td');
      if (header === 'Ngày nhập') {
        td.textContent = formatDate(cell);
      } else if (QTY_COLUMNS.includes(header)) {
        td.textContent = formatKg(cell);
        td.style.textAlign = 'right';
        if (header === 'Số lượng (Kg)') td.classList.add('fw-bold');
      } else if (header === 'Thời gian lưu kho') {
        td.textContent = cell === '' ? '' : `${cell} ngày`;
        td.style.textAlign = 'right';
      } else {
        td.textContent = cell ?? '';
      }
      tr.appendChild(td);
    });
    // Mã đã hết tồn (chỉ hiện khi bật "Hiện cả mã đã hết tồn")
    if (!(Number(data[i][COLUMN_HEADERS.indexOf('Số lượng (Kg)')]) > 0)) tr.classList.add('text-muted');
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
}


/* =============================================================================
   PAGINATION & SUMMARY
================================================================================ */

function updatePaginationControls() {
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageSelect = document.getElementById('pageSelect');

  if (pageInfo) pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  if (pageSelect && (parseInt(pageSelect.value, 10) !== currentPage || pageSelect.options.length !== totalPages)) {
    pageSelect.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Trang ${i}`;
      if (i === currentPage) opt.selected = true;
      pageSelect.appendChild(opt);
    }
  }
}

function updateQuantitySummary() {
  const valueEl = document.getElementById('totalQtyValue');
  const rowsEl = document.getElementById('totalQtyRows');
  if (valueEl) valueEl.textContent = formatKg(Number(pager.sums['Số lượng (Kg)']) || 0) || '0';
  if (rowsEl) rowsEl.textContent = (pager.total || 0).toLocaleString('vi-VN');
}


/* =============================================================================
   EXPORT
================================================================================ */

async function exportExcel() {
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

  const ws = XLSX.utils.aoa_to_sheet([COLUMN_HEADERS, ...allRows.map(rowToArray)]);
  ws['!cols'] = COLUMN_HEADERS.map(h => ({ wch: Math.max(12, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ton grating');
  XLSX.writeFile(wb, 'grating_ton_kho.xlsx');
}


/* =============================================================================
   EVENT LISTENERS
================================================================================ */

window.addEventListener('load', () => {
  const searchInput = document.getElementById('searchInput');

  // Mở từ link vị trí kệ (?vitri=GR-01) → tìm theo vị trí đó
  const urlParams = new URLSearchParams(window.location.search);
  const vitriParam = urlParams.get('vitri') || urlParams.get('loc') || urlParams.get('location');
  if (vitriParam && searchInput) {
    searchInput.value = window.qrScannerService ? window.qrScannerService.parseLocationQRCode(vitriParam) : vitriParam.trim().toUpperCase();
  }

  searchInput?.addEventListener('input', debounce(() => filterTable(true), 300));
  document.getElementById('showEmptyToggle')?.addEventListener('change', () => filterTable(true));

  document.getElementById('btnResetFilter')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    const toggle = document.getElementById('showEmptyToggle');
    if (toggle) toggle.checked = false;
    filterTable(true);
  });

  document.getElementById('btnScanQR')?.addEventListener('click', () => {
    if (window.qrScannerService && window.qrScannerService.openQRCameraScanner) {
      window.qrScannerService.openQRCameraScanner((scannedRack) => {
        if (searchInput) searchInput.value = scannedRack;
        filterTable(true);
      });
    } else {
      alert('Module quét mã QR chưa sẵn sàng.');
    }
  });

  document.getElementById('btnExport')?.addEventListener('click', exportExcel);
  document.getElementById('prevPage')?.addEventListener('click', () => { if (currentPage > 1) reloadPage(currentPage - 1); });
  document.getElementById('nextPage')?.addEventListener('click', () => { if (currentPage < totalPages) reloadPage(currentPage + 1); });
  document.getElementById('pageSelect')?.addEventListener('change', (e) => reloadPage(parseInt(e.target.value, 10)));

  filterTable(true);
});
