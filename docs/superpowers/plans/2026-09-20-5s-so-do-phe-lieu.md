# Kế Hoạch Thực Thi: Nâng Cấp Sơ Đồ Kho Phế Liệu 5S (5s-so-do-phe-lieu)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn diện trang `pages/5s/5s-so-do-phe-lieu.html` sang nạp dữ liệu trực tiếp từ bảng Supabase `pl-can-thu`, hỗ trợ lọc theo các Kỳ đổ (mặc định kỳ mới nhất), phân rã chi tiết theo xưởng và đồng bộ giao diện Dark/Light mode chuẩn 5S.

**Architecture:** Sử dụng kiến trúc SWR (Stale-While-Revalidate) đọc cache tức thì rồi ngầm fetch từ Supabase bảng `pl-can-thu`. Bộ Scrap Mapping Engine phân loại từng dòng phế liệu vào 10 khu vực kho theo định mức tải, cập nhật KPI động, hỗ trợ Modal chi tiết phân tích theo Xưởng và xuất Excel.

**Tech Stack:** Vanilla JS (ES6+), Supabase JS Client v2, Tailwind CSS (Selector dark mode), Bootstrap 5.3.3 Modal & Utilities, Lucide Icons, SheetJS (XLSX).

## Global Constraints
- Nguồn dữ liệu bảng: `pl-can-thu` trong Supabase (`assets/js/core/supabase-config.js`).
- Mặc định chọn Kỳ đổ mới nhất, có tùy chọn xem Tất cả các kỳ (`ALL`), lưu kỳ chọn vào `sessionStorage` key `pl5s_selected_period`.
- Bắt buộc hỗ trợ đầy đủ Dark Theme và Light Theme (chống chớp trắng bằng inline script).
- Sau khi hoàn thành phải chạy `node scripts/sync-dist.js` để đồng bộ ra `dist/`, `public/`, `dist-app/`.

---

### Task 1: Cập Nhật Cấu Trúc HTML `pages/5s/5s-so-do-phe-lieu.html`

**Files:**
- Modify: `pages/5s/5s-so-do-phe-lieu.html`

**Interfaces:**
- Consumes: `/assets/css/sidebar.css`, `/assets/css/trang-chu/home.css`, `/assets/css/5s/5s-so-do-phe-lieu.css`, `@supabase/supabase-js`, `SheetJS`, `Lucide`, `/assets/js/core/supabase-config.js`.
- Produces: DOM container `#app`, Modal container `#scrapDetailModal`, script theme khởi tạo ngay lập tức.

- [ ] **Step 1: Viết lại file `pages/5s/5s-so-do-phe-lieu.html`**

