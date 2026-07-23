/* =============================================================================
   PL-Chua-Thu JavaScript
   Xử lý logic cho trang Phế liệu - Chưa thu
================================================================================ */

// Tên bảng Supabase
const TABLE_NAME = 'pl-chua-thu';

/* =============================================================================
   LOADING OVERLAY FUNCTIONS
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
   CONSTANTS & CONFIGURATION
   Các hằng số cấu hình cho ứng dụng
================================================================================ */

// ==================== PAGINATION CONFIG ====================
const ROWS_PER_PAGE = 100; // Số dòng hiển thị mỗi trang
// ============================================================

// ==================== COLUMN DEFINITIONS ====================
// Định nghĩa các cột dữ liệu từ Google Sheet
// Cần điều chỉnh theo cấu trúc thực tế của sheet
// Thứ tự: STT, Ngày, Kì đổ, Xưởng, Loại phế liệu, Số lượng (kg), Ghi chú, Cột 8 (Kì đổ_Xưởng_Loại phế liệu)
const COLUMN_DEFINITIONS = [
  { key: 'stt', label: 'STT', type: 'number', common: true },
  { key: 'ngay', label: 'Ngày', type: 'date', common: true },
  { key: 'kido', label: 'Kì đổ', type: 'text', common: true },
  { key: 'xuong', label: 'Xưởng', type: 'text', common: true },
  { key: 'loai', label: 'Loại phế liệu', type: 'text', detail: true },
  { key: 'soluong', label: 'Số lượng (kg)', type: 'number', detail: true },
  { key: 'ghichu', label: 'Ghi chú', type: 'text', additional: true },
  { key: 'column8', label: 'Cột 8 (Kì đổ_Xưởng_Loại phế liệu)', type: 'text', additional: true }
];

// Các cột hiển thị trong bảng (thứ tự: STT, Ngày, Kì đổ, Xưởng, Loại phế liệu, Số lượng (kg), Ghi chú, Cột 8)
const TABLE_COLUMNS = ['stt', 'ngay', 'kido', 'xuong', 'loai', 'soluong', 'ghichu', 'column8'];

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

// Loại management for Add Data Modal
let loaiCount = 0;

// Edit Loại management for Edit Data Modal
let editLoaiCount = 0;

// Unique values for filters
let xuongList = [];
let kiDoList = [];

// Loại phế liệu dropdown data from Google Sheets (column E)
let loaiPheLieuList = [];
let loaiPheLieuLoaded = false;
let loaiPheLieuError = null;

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
  if (!dateValue && dateValue !== 0) return '';

  let date = null;

  if (typeof dateValue === 'number') {
    // Excel serial date - check if it's a reasonable date value
    // Excel dates start from Jan 1, 1900 (serial 1)
    // Also handle negative values (pre-1900 dates)
    if (dateValue > 0 && dateValue < 100000) {
      // Likely an Excel serial date
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } else if (dateValue > 100000) {
      // Could be a timestamp in milliseconds
      date = new Date(dateValue);
    }
  } else if (typeof dateValue === 'string') {
    date = parseRowDate(dateValue);
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    return String(dateValue ?? '');
  }

  if (!date || isNaN(date.getTime())) {
    // If date parsing failed, try returning the original value
    return String(dateValue ?? '');
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
    // Handle both positive and negative serial numbers
    if (raw > 0) {
      return new Date((raw - 25569) * 86400 * 1000);
    }
    return null;
  }

  // String format
  if (typeof raw === 'string') {
    const trimmed = raw.trim();

    // Check for dd/mm/yyyy or dd-mm-yyyy or dd/mm/yy
    let parts = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (parts) {
      const day = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      let year = parseInt(parts[3], 10);
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        return new Date(year, month, day);
      }
    }

    // Check for yyyy/mm/dd or yyyy-mm-dd (ISO-like but with slashes)
    parts = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (parts) {
      const year = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      const day = parseInt(parts[3], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        return new Date(year, month, day);
      }
    }

    // ISO format: yyyy-mm-dd
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }

    // Try native Date parsing as fallback
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Handle JavaScript Date objects
  if (raw instanceof Date) {
    if (!isNaN(raw.getTime())) {
      return raw;
    }
  }

  return null;
}

// Format number with thousand separators
function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '';
  const parsed = (typeof num === 'number') ? num : parseNumber(num);
  if (parsed === null || isNaN(parsed)) return '';
  return parsed.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// Parse number from string
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  
  let text = value.toString().replace(/ kg/g, '').trim();
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
    if (parts.length === 2) {
      text = `${parts[0]}.${parts[1]}`;
    } else {
      text = text.replace(/,/g, '');
    }
  }

  const num = parseFloat(text);
  return isNaN(num) ? null : num;
}

/* =============================================================================
   DATA LOADING FUNCTIONS
   Các hàm tải dữ liệu từ Google Sheet
================================================================================ */

// Fetch dữ liệu từ Supabase
async function fetchSheetData() {
  const loadingEl = document.getElementById('loading');
  if (!loadingEl) return;

  loadingEl.innerHTML = 'Đang tải dữ liệu từ Supabase...';
  loadingEl.style.display = '';

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      throw error;
    }

    tableData = (data || []).map((row, index) => {
      return {
        id: row.id,
        stt: index + 1,
        ngay: row['Ngày'] ? formatDate(row['Ngày']) : '',
        kido: row['Kì đổ'] || '',
        xuong: row['Xưởng'] || '',
        loai: row['Loại phế liệu'] || '',
        soluong: (row['Số lượng'] !== undefined && row['Số lượng'] !== null)
          ? Number(row['Số lượng'])
          : ((row['Số lượng (kg)'] !== undefined && row['Số lượng (kg)'] !== null)
            ? Number(row['Số lượng (kg)'])
            : null),
        ghichu: row['Ghi chú'] || '',
        column8: row['Cột 8 (Kì đổ_Xưởng_Loại phế liệu)'] || '',
        created_at: row.created_at || row.createdAt || row.created_Time,
        _raw: row,
        _rowIndex: row.id // Dùng id làm _rowIndex để chỉnh sửa/xóa
      };
    });

    // Update filter values
    updateFilterValues();

    // Fetch loại phế liệu data for dropdown
    await fetchLoaiPheLieuData();

    // Enable export button
    const exportBtn = document.getElementById('btnExport');
    if (exportBtn) exportBtn.disabled = false;

    // Apply initial filter and display
    applyFilters();

  } catch (error) {
    console.error('Lỗi khi tải dữ liệu từ Supabase:', error);
    if (loadingEl) {
      loadingEl.innerHTML = `<div class="alert alert-danger">Lỗi khi tải dữ liệu: ${error.message}</div>`;
    }
  } finally {
    // Ẩn loading indicator sau khi tải xong (thành công hoặc lỗi)
    if (loadingEl && !loadingEl.querySelector('.alert-danger')) {
      loadingEl.style.display = 'none';
    }
  }
}

