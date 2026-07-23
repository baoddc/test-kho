/* =============================================================================
   TOLE-XUAT - SUPABASE VERSION
   Quản lý dữ liệu xuất tole từ Supabase
   Tên bảng: tole-xuat
   Cột: id, Mã chứng từ, Ngày nhập, Phiếu nhập, Loại nhập, Mã vật tư,
         Tên vật tư, Batch, Cuộn ID, Số lượng (Kg), Mã công trình,
         Tên công trình, Ghi chú
================================================================================ */

// Tên bảng Supabase
const TABLE_NAME = 'tole-xuat';
const TON_TABLE_NAME = 'tole-nhap'; // Bảng nhập kho (để tính tồn kho động)

// Header cột (theo thứ tự trong bảng tole-xuat)
const COLUMN_HEADERS = [
  'id',
  'Mã chứng từ',
  'Ngày xuất',
  'Phiếu xuất',
  'Loại xuất',
  'Mã vật tư',
  'Tên vật tư',
  'Batch',
  'Cuộn ID',
  'Số lượng (Kg)',
  'Số lượng (m)',
  'Mã công trình',
  'Tên công trình',
  'Ghi chú'
];

// Cột ẩn khỏi bảng hiển thị
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
  if (position) window.scrollTo(position.scrollLeft, position.scrollTop);
}

function saveFilterState() {
  const state = { currentPage, searchInput: '', fromDate: '', toDate: '', typeFilters: [], voucherFilters: [] };
  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) state.searchInput = searchInputEl.value;
  const fromDateEl = document.getElementById('fromDate');
  const toDateEl = document.getElementById('toDate');
  if (fromDateEl) state.fromDate = fromDateEl.value;
  if (toDateEl) state.toDate = toDateEl.value;
  state.typeFilters = Array.from(document.querySelectorAll('#typeFilterMenu input[type="checkbox"]'))
    .map(cb => ({ value: cb.value, checked: cb.checked }));
  state.voucherFilters = Array.from(document.querySelectorAll('#voucherFilterMenu input[type="checkbox"]'))
    .map(cb => ({ value: cb.value, checked: cb.checked }));
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
  state.typeFilters?.forEach(filter => {
    const cb = document.querySelector(`#typeFilterMenu input[value="${CSS.escape(filter.value)}"]`);
    if (cb) cb.checked = filter.checked;
  });
  state.voucherFilters?.forEach(filter => {
    const cb = document.querySelector(`#voucherFilterMenu input[value="${CSS.escape(filter.value)}"]`);
    if (cb) cb.checked = filter.checked;
  });
}


/* =============================================================================
   GLOBAL VARIABLES
================================================================================ */

let currentPage = 1;
let totalPages = 1;
let tableData = [];
let cachedInventoryData = null;
let currentModalTarget = null; // 'add' or 'edit'
let filteredData = [];
let displayedData = [];
let selectedRowIndex = -1;
let selectedRowIndexes = [];
let rollCount = 0;
let editRollCount = 0;
let currentMaVatTuFilter = '';


/* =============================================================================
   LOADING OVERLAY
================================================================================ */

function showLoadingOverlay(message) {
  const existingOverlay = document.getElementById('loadingOverlay');
  if (existingOverlay) existingOverlay.remove();
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);display:flex;justify-content:center;align-items:center;z-index:9999;">
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
    if (iso) { date = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3])); }
    else {
      const m = dateValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m) {
        let y = parseInt(m[3], 10);
        if (y < 100) y += y < 50 ? 2000 : 1900;
        date = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
      }
    }
  } else if (dateValue instanceof Date) { date = dateValue; }
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
  const hasComma = text.includes(','), hasDot = text.includes('.');
  if (hasComma && hasDot) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
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
    const n = parseNumericInput(cell); if (n !== null) return n.toString();
  }
  const isQty = h.includes('so luong') || h.includes('trong luong') || h.includes('luong (kg)') || h === 'kg';
  if (isQty) {
    const n = parseNumericInput(cell);
    if (n !== null) return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }
  return cell;
}

