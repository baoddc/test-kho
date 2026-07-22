// Configuration
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1vnI5KSTKNqqe4nrnn958gF2duFzcZffkwVw2DhxaRIE/gviz/tq?tqx=out:csv&gid=0';
const shelvesA = Array.from({ length: 14 }, (_, i) => `A${14 - i}`);
const shelvesB = Array.from({ length: 14 }, (_, i) => `B${14 - i}`);
const allShelves = [...shelvesA, ...shelvesB];

// State
let shelvesData = {};
let materialsData = [];
let searchQuery = '';
let isSearchFocused = false;
let highlightedShelves = [];
let hoveredShelf = null;

// DOM Elements
const appEl = document.getElementById('app');

let domCache = null;

function initDomCache() {
  domCache = {
    mainTitle: document.getElementById('main-title'),
    centerAisle: document.getElementById('center-aisle'),
    bottomArea: document.getElementById('bottom-area'),
    gratingArea: document.getElementById('grating-area'),
    shelves: {}
  };
  allShelves.forEach(shelfId => {
    domCache.shelves[shelfId] = {
      shelfEl: document.getElementById(`shelf-${shelfId}`),
      hoverEffectsEl: document.querySelector(`#shelf-${shelfId} .hover-effects`),
      shelfCircleEl: document.querySelector(`#shelf-${shelfId} .shelf-circle`),
      svgRectEl: document.querySelector(`#shelf-${shelfId} .svg-rect`),
      pulseEl: document.querySelector(`#shelf-${shelfId} .highlight-pulse`),
      badgeEl: document.querySelector(`#shelf-${shelfId} .search-badge`),
      tooltipEl: document.querySelector(`#shelf-${shelfId} .shelf-tooltip > div`),
      tooltipTitleEl: document.querySelector(`#shelf-${shelfId} .shelf-tooltip h3`)
    };
  });
}

// Initialize
async function init() {
  renderLoading();
  try {
    const data = await fetchWarehouseData();
    shelvesData = data.shelves;
    materialsData = data.materials;
    renderMainApp();
  } catch (err) {
    renderError(err.message || "Không thể tải dữ liệu từ Google Sheets.");
  }
}

function fetchWarehouseData() {
  return new Promise((resolve, reject) => {
    Papa.parse(SHEET_URL, {
      download: true,
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        const materialsMap = new Map();
        const shelvesMap = new Map();

        allShelves.forEach(id => shelvesMap.set(id, { id, materials: [] }));

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 5) continue;

          const shelfStr = row[2]?.trim().toUpperCase();
          const code = row[3]?.trim();
          const name = row[4]?.trim();
          const weight = row[7]?.trim() || '0';

          if (!code || !shelfStr) continue;

          const shelfIds = shelfStr.split(',').map(s => s.trim()).filter(s => allShelves.includes(s));
          if (shelfIds.length === 0) continue;

          if (!materialsMap.has(code)) {
            materialsMap.set(code, { code, name, weight, shelves: [], count: 0 });
          }
          const material = materialsMap.get(code);
          material.count += 1;

          shelfIds.forEach(shelfId => {
            if (!material.shelves.includes(shelfId)) {
              material.shelves.push(shelfId);
            }
            const shelfData = shelvesMap.get(shelfId);
            if (shelfData) {
              shelfData.materials.push({ code, name, weight });
            }
          });
        }

        resolve({
          shelves: Object.fromEntries(shelvesMap),
          materials: Array.from(materialsMap.values())
        });
      },
      error: (err) => reject(err)
    });
  });
}

// Render Functions
function renderLoading() {
  appEl.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20">
      <i data-lucide="loader-2" class="w-10 h-10 text-red-500 animate-spin mb-4"></i>
      <p class="text-gray-500 font-medium animate-pulse">Đang tải dữ liệu...</p>
    </div>
  `;
  lucide.createIcons();
}

function renderError(msg) {
  appEl.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 text-center px-4">
      <i data-lucide="alert-circle" class="w-12 h-12 text-red-500 mb-4"></i>
      <p class="text-red-600 font-medium mb-2">Lỗi tải dữ liệu</p>
      <p class="text-gray-500 text-sm max-w-md">${msg}</p>
    </div>
  `;
  lucide.createIcons();
}