// Lấy danh sách Loại phế liệu duy nhất từ tableData để làm gợi ý dropdown
async function fetchLoaiPheLieuData() {
  try {
    loaiPheLieuError = null;
    loaiPheLieuLoaded = false;

    const loaiSet = new Set();
    tableData.forEach(row => {
      if (row.loai) {
        loaiSet.add(row.loai.trim());
      }
    });

    // Fallback danh mục mặc định nếu chưa có dữ liệu
    if (loaiSet.size === 0) {
      loaiSet.add('Phế liệu Rulo trắng');
      loaiSet.add('Phế liệu giấy');
      loaiSet.add('Phế liệu sỉ cắt');
      loaiSet.add('Phế liệu sỉ đất');
    }

    // Chuyển thành mảng và sắp xếp
    loaiPheLieuList = Array.from(loaiSet).sort((a, b) =>
      a.localeCompare(b, 'vi', { sensitivity: 'base' })
    );

    loaiPheLieuLoaded = true;
    console.log('Loaded loại phế liệu:', loaiPheLieuList.length, 'items');

  } catch (error) {
    console.error('Lỗi khi tải dữ liệu loại phế liệu:', error);
    loaiPheLieuError = error.message;
    loaiPheLieuLoaded = false;
    loaiPheLieuList = [];
  }
}

// Update filter dropdown values
function updateFilterValues() {
  // Extract unique xưởng values
  const xuongSet = new Set();
  // Extract unique kì đổ values
  const kiDoSet = new Set();
  tableData.forEach(row => {
    if (row.xuong) {
      xuongSet.add(row.xuong);
    }
    if (row.kido) {
      kiDoSet.add(row.kido);
    }
  });
  xuongList = Array.from(xuongSet).sort();
  kiDoList = Array.from(kiDoSet).sort();

  // Render xưởng filter
  renderXuongFilter();
  // Render kì đổ filter
  renderKiDoFilter();
}

// Render xưởng filter dropdown
function renderXuongFilter() {
  const menu = document.getElementById('xuongFilterMenu');
  if (!menu) return;

  // Clear existing content
  menu.innerHTML = '';

  // Check if we have xuongList
  if (!xuongList || xuongList.length === 0) {
    const none = document.createElement('div');
    none.className = 'text-muted small';
    none.textContent = 'Không có dữ liệu';
    menu.appendChild(none);
    const countEl = document.getElementById('xuongFilterCount');
    if (countEl) countEl.textContent = '0';
    return;
  }

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
    const countEl = document.getElementById('xuongFilterCount');
    if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
    applyFilters();
  });
  clr.addEventListener('click', (e) => {
    e.preventDefault();
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    const countEl = document.getElementById('xuongFilterCount');
    if (countEl) countEl.textContent = '0';
    applyFilters();
  });

  // Checkbox options
  xuongList.forEach((xuong, i) => {
    const id = `xuongOpt_${i}`;
    const wrap = document.createElement('div');
    wrap.className = 'form-check';
    const input = document.createElement('input');
    input.className = 'form-check-input xuong-filter-checkbox';
    input.type = 'checkbox';
    input.value = xuong;
    input.id = id;
    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = id;
    label.textContent = xuong;
    wrap.appendChild(input);
    wrap.appendChild(label);
    menu.appendChild(wrap);

    input.addEventListener('change', () => {
      const countEl = document.getElementById('xuongFilterCount');
      if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
      applyFilters();
    });
  });

  const countEl = document.getElementById('xuongFilterCount');
  if (countEl) countEl.textContent = '0';
}

// Update xưởng filter count
function updateXuongFilterCount() {
  const checked = document.querySelectorAll('.xuong-filter-checkbox:checked');
  const countEl = document.getElementById('xuongFilterCount');
  if (countEl) countEl.textContent = checked.length;
}

// Render Ki Đổ filter dropdown
function renderKiDoFilter() {
  const menu = document.getElementById('kiDoFilterMenu');
  if (!menu) return;

  // Clear existing content
  menu.innerHTML = '';

  // Check if we have kiDoList
  if (!kiDoList || kiDoList.length === 0) {
    const none = document.createElement('div');
    none.className = 'text-muted small';
    none.textContent = 'Không có dữ liệu';
    menu.appendChild(none);
    const countEl = document.getElementById('kiDoFilterCount');
    if (countEl) countEl.textContent = '0';
    return;
  }

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
    const countEl = document.getElementById('kiDoFilterCount');
    if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
    applyFilters();
  });
  clr.addEventListener('click', (e) => {
    e.preventDefault();
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    const countEl = document.getElementById('kiDoFilterCount');
    if (countEl) countEl.textContent = '0';
    applyFilters();
  });

  // Checkbox options
  kiDoList.forEach((kido, i) => {
    const id = `kiDoOpt_${i}`;
    const wrap = document.createElement('div');
    wrap.className = 'form-check';
    const input = document.createElement('input');
    input.className = 'form-check-input kido-filter-checkbox';
    input.type = 'checkbox';
    input.value = kido;
    input.id = id;
    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = id;
    label.textContent = kido;
    wrap.appendChild(input);
    wrap.appendChild(label);
    menu.appendChild(wrap);

    input.addEventListener('change', () => {
      const countEl = document.getElementById('kiDoFilterCount');
      if (countEl) countEl.textContent = String(menu.querySelectorAll('input[type="checkbox"]:checked').length);
      applyFilters();
    });
  });

  const countEl = document.getElementById('kiDoFilterCount');
  if (countEl) countEl.textContent = '0';
}

// Update Ki Đổ filter count
function updateKiDoFilterCount() {
  const checked = document.querySelectorAll('.kido-filter-checkbox:checked');
  const countEl = document.getElementById('kiDoFilterCount');
  if (countEl) countEl.textContent = checked.length;
}

/* =============================================================================
   FILTERING & PAGINATION
   Các hàm lọc dữ liệu và phân trang
================================================================================ */