```html
<!DOCTYPE html>
<html lang="vi">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sơ đồ kho phế liệu - 5S</title>

  <!-- Script khởi tạo theme ngay tức thì trước khi render DOM để chống flash trắng -->
  <script>
    (function () {
      var theme = localStorage.getItem('ddc_theme') || 'dark';
      document.documentElement.setAttribute('data-bs-theme', theme);
    })();
  </script>

  <!-- Logo hiển thị trên tab -->
  <link rel="icon" type="image/png" href="/assets/images/logos/Logo-DDC.png">

  <!-- Bootstrap CSS & Icons -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

  <!-- Tailwind CSS qua CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: ['selector', '[data-bs-theme="dark"]'],
    }
  </script>

  <!-- Lucide Icons qua CDN -->
  <script src="https://unpkg.com/lucide@latest"></script>

  <!-- SheetJS (xlsx) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

  <!-- Sidebar & Core CSS -->
  <link rel="stylesheet" href="/assets/css/sidebar.css">
  <link rel="stylesheet" href="/assets/css/trang-chu/home.css">
  <link rel="stylesheet" href="/assets/css/5s/5s-so-do-phe-lieu.css?v=2.0.0">

  <!-- Style trực tiếp ưu tiên cao nhất chống cache trình duyệt cho Dark Theme -->
  <style id="dark-theme-5s-override">
    [data-bs-theme="dark"] body {
      background-color: #0f1117 !important;
      color: #e2e8f0 !important;
    }

    [data-bs-theme="dark"] #app {
      background-color: #1a1d2d !important;
      border-color: #2b324a !important;
      color: #e2e8f0 !important;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5) !important;
    }

    [data-bs-theme="dark"] .kpi-card {
      background: #202538 !important;
      border-color: #2e3652 !important;
    }
  </style>
</head>

<body class="min-h-screen bg-[#f8f9fa] font-sans text-[#333]">
  <div id="app" class="max-w-7xl mx-auto p-4 md:p-6 my-4 bg-white rounded-2xl shadow-xl border border-gray-200 transition-colors">
    <!-- Nội dung chính sẽ được render động từ 5s-so-do-phe-lieu.js -->
  </div>

  <!-- Modal Chi Tiết Khu Vực Phế Liệu -->
  <div class="modal fade" id="scrapDetailModal" tabindex="-1" aria-labelledby="scrapDetailModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content border-0 shadow-2xl rounded-2xl overflow-hidden" id="scrapDetailModalContent">
        <!-- Render nội dung modal chi tiết -->
      </div>
    </div>
  </div>

  <!-- Bootstrap JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

  <!-- Supabase JS CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>

  <!-- Sidebar JS -->
  <script src="/assets/js/components/sidebar.js"></script>
  <script src="/assets/js/trang-chu/home.js"></script>

  <!-- Supabase config (URL + anon key) -->
  <script src="/assets/js/core/supabase-config.js"></script>
  <!-- Logic Sơ đồ phế liệu -->
  <script src="/assets/js/5s/5s-so-do-phe-lieu.js?v=2.0.0"></script>
</body>

</html>
```

- [ ] **Step 2: Commit thay đổi HTML**

```bash
git add pages/5s/5s-so-do-phe-lieu.html
git commit -m "feat(5s): upgrade 5s-so-do-phe-lieu.html with dark theme and modal container"
```

---

### Task 2: Nâng Cấp CSS `assets/css/5s/5s-so-do-phe-lieu.css`

**Files:**
- Modify: `assets/css/5s/5s-so-do-phe-lieu.css`

**Interfaces:**
- Consumes: CSS tokens for Dark/Light mode, animations, progress bars.
- Produces: Class selectors `.map-area`, `.status-item`, `.kpi-card`, `.custom-scrollbar`, highlight effect.

- [ ] **Step 1: Viết nội dung stylesheet cho `assets/css/5s/5s-so-do-phe-lieu.css`**

```css
/* =============================================================================
   5S SƠ ĐỒ KHO PHẾ LIỆU - CSS
   Bố cục chuẩn tỷ lệ mặt bằng 96m x 11m, Dark/Light mode và hiệu ứng tương tác
   ============================================================================= */

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(150, 150, 150, 0.35);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(150, 150, 150, 0.55);
}

/* Map Areas Styling */
.map-area {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, filter 0.2s ease;
  user-select: none;
}
.map-area:hover {
  z-index: 25 !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

/* Area Search Highlight Pulse */
@keyframes pulseHighlight {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
    transform: scale(1.02);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
    transform: scale(1.03);
  }
}
.area-highlight {
  animation: pulseHighlight 1.5s infinite !important;
  z-index: 30 !important;
  border: 2px solid #ef4444 !important;
}

/* Dark Theme Overrides */
[data-bs-theme="dark"] .bg-white {
  background-color: #1a1d2d !important;
  color: #e2e8f0;
}
[data-bs-theme="dark"] .bg-gray-50 {
  background-color: #141724 !important;
  color: #cbd5e1;
}
[data-bs-theme="dark"] .bg-gray-100 {
  background-color: #202538 !important;
}
[data-bs-theme="dark"] .border-gray-100,
[data-bs-theme="dark"] .border-gray-200 {
  border-color: #2b324a !important;
}
[data-bs-theme="dark"] .text-gray-700,
[data-bs-theme="dark"] .text-gray-800,
[data-bs-theme="dark"] .text-gray-900 {
  color: #f1f5f9 !important;
}
[data-bs-theme="dark"] .text-gray-400,
[data-bs-theme="dark"] .text-gray-500 {
  color: #94a3b8 !important;
}
[data-bs-theme="dark"] .status-item {
  background-color: #141724 !important;
  border-color: #2b324a !important;
}
[data-bs-theme="dark"] .status-item:hover {
  background-color: #202538 !important;
}
[data-bs-theme="dark"] .modal-content {
  background-color: #1a1d2d !important;
  color: #e2e8f0 !important;
}
[data-bs-theme="dark"] .table-light {
  background-color: #202538 !important;
  color: #e2e8f0 !important;
}
[data-bs-theme="dark"] .table {
  color: #e2e8f0 !important;
  border-color: #2b324a !important;
}
```