function rowToArray(obj) {
  return COLUMN_HEADERS.map(col => obj[col] ?? '');
}

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
    btnLogout.addEventListener('click', () => { localStorage.removeItem('currentUser'); window.location.replace('/pages/index.html'); });
  }

  const logo = document.querySelector('.logo');
  if (logo) { logo.style.cursor = 'pointer'; logo.addEventListener('click', () => { window.location.href = '/pages/home.html'; }); }

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

    populateTypeDropdown('Loại xuất', 'typeFilterMenu', 'typeFilterBtn', 'typeFilterCount', tableData);
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
    let headerText = data[0][colIdx] || '';
    if (headerText === 'Ngày nhập') headerText = 'Ngày xuất';
    if (headerText === 'Phiếu nhập') headerText = 'Phiếu xuất';
    if (headerText === 'Loại nhập') headerText = 'Loại xuất';
    th.textContent = headerText;
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

  selectedRowIndex = -1; selectedRowIndexes = [];
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
      if (header === 'Ngày xuất') { td.textContent = formatDate(cell); }
      else { td.textContent = formatCellQuantityOrWeight(cell, header); }
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
    const onMouseMove = (e) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(40, startWidth + diff);
      th.style.width = newWidth + 'px';
      table.style.width = Math.max(startTableWidth, startTableWidth + (newWidth - startWidth)) + 'px';
      const tb = table.tBodies?.[0];
      if (tb) for (const row of tb.rows) { const cell = row.children[index]; if (cell) cell.style.width = newWidth + 'px'; }
    };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
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
  const dateColIndex = COLUMN_HEADERS.indexOf('Ngày xuất');

  const filtered = [tableData[0]];
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    if ((from || to) && dateColIndex >= 0) {
      const d = parseRowDate(row[dateColIndex]);
      if (!d || (from && d < from) || (to && d > to)) continue;
    }
    if (typeSelected.length > 0 && typeColIndex >= 0) {
      let tv = row[typeColIndex];
      if (tv === undefined || tv === null || !typeSelected.includes(String(tv).trim())) continue;
    }
    if (voucherSelected.length > 0 && voucherColIndex >= 0) {
      let vv = row[voucherColIndex];
      if (vv === undefined || vv === null || !voucherSelected.includes(String(vv).trim())) continue;
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
  XLSX.writeFile(wb, 'tole_du_lieu_xuat.xlsx');
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
  modalEl.querySelectorAll('.btn-remove-roll, .btn-remove-edit-roll').forEach(btn => { btn.style.display = isAdmin ? '' : 'none'; });
  return isAdmin;
}