// Apply all filters
function applyFilters() {
  const searchInput = document.getElementById('searchInput');
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');

  const searchTerm = searchInput?.value?.toLowerCase() || '';
  const fromDate = fromDateInput?.value;
  const toDate = toDateInput?.value;
  const checkedXuongs = Array.from(document.querySelectorAll('.xuong-filter-checkbox:checked')).map(cb => cb.value);
  const checkedKiDos = Array.from(document.querySelectorAll('.kido-filter-checkbox:checked')).map(cb => cb.value);

  filteredData = tableData.filter(row => {
    // Search filter
    if (searchTerm) {
      const searchFields = [row.xuong, row.loai, row.ghichu].filter(f => f).join(' ').toLowerCase();
      if (!searchFields.includes(searchTerm)) {
        return false;
      }
    }

    // Date filter
    if (fromDate || toDate) {
      const rowDate = parseRowDate(row.ngay);
      if (rowDate) {
        // Use local date components to avoid timezone issues with toISOString()
        const rowYear = rowDate.getFullYear();
        const rowMonth = String(rowDate.getMonth() + 1).padStart(2, '0');
        const rowDay = String(rowDate.getDate()).padStart(2, '0');
        const rowDateStr = `${rowYear}-${rowMonth}-${rowDay}`;

        if (fromDate && rowDateStr < fromDate) return false;
        if (toDate && rowDateStr > toDate) return false;
      } else {
        return false; // Skip rows with invalid dates when filter is applied
      }
    }

    // Xưởng filter
    if (checkedXuongs.length > 0) {
      if (!row.xuong || !checkedXuongs.includes(row.xuong)) {
        return false;
      }
    }

    // Kì đổ filter
    if (checkedKiDos.length > 0) {
      if (!row.kido || !checkedKiDos.includes(row.kido)) {
        return false;
      }
    }

    return true;
  });

  // Reset to first page
  currentPage = 1;

  // Calculate pagination
  totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;

  // Update display
  updatePagination();
  renderTable();
}

// Update pagination controls
function updatePagination() {
  const pageSelect = document.getElementById('pageSelect');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  if (!pageSelect || !pageInfo) return;

  // Update page select options
  let options = '';
  for (let i = 1; i <= totalPages; i++) {
    options += `<option value="${i}" ${i === currentPage ? 'selected' : ''}>Trang ${i}</option>`;
  }
  pageSelect.innerHTML = options;

  // Update page info
  pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;

  // Update button states
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

// Render table with pagination
function renderTable() {
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  displayedData = filteredData.slice(startIndex, endIndex);

  renderTableBody();
}

// Render table body
function renderTableBody() {
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const tbody = document.querySelector('#dataTable tbody');
  const theadTr = document.querySelector('#dataTable thead tr');

  if (!tbody || !theadTr) return;

  // Luôn cập nhật header trước khi hiển thị dữ liệu
  let headerHtml = '<th style="width: 50px;"><input type="checkbox" id="selectAllCheckbox" title="Chọn tất cả"></th>';
  TABLE_COLUMNS.forEach(col => {
    const colDef = COLUMN_DEFINITIONS.find(c => c.key === col);
    headerHtml += `<th>${colDef?.label || col}</th>`;
  });
  theadTr.innerHTML = headerHtml;

  // Đảm bảo loading indicator được ẩn
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }

  // Render body
  if (displayedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Không có dữ liệu</td></tr>';
    return;
  }

  tbody.innerHTML = displayedData.map((row, index) => {
    let cells = `<td><input type="checkbox" class="row-checkbox" data-id="${row.id}"></td>`;

    TABLE_COLUMNS.forEach(col => {
      let value = row[col];

      if (col === 'soluong' && value !== null && value !== undefined) {
        value = formatNumber(value);
      }

      cells += `<td>${escapeHtml(value ?? '')}</td>`;
    });

    return `<tr data-id="${row.id}">${cells}</tr>`;
  }).join('');

  // Add row click handler
  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      const checkbox = tr.querySelector('.row-checkbox');
      if (checkbox) checkbox.checked = !checkbox.checked;
      updateButtonStates();
    });
  });

  // Add checkbox handler
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = e.target.checked;
      });
      updateButtonStates();
    });
  }

  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.addEventListener('change', updateButtonStates);
  });

  enableColumnResize(document.getElementById('dataTable'));
  updateButtonStates();
}

// Update button states based on selection
function updateButtonStates() {
  const checked = document.querySelectorAll('.row-checkbox:checked');
  const count = checked.length;

  const editBtn = document.getElementById('btnEditData');
  const deleteBtn = document.getElementById('btnDeleteData');

  selectedRowIndexes = Array.from(checked).map(cb => parseInt(cb.dataset.id, 10));
  selectedRowIndex = count === 1 ? selectedRowIndexes[0] : -1;

  if (editBtn) {
    editBtn.disabled = count !== 1;
    editBtn.removeAttribute('title');
  }
  if (deleteBtn) {
    deleteBtn.disabled = count === 0;
    if (count > 0) {
      deleteBtn.textContent = `Xóa đã chọn (${count})`;
    } else {
      deleteBtn.textContent = 'Xóa dữ liệu';
    }
    deleteBtn.removeAttribute('title');
  }
}

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
    xuongFilters: [],
    kiDoFilters: []
  };

  // Lưu search input
  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) state.searchInput = searchInputEl.value;

  // Lưu date filters
  const fromDateEl = document.getElementById('fromDate');
  const toDateEl = document.getElementById('toDate');
  if (fromDateEl) state.fromDate = fromDateEl.value;
  if (toDateEl) state.toDate = toDateEl.value;

  // Lưu xuong filters
  const xuongCheckboxes = document.querySelectorAll('#xuongFilterMenu input[type="checkbox"]');
  state.xuongFilters = Array.from(xuongCheckboxes).map(cb => ({
    value: cb.value,
    checked: cb.checked
  }));

  // Lưu kiDo filters
  const kiDoCheckboxes = document.querySelectorAll('#kiDoFilterMenu input[type="checkbox"]');
  state.kiDoFilters = Array.from(kiDoCheckboxes).map(cb => ({
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

  // Khôi phục xuong filters
  if (state.xuongFilters && state.xuongFilters.length > 0) {
    state.xuongFilters.forEach(filter => {
      const cb = document.querySelector(`#xuongFilterMenu input[value="${CSS.escape(filter.value)}"]`);
      if (cb) cb.checked = filter.checked;
    });
  }

  // Khôi phục kiDo filters
  if (state.kiDoFilters && state.kiDoFilters.length > 0) {
    state.kiDoFilters.forEach(filter => {
      const cb = document.querySelector(`#kiDoFilterMenu input[value="${CSS.escape(filter.value)}"]`);
      if (cb) cb.checked = filter.checked;
    });
  }
}

// Cập nhật bộ đếm filter
function updateFilterCounts() {
  const xuongCheckboxes = document.querySelectorAll('#xuongFilterMenu input[type="checkbox"]:checked');
  const xuongCountEl = document.getElementById('xuongFilterCount');
  if (xuongCountEl) xuongCountEl.textContent = xuongCheckboxes.length;

  const kiDoCheckboxes = document.querySelectorAll('#kiDoFilterMenu input[type="checkbox"]:checked');
  const kiDoCountEl = document.getElementById('kiDoFilterCount');
  if (kiDoCountEl) kiDoCountEl.textContent = kiDoCheckboxes.length;
}

/* =============================================================================
   MODAL & FORM HANDLING
   Các hàm xử lý modal và form
================================================================================ */

function setupModalPermissions(modalEl) {
  const currentUser = localStorage.getItem('currentUser');
  const isAdmin = currentUser === 'bao.lt';

  if (!modalEl) return isAdmin;

  // Vô hiệu hóa tất cả các input, select, textarea trong modal nếu không phải admin
  const inputs = modalEl.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.disabled = !isAdmin;
  });

  // Ẩn/hiện các nút hành động trong modal
  const submitBtn = modalEl.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.style.display = isAdmin ? '' : 'none';
  }

  // Ẩn nút "Xác nhận xóa" nếu không phải admin (cho deleteDataModal)
  const btnConfirmDelete = modalEl.querySelector('#btnConfirmDelete');
  if (btnConfirmDelete) {
    btnConfirmDelete.style.display = isAdmin ? '' : 'none';
  }

  // Ẩn các nút "Thêm loại" và "Xóa loại" trong modal nếu không phải admin
  const btnAddLoai = modalEl.querySelector('#btnAddLoai, #btnEditAddLoai');
  if (btnAddLoai) {
    btnAddLoai.style.display = isAdmin ? '' : 'none';
  }

  const btnRemoveLoai = modalEl.querySelectorAll('.btn-remove-loai');
  btnRemoveLoai.forEach(btn => {
    btn.style.display = isAdmin ? '' : 'none';
  });

  return isAdmin;
}