- [ ] **Step 2: Commit thay đổi CSS**

```bash
git add assets/css/5s/5s-so-do-phe-lieu.css
git commit -m "style(5s): add responsive and dark theme styles for 5s scrap warehouse map"
```

---

### Task 3: Viết Lại Logic `assets/js/5s/5s-so-do-phe-lieu.js`

**Files:**
- Modify: `assets/js/5s/5s-so-do-phe-lieu.js`

**Interfaces:**
- Consumes: `window.supabase`, `fetchAllFromSupabase`, `getStoredTableCache`, `setStoredTableCache`, `XLSX`.
- Produces: Scrap Warehouse Controller, Period filter handler, Scrap Area Mapping Engine, Modal Detail viewer, Excel Export.

- [ ] **Step 1: Viết toàn bộ mã nguồn xử lý dữ liệu và render cho `assets/js/5s/5s-so-do-phe-lieu.js`**

```javascript
/* =============================================================================
   5S SƠ ĐỒ KHO PHẾ LIỆU - JAVASCRIPT
   Tích hợp trực tiếp dữ liệu từ bảng Supabase 'pl-can-thu', bộ lọc theo Kỳ đổ,
   phân tích chi tiết theo xưởng, SWR cache và hỗ trợ Dark/Light mode.
   ============================================================================= */

(function () {
  'use strict';

  const TABLE_NAME = 'pl-can-thu';

  // Định nghĩa danh sách 10 khu vực mặt bằng 5S kho phế liệu
  const INITIAL_AREAS = [
    {
      id: 'thung-son',
      name: 'Thùng sơn',
      fullName: 'Phế liệu Thùng sơn',
      description: 'Khu vực lưu trữ các loại thùng sơn cũ, vỏ thùng kim loại và nhựa.',
      color: '#f3a678',
      top: '0%',
      left: '0%',
      width: '99.9%',
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
      color: '#f3a678',
      top: '6.5%',
      left: '0%',
      width: '99.9%',
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
      description: 'Khu vực phế liệu cao cấp (Loại 1, thầu phụ, thùng thuốc hàn).',
      color: '#f3a678',
      top: '13%',
      left: '0%',
      width: '99.9%',
      height: '45%',
      maxCapacity: 350,
      unit: 'tấn',
      keywords: ['loại 1', 'loai 1', 'thầu phụ', 'thau phu', 'thùng thuốc hàn', 'thuoc han'],
      info: ['Diện tích: 522m²', 'Định mức: 350 tấn']
    },
    {
      id: 'day-dai',
      name: 'Dây đai',
      fullName: 'Phế liệu Dây đai',
      description: 'Khu vực chứa các loại dây đai nhựa, dây đai thép từ kiện hàng.',
      color: '#f3a678',
      top: '58.5%',
      left: '0%',
      width: '99.9%',
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
      color: '#f3a678',
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
      color: '#f3a678',
      top: '80%',
      left: '33%',
      width: '13%',
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
      left: '46.9%',
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
      color: '#f3a678',
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
      color: '#f3a678',
      top: '63%',
      left: '0%',
      width: '15%',
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
  let hoveredAreaId = null;
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
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }

  // ==================== SCRAP MAPPING ENGINE ====================
  function matchAreaForScrapType(scrapTypeName) {
    if (!scrapTypeName) return null;
    const lower = scrapTypeName.trim().toLowerCase();

    for (const area of INITIAL_AREAS) {
      if (area.id === 'tram-dien') continue;
      for (const kw of area.keywords) {
        if (lower.includes(kw) || kw.includes(lower)) {
          return area.id;
        }
      }
    }
    // Fallback: Nếu là sắt hoặc phế liệu chung, đưa vào Loại 1
    if (lower.includes('sắt') || lower.includes('thép') || lower.includes('phế')) {
      return 'loai-1';
    }
    return null;
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

    const fileName = `So_Do_Kho_Phe_Lieu_${selectedPeriod.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
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

    app.innerHTML = `
      <!-- Header Section -->
      <header class="mb-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <div class="flex items-center gap-3">
              <span class="p-2.5 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl text-white shadow-md">
                <i data-lucide="warehouse" class="w-6 h-6"></i>
              </span>
              <div>
                <h1 class="text-2xl md:text-3xl font-black text-[#d92d20] tracking-tight uppercase">
                  Sơ Đồ Kho Phế Liệu 5S
                </h1>
                <p class="text-xs text-gray-500">Mặt bằng quản lý trực quan phế liệu theo định mức tải (96m x 11m)</p>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap">
            <!-- Nút Theme Toggle -->
            <button id="btn-theme-toggle" class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 rounded-lg py-1.5 px-3">
              <i data-lucide="${currentTheme === 'dark' ? 'sun' : 'moon'}" class="w-4 h-4"></i>
              <span>${currentTheme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}</span>
            </button>

            <!-- Nút Xuất Excel -->
            <button id="btn-export-excel" class="btn btn-sm btn-success d-flex align-items-center gap-1.5 rounded-lg py-1.5 px-3 font-semibold shadow-sm">
              <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>
              <span>Xuất Excel</span>
            </button>

            <!-- Nút Làm Mới -->
            <button id="btn-refresh" class="btn btn-sm btn-primary d-flex align-items-center gap-1.5 rounded-lg py-1.5 px-3 font-semibold shadow-sm" ${isLoading ? 'disabled' : ''}>
              <i data-lucide="refresh-cw" class="w-4 h-4 ${isLoading ? 'animate-spin' : ''}"></i>
              <span>${isLoading ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div class="kpi-card p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-3">
            <div class="p-2 rounded-lg bg-red-50 text-red-600">
              <i data-lucide="weight" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tổng khối lượng</span>
              <span class="text-lg font-black text-gray-800">${formatNumber(totalTon, 2)} tấn <span class="text-xs font-medium text-gray-400">(${formatNumber(totalKg, 0)} kg)</span></span>
            </div>
          </div>

          <div class="kpi-card p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-3">
            <div class="p-2 rounded-lg bg-orange-50 text-orange-600">
              <i data-lucide="alert-triangle" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Cảnh báo đầy (>90%)</span>
              <span class="text-lg font-black ${dangerCount > 0 ? 'text-red-600' : 'text-gray-800'}">${dangerCount} khu vực</span>
            </div>
          </div>

          <div class="kpi-card p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-3">
            <div class="p-2 rounded-lg bg-green-50 text-green-600">
              <i data-lucide="shield-check" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Khu vực an toàn (&lt;70%)</span>
              <span class="text-lg font-black text-green-600">${safeCount} khu vực</span>
            </div>
          </div>

          <div class="kpi-card p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-3">
            <div class="p-2 rounded-lg bg-blue-50 text-blue-600">
              <i data-lucide="calendar" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Kỳ đổ đang xem</span>
              <span class="text-xs font-bold text-blue-700 truncate max-w-[150px] block" title="${selectedPeriod}">${selectedPeriod === 'ALL' ? 'Tất cả các kỳ' : selectedPeriod}</span>
            </div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="flex flex-col sm:flex-row items-center gap-3 mt-4 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
          <div class="w-full sm:w-72">
            <label class="text-[10px] font-bold text-gray-400 uppercase block mb-1">Lọc theo Kỳ Đổ</label>
            <div class="relative">
              <select id="select-period" class="form-select form-select-sm font-semibold rounded-lg">
                <option value="ALL" ${selectedPeriod === 'ALL' ? 'selected' : ''}>-- Tất cả các kỳ đổ --</option>
                ${availablePeriods.map(p => `
                  <option value="${p}" ${selectedPeriod === p ? 'selected' : ''}>${p}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="flex-1 w-full">
            <label class="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tìm kiếm & Highlight khu vực</label>
            <div class="relative">
              <input 
                type="text" 
                id="input-search" 
                class="form-control form-control-sm rounded-lg pl-8" 
                placeholder="Nhập tên xưởng (AH1, AH2...) hoặc tên loại phế liệu..."
                value="${searchQuery}"
              >
              <i data-lucide="search" class="w-4 h-4 text-gray-400 absolute left-2.5 top-2"></i>
            </div>
          </div>

          <div class="text-[10px] text-gray-400 self-end pb-1.5 whitespace-nowrap">
            Cập nhật lúc: <strong class="text-gray-600">${lastUpdatedTime || '--:--'}</strong>
          </div>
        </div>

        ${errorMessage ? `
          <div class="mt-3 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
            <i data-lucide="alert-circle" class="w-4 h-4"></i>
            <span>${errorMessage}</span>
          </div>
        ` : ''}
      </header>

      <!-- Main Layout: Map & Status -->
      <main class="flex flex-col lg:flex-row gap-6 items-start">
        <!-- Left Side: Map Container (Aspect 11:14 chuẩn tỷ lệ kho) -->
        <div class="w-full lg:flex-1 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm relative">
          <div class="flex items-center justify-between mb-3 px-1">
            <div class="flex items-center gap-2 text-gray-600">
              <i data-lucide="layers" class="w-4 h-4"></i>
              <span class="text-xs font-bold uppercase tracking-wider">Mặt bằng kho trực tuyến</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                <span class="text-[10px] font-bold text-gray-400">&lt;70%</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span class="text-[10px] font-bold text-gray-400">70-90%</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span class="text-[10px] font-bold text-gray-400">&gt;90%</span>
              </div>
            </div>
          </div>

          <div class="relative aspect-[11/14] w-full border border-dashed border-gray-300 rounded-xl p-1 bg-gray-50/50 overflow-hidden">
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
                    class="map-area absolute flex flex-col items-center justify-center text-center p-0.5 overflow-hidden rounded-md transition-all ${area.id === 'tram-dien' ? 'cursor-default' : 'cursor-pointer'} ${isHighlight ? 'area-highlight' : ''}"
                    style="
                      top: ${area.top};
                      left: ${area.left};
                      width: ${area.width};
                      height: ${area.height};
                      background-color: ${area.color};
                      border: 1px solid rgba(255, 255, 255, 0.7);
                      z-index: 1;
                    "
                    title="${area.fullName} - Click để xem chi tiết"
                  >
                    <div class="flex flex-col items-center justify-center w-full h-full gap-0.5">
                      <div class="flex items-center justify-center ${isShort ? 'flex-row gap-1.5' : 'flex-col gap-0.5'}">
                        <span class="font-black text-gray-900 leading-tight ${area.id === 'loai-1' ? 'text-xl md:text-2xl' : isShort ? 'text-[9px] sm:text-xs' : 'text-xs sm:text-sm'}">
                          ${area.name}
                        </span>
                        ${area.id !== 'tram-dien' ? `
                          <span class="font-extrabold text-gray-900 leading-none ${isShort ? 'text-[8px] sm:text-[10px] bg-white/50 px-1 py-0.5 rounded' : 'text-[10px] sm:text-xs'}">
                            ${formatNumber(area.capacity, area.unit === 'tấn' ? 2 : 0)} ${area.unit}
                          </span>
                        ` : ''}
                      </div>

                      ${area.id !== 'tram-dien' ? `
                        <div class="w-[85%] bg-white/70 rounded-full overflow-hidden shadow-inner ${isShort ? 'h-1 max-w-[60px]' : 'h-1.5 max-w-[100px]'}">
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

        <!-- Right Side: Live Status List -->
        <div class="w-full lg:w-96 flex flex-col gap-4">
          <div class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div class="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <span class="text-xs font-bold text-gray-600 uppercase">Trạng thái khu vực</span>
              <span class="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-500 font-bold">${calculatedAreas.length - 1} khu vực</span>
            </div>

            <div class="max-h-[500px] overflow-y-auto space-y-2 custom-scrollbar pr-1">
              ${calculatedAreas.filter(a => a.id !== 'tram-dien').map(area => {
                return `
                  <div 
                    onclick="openScrapAreaModal('${area.id}')"
                    class="status-item p-2.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100 cursor-pointer transition-all flex flex-col gap-1.5"
                  >
                    <div class="flex justify-between items-center text-xs">
                      <span class="font-bold text-gray-800">${area.name}</span>
                      <span class="font-bold text-gray-600">
                        ${formatNumber(area.capacity, area.unit === 'tấn' ? 2 : 0)} / ${formatNumber(area.maxCapacity, 0)} ${area.unit}
                      </span>
                    </div>

                    <div class="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        class="h-full transition-all duration-500 ${area.percentage > 90 ? 'bg-red-500' : area.percentage > 70 ? 'bg-orange-500' : 'bg-green-500'}"
                        style="width: ${area.percentage}%"
                      ></div>
                    </div>

                    <div class="flex justify-between text-[10px] text-gray-400">
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
      </main>
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
```

- [ ] **Step 2: Commit thay đổi JS**

```bash
git add assets/js/5s/5s-so-do-phe-lieu.js
git commit -m "feat(5s): rewrite 5s scrap warehouse map logic with supabase data, period filters and modal"
```

---

### Task 4: Kiểm Thử Tích Hợp & Đồng Bộ Bản Build

**Files:**
- Run: `node scripts/sync-dist.js`
- Test: Kiểm tra dữ liệu Supabase và đồng bộ `dist/`, `public/`, `dist-app/`

- [ ] **Step 1: Viết test script kiểm tra nạp dữ liệu và ánh xạ khu vực**

Tạo file tạm trong scratch để chạy kiểm thử bằng Node:
- Kết nối Supabase lấy dữ liệu bảng `pl-can-thu`.
- Đếm số kỳ đổ trích xuất được.
- Kiểm tra tính toán khối lượng theo từng kỳ.

- [ ] **Step 2: Chạy script kiểm thử**

```bash
node -e "
const https = require('https');
const url = 'https://ahcethtonjwktjtmxzog.supabase.co/rest/v1/pl-can-thu?select=*&limit=100';
const options = {
  headers: {
    'apikey': process.env.SUPABASE_ANON_KEY || '<SUPABASE_ANON_KEY>',
    'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || '<SUPABASE_ANON_KEY>'}`
  }
};
https.get(url, options, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const rows = JSON.parse(d);
    console.log('✅ Supabase pl-can-thu connection OK! Rows count:', rows.length);
    const periods = [...new Set(rows.map(r => r['Kì đổ']).filter(Boolean))];
    console.log('✅ Periods found:', periods.length);
  });
});
"
```

- [ ] **Step 3: Đồng bộ mã nguồn ra `dist/`, `public/`, `dist-app/`**

```bash
node scripts/sync-dist.js
```

- [ ] **Step 4: Commit và hoàn tất**

```bash
git add dist/ dist-app/ public/
git commit -m "chore(sync): synchronize dist, public, and dist-app with latest 5s scrap map"
```
