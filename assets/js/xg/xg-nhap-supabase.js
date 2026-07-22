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
}


/* =============================================================================
   GLOBAL VARIABLES
================================================================================ */

let currentPage = 1;
let totalPages = 1;
let tableData = [];         // duoi dang 2D array [header, ...rows]
let filteredData = [];
let displayedData = [];
let selectedRowIndex = -1;
let selectedRowIndexes = [];

let rollCount = 0;
let editRollCount = 0;


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
    logo.addEventListener('click', () => { window.location.href = '/pages/home.html'; });
  }

  loadSupabaseData();
});


/* =============================================================================
   DATA LOADING - SUPABASE
================================================================================ */

async function loadSupabaseData() {
  try {
    document.getElementById('loading').style.display = '';
    document.getElementById('loading').textContent = 'Đang tải dữ liệu...';

    let allData = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + batchSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }

    window._rawSupabaseData = allData;

    tableData = [COLUMN_HEADERS, ...allData.map((row, idx) => {
      const arr = rowToArray(row);
      arr.originalIndex = idx + 1;
      return arr;
    })];

    populateTypeDropdown('Loại nhập', 'typeFilterMenu', 'typeFilterBtn', 'typeFilterCount', tableData);
    populateTypeDropdown('Mã chứng từ', 'voucherFilterMenu', 'voucherFilterBtn', 'voucherFilterCount', tableData);

    renderTable(tableData, false);

    document.getElementById('loading').style.display = 'none';
    document.getElementById('btnExport').disabled = false;

    setupFilterEventListeners();

  } catch (error) {
    document.getElementById('loading').innerHTML =
      `Lỗi kết nối Supabase: ${error.message}<br>Kiểm tra URL và anon key trong supabase-config.js`;
    console.error('Supabase error:', error);
  }
}

function setupFilterEventListeners() {
  const btnReset = document.getElementById('btnResetFilter');
  const fromInput = document.getElementById('fromDate');
  const toInput = document.getElementById('toDate');
  const searchInput = document.getElementById('searchInput');

  if (btnReset) {
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
      renderTable(tableData);
    });
  }

  if (fromInput) fromInput.addEventListener('change', filterTable);
  if (toInput) toInput.addEventListener('change', filterTable);
  if (searchInput) searchInput.addEventListener('input', debouncedFilter);
}


/* =============================================================================
   TABLE RENDERING
================================================================================ */

function renderTable(data, resetPage = true) {
  filteredData = data;
  if (resetPage) currentPage = 1;
  renderTableWithPagination();
}

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
  table.querySelectorAll('th, td').forEach(cell => {
    if (cell.scrollWidth > cell.clientWidth + 1) cell.title = (cell.textContent || '').trim();
    else cell.removeAttribute('title');
  });
}