function buildFormField(colName, colIdx, currentVal, container, namePrefix) {
  const col = document.createElement('div');
  col.className = 'col-12 col-md-6';
  const label = document.createElement('label');
  label.className = 'form-label';
  const fieldName = namePrefix + colIdx;

  let displayName = colName;

  if (colName === 'Mã chứng từ') {
    const voucherSet = new Set();
    for (let i = 1; i < tableData.length; i++) {
      const v = String(tableData[i][colIdx] || '').trim();
      if (v) voucherSet.add(v);
    }
    const select = document.createElement('select');
    select.className = 'form-select form-select-sm fw-bold'; select.name = fieldName;
    select.innerHTML = '<option value="">-- Chọn mã --</option>';
    Array.from(voucherSet).sort((a, b) => a.localeCompare(b, 'vi')).forEach(v => {
      const opt = document.createElement('option'); opt.value = v; opt.textContent = v;
      if (currentVal !== undefined && v === String(currentVal).trim()) opt.selected = true;
      select.appendChild(opt);
    });
    select.required = true;
    label.innerHTML = `${displayName} <span class="text-danger">*</span>`;
    col.appendChild(label); col.appendChild(select); container.appendChild(col);
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
          let y = m[3]; if (y.length === 2) y = (parseInt(y,10) < 50 ? '20' : '19') + y;
          dateInput.value = `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
        }
      }
    } else { dateInput.value = new Date().toISOString().split('T')[0]; }
    label.innerHTML = `${displayName} <span class="text-danger">*</span>`;
    col.appendChild(label); col.appendChild(dateInput); container.appendChild(col);
    return;
  }

  // Loại xuất (col 4 trong xg-xuat thực ra là Loại xuất trong DB)
  if (colName === 'Loại xuất') {
    const select = document.createElement('select');
    select.className = 'form-select form-select-sm fw-bold'; select.name = fieldName;
    select.innerHTML = '<option value="">-- Chọn loại xuất --</option>';
    ['Xưởng sản xuất', 'Điều chuyển', 'Gia công ngoài', 'Công trình'].forEach(v => {
      const opt = document.createElement('option'); opt.value = v; opt.textContent = v;
      if (currentVal !== undefined && v === String(currentVal).trim()) opt.selected = true;
      select.appendChild(opt);
    });
    select.required = true;
    label.innerHTML = `${displayName} <span class="text-danger">*</span>`;
    col.appendChild(label); col.appendChild(select); container.appendChild(col);
    return;
  }

  // Default text input
  const input = document.createElement('input');
  input.className = 'form-control form-control-sm fw-bold';
  input.name = fieldName; input.type = 'text';
  if (currentVal !== undefined) input.value = currentVal;

  // Tag Mã vật tư để bật/tắt nút thêm cuộn
  const normCol = colName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normCol.includes('vat tu') && !normCol.includes('ten')) {
    input.id = namePrefix === 'col_' ? 'addDataMaVatTu' : 'editDataMaVatTu';
  }

  const isOptional = colName === 'Ghi chú';
  if (!isOptional) {
    input.required = true;
    label.innerHTML = `${displayName} <span class="text-danger">*</span>`;
  } else { label.textContent = displayName; }
  col.appendChild(label); col.appendChild(input); container.appendChild(col);
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
  // Cột chung: Mã CT(1), Ngày(2), Phiếu(3), Loại(4), Mã VT(5), Tên VT(6), Batch(7)
  const commonColIndices = [1, 2, 3, 4, 5, 6, 7];
  commonColIndices.forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, undefined, commonFieldsContainer, 'col_');
  });

  // Additional: Mã CT công trình(10), Tên CT(11), Ghi chú(12)
  const additionalColIndices = [];
  for (let i = quantityColIndex + 1; i < COLUMN_HEADERS.length; i++) {
    if (!HIDDEN_COLUMNS.includes(COLUMN_HEADERS[i])) additionalColIndices.push(i);
  }
  additionalColIndices.forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, undefined, additionalFieldsContainer, 'add_ext_');
  });

  modalEl.dataset.quantityColIndex = String(quantityColIndex);
  modalEl.dataset.additionalColIndices = JSON.stringify(additionalColIndices);

  currentModalTarget = 'add';

  const btnAddRoll = document.getElementById('btnAddRoll');
  if (btnAddRoll) {
    const maVatTuInput = document.getElementById('addDataMaVatTu');
    btnAddRoll.disabled = maVatTuInput ? !maVatTuInput.value.trim() : false;
    btnAddRoll.onclick = () => {
      const maVatTu = document.getElementById('addDataMaVatTu')?.value.trim() || '';
      openInventoryModal('add', maVatTu);
    };

    // Enable/disable btn khi nhập mã vật tư
    if (maVatTuInput) {
      maVatTuInput.addEventListener('input', () => {
        btnAddRoll.disabled = !maVatTuInput.value.trim();
      });
    }
  }

  new bootstrap.Modal(modalEl).show();
}


// ===== EDIT DATA MODAL =====

function openEditDataModal() {
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();

  if (selectedRowIndex < 0 || selectedRowIndex >= tableData.length) {
    alert('Vui lòng chọn một dòng để sửa'); return;
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

  // Add existing roll
  const existingKg = rowData[quantityColIndex] ? String(parseNumericInput(rowData[quantityColIndex]) || '') : '';
  const mColIdx = COLUMN_HEADERS.indexOf('Số lượng (m)');
  const existingM = mColIdx >= 0 && rowData[mColIdx] ? String(parseNumericInput(rowData[mColIdx]) || '') : '';
  const cuonIdIdx = COLUMN_HEADERS.indexOf('Cuộn ID');
  const existingCuonId = cuonIdIdx >= 0 ? String(rowData[cuonIdIdx] || '').trim() : '';
  addEditRollRow(existingCuonId, existingKg, existingM);

  const additionalColIndices = [];
  for (let i = quantityColIndex + 1; i < COLUMN_HEADERS.length; i++) {
    if (!HIDDEN_COLUMNS.includes(COLUMN_HEADERS[i])) additionalColIndices.push(i);
  }
  additionalColIndices.forEach(colIdx => {
    buildFormField(COLUMN_HEADERS[colIdx], colIdx, rowData[colIdx], additionalFieldsContainer, 'edit_ext_');
  });

  modalEl.dataset.quantityColIndex = String(quantityColIndex);
  modalEl.dataset.additionalColIndices = JSON.stringify(additionalColIndices);

  currentModalTarget = 'edit';

  const btnEditAddRoll = document.getElementById('btnEditAddRoll');
  if (btnEditAddRoll) {
    const maVatTuInput = document.getElementById('editDataMaVatTu');
    btnEditAddRoll.disabled = maVatTuInput ? !maVatTuInput.value.trim() : false;
    btnEditAddRoll.onclick = () => {
      const maVatTu = document.getElementById('editDataMaVatTu')?.value.trim() || '';
      openInventoryModal('edit', maVatTu);
    };
    if (maVatTuInput) {
      maVatTuInput.addEventListener('input', () => { btnEditAddRoll.disabled = !maVatTuInput.value.trim(); });
    }
  }

  new bootstrap.Modal(modalEl).show();
}


// ===== DELETE DATA MODAL =====

function openDeleteDataModal() {
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();
  updateSelectedRows();

  if (selectedRowIndexes.length === 0) { alert('Vui lòng chọn ít nhất một dòng để xóa'); return; }

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
   INVENTORY MODAL - Chọn cuộn từ Tồn Kho (Supabase)
================================================================================ */

async function openInventoryModal(target, maVatTu = '') {
  currentModalTarget = target;
  currentMaVatTuFilter = maVatTu;

  const inventoryModal = document.getElementById('inventoryRollsModal');
  if (!inventoryModal) return;

  // Reset selection
  const tbody = document.getElementById('inventoryTableBody');
  if (tbody) tbody.innerHTML = '';

  const loadingDiv = document.getElementById('inventoryLoading');
  if (loadingDiv) { loadingDiv.style.display = ''; loadingDiv.textContent = 'Đang tải dữ liệu tồn...'; }

  const selectedCountEl = document.getElementById('inventorySelectedCount');
  if (selectedCountEl) selectedCountEl.textContent = '0';

  new bootstrap.Modal(inventoryModal).show();

  try {
    let nhapAll = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    // Tải phân trang dữ liệu tole-nhap và lọc ở Database nếu có maVatTu
    while (hasMore) {
      let query = supabase
        .from(TON_TABLE_NAME)
        .select('*');
      
      if (maVatTu) {
        query = query.ilike('Mã vật tư', `%${maVatTu}%`);
      }
      
      query = query.order('id', { ascending: true })
        .range(from, from + batchSize - 1);

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        nhapAll = nhapAll.concat(data);
        if (data.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }

    // Lấy dữ liệu xuất đã được load sẵn trong _rawSupabaseData
    const xuatAll = window._rawSupabaseData || [];

    // Tìm các cuộn đã xuất
    const exportedCuonIds = new Set(
      xuatAll
        .map(row => String(row['Cuộn ID'] || '').trim().toLowerCase())
        .filter(cuonId => cuonId !== '')
    );

    // Tính toán dữ liệu tồn: Lọc các cuộn trong tole-nhap chưa bị xuất
    let tonData = nhapAll.filter(row => {
      const cuonId = String(row['Cuộn ID'] || '').trim().toLowerCase();
      if (!cuonId) return false;
      return !exportedCuonIds.has(cuonId);
    });

    // Lọc theo mã vật tư (nếu có)
    if (maVatTu) {
      const maVatTuLower = maVatTu.toLowerCase();
      tonData = tonData.filter(row => String(row['Mã vật tư'] || '').toLowerCase().includes(maVatTuLower));
    }

    // Sắp xếp theo mã vật tư
    tonData.sort((a, b) => String(a['Mã vật tư'] || '').localeCompare(String(b['Mã vật tư'] || ''), 'vi'));

    // Gán Tồn cuối bằng Số lượng của cuộn nhập
    const processedTon = tonData.map(row => ({
      ...row,
      'Tồn cuối (Kg)': row['Số lượng (Kg)'] || 0,
      'Tồn cuối (m)': row['Số lượng (m)'] || 0
    }));

    cachedInventoryData = processedTon;
    renderInventoryTable(processedTon, document.getElementById('inventorySearchInput')?.value || '');
    if (loadingDiv) loadingDiv.style.display = 'none';

  } catch (err) {
    console.error('Inventory load error:', err);
    if (loadingDiv) loadingDiv.textContent = `Lỗi tải tồn kho: ${err.message}`;
  }
}

function renderInventoryTable(data, searchVal = '') {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = searchVal
    ? data.filter(row => Object.values(row).some(v => v !== null && String(v).toLowerCase().includes(searchVal.toLowerCase())))
    : data;

  filtered.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center">
        <input type="checkbox" class="inventory-checkbox"
               data-ma-vat-tu="${row['Mã vật tư'] || ''}"
               data-cuon-id="${row['Cuộn ID'] || ''}"
               data-ton-kg="${row['Tồn cuối (Kg)'] || 0}"
               data-ton-m="${row['Tồn cuối (m)'] || 0}"
               title="Chọn cuộn này">
      </td>
      <td>${row['Mã vật tư'] || ''}</td>
      <td>${row['Tên vật tư'] || ''}</td>
      <td>${row['Batch'] || ''}</td>
      <td>${row['Cuộn ID'] || ''}</td>
      <td class="text-end">${parseNumericInput(row['Tồn cuối (Kg)'])?.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) || ''}</td>
      <td class="text-end">${parseNumericInput(row['Tồn cuối (m)'])?.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) || ''}</td>
    `;
    tr.querySelector('.inventory-checkbox').addEventListener('change', () => {
      const checked = document.querySelectorAll('#inventoryTableBody .inventory-checkbox:checked').length;
      const countEl = document.getElementById('inventorySelectedCount');
      if (countEl) countEl.textContent = checked;
    });
    tr.addEventListener('click', (e) => {
      if (e.target.classList.contains('inventory-checkbox')) return;
      const cb = tr.querySelector('.inventory-checkbox');
      if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
    });
    tbody.appendChild(tr);
  });

  // Select all checkbox
  const selectAllCb = document.getElementById('selectAllInventoryCheckbox');
  if (selectAllCb) {
    selectAllCb.checked = false;
    selectAllCb.onchange = (e) => {
      document.querySelectorAll('#inventoryTableBody .inventory-checkbox').forEach(cb => { cb.checked = e.target.checked; });
      const checked = document.querySelectorAll('#inventoryTableBody .inventory-checkbox:checked').length;
      const countEl = document.getElementById('inventorySelectedCount');
      if (countEl) countEl.textContent = checked;
    };
  }
}

