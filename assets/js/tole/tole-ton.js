/* =============================================================================
   CONSTANTS & CONFIGURATION
   Các hằng số cấu hình cho ứng dụng
================================================================================ */

// Thay bằng ID Google Sheet của bạn
const SHEET_ID = '1GgNUPIYxvfJ1eQL4As6Vs0nb10A9ZIvoFQ4r2ZYm2pU';   // ← THAY Ở ĐÂY
const SHEET_GID = '869739970';                     // gid của sheet (Tồn)

// URL để tải file .xlsx (giữ nguyên định dạng từ Google Sheets)
const XLSX_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID}`;

// ==================== PAGINATION CONFIG ====================
const ROWS_PER_PAGE = 100; // Số dòng hiển thị mỗi trang
// ============================================================


/* =============================================================================
   GLOBAL VARIABLES
   Biến toàn cục quản lý state của ứng dụng
================================================================================ */

let currentPage = 1;
let totalPages = 1;
let tableData = [];           // lưu dữ liệu gốc từ Google Sheet
let filteredData = [];         // dữ liệu sau khi lọc (chưa phân trang)
let displayedData = [];        // dữ liệu đang hiển thị (trang hiện tại)
let groupByMode = true;        // chế độ nhóm theo Mã vật tư - mặc định bật
const GROUP_COL = 3;           // index cột Mã vật tư (0-based)


/* =============================================================================
   UTILITY FUNCTIONS
   Các hàm tiện ích dùng chung trong ứng dụng
================================================================================ */

// Debounce helper function - Giới hạn tần suất gọi hàm
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Chuyển đổi ngày tháng từ Excel/sheet sang định dạng dd/mm/yyyy
function formatDate(dateValue) {
  if (!dateValue) return '';

  let date = null;

  if (typeof dateValue === 'number') {
    // Excel serial date
    date = new Date((dateValue - 25569) * 86400 * 1000);
  } else if (typeof dateValue === 'string') {
    date = parseRowDate(dateValue);
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    return dateValue ?? '';
  }

  if (!date || isNaN(date.getTime())) {
    return dateValue ?? '';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// Parse ngày tháng từ các định dạng khác nhau
function parseRowDate(raw) {
  if (raw === undefined || raw === null || raw === '') return null;

  // Excel serial number
  if (typeof raw === 'number') {
    return new Date((raw - 25569) * 86400 * 1000);
  }

  // String format: dd/mm/yyyy or dd-mm-yyyy
  if (typeof raw === 'string') {
    const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let d = parseInt(m[1], 10);
      let mo = parseInt(m[2], 10) - 1;
      let y = parseInt(m[3], 10);
      if (y < 100) y += y < 50 ? 2000 : 1900;
      return new Date(y, mo, d);
    }
    // ISO format or other
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) return dt;
    return null;
  }
  return null;
}

// Parse input thành số, hỗ trợ cả dấu phẩy và chấm
function parseNumericInput(value) {
  let text = String(value ?? '').trim();
  if (!text) return null;
  text = text.replace(/\s+/g, '');

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');

  if (hasComma && hasDot) {
    // Cả hai dấu - lấy cái nào ở sau cùng
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Chỉ có dấu phẩy
    const parts = text.split(',');
    if (parts.length === 2) {
      text = `${parts[0]}.${parts[1]}`;
    } else {
      text = text.replace(/,/g, '');
    }
  }

  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

// Chuẩn hóa text header để so sánh
function normalizeHeaderText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}


/* =============================================================================
   AUTHENTICATION
   Kiểm tra và quản lý đăng nhập
================================================================================ */

// Kiểm tra xem đã đăng nhập chưa, nếu chưa thì quay về trang đăng nhập
window.addEventListener('load', () => {
  const currentUser = localStorage.getItem('currentUser');

  // Hiển thị username
  const usernameEl = document.getElementById('currentUsername');
  if (usernameEl) usernameEl.textContent = currentUser || 'Khách';

  // Xử lý nút đăng xuất
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout && currentUser) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.replace('/pages/index.html');
    });
  }

  // Logo click to go home
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      window.location.href = '/pages/home.html';
    });
  }

  loadGoogleSheet();
});


/* =============================================================================
   DATA LOADING
   Tải dữ liệu từ Google Sheet
================================================================================ */

// Tải dữ liệu khi trang mở
async function loadGoogleSheet() {
  try {
    const response = await fetch(XLSX_EXPORT_URL);
    if (!response.ok) throw new Error("Không thể truy cập Google Sheet (XLSX export)");

    const arrayBuffer = await response.arrayBuffer();

    // Dùng SheetJS đọc file xlsx để giữ định dạng hiển thị (cell.w)
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Chuyển thành mảng 2 chiều; raw:false để lấy text đã format từ sheet (cell.w)
    tableData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

    if (tableData.length === 0) {
      document.getElementById('loading').innerHTML = "Không có dữ liệu hoặc sheet rỗng";
      return;
    }

    // Filter out empty rows and rows with #REF for Tồn data
    const filteredTableData = [tableData[0]]; // Keep header row
    for (let i = 1; i < tableData.length; i++) {
      const row = tableData[i];

      // Skip rows where column 1 (index 0) has no data
      const col1Value = row[0];
      if (col1Value === undefined || col1Value === null || String(col1Value).trim() === '') {
        continue;
      }

      // Skip rows containing #REF in any cell
      const hasRef = row.some(cell => {
        const cellStr = String(cell || '').toUpperCase();
        return cellStr.includes('#REF');
      });
      if (hasRef) {
        continue;
      }

      // Skip empty rows (all cells are null, undefined, or empty string)
      const isEmptyRow = row.every(cell => {
        return cell === undefined || cell === null || String(cell).trim() === '';
      });
      if (isEmptyRow) {
        continue;
      }

      filteredTableData.push(row);
    }
    tableData = filteredTableData;

    renderTable(tableData);

    document.getElementById('loading').style.display = 'none';
    document.getElementById('btnExport').disabled = false;

    // Gắn sự kiện cho bộ lọc ngày
    setupFilterEventListeners();

  } catch (error) {
    document.getElementById('loading').innerHTML =
      `Lỗi: ${error.message}<br>Kiểm tra xem sheet đã được Publish to web chưa.`;
    console.error(error);
  }
}

// Thiết lập các sự kiện cho bộ lọc
function setupFilterEventListeners() {
  const btnReset = document.getElementById('btnResetFilter');
  const searchInput = document.getElementById('searchInput');

  // Nút reset bộ lọc
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      renderTable(tableData);
    });
  }

  // Sự kiện search với debounce
  if (searchInput) {
    searchInput.addEventListener('input', debouncedFilter);
  }
}


/* =============================================================================
   TABLE RENDERING
   Hiển thị dữ liệu ra bảng
================================================================================ */

// Render bảng dữ liệu
function renderTable(data) {
  filteredData = data;
  currentPage = 1;
  if (groupByMode) {
    renderGroupedTable(data);
  } else {
    renderTableWithPagination();
  }
}

// Helper to format quantity/weight cells with Vietnamese comma decimal separator
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

// Render dữ liệu của trang hiện tại
function renderTableData(data) {
  const table = document.getElementById('dataTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  thead.innerHTML = '';
  tbody.innerHTML = '';

  // Kiểm tra nếu không có dữ liệu (chỉ có header hoặc không có gì)
  if (!data || data.length < 2) {
    // Hiển thị thông báo trong tbody
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 15;
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

  // Header
  const headerRow = document.createElement('tr');
  data[0].forEach(cell => {
    const th = document.createElement('th');
    th.textContent = cell || '';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Dữ liệu (bỏ dòng đầu)
  for (let i = 1; i < data.length; i++) {
    const row = document.createElement('tr');
    data[i].forEach((cell, colIndex) => {
      const td = document.createElement('td');
      // Cột ngày (index 2) - format đặc biệt
      if (colIndex === 2) {
        td.textContent = formatDate(cell);
      } else {
        td.textContent = formatCellQuantityOrWeight(cell, data[0][colIndex]);
      }
      row.appendChild(td);
    });

    tbody.appendChild(row);
  }

  enableColumnResize(table);
  updateCellTitles(table);
}

// Cập nhật title cho các cell bị tràn
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

// Window resize - cập nhật titles
window.addEventListener('resize', () => updateCellTitles(document.getElementById('dataTable')));


/* =============================================================================
   COLUMN RESIZE
   Chức năng thay đổi độ rộng cột
================================================================================ */

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


/* =============================================================================
   PAGINATION
   Các chức năng phân trang
================================================================================ */

function calculatePagination(data) {
  totalPages = Math.max(1, Math.ceil((data.length - 1) / ROWS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
}

function getPageData(data) {
  if (!data || data.length === 0) return [];

  calculatePagination(data);

  // Data includes header row at index 0
  const startRow = (currentPage - 1) * ROWS_PER_PAGE + 1;
  const endRow = Math.min(startRow + ROWS_PER_PAGE, data.length);

  return data.slice(0, 1).concat(data.slice(startRow, endRow));
}

function updatePaginationControls() {
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageSelect = document.getElementById('pageSelect');

  if (pageInfo) {
    pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
  }

  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
  }

  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
  }

  // Update page select dropdown if exists
  if (pageSelect) {
    const currentVal = parseInt(pageSelect.value, 10);
    if (currentVal !== currentPage || pageSelect.options.length !== totalPages) {
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
}

function goToPage(page) {
  const newPage = parseInt(page, 10);
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    renderTableWithPagination();
  }
}

function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    renderTableWithPagination();
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTableWithPagination();
  }
}

function renderTableWithPagination() {
  // If in group mode, don't paginate
  if (groupByMode) {
    const dataToGroup = filteredData.length > 0 ? filteredData : tableData;
    renderGroupedTable(dataToGroup);
    displayedData = dataToGroup;
    return;
  }

  // Use filteredData if available, otherwise use tableData
  const dataToPaginate = filteredData.length > 0 ? filteredData : tableData;
  const pageData = getPageData(dataToPaginate);

  renderTableData(pageData);
  updatePaginationControls();

  // Update displayedData to include all filtered data for export
  displayedData = dataToPaginate;
}


/* =============================================================================
   FILTERING
   Các chức năng lọc dữ liệu
================================================================================ */

// Debounced filter function for better performance
const debouncedFilter = debounce(filterTable, 300);

function filterTable() {
  const searchVal = document.getElementById('searchInput')?.value?.trim().toLowerCase() || '';
  const needsSearchFilter = searchVal !== '';

  const filtered = [tableData[0]];
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];

    // Search filter: check ALL columns
    if (needsSearchFilter) {
      let matchFound = false;

      // Iterate through all columns in the row
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        let cellValue = row[colIdx];
        if (cellValue !== undefined && cellValue !== null) {
          if (typeof cellValue !== 'string') cellValue = String(cellValue);
          if (cellValue.toLowerCase().includes(searchVal)) {
            matchFound = true;
            break;
          }
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
   Chức năng nhóm theo Mã vật tư
================================================================================ */

// Hiển thị thông báo khi không có dữ liệu
function showNoResultsMessage(message) {
  const table = document.getElementById('dataTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  thead.innerHTML = '';
  tbody.innerHTML = '';

  // Hiển thị thông báo trong tbody
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 15; // Đủ số cột để hiển thị
  td.textContent = message;
  td.style.textAlign = 'center';
  td.style.padding = '20px';
  td.style.color = '#666';
  td.style.fontStyle = 'italic';
  td.style.backgroundColor = '#f9f9f9';
  tr.appendChild(td);
  tbody.appendChild(tr);

  // Ẩn pagination
  const paginationDiv = document.querySelector('.d-flex.align-items-center.justify-content-end');
  if (paginationDiv) paginationDiv.style.display = 'none';
}

// Render bảng dạng nhóm theo Mã vật tư - hiển thị tất cả các dòng con
function renderGroupedTable(data) {
  // Kiểm tra nếu không có dữ liệu (chỉ có header hoặc không có gì)
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

  // Identify numeric column indices (excluding GROUP_COL)
  const numericCols = [];
  for (let c = 0; c < headers.length; c++) {
    let numCount = 0;
    for (const row of rows) {
      const v = parseNumericInput(row[c]);
      if (v !== null) numCount++;
    }
    if (numCount > rows.length * 0.3 && c !== GROUP_COL) numericCols.push(c);
  }

  // Build header
  const headerRow = document.createElement('tr');
  headers.forEach(cell => {
    const th = document.createElement('th');
    th.textContent = cell || '';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Group rows by GROUP_COL value
  const groups = new Map();
  for (const row of rows) {
    const key = String(row[GROUP_COL] ?? '').trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  // Render each group - summary row followed by all detail rows
  for (const [key, groupRows] of groups) {
    // Build summary row - only show Mã vật tư, Khối lượng (numeric), exclude Thời gian lưu kho (col 2)
    const summaryRow = new Array(headers.length).fill('');
    for (let c = 0; c < headers.length; c++) {
      // Skip Thời gian lưu kho (column 2 = index 1)
      if (c === 1) continue;

      if (c === GROUP_COL) {
        // Show Mã vật tư only
        summaryRow[c] = groupRows[0][c] ?? '';
      } else if (numericCols.includes(c)) {
        // Show sum for numeric columns
        let total = 0;
        for (const r of groupRows) {
          const v = parseNumericInput(r[c]);
          if (v !== null) total += v;
        }
        summaryRow[c] = Number.isInteger(total) ? total.toLocaleString('vi-VN') : total.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
      }
      // Other columns remain empty
    }

    // Group summary TR (bold row)
    const tr = document.createElement('tr');
    tr.className = 'group-summary-row';
    tr.style.fontWeight = 'bold';
    tr.style.backgroundColor = '#dbeafe';

    summaryRow.forEach((cell, colIndex) => {
      const td = document.createElement('td');
      td.textContent = cell ?? '';
      // Căn giữa cho cột số (khối lượng) ở dòng cha
      if (numericCols.includes(colIndex)) {
        td.style.textAlign = 'center';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);

    // All detail rows (always visible)
    for (const row of groupRows) {
      const dtr = document.createElement('tr');
      dtr.className = 'group-detail-row';
      dtr.style.backgroundColor = '#f0f9ff';

      row.forEach((cell, colIndex) => {
        const td = document.createElement('td');
        if (colIndex === 2) {
          td.textContent = formatDate(cell);
        } else {
          td.textContent = formatCellQuantityOrWeight(cell, headers[colIndex]);
        }
        // Căn phải cho cột số (khối lượng) ở dòng con
        if (numericCols.includes(colIndex)) {
          td.style.textAlign = 'right';
        }
        dtr.appendChild(td);
      });

      tbody.appendChild(dtr);
    }
  }

  // Hide pagination when in group mode (data exists)
  const paginationDiv = document.querySelector('.d-flex.align-items-center.justify-content-end');
  if (paginationDiv && data && data.length >= 2) {
    paginationDiv.style.display = 'none';
  }

  displayedData = data;

  if (data && data.length >= 2) {
    enableColumnResize(table);
    updateCellTitles(table);
  }
}


/* =============================================================================
   EXPORT
   Chức năng xuất dữ liệu ra file Excel
================================================================================ */

document.getElementById('btnExport').addEventListener('click', () => {
  if (!displayedData || displayedData.length === 0) return;

  const ws = XLSX.utils.aoa_to_sheet(displayedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dữ liệu");

  // Auto-fit column widths
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
   Đăng ký các sự kiện click
================================================================================ */

// Button click handlers
document.addEventListener('click', (e) => {
  const id = e.target && e.target.id;
  if (!id) return;

  if (id === 'prevPage') prevPage();
  if (id === 'nextPage') nextPage();
});

// Page select dropdown change event
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'pageSelect') {
    goToPage(e.target.value);
  }
});


/* =============================================================================
   HAMBURGER MENU & MOBILE NAVIGATION
   Xử lý menu hamburger và điều hướng trên mobile
================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const dropdown5S = document.getElementById('5SDropdown');
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');
  const toleDropdown = document.getElementById('toleDropdown');

  if (hamburger && mainNav) {
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      // hamburger.classList.toggle('active');
      // mainNav.classList.toggle('active');
    });
  }

  // Dropdown click for mobile - 5S
  if (dropdown5S) {
    const dropdownToggle = dropdown5S.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          // dropdown5S.classList.toggle('active');
        }
      });
    }
  }

  if (toleDropdown) {
    const dropdownToggle = toleDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          // toleDropdown.classList.toggle('active');
        }
      });
    }
  }

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (mainNav && !mainNav.contains(e.target) && !hamburger.contains(e.target)) {
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

  // Initialize row detail popup
  initRowDetailPopup();
});


/* =============================================================================
   ROW DETAIL POPUP
   Hiển thị popup chi tiết khi click vào dòng
================================================================================ */

function initRowDetailPopup() {
  const table = document.getElementById('dataTable');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row || row.querySelector('th')) return;
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