function renderMainApp() {
  appEl.innerHTML = `
    <h1 id="main-title" class="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-red-600 text-center mb-6 md:mb-10 tracking-wider transition-all duration-400">
      SƠ ĐỒ CHI TIẾT KHO PHÔI CUỘN
    </h1>

    <!-- Search Bar -->
    <div class="relative max-w-xl mx-auto mb-8 md:mb-12 z-50">
      <div class="relative flex items-center">
        <i data-lucide="search" class="absolute left-4 text-gray-400 w-5 h-5"></i>
        <input
          id="search-input"
          type="text"
          placeholder="Tìm kiếm mã vật tư hoặc tên vật tư..."
          class="w-full pl-12 pr-10 py-3 sm:py-4 rounded-2xl border-2 border-gray-100 shadow-sm focus:ring-4 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-sm sm:text-base bg-white"
        />
        <button id="clear-search" class="hidden absolute right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div id="search-results" class="hidden absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[60vh] overflow-y-auto py-2">
      </div>
    </div>

    <!-- Map Area -->
    <div class="relative px-4 md:px-12">
      <div class="grid grid-cols-[1fr_40px_1fr] sm:grid-cols-[1fr_60px_1fr] md:grid-cols-[1fr_80px_1fr] gap-x-2 md:gap-x-4 relative">
        
        <!-- Left Shelves (B) -->
        <div id="shelves-left" class="flex flex-col"></div>

        <!-- Center Aisle -->
        <div id="center-aisle" class="bg-[#82c97c] flex items-center justify-center rounded-sm relative shadow-inner transition-all duration-400">
          <div class="text-white font-bold tracking-[0.2em] sm:tracking-[0.3em] uppercase text-xs sm:text-sm md:text-lg opacity-90" style="writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg);">
            Lối đi giữa xưởng
          </div>
          <div class="absolute -bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-40">
            <div class="w-8 h-8 sm:w-10 sm:h-10 bg-green-900 rounded-full border-2 border-red-500 flex items-center justify-center shadow-lg relative">
              <div class="text-white text-[6px] sm:text-[7px] font-bold leading-tight text-center">
                YOU ARE<br/>HERE
              </div>
              <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] sm:border-l-[6px] border-l-transparent border-r-[5px] sm:border-r-[6px] border-r-transparent border-t-[6px] sm:border-t-[8px] border-t-red-500"></div>
            </div>
          </div>
        </div>

        <!-- Right Shelves (A) -->
        <div id="shelves-right" class="flex flex-col"></div>

      </div>

      <!-- Dimensions -->
      <div class="hidden lg:flex absolute -right-4 top-0 bottom-0 flex-col items-center justify-between py-2 opacity-60">
        <div class="w-full flex justify-center"><div class="w-3 border-t-2 border-gray-400"></div></div>
        <div class="flex-1 w-[2px] bg-gray-400 relative">
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-gray-600 text-sm font-medium bg-white py-4" style="writing-mode: vertical-rl; transform: rotate(180deg);">
            Từ cột 15 đến cột 18: 28.000 mm
          </div>
        </div>
        <div class="w-full flex justify-center"><div class="w-3 border-b-2 border-gray-400"></div></div>
      </div>
    </div>

    <!-- Bottom Area -->
    <div id="bottom-area" class="grid grid-cols-[1fr_40px_1fr] sm:grid-cols-[1fr_60px_1fr] md:grid-cols-[1fr_80px_1fr] gap-x-2 md:gap-x-4 mt-8 md:mt-12 px-4 md:px-12 transition-all duration-400">
      <div class="flex flex-col items-center justify-start pt-2 sm:pt-4">
        <div class="text-center font-semibold text-xs sm:text-sm md:text-base text-gray-800">
          Đường xe vào nhập/xuất hàng
        </div>
        <div class="w-full flex items-center justify-between mt-4 sm:mt-8 text-[10px] sm:text-xs text-gray-500 font-medium">
          <span>&larr;</span><span>8.000 mm</span><span>&rarr;</span>
        </div>
      </div>

      <div class="flex flex-col justify-end pb-1">
         <div class="text-[8px] sm:text-[10px] text-gray-400 text-center font-medium">1.000 mm</div>
      </div>

      <div class="flex flex-col relative">
        <div id="grating-area" class="grating-container bg-[#f1c232] p-3 sm:p-4 md:p-8 flex items-center justify-center text-center font-semibold text-xs sm:text-sm md:text-base text-gray-900 min-h-[80px] sm:min-h-[100px] md:min-h-[120px] rounded-md shadow-sm border border-yellow-500/30 cursor-pointer relative z-10">
          
          <div class="grating-effects hidden absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-md">
            <div class="absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(45deg,#000,#000_2px,transparent_2px,transparent_8px)]"></div>
            <div class="absolute top-0 bottom-0 w-[50%] bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
            <svg class="absolute inset-0 w-full h-full pointer-events-none z-0">
              <rect x="1.5" y="1.5" width="calc(100% - 3px)" height="calc(100% - 3px)" fill="none" stroke="#d97706" stroke-width="3" stroke-dasharray="10 10" class="animate-marching-ants" rx="6" />
            </svg>
          </div>

          <span class="relative z-10">Khu vực để Grating<br/>và tập kết hàng hóa</span>
          
          <div class="grating-tooltip absolute bottom-full mb-4 w-48 md:w-64 bg-white p-3 md:p-4 rounded-xl shadow-2xl border border-yellow-200 z-50 pointer-events-none text-left">
            <h3 class="font-bold text-yellow-600 border-b pb-2 mb-3 text-sm md:text-base">Khu vực tập kết</h3>
            <div class="text-xs md:text-sm text-gray-700 space-y-2">
              <p class="flex justify-between items-center">
                <span class="text-gray-500">Trạng thái:</span>
                <span class="font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">Đang hoạt động</span>
              </p>
              <p class="flex justify-between items-center">
                <span class="text-gray-500">Diện tích:</span>
                <span class="font-semibold">40 m²</span>
              </p>
              <p class="flex justify-between items-center">
                <span class="text-gray-500">Sức chứa:</span>
                <span class="font-semibold text-blue-600">50 tấn</span>
              </p>
            </div>
          </div>
        </div>
        <div class="w-full flex items-center justify-between mt-2 text-[10px] sm:text-xs text-gray-500 font-medium">
          <span>&larr;</span><span>8.000 mm</span><span>&rarr;</span>
        </div>
        
        <div class="hidden lg:flex absolute -right-16 top-0 bottom-8 flex-col items-center justify-between opacity-60">
          <div class="w-full flex justify-center"><div class="w-3 border-t-2 border-gray-400"></div></div>
          <div class="flex-1 w-[2px] bg-gray-400 relative">
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-gray-600 text-xs font-medium bg-white py-2" style="writing-mode: vertical-rl; transform: rotate(180deg);">
              5.000 mm
            </div>
          </div>
          <div class="w-full flex justify-center"><div class="w-3 border-b-2 border-gray-400"></div></div>
        </div>
      </div>
    </div>
  `;

  renderShelvesList('shelves-left', shelvesB, 'left');
  renderShelvesList('shelves-right', shelvesA, 'right');

  initDomCache();

  lucide.createIcons();
  attachEventListeners();
}

