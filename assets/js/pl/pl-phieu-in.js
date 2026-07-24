/* =============================================================================
   PL-PHIEU-IN.JS
   JavaScript for Phiếu In page
================================================================================ */

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

// Google Sheet configuration
const SHEET_ID = '1iGS7srFqOvP44NATaR26lOQEtCQIsjKFU9PG-TQ1otE';
const SHEET_GID = '0';  // gid của sheet đầu tiên (main sheet)

// URL để tải file .xlsx (sheet data)
const XLSX_DATA_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID}`;

// URL export phiếu in (để in phiếu)
// Sheet phieu-in có gid = 862703781
const PHIEU_IN_SHEET_GID = '862703781';
const XLSX_PHIEU_IN_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${PHIEU_IN_SHEET_GID}`;

// URL export phiếu in (sheet phieu-in - cần tạo Apps Script riêng)
// const PHIEU_IN_SHEET_GID = '0';  // gid của sheet phieu-in (khi đã tạo)
// const XLSX_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${PHIEU_IN_SHEET_GID}`;

// ==================== PAGINATION CONFIG ====================
const ROWS_PER_PAGE = 100; // Số dòng hiển thị mỗi trang
// ============================================================

// Apps Script URL cho việc ghi dữ liệu vào Google Sheets
// Cần tạo Google Apps Script để write vào các ô cụ thể
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxyBbVr8UmPEX9bCdO-65N4GxnqJQ0MZJZdg15C7sXzAM7pkMFWxXKgc_k8O4rDZObEcQ/exec'; // Điền URL Apps Script sau khi deploy

// =============================================================================
// LOCAL STORAGE KEYS
// =============================================================================

const LOCAL_STORAGE_MAT_HANG_KEY = 'pl_mat_hang_list';

// Sheet name for mat hang list (dropdown items)
const MAT_HANG_SHEET_NAME = 'them-dropdown';

// Default mat hang list
const DEFAULT_MAT_HANG_LIST = [
  { name: 'Phế liệu Rulo trắng', unit: 'KG', code: 'RLT' },
  { name: 'Phế liệu giấy', unit: 'KG', code: 'PAPER' },
  { name: 'Phế liệu sỉ cắt', unit: 'KG', code: 'CUT' },
  { name: 'Phế liệu sỉ đất', unit: 'KG', code: 'SOIL' }
];

/**
 * Load matHangList from localStorage
 * @returns {Array} Array of mat hang items
 */
function loadMatHangFromStorage() {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_MAT_HANG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading matHangList from localStorage:', e);
  }
  return [...DEFAULT_MAT_HANG_LIST];
}

/**
 * Save matHangList to localStorage
 * @param {Array} list - Array of mat hang items to save
 */
function saveMatHangToStorage(list) {
  try {
    localStorage.setItem(LOCAL_STORAGE_MAT_HANG_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving matHangList to localStorage:', e);
  }
}

/**
 * Fetch mat hang list from Supabase
 */
async function fetchMatHangList() {
  if (isSyncingMatHang) return matHangList;

  try {
    isSyncingMatHang = true;
    updateSyncStatus('Đang đồng bộ...', 'syncing');

    const { data, error } = await supabase
      .from('pl-mathang')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    let fetchedItems = (data || []).map(row => ({
      name: row.name || '',
      unit: row.unit || '',
      code: row.code || ''
    }));

    if (fetchedItems.length === 0) {
      // If table is empty, insert default list to Supabase
      const { data: inserted, error: insertError } = await supabase
        .from('pl-mathang')
        .insert(DEFAULT_MAT_HANG_LIST)
        .select();

      if (!insertError && inserted) {
        fetchedItems = inserted.map(row => ({
          name: row.name || '',
          unit: row.unit || '',
          code: row.code || ''
        }));
      } else {
        fetchedItems = [...DEFAULT_MAT_HANG_LIST];
      }
    }

    const hasChanged = JSON.stringify(fetchedItems) !== JSON.stringify(matHangList);
    if (hasChanged) {
      matHangList = fetchedItems;
      saveMatHangToStorage(matHangList);
      refreshAllDropdowns();
    }

    lastMatHangSyncTime = Date.now();
    updateSyncStatus('Đã đồng bộ', 'success');
    return matHangList;

  } catch (e) {
    console.error('Error fetching matHangList from Supabase:', e);
    updateSyncStatus(e.message || 'Lỗi đồng bộ', 'error');
    return matHangList;
  } finally {
    isSyncingMatHang = false;
    setTimeout(() => updateSyncStatus('', 'none'), 3000);
  }
}

/**
 * Add new mat hang object to backend
 * @param {Object} itemData - { name, unit, code }
 */
async function addMatHangToBackend(itemData) {
  try {
    showLoadingOverlay(`Đang thêm mặt hàng: ${itemData.name}...`);

    const { data, error } = await supabase
      .from('pl-mathang')
      .insert([
        {
          name: itemData.name,
          unit: itemData.unit,
          code: itemData.code,
          note: itemData.note || ''
        }
      ])
      .select();

    if (error) throw error;

    const exists = matHangList.some(i => i.name === itemData.name);
    if (!exists) {
      matHangList.push(itemData);
    }

    saveMatHangToStorage(matHangList);
    refreshAllDropdowns();
    return true;
  } catch (e) {
    console.error('Error adding matHang to Supabase:', e);
    alert(e.message || 'Lỗi thêm mặt hàng');
    return false;
  } finally {
    hideLoadingOverlay();
  }
}

function refreshAllDropdowns() {
  document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
    const id = dropdown.dataset.dropdownId;
    // We recreate the items list in the specific dropdown instance
    // Each dropdown will handle its own rendering of items based on matHangList
    const itemsContainer = dropdown.querySelector('.custom-dropdown-items');
    if (!itemsContainer) return;

    // We can't easily trigger the internal state of createCustomDropdown's closure,
    // so we'll just re-render the first page of items
    const visibleItems = matHangList.slice(0, 20);
    renderDropdownItems(itemsContainer, visibleItems);

    console.log(`Refreshed dropdown ${id} with ${matHangList.length} total items`);
  });
}

/**
 * Render items in dropdown container
 */
function renderDropdownItems(container, items) {
  let html = '';
  items.forEach(item => {
    const displayName = typeof item === 'string' ? item : item.name;
    const itemCode = item.code ? `<span class="item-code">${item.code}</span>` : '';
    const itemUnit = item.unit ? `<span class="item-unit">${item.unit}</span>` : '';

    html += `
      <div class="custom-dropdown-item" data-value="${displayName}" data-unit="${item.unit || ''}">
        <div class="item-info">
          <span class="item-name">${displayName}</span>
          ${itemCode}
        </div>
        ${itemUnit}
      </div>
    `;
  });

  if (items.length === 0) {
    html = '<div class="custom-dropdown-item no-results">Không tìm thấy kết quả</div>';
  }

  container.innerHTML = html;
}

/**
 * Update sync status indicator
 */