// Inventory search
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'inventorySearchInput') {
    renderInventoryTable(cachedInventoryData || [], e.target.value);
  }
});

// Confirm inventory selection
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btnConfirmInventorySelection') {
    const selectedCheckboxes = document.querySelectorAll('#inventoryTableBody .inventory-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
      alert('Vui lòng chọn ít nhất một cuộn'); return;
    }

    const target = currentModalTarget;

    if (target === 'add') {
      selectedCheckboxes.forEach(cb => {
        const maVatTu = cb.dataset.maVatTu || '';
        const cuonId = cb.dataset.cuonId || '';
        const tonKg = parseNumericInput(cb.dataset.tonKg) || 0;
        const tonM = parseNumericInput(cb.dataset.tonM) || 0;
        addRollRow(maVatTu, cuonId, String(tonKg), String(tonM));
      });
    } else if (target === 'edit') {
      selectedCheckboxes.forEach(cb => {
        const cuonId = cb.dataset.cuonId || '';
        const tonKg = parseNumericInput(cb.dataset.tonKg) || 0;
        const tonM = parseNumericInput(cb.dataset.tonM) || 0;
        addEditRollRow(cuonId, String(tonKg), String(tonM));
      });
    }

    // Đóng inventory modal
    bootstrap.Modal.getInstance(document.getElementById('inventoryRollsModal'))?.hide();
  }
});