// Show add data modal
function showAddDataModal() {
  // Lưu vị trí scroll và trạng thái lọc trước khi mở modal
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();

  const modalEl = document.getElementById('addDataModal');
  if (!modalEl) return;

  // Thiết lập quyền cho modal
  setupModalPermissions(modalEl);

  const modal = new bootstrap.Modal(modalEl);

  // Reset form
  const form = document.getElementById('addDataForm');
  if (form) form.reset();

  // Reset loại table
  loaiCount = 0;
  const loaiTableBody = document.getElementById('loaiTableBody');
  if (loaiTableBody) loaiTableBody.innerHTML = '';
  updateLoaiTotals();

  // Add first loại row
  addLoaiRow();

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  const ngayInput = document.querySelector('#addDataForm input[name="ngay"]');
  if (ngayInput) ngayInput.value = today;

  // Populate kì đổ dropdown
  const kidoSelect = document.querySelector('#addDataForm select[name="kido"]');
  if (kidoSelect) {
    // Clear existing options except the placeholder
    kidoSelect.innerHTML = '<option value="">Chọn kì đổ</option>';
    // Add unique kì đổ values
    kiDoList.forEach(kido => {
      const option = document.createElement('option');
      option.value = kido;
      option.textContent = kido;
      kidoSelect.appendChild(option);
    });
  }

  // Populate xưởng dropdown
  const xuongSelect = document.querySelector('#addDataForm select[name="xuong"]');
  if (xuongSelect) {
    // Clear existing options except the placeholder
    xuongSelect.innerHTML = '<option value="">Chọn xưởng</option>';
    // Add unique xưởng values
    xuongList.forEach(xuong => {
      const option = document.createElement('option');
      option.value = xuong;
      option.textContent = xuong;
      xuongSelect.appendChild(option);
    });
  }

  // Add event listeners for column 8 calculation
  if (kidoSelect) {
    kidoSelect.addEventListener('change', updateColumn8Value);
  }
  if (xuongSelect) {
    xuongSelect.addEventListener('change', updateColumn8Value);
  }

  modal.show();
}

// Show edit data modal
function showEditDataModal() {
  if (selectedRowIndex < 0) return;

  // Lưu vị trí scroll và trạng thái lọc trước khi mở modal
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();

  const modalEl = document.getElementById('editDataModal');
  if (!modalEl) return;

  // Thiết lập quyền cho modal
  setupModalPermissions(modalEl);

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const row = rowToEdit;
  if (!row) return;

  // Populate common fields (ngay, xuong)
  const xuongInput = document.querySelector('#editDataForm input[name="xuong"]');
  const ngayInput = document.querySelector('#editDataForm input[name="ngay"]');
  const kidoSelect = document.querySelector('#editDataForm select[name="kido"]');
  const ghichuInput = document.querySelector('#editDataForm textarea[name="ghichu"]');

  if (xuongInput) xuongInput.value = row.xuong || '';
  if (ngayInput) {
    // Convert date from dd/mm/yyyy to yyyy-mm-dd for input type=date
    const dateValue = row.ngay;
    if (dateValue) {
      const parsedDate = parseRowDate(dateValue);
      if (parsedDate) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        ngayInput.value = `${year}-${month}-${day}`;
      } else {
        ngayInput.value = '';
      }
    } else {
      ngayInput.value = '';
    }
  }
  // Populate kì đổ dropdown
  if (kidoSelect) {
    // Clear existing options except the placeholder
    kidoSelect.innerHTML = '<option value="">Chọn kì đổ</option>';
    // Add unique kì đổ values
    kiDoList.forEach(kido => {
      const option = document.createElement('option');
      option.value = kido;
      option.textContent = kido;
      kidoSelect.appendChild(option);
    });
    // Set the value from row data
    kidoSelect.value = row.kido || '';
  }

  // Populate xưởng dropdown
  const xuongSelect = document.querySelector('#editDataForm select[name="xuong"]');
  if (xuongSelect) {
    // Clear existing options except the placeholder
    xuongSelect.innerHTML = '<option value="">Chọn xưởng</option>';
    // Add unique xưởng values
    xuongList.forEach(xuong => {
      const option = document.createElement('option');
      option.value = xuong;
      option.textContent = xuong;
      xuongSelect.appendChild(option);
    });
    // Set the value from row data
    xuongSelect.value = row.xuong || '';
  }

  // Add event listeners for column 8 calculation in edit modal
  if (kidoSelect) {
    kidoSelect.addEventListener('change', updateEditColumn8Value);
  }
  if (xuongSelect) {
    xuongSelect.addEventListener('change', updateEditColumn8Value);
  }
  if (ghichuInput) ghichuInput.value = row.ghichu || '';

  // Reset edit loại table
  editLoaiCount = 0;
  const editLoaiTableBody = document.getElementById('editLoaiTableBody');
  if (editLoaiTableBody) editLoaiTableBody.innerHTML = '';

  // Add loại row for each loại in the data
  addEditLoaiRow(row.loai || '', row.soluong || '');

  updateEditLoaiTotals();

  modal.show();
}