function updateSyncStatus(message, type) {
  let statusEl = document.getElementById('matHangSyncStatus');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'matHangSyncStatus';
    statusEl.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      transition: all 0.3s ease;
      display: none;
    `;
    document.body.appendChild(statusEl);
  }

  if (type === 'none' || !message) {
    statusEl.style.display = 'none';
    return;
  }

  statusEl.textContent = message;
  statusEl.style.display = 'block';

  if (type === 'syncing') {
    statusEl.style.backgroundColor = '#e3f2fd';
    statusEl.style.color = '#1976d2';
    statusEl.style.border = '1px solid #bbdefb';
  } else if (type === 'success') {
    statusEl.style.backgroundColor = '#e8f5e9';
    statusEl.style.color = '#2e7d32';
    statusEl.style.border = '1px solid #c8e6c9';
  } else if (type === 'error') {
    statusEl.style.backgroundColor = '#ffebee';
    statusEl.style.color = '#c62828';
    statusEl.style.border = '1px solid #ffcdd2';
  }
}

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

let tableData = [];  // Lưu dữ liệu từ Google Sheet/Supabase
let rawSupabaseData = []; // Lưu mảng đối tượng gốc từ Supabase
let currentPage = 1;
let totalPages = 1;
let filteredData = [];         // dữ liệu sau khi lọc (chưa phân trang)
let displayedData = [];        // dữ liệu đang hiển thị (trang hiện tại)

// Selected row management for edit/delete
let selectedRowIndex = -1;
let selectedRowIndexes = [];

// Edit hang hoa row counter
let editRollCount = 0;

// Custom dropdown counter for unique IDs
let matHangDropdownCounter = 0;
let editMatHangDropdownCounter = 0;

// Custom dropdown data for Mặt hàng (load from localStorage initially, then sync)
let matHangList = loadMatHangFromStorage();
let isSyncingMatHang = false;
let lastMatHangSyncTime = 0;
const SYNC_INTERVAL_MS = 30000; // 30 seconds

// Start synchronization
fetchMatHangList();
setInterval(fetchMatHangList, SYNC_INTERVAL_MS);

// =============================================================================
// PHIẾU IN SEARCH FUNCTIONALITY
// =============================================================================

// Store selected phieu from search
let selectedPhieuFromSearch = null;

/**
 * Initialize the phieu search functionality
 */
function initPhieuSearch() {
  const searchInput = document.getElementById('phieuSearchInput');
  const clearBtn = document.getElementById('btnClearPhieuSearch');
  const resultsContainer = document.getElementById('phieuSearchResults');
  const statusContainer = document.getElementById('phieuSearchStatus');

  if (!searchInput) return;

  // Search input event - debounced search
  let searchTimeout = null;
  searchInput.addEventListener('input', function () {
    const searchTerm = this.value.trim();

    // Show/hide clear button
    if (searchTerm.length > 0) {
      clearBtn.classList.add('show');
    } else {
      clearBtn.classList.remove('show');
    }

    // Clear previous selection when typing new search
    if (selectedPhieuFromSearch) {
      selectedPhieuFromSearch = null;
      updateSelectedPhieuDisplay();
    }

    // Debounce search
    clearTimeout(searchTimeout);
    if (searchTerm.length < 2) {
      resultsContainer.classList.remove('show');
      statusContainer.classList.remove('show');
      return;
    }

    statusContainer.innerHTML = '<span class="phieu-search-loading">Đang tìm kiếm...</span>';
    statusContainer.classList.add('show');
    resultsContainer.classList.remove('show');

    searchTimeout = setTimeout(() => {
      searchPhieuIn(searchTerm);
    }, 300);
  });

  // Clear button click
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      searchInput.value = '';
      clearBtn.classList.remove('show');
      resultsContainer.classList.remove('show');
      statusContainer.classList.remove('show');
      selectedPhieuFromSearch = null;
      updateSelectedPhieuDisplay();
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.phieu-search-container')) {
      resultsContainer.classList.remove('show');
      statusContainer.classList.remove('show');
    }
  });

  // Focus search on keyboard shortcut (Ctrl+F when not in input)
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInput.focus();
      }
    }
  });
}

// Chuyển đổi ngày tháng từ Excel/sheet sang định dạng dd/mm/yyyy
function formatDate(dateValue) {
  if (!dateValue && dateValue !== 0) return '';

  let date = null;

  if (typeof dateValue === 'number') {
    if (dateValue > 0 && dateValue < 100000) {
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } else {
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
  if (typeof raw === 'number') {
    if (raw > 0) return new Date((raw - 25569) * 86400 * 1000);
    return null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    let parts = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (parts) {
      const d = parseInt(parts[1], 10);
      const m = parseInt(parts[2], 10) - 1;
      const y = parseInt(parts[3], 10);
      return new Date(y, m, d);
    }
    parts = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (parts) {
      const y = parseInt(parts[1], 10);
      const m = parseInt(parts[2], 10) - 1;
      const d = parseInt(parts[3], 10);
      return new Date(y, m, d);
    }
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  return null;
}

// Helper to parse Vietnamese formatted float strings
function parseVietnameseFloat(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  let text = value.toString().trim().replace(/\s+/g, '');
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
  return isNaN(num) ? 0 : num;
}

// Format number with thousand separators (dot) and decimal (comma)
function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '';
  const parsed = parseVietnameseFloat(num);
  if (parsed === 0 && (num === 0 || num === '0' || num === 0.0)) return '0';
  if (parsed === 0) return num; // Return original if parsing failed or was 0 (and original wasn't 0)
  return parsed.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

/**
 * Search for phieu in data
 * @param {string} searchTerm - The search term
 */
function searchPhieuIn(searchTerm) {
  const resultsContainer = document.getElementById('phieuSearchResults');
  const statusContainer = document.getElementById('phieuSearchStatus');

  if (tableData.length < 2) {
    statusContainer.innerHTML = 'Không có dữ liệu phiếu in. Vui lòng chờ tải dữ liệu.';
    statusContainer.className = 'phieu-search-status show error';
    return;
  }

  const headerRow = tableData[0];

  // Find column indexes
  const findColIndex = (keywords) => {
    return headerRow.findIndex(h => {
      if (!h) return false;
      const headerLower = String(h).trim().toLowerCase();
      return keywords.some(kw => headerLower.includes(kw.toLowerCase()));
    });
  };

  const soPhieuIdx = findColIndex(['số phiếu', 'sophieu', 'so phieu']);
  const soXeIdx = findColIndex(['số xe', 'soxe', 'so xe']);
  const ngayIdx = findColIndex(['ngày', 'ngay', 'date']);
  const benNhanIdx = findColIndex(['bên nhận', 'benhan', 'ben nhan', 'xưởng', 'xuong', 'đội', 'doi']);
  const loaiXuatIdx = findColIndex(['loại xuất', 'loaixuat', 'loai xuat']);
  const benGiaoIdx = findColIndex(['bên giao', 'bengiao', 'ben giao']);
  const matHangIdx = findColIndex(['mặt hàng', 'mathang', 'mat hang', 'tên hàng', 'ten hang']);
  const dvtIdx = findColIndex(['đvt', 'dvt', 'đơn vị', 'don vi', 'đơn vị tính']);
  const trongLuongIdx = findColIndex(['trọng lượng', 'trong luong', 'khối lượng']);
  const maCongTrinhIdx = findColIndex(['mã công trình', 'macongtrinh', 'ma cong trinh']);
  const tenCongTrinhIdx = findColIndex(['tên công trình', 'tencongtrinh', 'ten cong trinh']);

  if (soPhieuIdx < 0) {
    statusContainer.innerHTML = 'Lỗi: Không tìm thấy cột số phiếu trong dữ liệu.';
    statusContainer.className = 'phieu-search-status show error';
    return;
  }

  // Search in tableData - find all rows that match and group by số phiếu
  const normalizedSearch = searchTerm.toLowerCase().trim();
  const foundPhieuMap = new Map(); // Map to group by số phiếu

  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    if (!row || row.length === 0) continue;

    const soPhieu = String(row[soPhieuIdx] || '').trim();
    const soXe = soXeIdx >= 0 ? String(row[soXeIdx] || '').trim() : '';
    const rawNgay = ngayIdx >= 0 ? row[ngayIdx] : '';
    const ngay = formatDate(rawNgay);
    const benNhan = benNhanIdx >= 0 ? String(row[benNhanIdx] || '').trim() : '';
    const loaiXuat = loaiXuatIdx >= 0 ? String(row[loaiXuatIdx] || '').trim() : '';
    const benGiao = benGiaoIdx >= 0 ? String(row[benGiaoIdx] || '').trim() : '';
    const matHang = matHangIdx >= 0 ? String(row[matHangIdx] || '').trim() : '';
    const dvt = dvtIdx >= 0 ? String(row[dvtIdx] || '').trim() : '';
    const trongLuong = trongLuongIdx >= 0 ? String(row[trongLuongIdx] || '').trim() : '';
    const maCongTrinh = maCongTrinhIdx >= 0 ? String(row[maCongTrinhIdx] || '').trim() : '';
    const tenCongTrinh = tenCongTrinhIdx >= 0 ? String(row[tenCongTrinhIdx] || '').trim() : '';

    // Check if search term matches any field
    const searchMatch =
      soPhieu.toLowerCase().includes(normalizedSearch) ||
      soXe.toLowerCase().includes(normalizedSearch) ||
      benNhan.toLowerCase().includes(normalizedSearch) ||
      loaiXuat.toLowerCase().includes(normalizedSearch) ||
      maCongTrinh.toLowerCase().includes(normalizedSearch) ||
      tenCongTrinh.toLowerCase().includes(normalizedSearch);

    if (searchMatch && soPhieu) {
      // Group by số phiếu
      if (!foundPhieuMap.has(soPhieu)) {
        foundPhieuMap.set(soPhieu, {
          rowIndexes: [],
          soPhieu: soPhieu,
          soXe: soXe,
          ngay: ngay,
          benNhan: benNhan,
          loaiXuat: loaiXuat,
          benGiao: benGiao,
          maCongTrinh: maCongTrinh,
          tenCongTrinh: tenCongTrinh,
          hangHoa: []
        });
      }

      const phieuData = foundPhieuMap.get(soPhieu);
      phieuData.rowIndexes.push(i);

      // Add item to hangHoa array if it has item data
      if (matHang || dvt || trongLuong) {
        phieuData.hangHoa.push({
          matHang: matHang,
          dvt: dvt,
          trongLuong: trongLuong
        });
      }
    }
  }

  // Convert map to array
  const foundPhieu = Array.from(foundPhieuMap.values());

  // Hide status, show results
  statusContainer.classList.remove('show');

  if (foundPhieu.length === 0) {
    statusContainer.innerHTML = 'Không tìm thấy phiếu in nào phù hợp với từ khóa: "' + searchTerm + '"';
    statusContainer.className = 'phieu-search-status show no-results';
    resultsContainer.classList.remove('show');
    return;
  }

  // Render results
  renderPhieuSearchResults(foundPhieu);
}

/**
 * Render search results in dropdown
 * @param {Array} results - Array of found phieu objects (grouped by số phiếu)
 */
function renderPhieuSearchResults(results) {
  const resultsContainer = document.getElementById('phieuSearchResults');

  let html = '';
  results.forEach((phieu, index) => {
    const itemCount = phieu.hangHoa ? phieu.hangHoa.length : 0;
    const itemCountText = itemCount > 0 ? ` (${itemCount} mặt hàng)` : '';

    html += `
      <div class="phieu-search-item" data-index="${index}" data-so-phieu="${phieu.soPhieu}">
        <div class="phieu-so-phieu">${phieu.soPhieu}${itemCountText}</div>
        <div class="phieu-info">
          ${phieu.soXe ? 'Xe: ' + phieu.soXe + ' | ' : ''}
          ${phieu.benNhan ? 'Bên nhận: ' + phieu.benNhan + ' | ' : ''}
          ${phieu.loaiXuat ? 'Loại: ' + phieu.loaiXuat : ''}
          ${phieu.ngay ? ' | Ngày: ' + phieu.ngay : ''}
        </div>
      </div>
    `;
  });

  resultsContainer.innerHTML = html;
  resultsContainer.classList.add('show');

  // Add click handlers
  resultsContainer.querySelectorAll('.phieu-search-item').forEach(item => {
    item.addEventListener('click', function () {
      const soPhieu = this.dataset.soPhieu;
      selectPhieuFromSearch(soPhieu);
    });
  });
}

/**
 * Select a phieu from search results by số phiếu
 * This will collect ALL items from all rows with the same số phiếu
 * @param {string} soPhieu - The receipt number
 */
function selectPhieuFromSearch(soPhieu) {
  if (!soPhieu || tableData.length < 2) return;

  const headerRow = tableData[0];

  const findColIndex = (keywords) => {
    return headerRow.findIndex(h => {
      if (!h) return false;
      const headerLower = String(h).trim().toLowerCase();
      return keywords.some(kw => headerLower.includes(kw.toLowerCase()));
    });
  };

  const soPhieuIdx = findColIndex(['số phiếu', 'sophieu', 'so phieu']);
  const soXeIdx = findColIndex(['số xe', 'soxe', 'so xe']);
  const ngayIdx = findColIndex(['ngày', 'ngay', 'date']);
  const benNhanIdx = findColIndex(['bên nhận', 'benhan', 'ben nhan', 'xưởng', 'xuong', 'đội', 'doi']);
  const loaiXuatIdx = findColIndex(['loại xuất', 'loaixuat', 'loai xuat']);
  const benGiaoIdx = findColIndex(['bên giao', 'bengiao', 'ben giao']);
  const matHangIdx = findColIndex(['mặt hàng', 'mathang', 'mat hang', 'tên hàng', 'ten hang']);
  const dvtIdx = findColIndex(['đvt', 'dvt', 'đơn vị', 'don vi', 'đơn vị tính']);
  const trongLuongIdx = findColIndex(['trọng lượng', 'trong luong', 'khối lượng']);
  const maCongTrinhIdx = findColIndex(['mã công trình', 'macongtrinh', 'ma cong trinh']);
  const tenCongTrinhIdx = findColIndex(['tên công trình', 'tencongtrinh', 'ten cong trinh']);

  // Find all rows with the same số phiếu
  const normalizedSoPhieu = String(soPhieu).trim().toLowerCase();
  let firstRowData = null;
  const allHangHoa = [];

  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    if (!row || row.length === 0) continue;

    const rowSoPhieu = String(row[soPhieuIdx] || '').trim();
    if (rowSoPhieu.toLowerCase() === normalizedSoPhieu) {
      // Store first row for header info
      if (!firstRowData) {
        firstRowData = {
          soXe: soXeIdx >= 0 ? String(row[soXeIdx] || '') : '',
          ngay: ngayIdx >= 0 ? String(row[ngayIdx] || '') : '',
          benNhan: benNhanIdx >= 0 ? String(row[benNhanIdx] || '') : '',
          loaiXuat: loaiXuatIdx >= 0 ? String(row[loaiXuatIdx] || '') : '',
          benGiao: benGiaoIdx >= 0 ? String(row[benGiaoIdx] || '') : '',
          maCongTrinh: maCongTrinhIdx >= 0 ? String(row[maCongTrinhIdx] || '') : '',
          tenCongTrinh: tenCongTrinhIdx >= 0 ? String(row[tenCongTrinhIdx] || '') : ''
        };
      }

      // Collect all items (matHang, dvt, trongLuong)
      const matHang = matHangIdx >= 0 ? String(row[matHangIdx] || '').trim() : '';
      const dvt = dvtIdx >= 0 ? String(row[dvtIdx] || '').trim() : '';
      const trongLuong = trongLuongIdx >= 0 ? String(row[trongLuongIdx] || '').trim() : '';

      // Only add if there's item data
      if (matHang || dvt || trongLuong) {
        allHangHoa.push({
          matHang: matHang,
          dvt: dvt,
          trongLuong: trongLuong
        });
      }
    }
  }

  if (!firstRowData) return;

  // Store selected phieu with ALL items
  selectedPhieuFromSearch = {
    soPhieu: soPhieu,
    soXe: firstRowData.soXe,
    ngay: firstRowData.ngay,
    benNhan: firstRowData.benNhan,
    loaiXuat: firstRowData.loaiXuat,
    benGiao: firstRowData.benGiao,
    maCongTrinh: firstRowData.maCongTrinh,
    tenCongTrinh: firstRowData.tenCongTrinh,
    hangHoa: allHangHoa
  };

  // Update UI
  const searchInput = document.getElementById('phieuSearchInput');
  const clearBtn = document.getElementById('btnClearPhieuSearch');
  const resultsContainer = document.getElementById('phieuSearchResults');
  const statusContainer = document.getElementById('phieuSearchStatus');

  searchInput.value = selectedPhieuFromSearch.soPhieu;
  clearBtn.classList.add('show');
  resultsContainer.classList.remove('show');
  statusContainer.classList.remove('show');

  console.log('Đã chọn phiếu:', selectedPhieuFromSearch.soPhieu, 'với', allHangHoa.length, 'mặt hàng');

  updateSelectedPhieuDisplay();
}

/**
 * Update the display to show selected phieu
 */
function updateSelectedPhieuDisplay() {
  const searchInput = document.getElementById('phieuSearchInput');
  if (!searchInput) return;

  if (selectedPhieuFromSearch) {
    const itemCount = selectedPhieuFromSearch.hangHoa ? selectedPhieuFromSearch.hangHoa.length : 0;
    const itemText = itemCount > 0 ? ` - ${itemCount} mặt hàng` : '';
    searchInput.placeholder = 'Đã chọn: ' + selectedPhieuFromSearch.soPhieu + itemText + ' - Click Tạo phiếu in để in';
    searchInput.classList.add('phieu-selected');
  } else {
    searchInput.placeholder = 'Tìm phiếu in...';
    searchInput.classList.remove('phieu-selected');
  }
}

/**
 * Print selected phieu directly
 */
function printSelectedPhieu() {
  if (!selectedPhieuFromSearch) return;

  // Format form data for printing
  const formData = {
    soPhieu: selectedPhieuFromSearch.soPhieu,
    soXe: selectedPhieuFromSearch.soXe,
    ngay: selectedPhieuFromSearch.ngay,
    benNhan: selectedPhieuFromSearch.benNhan,
    loaiXuat: selectedPhieuFromSearch.loaiXuat,
    benGiao: selectedPhieuFromSearch.benGiao,
    maCongTrinh: selectedPhieuFromSearch.maCongTrinh,
    tenCongTrinh: selectedPhieuFromSearch.tenCongTrinh,
    hangHoa: selectedPhieuFromSearch.hangHoa
  };

  // Open form-in.html and send data
  const formInWindow = window.open('form-in.html?autoPrint=true', '_blank');

  if (formInWindow) {
    formInWindow.addEventListener('load', function () {
      formInWindow.postMessage({ type: 'phieuInData', payload: formData }, '*');
    });

    if (formInWindow.document.readyState === 'complete') {
      formInWindow.postMessage({ type: 'phieuInData', payload: formData }, '*');
    }
  }

  // Optional: Clear selection after printing
  // Uncomment below if you want to clear selection after print
  // clearSelectedPhieu();
}

/**
 * Clear the selected phieu
 */
function clearSelectedPhieu() {
  selectedPhieuFromSearch = null;

  const searchInput = document.getElementById('phieuSearchInput');
  const clearBtn = document.getElementById('btnClearPhieuSearch');

  if (searchInput) {
    searchInput.value = '';
  }
  if (clearBtn) {
    clearBtn.classList.remove('show');
  }

  updateSelectedPhieuDisplay();
}

// =============================================================================
// CUSTOM DROPDOWN WITH SEARCH - For Mặt hàng selection
// =============================================================================

function createCustomDropdown(id, items, placeholder = 'Chọn...', onChange = null) {
  const container = document.createElement('div');
  container.className = 'custom-dropdown';
  container.dataset.dropdownId = id;

  const ITEMS_PER_PAGE = 20;
  let currentPage = 1;
  let currentFilteredItems = [...matHangList];

  const inputId = `dropdown-input-${id}`;
  const menuId = `dropdown-menu-${id}`;
  const searchId = `dropdown-search-${id}`;

  container.innerHTML = `
    <input type="text" 
           class="custom-dropdown-input" 
           id="${inputId}" 
           placeholder="${placeholder}" 
           readonly 
           data-dropdown-id="${id}">
    <span class="custom-dropdown-arrow">▼</span>
    <div class="custom-dropdown-menu" id="${menuId}" data-dropdown-id="${id}">
      <div class="custom-dropdown-search">
        <input type="text" 
               id="${searchId}" 
               placeholder="Tìm theo tên hoặc mã..." 
               autocomplete="off">
      </div>
      <div class="custom-dropdown-items">
        <!-- Items loaded dynamically -->
      </div>
      <div class="custom-dropdown-actions">
        <button type="button" class="btn-refresh-mat-hang" title="Cập nhật danh mục từ máy chủ">
          🔄 Làm mới
        </button>
        <button type="button" class="btn-add-new-item" data-bs-toggle="modal" data-bs-target="#addMatHangFullModal">
          + Thêm mặt hàng mới
        </button>
      </div>
    </div>
    <input type="hidden" name="matHang[]" class="custom-dropdown-hidden" id="hidden-${id}" required>
  `;

  setTimeout(() => {
    const input = container.querySelector('.custom-dropdown-input');
    const menu = container.querySelector('.custom-dropdown-menu');
    const searchInput = container.querySelector('.custom-dropdown-search input');
    const itemsContainer = container.querySelector('.custom-dropdown-items');
    const hiddenInput = container.querySelector('.custom-dropdown-hidden');

    function updateItemsList(resetPage = true) {
      if (resetPage) {
        currentPage = 1;
        itemsContainer.scrollTop = 0;
      }

      const searchTerm = searchInput.value.toLowerCase().trim();
      currentFilteredItems = matHangList.filter(item => {
        const name = (item.name || '').toLowerCase();
        const code = (item.code || '').toLowerCase();
        return name.includes(searchTerm) || code.includes(searchTerm);
      });

      const displayItems = currentFilteredItems.slice(0, currentPage * ITEMS_PER_PAGE);
      renderDropdownItems(itemsContainer, displayItems);
    }

    // Initial render
    updateItemsList();

    // Toggle dropdown
    input.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = container.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) {
        container.classList.add('open');
        updateItemsList(); // Refresh list when opening
        setTimeout(() => searchInput.focus(), 50);
      }
    });

    // Search
    searchInput.addEventListener('input', () => updateItemsList());

    // Infinite scroll
    itemsContainer.addEventListener('scroll', () => {
      if (itemsContainer.scrollTop + itemsContainer.clientHeight >= itemsContainer.scrollHeight - 20) {
        if (currentPage * ITEMS_PER_PAGE < currentFilteredItems.length) {
          currentPage++;
          updateItemsList(false);
        }
      }
    });

    // Manual refresh
    const refreshBtn = container.querySelector('.btn-refresh-mat-hang');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        refreshBtn.classList.add('spinning');
        await fetchMatHangList();
        updateItemsList();
        setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
      });
    }

    // Selection
    itemsContainer.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.custom-dropdown-item');
      if (itemEl && !itemEl.classList.contains('no-results')) {
        const value = itemEl.dataset.value;
        const unit = itemEl.dataset.unit;

        input.value = value;
        hiddenInput.value = value;
        container.classList.remove('open');

        // Auto fill DVT if found and in the same row
        const row = container.closest('.row') || container.closest('tr');
        if (row && unit) {
          const dvtInput = row.querySelector('input[name="dvt[]"]');
          if (dvtInput) dvtInput.value = unit;
        }

        if (onChange) onChange(value);
      }
    });

    // Global click listener to close
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) container.classList.remove('open');
    });

    menu.addEventListener('click', e => e.stopPropagation());
  }, 0);

  return container;
}

/**
 * Close all custom dropdowns
 */
function closeAllDropdowns() {
  document.querySelectorAll('.custom-dropdown.open').forEach(dropdown => {
    dropdown.classList.remove('open');
  });
}

/**
 * Set dropdown value programmatically
 * @param {HTMLElement} dropdownContainer - The dropdown container
 * @param {string} value - The value to set
 */
function setDropdownValue(dropdownContainer, value) {
  const input = dropdownContainer.querySelector('.custom-dropdown-input');
  const hiddenInput = dropdownContainer.querySelector('.custom-dropdown-hidden');
  if (input && hiddenInput) {
    input.value = value;
    hiddenInput.value = value;
  }
}

/**
 * Disable dropdown
 * @param {HTMLElement} dropdownContainer - The dropdown container
 * @param {boolean} disabled - Whether to disable
 */
function setDropdownDisabled(dropdownContainer, disabled) {
  const input = dropdownContainer.querySelector('.custom-dropdown-input');
  if (input) {
    if (disabled) {
      input.classList.add('disabled');
      input.setAttribute('readonly', 'readonly');
      input.removeEventListener('click', null);
    } else {
      input.classList.remove('disabled');
      input.removeAttribute('readonly');
    }
  }
}

// =============================================================================
// LOADING OVERLAY FUNCTIONS
// =============================================================================

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

// =============================================================================
// DOM ELEMENTS
// =============================================================================

let form;
let hangHoaContainer;
let btnAddRow;
let successMessage;
let errorMessage;
let errorText;
let btnXemTruoc;

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', function () {
  // Kiểm tra xem đã đăng nhập chưa, nếu chưa thì quay về trang đăng nhập
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    window.location.href = '/pages/index.html';
    return;
  }

  // Hiển thị tên đăng nhập
  const usernameElement = document.getElementById('currentUsername');

  // Cache DOM elements
  form = document.getElementById('phieuInForm');
  hangHoaContainer = document.getElementById('hangHoaContainer');
  btnAddRow = document.getElementById('btnAddRow');
  successMessage = document.getElementById('successMessage');
  errorMessage = document.getElementById('errorMessage');
  errorText = document.getElementById('errorText');
  btnXemTruoc = document.getElementById('btnXemTruoc');

  // Initialize
  init();
});

// =============================================================================
// INITIALIZATION FUNCTIONS
// =============================================================================

/**
 * Initialize custom dropdowns for Mặt hàng in Add modal
 * This converts the static HTML row to use the custom dropdown
 * @param {boolean} forceRefresh - If true, will recreate dropdowns to refresh items from localStorage
 */
function initializeAddModalDropdowns(forceRefresh = false) {
  const container = document.getElementById('addHangHoaContainer');
  if (!container) return;

  // Check if already initialized (has custom-dropdown class)
  if (!forceRefresh && container.querySelector('.custom-dropdown')) {
    return; // Already initialized
  }

  // Get existing row if any
  const existingRow = container.querySelector('.add-hang-hoa-row');

  if (existingRow) {
    // Get any existing value from the input or dropdown
    let existingValue = '';
    const existingInput = existingRow.querySelector('input[name="matHang[]"]');
    const existingDropdown = existingRow.querySelector('.custom-dropdown');

    if (existingInput) {
      existingValue = existingInput.value;
    } else if (existingDropdown) {
      // Get value from existing dropdown
      const hiddenInput = existingDropdown.querySelector('input[type="hidden"]');
      if (hiddenInput) {
        existingValue = hiddenInput.value;
      }
    }

    // Generate unique ID
    matHangDropdownCounter++;
    const dropdownId = `matHang-${matHangDropdownCounter}`;

    // Replace the input with custom dropdown
    const matHangCol = existingRow.querySelector('.col-md-4');
    if (matHangCol) {
      matHangCol.innerHTML = '';
      const dropdown = createCustomDropdown(
        dropdownId,
        matHangList,
        'Chọn mặt hàng...',
        null
      );
      matHangCol.appendChild(dropdown);

      // Set existing value if any
      if (existingValue) {
        setTimeout(() => {
          setDropdownValue(dropdown, existingValue);
        }, 50);
      }
    }
  }
}

function init() {
  // Set ngày hiện tại
  const today = new Date().toISOString().split('T')[0];
  const ngayInput = document.getElementById('ngay');
  if (ngayInput) {
    ngayInput.value = today;
  }

  // Cập nhật nút xóa
  updateRemoveButtons();

  // Kiểm tra đăng nhập
  const currentUser = localStorage.getItem('currentUser');
  const usernameElement = document.getElementById('currentUsername');
  if (usernameElement && currentUser) {
    usernameElement.textContent = currentUser;
  }

  // Setup event listeners
  setupEventListeners();

  // Setup add data form
  setupAddDataForm();

  // Initialize custom dropdowns for Mặt hàng in Add modal
  initializeAddModalDropdowns();

  // Setup hamburger menu
  setupHamburgerMenu();

  // Setup logout
  setupLogout();

  // Initialize phieu search functionality
  initPhieuSearch();

  // Setup "Tạo phiếu in" button handler
  setupCreatePhieuButton();

  // Setup Add Mat Hang Full Form
  setupMatHangFullForm();

  // Tải dữ liệu từ Google Sheet
  loadGoogleSheet();
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

function setupEventListeners() {
  // Thêm dòng mới
  if (btnAddRow) {
    btnAddRow.addEventListener('click', function () {
      addHangHoaRow();
    });
  }

  // Xóa dòng (sử dụng event delegation)
  if (hangHoaContainer) {
    hangHoaContainer.addEventListener('click', function (e) {
      if (e.target.classList.contains('btn-remove-row')) {
        const rows = hangHoaContainer.querySelectorAll('.hang-hoa-row');
        if (rows.length > 1) {
          e.target.closest('.hang-hoa-row').remove();
          updateRemoveButtons();
        }
      }
    });
  }

  // Xóa tất cả nút xóa khi modal Tạo phiếu in được mở
  const phieuInModal = document.getElementById('phieuInModal');
  if (phieuInModal) {
    phieuInModal.addEventListener('shown.bs.modal', function () {
      // Clear the selected phieu when modal opens (so it creates new)
      // But keep the search input value for reference
      // User can search again if needed

      // Xóa trắng form khi mở modal
      document.getElementById('phieuInForm').reset();

      // Đặt ngày hôm nay
      const today = new Date().toISOString().split('T')[0];
      const ngayInput = document.getElementById('ngay');
      if (ngayInput) {
        ngayInput.value = today;
      }

      // Xóa các dòng hàng hóa thừa, chỉ giữ lại 1 dòng
      const hangHoaContainer = document.getElementById('hangHoaContainer');
      hangHoaContainer.innerHTML = `
        <div class="row hang-hoa-row">
          <div class="col-md-4">
            <div class="form-group">
              <label class="form-label">Mặt hàng</label>
              <input type="text" class="form-control mat-hang" name="matHang[]" required>
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label class="form-label">ĐVT</label>
              <input type="text" class="form-control dvt" name="dvt[]" required>
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label class="form-label">Trọng lượng</label>
              <input type="number" class="form-control trongLuong" name="trongLuong[]" step="0.1" required>
            </div>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <div class="form-group">
            </div>
          </div>
        </div>
      `;

      const removeButtons = hangHoaContainer.querySelectorAll('.btn-remove-row');
      removeButtons.forEach(btn => {
        btn.style.display = 'none';
      });

      // Đặt các trường về chế độ có thể chỉnh sửa
      setFieldsEditable();
    });
  }

  // Tự động điền Số phiếu khi modal Thêm dữ liệu được mở
  const addDataModal = document.getElementById('addDataModal');
  if (addDataModal) {
    addDataModal.addEventListener('shown.bs.modal', function () {
      // Đợi form được render xong
      setTimeout(() => {
        autoGenerateSoPhieu();
        // Reinitialize dropdowns to ensure latest matHangList from localStorage is loaded
        initializeAddModalDropdowns(true);
      }, 100);
    });
  }

  // Submit form
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      await submitToGoogleSheet();
    });
  }

  // Xem trước
  if (btnXemTruoc) {
    btnXemTruoc.addEventListener('click', function () {
      const formData = getFormData();
      showPreviewModal(formData);
    });
  }

  // Tự động điền form khi nhập số phiếu
  const soPhieuInput = document.getElementById('soPhieu');
  if (soPhieuInput) {
    soPhieuInput.addEventListener('input', function () {
      const soPhieuValue = this.value.trim();
      if (soPhieuValue) {
        fillFormBySoPhieu(soPhieuValue);
      } else {
        // Khi xóa số phiếu, cho phép chỉnh sửa các trường khác
        setFieldsEditable();
      }
    });

    // Cũng hỗ trợ sự kiện change để bắt khi người dùng chọn từ dropdown
    soPhieuInput.addEventListener('change', function () {
      const soPhieuValue = this.value.trim();
      if (soPhieuValue) {
        fillFormBySoPhieu(soPhieuValue);
      } else {
        // Khi xóa số phiếu, cho phép chỉnh sửa các trường khác
        setFieldsEditable();
      }
    });
  }

  // Pagination event listeners
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const pageSelect = document.getElementById('pageSelect');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', function () {
      if (currentPage > 1) {
        currentPage--;
        renderTable(filteredData, false);
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', function () {
      if (currentPage < totalPages) {
        currentPage++;
        renderTable(filteredData, false);
      }
    });
  }

  if (pageSelect) {
    pageSelect.addEventListener('change', function () {
      currentPage = parseInt(this.value, 10);
      renderTable(filteredData, false);
    });
  }

  // Reset filter button
  const btnResetFilter = document.getElementById('btnResetFilter');
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', function () {
      clearSelectedPhieu();
      renderTable(tableData, true);
    });
  }

  // Edit data button
  const btnEditData = document.getElementById('btnEditData');
  if (btnEditData) {
    btnEditData.addEventListener('click', function () {
      openEditDataModal();
    });
  }

  // Delete data button
  const btnDeleteData = document.getElementById('btnDeleteData');
  if (btnDeleteData) {
    btnDeleteData.addEventListener('click', function () {
      openDeleteDataModal();
    });
  }

  // Confirm delete button
  const btnConfirmDelete = document.getElementById('btnConfirmDelete');
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', function () {
      confirmDelete();
    });
  }

  // Edit data form submit
  const editDataForm = document.getElementById('editDataForm');
  if (editDataForm) {
    editDataForm.addEventListener('submit', function (e) {
      handleEditFormSubmit(e);
    });
  }
}

function setupHamburgerMenu() {
  const dropdown5S = document.getElementById('5SDropdown');
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');

  if (hamburger && mainNav) {
    hamburger.addEventListener('click', function () {
      // mainNav.classList.toggle('active');
      // hamburger.classList.toggle('active');
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
}

/**
 * Setup the "Tạo phiếu in" button to check for pre-selected phieu
 */
function setupCreatePhieuButton() {
  const btnCreatePhieu = document.getElementById('btnCreatePhieu');

  if (!btnCreatePhieu) return;

  btnCreatePhieu.addEventListener('click', function (e) {
    // Check if there's a pre-selected phieu from search
    if (selectedPhieuFromSearch) {
      e.preventDefault();
      e.stopPropagation();

      // Print the selected phieu immediately
      printSelectedPhieu();

      return false;
    }
    // If no pre-selected phieu, let the default modal behavior happen
  });
}

function setupLogout() {
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function () {
      localStorage.removeItem('currentUser');
      window.location.href = '/pages/index.html';
    });
  }

  // Logo click to go home
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', function () {
      window.location.href = '/pages/home.html';
    });
  }
}

// =============================================================================
// ADD DATA FORM FUNCTIONS
// =============================================================================

let sheetHeaders = [];  // Lưu header của sheet

/**
 * Setup the Add Mat Hang Full Form handler
 */
function setupMatHangFullForm() {
  const form = document.getElementById('addMatHangFullForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const nameValue = document.getElementById('newMatHangName').value.trim();
    const unitValue = document.getElementById('newMatHangUnit').value.trim();
    const codeValue = document.getElementById('newMatHangCode').value.trim();
    const noteValue = document.getElementById('newMatHangNote').value.trim();

    if (!nameValue) {
      alert('Vui lòng nhập tên mặt hàng');
      return;
    }

    const itemData = {
      name: nameValue,
      unit: unitValue,
      code: codeValue,
      note: noteValue
    };

    const success = await addMatHangToBackend(itemData);

    if (success) {
      // Close modal
      const modalElement = document.getElementById('addMatHangFullModal');
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) modal.hide();

      // Reset form
      form.reset();

      // Refresh data
      await fetchMatHangList();
    }
  });
}

function setupAddDataForm() {
  // Handle add row button in modal
  const btnAddRowModal = document.getElementById('btnAddRowModal');
  if (btnAddRowModal) {
    btnAddRowModal.addEventListener('click', function () {
      addHangHoaRowToModal();
    });
  }

  // Handle remove row in modal (event delegation)
  const addHangHoaContainer = document.getElementById('addHangHoaContainer');
  if (addHangHoaContainer) {
    addHangHoaContainer.addEventListener('click', function (e) {
      if (e.target.classList.contains('btn-remove-add-row')) {
        const rows = addHangHoaContainer.querySelectorAll('.add-hang-hoa-row');
        if (rows.length > 1) {
          e.target.closest('.add-hang-hoa-row').remove();
          updateRemoveButtonsModal();
        }
      }
    });
  }

  // Handle form submit
  const addDataForm = document.getElementById('addDataForm');
  if (addDataForm) {
    addDataForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      await submitAddData();
    });
  }

  // Update remove buttons initially
  updateRemoveButtonsModal();
}

// Tạo form fields động dựa trên header của Google Sheet
function renderAddDataForm() {
  if (tableData.length < 1) return;

  const headerRow = tableData[0];
  sheetHeaders = headerRow;

  const mainFieldsContainer = document.getElementById('addDataMainFields');
  if (!mainFieldsContainer) return;

  let html = '<div class="row">';

  // Tạo các trường dựa trên header (giả định 4 cột đầu là thông tin chính)
  const mainFieldCount = Math.min(4, headerRow.length);
  for (let i = 0; i < mainFieldCount; i++) {
    const header = headerRow[i] || `Cột ${i + 1}`;
    const headerLower = String(header).toLowerCase();
    const fieldName = `col_${i}`;

    // Xác định loại input dựa trên tên cột
    let inputType = 'text';

    const isOptional = headerLower.includes('loại xuất') || headerLower.includes('mã công trình') || headerLower.includes('tên công trình');

    if (headerLower.includes('ngày') || headerLower.includes('date')) {
      inputType = 'date';
      const today = new Date().toISOString().split('T')[0];
      html += `
        <div class="col-md-6">
          <div class="mb-3">
            <label for="${fieldName}" class="form-label">${header} <span class="text-danger">*</span></label>
            <input type="${inputType}" class="form-control" id="${fieldName}" name="${fieldName}" value="${today}" required>
          </div>
        </div>
      `;
    } else if (headerLower.includes('trọng lượng') || headerLower.includes('khối lượng') || headerLower.includes('số lượng')) {
      inputType = 'number';
      html += `
        <div class="col-md-6">
          <div class="mb-3">
            <label for="${fieldName}" class="form-label">${header} ${isOptional ? '' : '<span class="text-danger">*</span>'}</label>
            <input type="${inputType}" class="form-control" id="${fieldName}" name="${fieldName}" step="0.01" ${isOptional ? '' : 'required'}>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="col-md-6">
          <div class="mb-3">
            <label for="${fieldName}" class="form-label">${header} ${isOptional ? '' : '<span class="text-danger">*</span>'}</label>
            <input type="${inputType}" class="form-control" id="${fieldName}" name="${fieldName}" ${isOptional ? '' : 'required'}>
          </div>
        </div>
      `;
    }
  }

  html += '</div>';
  mainFieldsContainer.innerHTML = html;
}

// Tự động điền Số phiếu theo định dạng YYMM-XX
function autoGenerateSoPhieu() {
  if (tableData.length < 1) return;

  const headerRow = tableData[0];

  // Tìm cột Số phiếu
  const findColIndex = (keywords) => {
    return headerRow.findIndex(h => {
      const headerLower = String(h || '').toLowerCase().trim();
      return keywords.some(k => headerLower.includes(k.toLowerCase()));
    });
  };

  const soPhieuIdx = findColIndex(['số phiếu', 'sophieu', 'so phieu']);
  if (soPhieuIdx < 0 || soPhieuIdx >= 4) {
    // Số phiếu không nằm trong 4 cột đầu tiên, không tự động điền
    return;
  }

  // Lấy năm và tháng hiện tại
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2); // 2 số cuối của năm
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Tháng từ 01-12
  const yearMonthPrefix = year + month; // Ví dụ: "2603"

  // Tìm số phiếu lớn nhất trong tháng hiện tại
  let maxSeq = 0;

  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    if (!row || row.length <= soPhieuIdx) continue;

    const soPhieuValue = String(row[soPhieuIdx] || '').trim();

    // Kiểm tra định dạng YYMM-XX
    const match = soPhieuValue.match(/^(\d{2})(\d{2})-(\d+)$/);
    if (match) {
      const rowYearMonth = match[1] + match[2];
      const seqNum = parseInt(match[3], 10);

      // Chỉ đếm nếu cùng năm-tháng
      if (rowYearMonth === yearMonthPrefix && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  }

  // Tạo số phiếu tiếp theo
  const nextSeq = maxSeq + 1;
  const soPhieuNew = `${yearMonthPrefix}-${String(nextSeq).padStart(2, '0')}`;

  // Điền vào trường Số phiếu (col_0 là cột đầu tiên)
  const fieldId = `col_${soPhieuIdx}`;
  const soPhieuInput = document.getElementById(fieldId);
  if (soPhieuInput) {
    soPhieuInput.value = soPhieuNew;
    console.log('Đã tự động điền Số phiếu:', soPhieuNew);
  }
}

function addHangHoaRowToModal() {
  const container = document.getElementById('addHangHoaContainer');
  const row = document.createElement('div');
  row.className = 'row add-hang-hoa-row mb-2 align-items-center';

  // Generate unique ID for this dropdown
  matHangDropdownCounter++;
  const dropdownId = `matHang-${matHangDropdownCounter}`;

  row.innerHTML = `
    <div class="col-md-4">
      <!-- Custom dropdown will be inserted here -->
    </div>
    <div class="col-md-3">
      <input type="text" class="form-control" placeholder="ĐVT" name="dvt[]" required>
    </div>
    <div class="col-md-3">
      <input type="number" class="form-control" placeholder="Trọng lượng" name="trongLuong[]" step="0.01" required>
    </div>
    <div class="col-md-2">
      <button type="button" class="btn btn-danger btn-remove-add-row">Xóa</button>
    </div>
  `;
  container.appendChild(row);

  // Insert the custom dropdown into the first column
  const dropdownContainer = row.querySelector('.col-md-4');
  const dropdown = createCustomDropdown(
    dropdownId,
    matHangList,
    'Chọn mặt hàng...',
    null // No callback needed
  );
  dropdownContainer.appendChild(dropdown);

  // Cuộn xuống modal-body
  const modalBody = container.closest('.modal-body');
  if (modalBody) {
    modalBody.scrollTop = modalBody.scrollHeight;
  }

  // Focus vào ô nhập liệu đầu tiên của dòng mới (the dropdown input)
  const firstInput = row.querySelector('.custom-dropdown-input');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }

  updateRemoveButtonsModal();
}

function updateRemoveButtonsModal() {
  const container = document.getElementById('addHangHoaContainer');
  if (!container) return;

  const rows = container.querySelectorAll('.add-hang-hoa-row');
  const removeButtons = container.querySelectorAll('.btn-remove-add-row');

  removeButtons.forEach(btn => {
    btn.style.display = rows.length > 1 ? 'block' : 'none';
  });
}

async function submitAddData() {
  // Lấy dữ liệu từ các trường chính (4 cột đầu)
  const mainFieldCount = Math.min(4, sheetHeaders.length);
  const mainFields = [];
  const ngayIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('ngày') || String(h || '').toLowerCase().includes('date'));

  for (let i = 0; i < mainFieldCount; i++) {
    const fieldName = `col_${i}`;
    const input = document.getElementById(fieldName);
    let value = input ? input.value : '';

    const headerName = String(sheetHeaders[i] || '').toLowerCase();
    const isOptional = headerName.includes('loại xuất') || headerName.includes('mã công trình') || headerName.includes('tên công trình');

    if (!value && !isOptional) {
      alert(`Vui lòng điền trường: ${sheetHeaders[i] || `Cột ${i + 1}`}`);
      if (input) input.focus();
      return;
    }

    // Nếu là trường ngày (cột i chứa "ngày" hoặc "date"), chuyển đổi từ yyyy-mm-dd sang dd/mm/yyyy
    if (ngayIdx >= 0 && i === ngayIdx && value) {
      const dateParts = value.split('-');
      if (dateParts.length === 3) {
        value = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      }
    }
    mainFields.push(value);
  }

  // Lấy số xe, mã công trình, tên công trình
  const soXeInput = document.getElementById('addSoXe');
  const soXe = soXeInput?.value || '';
  if (!soXe) {
    alert('Vui lòng nhập số xe');
    if (soXeInput) soXeInput.focus();
    return;
  }
  const maCongTrinhInput = document.getElementById('addMaCongTrinh');
  const maCongTrinh = maCongTrinhInput?.value || '';
  const tenCongTrinhInput = document.getElementById('addTenCongTrinh');
  const tenCongTrinh = tenCongTrinhInput?.value || '';

  // Lấy dữ liệu hàng hóa
  const matHangInputs = document.querySelectorAll('#addHangHoaContainer input[name="matHang[]"]');
  const dvtInputs = document.querySelectorAll('#addHangHoaContainer input[name="dvt[]"]');
  const trongLuongInputs = document.querySelectorAll('#addHangHoaContainer input[name="trongLuong[]"]');

  // Kiểm tra từng dòng hàng hóa
  for (let i = 0; i < matHangInputs.length; i++) {
    if (!matHangInputs[i].value) {
      alert(`Vui lòng chọn mặt hàng tại dòng ${i + 1}`);
      return;
    }
    if (!dvtInputs[i].value) {
      alert(`Vui lòng nhập ĐVT tại dòng ${i + 1}`);
      dvtInputs[i].focus();
      return;
    }
    if (!trongLuongInputs[i].value) {
      alert(`Vui lòng nhập trọng lượng tại dòng ${i + 1}`);
      trongLuongInputs[i].focus();
      return;
    }
  }

  // Show loading overlay
  showLoadingOverlay('Đang lưu dữ liệu vào Supabase...');

  try {
    const matHangIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('mặt hàng') || String(h || '').toLowerCase().includes('tên hàng') || String(h || '').toLowerCase().includes('mat hang'));
    const dvtIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('đvt') || String(h || '').toLowerCase().includes('đơn vị') || String(h || '').toLowerCase().includes('don vi'));
    const trongLuongIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('trọng lượng') || String(h || '').toLowerCase().includes('khối lượng'));
    const soXeIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('số xe') || String(h || '').toLowerCase().includes('so xe'));
    const maCongTrinhIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('mã công trình') || String(h || '').toLowerCase().includes('macongtrinh'));
    const tenCongTrinhIdx = sheetHeaders.findIndex(h => String(h || '').toLowerCase().includes('tên công trình') || String(h || '').toLowerCase().includes('tencongtrinh'));

    // Tạo mảng các dòng để thêm vào sheet
    const rowsToAdd = [];

    // Với mỗi hàng hóa, tạo một dòng dữ liệu
    for (let i = 0; i < matHangInputs.length; i++) {
      const rowData = [...mainFields]; // Copy main fields

      // Đảm bảo rowData đủ độ dài
      while (rowData.length < sheetHeaders.length) {
        rowData.push('');
      }

      // Điền thông tin hàng hóa vào đúng cột
      if (matHangIdx >= 0) rowData[matHangIdx] = matHangInputs[i]?.value || '';
      if (dvtIdx >= 0) rowData[dvtIdx] = dvtInputs[i]?.value || '';
      if (trongLuongIdx >= 0) rowData[trongLuongIdx] = trongLuongInputs[i]?.value || '';
      if (soXeIdx >= 0) rowData[soXeIdx] = soXe;
      if (maCongTrinhIdx >= 0) rowData[maCongTrinhIdx] = maCongTrinh;
      if (tenCongTrinhIdx >= 0) rowData[tenCongTrinhIdx] = tenCongTrinh;

      // Chỉ thêm dòng nếu có ít nhất một giá trị hàng hóa
      if (matHangInputs[i]?.value || dvtInputs[i]?.value || trongLuongInputs[i]?.value) {
        rowsToAdd.push(rowData);
      }
    }

    // Nếu không có hàng hóa nào, vẫn thêm một dòng với main fields
    if (rowsToAdd.length === 0) {
      const rowData = [...mainFields];
      while (rowData.length < sheetHeaders.length) {
        rowData.push('');
      }
      if (soXeIdx >= 0) rowData[soXeIdx] = soXe;
      if (maCongTrinhIdx >= 0) rowData[maCongTrinhIdx] = maCongTrinh;
      if (tenCongTrinhIdx >= 0) rowData[tenCongTrinhIdx] = tenCongTrinh;
      rowsToAdd.push(rowData);
    }

    // Map rows to Supabase columns and bulk insert
    const toISODate = (vietnameseDate) => {
      if (!vietnameseDate) return null;
      const parts = vietnameseDate.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return vietnameseDate;
    };

    const parseNumeric = (val) => {
      if (val === null || val === undefined || val === '') return null;
      const cleaned = String(val).replace(/,/g, '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    };

    const recordsToInsert = rowsToAdd.map(rowData => {
      const getVal = (keywords) => {
        const idx = sheetHeaders.findIndex(h => {
          if (!h) return false;
          const headerLower = String(h).trim().toLowerCase();
          return keywords.some(kw => headerLower.includes(kw.toLowerCase()));
        });
        return (idx >= 0 && idx < rowData.length) ? rowData[idx] : '';
      };

      const benNhanVal = getVal(['bên nhận', 'bennhan', 'xưởng', 'xuong', 'đội', 'doi']);

      return {
        'Số phiếu': getVal(['số phiếu', 'sophieu']),
        'Ngày': toISODate(getVal(['ngày', 'date'])),
        'Bên nhận/Xưởng/Đội': benNhanVal,
        'Bên nhận/Xưởng/Đội': benNhanVal,
        'Loại xuất': getVal(['loại xuất', 'loaixuat']),
        'Mặt hàng': getVal(['mặt hàng', 'mathang']),
        'ĐVT': getVal(['đvt', 'dvt']),
        'Trọng lượng hàng': getVal(['trọng lượng', 'trong luong', 'khối lượng']) !== '' ? parseNumeric(getVal(['trọng lượng', 'trong luong', 'khối lượng'])) : null,
        'Số xe': soXe,
        'Mã công trình': maCongTrinh || null,
        'Tên công trình': tenCongTrinh || null
      };
    });

    const { error } = await supabase
      .from('pl-phieu-in')
      .insert(recordsToInsert);

    if (error) throw error;

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('addDataModal'));
    if (modal) {
      modal.hide();
    }

    // Reset form
    document.getElementById('addDataForm').reset();

    // Tái tạo form
    renderAddDataForm();

    // Reset hàng hóa về 1 dòng
    const container = document.getElementById('addHangHoaContainer');
    container.innerHTML = '';

    // Create first row with custom dropdown
    matHangDropdownCounter++;
    const dropdownId = `matHang-${matHangDropdownCounter}`;

    const row = document.createElement('div');
    row.className = 'row add-hang-hoa-row mb-2 align-items-center';
    row.innerHTML = `
      <div class="col-md-4">
        <!-- Custom dropdown will be inserted here -->
      </div>
      <div class="col-md-3">
        <input type="text" class="form-control" placeholder="ĐVT" name="dvt[]" required>
      </div>
      <div class="col-md-3">
        <input type="number" class="form-control" placeholder="Trọng lượng" name="trongLuong[]" step="0.01" required>
      </div>
      <div class="col-md-2">
        <button type="button" class="btn btn-danger btn-remove-add-row" style="display:none;">Xóa</button>
      </div>
    `;
    container.appendChild(row);

    // Insert the custom dropdown
    const dropdownContainer = row.querySelector('.col-md-4');
    const dropdown = createCustomDropdown(
      dropdownId,
      matHangList,
      'Chọn mặt hàng...',
      null
    );
    dropdownContainer.appendChild(dropdown);

    updateRemoveButtonsModal();

    // Reload data
    await loadGoogleSheet();

    // Reload data
    await loadGoogleSheet();

    hideLoadingOverlay();

  } catch (error) {
    console.error('Error:', error);
    hideLoadingOverlay();
  }
}

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadGoogleSheet() {
  try {
    let result;
    if (window.supabaseDataEngine) {
      result = await window.supabaseDataEngine.fetchPage('pl-phieu-in', currentPage, ROWS_PER_PAGE);
    } else {
      const { data, error } = await supabase.from('pl-phieu-in').select('*').order('id', { ascending: true });
      if (error) throw error;
      result = { data: data || [], count: (data || []).length, totalPages: Math.max(1, Math.ceil((data || []).length / ROWS_PER_PAGE)) };
    }

    const allData = result.data || [];

    rawSupabaseData = allData;

    const headers = [
      'Số phiếu',
      'Ngày',
      'Bên nhận/Xưởng/Đội',
      'Loại xuất',
      'Mặt hàng',
      'ĐVT',
      'Trọng lượng hàng',
      'Số xe',
      'Mã công trình',
      'Tên công trình'
    ];
    tableData = [headers];

    const formatSupabaseDate = (isoString) => {
      if (!isoString) return '';
      const parts = isoString.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return isoString;
    };

    (allData || []).forEach(row => {
      const benNhanVal = row['Bên nhận/Xưởng/Đội'] ?? row['Bên nhận/Xưởng/Đội'] ?? row['Bên nhận/ Xưởng/ Đội'] ?? row['Bên nhận / Xưởng / Đội'] ?? row['Bên nhận'] ?? row['ben_nhan'] ?? row['benNhan'] ?? row['Xưởng'] ?? '';

      tableData.push([
        row['Số phiếu'] || '',
        formatSupabaseDate(row['Ngày']),
        benNhanVal,
        row['Loại xuất'] || '',
        row['Mặt hàng'] || '',
        row['ĐVT'] || '',
        row['Trọng lượng hàng'] !== undefined && row['Trọng lượng hàng'] !== null ? Number(row['Trọng lượng hàng']) : (row['Trọng lượng'] !== undefined && row['Trọng lượng'] !== null ? Number(row['Trọng lượng']) : ''),
        row['Số xe'] || '',
        row['Mã công trình'] || '',
        row['Tên công trình'] || ''
      ]);
    });

    console.log('Dữ liệu đã tải từ Supabase:', tableData);

    // Hiển thị dữ liệu trong bảng
    renderTable();

    // Tạo form thêm dữ liệu động
    renderAddDataForm();

    // Nếu có dữ liệu, điền vào form
    if (tableData.length > 1) {
      populateFormWithLatestData();
    }

  } catch (error) {
    console.error('Lỗi tải dữ liệu từ Supabase:', error);
  }
}

function populateFormWithLatestData() {
  if (tableData.length < 2) return;

  // Lấy dòng dữ liệu mới nhất (dòng cuối cùng)
  const latestRow = tableData[tableData.length - 1];
  const headerRow = tableData[0];

  // Tìm index của các cột dựa trên header
  const findColIndex = (keywords) => {
    return headerRow.findIndex(h => {
      if (!h) return false;
      const headerLower = String(h).trim().toLowerCase();
      return keywords.some(kw => headerLower.includes(kw.toLowerCase()));
    });
  };

  // Tìm các cột tương ứng
  const soPhieuIdx = findColIndex(['số phiếu', 'sophieu', 'so phieu']);
  const soXeIdx = findColIndex(['số xe', 'soxe', 'so xe']);
  const ngayIdx = findColIndex(['ngày', 'ngay', 'date']);
  const benNhanIdx = findColIndex(['bên nhận', 'benhan', 'ben nhan', 'xưởng', 'xuong', 'đội', 'doi']);
  const matHangIdx = findColIndex(['mặt hàng', 'mathang', 'mat hang', 'tên hàng', 'ten hang']);
  const dvtIdx = findColIndex(['đvt', 'dvt', 'đơn vị', 'don vi', 'đơn vị tính']);
  const trongLuongIdx = findColIndex(['trọng lượng', 'trong luong', 'khối lượng']);

  // Điền dữ liệu vào form
  if (soPhieuIdx >= 0) {
    document.getElementById('soPhieu').value = latestRow[soPhieuIdx] || '';
  }

  if (soXeIdx >= 0) {
    document.getElementById('soXe').value = latestRow[soXeIdx] || '';
  }

  if (ngayIdx >= 0) {
    const ngayValue = latestRow[ngayIdx];
    if (ngayValue) {
      // Chuyển đổi ngày sang định dạng yyyy-mm-dd
      const dateObj = parseDate(ngayValue);
      if (dateObj) {
        document.getElementById('ngay').value = dateObj.toISOString().split('T')[0];
      }
    }
  }

  if (benNhanIdx >= 0) {
    document.getElementById('benNhan').value = latestRow[benNhanIdx] || '';
  }

  // Điền hàng hóa (nếu có)
  if (matHangIdx >= 0 || dvtIdx >= 0 || trongLuongIdx >= 0) {
    const matHang = latestRow[matHangIdx] || '';
    const dvt = latestRow[dvtIdx] || '';
    const trongLuong = latestRow[trongLuongIdx] || '';

    // Điền vào dòng đầu tiên
    const matHangInput = document.querySelector('.mat-hang');
    const dvtInput = document.querySelector('.dvt');
    const trongLuongInput = document.querySelector('.trongLuong');

    if (matHangInput) matHangInput.value = matHang;
    if (dvtInput) dvtInput.value = dvt;
    if (trongLuongInput) trongLuongInput.value = trongLuong;
  }
}

// Đặt các trường (trừ số phiếu) thành read-only
function setFieldsReadOnly() {
  const fieldsToMakeReadOnly = [
    'soXe', 'ngay', 'benNhan', 'loaiXuat', 'benGiao'
  ];

  // Các trường đơn lẻ
  fieldsToMakeReadOnly.forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (input) {
      input.setAttribute('readonly', 'readonly');
      input.classList.add('read-only-field');
    }
  });

  // Các trường hàng hóa (mat-hang, dvt, trongLuong)
  const matHangInputs = document.querySelectorAll('.mat-hang');
  const dvtInputs = document.querySelectorAll('.dvt');
  const trongLuongInputs = document.querySelectorAll('.trongLuong');

  matHangInputs.forEach(input => {
    input.setAttribute('readonly', 'readonly');
    input.classList.add('read-only-field');
  });

  dvtInputs.forEach(input => {
    input.setAttribute('readonly', 'readonly');
    input.classList.add('read-only-field');
  });

  trongLuongInputs.forEach(input => {
    input.setAttribute('readonly', 'readonly');
    input.classList.add('read-only-field');
  });

  // Ẩn nút thêm dòng hàng hóa
  const btnAddRow = document.getElementById('btnAddRow');
  if (btnAddRow) {
    btnAddRow.style.display = 'none';
  }

  // Ẩn nút xóa dòng
  const removeButtons = document.querySelectorAll('.btn-remove-row');
  removeButtons.forEach(btn => {
    btn.style.display = 'none';
  });
}

// Đặt các trường về chế độ có thể chỉnh sửa
function setFieldsEditable() {
  const fieldsToMakeEditable = [
    'soXe', 'ngay', 'benNhan', 'loaiXuat', 'benGiao'
  ];

  // Các trường đơn lẻ
  fieldsToMakeEditable.forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (input) {
      input.removeAttribute('readonly');
      input.classList.remove('read-only-field');
    }
  });

  // Các trường hàng hóa (mat-hang, dvt, trongLuong)
  const matHangInputs = document.querySelectorAll('.mat-hang');
  const dvtInputs = document.querySelectorAll('.dvt');
  const trongLuongInputs = document.querySelectorAll('.trongLuong');

  matHangInputs.forEach(input => {
    input.removeAttribute('readonly');
    input.classList.remove('read-only-field');
  });

  dvtInputs.forEach(input => {
    input.removeAttribute('readonly');
    input.classList.remove('read-only-field');
  });

  trongLuongInputs.forEach(input => {
    input.removeAttribute('readonly');
    input.classList.remove('read-only-field');
  });

  // Hiện nút thêm dòng hàng hóa
  const btnAddRow = document.getElementById('btnAddRow');
  if (btnAddRow) {
    btnAddRow.style.display = '';
  }

  // Hiện nút xóa dòng (nếu có nhiều hơn 1 dòng)
  updateRemoveButtons();
}

// Tìm và điền form dựa trên số phiếu
function fillFormBySoPhieu(soPhieuValue) {
  if (tableData.length < 2) return;

  // Khi tìm thấy dữ liệu, set các trường khác thành read-only
  setFieldsReadOnly();

  const headerRow = tableData[0];

  // Tìm index của các cột dựa trên header
  const findColIndex = (keywords) => {
    return headerRow.findIndex(h => {
      if (!h) return false;
      const headerLower = String(h).trim().toLowerCase();
      return keywords.some(kw => headerLower.includes(kw.toLowerCase()));
    });
  };

  // Tìm các cột tương ứng
  const soPhieuIdx = findColIndex(['số phiếu', 'sophieu', 'so phieu']);
  const soXeIdx = findColIndex(['số xe', 'soxe', 'so xe']);
  const ngayIdx = findColIndex(['ngày', 'ngay', 'date']);
  const benNhanIdx = findColIndex(['bên nhận', 'benhan', 'ben nhan', 'xưởng', 'xuong', 'đội', 'doi']);
  const loaiXuatIdx = findColIndex(['loại xuất', 'loaixuat', 'loai xuat', 'loại', 'loai']);
  const matHangIdx = findColIndex(['mặt hàng', 'mathang', 'mat hang', 'tên hàng', 'ten hang']);
  const dvtIdx = findColIndex(['đvt', 'dvt', 'đơn vị', 'don vi', 'đơn vị tính']);
  const trongLuongIdx = findColIndex(['trọng lượng', 'trong luong', 'khối lượng']);

  if (soPhieuIdx < 0) {
    console.log('Không tìm thấy cột số phiếu');
    return;
  }

  // Tìm tất cả các dòng dữ liệu có số phiếu khớp với giá trị nhập vào
  // Chuyển cả hai về lowercase và trim để so sánh không phân biệt hoa thường
  const normalizedSoPhieu = String(soPhieuValue).trim().toLowerCase();

  const foundRows = [];
  for (let i = 1; i < tableData.length; i++) {
    const rowSoPhieu = String(tableData[i][soPhieuIdx] || '').trim().toLowerCase();
    if (rowSoPhieu === normalizedSoPhieu) {
      foundRows.push(tableData[i]);
    }
  }

  if (foundRows.length === 0) {
    console.log('Không tìm thấy phiếu với số phiếu: ' + soPhieuValue);
    // Xóa tất cả các trường khác khi không tìm thấy dữ liệu (giống VLOOKUP trong Excel)
    const soXeInput = document.getElementById('soXe');
    if (soXeInput) soXeInput.value = '';

    const ngayInput = document.getElementById('ngay');
    if (ngayInput) {
      const today = new Date().toISOString().split('T')[0];
      ngayInput.value = today;
    }

    const benNhanInput = document.getElementById('benNhan');
    if (benNhanInput) benNhanInput.value = '';

    const loaiXuatInput = document.getElementById('loaiXuat');
    if (loaiXuatInput) loaiXuatInput.value = '';

    // Xóa dữ liệu hàng hóa
    const matHangInput = document.querySelector('.mat-hang');
    const dvtInput = document.querySelector('.dvt');
    const trongLuongInput = document.querySelector('.trongLuong');

    if (matHangInput) matHangInput.value = '';
    if (dvtInput) dvtInput.value = '';
    if (trongLuongInput) trongLuongInput.value = '';

    // Xóa các dòng hàng hóa thừa
    const hangHoaContainer = document.getElementById('hangHoaContainer');
    const existingRows = hangHoaContainer.querySelectorAll('.hang-hoa-row');
    for (let i = 1; i < existingRows.length; i++) {
      existingRows[i].remove();
    }

    // Cho phép chỉnh sửa các trường khi không tìm thấy dữ liệu
    setFieldsEditable();

    return;
  }

  console.log('Tìm thấy phiếu:', foundRows.length, 'dòng dữ liệu');

  // Lấy dòng đầu tiên để điền thông tin chung
  const firstRow = foundRows[0];

  // Điền dữ liệu vào form
  // Số xe
  if (soXeIdx >= 0) {
    const soXeInput = document.getElementById('soXe');
    if (soXeInput) soXeInput.value = firstRow[soXeIdx] || '';
  }

  // Ngày
  if (ngayIdx >= 0) {
    const ngayInput = document.getElementById('ngay');
    if (ngayInput) {
      const ngayValue = firstRow[ngayIdx];
      if (ngayValue) {
        const dateObj = parseDate(ngayValue);
        if (dateObj) {
          ngayInput.value = dateObj.toISOString().split('T')[0];
        }
      }
    }
  }

  // Bên nhận
  if (benNhanIdx >= 0) {
    const benNhanInput = document.getElementById('benNhan');
    if (benNhanInput) benNhanInput.value = firstRow[benNhanIdx] || '';
  }

  // Loại xuất
  if (loaiXuatIdx >= 0) {
    const loaiXuatInput = document.getElementById('loaiXuat');
    if (loaiXuatInput) loaiXuatInput.value = firstRow[loaiXuatIdx] || '';
  }

  // Xóa tất cả các dòng hàng hóa hiện có (trừ dòng đầu tiên)
  const hangHoaContainer = document.getElementById('hangHoaContainer');
  const existingRows = hangHoaContainer.querySelectorAll('.hang-hoa-row');
  for (let i = 1; i < existingRows.length; i++) {
    existingRows[i].remove();
  }

  // Điền dòng đầu tiên với dữ liệu từ dòng đầu tiên tìm thấy
  if (matHangIdx >= 0 || dvtIdx >= 0 || trongLuongIdx >= 0) {
    const matHangInput = document.querySelector('.mat-hang');
    const dvtInput = document.querySelector('.dvt');
    const trongLuongInput = document.querySelector('.trongLuong');

    if (matHangInput) matHangInput.value = firstRow[matHangIdx] || '';
    if (dvtInput) dvtInput.value = firstRow[dvtIdx] || '';
    if (trongLuongInput) trongLuongInput.value = firstRow[trongLuongIdx] || '';
  }

  // Đảm bảo các trường vẫn là read-only sau khi điền dữ liệu
  setFieldsReadOnly();

  // Thêm các dòng hàng hóa còn lại (nếu có nhiều hơn 1 dòng)
  if (foundRows.length > 1) {
    for (let i = 1; i < foundRows.length; i++) {
      const row = foundRows[i];
      const matHang = row[matHangIdx] || '';
      const dvt = row[dvtIdx] || '';
      const trongLuong = row[trongLuongIdx] || '';

      // Chỉ thêm dòng nếu có dữ liệu hàng hóa
      if (matHang || dvt || trongLuong) {
        const newRow = document.createElement('div');
        newRow.className = 'row hang-hoa-row';
        newRow.innerHTML = `
          <div class="col-md-4">
            <div class="form-group">
              <input type="text" class="form-control mat-hang read-only-field" name="matHang[]" required value="${matHang}" readonly>
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <input type="text" class="form-control dvt read-only-field" name="dvt[]" required value="${dvt}" readonly>
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <input type="number" class="form-control trongLuong read-only-field" name="trongLuong[]" step="0.1" required value="${trongLuong}" readonly>
            </div>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <div class="form-group">
            </div>
          </div>
        `;
        hangHoaContainer.appendChild(newRow);
      }
    }
  }

  // Cập nhật trạng thái nút xóa
  updateRemoveButtons();
}

function parseDate(dateValue) {
  if (!dateValue) return null;

  // Nếu là số (Excel serial date)
  if (typeof dateValue === 'number') {
    return new Date((dateValue - 25569) * 86400 * 1000);
  }

  // Nếu là chuỗi
  if (typeof dateValue === 'string') {
    // Thử các định dạng khác nhau
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,           // yyyy-mm-dd
      /^(\d{2})\/(\d{2})\/(\d{4})$/,        // dd/mm/yyyy
      /^(\d{2})-(\d{2})-(\d{4})$/,           // dd-mm-yyyy
    ];

    for (const format of formats) {
      const match = dateValue.match(format);
      if (match) {
        if (format === formats[0]) {
          return new Date(match[1], match[2] - 1, match[3]);
        } else {
          return new Date(match[3], match[2] - 1, match[1]);
        }
      }
    }

    // Thử parse trực tiếp
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

// =============================================================================
// RENDER DATA TABLE
// =============================================================================

function renderTable(data, resetPage = true) {
  if (tableData.length < 2) return;

  // Store all data for pagination
  filteredData = data || tableData;

  if (resetPage) {
    currentPage = 1;
  }

  // Calculate pagination
  calculatePagination(filteredData);

  // Get data for current page
  const pageData = getPageData(filteredData);

  renderTableData(pageData);

  // Update pagination controls
  updatePaginationControls();
}

// Render dữ liệu của trang hiện tại
function renderTableData(data) {
  const headerRow = data[0];
  const tbody = document.getElementById('dataTableBody');
  const thead = document.querySelector('#dataTable thead tr');
  if (!tbody || !thead) return;

  // Xóa header cũ
  thead.innerHTML = '';

  // Tạo header động từ Google Sheet (với cột checkbox)
  let headerHtml = '<th style="width: 50px;"><input type="checkbox" id="selectAllCheckbox" title="Chọn tất cả"></th>';
  headerRow.forEach((header, index) => {
    headerHtml += `<th>${header || `Cột ${index + 1}`}</th>`;
  });
  thead.innerHTML = headerHtml;

  // Xóa dữ liệu cũ
  tbody.innerHTML = '';

  // Duyệt qua các dòng dữ liệu (bắt đầu từ dòng 1, bỏ qua header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // Bỏ qua dòng trống
    const isEmptyRow = row.every(cell => {
      return cell === undefined || cell === null || String(cell).trim() === '';
    });
    if (isEmptyRow) continue;

    const tr = document.createElement('tr');
    // Lưu index trong tableData
    const originalIndex = tableData.indexOf(row);
    tr.dataset.rowIndex = String(originalIndex);

    // Checkbox
    let html = `<td><input type="checkbox" class="row-checkbox" value="${originalIndex}"></td>`;

    // Các cột dữ liệu
    for (let j = 0; j < headerRow.length; j++) {
      let cellValue = row[j] || '';

      // Format ngày nếu cột là ngày
      const headerLower = String(headerRow[j] || '').toLowerCase();
      if (headerLower.includes('ngày') || headerLower.includes('date')) {
        cellValue = formatDateDisplay(cellValue);
      } else if (headerLower.includes('trọng lượng') || headerLower.includes('khối lượng') || headerLower.includes('số lượng') || headerLower.includes('kg') || headerLower.includes('tấn')) {
        cellValue = formatNumber(cellValue);
      } else if (headerLower.includes('id')) {
        const cleaned = String(cellValue).trim().replace(/\s+/g, '');
        const parsedNum = Number(cleaned);
        if (!isNaN(parsedNum) && cleaned !== '') {
          cellValue = parsedNum;
        }
      }

      html += `<td>${cellValue}</td>`;
    }

    tr.innerHTML = html;

    // Add click event for row selection (matching pl-can-thu)
    tr.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox' || e.target.classList.contains('row-checkbox')) return;
      const checkbox = tr.querySelector('.row-checkbox');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updateSelectedRows();
      }
    });

    // Checkbox change event
    const checkbox = tr.querySelector('.row-checkbox');
    checkbox.addEventListener('change', () => {
      updateSelectedRows();
    });

    tbody.appendChild(tr);
  }

  // Select all checkbox handler
  setTimeout(() => {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('#dataTable tbody .row-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
        });
        updateSelectedRows();
      });
    }
  }, 0);

  // Reset selection
  selectedRowIndex = -1;
  selectedRowIndexes = [];
  document.getElementById('btnEditData').disabled = true;
  document.getElementById('btnDeleteData').disabled = true;
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

  const isAnySelectedLocked = selectedRowIndexes.some(idx => {
    const record = rawSupabaseData && rawSupabaseData[idx - 1];
    return typeof isRecordLocked === 'function' && isRecordLocked(record);
  });

  // Enable/disable buttons based on selection count
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

  // Update selectedRowIndex for single selection
  if (selectedRowIndexes.length === 1) {
    selectedRowIndex = selectedRowIndexes[0];
  } else {
    selectedRowIndex = -1;
  }
}

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
  // Nút Submit (Thêm, Cập nhật, In phiếu, v.v.)
  const submitBtns = modalEl.querySelectorAll('button[type="submit"], #btnConfirmDelete, #btnEditAddRowModal, #btnAddRowModal');
  submitBtns.forEach(btn => {
    btn.style.display = isAdmin ? '' : 'none';
  });

  // Ẩn các nút "Xóa" dòng trong modal
  const removeBtns = modalEl.querySelectorAll('.btn-remove-edit-row, .btn-remove-row');
  removeBtns.forEach(btn => {
    btn.style.display = isAdmin ? '' : 'none';
  });

  // Ẩn các nút "Thêm mặt hàng mới" trong dropdown (nếu modal có dropdown)
  const addNewItemBtns = modalEl.querySelectorAll('.btn-add-new-item');
  addNewItemBtns.forEach(btn => {
    btn.style.display = isAdmin ? '' : 'none';
  });

  return isAdmin;
}

/* =============================================================================
   EDIT DATA MODAL
   Chức năng sửa dữ liệu
================================================================================ */

function openEditDataModal() {
  if (selectedRowIndex < 0 || selectedRowIndex >= tableData.length) {
    alert('Vui lòng chọn một dòng để sửa');
    return;
  }

  const modalEl = document.getElementById('editDataModal');
  if (!modalEl) return;

  const mainFieldsContainer = document.getElementById('editDataMainFields');
  if (!mainFieldsContainer) return;

  // Reset form
  mainFieldsContainer.innerHTML = '';

  // Clear goods container
  const editHangHoaContainer = document.getElementById('editHangHoaContainer');
  if (editHangHoaContainer) editHangHoaContainer.innerHTML = '';
  editRollCount = 0;

  const headers = (tableData && tableData[0]) ? tableData[0] : [];
  const rowData = tableData[selectedRowIndex];

  // Find columns for goods details (Mặt hàng, ĐVT, Trọng lượng)
  const matHangIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('mặt hàng'));
  const dvtIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('đvt'));
  const trongLuongIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('trọng lượng') || String(h || '').toLowerCase().includes('kg'));
  const soXeIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('số xe'));
  const maCongTrinhIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('mã công trình'));
  const tenCongTrinhIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('tên công trình'));

  // If we have goods detail columns, populate them
  if (matHangIdx >= 0 || dvtIdx >= 0 || trongLuongIdx >= 0) {
    // Add first row with existing data
    addEditHangHoaRow(
      rowData[matHangIdx] || '',
      rowData[dvtIdx] || '',
      rowData[trongLuongIdx] || ''
    );
  }

  // Setup add row button
  const btnEditAddRowModal = document.getElementById('btnEditAddRowModal');
  if (btnEditAddRowModal) {
    btnEditAddRowModal.onclick = () => addEditHangHoaRow();
  }

  // Create form fields for each column (excluding goods details, số xe, mã công trình, tên công trình which are handled separately)
  // Use same format as add modal: row wrapper, col-md-6, mb-3, form-label (not fw-bold)
  let fieldsHtml = '<div class="row">';

  headers.forEach((header, colIdx) => {
    // Skip goods detail columns, số xe, mã công trình, và tên công trình - handled separately
    if (colIdx === matHangIdx || colIdx === dvtIdx || colIdx === trongLuongIdx || colIdx === soXeIdx || colIdx === maCongTrinhIdx || colIdx === tenCongTrinhIdx) {
      return;
    }

    const headerLower = String(header || '').toLowerCase();
    let inputType = 'text';

    // Determine input type based on column name
    if (headerLower.includes('ngày') || headerLower.includes('date')) {
      inputType = 'date';
    } else if (headerLower.includes('trọng lượng') || headerLower.includes('khối lượng') || headerLower.includes('số lượng')) {
      inputType = 'number';
    }

    // Format date values
    let inputValue = rowData[colIdx] ?? '';
    if (inputType === 'date' && inputValue) {
      const dateStr = inputValue;
      if (typeof dateStr === 'string') {
        const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          let d = String(m[1]).padStart(2, '0');
          let mo = String(m[2]).padStart(2, '0');
          let y = m[3];
          if (y.length === 2) y = (parseInt(y, 10) < 50 ? '20' : '19') + y;
          inputValue = `${y}-${mo}-${d}`;
        }
      }
    }

    const isOptional = headerLower.includes('loại xuất') || headerLower.includes('mã công trình') || headerLower.includes('tên công trình');

    fieldsHtml += `
      <div class="col-md-6">
        <div class="mb-3">
          <label for="edit_col_${colIdx}" class="form-label">${header || `Cột ${colIdx + 1}`} ${isOptional ? '' : '<span class="text-danger">*</span>'}</label>
          <input type="${inputType}" class="form-control" id="edit_col_${colIdx}" name="col_${colIdx}" value="${inputValue}" ${inputType === 'number' ? 'step="0.01"' : ''} ${isOptional ? '' : 'required'}>
        </div>
      </div>
    `;
  });

  fieldsHtml += '</div>';
  mainFieldsContainer.innerHTML = fieldsHtml;

  // Set Số xe, Mã công trình, Tên công trình values
  const editSoXe = document.getElementById('editSoXe');
  if (editSoXe && soXeIdx >= 0) {
    editSoXe.value = rowData[soXeIdx] || '';
  }
  const editMaCongTrinh = document.getElementById('editMaCongTrinh');
  if (editMaCongTrinh && maCongTrinhIdx >= 0) {
    editMaCongTrinh.value = rowData[maCongTrinhIdx] || '';
  }
  const editTenCongTrinh = document.getElementById('editTenCongTrinh');
  if (editTenCongTrinh && tenCongTrinhIdx >= 0) {
    editTenCongTrinh.value = rowData[tenCongTrinhIdx] || '';
  }

  // Show modal using Bootstrap
  setupModalPermissions(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// Add a row to edit goods table (matching Add Data modal format)
function addEditHangHoaRow(matHang = '', dvt = '', trongLuong = '') {
  editRollCount++;
  const container = document.getElementById('editHangHoaContainer');
  if (!container) return;

  // Generate unique ID for this dropdown
  editMatHangDropdownCounter++;
  const dropdownId = `editMatHang-${editMatHangDropdownCounter}`;

  const row = document.createElement('div');
  row.className = 'row add-hang-hoa-row mb-2 align-items-center edit-hang-hoa-row';
  row.dataset.rollId = editRollCount;
  row.innerHTML = `
    <div class="col-md-4">
      <!-- Custom dropdown will be inserted here -->
    </div>
    <div class="col-md-3">
      <input type="text" class="form-control" placeholder="ĐVT" name="dvt[]" value="${dvt}" required>
    </div>
    <div class="col-md-3">
      <input type="number" class="form-control" placeholder="Trọng lượng" name="trongLuong[]" step="0.01" value="${trongLuong}" required>
    </div>
    <div class="col-md-2">
      <button type="button" class="btn btn-danger btn-remove-edit-row">Xóa</button>
    </div>
  `;
  container.appendChild(row);

  // Insert the custom dropdown into the first column
  const dropdownContainer = row.querySelector('.col-md-4');
  const dropdown = createCustomDropdown(
    dropdownId,
    matHangList,
    'Chọn mặt hàng...',
    null
  );
  dropdownContainer.appendChild(dropdown);

  // If matHang is provided, set it as the selected value
  if (matHang) {
    setTimeout(() => {
      setDropdownValue(dropdown, matHang);
    }, 50);
  }

  // Remove button
  row.querySelector('.btn-remove-edit-row').addEventListener('click', () => {
    row.remove();
    updateEditHangHoaNumbers();
  });

  updateEditHangHoaNumbers();
}

function updateEditHangHoaNumbers() {
  const rows = document.querySelectorAll('#editHangHoaContainer .edit-hang-hoa-row');
  rows.forEach((row, index) => {
    // Update visibility of remove buttons
    const removeBtn = row.querySelector('.btn-remove-edit-row');
    if (removeBtn) {
      removeBtn.style.display = rows.length > 1 ? 'block' : 'none';
    }
  });
}

/* =============================================================================
   DELETE DATA MODAL
   Chức năng xóa dữ liệu
================================================================================ */

function openDeleteDataModal() {
  if (selectedRowIndexes.length === 0 && selectedRowIndex < 0) {
    alert('Vui lòng chọn ít nhất một dòng để xóa');
    return;
  }

  const modalEl = document.getElementById('deleteDataModal');
  if (!modalEl) return;

  // Update modal body message to show count
  const modalBody = modalEl.querySelector('.modal-body p');
  if (modalBody) {
    const count = selectedRowIndexes.length || 1;
    modalBody.textContent = `Bạn có chắc chắn muốn xóa ${count} dòng dữ liệu? Hành động này không thể hoàn tác.`;
  }

  // Thiết lập quyền cho modal xóa
  setupModalPermissions(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// Handle delete confirmation
async function confirmDelete() {
  const rowsToDelete = selectedRowIndexes.length > 0 ? selectedRowIndexes : [selectedRowIndex];

  if (rowsToDelete.length === 0) {
    alert('Không có dòng nào được chọn để xóa');
    return;
  }

  const lockedItems = [];
  rowsToDelete.forEach(idx => {
    const record = rawSupabaseData && rawSupabaseData[idx - 1];
    if (typeof isRecordLocked === 'function' && isRecordLocked(record)) {
      const ticketNum = record?.['Số phiếu'] || record?.so_phieu || (tableData[idx] ? tableData[idx][0] : record?.id || idx);
      lockedItems.push(`Số phiếu: ${ticketNum}`);
    }
  });

  if (lockedItems.length > 0) {
    const msg = lockedItems.length === 1
      ? `Dữ liệu (${lockedItems[0]}) đã nhập quá 24 giờ. Hệ thống không cho phép xóa.`
      : `Không thể xóa. Các dòng dữ liệu sau đã nhập quá 24 giờ:\n• ${lockedItems.join('\n• ')}`;
    (window.showWarningModal || alert)(msg);
    return;
  }

  showLoadingOverlay('Đang xóa dữ liệu...');

  try {
    const idsToDelete = rowsToDelete
      .map(idx => rawSupabaseData && rawSupabaseData[idx - 1] ? rawSupabaseData[idx - 1].id : null)
      .filter(Boolean);

    if (idsToDelete.length > 0) {
      const { error } = await supabase
        .from('pl-phieu-in')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;
    } else {
      const soPhieuToDelete = rowsToDelete
        .map(idx => tableData[idx] ? tableData[idx][0] : null)
        .filter(Boolean);

      if (soPhieuToDelete.length > 0) {
        const { error } = await supabase
          .from('pl-phieu-in')
          .delete()
          .in('Số phiếu', soPhieuToDelete);

        if (error) throw error;
      }
    }

    // Reload data from Supabase
    if (window.supabaseDataEngine) window.supabaseDataEngine.invalidateCache('pl-phieu-in');
    await loadGoogleSheet();

    // Reset selection
    selectedRowIndex = -1;
    selectedRowIndexes = [];
    document.getElementById('btnEditData').disabled = true;
    document.getElementById('btnDeleteData').disabled = true;
    document.getElementById('btnDeleteData').textContent = 'Xóa dữ liệu';

    // Close modal
    const deleteDataModalEl = document.getElementById('deleteDataModal');
    const bsDeleteData = bootstrap.Modal.getInstance(deleteDataModalEl);
    if (bsDeleteData) bsDeleteData.hide();

    hideLoadingOverlay();

  } catch (error) {
    console.error('Error deleting data from Supabase:', error);
    hideLoadingOverlay();
    alert('Lỗi xóa dữ liệu: ' + (error.message || error));
  }
}

// Handle edit form submission
async function handleEditFormSubmit(e) {
  e.preventDefault();

  if (selectedRowIndex < 0 || selectedRowIndex >= tableData.length) {
    alert('Không có dòng nào được chọn để sửa');
    return;
  }

  const recordToEdit = rawSupabaseData && rawSupabaseData[selectedRowIndex - 1];
  if (typeof isRecordLocked === 'function' && isRecordLocked(recordToEdit)) {
    const ticketNum = recordToEdit?.['Số phiếu'] || recordToEdit?.so_phieu || (tableData[selectedRowIndex] ? tableData[selectedRowIndex][0] : recordToEdit?.id || selectedRowIndex);
    (window.showWarningModal || alert)(`Dữ liệu (Số phiếu: ${ticketNum}) đã được nhập quá 24 giờ. Hệ thống không cho phép cập nhật.`);
    return;
  }

  const form = e.target;
  const headers = tableData[0] || [];
  const rowData = tableData[selectedRowIndex];

  // Find columns for goods details
  const matHangIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('mặt hàng'));
  const dvtIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('đvt'));
  const trongLuongIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('trọng lượng') || String(h || '').toLowerCase().includes('kg'));
  const soXeIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('số xe'));
  const maCongTrinhIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('mã công trình'));
  const tenCongTrinhIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('tên công trình'));

  // Manual validation
  // 1. Check main fields
  for (let i = 0; i < headers.length; i++) {
    if (i === matHangIdx || i === dvtIdx || i === trongLuongIdx || i === soXeIdx || i === maCongTrinhIdx || i === tenCongTrinhIdx) continue;

    const input = form.querySelector(`[name="col_${i}"]`);
    const headerName = String(headers[i] || '').toLowerCase();
    const isOptional = headerName.includes('loại xuất') || headerName.includes('mã công trình') || headerName.includes('tên công trình');

    if (input && !input.value && !isOptional) {
      alert(`Vui lòng điền trường: ${headers[i] || `Cột ${i + 1}`}`);
      input.focus();
      return;
    }
  }

  // 2. Check Số xe
  const editSoXe = document.getElementById('editSoXe');
  if (editSoXe && !editSoXe.value) {
    alert('Vui lòng nhập số xe');
    editSoXe.focus();
    return;
  }

  // 3. Check goods details
  const editHangHoaRows = document.querySelectorAll('#editHangHoaContainer .edit-hang-hoa-row');
  if ((matHangIdx >= 0 || dvtIdx >= 0 || trongLuongIdx >= 0) && editHangHoaRows.length === 0) {
    alert('Phải có ít nhất một dòng hàng hóa');
    return;
  }

  for (let i = 0; i < editHangHoaRows.length; i++) {
    const row = editHangHoaRows[i];
    const matHangInput = row.querySelector('input[name="matHang[]"]');
    const dvtInput = row.querySelector('input[name="dvt[]"]');
    const trongLuongInput = row.querySelector('input[name="trongLuong[]"]');

    if (matHangInput && !matHangInput.value) {
      alert(`Vui lòng chọn mặt hàng tại dòng ${i + 1}`);
      return;
    }
    if (dvtInput && !dvtInput.value) {
      alert(`Vui lòng nhập ĐVT tại dòng ${i + 1}`);
      dvtInput.focus();
      return;
    }
    if (trongLuongInput && !trongLuongInput.value) {
      alert(`Vui lòng nhập trọng lượng tại dòng ${i + 1}`);
      trongLuongInput.focus();
      return;
    }
  }

  // Show loading overlay
  showLoadingOverlay('Đang cập nhật dữ liệu...');

  // Update row data from form inputs (main fields)
  headers.forEach((header, colIdx) => {
    // Skip goods detail columns, số xe, mã công trình, tên công trình - they're handled separately
    if (colIdx === matHangIdx || colIdx === dvtIdx || colIdx === trongLuongIdx || colIdx === soXeIdx || colIdx === maCongTrinhIdx || colIdx === tenCongTrinhIdx) {
      return;
    }
    const input = form.querySelector(`[name="col_${colIdx}"]`);
    if (input) {
      rowData[colIdx] = input.value;
    }
  });

  // Collect goods details from the goods container
  if (matHangIdx >= 0 || dvtIdx >= 0 || trongLuongIdx >= 0) {
    const editHangHoaRows = document.querySelectorAll('#editHangHoaContainer .edit-hang-hoa-row');

    if (editHangHoaRows.length > 0) {
      // Get first row's values for the main columns
      const firstRow = editHangHoaRows[0];
      if (matHangIdx >= 0) {
        const matHangInput = firstRow.querySelector('input[name="matHang[]"]');
        rowData[matHangIdx] = matHangInput ? matHangInput.value : '';
      }
      if (dvtIdx >= 0) {
        const dvtInput = firstRow.querySelector('input[name="dvt[]"]');
        rowData[dvtIdx] = dvtInput ? dvtInput.value : '';
      }
      if (trongLuongIdx >= 0) {
        const kgInput = firstRow.querySelector('input[name="trongLuong[]"]');
        rowData[trongLuongIdx] = kgInput ? kgInput.value : '';
      }
    }
  }

  // Update Số xe, Mã công trình, Tên công trình
  if (soXeIdx >= 0) {
    const editSoXe = document.getElementById('editSoXe');
    if (editSoXe) {
      rowData[soXeIdx] = editSoXe.value;
    }
  }
  if (maCongTrinhIdx >= 0) {
    const editMaCongTrinh = document.getElementById('editMaCongTrinh');
    if (editMaCongTrinh) {
      rowData[maCongTrinhIdx] = editMaCongTrinh.value;
    }
  }
  if (tenCongTrinhIdx >= 0) {
    const editTenCongTrinh = document.getElementById('editTenCongTrinh');
    if (editTenCongTrinh) {
      rowData[tenCongTrinhIdx] = editTenCongTrinh.value;
    }
  }

  try {
    const toISODate = (vietnameseDate) => {
      if (!vietnameseDate) return null;
      const parts = vietnameseDate.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return vietnameseDate;
    };

    const parseNumeric = (val) => {
      if (val === null || val === undefined || val === '') return null;
      const cleaned = String(val).replace(/,/g, '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    };

    const recordId = rawSupabaseData && rawSupabaseData[selectedRowIndex - 1] ? rawSupabaseData[selectedRowIndex - 1].id : null;

    const benNhanVal = rowData[2] || '';

    const updatePayload = {
      'Số phiếu': rowData[0] || '',
      'Ngày': toISODate(rowData[1]),
      'Bên nhận/Xưởng/Đội': benNhanVal,
      'Bên nhận/Xưởng/Đội': benNhanVal,
      'Loại xuất': rowData[3] || '',
      'Mặt hàng': rowData[4] || '',
      'ĐVT': rowData[5] || '',
      'Trọng lượng hàng': rowData[6] !== '' ? parseNumeric(rowData[6]) : null,
      'Số xe': rowData[7] || '',
      'Mã công trình': rowData[8] || null,
      'Tên công trình': rowData[9] || null
    };

    if (recordId) {
      const { error } = await supabase
        .from('pl-phieu-in')
        .update(updatePayload)
        .eq('id', recordId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('pl-phieu-in')
        .update(updatePayload)
        .eq('Số phiếu', rowData[0]);

      if (error) throw error;
    }

    // Reload data from Supabase
    await loadGoogleSheet();

    // Reset selection
    selectedRowIndex = -1;
    document.getElementById('btnEditData').disabled = true;
    document.getElementById('btnDeleteData').disabled = true;

    // Close modal
    const editDataModalEl = document.getElementById('editDataModal');
    const bsEditData = bootstrap.Modal.getInstance(editDataModalEl);
    if (bsEditData) bsEditData.hide();

    hideLoadingOverlay();

  } catch (error) {
    console.error('Error updating data in Supabase:', error);
    hideLoadingOverlay();
    alert('Lỗi cập nhật dữ liệu: ' + (error.message || error));
  }
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
    pageSelect.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Trang ${i}`;
      if (i === currentPage) opt.selected = true;
      pageSelect.appendChild(opt);
    }
    pageSelect.value = String(currentPage);
  }
}