/* =============================================================================
   ROLL MANAGEMENT
================================================================================ */

function addRollRow(maVatTu = '', cuonId = '', kgValue = '', mValue = '') {
  rollCount++;
  const tbody = document.getElementById('rollsTableBody');
  const tr = document.createElement('tr');
  tr.dataset.rollId = rollCount;
  tr.innerHTML = `
    <td class="text-center roll-stt">${rollCount}</td>
    <td><input type="text" class="form-control form-control-sm roll-ma-vt" readonly required placeholder="Mã VT" value="${maVatTu}"></td>
    <td><input type="text" class="form-control form-control-sm roll-cuon-id" readonly placeholder="Cuộn ID" value="${cuonId}"></td>
    <td><input type="number" class="form-control form-control-sm roll-kg" readonly step="any" min="0" inputMode="decimal" required placeholder="Nhập số kg" value="${kgValue}"></td>
    <td><input type="number" class="form-control form-control-sm roll-m" readonly step="any" min="0" inputMode="decimal" required placeholder="Nhập số m" value="${mValue}"></td>
    <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger btn-remove-roll">X</button></td>
  `;
  tbody.appendChild(tr);
  tr.querySelector('.btn-remove-roll').addEventListener('click', () => { tr.remove(); updateRollNumbers(); updateRollTotals(); });
  tr.querySelector('.roll-kg').addEventListener('input', updateRollTotals);
  tr.querySelector('.roll-m').addEventListener('input', updateRollTotals);
  updateRollTotals();
}

