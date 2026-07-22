# Optimize Hover & Click Performance for 5S Warehouse Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate lag and delay during hover and click interactions in 5S Warehouse Maps by removing full-page DOM re-renders, caching DOM elements, and avoiding heavy CSS filter blur effects.

**Architecture:** 
1. Cache DOM references inside `5s-so-do-phoi-cuon.js` and remove inline `filter` updates.
2. Refactor `5s-so-do-phe-lieu.js` to isolate initialization/data rendering from active hover/click states; implement lightweight DOM update methods that target only affected elements.
3. Remove layout-thrashing `filter: blur(...)` rules from CSS classes.

**Tech Stack:** Vanilla JS, CSS, Tailwind CSS.

## Global Constraints

- No external libraries beyond what is already used (Lucide icons, PapaParse).
- Keep animations hardware-accelerated.
- Maintain full layout compatibility.

---

### Task 1: Optimize CSS Transitions and Remove Blur Filters

**Files:**
- Modify: [5s-so-do-phoi-cuon.css](file:///c:/Users/benhhc/Desktop/web/assets/css/5s/5s-so-do-phoi-cuon.css)

- [ ] **Step 1: Remove blur filters from dimmed classes in CSS**
  Update `.shelf-container.dimmed` and `.grating-container.dimmed` in `assets/css/5s/5s-so-do-phoi-cuon.css` to use opacity and scale transitions, removing any `filter: blur(...)` calls.

  Replace:
  ```css
  .shelf-container.dimmed {
    opacity: 0.15;
    transform: scale(0.95);
    filter: blur(2px);
    z-index: 0;
  }
  ```
  With:
  ```css
  .shelf-container.dimmed {
    opacity: 0.25;
    transform: scale(0.97);
    z-index: 0;
  }
  ```

  And replace:
  ```css
  .grating-container.dimmed {
    opacity: 0.3;
    transform: scale(0.98);
    filter: blur(2px);
  }
  ```
  With:
  ```css
  .grating-container.dimmed {
    opacity: 0.4;
    transform: scale(0.98);
  }
  ```

---

### Task 2: Implement DOM Cache and Optimize Hover States in Kho Phôi Cuộn JS

**Files:**
- Modify: [5s-so-do-phoi-cuon.js](file:///c:/Users/benhhc/Desktop/web/assets/js/5s/5s-so-do-phoi-cuon.js)

- [ ] **Step 1: Declare DOM Cache globals and cache initialization**
  Add a global `domCache` variable and write `initDomCache()` to store elements after they are appended to the DOM.
  
  Add to the top sections:
  ```javascript
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
  ```

  Call `initDomCache()` in `renderMainApp()` after rendering the shelves:
  ```javascript
    renderShelvesList('shelves-left', shelvesB, 'left');
    renderShelvesList('shelves-right', shelvesA, 'right');

    initDomCache(); // <--- Call here

    lucide.createIcons();
    attachEventListeners();
  ```

- [ ] **Step 2: Refactor `setHoverState(id)` to use Cache and Opacity Dimming**
  Modify `setHoverState(id)` in `5s-so-do-phoi-cuon.js` to avoid `document.getElementById` and `querySelector` calls and remove `style.filter = 'blur(...)'`.
  
  ```javascript
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
  ```

- [ ] **Step 3: Update `updateSearchUI` to utilize DOM Cache references**
  Optimize shelf elements fetching inside `updateSearchUI` (around line 543) by using cached elements.
  
  ```javascript
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
  ```

---

### Task 3: Refactor Kho Phế Liệu JS to Remove Page Re-render on Hover

**Files:**
- Modify: [5s-so-do-phe-lieu.js](file:///c:/Users/benhhc/Desktop/web/assets/js/5s/5s-so-do-phe-lieu.js)

- [ ] **Step 1: Replace inline state logic inside `render()` map rendering**
  Refactor the map rendering logic inside `render()` to output static inline styles instead of checking `hoveredId` on map areas, status list items, and detail card templates.

  Change the `.map-container` mapping logic in `render()` so area styles are default:
  ```javascript
                      <!-- Map Area -->
                      <div class="relative w-full h-full" id="map-container">
                          ${areas.map(area => {
          const hasCapacity = area.capacity !== undefined;
          const percentage = hasCapacity && area.maxCapacity ? Math.min((area.capacity || 0) / area.maxCapacity * 100, 100) : 0;
          const isShort = parseFloat(area.height) <= 10;

          return `
                                  <div
                                      data-id="${area.id}"
                                      class="map-area absolute flex flex-col items-center justify-center text-center p-0.5 overflow-hidden ${area.id === 'tram-dien' ? 'cursor-default' : 'cursor-pointer'}"
                                      style="
                                          top: ${area.top};
                                          left: ${area.left};
                                          width: ${area.width};
                                          height: ${area.height};
                                          background-color: ${area.color};
                                          border: 1px solid rgba(255,255,255,0.8);
                                          z-index: 1;
                                          transform: scale(1);
                                      "
                                  >
                                      <div class="flex flex-col items-center justify-center w-full h-full gap-0.5 md:gap-1">
                                          <div class="flex items-center justify-center ${isShort ? 'flex-row gap-1.5 md:gap-2' : 'flex-col gap-0.5 md:gap-1'}">
                                              <span class="font-bold text-gray-900 select-none leading-none drop-shadow-sm ${area.id === 'loai-1' ? 'text-xl md:text-3xl' : isShort ? 'text-[8px] sm:text-[10px] md:text-xs' : 'text-[10px] sm:text-xs md:text-sm'} ${area.id === 'tram-dien' ? 'text-gray-600 font-normal' : ''}">
                                                  ${area.name}
                                              </span>
                                              ${hasCapacity && area.id !== 'tram-dien' ? `
                                              <span class="font-black text-gray-900 drop-shadow-md leading-none ${isShort ? 'text-[8px] sm:text-[10px] md:text-xs bg-white/40 px-1 py-0.5 rounded-sm' : 'text-[9px] sm:text-[11px] md:text-xs'}">
                                                  ${(area.capacity || 0).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${area.unit}
                                              </span>
                                              ` : ''}
                                          </div>
                                          
                                          ${hasCapacity && area.id !== 'tram-dien' ? `
                                          <div class="w-[90%] bg-white/60 rounded-full overflow-hidden shadow-inner ${isShort ? 'h-1 max-w-[50px] md:max-w-[80px]' : 'h-1.5 md:h-2 max-w-[120px]'}">
                                              <div 
                                                  class="h-full transition-all duration-500 ${percentage > 90 ? 'bg-red-600' : percentage > 70 ? 'bg-orange-500' : 'bg-green-600'}"
                                                  style="width: ${percentage}%"
                                              ></div>
                                          </div>
                                          ` : ''}
                                      </div>
                                  </div>
                              `;
      }).join('')}
                      </div>
  ```

  Modify the status items mapping inside `render()` to default class names:
  ```javascript
      return `
              <div 
                  data-id="${area.id}"
                  class="status-item p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 bg-white border-gray-50 hover:bg-gray-50"
              >
                  <div class="flex justify-between items-center">
                      <span class="text-xs font-bold text-gray-700">
                          ${area.name}
                      </span>
  ```

  Modify the details card area inside `render()` to be an empty container with a specific ID:
  ```javascript
                  <!-- Hover Details Card -->
                  <div id="hover-details-card-container" class="transition-all duration-300 opacity-0 scale-95 pointer-events-none hidden">
                  </div>
  ```

- [ ] **Step 2: Add `updateUIForHoverState(id)` to update components dynamically**
  Write the new function `updateUIForHoverState(id)` that directly updates CSS classes, properties, and the content of the details card. Make sure it uses local `lucide.createIcons()` scoping.

  ```javascript
  function updateUIForHoverState(id) {
    hoveredId = id;

    // 1. Update Map Areas
    const mapAreas = document.querySelectorAll('.map-area');
    mapAreas.forEach(el => {
      const areaId = el.getAttribute('data-id');
      if (areaId === 'tram-dien') return;

      const isHovered = (id === areaId);
      el.style.border = isHovered ? '2px solid #d92d20' : '1px solid rgba(255,255,255,0.8)';
      el.style.zIndex = isHovered ? '20' : '1';
      el.style.transform = isHovered ? 'scale(1.02)' : 'scale(1)';
      el.style.filter = (id && !isHovered) ? 'brightness(0.95) grayscale(0.1)' : 'none';
    });

    // 2. Update Status Items
    const statusItems = document.querySelectorAll('.status-item');
    statusItems.forEach(el => {
      const areaId = el.getAttribute('data-id');
      const isHovered = (id === areaId);

      if (isHovered) {
        el.className = 'status-item p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 bg-red-50 border-red-200 shadow-sm';
      } else {
        el.className = 'status-item p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 bg-white border-gray-50 hover:bg-gray-50';
      }
    });

    // 3. Update Hover Details Card
    const cardContainer = document.getElementById('hover-details-card-container');
    if (cardContainer) {
      if (id && id !== 'tram-dien') {
        const area = areas.find(a => a.id === id);
        if (area) {
          const percentage = area.capacity && area.maxCapacity ? Math.min((area.capacity || 0) / area.maxCapacity * 100, 100) : 0;
          cardContainer.innerHTML = `
            <div class="bg-[#1a1a1a] text-white p-4 rounded-xl shadow-2xl border border-gray-800">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="map-pin" class="w-4 h-4 text-red-500"></i>
                    <h3 class="text-sm font-bold uppercase">${area.name}</h3>
                </div>
                <p class="text-[10px] text-gray-400 mb-3 leading-tight italic">
                    ${area.description}
                </p>
                <div class="flex flex-wrap gap-1.5 mb-3">
                    ${area.info.map(item => `
                        <span class="text-[9px] bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                            ${item}
                        </span>
                    `).join('')}
                </div>
                <div class="bg-white/5 p-2 rounded-lg">
                    <div class="flex justify-between text-[10px] mb-1">
                        <span class="text-gray-400">TRỐNG</span>
                        <span class="font-bold text-green-400">
                            ${area.capacity !== undefined && area.maxCapacity !== undefined ? `${(area.maxCapacity - area.capacity).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${area.unit}` : 'N/A'}
                      </span>
                  </div>
                  <div class="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                          class="h-full bg-red-500" 
                          style="width: ${percentage}%"
                      ></div>
                  </div>
              </div>
          </div>
        `;
        lucide.createIcons({
          attrs: { class: 'lucide' },
          nameAttr: 'data-lucide',
          root: cardContainer
        });

        cardContainer.className = 'transition-all duration-300 opacity-100 scale-100';
      }
    } else {
      cardContainer.className = 'transition-all duration-300 opacity-0 scale-95 pointer-events-none hidden';
    }
  }
}
```

- [ ] **Step 3: Update `attachEventListeners()` to trigger `updateUIForHoverState`**
  Modify event listeners inside `attachEventListeners()` to use `updateUIForHoverState(id)` instead of `render()`.
  
  ```javascript
      const mapAreas = document.querySelectorAll('.map-area');
      mapAreas.forEach(el => {
          const id = el.getAttribute('data-id');
          if (id && id !== 'tram-dien') {
              el.addEventListener('mouseenter', () => {
                  updateUIForHoverState(id);
              });
              el.addEventListener('mouseleave', () => {
                  updateUIForHoverState(null);
              });
              el.addEventListener('click', () => {
                  updateUIForHoverState(hoveredId === id ? null : id);
              });
          }
      });

      const statusItems = document.querySelectorAll('.status-item');
      statusItems.forEach(el => {
          const id = el.getAttribute('data-id');
          if (id) {
              el.addEventListener('mouseenter', () => {
                  updateUIForHoverState(id);
              });
              el.addEventListener('mouseleave', () => {
                  updateUIForHoverState(null);
              });
              el.addEventListener('click', () => {
                  updateUIForHoverState(hoveredId === id ? null : id);
              });
          }
      });
  ```