function formatDateDisplay(dateValue) {
  if (!dateValue) return '';

  const dateObj = parseDate(dateValue);
  if (dateObj) {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return String(dateValue);
}

function selectAndPrint(rowIndex) {
  if (rowIndex < 1 || rowIndex >= tableData.length) return;

  const headerRow = tableData[0];
  const dataRow = tableData[rowIndex];

  // Tìm index của các cột
  const findColIndex = (keywords) => {
    return headerRow.findIndex(h => {
      if (!h) return false;
      const headerLower = String(h).trim().toLowerCase();
      return keywords.some(kw => headerLower.includes(kw.toLowerCase()));
    });
  };

  const soPhieuIdx = findColIndex(['số phiếu', 'sophieu', 'so phieu']);
  const soXeIdx = findColIndex(['số xe', 'soxe', 'so xe']);
  const ngayIdx = findColIndex(['ngày', 'ngay', 'date']);
  const benNhanIdx = findColIndex(['bên nhận', 'benhan', 'ben nhan', 'xưởng', 'xuong', 'đội', 'doi']);
  const matHangIdx = findColIndex(['mặt hàng', 'mathang', 'mat hang', 'tên hàng', 'ten hang']);
  const dvtIdx = findColIndex(['đvt', 'dvt', 'đơn vị', 'don vi', 'đơn vị tính']);
  const trongLuongIdx = findColIndex(['trọng lượng', 'trong luong', 'khối lượng']);

  // Điền dữ liệu vào form
  if (soPhieuIdx >= 0) {
    document.getElementById('soPhieu').value = dataRow[soPhieuIdx] || '';
  }

  if (soXeIdx >= 0) {
    document.getElementById('soXe').value = dataRow[soXeIdx] || '';
  }

  if (ngayIdx >= 0) {
    const ngayValue = dataRow[ngayIdx];
    if (ngayValue) {
      const dateObj = parseDate(ngayValue);
      if (dateObj) {
        document.getElementById('ngay').value = dateObj.toISOString().split('T')[0];
      }
    }
  }

  if (benNhanIdx >= 0) {
    document.getElementById('benNhan').value = dataRow[benNhanIdx] || '';
  }

  // Xóa các dòng hàng hóa cũ và thêm dòng mới
  hangHoaContainer.innerHTML = '';
  addHangHoaRow();

  // Điền hàng hóa
  const matHangInput = document.querySelector('.mat-hang');
  const dvtInput = document.querySelector('.dvt');
  const trongLuongInput = document.querySelector('.trongLuong');

  if (matHangInput && matHangIdx >= 0) matHangInput.value = dataRow[matHangIdx] || '';
  if (dvtInput && dvtIdx >= 0) dvtInput.value = dataRow[dvtIdx] || '';
  if (trongLuongInput && trongLuongIdx >= 0) trongLuongInput.value = dataRow[trongLuongIdx] || '';

  // Cuộn lên đầu form
  document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
}

// =============================================================================
// HANG HOA ROW FUNCTIONS
// =============================================================================

function addHangHoaRow() {
  const row = document.createElement('div');
  row.className = 'row hang-hoa-row';
  // Không có label cho các dòng thêm mới (chỉ dòng đầu tiên mới có label)
  row.innerHTML = `
    <div class="col-md-4">
      <div class="form-group">
        <input type="text" class="form-control mat-hang" name="matHang[]" required>
      </div>
    </div>
    <div class="col-md-3">
      <div class="form-group">
        <input type="text" class="form-control dvt" name="dvt[]" required>
      </div>
    </div>
    <div class="col-md-3">
      <div class="form-group">
        <input type="number" class="form-control trongLuong" name="trongLuong[]" step="0.1" required>
      </div>
    </div>
    <div class="col-md-2 d-flex align-items-end">
      <div class="form-group">
      </div>
    </div>
  `;
  hangHoaContainer.appendChild(row);

  // Cuộn xuống dòng mới thêm
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Focus vào ô nhập liệu đầu tiên của dòng mới
  const firstInput = row.querySelector('input');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 300);
  }

  updateRemoveButtons();
}

