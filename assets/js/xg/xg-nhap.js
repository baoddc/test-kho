/* =============================================================================
   CONSTANTS & CONFIGURATION
   Các hằng số cấu hình cho ứng dụng
================================================================================ */

// Thay bằng ID Google Sheet của bạn
const SHEET_ID = '1KqP0KIZmKzgKvZcCJRsTVO4lhScOGRa1OzQgE893eUU';   // ← THAY Ở ĐÂY
const SHEET_GID = '0';                              // gid của sheet (Nhập)
const SHEET_NAME = 'xg-nhap';                       // Tên sheet tab

// URL để tải file .xlsx (giữ nguyên định dạng từ Google Sheets)
const XLSX_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID}`;

// OPTIONAL: If you want new rows submitted from the UI to be appended
// directly into the Google Sheet, create a Google Apps Script web app
// (see docs/append_to_sheet.md) and paste its URL here.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwKN7I9HcqfoStK2Q--3JACCeoSkOufJKwDDVeTI-wFk3taVBgsZGGTKozbiOM_O7xh/exec';

// ==================== PAGINATION CONFIG ====================
const ROWS_PER_PAGE = 100; // Số dòng hiển thị mỗi trang
// ============================================================



/* =============================================================================
   SCROLL & FILTER STATE MANAGEMENT
   Lưu và khôi phục vị trí scroll và trạng thái lọc
================================================================================ */

// Lưu vị trí scroll hiện tại
function saveScrollPosition() {
  return {
    scrollTop: window.pageYOffset || document.documentElement.scrollTop,
    scrollLeft: window.pageXOffset || document.documentElement.scrollLeft
  };
}

// Khôi phục vị trí scroll
function restoreScrollPosition(position) {
  if (position) {
    window.scrollTo(position.scrollLeft, position.scrollTop);
  }
}

// Lưu trạng thái lọc hiện tại
function saveFilterState() {
  const state = {
    currentPage: currentPage,
    searchInput: '',
    fromDate: '',
    toDate: '',
    typeFilters: [],
    voucherFilters: []
  };

  // Lưu search input
  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) state.searchInput = searchInputEl.value;

  // Lưu date filters
  const fromDateEl = document.getElementById('fromDate');
  const toDateEl = document.getElementById('toDate');
  if (fromDateEl) state.fromDate = fromDateEl.value;
  if (toDateEl) state.toDate = toDateEl.value;

  // Lưu type filters
  const typeCheckboxes = document.querySelectorAll('#typeFilterMenu input[type="checkbox"]');
  state.typeFilters = Array.from(typeCheckboxes).map(cb => ({
    value: cb.value,
    checked: cb.checked
  }));

  // Lưu voucher filters
  const voucherCheckboxes = document.querySelectorAll('#voucherFilterMenu input[type="checkbox"]');
  state.voucherFilters = Array.from(voucherCheckboxes).map(cb => ({
    value: cb.value,
    checked: cb.checked
  }));

  return state;
}

// Khôi phục trạng thái lọc
function restoreFilterState(state) {
  if (!state) return;

  // Khôi phục page
  currentPage = state.currentPage || 1;

  // Khôi phục search input
  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) searchInputEl.value = state.searchInput || '';

  // Khôi phục date filters
  const fromDateEl = document.getElementById('fromDate');
  const toDateEl = document.getElementById('toDate');
  if (fromDateEl) fromDateEl.value = state.fromDate || '';
  if (toDateEl) toDateEl.value = state.toDate || '';

  // Khôi phục type filters
  if (state.typeFilters && state.typeFilters.length > 0) {
    state.typeFilters.forEach(filter => {
      const cb = document.querySelector(`#typeFilterMenu input[value="${CSS.escape(filter.value)}"]`);
      if (cb) cb.checked = filter.checked;
    });
  }

  // Khôi phục voucher filters
  if (state.voucherFilters && state.voucherFilters.length > 0) {
    state.voucherFilters.forEach(filter => {
      const cb = document.querySelector(`#voucherFilterMenu input[value="${CSS.escape(filter.value)}"]`);
      if (cb) cb.checked = filter.checked;
    });
  }
}

// Cập nhật bộ đếm filter
function updateFilterCounts() {
  const typeCheckboxes = document.querySelectorAll('#typeFilterMenu input[type="checkbox"]:checked');
  const typeCountEl = document.getElementById('typeFilterCount');
  if (typeCountEl) typeCountEl.textContent = typeCheckboxes.length;

  const voucherCheckboxes = document.querySelectorAll('#voucherFilterMenu input[type="checkbox"]:checked');
  const voucherCountEl = document.getElementById('voucherFilterCount');
  if (voucherCountEl) voucherCountEl.textContent = voucherCheckboxes.length;
}


/* =============================================================================
   GLOBAL VARIABLES
   Biến toàn cục quản lý state của ứng dụng
================================================================================ */

let currentPage = 1;
let totalPages = 1;
let tableData = [];           // lưu dữ liệu gốc từ Google Sheet
let filteredData = [];         // dữ liệu sau khi lọc (chưa phân trang)
let displayedData = [];        // dữ liệu đang hiển thị (trang hiện tại)
let selectedRowIndex = -1;     // index theo tableData (không theo dữ liệu đã lọc)
let selectedRowIndexes = [];   // mảng các index đã chọn (cho xóa nhiều dòng)


// Roll management for Add Data Modal
let rollCount = 0;

// Edit Roll management for Edit Data Modal
let editRollCount = 0;

/* =============================================================================
   LOADING OVERLAY FUNCTIONS
   Hiển thị overlay khi đang xử lý dữ liệu
================================================================================ */

function showLoadingOverlay(message) {
  // Remove existing overlay if any
  const existingOverlay = document.getElementById('loadingOverlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    ">
      <div style="
        background-color: white;
        padding: 20px 40px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        text-align: center;
        font-size: 18px;
        font-weight: 500;
        color: #333;
      ">
        <div style="
          width: 40px;
          height: 40px;
          margin: 0 auto 15px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        ${message}
      </div>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.remove();
  }
}


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

