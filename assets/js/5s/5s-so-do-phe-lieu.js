/* =============================================================================
   5S SƠ ĐỒ KHO PHẾ LIỆU - JAVASCRIPT
   Tích hợp trực tiếp dữ liệu từ bảng Supabase 'pl-can-thu', bộ lọc theo Kỳ đổ,
   phân tích chi tiết theo xưởng, SWR cache và hỗ trợ Dark/Light mode.
   ============================================================================= */

(function () {
  'use strict';

  const TABLE_NAME = 'pl-can-thu';

  // Định nghĩa danh sách 10 khu vực mặt bằng 5S kho phế liệu (chuẩn tỷ lệ 96m x 11m)
  const INITIAL_AREAS = [
    {
      id: 'thung-son',
      name: 'Thùng sơn',
      fullName: 'Phế liệu Thùng sơn',
      description: 'Khu vực lưu trữ các loại thùng sơn cũ, vỏ thùng kim loại và nhựa.',
      color: '#f6ad82',
      top: '0%',
      left: '0%',
      width: '100%',
      height: '6%',
      maxCapacity: 3.5,
      unit: 'tấn',
      keywords: ['thùng sơn', 'thung son', 'vỏ thùng', 'vo thung', 'son'],
      info: ['Diện tích: 82m²', 'Định mức: 3.5 tấn']
    },
    {
      id: 'go',
      name: 'Gỗ',
      fullName: 'Phế liệu Gỗ vụn',
      description: 'Khu vực tập kết gỗ vụn, pallet hỏng và các phế phẩm từ gỗ.',
      color: '#f6ad82',
      top: '6.5%',
      left: '0%',
      width: '100%',
      height: '6%',
      maxCapacity: 10,
      unit: 'tấn',
      keywords: ['gỗ', 'go', 'pallet', 'gỗ vụn'],
      info: ['Diện tích: 82m²', 'Định mức: 10 tấn']
    },
    {
      id: 'loai-1',
      name: 'Loại 1',
      fullName: 'Phế liệu Loại 1',
      description: 'Khu vực phế liệu cao cấp (Loại 1, thầu phụ, thùng thuốc hàn, tân cảng).',
      color: '#f3a678',
      top: '13%',
      left: '0%',
      width: '100%',
      height: '45%',
      maxCapacity: 350,
      unit: 'tấn',
      keywords: ['loại 1', 'loai 1', 'thầu phụ', 'thau phu', 'thùng thuốc hàn', 'thuoc han', 'tân cảng', 'tan cang'],
      info: ['Diện tích: 522m²', 'Định mức: 350 tấn']
    },
    {
      id: 'day-dai',
      name: 'Dây đai',
      fullName: 'Phế liệu Dây đai',
      description: 'Khu vực chứa các loại dây đai nhựa, dây đai thép từ kiện hàng.',
      color: '#f6ad82',
      top: '58.5%',
      left: '0%',
      width: '100%',
      height: '4%',
      maxCapacity: 10,
      unit: 'tấn',
      keywords: ['dây đai', 'day dai', 'đai thép', 'dai thep'],
      info: ['Diện tích: 55m²', 'Định mức: 10 tấn']
    },
    {
      id: 'mat-khoan',
      name: 'Mạt khoan',
      fullName: 'Phế liệu Mạt khoan & Dây hàn',
      description: 'Khu vực thu gom mạt sắt, mạt khoan gia công và dây hàn.',
      color: '#f6ad82',
      top: '63%',
      left: '16%',
      width: '84%',
      height: '4%',
      maxCapacity: 15,
      unit: 'tấn',
      keywords: ['mạt khoan', 'mat khoan', 'dây hàn', 'day han'],
      info: ['Diện tích: 45m²', 'Định mức: 15 tấn']
    },
    {
      id: 'my-thuy',
      name: 'Mỹ Thủy',
      fullName: 'Phế liệu Dự án Mỹ Thủy',
      description: 'Khu vực phế liệu đặc thù từ dự án Cầu Mỹ Thủy (Nam Anh, Thăng Long...).',
      color: '#f3a678',
      top: '67.5%',
      left: '16%',
      width: '84%',
      height: '12%',
      maxCapacity: 100,
      unit: 'tấn',
      keywords: ['mỹ thủy', 'my thuy', 'mỹ thuỷ', 'nam anh', 'thăng long'],
      info: ['Diện tích: 135m²', 'Định mức: 100 tấn']
    },
    {
      id: 'inox',
      name: 'Inox',
      fullName: 'Khu vực Phế liệu Inox',
      description: 'Khu vực chứa phế liệu Inox (304, 409), thép không gỉ.',
      color: '#f6ad82',
      top: '80%',
      left: '33%',
      width: '13.5%',
      height: '4%',
      maxCapacity: 2,
      unit: 'tấn',
      keywords: ['inox', 'inox 304', 'inox 409', 'thép không gỉ'],
      info: ['Diện tích: 5m²', 'Định mức: 2 tấn']
    },
    {
      id: 'tram-dien',
      name: 'Trạm điện AH1',
      fullName: 'Khu vực Trạm điện AH1',
      description: 'Khu vực kỹ thuật trạm điện, tuyệt đối không để phế liệu lấn chiếm.',
      color: '#e2e8f0',
      top: '80%',
      left: '47%',
      width: '53%',
      height: '4%',
      maxCapacity: 0,
      unit: '',
      keywords: [],
      info: ['Khu kỹ thuật', 'Nghiêm cấm để vật cản']
    },
    {
      id: 'vo-xe',
      name: 'Vỏ xe',
      fullName: 'Phế liệu Vỏ xe',
      description: 'Khu vực tập kết lốp xe cũ, cao su phế phẩm.',
      color: '#f6ad82',
      top: '84.5%',
      left: '33%',
      width: '67%',
      height: '4%',
      maxCapacity: 50,
      unit: 'cái',
      keywords: ['vỏ xe', 'vo xe', 'lốp xe', 'lop xe'],
      info: ['Diện tích: 22m²', 'Định mức: 50 cái']
    },
    {
      id: 'tap-ket',
      name: 'Tập kết',
      fullName: 'Khu vực tập kết thùng rỗng và sỉ',
      description: 'Khu vực đa năng tập kết thùng rỗng, sỉ cắt, sỉ đất, sắt dính sỉ.',
      color: '#f6ad82',
      top: '63%',
      left: '0%',
      width: '15.5%',
      height: '25.5%',
      maxCapacity: 50,
      unit: 'tấn',
      keywords: ['sỉ cắt', 'si cat', 'sỉ đất', 'si dat', 'sắt dính sỉ', 'sat dinh si', 'tập kết', 'thùng rỗng'],
      info: ['Diện tích: 80m²', 'Định mức: 50 tấn']
    }
  ];

  // State
  let rawRows = [];
  let availablePeriods = [];
  let selectedPeriod = sessionStorage.getItem('pl5s_selected_period') || '';
  let searchQuery = '';
  let isLoading = true;
  let lastUpdatedTime = null;
  let errorMessage = null;
  let calculatedAreas = [];

  // ==================== UTILITY FUNCTIONS ====================
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  function formatDate(dateValue) {
    if (!dateValue) return '';
    let date = null;
    if (typeof dateValue === 'string') {
      const iso = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        date = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
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
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }

  // ==================== SCRAP MAPPING ENGINE ====================
  function matchAreaForScrapType(scrapTypeName) {
    if (!scrapTypeName) return null;
    const lower = scrapTypeName.trim().toLowerCase();

    // 1. Kiểm tra Mỹ Thủy trước
    if (lower.includes('mỹ thủy') || lower.includes('my thuy') || lower.includes('mỹ thuỷ') || lower.includes('nam anh') || lower.includes('thăng long')) {
      return 'my-thuy';
    }

    // 2. Kiểm tra các khu vực theo từ khóa
    for (const area of INITIAL_AREAS) {
      if (area.id === 'tram-dien' || area.id === 'my-thuy') continue;
      for (const kw of area.keywords) {
        if (lower.includes(kw) || kw.includes(lower)) {
          return area.id;
        }
      }
    }

    // 3. Fallback: Nếu chứa từ sắt, thép, phế thì mặc định phân vào Loại 1
    if (lower.includes('sắt') || lower.includes('thép') || lower.includes('phế') || lower.includes('loại')) {
      return 'loai-1';
    }
    return 'tap-ket';
  }

  function calculateAreaCapacities() {
    // 1. Lọc bản ghi theo kỳ đổ
    const filteredRows = selectedPeriod === 'ALL' || !selectedPeriod
      ? rawRows
      : rawRows.filter(r => (r['Kì đổ'] || '').trim() === selectedPeriod);

    // 2. Gom nhóm theo khu vực
    const areaStats = {};
    INITIAL_AREAS.forEach(a => {
      areaStats[a.id] = {
        totalKg: 0,
        count: 0,
        workshops: {},
        scrapSubtypes: {},
        records: []
      };
    });

    filteredRows.forEach(row => {
      const type = (row['Loại phế liệu'] || '').trim();
      const workshop = (row['Xưởng'] || 'Chưa rõ').trim();
      const rawAmount = row['Số lượng (kg)'];
      const kg = Number(rawAmount) || 0;
      if (kg <= 0 && !type) return;

      const matchedAreaId = matchAreaForScrapType(type);
      if (matchedAreaId && areaStats[matchedAreaId]) {
        const stat = areaStats[matchedAreaId];
        stat.totalKg += kg;
        stat.count += 1;
        stat.workshops[workshop] = (stat.workshops[workshop] || 0) + kg;
        stat.scrapSubtypes[type] = (stat.scrapSubtypes[type] || 0) + kg;
        stat.records.push({
          date: formatDate(row['Ngày']),
          workshop: workshop,
          scrapType: type,
          kg: kg,
          notes: row['Ghi chú'] || ''
        });
      }
    });

    // 3. Tính toán công suất và % cho từng khu vực
    calculatedAreas = INITIAL_AREAS.map(area => {
      if (area.id === 'tram-dien') {
        return {
          ...area,
          capacity: 0,
          percentage: 0,
          totalKg: 0,
          workshops: {},
          scrapSubtypes: {},
          records: []
        };
      }

      const stat = areaStats[area.id] || { totalKg: 0, workshops: {}, scrapSubtypes: {}, records: [] };
      const capacity = area.id === 'vo-xe' ? Math.round(stat.totalKg) : Number((stat.totalKg / 1000).toFixed(3));
      const percentage = area.maxCapacity > 0 ? Math.min((capacity / area.maxCapacity) * 100, 100) : 0;

      return {
        ...area,
        capacity,
        percentage,
        totalKg: stat.totalKg,
        workshops: stat.workshops,
        scrapSubtypes: stat.scrapSubtypes,
        records: stat.records
      };
    });
  }

  // ==================== DATA FETCHING ====================
  async function loadData(forceFresh = false) {
    isLoading = true;
    errorMessage = null;
    render();

    try {
      // 1. Instant Cache Render (0ms)
      if (!forceFresh && typeof getStoredTableCache === 'function') {
        const cached = getStoredTableCache(TABLE_NAME);
        if (Array.isArray(cached) && cached.length > 0) {
          processRawData(cached);
          isLoading = false;
          render();
        }
      }

      // 2. Fetch fresh data from Supabase
      const freshData = typeof fetchAllFromSupabase === 'function'
        ? await fetchAllFromSupabase(TABLE_NAME, '*', 'id', true)
        : await (async () => {
          const { data, error } = await window.supabase.from(TABLE_NAME).select('*').order('id', { ascending: true });
          if (error) throw error;
          return data || [];
        })();

      if (typeof setStoredTableCache === 'function') {
        setStoredTableCache(TABLE_NAME, freshData);
      }

      processRawData(freshData);
      lastUpdatedTime = new Date().toLocaleTimeString('vi-VN');
      isLoading = false;
      render();
    } catch (err) {
      console.error('Lỗi tải dữ liệu kho phế liệu:', err);
      errorMessage = err.message || 'Không thể kết nối cơ sở dữ liệu Supabase';
      isLoading = false;
      render();
    }
  }

  function processRawData(data) {
    rawRows = data || [];

    // Trích xuất danh sách các kỳ đổ duy nhất
    const periodsSet = new Set();
    rawRows.forEach(r => {
      const p = (r['Kì đổ'] || '').trim();
      if (p) periodsSet.add(p);
    });

    // Sắp xếp kỳ đổ theo số thứ tự (Kỳ 1, Kỳ 2...)
    availablePeriods = Array.from(periodsSet).sort((a, b) => {
      const matchA = a.match(/\d+/);
      const matchB = b.match(/\d+/);
      const numA = matchA ? parseInt(matchA[0], 10) : 0;
      const numB = matchB ? parseInt(matchB[0], 10) : 0;
      return numA - numB;
    });

    // Khởi tạo kỳ đổ được chọn nếu chưa có
    if (!selectedPeriod || (selectedPeriod !== 'ALL' && !availablePeriods.includes(selectedPeriod))) {
      const saved = sessionStorage.getItem('pl5s_selected_period');
      if (saved && (saved === 'ALL' || availablePeriods.includes(saved))) {
        selectedPeriod = saved;
      } else {
        // Mặc định chọn Kỳ mới nhất
        selectedPeriod = availablePeriods.length > 0 ? availablePeriods[availablePeriods.length - 1] : 'ALL';
      }
    }

    calculateAreaCapacities();
  }

  // ==================== EXPORT EXCEL ====================
  function exportToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('Thư viện Excel đang tải, vui lòng thử lại sau giây lát!');
      return;
    }

    const filteredRows = selectedPeriod === 'ALL' || !selectedPeriod
      ? rawRows
      : rawRows.filter(r => (r['Kì đổ'] || '').trim() === selectedPeriod);

    const exportData = filteredRows.map((r, index) => {
      const matchedId = matchAreaForScrapType(r['Loại phế liệu']);
      const area = INITIAL_AREAS.find(a => a.id === matchedId);
      return {
        'STT': index + 1,
        'Ngày': formatDate(r['Ngày']),
        'Kỳ đổ': r['Kì đổ'] || '',
        'Xưởng': r['Xưởng'] || '',
        'Loại phế liệu': r['Loại phế liệu'] || '',
        'Số lượng (kg)': r['Số lượng (kg)'] || 0,
        'Ghi chú': r['Ghi chú'] || '',
        'Khu vực 5S': area ? area.name : 'Khác'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PheLieu_5S');

    const sanitizedPeriod = (selectedPeriod || 'Tat_Ca').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `So_Do_Kho_Phe_Lieu_${sanitizedPeriod}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // ==================== MODAL CHI TIẾT KHU VỰC ====================
  window.openScrapAreaModal = function (areaId) {
    if (areaId === 'tram-dien') return;
    const area = calculatedAreas.find(a => a.id === areaId);
    if (!area) return;

    const modalContent = document.getElementById('scrapDetailModalContent');
    if (!modalContent) return;

    const workshopEntries = Object.entries(area.workshops || {}).sort((a, b) => b[1] - a[1]);
    const totalWorkshopKg = workshopEntries.reduce((sum, item) => sum + item[1], 0);

    modalContent.innerHTML = `
      <div class="modal-header bg-gradient-to-r from-red-600 to-orange-600 text-white p-4">
        <div>
          <h5 class="modal-title font-bold text-lg flex items-center gap-2" id="scrapDetailModalLabel">
            <i data-lucide="map-pin" class="w-5 h-5"></i>
            ${area.fullName}
          </h5>
          <p class="text-xs text-red-100 opacity-90 mt-0.5">${area.description}</p>
        </div>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>

      <div class="modal-body p-4 space-y-4">
        <!-- Tổng quan công suất -->
        <div class="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div class="text-center">
            <span class="text-[10px] uppercase font-bold text-gray-400 block">Đang chứa</span>
            <span class="text-lg font-black text-gray-800">${formatNumber(area.capacity, area.unit === 'tấn' ? 3 : 0)} ${area.unit}</span>
          </div>
          <div class="text-center">
            <span class="text-[10px] uppercase font-bold text-gray-400 block">Định mức tối đa</span>
            <span class="text-lg font-black text-gray-500">${formatNumber(area.maxCapacity, 0)} ${area.unit}</span>
          </div>
          <div class="text-center">
            <span class="text-[10px] uppercase font-bold text-gray-400 block">Tỷ lệ lấp đầy</span>
            <span class="text-lg font-black ${area.percentage > 90 ? 'text-red-500' : area.percentage > 70 ? 'text-orange-500' : 'text-green-500'}">
              ${formatNumber(area.percentage, 1)}%
            </span>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div class="h-full transition-all duration-500 ${area.percentage > 90 ? 'bg-red-500' : area.percentage > 70 ? 'bg-orange-500' : 'bg-green-500'}" style="width: ${area.percentage}%"></div>
        </div>

        <!-- Tabs Navigation -->
        <ul class="nav nav-pills nav-fill gap-2 border-b border-gray-200 pb-2" id="scrapModalTab" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active py-2 text-xs font-bold rounded-lg" id="workshop-tab" data-bs-toggle="tab" data-bs-target="#workshop-tab-pane" type="button" role="tab">
              🏭 Phân rã theo Xưởng (${workshopEntries.length})
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link py-2 text-xs font-bold rounded-lg" id="detail-tab" data-bs-toggle="tab" data-bs-target="#detail-tab-pane" type="button" role="tab">
              📋 Danh sách lần đổ (${(area.records || []).length})
            </button>
          </li>
        </ul>

        <div class="tab-content" id="scrapModalTabContent">
          <!-- Tab 1: Phân rã theo xưởng -->
          <div class="tab-pane fade show active" id="workshop-tab-pane" role="tabpanel">
            ${workshopEntries.length === 0 ? `
              <div class="text-center py-6 text-gray-400 text-xs">Chưa có xưởng nào đổ phế liệu vào khu vực này trong kỳ đang chọn.</div>
            ` : `
              <div class="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                ${workshopEntries.map(([ws, kg]) => {
                  const percent = totalWorkshopKg > 0 ? (kg / totalWorkshopKg) * 100 : 0;
                  return `
                    <div class="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-100 transition-colors">
                      <div class="flex justify-between items-center mb-1 text-xs">
                        <span class="font-bold text-gray-800">Xưởng: ${ws}</span>
                        <span class="font-bold text-red-600">${formatNumber(kg, 1)} kg <span class="text-gray-400 text-[10px]">(${formatNumber(percent, 1)}%)</span></span>
                      </div>
                      <div class="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-red-500 to-orange-400" style="width: ${percent}%"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Tab 2: Danh sách chi tiết lần đổ -->
          <div class="tab-pane fade" id="detail-tab-pane" role="tabpanel">
            ${(!area.records || area.records.length === 0) ? `
              <div class="text-center py-6 text-gray-400 text-xs">Không có dữ liệu chi tiết lần đổ.</div>
            ` : `
              <div class="table-responsive max-h-64 overflow-y-auto custom-scrollbar border rounded-lg">
                <table class="table table-sm table-hover mb-0 text-xs">
                  <thead class="table-light sticky top-0">
                    <tr>
                      <th class="py-2 px-3">Ngày</th>
                      <th class="py-2 px-3">Xưởng</th>
                      <th class="py-2 px-3">Loại phế liệu</th>
                      <th class="py-2 px-3 text-end">Số lượng (kg)</th>
                      <th class="py-2 px-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${area.records.map(rec => `
                      <tr>
                        <td class="py-1.5 px-3 text-gray-500 whitespace-nowrap">${rec.date}</td>
                        <td class="py-1.5 px-3 font-semibold text-gray-800">${rec.workshop}</td>
                        <td class="py-1.5 px-3">${rec.scrapType}</td>
                        <td class="py-1.5 px-3 text-end font-bold text-red-600">${formatNumber(rec.kg, 1)}</td>
                        <td class="py-1.5 px-3 text-gray-400 italic">${rec.notes || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      </div>

      <div class="modal-footer p-3 bg-gray-50 border-t border-gray-100 flex justify-end">
        <button type="button" class="btn btn-sm btn-secondary px-4 font-semibold rounded-lg" data-bs-dismiss="modal">Đóng</button>
      </div>
    `;

    lucide.createIcons();

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modalEl = document.getElementById('scrapDetailModal');
      const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
      bsModal.show();
    }
  };

  // ==================== THEME TOGGLE ====================
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('ddc_theme', newTheme);
    render();
  }

  // ==================== MAIN RENDER ====================
  function render() {
    const app = document.getElementById('app');
    if (!app) return;

    const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
    const totalKg = calculatedAreas.reduce((sum, a) => sum + (a.totalKg || 0), 0);
    const totalTon = (totalKg / 1000).toFixed(3);
    const dangerCount = calculatedAreas.filter(a => a.id !== 'tram-dien' && a.percentage > 90).length;
    const safeCount = calculatedAreas.filter(a => a.id !== 'tram-dien' && a.percentage < 70).length;

    // Không dùng thẻ <header> để tránh xung đột với style fixed từ home.css
    app.innerHTML = `
      <!-- 1. Header & Actions Toolbar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-[#2b324a]">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-[#3b1d24] text-red-700 dark:text-red-400">
              <i data-lucide="recycle" class="w-3.5 h-3.5 me-1"></i> Quản Lý Kho 5S
            </span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-[#064e3b] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 me-1.5 animate-ping"></span> Realtime Supabase
            </span>
          </div>
          <h1 class="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            SƠ ĐỒ KHO PHẾ LIỆU
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Mặt bằng quản lý trực quan phế liệu theo định mức tải (96m x 11m)
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button id="btn-theme-toggle" class="btn btn-sm btn-outline-secondary d-flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" title="Chuyển Sáng / Tối">
            <i data-lucide="${currentTheme === 'dark' ? 'sun' : 'moon'}" class="w-4 h-4"></i>
            <span class="text-xs font-semibold">${currentTheme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</span>
          </button>
          <button id="btn-refresh" class="btn btn-sm btn-outline-secondary d-flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" ${isLoading ? 'disabled' : ''}>
            <i data-lucide="refresh-cw" class="w-4 h-4 ${isLoading ? 'animate-spin' : ''}"></i>
            <span class="text-xs font-semibold">${isLoading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
          <button id="btn-export-excel" class="btn btn-sm btn-success d-flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm font-semibold">
            <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>
            <span class="text-xs">Xuất Excel</span>
          </button>
        </div>
      </div>

      <!-- 2. Quick KPI Summary Banner (4 Cột Chuẩn 5S) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <!-- Card 1: Tổng khối lượng -->
        <div class="kpi-card bg-gradient-to-br from-red-50 to-white dark:from-[#2d1a21] dark:to-[#1a1d2d] border border-red-100 dark:border-[#45242c] rounded-xl p-3.5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">Tổng khối lượng</span>
            <div class="w-8 h-8 rounded-lg bg-red-100 dark:bg-[#451c24] text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-bold">
              <i data-lucide="weight" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-1.5">
            <span class="text-2xl font-extrabold text-slate-900 dark:text-white">${formatNumber(totalTon, 2)}</span>
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">tấn</span>
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Quy đổi:</span>
            <span class="font-medium text-red-600 dark:text-red-400">${formatNumber(totalKg, 0)} kg</span>
          </div>
        </div>

        <!-- Card 2: Cảnh báo đầy -->
        <div class="kpi-card bg-gradient-to-br from-orange-50 to-white dark:from-[#2d211a] dark:to-[#1a1d2d] border border-orange-100 dark:border-[#453124] rounded-xl p-3.5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Cảnh báo đầy (&gt;90%)</span>
            <div class="w-8 h-8 rounded-lg bg-orange-100 dark:bg-[#453124] text-orange-600 dark:text-orange-400 flex items-center justify-center text-sm font-bold">
              <i data-lucide="alert-triangle" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-1.5">
            <span class="text-2xl font-extrabold ${dangerCount > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}">${dangerCount}</span>
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">khu vực</span>
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Cần thu gom</span>
            <span class="font-medium text-orange-600 dark:text-orange-400">${dangerCount > 0 ? 'Quá tải' : 'An toàn'}</span>
          </div>
        </div>

        <!-- Card 3: An toàn -->
        <div class="kpi-card bg-gradient-to-br from-emerald-50 to-white dark:from-[#122e23] dark:to-[#1a1d2d] border border-emerald-100 dark:border-[#1c4d3f] rounded-xl p-3.5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">An toàn (&lt;70%)</span>
            <div class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-[#1c4d3f] text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-1.5">
            <span class="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">${safeCount}</span>
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">khu vực</span>
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Còn nhiều sức chứa</span>
            <span class="font-medium text-emerald-600 dark:text-emerald-400">${calculatedAreas.length > 1 ? Math.round((safeCount / (calculatedAreas.length - 1)) * 100) : 0}%</span>
          </div>
        </div>

        <!-- Card 4: Kỳ đổ hiện tại -->
        <div class="kpi-card bg-gradient-to-br from-blue-50 to-white dark:from-[#17253b] dark:to-[#1a1d2d] border border-blue-100 dark:border-[#22385c] rounded-xl p-3.5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Kỳ đổ hiện tại</span>
            <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-[#1e3a66] text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">
              <i data-lucide="calendar" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="mt-2">
            <span class="text-xs font-bold text-blue-600 dark:text-blue-400 truncate block" title="${selectedPeriod}">
              ${selectedPeriod === 'ALL' ? 'Tất cả các kỳ đổ' : selectedPeriod}
            </span>
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Đồng bộ:</span>
            <span class="font-medium text-slate-700 dark:text-slate-300">${lastUpdatedTime || '--:--'}</span>
          </div>
        </div>
      </div>

      <!-- 3. Filter & Search Toolbar (Thanh Công Cụ Tinh Gọn) -->
      <div class="bg-slate-50 dark:bg-[#141724] p-3 rounded-xl border border-slate-200 dark:border-[#2b324a] mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <!-- Lọc kỳ đổ -->
        <div class="flex items-center gap-2 w-full md:w-auto">
          <label for="select-period" class="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap flex items-center gap-1.5">
            <i data-lucide="calendar-range" class="w-4 h-4 text-red-500"></i>
            Kỳ Đổ:
          </label>
          <select id="select-period" class="form-select form-select-sm font-semibold rounded-lg w-full md:w-64 border-slate-200 dark:border-[#2e3652] dark:bg-[#1a1d2d] dark:text-white">
            <option value="ALL" ${selectedPeriod === 'ALL' ? 'selected' : ''}>-- Tất cả các kỳ đổ --</option>
            ${availablePeriods.map(p => `
              <option value="${p}" ${selectedPeriod === p ? 'selected' : ''}>${p}</option>
            `).join('')}
          </select>
        </div>

        <!-- Tìm kiếm -->
        <div class="relative flex-1 max-w-md w-full">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
          <input 
            type="text" 
            id="input-search" 
            class="form-control form-control-sm pl-9 rounded-lg text-xs border-slate-200 dark:border-[#2e3652] dark:bg-[#1a1d2d] dark:text-white" 
            placeholder="Tìm xưởng (AH1, AH2...), loại phế liệu (Mỹ Thủy, Inox...)"
            value="${searchQuery}"
          >
        </div>
      </div>

      ${errorMessage ? `
        <div class="mb-4 p-3 bg-red-50 dark:bg-[#331118] border border-red-200 dark:border-[#6b1426] text-red-600 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
          <i data-lucide="alert-circle" class="w-4 h-4"></i>
          <span>${errorMessage}</span>
        </div>
      ` : ''}

      <!-- 4. Main Layout: 2 Cột Cân Đối (Bản đồ kho bên trái & Bảng trạng thái bên phải) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <!-- Left Column: Bản đồ sơ đồ kho (Tối ưu vừa vặn màn hình) -->
        <div class="lg:col-span-7 xl:col-span-7 bg-slate-50 dark:bg-[#141724] p-4 rounded-2xl border border-slate-200 dark:border-[#2b324a] flex flex-col items-center">
          <div class="w-full flex items-center justify-between mb-3 px-1">
            <div class="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <i data-lucide="map" class="w-4 h-4 text-red-500"></i>
              <span class="text-xs font-bold uppercase tracking-wider">Mặt bằng kho trực tuyến</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">&lt;70%</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">70-90%</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">&gt;90%</span>
              </div>
            </div>
          </div>

          <!-- Khung bản đồ có kích thước cố định vừa vặn chiều cao màn hình (540px) -->
          <div class="relative w-full max-w-[420px] h-[540px] border-2 border-slate-300 dark:border-[#2e3652] rounded-xl bg-white dark:bg-[#10121c] p-2 shadow-sm">
            <!-- Scale Indicators -->
            <div class="absolute right-0 top-2 bottom-2 flex items-center justify-end pointer-events-none z-0">
              <div class="h-full border-r border-slate-400 dark:border-slate-600 relative">
                <div class="absolute top-0 right-0 w-2 h-px bg-slate-400 dark:bg-slate-600"></div>
                <div class="absolute bottom-0 right-0 w-2 h-px bg-slate-400 dark:bg-slate-600"></div>
              </div>
              <span class="text-[9px] text-slate-400 font-semibold absolute right-[-14px] top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
                96m (1:340)
              </span>
            </div>

            <div class="absolute bottom-0 left-2 right-2 flex flex-col items-center justify-end pointer-events-none z-0">
              <div class="w-full border-b border-slate-400 dark:border-slate-600 relative">
                <div class="absolute left-0 bottom-0 w-px h-2 bg-slate-400 dark:bg-slate-600"></div>
                <div class="absolute right-0 bottom-0 w-px h-2 bg-slate-400 dark:bg-slate-600"></div>
              </div>
              <span class="text-[9px] text-slate-400 font-semibold absolute bottom-[-14px] left-1/2 -translate-x-1/2 whitespace-nowrap">
                11m (1:50)
              </span>
            </div>

            <!-- Map Areas -->
            <div class="relative w-full h-full" id="map-container">
              ${calculatedAreas.map(area => {
                const isShort = parseFloat(area.height) <= 10;
                const isHighlight = searchQuery && (
                  area.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  Object.keys(area.workshops || {}).some(ws => ws.toLowerCase().includes(searchQuery.toLowerCase())) ||
                  Object.keys(area.scrapSubtypes || {}).some(st => st.toLowerCase().includes(searchQuery.toLowerCase()))
                );

                return `
                  <div
                    data-id="${area.id}"
                    onclick="openScrapAreaModal('${area.id}')"
                    class="map-area absolute flex flex-col items-center justify-center text-center p-1 overflow-hidden rounded-lg transition-all ${area.id === 'tram-dien' ? 'cursor-default' : 'cursor-pointer'} ${isHighlight ? 'area-highlight' : ''}"
                    style="
                      top: ${area.top};
                      left: ${area.left};
                      width: ${area.width};
                      height: ${area.height};
                      background-color: ${area.color};
                      border: 1px solid rgba(255, 255, 255, 0.85);
                      z-index: 1;
                    "
                    title="${area.fullName} - Bấm để xem chi tiết"
                  >
                    <div class="flex flex-col items-center justify-center w-full h-full gap-0.5">
                      <div class="flex items-center justify-center ${isShort ? 'flex-row gap-1.5' : 'flex-col gap-0.5'}">
                        <span class="font-extrabold text-slate-900 leading-tight ${area.id === 'loai-1' ? 'text-base sm:text-lg' : isShort ? 'text-[9px] sm:text-[10px]' : 'text-xs'}">
                          ${area.name}
                        </span>
                        ${area.id !== 'tram-dien' ? `
                          <span class="font-bold text-slate-900 leading-none ${isShort ? 'text-[8px] bg-white/60 px-1 py-0.5 rounded' : 'text-[10px]'}">
                            ${formatNumber(area.capacity, area.unit === 'tấn' ? 2 : 0)} ${area.unit}
                          </span>
                        ` : ''}
                      </div>

                      ${area.id !== 'tram-dien' ? `
                        <div class="w-[85%] bg-white/70 rounded-full overflow-hidden shadow-inner ${isShort ? 'h-1 max-w-[50px]' : 'h-1.5 max-w-[90px]'}">
                          <div 
                            class="h-full transition-all duration-500 ${area.percentage > 90 ? 'bg-red-600' : area.percentage > 70 ? 'bg-orange-500' : 'bg-green-600'}"
                            style="width: ${area.percentage}%"
                          ></div>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Right Column: Bảng trạng thái chi tiết từng khu vực -->
        <div class="lg:col-span-5 xl:col-span-5 bg-slate-50 dark:bg-[#141724] p-4 rounded-2xl border border-slate-200 dark:border-[#2b324a]">
          <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-[#2b324a]">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Trạng Thái Từng Khu Vực</span>
            <span class="text-[10px] bg-slate-200 dark:bg-[#202538] text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-full">
              ${calculatedAreas.length - 1} khu vực
            </span>
          </div>

          <div class="max-h-[490px] overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
            ${calculatedAreas.filter(a => a.id !== 'tram-dien').map(area => {
              return `
                <div 
                  onclick="openScrapAreaModal('${area.id}')"
                  class="status-item p-2.5 rounded-xl border border-slate-200 dark:border-[#2b324a] bg-white dark:bg-[#1a1d2d] hover:border-red-400 dark:hover:border-red-500 cursor-pointer transition-all flex flex-col gap-1.5 shadow-2xs"
                  title="Bấm để xem phân rã xưởng"
                >
                  <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-slate-800 dark:text-slate-100">${area.name}</span>
                    <span class="font-semibold text-slate-600 dark:text-slate-300">
                      ${formatNumber(area.capacity, area.unit === 'tấn' ? 2 : 0)} / ${formatNumber(area.maxCapacity, 0)} ${area.unit}
                    </span>
                  </div>

                  <div class="w-full bg-slate-100 dark:bg-[#202538] h-2 rounded-full overflow-hidden">
                    <div 
                      class="h-full transition-all duration-500 ${area.percentage > 90 ? 'bg-red-500' : area.percentage > 70 ? 'bg-orange-500' : 'bg-green-500'}"
                      style="width: ${area.percentage}%"
                    ></div>
                  </div>

                  <div class="flex justify-between items-center text-[11px] text-slate-400 dark:text-slate-400">
                    <span>${(area.records || []).length} lượt đổ</span>
                    <span class="font-bold ${area.percentage > 90 ? 'text-red-500' : area.percentage > 70 ? 'text-orange-500' : 'text-green-500'}">
                      ${formatNumber(area.percentage, 1)}%
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    lucide.createIcons();
    attachEvents();
  }

  // ==================== EVENT LISTENERS ====================
  function attachEvents() {
    // Theme toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleTheme);
    }

    // Refresh data
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => loadData(true));
    }

    // Export Excel
    const exportBtn = document.getElementById('btn-export-excel');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportToExcel);
    }

    // Period select
    const periodSelect = document.getElementById('select-period');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        selectedPeriod = e.target.value;
        sessionStorage.setItem('pl5s_selected_period', selectedPeriod);
        calculateAreaCapacities();
        render();
      });
    }

    // Search input with debounce
    const searchInput = document.getElementById('input-search');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        searchQuery = (e.target.value || '').trim();
        render();
      }, 250));
    }
  }

  // Khởi chạy
  render();
  loadData();

  // Tự động làm mới mỗi 5 phút
  setInterval(() => {
    loadData(true);
  }, 5 * 60 * 1000);

})();