function updateRemoveButtons() {
  if (!hangHoaContainer) return;

  const rows = hangHoaContainer.querySelectorAll('.hang-hoa-row');
  const removeButtons = hangHoaContainer.querySelectorAll('.btn-remove-row');

  removeButtons.forEach(btn => {
    btn.classList.toggle('visible', rows.length > 1);
  });
}

// =============================================================================
// FORM DATA FUNCTIONS
// =============================================================================

function getFormData() {
  const soPhieu = document.getElementById('soPhieu').value;
  const soXe = document.getElementById('soXe').value;
  const ngay = document.getElementById('ngay').value;
  const benNhan = document.getElementById('benNhan').value;
  const loaiXuat = document.getElementById('loaiXuat').value;
  const benGiao = document.getElementById('benGiao').value;

  // Lấy danh sách hàng hóa
  const matHangInputs = hangHoaContainer.querySelectorAll('.mat-hang');
  const dvtInputs = hangHoaContainer.querySelectorAll('.dvt');
  const trongLuongInputs = hangHoaContainer.querySelectorAll('.trongLuong');

  const hangHoa = [];
  for (let i = 0; i < matHangInputs.length; i++) {
    hangHoa.push({
      matHang: matHangInputs[i].value,
      dvt: dvtInputs[i].value,
      trongLuong: trongLuongInputs[i].value
    });
  }

  return {
    soPhieu,
    soXe,
    ngay,
    benNhan,
    loaiXuat,
    benGiao,
    hangHoa
  };
}