// Tìm index của cột số lượng trong header
function findQuantityColumnIndex(headers) {
  const normalizedHeaders = (headers || []).map(normalizeHeaderText);
  const strongPatterns = [
    /so\s*luong.*kg/,
    /so\s*luong/
  ];

  for (let i = 0; i < normalizedHeaders.length; i++) {
    if (strongPatterns.some(pattern => pattern.test(normalizedHeaders[i]))) {
      return i;
    }
  }
  return -1;
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

    // Filter out rows containing PX or DC in "Mã chứng từ" column FIRST
    const header = tableData[0] || [];
    const voucherColIndex = header.findIndex(h => String(h ?? '').trim().toLowerCase() === 'mã chứng từ'.trim().toLowerCase());

    if (voucherColIndex >= 0) {
      const filteredTableData = [tableData[0]]; // Keep header row
      for (let i = 1; i < tableData.length; i++) {
        const row = tableData[i];
        let voucherValue = row[voucherColIndex];
        if (voucherValue !== undefined && voucherValue !== null) {
          if (typeof voucherValue !== 'string') {
            voucherValue = String(voucherValue);
          }
          voucherValue = voucherValue.trim();
          // Skip rows containing PX or DC
          if (voucherValue.includes('PX') || voucherValue.includes('DC')) {
            continue;
          }
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
    } else {
      // If no voucher column, still filter empty rows
      const filteredTableData = [tableData[0]]; // Keep header row
      for (let i = 1; i < tableData.length; i++) {
        const row = tableData[i];

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
    }

    tableData = tableData.map((row, idx) => {
      row.originalIndex = idx;
      return row;
    });

    // Populate filters (dropdowns) from the filtered data
    populateTypeDropdown('Loại nhập/xuất', 'typeFilterMenu', 'typeFilterBtn', 'typeFilterCount', tableData);
    populateTypeDropdown('Mã chứng từ', 'voucherFilterMenu', 'voucherFilterBtn', 'voucherFilterCount', tableData);

    renderTable(tableData, false);

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
  const fromInput = document.getElementById('fromDate');
  const toInput = document.getElementById('toDate');
  const searchInput = document.getElementById('searchInput');

  // Nút reset bộ lọc
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (fromInput) fromInput.value = '';
      if (toInput) toInput.value = '';
      if (searchInput) searchInput.value = '';

      // Reset type filter
      const typeMenu = document.getElementById('typeFilterMenu');
      if (typeMenu) {
        typeMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        const count = document.getElementById('typeFilterCount');
        if (count) count.textContent = '0';
      }

      // Reset voucher filter
      const voucherMenu = document.getElementById('voucherFilterMenu');
      if (voucherMenu) {
        voucherMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        const count = document.getElementById('voucherFilterCount');
        if (count) count.textContent = '0';
      }

      renderTable(tableData);
    });
  }

  // Sự kiện thay đổi ngày
  if (fromInput) fromInput.addEventListener('change', filterTable);
  if (toInput) toInput.addEventListener('change', filterTable);

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
// resetPage: nếu true sẽ reset về trang 1, false giữ nguyên trang hiện tại
function renderTable(data, resetPage = true) {
  // Store filtered data for pagination
  filteredData = data;
  if (resetPage) {
    currentPage = 1;
  }
  renderTableWithPagination();
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

  // Header with checkbox
  const headerRow = document.createElement('tr');

  // Checkbox column header
  const thCheckbox = document.createElement('th');
  thCheckbox.style.width = '50px';
  thCheckbox.innerHTML = '<input type="checkbox" id="selectAllCheckbox" title="Chọn tất cả">';
  headerRow.appendChild(thCheckbox);

  // Data column headers
  data[0].forEach(cell => {
    const th = document.createElement('th');
    th.textContent = cell || '';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Setup select all checkbox
  setTimeout(() => {
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('#dataTable tbody .row-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
        });
        updateSelectedRows();
      });
    }
  }, 0);

  // Cập nhật dữ liệu đang hiển thị
  selectedRowIndex = -1;
  selectedRowIndexes = [];
  document.getElementById('btnEditData').disabled = true;
  document.getElementById('btnDeleteData').disabled = true;
  document.getElementById('btnDeleteData').textContent = 'Xóa dữ liệu';

  const fragment = document.createDocumentFragment();

  // Dữ liệu (bỏ dòng đầu)
  for (let i = 1; i < data.length; i++) {
    const originalIndex = data[i].originalIndex ?? tableData.indexOf(data[i]);
    const row = document.createElement('tr');
    row.dataset.rowIndex = String(originalIndex);

    // Checkbox cell
    const tdCheckbox = document.createElement('td');
    tdCheckbox.innerHTML = `<input type="checkbox" class="row-checkbox" value="${originalIndex}">`;
    row.appendChild(tdCheckbox);

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

    // Checkbox change event
    const checkbox = row.querySelector('.row-checkbox');
    checkbox.addEventListener('change', () => {
      updateSelectedRows();
    });

    // Sự kiện click chọn dòng
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

// Cập nhật title cho các cell bị tràn
function updateCellTitles(table) {
  if (!table) return;
  table.querySelectorAll('th, td').forEach(cell => {
    if (cell.scrollWidth > cell.clientWidth + 1) cell.title = (cell.textContent || '').trim();
    else cell.removeAttribute('title');
  });
}

// Update selected rows from checkboxes
function updateSelectedRows() {
  const checkboxes = document.querySelectorAll('#dataTable tbody .row-checkbox');
  selectedRowIndexes = [];
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedRowIndexes.push(parseInt(cb.value, 10));
    }
  });

  // Enable/disable buttons based on selection
  const btnEdit = document.getElementById('btnEditData');
  const btnDelete = document.getElementById('btnDeleteData');

  if (selectedRowIndexes.length > 0) {
    btnDelete.disabled = false;
    btnDelete.textContent = `Xóa đã chọn (${selectedRowIndexes.length})`;
    // Edit only enabled for single selection
    btnEdit.disabled = selectedRowIndexes.length !== 1;
  } else {
    btnEdit.disabled = true;
    btnDelete.disabled = true;
    btnDelete.textContent = 'Xóa dữ liệu';
  }

  // Update selectedRowIndex for single selection
  if (selectedRowIndexes.length === 1) {
    selectedRowIndex = selectedRowIndexes[0];
  } else {
    selectedRowIndex = -1;
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
  const fromVal = document.getElementById('fromDate')?.value || '';
  const toVal = document.getElementById('toDate')?.value || '';
  const searchVal = document.getElementById('searchInput')?.value?.trim().toLowerCase() || '';

  // Type filter
  const typeMenu = document.getElementById('typeFilterMenu');
  const typeSelected = typeMenu ? Array.from(typeMenu.querySelectorAll('input[type="checkbox"]:checked')).map(i => String(i.value).trim()).filter(Boolean) : [];
  const typeColIndex = typeMenu && typeMenu.dataset && typeMenu.dataset.colIndex ? parseInt(typeMenu.dataset.colIndex, 10) : -1;

  // Voucher filter
  const voucherMenu = document.getElementById('voucherFilterMenu');
  const voucherSelected = voucherMenu ? Array.from(voucherMenu.querySelectorAll('input[type="checkbox"]:checked')).map(i => String(i.value).trim()).filter(Boolean) : [];
  const voucherColIndex = voucherMenu && voucherMenu.dataset && voucherMenu.dataset.colIndex ? parseInt(voucherMenu.dataset.colIndex, 10) : -1;

  const from = fromVal ? new Date(fromVal) : null;
  const to = toVal ? new Date(toVal) : null;
  if (from) from.setHours(0, 0, 0, 0);
  if (to) to.setHours(23, 59, 59, 999);
  const needsDateFilter = !!from || !!to;
  const needsSearchFilter = searchVal !== '';

  const filtered = [tableData[0]];
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];

    // Date filter
    if (needsDateFilter) {
      const rawDate = row[2];
      const d = parseRowDate(rawDate);
      if (!d) continue;
      if (from && d < from) continue;
      if (to && d > to) continue;
    }

    // Type filter
    if (typeSelected.length > 0 && typeColIndex >= 0) {
      let tv = row[typeColIndex];
      if (tv === undefined || tv === null) continue;
      if (typeof tv !== 'string') {
        if (typeof tv === 'number') tv = String(tv);
        else if (tv instanceof Date) tv = formatDate(tv);
        else tv = String(tv);
      }
      if (!typeSelected.includes(tv.trim())) continue;
    }

    // Voucher filter
    if (voucherSelected.length > 0 && voucherColIndex >= 0) {
      let vv = row[voucherColIndex];
      if (vv === undefined || vv === null) continue;
      if (typeof vv !== 'string') {
        if (typeof vv === 'number') vv = String(vv);
        else if (vv instanceof Date) vv = formatDate(vv);
        else vv = String(vv);
      }
      if (!voucherSelected.includes(vv.trim())) continue;
    }

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