function getSeparatorHTML() {
  return `
    <div class="w-full h-2 md:h-3 flex items-center px-0.5">
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 10">
        <defs>
          <marker id="arrowhead-left" markerWidth="3" markerHeight="3" refX="0" refY="1.5" orient="auto">
            <polygon points="3,0 0,1.5 3,3" fill="#2b6b9c" />
          </marker>
          <marker id="arrowhead-right" markerWidth="3" markerHeight="3" refX="3" refY="1.5" orient="auto">
            <polygon points="0,0 3,1.5 0,3" fill="#2b6b9c" />
          </marker>
        </defs>
        <line x1="1" y1="5" x2="99" y2="5" stroke="#2b6b9c" stroke-width="1.5" marker-start="url(#arrowhead-left)" marker-end="url(#arrowhead-right)" />
      </svg>
    </div>
  `;
}

function renderShelvesList(containerId, shelfIds, side) {
  const container = document.getElementById(containerId);
  let html = getSeparatorHTML();

  shelfIds.forEach(id => {
    const data = shelvesData[id];
    const materialsCount = data?.materials.length || 0;
    const maxCapacity = ['B12', 'B13', 'B14'].includes(id) ? 50 : 20;
    const isOverCapacity = materialsCount > maxCapacity;

    const justifyClass = side === 'left' ? 'justify-end pr-1 sm:pr-2' : 'justify-start pl-1 sm:pl-2';
    const tooltipSideClass = side === 'left' ? 'left-side left-full pl-3 md:pl-5' : 'right-side right-full pr-3 md:pr-5';

    let materialsHTML = '';
    if (materialsCount > 0) {
      materialsHTML = data.materials.map(m => `
        <div class="bg-gray-50 border border-gray-100 rounded-md p-2 text-xs flex justify-between items-start gap-3">
          <div class="min-w-0">
            <div class="font-bold text-gray-800">${m.code}</div>
            <div class="text-gray-600 truncate" title="${m.name}">${m.name}</div>
          </div>
          <div class="flex-shrink-0 font-mono font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
            ${m.weight} kg
          </div>
        </div>
      `).join('');
    } else {
      materialsHTML = `<div class="text-center py-4 text-gray-400 text-xs italic">Kệ trống, chưa có vật tư</div>`;
    }

    html += `
      <div id="shelf-${id}" class="shelf-container ${side}-side relative h-8 sm:h-10 md:h-12 flex items-center ${justifyClass} cursor-pointer rounded-sm ${isOverCapacity ? 'bg-red-200 ring-1 ring-red-400' : 'bg-[#f4c7b3]'}" data-id="${id}">
        
        <div class="highlight-pulse hidden absolute inset-0 rounded-sm ring-4 ring-blue-400/50 animate-pulse pointer-events-none"></div>

        <div class="hover-effects hidden absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-sm">
          <div class="absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(45deg,#000,#000_2px,transparent_2px,transparent_8px)]"></div>
          <div class="absolute top-0 bottom-0 w-[50%] bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
          <svg class="absolute inset-0 w-full h-full pointer-events-none z-0">
            <rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="8 8" class="animate-marching-ants svg-rect" rx="2" />
          </svg>
        </div>

        <div class="shelf-circle w-6 h-6 sm:w-8 sm:h-8 rounded-full border-[1.5px] flex items-center justify-center font-bold text-[10px] sm:text-xs md:text-sm z-10 shadow-sm border-red-500 text-red-600 bg-white transition-all duration-300">
          ${id}
        </div>

        <div class="search-badge hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div class="bg-blue-600 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap badge-text">
            0 cuộn
          </div>
        </div>

        <div class="shelf-tooltip ${tooltipSideClass} absolute top-1/2 z-50">
          <div class="w-auto min-w-[256px] max-w-[450px] bg-white p-3 md:p-4 rounded-xl shadow-2xl border ${isOverCapacity ? 'border-red-300' : 'border-red-100'} pointer-events-auto text-left">
            <h3 class="font-bold ${isOverCapacity ? 'text-red-700' : 'text-red-600'} border-b pb-2 mb-2 text-sm md:text-base flex justify-between items-center gap-4">
              <span>Kệ ${id}</span>
              <div class="flex flex-col items-end">
                <span class="text-[10px] font-medium px-2 py-0.5 rounded-full ${isOverCapacity ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}">
                  ${materialsCount}/${maxCapacity} cuộn
                </span>
              </div>
            </h3>
            <div class="max-h-64 overflow-y-auto pr-1 space-y-1.5 mt-2 custom-scrollbar">
              ${materialsHTML}
            </div>
          </div>
        </div>
      </div>
    `;
    html += getSeparatorHTML();
  });

  container.innerHTML = html;
}