function updateRollNumbers() {
  document.querySelectorAll('#rollsTableBody tr').forEach((row, i) => { row.querySelector('.roll-stt').textContent = i + 1; });
}

function updateRollTotals() {
  let totalKg = 0, totalM = 0, rollsWithKg = 0;
  document.querySelectorAll('#rollsTableBody tr').forEach(row => {
    const kgInput = row.querySelector('.roll-kg');
    const mInput = row.querySelector('.roll-m');
    let hasKg = false;
    if (kgInput && kgInput.value) {
      const parsed = parseNumericInput(kgInput.value);
      if (parsed !== null && parsed > 0) { totalKg += parsed; hasKg = true; }
    }
    if (mInput && mInput.value) {
      const parsedM = parseNumericInput(mInput.value);
      if (parsedM !== null && parsedM > 0) { totalM += parsedM; }
    }
    if (hasKg) {
      rollsWithKg++;
    }
  });
  const totalRollsEl = document.getElementById('totalRollsCount');
  const totalKgEl = document.getElementById('totalKg');
  const totalMEl = document.getElementById('totalM');
  if (totalRollsEl) totalRollsEl.textContent = rollsWithKg;
  if (totalKgEl) totalKgEl.textContent = totalKg.toFixed(2).replace('.', ',') + ' kg';
  if (totalMEl) totalMEl.textContent = totalM.toFixed(2).replace('.', ',') + ' m';
}