// Populate dropdown cho filter
function populateTypeDropdown(headerName, menuId, btnId, countId, data) {
  if (!data || data.length === 0) return;
  const header = data[0] || [];
  const idx = header.findIndex(h => String(h ?? '').trim().toLowerCase() === String(headerName).trim().toLowerCase());
  const menu = document.getElementById(menuId);
  const btn = document.getElementById(btnId);
  const countEl = document.getElementById(countId);
  if (!menu) return;
  menu.innerHTML = '';
  if (idx === -1) {
    const none = document.createElement('div');
    none.className = 'text-muted small';
    none.textContent = 'Không tìm thấy cột';
    menu.appendChild(none);
    if (countEl) countEl.textContent = '0';
    return;
  }

  const set = new Set();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let v = row[idx];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') {
      if (typeof v === 'number') v = String(v);
      else if (v instanceof Date) v = formatDate(v);
    }
    v = v.trim();
    if (v === '') continue;

    set.add(v);
  }

  const arr = Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));

  // Controls: Select All / Clear
  const ctrl = document.createElement('div');
  ctrl.className = 'd-flex gap-1 mb-2';
  const selAll = document.createElement('button');
  selAll.type = 'button';
  selAll.className = 'btn btn-sm btn-link p-0';
  selAll.textContent = 'Chọn tất cả';
  const clr = document.createElement('button');
  clr.type = 'button';
  clr.className = 'btn btn-sm btn-link p-0 text-danger';
  clr.textContent = 'Bỏ chọn';
  ctrl.appendChild(selAll);
  ctrl.appendChild(document.createTextNode(' · '));
  ctrl.appendChild(clr);
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

  // Checkbox options
  arr.forEach((v, i) => {
    const id = `typeOpt_${i}`;
    const wrap = document.createElement('div');
    wrap.className = 'form-check';
    const input = document.createElement('input');
    input.className = 'form-check-input';
    input.type = 'checkbox';
    input.value = v;
    input.id = id;
    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = id;
    label.textContent = v;
    wrap.appendChild(input);
    wrap.appendChild(label);
    menu.appendChild(wrap);

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

  XLSX.writeFile(wb, "xg_du_lieu_nhap.xlsx");
});


/* =============================================================================
   MODAL MANAGEMENT
   Quản lý các modal (Add/Edit/Delete)
================================================================================ */

// Hàm helper để kiểm tra quyền và vô hiệu hóa input trong modal
function setupModalPermissions(modalEl) {
  const currentUser = localStorage.getItem('currentUser');
  const isAdmin = currentUser === 'bao.lt';

  if (!modalEl) return isAdmin;

  // Vô hiệu hóa tất cả các input, select, textarea trong modal
  const inputs = modalEl.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.disabled = !isAdmin;
  });

  // Ẩn/hiện các nút hành động
  const submitBtn = modalEl.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.style.display = isAdmin ? '' : 'none';
  }

  // Ẩn nút thêm cuộn (btnAddRoll, btnEditAddRoll)
  const btnAddRoll = modalEl.querySelector('#btnAddRoll, #btnEditAddRoll, #addRollBtn, #editAddRollBtn');
  if (btnAddRoll) {
    btnAddRoll.style.display = isAdmin ? '' : 'none';
  }

  // Ẩn nút xóa cuộn (btnRemoveRoll)
  const btnRemoveRolls = modalEl.querySelectorAll('.btn-remove-roll, .remove-roll-btn');
  btnRemoveRolls.forEach(btn => {
    btn.style.display = isAdmin ? '' : 'none';
  });

  return isAdmin;
}

// ===== ADD DATA MODAL =====