// Create searchable dropdown for Loại phế liệu
function createLoaiDropdown(containerId, selectedValue = '') {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Clear existing content
  container.innerHTML = '';

  // Create dropdown structure
  const dropdownHtml = `
    <div class="loai-dropdown-container" data-dropdown-id="${containerId}">
      <div class="loai-dropdown-selected placeholder" tabindex="0">
        <span class="loai-dropdown-text">Chọn loại phế liệu</span>
        <span class="loai-dropdown-arrow">▼</span>
      </div>
      <div class="loai-dropdown-menu">
        <div class="loai-dropdown-search">
          <input type="text" placeholder="Tìm kiếm loại phế liệu..." autocomplete="off">
        </div>
        <div class="loai-dropdown-options">
          ${loaiPheLieuLoaded ?
      (loaiPheLieuList.length > 0 ?
        loaiPheLieuList.map(loai =>
          `<div class="loai-dropdown-option" data-value="${escapeHtml(loai)}">${escapeHtml(loai)}</div>`
        ).join('') :
        '<div class="loai-dropdown-empty">Không có dữ liệu loại phế liệu</div>'
      ) :
      (loaiPheLieuError ?
        `<div class="loai-dropdown-error">
                <div>Không thể tải dữ liệu</div>
                <button type="button" class="btn btn-sm btn-outline-primary btn-retry-loai">Thử lại</button>
              </div>` :
        '<div class="loai-dropdown-loading">Đang tải dữ liệu...</div>'
      )
    }
        </div>
      </div>
    </div>
  `;

  container.innerHTML = dropdownHtml;

  // Get elements
  const dropdown = container.querySelector('.loai-dropdown-container');
  const selected = dropdown.querySelector('.loai-dropdown-selected');
  const menu = dropdown.querySelector('.loai-dropdown-menu');
  const searchInput = dropdown.querySelector('.loai-dropdown-search input');
  const optionsContainer = dropdown.querySelector('.loai-dropdown-options');
  const textSpan = dropdown.querySelector('.loai-dropdown-text');

  // Set initial value if provided
  if (selectedValue && loaiPheLieuList.includes(selectedValue)) {
    textSpan.textContent = selectedValue;
    selected.classList.remove('placeholder');
    selected.dataset.value = selectedValue;

    // Mark selected option
    const selectedOption = optionsContainer.querySelector(`[data-value="${CSS.escape(selectedValue)}"]`);
    if (selectedOption) {
      selectedOption.classList.add('selected');
    }
  }

  // Toggle dropdown
  selected.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');

    // Close all other dropdowns first
    document.querySelectorAll('.loai-dropdown-container.open').forEach(d => {
      if (d !== dropdown) {
        d.classList.remove('open');
      }
    });

    if (!isOpen) {
      dropdown.classList.add('open');
      searchInput.focus();
      searchInput.value = '';
      filterOptions('');
    } else {
      dropdown.classList.remove('open');
    }
  });

  // Handle keyboard navigation
  selected.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selected.click();
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
    }
  });

  // Filter options on search
  searchInput.addEventListener('input', (e) => {
    filterOptions(e.target.value.toLowerCase());
  });

  // Prevent search input from closing dropdown
  searchInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Handle option selection
  optionsContainer.addEventListener('click', (e) => {
    const option = e.target.closest('.loai-dropdown-option');
    if (option) {
      const value = option.dataset.value;
      textSpan.textContent = value;
      selected.classList.remove('placeholder');
      selected.dataset.value = value;

      // Update selected state
      optionsContainer.querySelectorAll('.loai-dropdown-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      option.classList.add('selected');

      dropdown.classList.remove('open');
    }
  });

  // Handle retry button
  const retryBtn = dropdown.querySelector('.btn-retry-loai');
  if (retryBtn) {
    retryBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      retryBtn.disabled = true;
      retryBtn.textContent = 'Đang tải...';

      await fetchLoaiPheLieuData();

      // Recreate dropdown with new data
      createLoaiDropdown(containerId, selectedValue);
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Filter options function
  function filterOptions(searchTerm) {
    const options = optionsContainer.querySelectorAll('.loai-dropdown-option');
    let hasVisibleOptions = false;

    options.forEach(option => {
      const text = option.textContent.toLowerCase();
      if (text.includes(searchTerm)) {
        option.style.display = 'block';
        hasVisibleOptions = true;
      } else {
        option.style.display = 'none';
      }
    });

    // Show empty message if no options match
    const emptyMsg = optionsContainer.querySelector('.loai-dropdown-empty');
    if (!hasVisibleOptions && options.length > 0) {
      if (!emptyMsg) {
        const msg = document.createElement('div');
        msg.className = 'loai-dropdown-empty';
        msg.textContent = 'Không tìm thấy kết quả';
        optionsContainer.appendChild(msg);
      }
    } else if (emptyMsg && hasVisibleOptions) {
      emptyMsg.remove();
    }
  }

  return dropdown;
}

// Get selected value from dropdown
function getLoaiDropdownValue(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return '';

  const selected = container.querySelector('.loai-dropdown-selected');
  return selected?.dataset?.value || '';
}

// Add loại row in add modal
function addLoaiRow(loaiValue = '', kgValue = '') {
  loaiCount++;
  const tbody = document.getElementById('loaiTableBody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.dataset.loaiId = loaiCount;
  tr.innerHTML = `
    <td class="text-center loai-stt">${loaiCount}</td>
    <td>
      <div id="loaiDropdown_${loaiCount}" class="loai-dropdown-cell"></div>
    </td>
    <td>
      <input type="number" class="form-control form-control-sm loai-input kg-input"
             placeholder="Số kg" step="0.01" min="0" value="${kgValue}">
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-loai"
              onclick="removeLoaiRow(${loaiCount})">✕</button>
    </td>
  `;
  tbody.appendChild(tr);

  // Create dropdown for this row
  createLoaiDropdown(`loaiDropdown_${loaiCount}`, loaiValue);

  updateLoaiTotals();
}

// Add loại row in edit modal
function addEditLoaiRow(loaiValue = '', kgValue = '') {
  editLoaiCount++;
  const tbody = document.getElementById('editLoaiTableBody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.dataset.loaiId = editLoaiCount;
  tr.innerHTML = `
    <td class="text-center loai-stt">${editLoaiCount}</td>
    <td>
      <div id="editLoaiDropdown_${editLoaiCount}" class="loai-dropdown-cell"></div>
    </td>
    <td>
      <input type="number" class="form-control form-control-sm loai-input kg-input"
             placeholder="Số kg" step="0.01" min="0" value="${kgValue}">
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-loai"
              onclick="removeEditLoaiRow(${editLoaiCount})">✕</button>
    </td>
  `;
  tbody.appendChild(tr);

  // Create dropdown for this row
  createLoaiDropdown(`editLoaiDropdown_${editLoaiCount}`, loaiValue);

  updateEditLoaiTotals();
}

// Remove loại row from add modal
function removeLoaiRow(loaiId) {
  const row = document.querySelector(`#loaiTableBody tr[data-loai-id="${loaiId}"]`);
  if (row) {
    row.remove();
    updateLoaiRowNumbers();
    updateLoaiTotals();
  }
}

// Remove loại row from edit modal
function removeEditLoaiRow(loaiId) {
  const row = document.querySelector(`#editLoaiTableBody tr[data-loai-id="${loaiId}"]`);
  if (row) {
    row.remove();
    updateEditLoaiRowNumbers();
    updateEditLoaiTotals();
  }
}

// Update loại row numbers
function updateLoaiRowNumbers() {
  let num = 1;
  document.querySelectorAll('#loaiTableBody tr').forEach(tr => {
    tr.querySelector('.loai-stt').textContent = num++;
  });
  loaiCount = num - 1;
}

// Update edit loại row numbers
function updateEditLoaiRowNumbers() {
  let num = 1;
  document.querySelectorAll('#editLoaiTableBody tr').forEach(tr => {
    tr.querySelector('.loai-stt').textContent = num++;
  });
  editLoaiCount = num - 1;
}

// Update loại totals
function updateLoaiTotals() {
  const rows = document.querySelectorAll('#loaiTableBody tr');
  let totalKg = 0;

  rows.forEach(tr => {
    const kgInput = tr.querySelector('.kg-input');
    if (kgInput && kgInput.value) {
      totalKg += parseFloat(kgInput.value) || 0;
    }
  });

  const totalLoaiCountEl = document.getElementById('totalLoaiCount');
  const totalKgEl = document.getElementById('totalKg');

  if (totalLoaiCountEl) totalLoaiCountEl.textContent = rows.length;
  if (totalKgEl) totalKgEl.textContent = formatNumber(totalKg);
}

// Update edit loại totals
function updateEditLoaiTotals() {
  const rows = document.querySelectorAll('#editLoaiTableBody tr');
  let totalKg = 0;

  rows.forEach(tr => {
    const kgInput = tr.querySelector('.kg-input');
    if (kgInput && kgInput.value) {
      totalKg += parseFloat(kgInput.value) || 0;
    }
  });

  const totalLoaiCountEl = document.getElementById('editTotalLoaiCount');
  const totalKgEl = document.getElementById('editTotalKg');

  if (totalLoaiCountEl) totalLoaiCountEl.textContent = rows.length;
  if (totalKgEl) totalKgEl.textContent = formatNumber(totalKg);
}

// Handle add form submit
async function handleAddSubmit(e) {
  e.preventDefault();

  const xuongInput = document.querySelector('#addDataForm select[name="xuong"]');
  const ngayInput = document.querySelector('#addDataForm input[name="ngay"]');
  const kidoInput = document.querySelector('#addDataForm select[name="kido"]');
  const ghichuInput = document.querySelector('#addDataForm textarea[name="ghichu"]');

  const xuong = xuongInput?.value?.trim();
  const ngay = ngayInput?.value;
  const kido = kidoInput?.value;
  const ghichu = ghichuInput?.value?.trim() || '';

  // Get all loại rows
  const loaiRows = [];
  document.querySelectorAll('#loaiTableBody tr').forEach(tr => {
    const loaiDropdown = tr.querySelector('.loai-dropdown-selected');
    const kgInput = tr.querySelector('.kg-input');
    const loai = loaiDropdown?.dataset?.value?.trim() || '';
    const kg = parseFloat(kgInput?.value) || 0;
    if (loai && kg > 0) {
      loaiRows.push({ loai, kg });
    }
  });

  if (!xuong) {
    alert('Vui lòng nhập tên xưởng');
    return;
  }

  if (loaiRows.length === 0) {
    alert('Vui lòng thêm ít nhất một loại phế liệu');
    return;
  }

  // Show loading overlay
  showLoadingOverlay('Đang thêm dữ liệu vào Supabase...');

  try {
    // Create multiple records (one for each loại)
    const records = loaiRows.map(item => {
      const column8Value = `${kido}_${xuong}_${item.loai}`;
      return {
        'Ngày': ngay || null,
        'Kì đổ': kido || '',
        'Xưởng': xuong || '',
        'Loại phế liệu': item.loai || '',
        'Số lượng': item.kg || 0,
        'Số lượng (kg)': item.kg || 0,
        'Ghi chú': ghichu || '',
        'Cột 8 (Kì đổ_Xưởng_Loại phế liệu)': column8Value
      };
    });

    const { error } = await supabase
      .from(TABLE_NAME)
      .insert(records);

    if (error) throw error;

    // Close modal and reload
    const modalEl = document.getElementById('addDataModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    await fetchSheetData();

    // Khôi phục vị trí scroll và trạng thái lọc
    if (window._savedFilterState) {
      restoreFilterState(window._savedFilterState);
      window._savedFilterState = null;
    }
    if (window._savedScrollPosition) {
      restoreScrollPosition(window._savedScrollPosition);
      window._savedScrollPosition = null;
    }

  } catch (error) {
    console.error('Lỗi khi thêm dữ liệu vào Supabase:', error);
    alert('Lỗi khi thêm dữ liệu: ' + error.message);
  } finally {
    hideLoadingOverlay();
  }
}

// Handle edit form submit
async function handleEditSubmit(e) {
  e.preventDefault();

  if (selectedRowIndex < 0) return;

  const originalRow = tableData.find(r => r.id === selectedRowIndex);
  if (!originalRow) return;

  if (typeof isRecordLocked === 'function' && isRecordLocked(originalRow._raw || originalRow)) {
    const sttVal = originalRow.stt || selectedRowIndex;
    const idVal = originalRow.id ? ` (ID: ${originalRow.id})` : '';
    (window.showWarningModal || alert)(`Dữ liệu ở STT ${sttVal}${idVal} đã được nhập quá 24 giờ. Hệ thống không cho phép cập nhật.`);
    return;
  }

  const xuongInput = document.querySelector('#editDataForm select[name="xuong"]');
  const ngayInput = document.querySelector('#editDataForm input[name="ngay"]');
  const kidoInput = document.querySelector('#editDataForm select[name="kido"]');
  const ghichuInput = document.querySelector('#editDataForm textarea[name="ghichu"]');

  const xuong = xuongInput?.value?.trim();
  const ngay = ngayInput?.value;
  const kido = kidoInput?.value;
  const ghichu = ghichuInput?.value?.trim() || '';

  // Get all loại rows
  const loaiRows = [];
  document.querySelectorAll('#editLoaiTableBody tr').forEach(tr => {
    const loaiDropdown = tr.querySelector('.loai-dropdown-selected');
    const kgInput = tr.querySelector('.kg-input');
    const loai = loaiDropdown?.dataset?.value?.trim() || '';
    const kg = parseFloat(kgInput?.value) || 0;
    if (loai && kg > 0) {
      loaiRows.push({ loai, kg });
    }
  });

  if (!xuong) {
    alert('Vui lòng nhập tên xưởng');
    return;
  }

  if (loaiRows.length === 0) {
    alert('Vui lòng thêm ít nhất một loại phế liệu');
    return;
  }

  // Show loading overlay
  showLoadingOverlay('Đang cập nhật dữ liệu lên Supabase...');

  try {
    const rowId = originalRow.id;
    const column8Value = `${kido}_${xuong}_${loaiRows[0].loai}`;

    const updateData = {
      'Ngày': ngay || null,
      'Kì đổ': kido || '',
      'Xưởng': xuong || '',
      'Loại phế liệu': loaiRows[0].loai || '',
      'Số lượng': loaiRows[0].kg || 0,
      'Số lượng (kg)': loaiRows[0].kg || 0,
      'Ghi chú': ghichu || '',
      'Cột 8 (Kì đổ_Xưởng_Loại phế liệu)': column8Value
    };

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', rowId);

    if (error) throw error;

    // Close modal and reload
    const modalEl = document.getElementById('editDataModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    await fetchSheetData();

    // Khôi phục vị trí scroll và trạng thái lọc
    if (window._savedFilterState) {
      restoreFilterState(window._savedFilterState);
      window._savedFilterState = null;
    }
    if (window._savedScrollPosition) {
      restoreScrollPosition(window._savedScrollPosition);
      window._savedScrollPosition = null;
    }

  } catch (error) {
    console.error('Lỗi khi cập nhật dữ liệu trên Supabase:', error);
    alert('Lỗi khi cập nhật dữ liệu: ' + error.message);
  } finally {
    hideLoadingOverlay();
  }
}

// Handle delete
async function handleDelete() {
  if (selectedRowIndexes.length === 0) return;

  // Lưu vị trí scroll và trạng thái lọc trước khi mở modal
  window._savedScrollPosition = saveScrollPosition();
  window._savedFilterState = saveFilterState();

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

  // Thiết lập quyền cho modal xóa
  setupModalPermissions(modalEl);

  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}

// Handle confirm delete from modal
async function handleConfirmDelete() {
  const lockedItems = [];
  selectedRowIndexes.forEach(id => {
    const r = tableData.find(row => row.id === id);
    if (typeof isRecordLocked === 'function' && isRecordLocked(r?._raw || r)) {
      const sttVal = r?.stt || id;
      const idVal = r?.id ? ` (ID: ${r.id})` : '';
      lockedItems.push(`STT ${sttVal}${idVal}`);
    }
  });

  if (lockedItems.length > 0) {
    const msg = lockedItems.length === 1
      ? `Dữ liệu ở ${lockedItems[0]} đã nhập quá 24 giờ. Hệ thống không cho phép xóa.`
      : `Không thể xóa. Các dòng dữ liệu sau đã nhập quá 24 giờ:\n• ${lockedItems.join('\n• ')}`;
    (window.showWarningModal || alert)(msg);
    return;
  }

  // Show loading overlay
  showLoadingOverlay('Đang xóa dữ liệu trên Supabase...');

  try {
    const idsToDelete = selectedRowIndexes;

    if (idsToDelete.length > 0) {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;
    }

    // Reload data
    await fetchSheetData();

    // Close modal
    const deleteDataModalEl = document.getElementById('deleteDataModal');
    const bsDeleteData = bootstrap.Modal.getInstance(deleteDataModalEl);
    if (bsDeleteData) bsDeleteData.hide();

    // Khôi phục vị trí scroll và trạng thái lọc
    if (window._savedFilterState) {
      restoreFilterState(window._savedFilterState);
      window._savedFilterState = null;
    }
    if (window._savedScrollPosition) {
      restoreScrollPosition(window._savedScrollPosition);
      window._savedScrollPosition = null;
    }

  } catch (error) {
    console.error('Lỗi khi xóa dữ liệu trên Supabase:', error);
    alert('Lỗi khi xóa dữ liệu: ' + error.message);
  } finally {
    hideLoadingOverlay();
  }
}

// Handle export
function handleExport() {
  if (!filteredData || filteredData.length === 0) {
    alert('Không có dữ liệu để xuất file Excel');
    return;
  }

  const exportHeaders = ['STT', 'Ngày', 'Kì đổ', 'Xưởng', 'Loại phế liệu', 'Số lượng (kg)', 'Ghi chú', 'Cột phụ'];
  const exportRows = filteredData.map((row, idx) => [
    idx + 1,
    row.ngay || '',
    row.kido || '',
    row.xuong || '',
    row.loai || '',
    row.soluong || 0,
    row.ghichu || '',
    row.column8 || ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dữ liệu');

  // Auto-fit columns
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

  XLSX.writeFile(wb, `${TABLE_NAME}_export.xlsx`);
}

// Reset filters
function resetFilters() {
  const searchInput = document.getElementById('searchInput');
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');

  if (searchInput) searchInput.value = '';
  if (fromDateInput) fromDateInput.value = '';
  if (toDateInput) toDateInput.value = '';

  document.querySelectorAll('.xuong-filter-checkbox').forEach(cb => cb.checked = false);

  const countEl = document.getElementById('xuongFilterCount');
  if (countEl) countEl.textContent = '0';

  // Reset Kì đổ filter
  document.querySelectorAll('.kido-filter-checkbox').forEach(cb => cb.checked = false);

  const kiDoCountEl = document.getElementById('kiDoFilterCount');
  if (kiDoCountEl) kiDoCountEl.textContent = '0';

  applyFilters();
}

/* =============================================================================
   UTILITY FUNCTIONS
   Các hàm tiện ích bổ sung
================================================================================ */

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/* =============================================================================
   EVENT LISTENERS
   Khởi tạo các event listeners
================================================================================ */

// Wait for DOM and XLSX to be ready
function initApp() {
  if (typeof XLSX === 'undefined') {
    // XLSX not loaded yet, try again
    setTimeout(initApp, 100);
    return;
  }

  // DOM is ready and XLSX is loaded
  document.addEventListener('DOMContentLoaded', function () {
    // Kiểm tra xem đã đăng nhập chưa, nếu chưa thì quay về trang đăng nhập
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
      window.location.href = '/pages/index.html';
      return;
    }

    // Hiển thị tên đăng nhập
    const usernameElement = document.getElementById('currentUsername');
    if (usernameElement && currentUser) {
      usernameElement.textContent = currentUser;
    }

    // Load data
    fetchSheetData();

    // Load loại phế liệu data for dropdown (in parallel)
    fetchLoaiPheLieuData();

    // Button event listeners
    document.getElementById('btnAddData')?.addEventListener('click', showAddDataModal);
    document.getElementById('btnEditData')?.addEventListener('click', showEditDataModal);
    document.getElementById('btnDeleteData')?.addEventListener('click', handleDelete);
    document.getElementById('btnConfirmDelete')?.addEventListener('click', handleConfirmDelete);
    document.getElementById('btnExport')?.addEventListener('click', handleExport);
    document.getElementById('btnResetFilter')?.addEventListener('click', resetFilters);

    // Form submit handlers
    document.getElementById('addDataForm')?.addEventListener('submit', handleAddSubmit);
    document.getElementById('editDataForm')?.addEventListener('submit', handleEditSubmit);

    // Add loại button
    document.getElementById('btnAddLoai')?.addEventListener('click', () => addLoaiRow());
    document.getElementById('btnEditAddLoai')?.addEventListener('click', () => addEditLoaiRow());

    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(applyFilters, 300));
    }

    // Date filters
    document.getElementById('fromDate')?.addEventListener('change', applyFilters);
    document.getElementById('toDate')?.addEventListener('change', applyFilters);

    // Pagination
    document.getElementById('pageSelect')?.addEventListener('change', (e) => {
      currentPage = parseInt(e.target.value, 10);
      renderTable();
      updatePagination();
    });

    document.getElementById('prevPage')?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePagination();
      }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePagination();
      }
    });

    // Logout button
    document.getElementById('btnLogout')?.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        localStorage.removeItem('currentUser');
        window.location.href = '/pages/index.html';
      }
    });

    // Logo click to go home
    const logo = document.querySelector('.logo');
    if (logo) {
      logo.style.cursor = 'pointer';
      logo.addEventListener('click', function () {
        window.location.href = '/pages/home.html';
      });
    }

    // Hamburger menu
    document.getElementById('hamburger')?.addEventListener('click', () => {
      // document.getElementById('mainNav')?.classList.toggle('active');
    });

    // Load username (giữ để tương thích ngược)
    const username = localStorage.getItem('currentUser');
    const usernameEl = document.getElementById('currentUsername');
    if (usernameEl) {
      usernameEl.textContent = username || 'Khách';
    }

    // Add input event listeners for live total update (add modal)
    document.getElementById('loaiTableBody')?.addEventListener('input', (e) => {
      if (e.target.classList.contains('kg-input')) {
        updateLoaiTotals();
      }
    });

    // Add input event listeners for live total update (edit modal)
    document.getElementById('editLoaiTableBody')?.addEventListener('input', (e) => {
      if (e.target.classList.contains('kg-input')) {
        updateEditLoaiTotals();
      }
    });
  });
}

