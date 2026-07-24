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
let tableData = [];           // lưu dữ liệu gốc từ Supabase [header, ...rows]
let filteredData = [];         // dữ liệu sau khi lọc (chưa phân trang)
let displayedData = [];        // dữ liệu đang hiển thị
let groupByMode = true;        // chế độ nhóm theo Mã vật tư - mặc định bật
const GROUP_COL = 4;           // index cột Mã vật tư (0-based)


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

    async function fetchTableData(tableName, selectColumns = '*') {
      let allData = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from(tableName)
          .select(selectColumns)
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
      return allData;
    }

    const [nhapAll, xuatAll] = await Promise.all([
      fetchTableData('tole-nhap'),
      fetchTableData('tole-xuat', '"Cuộn ID"')
    ]);

    // 3. Xử lý khớp dữ liệu
    const exportedCuonIds = new Set(
      xuatAll
        .map(row => String(row['Cuộn ID'] || '').trim().toLowerCase())
        .filter(cuonId => cuonId !== '')
    );

    // Lọc các cuộn trong tole-nhap mà chưa bị xuất và PHẢI CÓ Cuộn ID
    const tonData = nhapAll
      .filter(row => {
        const cuonId = String(row['Cuộn ID'] || '').trim().toLowerCase();
        if (!cuonId) return false;
        return !exportedCuonIds.has(cuonId);
      });

    // Định dạng dữ liệu đầu ra theo cấu trúc tole-ton
    const processedTon = tonData.map(row => {
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
    });

    window._rawSupabaseData = processedTon;
    tableData = [COLUMN_HEADERS, ...processedTon.map(rowToArray)];

    renderTable(tableData);

    document.getElementById('loading').style.display = 'none';
    document.getElementById('btnExport').disabled = false;

    setupFilterEventListeners();

  } catch (error) {
    document.getElementById('loading').innerHTML =
      `Lỗi kết nối Supabase: ${error.message}`;
    console.error('Supabase error:', error);
  }
}

function setupFilterEventListeners() {
  const btnReset = document.getElementById('btnResetFilter');
  const searchInput = document.getElementById('searchInput');

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      renderTable(tableData);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', debouncedFilter);
  }
}


/* =============================================================================
   TABLE RENDERING
================================================================================ */

function renderTable(data) {
  filteredData = data;
  currentPage = 1;
  if (groupByMode) {
    renderGroupedTable(data);
  } else {
    renderTableWithPagination();
  }
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
    displayColIndexes.forEach(colIdx => {
      const td = document.createElement('td');
      const cell = data[i][colIdx];
      if (colIdx === 1) { // 'Ngày nhập' is index 1
        td.textContent = formatDate(cell);
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
  if (groupByMode) {
    const dataToGroup = filteredData.length > 0 ? filteredData : tableData;
    renderGroupedTable(dataToGroup);
    displayedData = dataToGroup;
    return;
  }

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
  const searchVal = document.getElementById('searchInput')?.value?.trim().toLowerCase() || '';
  const needsSearchFilter = searchVal !== '';

  const filtered = [tableData[0]];
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];

    if (needsSearchFilter) {
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


/* =============================================================================
   GROUPING
================================================================================ */

function showNoResultsMessage(message) {
  const table = document.getElementById('dataTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  thead.innerHTML = '';
  tbody.innerHTML = '';

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
}

function renderGroupedTable(data) {
  if (!data || data.length < 2) {
    showNoResultsMessage('Không tìm thấy kết quả phù hợp');
    displayedData = [];
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
  for (let i = 0; i < groups.size; i++) {} // just a placeholder to preserve format or loop correctly
  for (const [key, groupRows] of groups) {
    const summaryRow = new Array(headers.length).fill('');
    for (let c = 0; c < headers.length; c++) {
      if (c === 2) continue; // Skip 'Thời gian lưu kho' (index 2)

      if (c === GROUP_COL) {
        summaryRow[c] = groupRows[0][c] ?? '';
      } else if (numericCols.includes(c)) {
        let total = 0;
        for (const r of groupRows) {
          const v = parseNumericInput(r[c]);
          if (v !== null) total += v;
        }
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

      displayColIndexes.forEach(colIndex => {
        const td = document.createElement('td');
        const cell = row[colIndex];
        if (colIndex === 1) { // 'Ngày nhập' is index 1
          td.textContent = formatDate(cell);
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

  const paginationDiv = document.querySelector('.d-flex.align-items-center.justify-content-end');
  if (paginationDiv && data && data.length >= 2) paginationDiv.style.display = 'none';

  displayedData = data;
  if (data && data.length >= 2) {
    enableColumnResize(table);
    updateCellTitles(table);
  }
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
        ? `<textarea class="form-control detail-input" rows="2">${value || ''}</textarea>`
        : `<input type="text" class="form-control detail-input" value="${value || ''}" placeholder="---">`;

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