function updateSelectedRows() {
  const checkboxes = document.querySelectorAll('#dataTable tbody .row-checkbox');
  selectedRowIndexes = [];
  checkboxes.forEach(cb => { if (cb.checked) selectedRowIndexes.push(parseInt(cb.value, 10)); });

  const btnEdit = document.getElementById('btnEditData');
  const btnDelete = document.getElementById('btnDeleteData');

  if (selectedRowIndexes.length > 0) {
    btnDelete.disabled = false;
    btnDelete.textContent = `Xóa đã chọn (${selectedRowIndexes.length})`;
    btnEdit.disabled = selectedRowIndexes.length !== 1;
  } else {
    btnEdit.disabled = true;
    btnDelete.disabled = true;
    btnDelete.textContent = 'Xóa dữ liệu';
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

function calculatePagination(data) {
  totalPages = Math.max(1, Math.ceil((data.length - 1) / ROWS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
}

function getPageData(data) {
  if (!data || data.length === 0) return [];
  calculatePagination(data);
  const startRow = (currentPage - 1) * ROWS_PER_PAGE + 1;
  const endRow = Math.min(startRow + ROWS_PER_PAGE, data.length);
  return data.slice(0, 1).concat(data.slice(startRow, endRow));
}

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
  if (newPage >= 1 && newPage <= totalPages) { currentPage = newPage; renderTableWithPagination(); }
}

function nextPage() { if (currentPage < totalPages) { currentPage++; renderTableWithPagination(); } }
function prevPage() { if (currentPage > 1) { currentPage--; renderTableWithPagination(); } }

function renderTableWithPagination() {
  const dataToPaginate = filteredData.length > 0 ? filteredData : tableData;
  const pageData = getPageData(dataToPaginate);
  renderTableData(pageData);
  updatePaginationControls();
  displayedData = dataToPaginate;
}


/* =============================================================================
   FILTERING
================================================================================ */

const debouncedFilter = debounce(filterTable, 300);

function filterTable() {
  const fromVal = document.getElementById('fromDate')?.value || '';
  const toVal = document.getElementById('toDate')?.value || '';
  const searchVal = document.getElementById('searchInput')?.value?.trim().toLowerCase() || '';

  const typeMenu = document.getElementById('typeFilterMenu');
  const typeSelected = typeMenu ? Array.from(typeMenu.querySelectorAll('input[type="checkbox"]:checked')).map(i => String(i.value).trim()).filter(Boolean) : [];
  const typeColIndex = typeMenu?.dataset?.colIndex ? parseInt(typeMenu.dataset.colIndex, 10) : -1;

  const voucherMenu = document.getElementById('voucherFilterMenu');
  const voucherSelected = voucherMenu ? Array.from(voucherMenu.querySelectorAll('input[type="checkbox"]:checked')).map(i => String(i.value).trim()).filter(Boolean) : [];
  const voucherColIndex = voucherMenu?.dataset?.colIndex ? parseInt(voucherMenu.dataset.colIndex, 10) : -1;

  const from = fromVal ? new Date(fromVal) : null;
  const to = toVal ? new Date(toVal) : null;
  if (from) from.setHours(0, 0, 0, 0);
  if (to) to.setHours(23, 59, 59, 999);
  const dateColIndex = COLUMN_HEADERS.indexOf('Ngày nhập');

  const filtered = [tableData[0]];
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];

    if ((from || to) && dateColIndex >= 0) {
      const d = parseRowDate(row[dateColIndex]);
      if (!d) continue;
      if (from && d < from) continue;
      if (to && d > to) continue;
    }

    if (typeSelected.length > 0 && typeColIndex >= 0) {
      let tv = row[typeColIndex];
      if (tv === undefined || tv === null) continue;
      if (!typeSelected.includes(String(tv).trim())) continue;
    }

    if (voucherSelected.length > 0 && voucherColIndex >= 0) {
      let vv = row[voucherColIndex];
      if (vv === undefined || vv === null) continue;
      if (!voucherSelected.includes(String(vv).trim())) continue;
    }

    if (searchVal) {
      let matchFound = false;
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        let cellValue = row[colIdx];
        if (cellValue !== undefined && cellValue !== null) {
          if (typeof cellValue !== 'string') cellValue = String(cellValue);
          if (cellValue.toLowerCase().includes(searchVal)) { matchFound = true; break; }
        }
      }
      if (!matchFound) continue;
    }

    filtered.push(row);
  }

  renderTable(filtered);
}

function populateTypeDropdown(headerName, menuId, btnId, countId, data) {
  if (!data || data.length === 0) return;
  const header = data[0] || [];
  const idx = header.findIndex(h => String(h ?? '').trim().toLowerCase() === String(headerName).trim().toLowerCase());
  const menu = document.getElementById(menuId);
  const countEl = document.getElementById(countId);
  if (!menu) return;
  menu.innerHTML = '';

  if (idx === -1) {
    menu.innerHTML = '<div class="text-muted small">Không tìm thấy cột</div>';
    if (countEl) countEl.textContent = '0';
    return;
  }

  const set = new Set();
  for (let i = 1; i < data.length; i++) {
    let v = data[i][idx];
    if (v === undefined || v === null || v === '') continue;
    set.add(String(v).trim());
  }

  const arr = Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
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
    const label = document.createElement('label');
    label.className = 'form-check-label'; label.htmlFor = id; label.textContent = v;
    wrap.appendChild(input); wrap.appendChild(label); menu.appendChild(wrap);
    input.addEventListener('change', () => {
      if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
      filterTable();
    });
  });

  if (countEl) countEl.textContent = '0';
  menu.dataset.colIndex = String(idx);
}