function attachEventListeners() {
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  const searchResultsEl = document.getElementById('search-results');
  const gratingArea = document.getElementById('grating-area');

  // Search Input
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    isSearchFocused = true;
    if (searchQuery === '') {
      highlightedShelves = [];
    }
    updateSearchUI();
  });

  searchInput.addEventListener('focus', () => {
    isSearchFocused = true;
    updateSearchUI();
  });

  // Clear Search
  clearSearchBtn.addEventListener('click', () => {
    searchQuery = '';
    searchInput.value = '';
    highlightedShelves = [];
    isSearchFocused = false;
    updateSearchUI();
  });

  // Click outside search
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResultsEl.contains(e.target) && !clearSearchBtn.contains(e.target)) {
      isSearchFocused = false;
      updateSearchUI();
    }
  });

  // Hover on Shelves
  allShelves.forEach(id => {
    const shelfEl = document.getElementById(`shelf-${id}`);
    if (shelfEl) {
      shelfEl.addEventListener('mouseenter', () => setHoverState(id));
      shelfEl.addEventListener('mouseleave', () => setHoverState(null));
    }
  });

  // Hover on Grating
  gratingArea.addEventListener('mouseenter', () => setHoverState('grating'));
  gratingArea.addEventListener('mouseleave', () => setHoverState(null));
}