function addEditRollRow(cuonId = '', kgValue = '', mValue = '') {
  editRollCount++;
  const tbody = document.getElementById('editRollsTableBody');
  const tr = document.createElement('tr');
  tr.dataset.rollId = editRollCount;
  tr.innerHTML = `
    <td class="text-center edit-roll-stt">${editRollCount}</td>
    <td><input type="number" class="form-control form-control-sm edit-roll-kg" readonly step="any" min="0" inputMode="decimal" required placeholder="Nhập số kg" value="${kgValue}"></td>
    <td><input type="number" class="form-control form-control-sm edit-roll-m" readonly step="any" min="0" inputMode="decimal" required placeholder="Nhập số m" value="${mValue}"></td>
    <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger btn-remove-edit-roll">X</button></td>
  `;
  tbody.appendChild(tr);
  tr.querySelector('.btn-remove-edit-roll').addEventListener('click', () => { tr.remove(); updateEditRollNumbers(); updateEditRollTotals(); });
  tr.querySelector('.edit-roll-kg').addEventListener('input', updateEditRollTotals);
  tr.querySelector('.edit-roll-m').addEventListener('input', updateEditRollTotals);
  updateEditRollTotals();
}

function updateEditRollNumbers() {
  document.querySelectorAll('#editRollsTableBody tr').forEach((row, i) => { row.querySelector('.edit-roll-stt').textContent = i + 1; });
}