/* =============================================================================
   EXPORT
================================================================================ */

document.getElementById('btnExport').addEventListener('click', () => {
  if (!displayedData || displayedData.length === 0) return;

  const exportData = displayedData.map(row =>
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
  const isAdmin = localStorage.getItem('currentUser') === 'bao.lt';
  if (!modalEl) return isAdmin;

  modalEl.querySelectorAll('input, select, textarea').forEach(input => { input.disabled = !isAdmin; });

  const submitBtn = modalEl.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.style.display = isAdmin ? '' : 'none';

  const btnAddRollEl = modalEl.querySelector('#btnAddRoll, #btnEditAddRoll');
  if (btnAddRollEl) btnAddRollEl.style.display = isAdmin ? '' : 'none';

  modalEl.querySelectorAll('.btn-remove-roll, .btn-remove-edit-roll').forEach(btn => {
    btn.style.display = isAdmin ? '' : 'none';
  });

  return isAdmin;
}

// Helper: build form field
function buildFormField(colName, colIdx, currentVal, container, namePrefix) {
  const col = document.createElement('div');
  col.className = 'col-12 col-md-6';
  const label = document.createElement('label');
  label.className = 'form-label';
  const fieldName = namePrefix + colIdx;

  if (colName === 'Mã chứng từ') {
    const voucherSet = new Set();
    for (let i = 1; i < tableData.length; i++) {
      const v = String(tableData[i][colIdx] || '').trim();
      if (v) voucherSet.add(v);
    }
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
  updateRollTotals();

  const quantityColIndex = findQuantityColumnIndex();
  // Cột trước Số lượng (bỏ id, Cuộn ID, Vị trí)
  const commonColIndices = [1, 2, 3, 4, 5, 6, 7]; // Mã CT, Ngày, Phiếu, Loại, Mã VT, Tên VT, Batch

  commonColIndices.forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, undefined, commonFieldsContainer, 'col_');
  });

  const maVatTuInput = commonFieldsContainer.querySelector('input[name="col_5"]');
  if (maVatTuInput) {
    maVatTuInput.addEventListener('input', () => {
      updateRollCuonIds();
    });
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
    maVatTuInput.addEventListener('input', () => {
      updateEditRollCuonIds();
    });
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

  const isAdmin = localStorage.getItem('currentUser') === 'bao.lt';
  const deleteBtn = modalEl.querySelector('#btnConfirmDelete');
  if (deleteBtn) deleteBtn.style.display = isAdmin ? '' : 'none';

  new bootstrap.Modal(modalEl).show();
}


/* =============================================================================
   ROLL MANAGEMENT
================================================================================ */

function updateRollCuonIds() {
  const maVatTuInput = document.querySelector('#addDataCommonFields input[name="col_5"]');
  if (!maVatTuInput) return;
  const maVatTu = maVatTuInput.value.trim();
  if (!maVatTu) {
    document.querySelectorAll('#rollsTableBody .roll-cuon-id').forEach(input => { input.value = ''; });
    return;
  }

  const existingCount = (window._rawSupabaseData || []).filter(row => 
    String(row['Mã vật tư'] || '').trim().toLowerCase() === maVatTu.toLowerCase()
  ).length;

  document.querySelectorAll('#rollsTableBody tr').forEach((row, index) => {
    const cuonIdInput = row.querySelector('.roll-cuon-id');
    if (cuonIdInput) {
      cuonIdInput.value = `${maVatTu} - Cuộn ${existingCount + index}`;
    }
  });
}

function updateEditRollCuonIds() {
  const maVatTuInput = document.querySelector('#editDataCommonFields input[name="col_5"]');
  if (!maVatTuInput) return;
  const maVatTu = maVatTuInput.value.trim();
  if (!maVatTu) {
    document.querySelectorAll('#editRollsTableBody .edit-roll-cuon-id').forEach(input => { input.value = ''; });
    return;
  }

  const rowId = document.querySelector('#editDataCommonFields input[name="row_id"]')?.value;
  const existingCount = (window._rawSupabaseData || []).filter(row => 
    String(row['Mã vật tư'] || '').trim().toLowerCase() === maVatTu.toLowerCase() &&
    String(row['id']) !== String(rowId)
  ).length;

  document.querySelectorAll('#editRollsTableBody tr').forEach((row, index) => {
    const cuonIdInput = row.querySelector('.edit-roll-cuon-id');
    if (cuonIdInput) {
      cuonIdInput.value = `${maVatTu} - Cuộn ${existingCount + index}`;
    }
  });
}

function addRollRow(cuonId = '', kgValue = '', viTri = '') {
  rollCount++;
  const tbody = document.getElementById('rollsTableBody');
  const tr = document.createElement('tr');
  tr.dataset.rollId = rollCount;
  tr.innerHTML = `
    <td class="text-center roll-stt">${rollCount}</td>
    <td><input type="text" class="form-control form-control-sm roll-cuon-id" readonly placeholder="Cuộn ID" value="${cuonId}"></td>
    <td><input type="number" class="form-control form-control-sm roll-kg" step="any" min="0" inputMode="decimal" required placeholder="Nhập số kg" value="${kgValue}"></td>
    <td><input type="text" class="form-control form-control-sm roll-vi-tri" required placeholder="Vị trí" value="${viTri}"></td>
    <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger btn-remove-roll">X</button></td>
  `;
  tbody.appendChild(tr);
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
}

function addEditRollRow(cuonId = '', kgValue = '', viTri = '') {
  editRollCount++;
  const tbody = document.getElementById('editRollsTableBody');
  const tr = document.createElement('tr');
  tr.dataset.rollId = editRollCount;
  tr.innerHTML = `
    <td class="text-center edit-roll-stt">${editRollCount}</td>
    <td><input type="text" class="form-control form-control-sm edit-roll-cuon-id" readonly placeholder="Cuộn ID" value="${cuonId}"></td>
    <td><input type="number" class="form-control form-control-sm edit-roll-kg" step="any" min="0" inputMode="decimal" required placeholder="Nhập số kg" value="${kgValue}"></td>
    <td><input type="text" class="form-control form-control-sm edit-roll-vi-tri" required placeholder="Vị trí" value="${viTri}"></td>
    <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger btn-remove-edit-roll">X</button></td>
  `;
  tbody.appendChild(tr);
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

      if (error) throw error;

      if (insertedData) {
        insertedData.forEach(row => {
          if (!window._rawSupabaseData) window._rawSupabaseData = [];
          window._rawSupabaseData.push(row);
          const arr = rowToArray(row);
          arr.originalIndex = tableData.length;
          tableData.push(arr);
        });
      }

      renderTable(tableData, false);

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

      if (updatedData && updatedData[0]) {
        const arr = rowToArray(updatedData[0]);
        arr.originalIndex = selectedRowIndex;
        tableData[selectedRowIndex] = arr;
        if (window._rawSupabaseData) {
          const rawIdx = window._rawSupabaseData.findIndex(r => String(r.id) === String(rowId));
          if (rawIdx >= 0) window._rawSupabaseData[rawIdx] = updatedData[0];
        }
      }

      renderTable(tableData, false);
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

      sortedIndexes.forEach(rowIndex => {
        if (rowIndex <= 0 || rowIndex >= tableData.length) return;
        const rowId = tableData[rowIndex][0];
        tableData.splice(rowIndex, 1);
        if (window._rawSupabaseData) {
          const rawIdx = window._rawSupabaseData.findIndex(r => String(r.id) === String(rowId));
          if (rawIdx >= 0) window._rawSupabaseData.splice(rawIdx, 1);
        }
      });

      bootstrap.Modal.getInstance(document.getElementById('deleteDataModal'))?.hide();
      selectedRowIndexes = []; selectedRowIndex = -1;
      renderTable(tableData, false);
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
