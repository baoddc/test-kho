/* =============================================================================
   TRA CỨU TỒN KHO THEO VỊ TRÍ KỆ - SCRIPT
   Xử lý tổng hợp tồn kho Xà gồ & Tole theo mã kệ A01-A14, B01-B14 & Grating
================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
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

  const btnNavNhapXg = document.getElementById('btnNavNhapXg');
  const btnNavNhapTole = document.getElementById('btnNavNhapTole');
  const btnNavXuatXg = document.getElementById('btnNavXuatXg');
  const btnNavXuatTole = document.getElementById('btnNavXuatTole');

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

    updateNavLinks();
    loadRackInventory(currentRack);
  }

  function updateNavLinks() {
    if (displayRackTitle) displayRackTitle.textContent = `KỆ ${currentRack}`;
    if (btnNavNhapXg) btnNavNhapXg.href = `/pages/xg/xg-nhap.html?vitri=${encodeURIComponent(currentRack)}`;
    if (btnNavNhapTole) btnNavNhapTole.href = `/pages/tole/tole-nhap.html?vitri=${encodeURIComponent(currentRack)}`;
    if (btnNavXuatXg) btnNavXuatXg.href = `/pages/xg/xg-xuat.html?vitri=${encodeURIComponent(currentRack)}`;
    if (btnNavXuatTole) btnNavXuatTole.href = `/pages/tole/tole-xuat.html?vitri=${encodeURIComponent(currentRack)}`;
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

      const normalizedRack = rackCode.trim().toLowerCase();

      // Filter active rolls on this rack
      const xgTonOnRack = xgNhapAll.filter(row => {
        const rowPos = String(row['Vị trí'] || '').trim().toLowerCase();
        const cid = String(row['Cuộn ID'] || '').trim().toLowerCase();
        return rowPos === normalizedRack && cid && !xgExportedIds.has(cid);
      });

      const toleTonOnRack = toleNhapAll.filter(row => {
        const rowPos = String(row['Vị trí'] || '').trim().toLowerCase();
        const cid = String(row['Cuộn ID'] || '').trim().toLowerCase();
        return rowPos === normalizedRack && cid && !toleExportedIds.has(cid);
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
          <td colspan="10" class="text-center py-4 text-muted fst-italic">
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
        <td class="text-center fw-bold text-muted">${index + 1}</td>
        <td class="fw-bold text-primary">${item['Mã vật tư'] || ''}</td>
        <td>${item['Tên vật tư'] || ''}</td>
        <td class="fw-bold">${item['Cuộn ID'] || ''}</td>
        <td>${item['Batch'] || ''}</td>
        <td class="text-end fw-bold text-success">${formatKg(item['Số lượng (Kg)'])}</td>
        <td>${formatDate(item['Ngày nhập'])}</td>
        <td>${ageBadge}</td>
        <td>${item['Mã công trình'] || ''}</td>
        <td class="small text-muted">${item['Ghi chú'] || ''}</td>
      `;
      tbody.appendChild(tr);
    });
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

  // Initial Load
  initRackDropdown();
  updateNavLinks();
  loadRackInventory(currentRack);
});