function updateEditRollTotals() {
  let totalKg = 0, totalM = 0, rollsWithKg = 0;
  document.querySelectorAll('#editRollsTableBody tr').forEach(row => {
    const kgInput = row.querySelector('.edit-roll-kg');
    const mInput = row.querySelector('.edit-roll-m');
    let hasKg = false;
    if (kgInput && kgInput.value) {
      const parsed = parseNumericInput(kgInput.value);
      if (parsed !== null && parsed > 0) { totalKg += parsed; hasKg = true; }
    }
    if (mInput && mInput.value) {
      const parsedM = parseNumericInput(mInput.value);
      if (parsedM !== null && parsedM > 0) { totalM += parsedM; }
    }
    if (hasKg) {
      rollsWithKg++;
    }
  });
  const totalRollsEl = document.getElementById('editTotalRollsCount');
  const totalKgEl = document.getElementById('editTotalKg');
  const editTotalMEl = document.getElementById('editTotalM');
  if (totalRollsEl) totalRollsEl.textContent = rollsWithKg;
  if (totalKgEl) totalKgEl.textContent = totalKg.toFixed(2).replace('.', ',') + ' kg';
  if (editTotalMEl) editTotalMEl.textContent = totalM.toFixed(2).replace('.', ',') + ' m';
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

      const rollDataList = [];
      document.querySelectorAll('#rollsTableBody tr').forEach(row => {
        const kgInput = row.querySelector('.roll-kg');
        const mInput = row.querySelector('.roll-m');
        if (kgInput && kgInput.value) {
          const parsedKg = parseNumericInput(kgInput.value);
          const parsedM = mInput && mInput.value ? parseNumericInput(mInput.value) : 0;
          if (parsedKg !== null && parsedKg > 0) {
            rollDataList.push({
              kg: parsedKg,
              m: parsedM || 0,
              maVatTu: row.querySelector('.roll-ma-vt')?.value.trim() || '',
              cuonId: row.querySelector('.roll-cuon-id')?.value.trim() || ''
            });
          }
        }
      });

      if (rollDataList.length === 0) {
        alert('Vui lòng nhập ít nhất một cuộn với số kg > 0');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
        hideLoadingOverlay(); return;
      }

      const commonData = {};
      form.querySelectorAll('#addDataCommonFields input[name^="col_"], #addDataCommonFields select[name^="col_"]').forEach(inp => {
        const colIdx = parseInt(inp.name.replace('col_', ''), 10);
        commonData[COLUMN_HEADERS[colIdx]] = inp.value || null;
      });

      const extData = {};
      form.querySelectorAll('#addDataAdditionalFields input[name^="add_ext_"], #addDataAdditionalFields select[name^="add_ext_"]').forEach(inp => {
        const colIdx = parseInt(inp.name.replace('add_ext_', ''), 10);
        extData[COLUMN_HEADERS[colIdx]] = inp.value || null;
      });

      const recordsToInsert = rollDataList.map(roll => ({
        ...commonData,
        ...extData,
        'Mã vật tư': roll.maVatTu || commonData['Mã vật tư'] || null,
        'Cuộn ID': roll.cuonId || null,
        'Số lượng (Kg)': roll.kg,
        'Số lượng (m)': roll.m
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

      const rawToEdit = window._rawSupabaseData && window._rawSupabaseData[selectedRowIndex - 1];
      if (typeof isRecordLocked === 'function' && isRecordLocked(rawToEdit)) {
        const idLabel = rawToEdit ? (rawToEdit['Mã chứng từ'] || rawToEdit['Phiếu nhập'] || rawToEdit['Phiếu xuất'] || rawToEdit['Cuộn ID'] || (rawToEdit.id ? `ID: ${rawToEdit.id}` : '')) : '';
        const info = idLabel ? ` (${idLabel})` : '';
        (window.showWarningModal || alert)(`Dữ liệu${info} đã được nhập quá 24 giờ. Hệ thống không cho phép cập nhật.`);
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang cập nhật...'; }
      showLoadingOverlay('Đang cập nhật dữ liệu...');

      const rowId = form.querySelector('input[name="row_id"]')?.value;
      if (!rowId) {
        alert('Không tìm thấy ID dòng');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
        hideLoadingOverlay(); return;
      }

      const rollKgValues = [];
      const rollMValues = [];
      document.querySelectorAll('#editRollsTableBody tr').forEach(row => {
        const kgInput = row.querySelector('.edit-roll-kg');
        const mInput = row.querySelector('.edit-roll-m');
        if (kgInput && kgInput.value) {
          const parsedKg = parseNumericInput(kgInput.value);
          const parsedM = mInput && mInput.value ? parseNumericInput(mInput.value) : 0;
          if (parsedKg !== null && parsedKg > 0) {
            rollKgValues.push(parsedKg);
            rollMValues.push(parsedM || 0);
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

      updateData['Số lượng (Kg)'] = rollKgValues.reduce((sum, kg) => sum + kg, 0);
      updateData['Số lượng (m)'] = rollMValues.reduce((sum, m) => sum + m, 0);
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

    const lockedItems = [];
    selectedRowIndexes.forEach(idx => {
      const raw = window._rawSupabaseData && window._rawSupabaseData[idx - 1];
      if (typeof isRecordLocked === 'function' && isRecordLocked(raw)) {
        const idLabel = raw
          ? (raw['Mã chứng từ'] || raw['Phiếu nhập'] || raw['Phiếu xuất'] || raw['Cuộn ID'] || (raw.id ? `ID: ${raw.id}` : `Dòng ${idx}`))
          : `Dòng ${idx}`;
        lockedItems.push(idLabel);
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
  if (hamburger && mainNav) { hamburger.addEventListener('click', (e) => { e.preventDefault(); }); }
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && mainNav && hamburger) {
      if (!mainNav.contains(e.target) && !hamburger.contains(e.target)) {
        mainNav.classList.remove('active'); hamburger.classList.remove('active');
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