// =============================================================================
// GOOGLE SHEET FUNCTIONS
// =============================================================================

async function submitToGoogleSheet() {
  const formData = getFormData();

  // Ẩn thông báo cũ
  successMessage.classList.remove('show');
  errorMessage.classList.remove('show');

  // Hiển thị modal preview phiếu
  showPreviewModal(formData);
}

// =============================================================================
// PREVIEW MODAL FUNCTIONS
// =============================================================================

function showPreviewModal(formData) {
  const previewContent = document.getElementById('previewContent');
  if (!previewContent) return;

  // Tạo nội dung phiếu
  let html = `
    <div style="font-family: 'Montserrat', sans-serif; padding: 20px;">
      <h2 style="text-align: center; color: #0d47a1; margin-bottom: 20px;">Phiếu in</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Số phiếu:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.soPhieu}</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Số xe:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.soXe}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Ngày:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.ngay}</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Bên nhận/Xưởng/Đội:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.benNhan}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Loại xuất:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.loaiXuat || ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Bên giao:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.benGiao || ''}</td>
        </tr>
      </table>
      
      <h5>Chi tiết hàng hóa:</h5>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">STT</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Mặt hàng</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">ĐVT</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Trọng lượng</th>
          </tr>
        </thead>
        <tbody>
  `;

  formData.hangHoa.forEach((item, index) => {
    html += `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${index + 1}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${item.matHang}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${item.dvt}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${item.trongLuong ? (parseVietnameseFloat(item.trongLuong) || 0).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : ''}</td>
          </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  previewContent.innerHTML = html;

  // Hiển thị modal
  const modalEl = document.getElementById('previewModal');
  setupModalPermissions(modalEl);
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// Xử lý nút In phiếu trong modal
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'btnInPhieu') {
    const formData = getFormData();

    // Mở form-in.html trong cửa sổ mới với tham số autoPrint
    const formInWindow = window.open('form-in.html?autoPrint=true', '_blank');

    // Đợi cửa sổ mới tải xong rồi gửi dữ liệu
    if (formInWindow) {
      formInWindow.addEventListener('load', function () {
        formInWindow.postMessage({ type: 'phieuInData', payload: formData }, '*');
      });

      // Nếu cửa sổ đã tải xong, gửi dữ liệu ngay
      if (formInWindow.document.readyState === 'complete') {
        formInWindow.postMessage({ type: 'phieuInData', payload: formData }, '*');
      }
    }

    // Đóng modal preview
    const modal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
    if (modal) {
      modal.hide();
    }
  }
});

// =============================================================================
// PREVIEW FUNCTIONS
// =============================================================================

// Preview is now handled by showPreviewModal() in PREVIEW MODAL FUNCTIONS section


