const TABLE_NAME = 'pl-can-thu';

let allRows = [];
let selectedPeriod = sessionStorage.getItem('plFilterPeriod') || 'All';
let loading = true;
let error = null;

const appDiv = document.getElementById('app');

function getScrapIcon(name) {
  const lower = name.toLowerCase();
  if (lower.includes('sắt') || lower.includes('thép')) return 'weight';
  if (lower.includes('nhôm')) return 'layers';
  if (lower.includes('đồng')) return 'coins';
  if (lower.includes('nhựa') || lower.includes('nilon')) return 'recycle';
  if (lower.includes('giấy') || lower.includes('carton')) return 'scroll';
  if (lower.includes('gỗ') || lower.includes('pallet')) return 'tree-pine';
  if (lower.includes('rác') || lower.includes('thải')) return 'trash-2';
  if (lower.includes('loại 1')) return 'award';
  if (lower.includes('loại 2')) return 'medal';
  if (lower.includes('loại 3')) return 'tag';

  const icons = ['package', 'box', 'archive', 'component', 'database', 'hexagon', 'grid', 'layers'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return icons[Math.abs(hash) % icons.length];
}

function getWorkshopColor(name) {
  const palettes = [
    {
      name: 'blue', border: 'border-t-blue-500', headerBg: 'bg-blue-100', text: 'text-blue-700', iconBg: 'bg-blue-200', shadow: 'hover:shadow-blue-500/20',
      childBg: 'bg-blue-50/60', childBorder: 'border-blue-200', childHover: 'hover:border-blue-300',
      grandchildBg: 'bg-white', grandchildBorder: 'border-l-4 border-blue-400',
      badge: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      name: 'purple', border: 'border-t-purple-500', headerBg: 'bg-purple-100', text: 'text-purple-700', iconBg: 'bg-purple-200', shadow: 'hover:shadow-purple-500/20',
      childBg: 'bg-purple-50/60', childBorder: 'border-purple-200', childHover: 'hover:border-purple-300',
      grandchildBg: 'bg-white', grandchildBorder: 'border-l-4 border-purple-400',
      badge: 'bg-purple-100 text-purple-800 border-purple-200'
    },
    {
      name: 'emerald', border: 'border-t-emerald-500', headerBg: 'bg-emerald-100', text: 'text-emerald-700', iconBg: 'bg-emerald-200', shadow: 'hover:shadow-emerald-500/20',
      childBg: 'bg-emerald-50/60', childBorder: 'border-emerald-200', childHover: 'hover:border-emerald-300',
      grandchildBg: 'bg-white', grandchildBorder: 'border-l-4 border-emerald-400',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    },
    {
      name: 'orange', border: 'border-t-orange-500', headerBg: 'bg-orange-100', text: 'text-orange-700', iconBg: 'bg-orange-200', shadow: 'hover:shadow-orange-500/20',
      childBg: 'bg-orange-50/60', childBorder: 'border-orange-200', childHover: 'hover:border-orange-300',
      grandchildBg: 'bg-white', grandchildBorder: 'border-l-4 border-orange-400',
      badge: 'bg-orange-100 text-orange-800 border-orange-200'
    },
    {
      name: 'rose', border: 'border-t-rose-500', headerBg: 'bg-rose-100', text: 'text-rose-700', iconBg: 'bg-rose-200', shadow: 'hover:shadow-rose-500/20',
      childBg: 'bg-rose-50/60', childBorder: 'border-rose-200', childHover: 'hover:border-rose-300',
      grandchildBg: 'bg-white', grandchildBorder: 'border-l-4 border-rose-400',
      badge: 'bg-rose-100 text-rose-800 border-rose-200'
    },
    {
      name: 'indigo', border: 'border-t-indigo-500', headerBg: 'bg-indigo-100', text: 'text-indigo-700', iconBg: 'bg-indigo-200', shadow: 'hover:shadow-indigo-500/20',
      childBg: 'bg-indigo-50/60', childBorder: 'border-indigo-200', childHover: 'hover:border-indigo-300',
      grandchildBg: 'bg-white', grandchildBorder: 'border-l-4 border-indigo-400',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    },
    {
      name: 'cyan', border: 'border-t-cyan-500', headerBg: 'bg-cyan-100', text: 'text-cyan-700', iconBg: 'bg-cyan-200', shadow: 'hover:shadow-cyan-500/20',
      childBg: 'bg-cyan-50/60', childBorder: 'border-cyan-200', childHover: 'hover:border-cyan-300',
      grandchildBg: 'bg-white', grandchildBorder: 'border-l-4 border-cyan-400',
      badge: 'bg-cyan-100 text-cyan-800 border-cyan-200'
    },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palettes[Math.abs(hash) % palettes.length];
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

async function init() {
  render(); // show loading
  try {
    const { data, error: dbError } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('id', { ascending: true });

    if (dbError) throw dbError;

    allRows = (data || []).map(row => {
      return {
        'Ngày': row['Ngày'] || '',
        'Kì đổ': row['Kì đổ'] || '',
        'Xưởng': row['Xưởng'] || '',
        'Loại phế liệu': row['Loại phế liệu'] || '',
        'Số lượng (kg)': row['Số lượng (kg)'] !== null ? String(row['Số lượng (kg)']) : '0',
        'Ghi chú': row['Ghi chú'] || ''
      };
    });

    loading = false;
    render();
  } catch (err) {
    error = err.message;
    loading = false;
    render();
  }
}

window.toggleWorkshop = function (index) {
  const chevronEl = document.getElementById(`workshop-chevron-${index}`);
  if (!chevronEl) return;

  const isExpanded = chevronEl.classList.contains('expanded');

  if (isExpanded) {
    chevronEl.classList.remove('expanded');
  } else {
    chevronEl.classList.add('expanded');
  }

  // Toggle all detail contents for this workshop
  const details = document.querySelectorAll(`[id^="detail-${index}-"]`);
  details.forEach(el => {
    if (isExpanded) {
      el.classList.remove('expanded');
    } else {
      el.classList.add('expanded');
    }
  });

  // Sync individual scrap chevrons
  const scrapChevrons = document.querySelectorAll(`[id^="scrap-chevron-${index}-"]`);
  scrapChevrons.forEach(el => {
    if (isExpanded) {
      el.classList.remove('expanded');
    } else {
      el.classList.add('expanded');
    }
  });
}

window.toggleScrapDetail = function (wIndex, sIndex) {
  const detailEl = document.getElementById(`detail-${wIndex}-${sIndex}`);
  const chevronEl = document.getElementById(`scrap-chevron-${wIndex}-${sIndex}`);
  if (!detailEl) return;

  const isExpanded = detailEl.classList.contains('expanded');
  if (isExpanded) {
    detailEl.classList.remove('expanded');
    if (chevronEl) chevronEl.classList.remove('expanded');
  } else {
    detailEl.classList.add('expanded');
    if (chevronEl) chevronEl.classList.add('expanded');
  }
}

function render() {
  if (loading) {
    appDiv.innerHTML = `
      <div class="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div class="flex flex-col items-center gap-4 text-slate-500 animate-fade-in">
          <i data-lucide="loader-2" class="h-10 w-10 animate-spin text-blue-600"></i>
          <p class="text-base font-medium animate-pulse">Đang tải dữ liệu...</p>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  if (error) {
    appDiv.innerHTML = `
      <div class="flex h-screen w-full items-center justify-center bg-slate-50">
        <div class="rounded-xl bg-red-50 p-8 text-center text-red-600 shadow-sm border border-red-100 max-w-md animate-slide-up">
          <p class="text-lg font-bold">Lỗi tải dữ liệu</p>
          <p class="text-sm mt-2 opacity-80">${error}</p>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const periods = Array.from(new Set(allRows.map(r => r['Kì đổ']?.trim()).filter(Boolean))).sort();

  if (selectedPeriod !== 'All' && !periods.includes(selectedPeriod)) {
    selectedPeriod = 'All';
  }

  const filtered = selectedPeriod === 'All'
    ? allRows
    : allRows.filter(r => r['Kì đổ']?.trim() === selectedPeriod);

  const grouped = filtered.reduce((acc, row) => {
    const workshop = row['Xưởng']?.trim();
    const scrapType = row['Loại phế liệu']?.trim();
    const rawAmount = row['Số lượng (kg)']?.trim() || '0';
    const amountStr = rawAmount.replace(/\./g, '').replace(/,/g, '.');
    const amount = parseFloat(amountStr) || 0;
    const rawDate = row['Ngày']?.trim() || '';
    const date = formatDate(rawDate);
    const notes = row['Ghi chú']?.trim() || '';

    if (!workshop || !scrapType) return acc;

    if (!acc[workshop]) {
      acc[workshop] = { name: workshop, totalKg: 0, scrapTypesMap: {} };
    }

    acc[workshop].totalKg += amount;

    if (!acc[workshop].scrapTypesMap[scrapType]) {
      acc[workshop].scrapTypesMap[scrapType] = {
        totalKg: 0,
        details: []
      };
    }
    acc[workshop].scrapTypesMap[scrapType].totalKg += amount;
    acc[workshop].scrapTypesMap[scrapType].details.push({
      date,
      kg: amount,
      notes
    });

    return acc;
  }, {});

  const data = Object.values(grouped).map(w => ({
    name: w.name,
    totalKg: w.totalKg,
    scrapTypes: Object.entries(w.scrapTypesMap)
      .map(([type, info]) => ({
        type,
        kg: info.totalKg,
        details: info.details
      }))
      .sort((a, b) => b.kg - a.kg)
  })).sort((a, b) => b.totalKg - a.totalKg);

  const grandTotal = data.reduce((sum, w) => sum + w.totalKg, 0);

  const summaryTotals = {
    'Loại 1': 0,
    'Loại 2': 0
  };

  const groupBreakdowns = {
    'Loại 1': {},
    'Loại 2': {}
  };

  filtered.forEach(row => {
    const originalType = (row['Loại phế liệu'] || '').trim();
    if (!originalType) return;

    const scrapType = originalType.toLowerCase();
    const rawAmount = row['Số lượng (kg)']?.trim() || '0';
    const amountStr = rawAmount.replace(/\./g, '').replace(/,/g, '.');
    const amount = parseFloat(amountStr) || 0;

    if (scrapType.includes('loại 1') || scrapType.includes('thùng thuốc hàn') || scrapType.includes('thầu phụ') || scrapType.includes('thau phu') || scrapType.includes('dây đai')) {
      let displayType = 'Loại 1';
      if (scrapType.includes('thùng thuốc hàn')) displayType = 'Thùng thuốc hàn';
      else if (scrapType.includes('thầu phụ') || scrapType.includes('thau phu')) displayType = 'Thầu phụ';
      else if (scrapType.includes('dây đai')) displayType = 'Dây đai';

      summaryTotals['Loại 1'] += amount;
      groupBreakdowns['Loại 1'][displayType] = (groupBreakdowns['Loại 1'][displayType] || 0) + amount;
    } else if (scrapType.includes('mạt khoan') || scrapType.includes('dây hàn') || scrapType.includes('thùng sơn')) {
      let displayType = 'Loại 2';
      if (scrapType.includes('mạt khoan')) displayType = 'Mạt khoan';
      else if (scrapType.includes('dây hàn')) displayType = 'Dây hàn';
      else if (scrapType.includes('thùng sơn')) displayType = 'Thùng sơn';

      summaryTotals['Loại 2'] += amount;
      groupBreakdowns['Loại 2'][displayType] = (groupBreakdowns['Loại 2'][displayType] || 0) + amount;
    } else {
      if (!summaryTotals[originalType]) {
        summaryTotals[originalType] = 0;
      }
      summaryTotals[originalType] += amount;
    }
  });

  window.currentGroupBreakdowns = groupBreakdowns;

  Object.keys(summaryTotals).forEach(k => {
    if (summaryTotals[k] === 0) delete summaryTotals[k];
  });

  const summaryPalettes = [
    { bg: 'from-emerald-600/10 to-emerald-600/5', border: 'border-emerald-600/10', text: 'text-emerald-600' },
    { bg: 'from-orange-600/10 to-orange-600/5', border: 'border-orange-600/10', text: 'text-orange-600' },
    { bg: 'from-blue-600/10 to-blue-600/5', border: 'border-blue-600/10', text: 'text-blue-600' },
    { bg: 'from-purple-600/10 to-purple-600/5', border: 'border-purple-600/10', text: 'text-purple-600' },
    { bg: 'from-rose-600/10 to-rose-600/5', border: 'border-rose-600/10', text: 'text-rose-600' },
    { bg: 'from-indigo-600/10 to-indigo-600/5', border: 'border-indigo-600/10', text: 'text-indigo-600' },
    { bg: 'from-cyan-600/10 to-cyan-600/5', border: 'border-cyan-600/10', text: 'text-cyan-600' },
    { bg: 'from-slate-600/10 to-slate-600/5', border: 'border-slate-600/10', text: 'text-slate-600' },
  ];

  let totalCardHtml = `
    <div class="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-blue-600/5 px-4 py-2.5 shadow-inner border border-blue-600/10 w-fit">
      <div class="bg-white p-2 rounded-lg shadow-sm">
        <i data-lucide="scale" class="h-4 w-4 text-blue-600"></i>
      </div>
      <div class="flex flex-col">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tổng cộng</span>
        <span class="text-lg font-black text-slate-900 animate-pop">
          ${grandTotal.toLocaleString('vi-VN')} kg
        </span>
      </div>
    </div>
  `;

  const preferredOrder = [
    'Loại 1',
    'Loại 2',
    'Inox 409',
    'Sắt dính sỉ',
    'Sỉ cắt',
    'Sỉ đất',
    'Mỹ Thủy - Thăng Long',
    'Mỹ Thủy - Nam Anh'
  ];

  const orderedKeys = Object.keys(summaryTotals).sort((a, b) => {
    const indexA = preferredOrder.findIndex(p => p.toLowerCase() === a.toLowerCase());
    const indexB = preferredOrder.findIndex(p => p.toLowerCase() === b.toLowerCase());

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  let otherCardsHtml = '';
  orderedKeys.forEach((key) => {
    const amount = summaryTotals[key];
    let palette;
    let icon;

    if (key === 'Loại 1') {
      palette = summaryPalettes[0];
      icon = 'award';
    } else if (key === 'Loại 2') {
      palette = summaryPalettes[1];
      icon = 'medal';
    } else {
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
      }
      const availablePalettes = summaryPalettes.slice(2);
      palette = availablePalettes[Math.abs(hash) % availablePalettes.length];
      icon = getScrapIcon(key);
    }

    const isGrouped = key === 'Loại 1' || key === 'Loại 2';

    otherCardsHtml += `
      <div class="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r ${palette.bg} px-4 py-2.5 shadow-inner border ${palette.border} w-fit whitespace-nowrap shrink-0 ${isGrouped ? 'cursor-pointer summary-card-clickable' : ''}"
           ${isGrouped ? `onclick="showGroupDetail('${key}')"` : ''}>
        <div class="bg-white p-2 rounded-lg shadow-sm">
          <i data-lucide="${icon}" class="h-4 w-4 ${palette.text}"></i>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${key}</span>
          <span class="text-lg font-black text-slate-900 animate-pop">
            ${amount.toLocaleString('vi-VN')} kg
          </span>
        </div>
      </div>
    `;
  });

  let html = `
    <div class="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-50 via-slate-100 to-slate-200 pt-16 pb-8 px-4 md:px-8 font-sans">
      <div class="mx-auto max-w-7xl space-y-8">
        <div class="flex flex-col gap-6 bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/40 animate-slide-down">
          <div class="flex flex-col gap-6 md:flex-row md:items-start justify-between">
            <div class="flex flex-col gap-2 flex-1 min-w-0 items-center md:items-start">
              <div class="flex items-center gap-3 justify-center md:justify-start">
                <i data-lucide="sparkles" class="h-8 w-8 text-amber-500"></i>
                <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 text-center md:text-left">
                  Tổng hợp phế liệu - Xưởng đã đổ theo định kì
                </h1>
              </div>
             
              
              <div class="mt-4 md:ml-12 flex justify-center md:justify-start">
                ${totalCardHtml}
              </div>
            </div>

            <div class="flex flex-col gap-2 shrink-0 items-start">
              <label class="text-sm font-bold text-slate-700 flex items-center gap-2">
                <i data-lucide="filter" class="h-4 w-4 text-blue-600"></i>
                Lọc theo Kì đổ
              </label>
              <div class="relative w-full md:w-fit">
                <select id="period-select" class="w-full md:w-auto bg-white border border-slate-200 shadow-sm h-12 rounded-xl pl-4 pr-10 appearance-none focus:ring-2 focus:ring-blue-600/20 outline-none cursor-pointer font-medium text-slate-700">
                  <option value="All" ${selectedPeriod === 'All' ? 'selected' : ''}>Tất cả các kì</option>
                  ${periods.map(p => `<option value="${p}" ${selectedPeriod === p ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
                <i data-lucide="chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"></i>
              </div>
            </div>
          </div>
          
          <div class="md:ml-12 flex items-center gap-3 overflow-x-auto custom-scrollbar pb-2 w-full justify-center md:justify-start">
            ${otherCardsHtml}
          </div>
        </div>
  `;

  if (data.length === 0) {
    html += `
        <div class="flex h-64 w-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 backdrop-blur-sm animate-fade-in">
          <p class="text-lg font-medium text-slate-500">Không có dữ liệu cho kì này</p>
        </div>
    `;
  } else {
    html += `
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          ${data.map((workshop, index) => {
      const colors = getWorkshopColor(workshop.name);
      return `
              <div class="h-full animate-stagger-up" style="animation-delay: ${index * 0.1}s">
                <div class="flex flex-col h-full overflow-hidden border border-slate-200/60 shadow-md transition-all duration-300 border-t-4 ${colors.border} ${colors.shadow} bg-white/80 backdrop-blur-sm rounded-2xl hover:-translate-y-1">
                  
                  <div class="${colors.headerBg} p-6 pb-5 border-b border-white/50 cursor-pointer select-none group" onclick="toggleWorkshop(${index})">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="rounded-xl ${colors.iconBg} p-2.5 shadow-sm">
                          <i data-lucide="factory" class="h-5 w-5 ${colors.text}"></i>
                        </div>
                        <h3 class="text-xl font-bold ${colors.text} m-0">${workshop.name}</h3>
                      </div>
                      <div class="p-1 rounded-full group-hover:bg-black/5 transition-colors">
                        <i data-lucide="chevron-down" id="workshop-chevron-${index}" class="h-5 w-5 ${colors.text} opacity-70 chevron-icon"></i>
                      </div>
                    </div>
                    <div class="mt-3 flex items-center gap-2 text-sm font-medium ${colors.text} bg-white/60 w-fit px-3 py-1.5 rounded-lg shadow-sm">
                      <span>Tổng cộng:</span>
                      <span class="text-base font-black">${workshop.totalKg.toLocaleString('vi-VN')} kg</span>
                    </div>
                  </div>

                  <div class="flex-1 p-0 bg-white/40">
                    <div class="max-h-[600px] w-full overflow-y-auto custom-scrollbar">
                      <div class="flex flex-col gap-3 p-5">
                        ${workshop.scrapTypes.map((scrap, idx) => {
        const scrapIcon = getScrapIcon(scrap.type);
        return `
                            <div class="group/item flex flex-col rounded-xl border ${colors.childBorder} ${colors.childBg} p-3.5 shadow-sm transition-all hover:shadow-md ${colors.childHover} animate-stagger-left" style="animation-delay: ${(index * 0.1) + (idx * 0.05)}s">
                              <div class="flex items-center justify-between cursor-pointer select-none" onclick="toggleScrapDetail(${index}, ${idx})">
                                <div class="flex items-center gap-3">
                                  <div class="bg-white/80 p-1.5 rounded-md shadow-sm">
                                    <i data-lucide="${scrapIcon}" class="h-4 w-4 ${colors.text}"></i>
                                  </div>
                                  <span class="text-sm font-bold ${colors.text}">${scrap.type}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                  <div class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold transition-colors ${colors.badge}">
                                    ${scrap.kg.toLocaleString('vi-VN')} kg
                                  </div>
                                  <i data-lucide="chevron-down" id="scrap-chevron-${index}-${idx}" class="h-4 w-4 ${colors.text} opacity-70 chevron-icon"></i>
                                </div>
                              </div>
                              
                              <div class="expandable-content" id="detail-${index}-${idx}">
                                <div class="flex flex-col gap-2 pt-3 mt-3 border-t ${colors.childBorder}">
                                  ${scrap.details.map(detail => `
                                    <div class="flex justify-between items-start text-xs text-slate-600 ${colors.grandchildBg} p-3 rounded-r-xl border border-slate-100 shadow-sm ${colors.grandchildBorder}">
                                      <div class="flex flex-col gap-1.5">
                                        <span class="font-semibold text-slate-700 flex items-center">
                                          <i data-lucide="calendar" class="h-3.5 w-3.5 mr-1.5 text-slate-400"></i>
                                          ${detail.date}
                                        </span>
                                        ${detail.notes ? `
                                          <span class="italic text-slate-500 flex items-start">
                                            <i data-lucide="file-text" class="h-3.5 w-3.5 mr-1.5 mt-0.5 text-slate-400 shrink-0"></i>
                                            <span>${detail.notes}</span>
                                          </span>
                                        ` : ''}
                                      </div>
                                      <span class="font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200">${detail.kg.toLocaleString('vi-VN')} kg</span>
                                    </div>
                                  `).join('')}
                                </div>
                              </div>
                            </div>
                          `;
      }).join('')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `;
    }).join('')}
        </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  appDiv.innerHTML = html;
  lucide.createIcons();

  const selectEl = document.getElementById('period-select');
  if (selectEl) {
    selectEl.addEventListener('change', (e) => {
      selectedPeriod = e.target.value;
      sessionStorage.setItem('plFilterPeriod', selectedPeriod);
      render();
    });
  }
}

// Start the app
init();

window.showGroupDetail = function (groupName) {
  const breakdown = window.currentGroupBreakdowns[groupName];
  if (!breakdown) return;

  const itemsHtml = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([type, amount]) => `
      <div class="modal-item">
        <span class="text-sm font-bold text-slate-700">${type}</span>
        <span class="text-sm font-black text-blue-600">${amount.toLocaleString('vi-VN')} kg</span>
      </div>
    `).join('');

  const modalHtml = `
    <div id="group-modal" class="modal-overlay" onclick="closeModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="bg-blue-100 p-2 rounded-lg">
              <i data-lucide="${groupName === 'Loại 1' ? 'award' : 'medal'}" class="h-5 w-5 text-blue-600"></i>
            </div>
            <h2 class="text-xl font-bold text-slate-900">Chi tiết ${groupName}</h2>
          </div>
          <button onclick="closeModal()" class="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <i data-lucide="x" class="h-5 w-5 text-slate-400"></i>
          </button>
        </div>
        <div class="modal-body">
          ${itemsHtml}
          <div class="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Tổng cộng</span>
            <span class="text-lg font-black text-slate-900">${Object.values(breakdown).reduce((a, b) => a + b, 0).toLocaleString('vi-VN')} kg</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  lucide.createIcons();
}

window.closeModal = function () {
  const modal = document.getElementById('group-modal');
  if (modal) {
    modal.classList.add('opacity-0');
    const content = modal.querySelector('.modal-content');
    if (content) content.style.transform = 'scale(0.95) translateY(10px)';
    setTimeout(() => modal.remove(), 200);
  }
}