function openAddDataModal() {
  // Lưu vị trí scroll và trạng thái lọc trước khi mở modal
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();

  const modalEl = document.getElementById('addDataModal');
  if (!modalEl) return;

  // Thiết lập quyền cho modal
  setupModalPermissions(modalEl);

  const commonFieldsContainer = document.getElementById('addDataCommonFields');
  const additionalFieldsContainer = document.getElementById('addDataAdditionalFields');
  if (!commonFieldsContainer || !additionalFieldsContainer) return;

  // Reset form
  commonFieldsContainer.innerHTML = '';
  additionalFieldsContainer.innerHTML = '';

  const rollsTableBody = document.getElementById('rollsTableBody');
  if (rollsTableBody) rollsTableBody.innerHTML = '';
  rollCount = 0;
  updateRollTotals();

  const headers = (tableData && tableData[0]) ? tableData[0] : [];
  const quantityColIndex = findQuantityColumnIndex(headers);
  const commonColIndices = [1, 2, 3, 4, 5, 6, 7];

  // Get next sequence number
  function getNextSequence() {
    if (!tableData || tableData.length <= 1) return 1;
    let max = 0;
    for (let r = 1; r < tableData.length; r++) {
      const v = tableData[r][0];
      if (v === undefined || v === null) continue;
      const n = (typeof v === 'number') ? v : (typeof v === 'string' ? parseInt(String(v).replace(/\D+/g, ''), 10) : NaN);
      if (!isNaN(n) && n > max) max = n;
    }
    return max + 1;
  }
  const nextSeq = getNextSequence();

  // STT column (readonly)
  const sttCol = document.createElement('div');
  sttCol.className = 'col-12 col-md-6';
  sttCol.innerHTML = `
    <label class="form-label">${headers[0] || 'STT'}</label>
    <input type="number" class="form-control form-control-sm fw-bold" name="col_0" 
           step="1" value="${nextSeq}" readonly>
  `;
  commonFieldsContainer.appendChild(sttCol);

  // Common columns
  commonColIndices.forEach(colIdx => {
    if (colIdx >= headers.length) return;

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = headers[colIdx] || `Cột ${colIdx + 1}`;

    // Column 1: Loại nhập/xuất (NM/NT dropdown)
    if (colIdx === 1) {
      const select = document.createElement('select');
      select.className = 'form-select form-select-sm fw-bold';
      select.name = `col_${colIdx}`;
      ['NM', 'NT'].forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
      });
      select.required = true;
      label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class="text-danger">*</span>`;
      col.appendChild(label);
      col.appendChild(select);
      commonFieldsContainer.appendChild(col);
      return;
    }

    // Column 2: Ngày (date input)
    if (colIdx === 2) {
      const dateInput = document.createElement('input');
      dateInput.className = 'form-control form-control-sm fw-bold';
      dateInput.name = `col_${colIdx}`;
      dateInput.type = 'date';
      dateInput.required = true;
      label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class="text-danger">*</span>`;
      col.appendChild(label);
      col.appendChild(dateInput);
      commonFieldsContainer.appendChild(col);
      return;
    }

    // Column 3: Mã chứng từ (dropdown)
    if (colIdx === 3) {
      const headerName = String(headers[colIdx] || '').toLowerCase().trim();
      if (headerName.includes('mã chứng từ')) {
        const voucherSet = new Set();
        for (let i = 1; i < tableData.length; i++) {
          let v = tableData[i][colIdx];
          if (v === undefined || v === null) continue;
          if (typeof v !== 'string') v = String(v);
          v = v.trim();
          if (v === '') continue;
          voucherSet.add(v);
        }

        const select = document.createElement('select');
        select.className = 'form-select form-select-sm fw-bold';
        select.name = `col_${colIdx}`;

        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Chọn mã --';
        select.appendChild(defaultOpt);

        Array.from(voucherSet).sort((a, b) => a.localeCompare(b, 'vi')).forEach(v => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v;
          select.appendChild(opt);
        });

        select.required = true;
        label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class="text-danger">*</span>`;
        col.appendChild(label);
        col.appendChild(select);
        commonFieldsContainer.appendChild(col);
        return;
      }
    }

    // Column 4: Loại nhập
    const headerNameLC = String(headers[colIdx] || '').toLowerCase().trim();
    if (headerNameLC === 'loại nhập' || headerNameLC.includes('loại nhập')) {
      // Ensure we don't accidentally match 'Loại nhập/xuất' which is col 1
      if (colIdx !== 1) {
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm fw-bold';
        select.name = `col_${colIdx}`;

        const options = ['-- Chọn loại nhập --', 'Nhà cung cấp', 'Xưởng sản xuất', 'Gia công ngoài', 'Công trình'];
        options.forEach((optStr, idx) => {
          const opt = document.createElement('option');
          if (idx === 0) {
            opt.value = '';
            opt.textContent = optStr;
          } else {
            opt.value = optStr;
            opt.textContent = optStr;
          }
          select.appendChild(opt);
        });

        select.required = true;
        label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class="text-danger">*</span>`;
        col.appendChild(label);
        col.appendChild(select);
        commonFieldsContainer.appendChild(col);
        return;
      }
    }

    // Default: text input
    const input = document.createElement('input');
    input.className = 'form-control form-control-sm fw-bold';
    input.name = `col_${colIdx}`;
    input.type = 'text';

    // Make required if not Note or Roll ID
    const hName = headers[colIdx] ? String(headers[colIdx]).toLowerCase().trim() : '';
    if (!hName.includes('ghi chú') && !hName.includes('cuộn id')) {
      input.required = true;
      label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class="text-danger">*</span>`;
    } else {
      label.textContent = headers[colIdx] || `Cột ${colIdx + 1}`;
    }

    col.appendChild(label);
    col.appendChild(input);
    commonFieldsContainer.appendChild(col);
  });

  // Additional columns (after quantity)
  for (let i = quantityColIndex + 1; i < headers.length; i++) {
    const headerName = (headers[i] || `Cột ${i + 1}`).toLowerCase().trim();

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';
    const label = document.createElement('label');
    label.className = 'form-label';

    let input;
    const normHeader = normalizeHeaderText(headers[i]);
    // Số cuộn - readonly
    if (normHeader === 'so cuon' || normHeader.includes('so cuon')) {
      col.style.display = 'none';
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else if (normHeader === 'cuon id' || normHeader.includes('cuon id')) {
      col.style.display = 'none';
      label.textContent = headers[i] || 'Cuộn ID';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = '';
    } else {
      label.textContent = headers[i] || `Cột ${i + 1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';

      // Make required if not Note or Roll ID
      const hName = (headers[i] || '').toLowerCase().trim();
      if (!hName.includes('ghi chú') && !hName.includes('cuộn id') && !normHeader.includes('cuon id')) {
        input.required = true;
        label.innerHTML = `${headers[i] || `Cột ${i + 1}`} <span class="text-danger">*</span>`;
      } else {
        label.textContent = headers[i] || `Cột ${i + 1}`;
      }
    }

    col.appendChild(label);
    col.appendChild(input);
    additionalFieldsContainer.appendChild(col);
  }

  modalEl.dataset.quantityColIndex = quantityColIndex;

  // Add roll button
  const btnAddRoll = document.getElementById('btnAddRoll');
  if (btnAddRoll) {
    btnAddRoll.onclick = () => addRollRow();
  }

  // Show modal
  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}


// ===== EDIT DATA MODAL =====

