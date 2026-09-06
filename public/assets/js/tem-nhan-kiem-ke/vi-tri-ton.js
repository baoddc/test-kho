/* =============================================================================
   TRA CỨU TỒN KHO THEO VỊ TRÍ KỆ - SCRIPT
   Xử lý tổng hợp tồn kho Xà gồ & Tole theo mã kệ A01-A14, B01-B14 & Grating
================================================================================ */

/* Global Modal Opener - Available immediately */
window.openCoilScanModal = function () {
  const modalEl = document.getElementById('coilScanModal');
  if (!modalEl) {
    console.warn('Không tìm thấy element #coilScanModal');
    return;
  }
  if (modalEl.parentElement !== document.body) {
    document.body.appendChild(modalEl);
  }
  const bs = window.bootstrap || (typeof bootstrap !== 'undefined' ? bootstrap : null);
  if (bs && bs.Modal) {
    const modal = bs.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } else {
    modalEl.classList.add('show');
    modalEl.style.display = 'block';
  }
};

function initViTriTonPage() {
  const rackSelectDropdown = document.getElementById('rackSelectDropdown');
  const displayRackTitle = document.getElementById('displayRackTitle');
  const totalRollsCount = document.getElementById('totalRollsCount');
  const totalWeightKg = document.getElementById('totalWeightKg');
  const statXgSummary = document.getElementById('statXgSummary');
  const statToleSummary = document.getElementById('statToleSummary');
  const tabCountXg = document.getElementById('tabCountXg');
  const tabCountTole = document.getElementById('tabCountTole');
  const xgTotalKgBadge = document.getElementById('xgTotalKgBadge');
  const toleTotalKgBadge = document.getElementById('toleTotalKgBadge');

  const xgTableBody = document.getElementById('xgTableBody');
  const toleTableBody = document.getElementById('toleTableBody');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const mainDataCard = document.getElementById('mainDataCard');

  const btnScanAnotherRack = document.getElementById('btnScanAnotherRack');
  const btnRefreshData = document.getElementById('btnRefreshData');
  const btnScanCoil = document.getElementById('btnScanCoil');

  // Coil Scanner Modal Elements
  const coilScanModalEl = document.getElementById('coilScanModal');
  const coilBarcodeInput = document.getElementById('coilBarcodeInput');
  const btnSubmitCoilBarcode = document.getElementById('btnSubmitCoilBarcode');
  const btnToggleCameraScanner = document.getElementById('btnToggleCameraScanner');
  const coilCameraContainer = document.getElementById('coilCameraContainer');
  const coilCameraReader = document.getElementById('coilCameraReader');
  const coilCameraStatus = document.getElementById('coilCameraStatus');
  const btnCloseCameraReader = document.getElementById('btnCloseCameraReader');
  const coilScanAlert = document.getElementById('coilScanAlert');
  const coilScanResultContainer = document.getElementById('coilScanResultContainer');
  const resMatCode = document.getElementById('resMatCode');
  const resBatch = document.getElementById('resBatch');
  const resScannedKg = document.getElementById('resScannedKg');
  const resMatName = document.getElementById('resMatName');
  const resTotalRolls = document.getElementById('resTotalRolls');
  const resTotalKg = document.getElementById('resTotalKg');
  const resCurrentRackName = document.getElementById('resCurrentRackName');
  const resCurrentRackText = document.getElementById('resCurrentRackText');
  const resCurrentRackBox = document.getElementById('resCurrentRackBox');
  const coilBatchTableBody = document.getElementById('coilBatchTableBody');
  const coilScanFooterStatus = document.getElementById('coilScanFooterStatus');

  // Coil Result Popup Elements (Mockup 2)
  const coilResultModalEl = document.getElementById('coilResultModal');
  const resWarehouseBadge = document.getElementById('resWarehouseBadge');
  const identifiedRollBanner = document.getElementById('identifiedRollBanner');
  const bannerBadgeStatus = document.getElementById('bannerBadgeStatus');
  const bannerTextTitle = document.getElementById('bannerTextTitle');
  const bannerRackHighlight = document.getElementById('bannerRackHighlight');
  const btnBannerSwitchRack = document.getElementById('btnBannerSwitchRack');
  const lblBannerSwitchRack = document.getElementById('lblBannerSwitchRack');
  const bannerRollMetaText = document.getElementById('bannerRollMetaText');
  const metaCuonId = document.getElementById('metaCuonId');
  const metaBatch = document.getElementById('metaBatch');
  const metaKg = document.getElementById('metaKg');
  const metaDays = document.getElementById('metaDays');
  const resMaterialFullName = document.getElementById('resMaterialFullName');
  const resMatCodeBadge = document.getElementById('resMatCodeBadge');
  const resBatchBadge = document.getElementById('resBatchBadge');
  const btnToggleAllBatches = document.getElementById('btnToggleAllBatches');
  const lblToggleAllBatches = document.getElementById('lblToggleAllBatches');
  const lblBatchTonTitle = document.getElementById('lblBatchTonTitle');
  const valBatchTonStock = document.getElementById('valBatchTonStock');
  const lblBatchLocationTitle = document.getElementById('lblBatchLocationTitle');
  const rackDistributionPills = document.getElementById('rackDistributionPills');
  const txtTableBatchCount = document.getElementById('txtTableBatchCount');
  const popupRollsTableBody = document.getElementById('popupRollsTableBody');

  let currentScanResultState = {
    parsed: null,
    matchedRoll: null,
    matchingBatchRolls: [],
    allMatRolls: [],
    showAllBatches: false
  };

  let coilHtml5QrCodeInstance = null;
  let allWarehouseActiveRolls = [];

  // Standard Racks List
  const standardRacks = (window.qrScannerService && window.qrScannerService.getAllStandardRacks)
    ? window.qrScannerService.getAllStandardRacks()
    : [
        'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'A12', 'A13', 'A14',
        'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12', 'B13', 'B14',
        'GRATING', 'GR-01', 'GR-02'
      ];

  // Parse Initial Rack from URL
  function getRackFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('vitri') || params.get('loc') || params.get('location') || 'A01';
    return (window.qrScannerService && window.qrScannerService.parseLocationQRCode)
      ? window.qrScannerService.parseLocationQRCode(raw)
      : raw.trim().toUpperCase();
  }

  let currentRack = getRackFromUrl();

  // Populate Dropdown
  function initRackDropdown() {
    if (!rackSelectDropdown) return;
    rackSelectDropdown.innerHTML = '';

    // Check if currentRack is not in standard list, add it
    if (!standardRacks.includes(currentRack)) {
      standardRacks.unshift(currentRack);
    }

    standardRacks.forEach(rack => {
      const opt = document.createElement('option');
      opt.value = rack;
      opt.textContent = `Kệ ${rack}`;
      if (rack === currentRack) opt.selected = true;
      rackSelectDropdown.appendChild(opt);
    });

    rackSelectDropdown.addEventListener('change', (e) => {
      selectRack(e.target.value);
    });
  }

  function selectRack(rackCode) {
    currentRack = rackCode.trim().toUpperCase();
    if (rackSelectDropdown) rackSelectDropdown.value = currentRack;
    
    // Update URL query without full reload
    const url = new URL(window.location);
    url.searchParams.set('vitri', currentRack);
    window.history.pushState({}, '', url);

    updateDisplayTitle();
    loadRackInventory(currentRack);
  }

  function updateDisplayTitle() {
    if (displayRackTitle) displayRackTitle.textContent = `KỆ ${currentRack}`;
  }

  // Utilities
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

  function calculateStorageAge(importDateStr) {
    if (!importDateStr) return '';
    const dateObj = new Date(importDateStr);
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateObj.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - dateObj) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  }

  function formatKg(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  // Fetch Inventory from Supabase
  async function loadRackInventory(rackCode) {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (mainDataCard) mainDataCard.style.display = 'none';

    try {
      const fetchFunc = typeof fetchAllFromSupabase === 'function'
        ? fetchAllFromSupabase
        : async (tbl) => {
            if (!window.supabase) return [];
            let rows = [], from = 0, batchSize = 1000, hasMore = true;
            while (hasMore) {
              const { data, error } = await supabase.from(tbl).select('*').order('id', { ascending: true }).range(from, from + batchSize - 1);
              if (error) throw error;
              if (data && data.length > 0) { rows = rows.concat(data); if (data.length < batchSize) hasMore = false; else from += batchSize; } else hasMore = false;
            }
            return rows;
          };

      // Parallel fetch for XG & Tole
      const [xgNhapAll, xgXuatAll, toleNhapAll, toleXuatAll] = await Promise.all([
        fetchFunc('xg-nhap').catch(() => []),
        fetchFunc('xg-xuat').catch(() => []),
        fetchFunc('tole-nhap').catch(() => []),
        fetchFunc('tole-xuat').catch(() => [])
      ]);

      const xgExportedIds = new Set(
        xgXuatAll.map(r => String(r['Cuộn ID'] || '').trim().toLowerCase()).filter(Boolean)
      );
      const toleExportedIds = new Set(
        toleXuatAll.map(r => String(r['Cuộn ID'] || '').trim().toLowerCase()).filter(Boolean)
      );

      // Cache all active rolls across the entire warehouse (XG + Tole)
      const activeXgAll = xgNhapAll.filter(row => {
        const cid = String(row['Cuộn ID'] || '').trim().toLowerCase();
        return cid && !xgExportedIds.has(cid);
      }).map(r => ({ ...r, _wh: 'Kho Xà gồ' }));

      const activeToleAll = toleNhapAll.filter(row => {
        const cid = String(row['Cuộn ID'] || '').trim().toLowerCase();
        return cid && !toleExportedIds.has(cid);
      }).map(r => ({ ...r, _wh: 'Kho Tole' }));

      allWarehouseActiveRolls = [...activeXgAll, ...activeToleAll];

      const normalizedRack = rackCode.trim().toLowerCase();

      // Filter active rolls on this rack
      const xgTonOnRack = activeXgAll.filter(row => {
        const rowPos = String(row['Vị trí'] || '').trim().toLowerCase();
        return rowPos === normalizedRack;
      });

      const toleTonOnRack = activeToleAll.filter(row => {
        const rowPos = String(row['Vị trí'] || '').trim().toLowerCase();
        return rowPos === normalizedRack;
      });

      // Calculate totals
      const xgKg = xgTonOnRack.reduce((sum, r) => sum + (parseFloat(r['Số lượng (Kg)']) || 0), 0);
      const toleKg = toleTonOnRack.reduce((sum, r) => sum + (parseFloat(r['Số lượng (Kg)']) || 0), 0);
      const totalCount = xgTonOnRack.length + toleTonOnRack.length;
      const totalKg = xgKg + toleKg;

      // Update Summary UI
      if (totalRollsCount) totalRollsCount.textContent = totalCount;
      if (totalWeightKg) totalWeightKg.textContent = formatKg(totalKg);
      if (statXgSummary) statXgSummary.textContent = `XG: ${xgTonOnRack.length} cuộn (${formatKg(xgKg)} Kg)`;
      if (statToleSummary) statToleSummary.textContent = `Tole: ${toleTonOnRack.length} cuộn (${formatKg(toleKg)} Kg)`;

      if (tabCountXg) tabCountXg.textContent = xgTonOnRack.length;
      if (tabCountTole) tabCountTole.textContent = toleTonOnRack.length;
      if (xgTotalKgBadge) xgTotalKgBadge.textContent = `${formatKg(xgKg)} Kg (${xgTonOnRack.length} cuộn)`;
      if (toleTotalKgBadge) toleTotalKgBadge.textContent = `${formatKg(toleKg)} Kg (${toleTonOnRack.length} cuộn)`;

      // Render Tables
      renderTableRows(xgTableBody, xgTonOnRack, 'xg');
      renderTableRows(toleTableBody, toleTonOnRack, 'tole');

      if (loadingIndicator) loadingIndicator.style.display = 'none';
      if (mainDataCard) mainDataCard.style.display = 'block';

      // If coil scan modal has active barcode query, refresh it with updated inventory
      if (coilBarcodeInput && coilBarcodeInput.value.trim() && coilScanResultContainer && coilScanResultContainer.style.display !== 'none') {
        handleProcessCoilBarcode(coilBarcodeInput.value.trim());
      }

    } catch (err) {
      console.error('Error loading location inventory:', err);
      if (loadingIndicator) {
        loadingIndicator.innerHTML = `<div class="text-danger small">Lỗi tải dữ liệu: ${err.message}</div>`;
      }
    }
  }

  function renderTableRows(tbody, items, warehouseType) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="text-center py-4 text-muted fst-italic">
            Không có cuộn ${warehouseType === 'xg' ? 'Xà gồ' : 'Tole'} nào tại kệ này.
          </td>
        </tr>
      `;
      return;
    }

    items.forEach((item, index) => {
      const age = calculateStorageAge(item['Ngày nhập']);
      const ageBadge = age !== '' ? `<span class="badge ${age > 90 ? 'bg-danger' : age > 30 ? 'bg-warning text-dark' : 'bg-success'}">${age} ngày</span>` : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center fw-bold cell-muted">${index + 1}</td>
        <td class="cell-mat-code">${item['Mã vật tư'] || ''}</td>
        <td>${item['Tên vật tư'] || ''}</td>
        <td class="fw-bold">${item['Cuộn ID'] || ''}</td>
        <td>${item['Batch'] || ''}</td>
        <td class="text-end cell-quantity">${formatKg(item['Số lượng (Kg)'])}</td>
        <td>${formatDate(item['Ngày nhập'])}</td>
        <td>${ageBadge}</td>
        <td>${item['Mã công trình'] || ''}</td>
        <td>${item['Tên công trình'] || ''}</td>
        <td class="small cell-muted">${item['Ghi chú'] || ''}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* =============================================================================
     COIL SCANNER & BATCH INVENTORY LOOKUP LOGIC
     ============================================================================= */
  function playBeepSoundLocal() {
    if (window.qrScannerService && typeof window.qrScannerService.playBeepSound === 'function') {
      window.qrScannerService.playBeepSound();
      return;
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 120);
    } catch (e) {}
  }

  function showCoilScanAlert(msg, type = 'warning', html = '') {
    if (!coilScanAlert) return;
    coilScanAlert.className = `alert alert-${type} py-2 px-3 small`;
    if (html) {
      coilScanAlert.innerHTML = html;
    } else {
      coilScanAlert.textContent = msg;
    }
    coilScanAlert.classList.remove('d-none');
  }

  function hideCoilScanAlert() {
    if (coilScanAlert) {
      coilScanAlert.classList.add('d-none');
      coilScanAlert.innerHTML = '';
    }
  }

  function hideCoilResultModal() {
    if (!coilResultModalEl) return;
    const bs = window.bootstrap || (typeof bootstrap !== 'undefined' ? bootstrap : null);
    if (bs && bs.Modal) {
      const modal = bs.Modal.getInstance(coilResultModalEl);
      if (modal) modal.hide();
    } else {
      coilResultModalEl.classList.remove('show');
      coilResultModalEl.style.display = 'none';
    }
  }

  function openCoilResultModal() {
    if (!coilResultModalEl) return;
    if (coilResultModalEl.parentElement !== document.body) {
      document.body.appendChild(coilResultModalEl);
    }
    const bs = window.bootstrap || (typeof bootstrap !== 'undefined' ? bootstrap : null);
    if (!bs || !bs.Modal) {
      coilResultModalEl.classList.add('show');
      coilResultModalEl.style.display = 'block';
      return;
    }

    const scanModalInstance = bs.Modal.getInstance(coilScanModalEl);
    if (scanModalInstance && coilScanModalEl.classList.contains('show')) {
      coilScanModalEl.addEventListener('hidden.bs.modal', () => {
        const resModal = bs.Modal.getOrCreateInstance(coilResultModalEl);
        resModal.show();
      }, { once: true });
      scanModalInstance.hide();
    } else {
      const resModal = bs.Modal.getOrCreateInstance(coilResultModalEl);
      resModal.show();
    }
  }

  function renderResultTable() {
    if (!popupRollsTableBody) return;
    popupRollsTableBody.innerHTML = '';

    const { parsed, matchedRoll, matchingBatchRolls, allMatRolls, showAllBatches } = currentScanResultState;
    const listToShow = showAllBatches ? allMatRolls : matchingBatchRolls;
    const normBatch = parsed ? String(parsed.batch || '').trim().toLowerCase() : '';

    if (txtTableBatchCount) {
      txtTableBatchCount.textContent = showAllBatches
        ? `Danh sách ${listToShow.length} cuộn thuộc Mã VT ${parsed.maVatTu}:`
        : `Danh sách ${listToShow.length} cuộn thuộc Batch ${parsed.batch}:`;
    }

    if (!listToShow || listToShow.length === 0) {
      popupRollsTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-4 text-warning fst-italic">
            <i class="bi bi-exclamation-triangle me-1"></i> Trong kho hiện không còn cuộn tồn nào thuộc nhóm này (đã xuất hết hoặc chưa nhập).
          </td>
        </tr>
      `;
      return;
    }

    listToShow.forEach((item, index) => {
      const rollKg = parseFloat(item['Số lượng (Kg)']) || 0;
      const rowRack = String(item['Vị trí'] || '').trim().toUpperCase();
      const isMatchedRoll = matchedRoll && (
        item === matchedRoll ||
        (item['Cuộn ID'] && matchedRoll['Cuộn ID'] && String(item['Cuộn ID']).trim() === String(matchedRoll['Cuộn ID']).trim())
      );
      const isSameBatch = String(item['Batch'] || '').trim().toLowerCase() === normBatch;

      const age = calculateStorageAge(item['Ngày nhập']);
      const ageBadge = age !== '' ? `<span class="badge ${age > 90 ? 'bg-danger' : age > 30 ? 'bg-warning text-dark' : 'bg-success'}">${age} ngày</span>` : '';

      const tr = document.createElement('tr');
      if (isMatchedRoll) {
        tr.className = 'row-scanned-highlight';
      }

      tr.innerHTML = `
        <td class="text-center fw-bold text-secondary">${index + 1}</td>
        <td class="text-center">
          <button type="button" class="btn btn-sm rack-cell-btn btn-table-rack" data-rack="${rowRack}">
            <i class="bi bi-geo-alt-fill me-1"></i>${rowRack || 'Chưa gán'}
          </button>
        </td>
        <td class="fw-bold">
          ${item['Cuộn ID'] || item['Mã vật tư'] || ''}
          ${isMatchedRoll ? `<span class="badge badge-scanned-pill ms-2"><i class="bi bi-geo-alt-fill me-1"></i>Cuộn Vừa Quét</span>` : ''}
        </td>
        <td>
          ${item['Batch'] || ''}
          ${isSameBatch && !isMatchedRoll ? `<span class="badge badge-correct-batch ms-2"><i class="bi bi-check2"></i> Đúng Batch</span>` : ''}
        </td>
        <td class="text-end fw-semibold text-warning">${formatKg(rollKg)}</td>
        <td>${formatDate(item['Ngày nhập'])}</td>
        <td class="text-center">${ageBadge}</td>
        <td class="small text-truncate" style="max-width: 100px;">${item['Mã công trình'] || '-'}</td>
        <td class="small text-truncate" style="max-width: 180px;" title="${item['Tên công trình'] || ''}">${item['Tên công trình'] || '-'}</td>
      `;

      popupRollsTableBody.appendChild(tr);
    });

    // Attach click event to rack pills in table
    popupRollsTableBody.querySelectorAll('.btn-table-rack').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetRack = btn.dataset.rack;
        if (targetRack && targetRack !== 'Chưa gán') {
          selectRack(targetRack);
          hideCoilResultModal();
        }
      });
    });
  }

  function handleProcessCoilBarcode(rawText) {
    hideCoilScanAlert();
    if (!rawText || !rawText.trim()) {
      showCoilScanAlert('Vui lòng nhập hoặc quét mã Barcode cuộn.');
      return;
    }

    const trimmed = rawText.trim();
    const parseFn = (window.qrScannerService && window.qrScannerService.parseCoilBarcode)
      ? window.qrScannerService.parseCoilBarcode
      : (t) => {
          const p = t.split('-').map(x => x.trim()).filter(Boolean);
          if (p.length >= 3) {
            const kg = parseFloat(p[p.length - 1].replace(',', '.'));
            return { maVatTu: p[0], batch: p.slice(1, -1).join('-'), kg: isNaN(kg) ? null : kg, rawText: t };
          } else if (p.length === 2) {
            return { maVatTu: p[0], batch: p[1], kg: null, rawText: t };
          }
          return null;
        };

    const parsed = parseFn(trimmed);

    // If invalid barcode structure
    if (!parsed) {
      // Check if it matches a rack code instead
      const rackCheck = (window.qrScannerService && window.qrScannerService.parseLocationQRCode)
        ? window.qrScannerService.parseLocationQRCode(trimmed)
        : trimmed.toUpperCase();

      const isRack = (window.qrScannerService && window.qrScannerService.getAllStandardRacks)
        ? window.qrScannerService.getAllStandardRacks().includes(rackCheck)
        : standardRacks.includes(rackCheck);

      if (isRack) {
        showCoilScanAlert(
          '',
          'info',
          `<div><i class="bi bi-info-circle me-1"></i> Mã <strong>"${trimmed}"</strong> là mã vị trí kệ <strong>${rackCheck}</strong>.</div>
           <div class="mt-2"><button type="button" class="btn btn-sm btn-primary" id="btnSwitchToScannedRack"><i class="bi bi-arrow-right-circle me-1"></i> Chuyển sang Kệ ${rackCheck}</button></div>`
        );
        const btnSwitch = document.getElementById('btnSwitchToScannedRack');
        if (btnSwitch) {
          btnSwitch.addEventListener('click', () => {
            selectRack(rackCheck);
            const modal = bootstrap.Modal.getInstance(coilScanModalEl);
            if (modal) modal.hide();
          });
        }
      } else {
        showCoilScanAlert(`Mã Barcode "${trimmed}" không đúng định dạng. Cấu trúc chuẩn: "Mã vật tư-Batch-Khối lượng" (Ví dụ: 10001189-2.5X75VN-2570).`);
      }
      return;
    }

    // Play beep sound and stop camera scanner
    playBeepSoundLocal();
    stopCoilCameraScanner();

    // Normalization
    const normMa = String(parsed.maVatTu || '').trim().toLowerCase();
    const normBatch = String(parsed.batch || '').trim().toLowerCase();

    // All rolls of this material in warehouse
    const allMatRolls = allWarehouseActiveRolls.filter(r => {
      return String(r['Mã vật tư'] || '').trim().toLowerCase() === normMa;
    });

    // Matching batch rolls
    const matchingBatchRolls = allMatRolls.filter(r => {
      return String(r['Batch'] || '').trim().toLowerCase() === normBatch;
    });

    // Identify specific roll if scanned kg provided or single roll in batch
    let matchedRoll = null;
    if (parsed.kg !== null && !isNaN(parsed.kg)) {
      matchedRoll = matchingBatchRolls.find(r => Math.abs((parseFloat(r['Số lượng (Kg)']) || 0) - parsed.kg) < 0.05);
      if (!matchedRoll) {
        // Search in all material rolls if batch on label had slight mismatch
        matchedRoll = allMatRolls.find(r => Math.abs((parseFloat(r['Số lượng (Kg)']) || 0) - parsed.kg) < 0.05);
      }
    } else if (matchingBatchRolls.length === 1) {
      matchedRoll = matchingBatchRolls[0];
    }

    // Reference roll for metadata
    const refRoll = matchedRoll || matchingBatchRolls[0] || allMatRolls[0];
    const whName = refRoll?._wh || 'Kho Xà gồ';
    const matName = refRoll?.['Tên vật tư'] || (normMa.includes('10001189') ? 'Thép phôi kẽm 1.75x406VN Z275 G450' : 'Vật tư chưa có tên');

    // Update Modal Header Badge
    if (resWarehouseBadge) {
      resWarehouseBadge.textContent = `${whName} (${allMatRolls.length} cuộn)`;
    }

    // Top Banner Setup
    if (identifiedRollBanner) {
      identifiedRollBanner.style.display = 'block';
      if (matchedRoll) {
        const rollRack = String(matchedRoll['Vị trí'] || 'Chưa gán').trim().toUpperCase();
        if (bannerBadgeStatus) {
          bannerBadgeStatus.className = 'badge badge-identified';
          bannerBadgeStatus.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> ĐÃ XÁC ĐỊNH VỊ TRÍ CUỘN';
        }
        if (bannerTextTitle) bannerTextTitle.textContent = 'Cuộn này đang nằm tại:';
        if (bannerRackHighlight) {
          bannerRackHighlight.innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i> KỆ ${rollRack}`;
        }
        if (btnBannerSwitchRack && lblBannerSwitchRack) {
          btnBannerSwitchRack.style.display = 'inline-flex';
          lblBannerSwitchRack.textContent = `Chuyển xem Kệ ${rollRack}`;
          btnBannerSwitchRack.onclick = () => {
            selectRack(rollRack);
            hideCoilResultModal();
          };
        }
        if (metaCuonId) metaCuonId.textContent = matchedRoll['Cuộn ID'] || parsed.maVatTu;
        if (metaBatch) metaBatch.textContent = matchedRoll['Batch'] || parsed.batch;
        if (metaKg) metaKg.textContent = `${formatKg(matchedRoll['Số lượng (Kg)'])} Kg`;
        const age = calculateStorageAge(matchedRoll['Ngày nhập']);
        if (metaDays) metaDays.textContent = `${age !== '' ? age : '0'} ngày`;
      } else if (matchingBatchRolls.length > 0) {
        const distinctRacks = [...new Set(matchingBatchRolls.map(r => String(r['Vị trí'] || '').trim().toUpperCase()).filter(Boolean))];
        const primaryRack = distinctRacks[0] || 'A01';
        if (bannerBadgeStatus) {
          bannerBadgeStatus.className = 'badge badge-identified';
          bannerBadgeStatus.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> ĐÃ XÁC ĐỊNH VỊ TRÍ BATCH';
        }
        if (bannerTextTitle) bannerTextTitle.textContent = 'Batch này đang nằm tại:';
        if (bannerRackHighlight) {
          bannerRackHighlight.innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i> KỆ ${distinctRacks.join(', KỆ ')}`;
        }
        if (btnBannerSwitchRack && lblBannerSwitchRack) {
          btnBannerSwitchRack.style.display = 'inline-flex';
          lblBannerSwitchRack.textContent = `Chuyển xem Kệ ${primaryRack}`;
          btnBannerSwitchRack.onclick = () => {
            selectRack(primaryRack);
            hideCoilResultModal();
          };
        }
        const totalKg = matchingBatchRolls.reduce((sum, r) => sum + (parseFloat(r['Số lượng (Kg)']) || 0), 0);
        if (metaCuonId) metaCuonId.textContent = `${matchingBatchRolls.length} cuộn`;
        if (metaBatch) metaBatch.textContent = parsed.batch;
        if (metaKg) metaKg.textContent = `${formatKg(totalKg)} Kg`;
        if (metaDays) metaDays.textContent = `Tồn kho`;
      } else {
        if (bannerBadgeStatus) {
          bannerBadgeStatus.className = 'badge bg-warning text-dark';
          bannerBadgeStatus.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> CHƯA XÁC ĐỊNH VỊ TRÍ';
        }
        if (bannerTextTitle) bannerTextTitle.textContent = 'Không tìm thấy tồn cuộn trong kho.';
        if (bannerRackHighlight) {
          bannerRackHighlight.innerHTML = `<i class="bi bi-question-circle me-1"></i> HẾT TỒN`;
        }
        if (btnBannerSwitchRack) btnBannerSwitchRack.style.display = 'none';
        if (metaCuonId) metaCuonId.textContent = '-';
        if (metaBatch) metaBatch.textContent = parsed.batch;
        if (metaKg) metaKg.textContent = parsed.kg ? `${formatKg(parsed.kg)} Kg` : '-';
        if (metaDays) metaDays.textContent = '-';
      }
    }

    // Material Info Card
    if (resMaterialFullName) resMaterialFullName.textContent = matName;
    if (resMatCodeBadge) resMatCodeBadge.textContent = parsed.maVatTu;
    if (resBatchBadge) resBatchBadge.textContent = parsed.batch;

    // Batch Distribution Box
    const totalBatchKg = matchingBatchRolls.reduce((sum, r) => sum + (parseFloat(r['Số lượng (Kg)']) || 0), 0);
    if (lblBatchTonTitle) lblBatchTonTitle.textContent = `Tồn Batch ${parsed.batch}:`;
    if (valBatchTonStock) {
      valBatchTonStock.innerHTML = `${formatKg(totalBatchKg)} Kg <small class="text-light fs-6">(${matchingBatchRolls.length} cuộn)</small>`;
    }
    if (lblBatchLocationTitle) {
      lblBatchLocationTitle.textContent = `Batch ${parsed.batch} đang nằm tại các vị trí kệ:`;
    }

    // Rack distribution pills
    if (rackDistributionPills) {
      rackDistributionPills.innerHTML = '';
      const rackMap = new Map();
      matchingBatchRolls.forEach(r => {
        const rk = String(r['Vị trí'] || 'Chưa gán').trim().toUpperCase();
        if (!rackMap.has(rk)) rackMap.set(rk, { count: 0, kg: 0 });
        const info = rackMap.get(rk);
        info.count++;
        info.kg += (parseFloat(r['Số lượng (Kg)']) || 0);
      });

      if (rackMap.size === 0) {
        rackDistributionPills.innerHTML = '<span class="text-secondary small fst-italic">Không có cuộn nào trên kệ</span>';
      } else {
        rackMap.forEach((info, rk) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-sm rack-pill-btn';
          btn.innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i>Kệ ${rk}: ${info.count} cuộn (${formatKg(info.kg)} kg)`;
          btn.addEventListener('click', () => {
            if (rk !== 'Chưa gán') {
              selectRack(rk);
              hideCoilResultModal();
            }
          });
          rackDistributionPills.appendChild(btn);
        });
      }
    }

    // Toggle button setup
    const otherBatchesCount = Math.max(0, allMatRolls.length - matchingBatchRolls.length);
    currentScanResultState = {
      parsed,
      matchedRoll,
      matchingBatchRolls,
      allMatRolls,
      showAllBatches: false
    };

    if (lblToggleAllBatches) {
      lblToggleAllBatches.textContent = `Xem tất cả Batch khác (${otherBatchesCount} cuộn)`;
    }

    if (btnToggleAllBatches) {
      btnToggleAllBatches.onclick = () => {
        currentScanResultState.showAllBatches = !currentScanResultState.showAllBatches;
        if (lblToggleAllBatches) {
          lblToggleAllBatches.textContent = currentScanResultState.showAllBatches
            ? `Chỉ xem Batch ${parsed.batch} (${matchingBatchRolls.length} cuộn)`
            : `Xem tất cả Batch khác (${otherBatchesCount} cuộn)`;
        }
        renderResultTable();
      };
    }

    // Render Table
    renderResultTable();

    // Finally, display the Result Modal!
    openCoilResultModal();
  }

  function startCoilCameraScanner() {
    if (typeof Html5Qrcode === 'undefined') {
      if (coilCameraStatus) {
        coilCameraStatus.textContent = 'Không thể mở camera. Bạn có thể nhập tay hoặc dùng súng quét!';
        coilCameraStatus.className = 'coil-status-text';
      }
      return;
    }

    stopCoilCameraScanner();

    setTimeout(() => {
      try {
        coilHtml5QrCodeInstance = new Html5Qrcode('coilCameraReader');
        const config = {
          fps: 10,
          qrbox: { width: 320, height: 180 }
        };

        coilHtml5QrCodeInstance.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            playBeepSoundLocal();
            if (coilBarcodeInput) coilBarcodeInput.value = decodedText;
            handleProcessCoilBarcode(decodedText);
          },
          () => {}
        ).then(() => {
          if (coilCameraStatus) {
            coilCameraStatus.textContent = 'Camera đang hoạt động. Hướng camera vào tem mã vạch...';
            coilCameraStatus.className = 'coil-status-text text-success';
          }
        }).catch((err) => {
          console.warn('Không thể mở camera:', err);
          if (coilCameraStatus) {
            coilCameraStatus.textContent = 'Không thể mở camera. Bạn có thể nhập tay hoặc dùng súng quét!';
            coilCameraStatus.className = 'coil-status-text';
          }
        });
      } catch (e) {
        console.warn('Camera init error:', e);
        if (coilCameraStatus) {
          coilCameraStatus.textContent = 'Không thể mở camera. Bạn có thể nhập tay hoặc dùng súng quét!';
          coilCameraStatus.className = 'coil-status-text';
        }
      }
    }, 250);
  }

  function stopCoilCameraScanner() {
    if (coilHtml5QrCodeInstance) {
      try {
        coilHtml5QrCodeInstance.stop().then(() => {
          coilHtml5QrCodeInstance.clear();
          coilHtml5QrCodeInstance = null;
        }).catch(() => {
          coilHtml5QrCodeInstance = null;
        });
      } catch (e) {
        coilHtml5QrCodeInstance = null;
      }
    }
  }

  // Event Listeners
  if (btnScanAnotherRack) {
    btnScanAnotherRack.addEventListener('click', () => {
      if (window.qrScannerService && window.qrScannerService.openQRCameraScanner) {
        window.qrScannerService.openQRCameraScanner((scannedRack) => {
          selectRack(scannedRack);
        });
      } else {
        alert('Module quét camera chưa sẵn sàng');
      }
    });
  }

  if (btnRefreshData) {
    btnRefreshData.addEventListener('click', () => {
      loadRackInventory(currentRack);
    });
  }

  if (btnScanCoil) {
    btnScanCoil.addEventListener('click', (e) => {
      e.preventDefault();
      window.openCoilScanModal();
    });
  }

  if (coilScanModalEl) {
    coilScanModalEl.addEventListener('shown.bs.modal', () => {
      if (coilBarcodeInput) {
        coilBarcodeInput.focus();
        coilBarcodeInput.select();
      }
      startCoilCameraScanner();
    });

    coilScanModalEl.addEventListener('hidden.bs.modal', () => {
      stopCoilCameraScanner();
    });
  }

  if (btnSubmitCoilBarcode) {
    btnSubmitCoilBarcode.addEventListener('click', () => {
      if (coilBarcodeInput) {
        handleProcessCoilBarcode(coilBarcodeInput.value);
      }
    });
  }

  if (coilBarcodeInput) {
    coilBarcodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleProcessCoilBarcode(coilBarcodeInput.value);
      }
    });
  }

  if (btnToggleCameraScanner) {
    btnToggleCameraScanner.addEventListener('click', () => {
      if (coilCameraContainer && coilCameraContainer.style.display !== 'none') {
        stopCoilCameraScanner();
      } else {
        startCoilCameraScanner();
      }
    });
  }

  if (btnCloseCameraReader) {
    btnCloseCameraReader.addEventListener('click', () => {
      stopCoilCameraScanner();
    });
  }

  // Initial Load
  initRackDropdown();
  updateDisplayTitle();
  loadRackInventory(currentRack);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initViTriTonPage);
} else {
  initViTriTonPage();
}