// Update column 8 value (Kì đổ_Xưởng_Loại phế liệu)
function updateColumn8Value() {
  const kidoSelect = document.querySelector('#addDataForm select[name="kido"]');
  const xuongSelect = document.querySelector('#addDataForm select[name="xuong"]');
  const column8ValueInput = document.getElementById('column8Value');

  if (kidoSelect && xuongSelect && column8ValueInput) {
    const kido = kidoSelect.value;
    const xuong = xuongSelect.value;

    // Get the first Loại dropdown value
    const firstLoaiDropdown = document.querySelector('.loai-dropdown-selected');
    const loaiValue = firstLoaiDropdown ? firstLoaiDropdown.dataset.value : '';

    const parts = [kido, xuong, loaiValue].filter(part => part !== '');
    column8ValueInput.value = parts.join('_');
  }
}

// Update column 8 value for edit modal (Kì đổ_Xưởng_Loại phế liệu)
function updateEditColumn8Value() {
  const kidoSelect = document.querySelector('#editDataForm select[name="kido"]');
  const xuongSelect = document.querySelector('#editDataForm select[name="xuong"]');
  const column8ValueInput = document.getElementById('editColumn8Value');

  if (kidoSelect && xuongSelect && column8ValueInput) {
    const kido = kidoSelect.value;
    const xuong = xuongSelect.value;

    // Get the first Loại dropdown value
    const firstLoaiDropdown = document.querySelector('#editLoaiTableBody .loai-dropdown-selected');
    const loaiValue = firstLoaiDropdown ? firstLoaiDropdown.dataset.value : '';

    const parts = [kido, xuong, loaiValue].filter(part => part !== '');
    column8ValueInput.value = parts.join('_');
  }
}

// Test Apps Script connection - gọi từ console: testAppsScript()
window.testAppsScript = async function () {
  console.log('Testing Apps Script connection...');
  console.log('URL:', APPS_SCRIPT_URL);
  try {
    const response = await fetch(APPS_SCRIPT_URL);
    const text = await response.text();
    console.log('Apps Script response:', text);
    alert('Kết nối thành công! Xem console để biết chi tiết.');
    return text;
  } catch (error) {
    console.error('Lỗi kết nối:', error);
    alert('Lỗi kết nối: ' + error.message);
    return null;
  }
};

// Start the app
initApp();