function setHoverState(id) {
  hoveredShelf = id;
  if (!domCache) return;

  const mainTitle = domCache.mainTitle;
  const centerAisle = domCache.centerAisle;
  const bottomArea = domCache.bottomArea;
  const gratingArea = domCache.gratingArea;

  if (mainTitle) {
    if (id) {
      mainTitle.style.opacity = '0.4';
      mainTitle.style.transform = 'scale(0.98)';
    } else {
      mainTitle.style.opacity = '1';
      mainTitle.style.transform = 'scale(1)';
    }
  }

  // Update center aisle
  if (centerAisle) {
    if (id && id !== 'grating') {
      centerAisle.style.opacity = '0.5';
    } else {
      centerAisle.style.opacity = '1';
    }
  }

  // Update bottom area
  if (bottomArea) {
    if (id && id !== 'grating') {
      bottomArea.style.opacity = '0.3';
    } else {
      bottomArea.style.opacity = '1';
    }
  }

  // Update grating
  if (gratingArea) {
    if (id === 'grating') {
      gratingArea.classList.add('hovered');
      gratingArea.classList.remove('dimmed');
      const gratingEffects = gratingArea.querySelector('.grating-effects');
      if (gratingEffects) gratingEffects.classList.remove('hidden');
    } else if (id !== null) {
      gratingArea.classList.remove('hovered');
      gratingArea.classList.add('dimmed');
      const gratingEffects = gratingArea.querySelector('.grating-effects');
      if (gratingEffects) gratingEffects.classList.add('hidden');
    } else {
      gratingArea.classList.remove('hovered', 'dimmed');
      const gratingEffects = gratingArea.querySelector('.grating-effects');
      if (gratingEffects) gratingEffects.classList.add('hidden');
    }
  }

  // Update all shelves
  allShelves.forEach(shelfId => {
    const cache = domCache.shelves[shelfId];
    if (!cache || !cache.shelfEl) return;

    const shelfEl = cache.shelfEl;
    if (id === shelfId) {
      shelfEl.classList.add('hovered');
      shelfEl.classList.remove('dimmed');
      if (cache.hoverEffectsEl) cache.hoverEffectsEl.classList.remove('hidden');
      if (cache.shelfCircleEl) cache.shelfCircleEl.style.transform = 'scale(1.1)';

      // Update SVG stroke color based on highlight
      const isHighlighted = shelfEl.classList.contains('highlighted');
      if (cache.svgRectEl) cache.svgRectEl.setAttribute('stroke', isHighlighted ? '#3b82f6' : '#dc2626');

    } else if (id !== null) {
      shelfEl.classList.remove('hovered');
      shelfEl.classList.add('dimmed');
      if (cache.hoverEffectsEl) cache.hoverEffectsEl.classList.add('hidden');
      if (cache.shelfCircleEl) cache.shelfCircleEl.style.transform = 'scale(1)';
    } else {
      shelfEl.classList.remove('hovered', 'dimmed');
      if (cache.hoverEffectsEl) cache.hoverEffectsEl.classList.add('hidden');
      if (cache.shelfCircleEl) cache.shelfCircleEl.style.transform = 'scale(1)';
    }
  });
}