function openEditDataModal() {
  const currentUser = localStorage.getItem('currentUser');

  // Lưu vị trí scroll và trạng thái lọc trước khi mở modal
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();

  if (selectedRowIndex < 0 || selectedRowIndex >= tableData.length) {
    alert('Vui lòng chọn một dòng để sửa');
    return;
  }

  const modalEl = document.getElementById('editDataModal');
  if (!modalEl) return;

  // Thiết lập quyền cho modal (sẽ vô hiệu hóa input nếu không phải bao.lt)
  setupModalPermissions(modalEl);

  const commonFieldsContainer = document.getElementById('editDataCommonFields');
  const additionalFieldsContainer = document.getElementById('editDataAdditionalFields');
  if (!commonFieldsContainer || !additionalFieldsContainer) return;

  // Reset form
  commonFieldsContainer.innerHTML = '';
  additionalFieldsContainer.innerHTML = '';

  const editRollsTableBody = document.getElementById('editRollsTableBody');
  if (editRollsTableBody) editRollsTableBody.innerHTML = '';
  editRollCount = 0;
  updateEditRollTotals();

  const headers = (tableData && tableData[0]) ? tableData[0] : [];
  const quantityColIndex = findQuantityColumnIndex(headers);
  const rowData = tableData[selectedRowIndex];
  const commonColIndices = [1, 2, 3, 4, 5, 6, 7];

  // STT column
  const sttCol = document.createElement('div');
  sttCol.className = 'col-12 col-md-6';
  sttCol.innerHTML = `
    <label class="form-label">${headers[0] || 'STT'}</label>
    <input type="number" class="form-control form-control-sm fw-bold" name="col_0" 
           step="1" value="${rowData[0] ?? ''}" readonly>
  `;
  commonFieldsContainer.appendChild(sttCol);

  // Common columns
  commonColIndices.forEach(colIdx => {
    if (colIdx >= headers.length) return;

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = headers[colIdx] || `Cột ${colIdx + 1}`;

    // Column 1: Loại nhập/xuất
    if (colIdx === 1) {
      const select = document.createElement('select');
      select.className = 'form-select form-select-sm fw-bold';
      select.name = `col_${colIdx}`;
      ['NM', 'NT'].forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
      });
      select.value = rowData[colIdx] ?? '';
      select.required = true;
      label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class="text-danger">*</span>`;
      col.appendChild(label);
      col.appendChild(select);
      commonFieldsContainer.appendChild(col);
      return;
    }

    // Column 2: Ngày
    if (colIdx === 2) {
      const dateInput = document.createElement('input');
      dateInput.className = 'form-control form-control-sm fw-bold';
      dateInput.name = `col_${colIdx}`;
      dateInput.type = 'date';

      // Convert dd/mm/yyyy to yyyy-mm-dd
      const dateStr = rowData[colIdx];
      if (dateStr && typeof dateStr === 'string') {
        const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          let d = String(m[1]).padStart(2, '0');
          let mo = String(m[2]).padStart(2, '0');
          let y = m[3];
          if (y.length === 2) y = (parseInt(y, 10) < 50 ? '20' : '19') + y;
          dateInput.value = `${y}-${mo}-${d}`;
        }
      }

      dateInput.required = true;
      label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class="text-danger">*</span>`;
      col.appendChild(label);
      col.appendChild(dateInput);
      commonFieldsContainer.appendChild(col);
      return;
    }

    // Column 3: Mã chứng từ
    if (colIdx === 3) {
      const headerName = String(headers[colIdx] || '').toLowerCase().trim();
      if (headerName.includes('mã chứng từ')) {
        const voucherSet = new Set();
        for (let i = 1; i < tableData.length; i++) {
          let v = tableData[i][colIdx];
          if (v === undefined || v === null) continue;
          if (typeof v !== 'string') v = String(v);
          v = v.trim();
          if (v === '') continue;
          voucherSet.add(v);
        }

        const select = document.createElement('select');
        select.className = 'form-select form-select-sm fw-bold';
        select.name = `col_${colIdx}`;

        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Chọn mã --';
        select.appendChild(defaultOpt);

        Array.from(voucherSet).sort((a, b) => a.localeCompare(b, 'vi')).forEach(v => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v;
          select.appendChild(opt);
        });

        select.value = rowData[colIdx] ?? '';
        select.required = true;
        label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class="text-danger">*</span>`;
        col.appendChild(label);
        col.appendChild(select);
        commonFieldsContainer.appendChild(col);
        return;
      }
    }

    // Column 4: Loại nhập
    const headerNameLC = String(headers[colIdx] || '').toLowerCase().trim();
    if (headerNameLC === 'loại nhập' || headerNameLC.includes('loại nhập')) {
      if (colIdx !== 1) {
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm fw-bold';
        select.name = `col_${colIdx}`;

        const options = ['-- Chọn loại nhập --', 'Nhà cung cấp', 'Xưởng sản xuất', 'Gia công ngoài', 'Công trình'];
        options.forEach((optStr, idx) => {
          const opt = document.createElement('option');
          if (idx === 0) {
            opt.value = '';
            opt.textContent = optStr;
          } else {
            opt.value = optStr;
            opt.textContent = optStr;
          }
          select.appendChild(opt);
        });

        const existingValue = String(rowData[colIdx] ?? '').trim();
        if (existingValue && !options.includes(existingValue)) {
          const opt = document.createElement('option');
          opt.value = existingValue;
          opt.textContent = existingValue;
          select.appendChild(opt);
        }
        select.value = existingValue;

        select.required = true;
        label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class="text-danger">*</span>`;
        col.appendChild(label);
        col.appendChild(select);
        commonFieldsContainer.appendChild(col);
        return;
      }
    }

    // Default: text input
    const input = document.createElement('input');
    input.className = 'form-control form-control-sm fw-bold';
    input.name = `col_${colIdx}`;
    input.type = 'text';
    input.value = rowData[colIdx] ?? '';

    // Make required if not Note or Roll ID
    const hName = headers[colIdx] ? String(headers[colIdx]).toLowerCase().trim() : '';
    if (!hName.includes('ghi chú') && !hName.includes('cuộn id')) {
      input.required = true;
      label.innerHTML = `${headers[colIdx] || `Cột ${colIdx + 1}`} <span class="text-danger">*</span>`;
    } else {
      label.textContent = headers[colIdx] || `Cột ${colIdx + 1}`;
    }

    col.appendChild(label);
    col.appendChild(input);
    commonFieldsContainer.appendChild(col);
  });

  // Existing kg - add as first roll
  let existingKg = '';
  if (quantityColIndex >= 0 && rowData[quantityColIndex] !== undefined) {
    const parsed = parseNumericInput(rowData[quantityColIndex]);
    if (parsed !== null && parsed > 0) {
      existingKg = String(parsed);
    }
  }

  const headersStr = headers.map(h => String(h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const cuonIdIdx = headersStr.findIndex(h => h.includes('cuon id'));
  const viTriIdx = headersStr.findIndex(h => h.includes('vi tri') || h === 'vitri' || h === 'vị trí');

  let existingCuonId = '';
  if (cuonIdIdx !== -1 && rowData[cuonIdIdx] !== undefined) {
    existingCuonId = String(rowData[cuonIdIdx]).trim();
  }
  let existingViTri = '';
  if (viTriIdx !== -1 && rowData[viTriIdx] !== undefined) {
    existingViTri = String(rowData[viTriIdx]).trim();
  }

  addEditRollRow(existingCuonId, existingKg, existingViTri);

  // Additional columns
  for (let i = quantityColIndex + 1; i < headers.length; i++) {
    const headerName = (headers[i] || `Cột ${i + 1}`).toLowerCase().trim();

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';
    const label = document.createElement('label');
    label.className = 'form-label';

    let input;
    const normHeader = normalizeHeaderText(headers[i]);
    if (normHeader === 'so cuon' || normHeader.includes('so cuon')) {
      col.style.display = 'none';
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = existingKg ? '1' : '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else if (normHeader === 'cuon id' || normHeader.includes('cuon id')) {
      col.style.display = 'none';
      label.textContent = headers[i] || 'Cuộn ID';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = rowData[i] ?? '';
    } else {
      label.textContent = headers[i] || `Cột ${i + 1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = rowData[i] ?? '';

      // Make required if not Note or Roll ID
      const hName = (headers[i] || '').toLowerCase().trim();
      if (!hName.includes('ghi chú') && !hName.includes('cuộn id') && !normHeader.includes('cuon id')) {
        input.required = true;
        label.innerHTML = `${headers[i] || `Cột ${i + 1}`} <span class="text-danger">*</span>`;
      } else {
        label.textContent = headers[i] || `Cột ${i + 1}`;
      }
    }

    col.appendChild(label);
    col.appendChild(input);
    additionalFieldsContainer.appendChild(col);
  }

  modalEl.dataset.quantityColIndex = quantityColIndex;

  // Add roll button
  const btnEditAddRoll = document.getElementById('btnEditAddRoll');
  if (btnEditAddRoll) {
    btnEditAddRoll.onclick = () => addEditRollRow();
  }

  // Show modal
  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}


// ===== DELETE DATA MODAL =====

function openDeleteDataModal() {
  // Lưu vị trí scroll và trạng thái lọc trước khi mở modal
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();

  // Get selected rows from checkboxes
  updateSelectedRows();

  if (selectedRowIndexes.length === 0) {
    alert('Vui lòng chọn ít nhất một dòng để xóa');
    return;
  }

  // Update modal body message to show count
  const modalBody = document.querySelector('#deleteDataModal .modal-body p');
  if (modalBody) {
    if (selectedRowIndexes.length === 1) {
      modalBody.textContent = 'Bạn có chắc chắn muốn xóa dòng dữ liệu này? Hành động này không thể hoàn tác.';
    } else {
      modalBody.textContent = `Bạn có chắc chắn muốn xóa ${selectedRowIndexes.length} dòng dữ liệu đã chọn? Hành động này không thể hoàn tác.`;
    }
  }

  const modalEl = document.getElementById('deleteDataModal');
  if (!modalEl) return;

  // Thiết lập quyền cho modal xóa - ẩn nút xóa nếu không phải bao.lt
  const currentUser = localStorage.getItem('currentUser');
  const isAdmin = currentUser === 'bao.lt';
  const deleteBtn = modalEl.querySelector('#btnConfirmDelete');
  if (deleteBtn) {
    deleteBtn.style.display = isAdmin ? '' : 'none';
  }

  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}


/* =============================================================================
   ROLL MANAGEMENT
   Quản lý danh sách cuộn (Add/Edit)
================================================================================ */

// ===== ADD ROLL =====

function addRollRow(cuonId = '', kgValue = '', viTri = '') {
  rollCount++;
  const tbody = document.getElementById('rollsTableBody');
  const tr = document.createElement('tr');
  tr.dataset.rollId = rollCount;
  tr.innerHTML = `
    <td class="text-center roll-stt">${rollCount}</td>
    <td>
      <input type="text" class="form-control form-control-sm roll-cuon-id" required
             placeholder="Cuộn ID" value="${cuonId}">
    </td>
    <td>
      <input type="number" class="form-control form-control-sm roll-kg" 
             step="any" min="0" inputMode="decimal" required
             placeholder="Nhập số kg" value="${kgValue}">
    </td>
    <td>
      <input type="text" class="form-control form-control-sm roll-vi-tri" required
             placeholder="Vị trí" value="${viTri}">
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-roll">X</button>
    </td>
  `;
  tbody.appendChild(tr);

  // Remove button
  tr.querySelector('.btn-remove-roll').addEventListener('click', () => {
    tr.remove();
    updateRollNumbers();
    updateRollTotals();
  });

  // Input change
  tr.querySelector('.roll-kg').addEventListener('input', updateRollTotals);

  updateRollTotals();
}

function updateRollNumbers() {
  const rows = document.querySelectorAll('#rollsTableBody tr');
  rows.forEach((row, index) => {
    row.querySelector('.roll-stt').textContent = index + 1;
  });
}

function updateRollTotals() {
  const rows = document.querySelectorAll('#rollsTableBody tr');
  let totalKg = 0;
  let rollsWithKg = 0;

  rows.forEach(row => {
    const kgInput = row.querySelector('.roll-kg');
    if (kgInput && kgInput.value) {
      const parsed = parseNumericInput(kgInput.value);
      if (parsed !== null && parsed > 0) {
        totalKg += parsed;
        rollsWithKg++;
      }
    }
  });

  document.getElementById('totalRollsCount').textContent = rollsWithKg;
  document.getElementById('totalKg').textContent = totalKg.toFixed(2).replace('.', ',');

  // Update readonly "Số cuộn" field
  const allInputs = document.querySelectorAll('#addDataAdditionalFields input');
  allInputs.forEach(input => {
    if (input.readOnly && input.style.backgroundColor === 'rgb(233, 236, 239)') {
      input.value = rollsWithKg;
    }
  });
}

// ===== EDIT ROLL =====

function addEditRollRow(cuonId = '', kgValue = '', viTri = '') {
  editRollCount++;
  const tbody = document.getElementById('editRollsTableBody');
  const tr = document.createElement('tr');
  tr.dataset.rollId = editRollCount;
  tr.innerHTML = `
    <td class="text-center edit-roll-stt">${editRollCount}</td>
    <td>
      <input type="text" class="form-control form-control-sm edit-roll-cuon-id" required
             placeholder="Cuộn ID" value="${cuonId}">
    </td>
    <td>
      <input type="number" class="form-control form-control-sm edit-roll-kg" 
             step="any" min="0" inputMode="decimal" required
             placeholder="Nhập số kg" value="${kgValue}">
    </td>
    <td>
      <input type="text" class="form-control form-control-sm edit-roll-vi-tri" required
             placeholder="Vị trí" value="${viTri}">
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-edit-roll">X</button>
    </td>
  `;
  tbody.appendChild(tr);

  // Remove button
  tr.querySelector('.btn-remove-edit-roll').addEventListener('click', () => {
    tr.remove();
    updateEditRollNumbers();
    updateEditRollTotals();
  });

  // Input change
  tr.querySelector('.edit-roll-kg').addEventListener('input', updateEditRollTotals);

  updateEditRollTotals();
}

function updateEditRollNumbers() {
  const rows = document.querySelectorAll('#editRollsTableBody tr');
  rows.forEach((row, index) => {
    row.querySelector('.edit-roll-stt').textContent = index + 1;
  });
}

function updateEditRollTotals() {
  const rows = document.querySelectorAll('#editRollsTableBody tr');
  let totalKg = 0;
  let rollsWithKg = 0;

  rows.forEach(row => {
    const kgInput = row.querySelector('.edit-roll-kg');
    if (kgInput && kgInput.value) {
      const parsed = parseNumericInput(kgInput.value);
      if (parsed !== null && parsed > 0) {
        totalKg += parsed;
        rollsWithKg++;
      }
    }
  });

  document.getElementById('editTotalRollsCount').textContent = rollsWithKg;
  document.getElementById('editTotalKg').textContent = totalKg.toFixed(2).replace('.', ',');

  // Update readonly "Số cuộn" field
  const allInputs = document.querySelectorAll('#editDataAdditionalFields input');
  allInputs.forEach(input => {
    if (input.readOnly && input.style.backgroundColor === 'rgb(233, 236, 239)') {
      input.value = rollsWithKg;
    }
  });
}


/* =============================================================================
   FORM HANDLERS
   Xử lý submit form (Add/Edit/Delete)
================================================================================ */

document.addEventListener('submit', async (e) => {
  try {
    // ===== ADD DATA FORM =====
    if (e.target && e.target.id === 'addDataForm') {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      let originalText = submitBtn ? submitBtn.textContent : 'Thêm';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang thêm...';
      }

      // Show loading overlay
      showLoadingOverlay('Đang thêm dữ liệu...');

      // Collect form values
      const commonInputs = Array.from(form.querySelectorAll('#addDataCommonFields input[name^="col_"], #addDataCommonFields select[name^="col_"]'));
      const additionalInputs = Array.from(form.querySelectorAll('#addDataAdditionalFields input[name^="col_"], #addDataAdditionalFields select[name^="col_"]'));

      const addDataModalForIndex = document.getElementById('addDataModal');
      const quantityColIndex = parseInt(addDataModalForIndex?.dataset?.quantityColIndex || '-1', 10);

      // Get roll data (Kg, Cuộn ID, Vị trí)
      const rollRows = document.querySelectorAll('#rollsTableBody tr');
      const rollDataList = [];
      rollRows.forEach(row => {
        const kgInput = row.querySelector('.roll-kg');
        if (kgInput && kgInput.value) {
          const parsed = parseNumericInput(kgInput.value);
          if (parsed !== null && parsed > 0) {
            const cuonIdInput = row.querySelector('.roll-cuon-id');
            const viTriInput = row.querySelector('.roll-vi-tri');
            rollDataList.push({
              kg: parsed,
              cuonId: cuonIdInput ? cuonIdInput.value.trim() : '',
              viTri: viTriInput ? viTriInput.value.trim() : ''
            });
          }
        }
      });

      if (rollDataList.length === 0) {
        alert('Vui lòng nhập ít nhất một cuộn với số kg > 0');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
        return;
      }

      // Build row values
      const commonValues = commonInputs.map(inp => inp.value ?? '');
      commonValues.splice(quantityColIndex, 0, '');
      const additionalValues = additionalInputs.map(inp => inp.value ?? '');

      const headersStr = (tableData[0] || []).map(h => String(h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      const cuonIdIdx = headersStr.findIndex(h => h.includes('cuon id'));
      const viTriIdx = headersStr.findIndex(h => h.includes('vi tri') || h === 'vitri' || h === 'vị trí');

      // Create one row per roll
      const rowsToAdd = rollDataList.map(roll => {
        const newRow = [...commonValues];
        newRow[quantityColIndex] = String(roll.kg);
        newRow.push(...additionalValues);

        if (cuonIdIdx !== -1 && roll.cuonId) newRow[cuonIdIdx] = roll.cuonId;
        if (viTriIdx !== -1 && roll.viTri) newRow[viTriIdx] = roll.viTri;

        return newRow;
      });

      // Ensure all rows have same length
      const maxCols = Math.max(...rowsToAdd.map(r => r.length));
      rowsToAdd.forEach(row => {
        while (row.length < maxCols) row.push('');
      });

      // Convert date to dd/mm/yyyy
      rowsToAdd.forEach(newRow => {
        if (newRow.length > 2 && newRow[2]) {
          const iso = newRow[2];
          const dt = new Date(iso);
          if (!isNaN(dt.getTime())) {
            const d = String(dt.getDate()).padStart(2, '0');
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const y = dt.getFullYear();
            newRow[2] = `${d}/${m}/${y}`;
          }
        }
      });

      // Send to Google Apps Script
      if (typeof APPS_SCRIPT_URL === 'string' && APPS_SCRIPT_URL.trim()) {
        for (const newRow of rowsToAdd) {
          const body = new URLSearchParams();
          body.set('sheetName', SHEET_NAME);
          body.set('values', JSON.stringify(newRow));
          const resp = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: body.toString()
          });
          const text = await resp.text();
          let j = null;
          try { j = JSON.parse(text); } catch (_) { j = null; }
          if (!resp.ok || (j && j.result && j.result !== 'success')) {
            throw new Error((j && j.error) || resp.statusText || 'Lỗi server');
          }
        }
      }

      // Update local data
      rowsToAdd.forEach(newRow => tableData.push(newRow));
      renderTable(tableData, false);

      // Close modal
      const addDataModalForHide = document.getElementById('addDataModal');
      const bsAddData = bootstrap.Modal.getInstance(addDataModalForHide);
      if (bsAddData) bsAddData.hide();
      form.reset();

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }

      // Hide loading overlay
      hideLoadingOverlay();

      // Khôi phục vị trí scroll và trạng thái lọc
      if (window._savedFilterState) {
        restoreFilterState(window._savedFilterState);
        window._savedFilterState = null;
      }
      if (window._savedScrollPosition) {
        restoreScrollPosition(window._savedScrollPosition);
        window._savedScrollPosition = null;
      }

      window._addFormOriginalText = originalText;

    }
    // ===== EDIT DATA FORM =====
    else if (e.target && e.target.id === 'editDataForm') {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      let originalText = submitBtn ? submitBtn.textContent : 'Cập nhật';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang cập nhật...';
      }

      // Show loading overlay
      showLoadingOverlay('Đang cập nhật dữ liệu...');

      // Get common field values
      const commonInputs = Array.from(form.querySelectorAll('#editDataCommonFields input[name^="col_"], #editDataCommonFields select[name^="col_"]'));
      const additionalInputs = Array.from(form.querySelectorAll('#editDataAdditionalFields input[name^="col_"], #editDataAdditionalFields select[name^="col_"]'));

      // Get quantity column index from modal dataset
      const editDataModalForIndex = document.getElementById('editDataModal');
      const quantityColIndex = parseInt(editDataModalForIndex?.dataset?.quantityColIndex || '-1', 10);

      // Collect all roll kg values, cuon id, and vi tri
      const editRollRows = document.querySelectorAll('#editRollsTableBody tr');
      const rollKgValues = [];
      const rollCuonIds = [];
      const rollViTris = [];

      editRollRows.forEach(row => {
        const kgInput = row.querySelector('.edit-roll-kg');
        if (kgInput && kgInput.value) {
          const parsed = parseNumericInput(kgInput.value);
          if (parsed !== null && parsed > 0) {
            rollKgValues.push(parsed);

            const cuonIdInput = row.querySelector('.edit-roll-cuon-id');
            if (cuonIdInput && cuonIdInput.value.trim()) {
              rollCuonIds.push(cuonIdInput.value.trim());
            }

            const viTriInput = row.querySelector('.edit-roll-vi-tri');
            if (viTriInput && viTriInput.value.trim()) {
              rollViTris.push(viTriInput.value.trim());
            }
          }
        }
      });

      if (rollKgValues.length === 0) {
        alert('Vui lòng nhập ít nhất một cuộn với số kg > 0');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
        return;
      }

      // Build common values array (including empty for quantity column)
      let commonValues = commonInputs.map(inp => inp.value ?? '');
      commonValues.splice(quantityColIndex, 0, '');

      // Get additional values
      const additionalValues = additionalInputs.map(inp => inp.value ?? '');

      // Sum all roll kg values for the quantity column
      const totalKg = rollKgValues.reduce((sum, kg) => sum + kg, 0);

      // Create updated row with total kg in quantity column
      const updatedRow = [...commonValues];
      updatedRow[quantityColIndex] = String(totalKg);
      updatedRow.push(...additionalValues);

      const headersStr = (tableData[0] || []).map(h => String(h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      const cuonIdIdx = headersStr.findIndex(h => h.includes('cuon id'));
      const viTriIdx = headersStr.findIndex(h => h.includes('vi tri') || h === 'vitri' || h === 'vị trí');

      if (cuonIdIdx !== -1) {
        updatedRow[cuonIdIdx] = rollCuonIds.join(', ');
      }
      if (viTriIdx !== -1) {
        updatedRow[viTriIdx] = rollViTris.join(', ');
      }

      // Ensure row has same length
      const maxCols = Math.max(updatedRow.length, (tableData[0] || []).length);
      while (updatedRow.length < maxCols) updatedRow.push('');

      // Convert date from ISO to dd/mm/yyyy for column 2
      if (updatedRow.length > 2 && updatedRow[2]) {
        const iso = updatedRow[2];
        const dt = new Date(iso);
        if (!isNaN(dt.getTime())) {
          const d = String(dt.getDate()).padStart(2, '0');
          const m = String(dt.getMonth() + 1).padStart(2, '0');
          const y = dt.getFullYear();
          updatedRow[2] = `${d}/${m}/${y}`;
        }
      }

      if (selectedRowIndex > 0 && selectedRowIndex < tableData.length) {
        tableData[selectedRowIndex] = updatedRow;

        // Send to Google Apps Script
        if (typeof APPS_SCRIPT_URL === 'string' && APPS_SCRIPT_URL.trim()) {
          const body = new URLSearchParams();
          body.set('sheetName', SHEET_NAME);
          body.set('values', JSON.stringify(updatedRow));
          body.set('action', 'edit');
          body.set('rowIndex', String(selectedRowIndex + 1));
          const resp = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: body.toString()
          });
          const text = await resp.text();
          let j = null;
          try { j = JSON.parse(text); } catch (_) { j = null; }
          if (!resp.ok || (j && j.result && j.result !== 'success')) {
            throw new Error((j && j.error) || resp.statusText || 'Lỗi server');
          }
        }

        renderTable(tableData, false);
        selectedRowIndex = -1;
        document.getElementById('btnEditData').disabled = true;
        document.getElementById('btnDeleteData').disabled = true;
        const editDataModalEl = document.getElementById('editDataModal');
        const bsEditData = bootstrap.Modal.getInstance(editDataModalEl);
        if (bsEditData) bsEditData.hide();
        form.reset();

        // Khôi phục vị trí scroll và trạng thái lọc
        if (window._savedFilterState) {
          restoreFilterState(window._savedFilterState);
          window._savedFilterState = null;
        }
        if (window._savedScrollPosition) {
          restoreScrollPosition(window._savedScrollPosition);
          window._savedScrollPosition = null;
        }

        // Hide loading overlay
        hideLoadingOverlay();

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    }
  } catch (err) {
    console.error('Form submit error:', err);

    // Hide loading overlay on error
    hideLoadingOverlay();

    if (e.target && e.target.id === 'addDataForm') {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const savedOriginalText = window._addFormOriginalText;
      if (submitBtn && savedOriginalText) {
        submitBtn.disabled = false;
        submitBtn.textContent = savedOriginalText;
      }
      delete window._addFormOriginalText;
    }

    if (e.target && e.target.id === 'editDataForm') {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn && originalText) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }
});


/* =============================================================================
   DELETE HANDLER
   Xử lý xóa dữ liệu
================================================================================ */

document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'btnConfirmDelete') {
    e.preventDefault();
    e.stopPropagation();

    // Get selected rows
    updateSelectedRows();

    if (selectedRowIndexes.length === 0) {
      alert('Không có dòng nào được chọn để xóa');
      return;
    }

    const btnConfirm = document.getElementById('btnConfirmDelete');
    const originalText = btnConfirm.textContent;
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Đang xóa...';

    // Show loading overlay
    showLoadingOverlay('Đang xóa dữ liệu...');

    try {
      // Sort indexes in descending order to avoid index shifting issues
      const sortedIndexes = selectedRowIndexes.slice().sort((a, b) => b - a);

      // Delete each row
      for (const rowIndex of sortedIndexes) {
        if (rowIndex <= 0 || rowIndex >= tableData.length) continue;

        const rowToDelete = tableData[rowIndex];

        // Send to Google Apps Script
        if (typeof APPS_SCRIPT_URL === 'string' && APPS_SCRIPT_URL.trim()) {
          const body = new URLSearchParams();
          body.set('sheetName', SHEET_NAME);
          body.set('action', 'delete');
          body.set('rowIndex', String(rowIndex + 1));
          body.set('values', JSON.stringify(rowToDelete));

          const resp = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: body.toString()
          });

          const text = await resp.text();
          let j = null;
          try { j = JSON.parse(text); } catch (_) { j = null; }

          if (!resp.ok || (j && j.result && j.result !== 'success')) {
            throw new Error((j && j.error) || resp.statusText || 'Lỗi server');
          }
        }

        // Remove from local data
        tableData.splice(rowIndex, 1);
      }

      // Close modal
      const deleteDataModalEl = document.getElementById('deleteDataModal');
      const bsDeleteData = bootstrap.Modal.getInstance(deleteDataModalEl);
      if (bsDeleteData) bsDeleteData.hide();

      // Reset selection
      selectedRowIndexes = [];
      selectedRowIndex = -1;

      renderTable(tableData, false);
      document.getElementById('btnEditData').disabled = true;
      document.getElementById('btnDeleteData').disabled = true;

      // Khôi phục vị trí scroll và trạng thái lọc
      if (window._savedFilterState) {
        restoreFilterState(window._savedFilterState);
        window._savedFilterState = null;
      }
      if (window._savedScrollPosition) {
        restoreScrollPosition(window._savedScrollPosition);
        window._savedScrollPosition = null;
      }

      // Hide loading overlay
      hideLoadingOverlay();
    } catch (err) {
      console.error('Delete error:', err);

      // Hide loading overlay on error
      hideLoadingOverlay();
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.textContent = originalText;
    }
  }
});


/* =============================================================================
   EVENT LISTENERS
   Đăng ký các sự kiện click
================================================================================ */

// Button click handlers
document.addEventListener('click', (e) => {
  const id = e.target && e.target.id;
  if (!id) return;

  if (id === 'btnAddData') openAddDataModal();
  if (id === 'btnEditData') openEditDataModal();
  if (id === 'btnDeleteData') openDeleteDataModal();
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
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');
  const dropdown5S = document.getElementById('5SDropdown');
  const xgDropdown = document.getElementById('xgDropdown');

  // Hamburger menu toggle
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
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          // dropdown5S.classList.toggle('active');
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
          // xgDropdown.classList.toggle('active');
        }
      });
    }
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