function updateSearchUI() {
  const clearSearchBtn = document.getElementById('clear-search');
  const searchResultsEl = document.getElementById('search-results');

  if (searchQuery) {
    clearSearchBtn.classList.remove('hidden');
  } else {
    clearSearchBtn.classList.add('hidden');
  }

  // Calculate matches
  let results = [];
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    results = materialsData.filter(m =>
      m.code.toLowerCase().includes(query) ||
      m.name.toLowerCase().includes(query)
    ).slice(0, 10);
  }

  // Calculate shelf match counts
  const shelfMatchCounts = {};
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    const isExactMatch = !isSearchFocused && highlightedShelves.length > 0;

    Object.values(shelvesData).forEach(shelf => {
      let count = 0;
      shelf.materials.forEach(m => {
        if (isExactMatch) {
          if (m.code.toLowerCase() === query) count++;
        } else {
          if (m.code.toLowerCase().includes(query) || m.name.toLowerCase().includes(query)) {
            count++;
          }
        }
      });
      if (count > 0) {
        shelfMatchCounts[shelf.id] = count;
      }
    });
  }

  // Render dropdown
  if (isSearchFocused && searchQuery) {
    searchResultsEl.classList.remove('hidden');
    if (results.length > 0) {
      searchResultsEl.innerHTML = results.map(material => `
        <div class="px-4 py-3 hover:bg-red-50 cursor-pointer flex items-center justify-between group transition-colors" onclick="selectMaterial('${material.code}', '${material.shelves.join(',')}')">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 group-hover:bg-red-500 group-hover:text-white transition-colors flex-shrink-0">
              <i data-lucide="package" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="font-bold text-gray-800 truncate flex items-center gap-2">
                ${material.code}
                <span class="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-normal">
                  ${material.count} cuộn
                </span>
              </div>
              <div class="text-xs text-gray-500 truncate">${material.name}</div>
            </div>
          </div>
          <div class="flex flex-wrap justify-end gap-1 ml-2 max-w-[120px]">
            ${material.shelves.map(s => `
              <span class="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                Kệ ${s}
              </span>
            `).join('')}
          </div>
        </div>
      `).join('');
      lucide.createIcons();
    } else {
      searchResultsEl.innerHTML = `<div class="px-4 py-8 text-center text-gray-500">Không tìm thấy vật tư nào phù hợp.</div>`;
    }
  } else {
    searchResultsEl.classList.add('hidden');
  }

  // Update shelf highlights
  allShelves.forEach(id => {
    const cache = domCache ? domCache.shelves[id] : null;
    const shelfEl = cache ? cache.shelfEl : document.getElementById(`shelf-${id}`);
    if (!shelfEl) return;

    const isHighlighted = highlightedShelves.includes(id) || (isSearchFocused && !!shelfMatchCounts[id]);
    const matchCount = shelfMatchCounts[id];

    const circleEl = cache ? cache.shelfCircleEl : shelfEl.querySelector('.shelf-circle');
    const pulseEl = cache ? cache.pulseEl : shelfEl.querySelector('.highlight-pulse');
    const badgeEl = cache ? cache.badgeEl : shelfEl.querySelector('.search-badge');
    const tooltipEl = cache ? cache.tooltipEl : shelfEl.querySelector('.shelf-tooltip > div');
    const tooltipTitleEl = cache ? cache.tooltipTitleEl : shelfEl.querySelector('.shelf-tooltip h3');

    if (isHighlighted) {
      shelfEl.classList.add('highlighted', 'bg-blue-200', 'ring-2', 'ring-blue-500', 'shadow-[0_0_15px_rgba(59,130,246,0.5)]');
      shelfEl.classList.remove('bg-[#f4c7b3]', 'bg-red-200', 'ring-1', 'ring-red-400');

      circleEl.classList.add('border-blue-500', 'text-blue-700');
      circleEl.classList.remove('border-red-500', 'text-red-600');
      circleEl.style.backgroundColor = shelfEl.classList.contains('hovered') ? '#dbeafe' : '#eff6ff';

      pulseEl.classList.remove('hidden');

      tooltipEl.classList.add('border-blue-200');
      tooltipEl.classList.remove('border-red-100', 'border-red-300');

      tooltipTitleEl.classList.add('text-blue-600');
      tooltipTitleEl.classList.remove('text-red-600', 'text-red-700');

      if (matchCount > 0) {
        badgeEl.classList.remove('hidden');
        badgeEl.querySelector('.badge-text').textContent = `${matchCount} cuộn`;
      } else {
        badgeEl.classList.add('hidden');
      }

    } else {
      shelfEl.classList.remove('highlighted', 'bg-blue-200', 'ring-2', 'ring-blue-500', 'shadow-[0_0_15px_rgba(59,130,246,0.5)]');

      const data = shelvesData[id];
      const isOverCapacity = (data?.materials.length || 0) > (['B12', 'B13', 'B14'].includes(id) ? 50 : 20);

      if (isOverCapacity) {
        shelfEl.classList.add('bg-red-200', 'ring-1', 'ring-red-400');
        tooltipEl.classList.add('border-red-300');
        tooltipTitleEl.classList.add('text-red-700');
      } else {
        shelfEl.classList.add('bg-[#f4c7b3]');
        tooltipEl.classList.add('border-red-100');
        tooltipTitleEl.classList.add('text-red-600');
      }

      circleEl.classList.add('border-red-500', 'text-red-600');
      circleEl.classList.remove('border-blue-500', 'text-blue-700');
      circleEl.style.backgroundColor = shelfEl.classList.contains('hovered') ? '#fee2e2' : '#ffffff';

      pulseEl.classList.add('hidden');
      badgeEl.classList.add('hidden');

      tooltipEl.classList.remove('border-blue-200');
      tooltipTitleEl.classList.remove('text-blue-600');
    }
  });
}

// Global function for onclick
window.selectMaterial = function (code, shelvesStr) {
  const searchInput = document.getElementById('search-input');
  highlightedShelves = shelvesStr.split(',');
  isSearchFocused = false;
  searchQuery = code;
  searchInput.value = code;
  updateSearchUI();
};

// Start
init();