/* =============================================================================
   KIỂM KÊ TỒN KHO BẰNG MÁY QUÉT & ĐỐI SOÁT FILE EXCEL - CONTROLLER (kiem-ke.js)
   Thép Đại Dũng
   ============================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initKiemKeApp();
});

function initKiemKeApp() {
  // DOM Elements
  const excelFileInput = document.getElementById('excelFileInput');
  const lblExcelFileName = document.getElementById('lblExcelFileName');
  const excelFileBadge = document.getElementById('excelFileBadge');
  const barcodeInput = document.getElementById('barcodeInput');
  const btnSubmitBarcode = document.getElementById('btnSubmitBarcode');
  const btnOpenScannerCamera = document.getElementById('btnOpenScannerCamera');
  const btnRefreshSystemData = document.getElementById('btnRefreshSystemData');
  const btnExportExcelReport = document.getElementById('btnExportExcelReport');
  const btnResetSession = document.getElementById('btnResetSession');
  const btnResetAll = document.getElementById('btnResetAll');
  const btnResetScannedOnly = document.getElementById('btnResetScannedOnly');
  const btnConfirmReset = document.getElementById('btnConfirmReset');
  const btnClearFeedOnly = document.getElementById('btnClearFeedOnly');

  // Stat Elements
  const statTotalBatches = document.getElementById('statTotalBatches');
  const statExcelKg = document.getElementById('statExcelKg');
  const statExcelRows = document.getElementById('statExcelRows');
  const statSystemKg = document.getElementById('statSystemKg');
  const statSystemRolls = document.getElementById('statSystemRolls');
  const statScannedKg = document.getElementById('statScannedKg');
  const statScannedRolls = document.getElementById('statScannedRolls');
  const badgeMatchCount = document.getElementById('badgeMatchCount');
  const badgeMismatchCount = document.getElementById('badgeMismatchCount');
  const badgeUnscannedCount = document.getElementById('badgeUnscannedCount');
  const statProgressPercent = document.getElementById('statProgressPercent');

  // Table Elements
  const reconcileTableBody = document.getElementById('reconcileTableBody');
  const scannedRollsTableBody = document.getElementById('scannedRollsTableBody');
  const tabCountSummary = document.getElementById('tabCountSummary');
  const tabCountScanned = document.getElementById('tabCountScanned');
  const selectStatusFilter = document.getElementById('selectStatusFilter');
  const searchInput = document.getElementById('searchInput');

  // Camera Modal Elements
  const cameraModalEl = document.getElementById('cameraModal');
  const cameraStatusText = document.getElementById('cameraStatusText');

  // Move modals directly to body once at startup so they are never clipped by parents
  const resetConfirmModalEl = document.getElementById('resetConfirmModal');
  if (resetConfirmModalEl && resetConfirmModalEl.parentElement !== document.body) {
    document.body.appendChild(resetConfirmModalEl);
  }
  if (cameraModalEl && cameraModalEl.parentElement !== document.body) {
    document.body.appendChild(cameraModalEl);
  }

  // State
  let scannedRolls = [];
  let excelMap = new Map();
  let excelMeta = null;
  let systemMap = new Map();
  let activeSystemRolls = [];
  let reconciledList = [];
  let html5QrCodeScanner = null;
  let lastScanBarcode = '';
  let lastScanTime = 0;

  // Restore Session
  const savedSession = window.KiemKeStorage ? window.KiemKeStorage.loadSession() : { scannedRolls: [], excelMetadata: null };
  if (savedSession.scannedRolls && savedSession.scannedRolls.length > 0) {
    scannedRolls = savedSession.scannedRolls;
    showToast(`Đã khôi phục phiên quét gồm ${scannedRolls.length} cuộn.`, 'info');
  }

  if (savedSession.excelMetadata && savedSession.excelMetadata.items) {
    excelMeta = savedSession.excelMetadata;
    if (lblExcelFileName) lblExcelFileName.textContent = excelMeta.fileName || 'File đã nạp';
    if (excelFileBadge) {
      excelFileBadge.textContent = `${excelMeta.rowCount || 0} dòng`;
      excelFileBadge.classList.remove('d-none');
    }
    // Reconstruct excelMap
    excelMap = new Map(savedSession.excelMetadata.items);
  }

  // Initial Load Supabase
  loadSupabaseStock();

  // Keep scanner focused continuously
  function keepFocusOnScanner() {
    if (document.activeElement !== barcodeInput &&
        document.activeElement !== searchInput &&
        document.activeElement.tagName !== 'SELECT' &&
        document.activeElement.tagName !== 'BUTTON' &&
        !document.body.classList.contains('modal-open')) {
      barcodeInput.focus();
    }
  }
  document.addEventListener('click', () => {
    setTimeout(keepFocusOnScanner, 150);
  });
  keepFocusOnScanner();

  // 1. Fetch Supabase Data
  async function loadSupabaseStock() {
    if (btnRefreshSystemData) {
      btnRefreshSystemData.disabled = true;
      btnRefreshSystemData.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Đang tải...`;
    }

    try {
      let client = window.supabase;
      if (!client || typeof client.from !== 'function') {
        for (let w = 0; w < 15; w++) {
          await new Promise(r => setTimeout(r, 100));
          client = window.supabase;
          if (client && typeof client.from === 'function') break;
        }
      }

      const fetchFunc = async (tbl) => {
        if (typeof window.fetchAllFromSupabase === 'function') {
          return await window.fetchAllFromSupabase(tbl);
        }
        if (!client || typeof client.from !== 'function') {
          console.warn(`Supabase client chưa sẵn sàng khi truy vấn ${tbl}`);
          return [];
        }
        let rows = [], from = 0, batchSize = 1000, hasMore = true;
        while (hasMore) {
          const { data, error } = await client.from(tbl).select('*').order('id', { ascending: true }).range(from, from + batchSize - 1);
          if (error) {
            console.error(`Lỗi truy vấn bảng ${tbl}:`, error);
            throw error;
          }
          if (data && data.length > 0) {
            rows = rows.concat(data);
            if (data.length < batchSize) hasMore = false;
            else from += batchSize;
          } else {
            hasMore = false;
          }
        }
        return rows;
      };

      const [xgNhap, xgXuat, toleNhap, toleXuat] = await Promise.all([
        fetchFunc('xg-nhap').catch(e => { console.warn('Lỗi xg-nhap:', e); return []; }),
        fetchFunc('xg-xuat').catch(e => { console.warn('Lỗi xg-xuat:', e); return []; }),
        fetchFunc('tole-nhap').catch(e => { console.warn('Lỗi tole-nhap:', e); return []; }),
        fetchFunc('tole-xuat').catch(e => { console.warn('Lỗi tole-xuat:', e); return []; })
      ]);

      const xgExportedIds = new Set(xgXuat.map(r => String(r['Cuộn ID'] || '').trim().toLowerCase()).filter(Boolean));
      const toleExportedIds = new Set(toleXuat.map(r => String(r['Cuộn ID'] || '').trim().toLowerCase()).filter(Boolean));

      const activeXg = xgNhap.filter(r => {
        const cid = String(r['Cuộn ID'] || '').trim().toLowerCase();
        return cid && !xgExportedIds.has(cid);
      }).map(r => ({ ...r, _wh: 'Xà gồ' }));

      const activeTole = toleNhap.filter(r => {
        const cid = String(r['Cuộn ID'] || '').trim().toLowerCase();
        return cid && !toleExportedIds.has(cid);
      }).map(r => ({ ...r, _wh: 'Tole' }));

      activeSystemRolls = [...activeXg, ...activeTole];
      systemMap = window.KiemKeEngine ? window.KiemKeEngine.aggregateSystemStock(activeSystemRolls) : new Map();

      showToast(`Đã tải tồn hệ thống: ${activeSystemRolls.length} cuộn (XG + Tole).`, 'success');
      recalculateAndRender();
    } catch (err) {
      console.error('Lỗi nạp tồn Supabase:', err);
      showToast('Không thể kết nối CSDL Supabase để tải tồn.', 'danger');
    } finally {
      if (btnRefreshSystemData) {
        btnRefreshSystemData.disabled = false;
        btnRefreshSystemData.innerHTML = `<i class="bi bi-arrow-clockwise"></i> <span class="d-none d-lg-inline">Tải Lại Tồn</span>`;
      }
    }
  }

  // 2. Handle Excel File Upload
  if (excelFileInput) {
    excelFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (!rawRows || rawRows.length < 2) {
            showToast('File Excel không có dữ liệu hợp lệ.', 'warning');
            return;
          }

          excelMap = window.KiemKeEngine.parseExcelRows(rawRows);
          const rowCount = rawRows.length - 1;

          excelMeta = {
            fileName: file.name,
            rowCount: rowCount,
            items: Array.from(excelMap.entries())
          };

          if (lblExcelFileName) lblExcelFileName.textContent = file.name;
          if (excelFileBadge) {
            excelFileBadge.textContent = `${rowCount} dòng (${excelMap.size} batch)`;
            excelFileBadge.classList.remove('d-none');
          }

          // Save to storage
          window.KiemKeStorage.saveSession(scannedRolls, excelMeta);
          showToast(`Đã nạp file Excel thành công: ${excelMap.size} mã batch.`, 'success');
          recalculateAndRender();
        } catch (ex) {
          console.error('Lỗi đọc file Excel:', ex);
          showToast('Lỗi khi phân tích file Excel. Vui lòng kiểm tra định dạng.', 'danger');
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // 3. Process Barcode Scanning
  function processScannedBarcode(rawBarcode) {
    if (!rawBarcode || !rawBarcode.trim()) return;
    const text = rawBarcode.trim();

    // Chống dội phím phần cứng máy quét (nếu cùng 1 chuỗi nhận liên tiếp trong vòng 600ms)
    const nowTs = Date.now();
    if (lastScanBarcode === text && (nowTs - lastScanTime < 600)) {
      barcodeInput.value = '';
      keepFocusOnScanner();
      return;
    }
    lastScanBarcode = text;
    lastScanTime = nowTs;

    // Đếm số lần mã Barcode này đã được quét trước đó (hỗ trợ nhiều cuộn có cùng tem Barcode)
    const existingCount = scannedRolls.filter(r => String(r.barcode).trim().toLowerCase() === text.toLowerCase()).length;

    // Parse Barcode
    let parsed = null;
    if (window.qrScannerService && typeof window.qrScannerService.parseCoilBarcode === 'function') {
      parsed = window.qrScannerService.parseCoilBarcode(text);
    }
    if (!parsed) {
      const parts = text.split('-').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const rawKg = parts[parts.length - 1].replace(',', '.');
        const kg = parseFloat(rawKg);
        parsed = {
          maVatTu: parts[0],
          batch: parts.slice(1, -1).join('-'),
          kg: isNaN(kg) ? 0 : kg,
          rawText: text
        };
      } else if (parts.length === 2) {
        parsed = {
          maVatTu: parts[0],
          batch: parts[1],
          kg: 0,
          rawText: text
        };
      } else {
        parsed = {
          maVatTu: text,
          batch: '',
          kg: 0,
          rawText: text
        };
      }
    }

    // Success Beep
    window.KiemKeStorage.playBeepSuccess();

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const rollItem = {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      barcode: text,
      maVatTu: parsed.maVatTu || text,
      batch: parsed.batch || '',
      kg: parsed.kg || 0,
      timestamp: timeStr
    };

    scannedRolls.unshift(rollItem);
    window.KiemKeStorage.saveSession(scannedRolls, excelMeta);

    if (existingCount > 0) {
      showToast(`Đã thêm cuộn (lần ${existingCount + 1}): ${rollItem.maVatTu} - ${rollItem.batch} (${formatKg(rollItem.kg)} kg)`, 'info');
    } else {
      showToast(`Đã ghi nhận cuộn: ${rollItem.maVatTu} - ${rollItem.batch} (${formatKg(rollItem.kg)} kg)`, 'success');
    }

    barcodeInput.value = '';
    recalculateAndRender();
    keepFocusOnScanner();
  }

  // Barcode input Enter listener
  if (barcodeInput) {
    barcodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        processScannedBarcode(barcodeInput.value);
      }
    });
  }
  if (btnSubmitBarcode) {
    btnSubmitBarcode.addEventListener('click', () => {
      processScannedBarcode(barcodeInput.value);
    });
  }

  // 4. Recalculate and Render
  function recalculateAndRender() {
    const scannedMap = window.KiemKeEngine.aggregateScannedRolls(scannedRolls);
    reconciledList = window.KiemKeEngine.reconcile3Way(excelMap, systemMap, scannedMap);

    // Update Summary Stats
    let totalExcelKg = 0;
    let totalExcelRows = 0;
    if (excelMap) {
      excelMap.forEach(item => {
        totalExcelKg += item.totalKg;
        totalExcelRows += item.count;
      });
    }

    let totalSystemKg = 0;
    let totalSystemRolls = 0;
    if (systemMap) {
      systemMap.forEach(item => {
        totalSystemKg += item.totalKg;
        totalSystemRolls += item.count;
      });
    }

    let totalScannedKg = 0;
    let totalScannedRolls = scannedRolls.length;
    scannedRolls.forEach(item => {
      totalScannedKg += (parseFloat(item.kg) || 0);
    });

    let matchCount = 0;
    let mismatchCount = 0;
    let unscannedCount = 0;

    reconciledList.forEach(r => {
      if (r.status === 'MATCH') matchCount++;
      else if (r.status === 'UNSCANNED') unscannedCount++;
      else mismatchCount++;
    });

    if (statTotalBatches) statTotalBatches.textContent = reconciledList.length;
    if (statExcelKg) statExcelKg.innerHTML = `${formatKg(totalExcelKg)} <small class="fs-6 text-muted">kg</small>`;
    if (statExcelRows) statExcelRows.textContent = `${totalExcelRows} dòng cơ sở`;

    if (statSystemKg) statSystemKg.innerHTML = `${formatKg(totalSystemKg)} <small class="fs-6 text-muted">kg</small>`;
    if (statSystemRolls) statSystemRolls.textContent = `${totalSystemRolls} cuộn sổ sách`;

    if (statScannedKg) statScannedKg.innerHTML = `${formatKg(totalScannedKg)} <small class="fs-6 text-muted">kg</small>`;
    if (statScannedRolls) statScannedRolls.textContent = `${totalScannedRolls} cuộn đã kiểm đếm`;

    if (badgeMatchCount) badgeMatchCount.textContent = `${matchCount} Khớp`;
    if (badgeMismatchCount) badgeMismatchCount.textContent = `${mismatchCount} Lệch`;
    if (badgeUnscannedCount) badgeUnscannedCount.textContent = `${unscannedCount} Chưa quét`;

    const progressPct = reconciledList.length > 0
      ? Math.round(((reconciledList.length - unscannedCount) / reconciledList.length) * 100)
      : 0;
    if (statProgressPercent) statProgressPercent.textContent = `Tiến độ kiểm đếm: ${progressPct}% (${reconciledList.length - unscannedCount}/${reconciledList.length} mã)`;

    if (tabCountSummary) tabCountSummary.textContent = reconciledList.length;
    if (tabCountScanned) tabCountScanned.textContent = scannedRolls.length;

    renderReconcileTable();
    renderScannedFeedTable();
  }

  // 5. Render Reconcile Table (Tab 1)
  function renderReconcileTable() {
    if (!reconcileTableBody) return;

    const filterVal = selectStatusFilter ? selectStatusFilter.value : 'ALL';
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const filtered = reconciledList.filter(row => {
      // Filter status
      if (filterVal !== 'ALL') {
        if (filterVal === 'SHORTAGE' && row.status !== 'SHORTAGE') return false;
        if (filterVal === 'SURPLUS' && row.status !== 'SURPLUS') return false;
        if (filterVal === 'MATCH' && row.status !== 'MATCH') return false;
        if (filterVal === 'UNSCANNED' && row.status !== 'UNSCANNED') return false;
        if (filterVal === 'EXTRA_FILE' && row.status !== 'EXTRA_FILE') return false;
      }
      // Filter search
      if (searchVal) {
        const vKey = row.virtualKey.toLowerCase();
        const ma = row.maVatTu.toLowerCase();
        const batch = row.batch.toLowerCase();
        const ten = (row.tenVatTu || '').toLowerCase();
        if (!vKey.includes(searchVal) && !ma.includes(searchVal) && !batch.includes(searchVal) && !ten.includes(searchVal)) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      reconcileTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-4 text-muted fst-italic">
            Không tìm thấy dữ liệu đối soát nào phù hợp với bộ lọc.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    filtered.forEach((r, idx) => {
      let statusBadge = '';
      if (r.status === 'MATCH') {
        statusBadge = `<span class="badge-status badge-status-match"><i class="bi bi-check-circle-fill"></i> Khớp</span>`;
      } else if (r.status === 'SHORTAGE') {
        statusBadge = `<span class="badge-status badge-status-shortage"><i class="bi bi-dash-circle-fill"></i> Thiếu ${formatKg(Math.abs(r.diffScannedVsExcelKg))} kg</span>`;
      } else if (r.status === 'SURPLUS') {
        statusBadge = `<span class="badge-status badge-status-surplus"><i class="bi bi-plus-circle-fill"></i> Thừa ${formatKg(r.diffScannedVsExcelKg)} kg</span>`;
      } else if (r.status === 'EXTRA_FILE') {
        statusBadge = `<span class="badge-status badge-status-extra"><i class="bi bi-question-circle-fill"></i> Ngoài File</span>`;
      } else {
        statusBadge = `<span class="badge-status badge-status-unscanned"><i class="bi bi-clock"></i> Chưa quét</span>`;
      }

      const diffVsExcelClass = r.diffScannedVsExcelKg === 0 ? 'text-success' : (r.diffScannedVsExcelKg < 0 ? 'text-danger' : 'text-warning');
      const diffVsSystemClass = r.diffScannedVsSystemKg === 0 ? 'text-success' : (r.diffScannedVsSystemKg < 0 ? 'text-danger' : 'text-warning');

      html += `
        <tr>
          <td class="text-center fw-bold text-muted">${idx + 1}</td>
          <td><span class="virtual-key-badge">${escapeHtml(r.virtualKey)}</span></td>
          <td class="small text-truncate" style="max-width: 170px;" title="${escapeHtml(r.tenVatTu || '')}">${escapeHtml(r.tenVatTu || '-')}</td>
          <td class="text-end fw-semibold">${formatKg(r.excelKg)}</td>
          <td class="text-end">${formatKg(r.systemKg)} <span class="small text-muted">(${r.systemCount}c)</span></td>
          <td class="text-end fw-bold text-warning">${formatKg(r.scannedKg)} <span class="small text-muted">(${r.scannedCount}c)</span></td>
          <td class="text-end fw-bold ${diffVsExcelClass}">${r.diffScannedVsExcelKg > 0 ? '+' : ''}${formatKg(r.diffScannedVsExcelKg)}</td>
          <td class="text-end fw-bold ${diffVsSystemClass}">${r.diffScannedVsSystemKg > 0 ? '+' : ''}${formatKg(r.diffScannedVsSystemKg)}</td>
          <td class="text-center">${statusBadge}</td>
        </tr>
      `;
    });

    reconcileTableBody.innerHTML = html;
  }

  // 6. Render Scanned Feed Table (Tab 2)
  function renderScannedFeedTable() {
    if (!scannedRollsTableBody) return;

    if (scannedRolls.length === 0) {
      scannedRollsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-muted fst-italic">
            Chưa có cuộn nào được quét trong phiên này.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    scannedRolls.forEach((item, idx) => {
      html += `
        <tr class="${idx === 0 ? 'kk-feed-item-new' : ''}">
          <td class="text-center text-muted fw-bold">${idx + 1}</td>
          <td class="small text-muted">${item.timestamp || '-'}</td>
          <td class="fw-bold text-info font-monospace">${escapeHtml(item.barcode)}</td>
          <td>${escapeHtml(item.maVatTu)}</td>
          <td>${escapeHtml(item.batch || '-')}</td>
          <td class="text-end fw-bold text-warning">${formatKg(item.kg)}</td>
          <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 btn-delete-scanned" data-id="${item.id}" title="Xóa cuộn này">
              <i class="bi bi-x-lg"></i>
            </button>
          </td>
        </tr>
      `;
    });

    scannedRollsTableBody.innerHTML = html;

    // Attach delete listeners
    scannedRollsTableBody.querySelectorAll('.btn-delete-scanned').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deleteScannedRoll(id);
      });
    });
  }

  function deleteScannedRoll(id) {
    const idx = scannedRolls.findIndex(x => x.id === id);
    if (idx !== -1) {
      const removed = scannedRolls.splice(idx, 1)[0];
      window.KiemKeStorage.saveSession(scannedRolls, excelMeta);
      showToast(`Đã xóa cuộn "${removed.barcode}".`, 'warning');
      recalculateAndRender();
      keepFocusOnScanner();
    }
  }

  // Filter & Search events
  if (selectStatusFilter) {
    selectStatusFilter.addEventListener('change', renderReconcileTable);
  }
  if (searchInput) {
    searchInput.addEventListener('input', renderReconcileTable);
  }

  // 7. Reset Session
  function performResetAll() {
    scannedRolls = [];
    excelMap = new Map();
    excelMeta = null;
    if (excelFileInput) excelFileInput.value = '';
    if (lblExcelFileName) lblExcelFileName.textContent = 'Nạp File Excel Cơ Sở';
    if (excelFileBadge) {
      excelFileBadge.textContent = '0 dòng';
      excelFileBadge.classList.add('d-none');
    }
    window.KiemKeStorage.clearSession();
    hideResetModal();
    showToast('Đã làm lại toàn bộ phiên kiểm kê (xóa file Excel và cuộn quét).', 'info');
    recalculateAndRender();
    keepFocusOnScanner();
  }

  function performResetScannedOnly() {
    scannedRolls = [];
    window.KiemKeStorage.clearScannedOnly();
    if (excelMeta) {
      window.KiemKeStorage.saveSession([], excelMeta);
    }
    hideResetModal();
    showToast('Đã xóa toàn bộ cuộn đã quét (Giữ lại file Excel cơ sở).', 'info');
    recalculateAndRender();
    keepFocusOnScanner();
  }

  function hideResetModal() {
    const modalEl = document.getElementById('resetConfirmModal');
    if (modalEl) {
      const bs = window.bootstrap || (typeof bootstrap !== 'undefined' ? bootstrap : null);
      if (bs && bs.Modal) {
        const inst = bs.Modal.getInstance(modalEl);
        if (inst) inst.hide();
      }
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
    }
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
  }

  window.performResetAll = performResetAll;
  window.performResetScannedOnly = performResetScannedOnly;
  window.hideResetModal = hideResetModal;

  if (btnResetSession) {
    btnResetSession.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const modalEl = document.getElementById('resetConfirmModal');
      if (!modalEl) return;
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
        document.body.classList.add('modal-open');
      }
    });
  }

  if (btnResetAll) {
    btnResetAll.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      performResetAll();
    });
  }

  if (btnResetScannedOnly) {
    btnResetScannedOnly.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      performResetScannedOnly();
    });
  }

  if (btnConfirmReset) {
    btnConfirmReset.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      performResetAll();
    });
  }

  if (btnClearFeedOnly) {
    btnClearFeedOnly.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      performResetScannedOnly();
    });
  }
  if (btnRefreshSystemData) {
    btnRefreshSystemData.addEventListener('click', loadSupabaseStock);
  }

  // 8. Export Excel Report
  if (btnExportExcelReport) {
    btnExportExcelReport.addEventListener('click', exportExcelReport);
  }

  function exportExcelReport() {
    if (!window.XLSX) {
      showToast('Thư viện SheetJS chưa sẵn sàng để xuất Excel.', 'danger');
      return;
    }

    // Sheet 1: Tổng hợp đối soát
    const summaryHeader = [
      'STT', 'Cột Ảo (Mã VT-Batch)', 'Mã Vật Tư', 'Batch (Lô)', 'Tên Vật Tư',
      'File Excel (Kg)', 'File Excel (Dòng)',
      'Hệ Thống (Kg)', 'Hệ Thống (Cuộn)',
      'Đã Quét (Kg)', 'Đã Quét (Cuộn)',
      'Lệch Quét vs File (Kg)', 'Lệch Quét vs Hệ Thống (Kg)',
      'Trạng Thái'
    ];

    const summaryRows = [summaryHeader];
    reconciledList.forEach((r, i) => {
      let statusText = 'Khớp';
      if (r.status === 'SHORTAGE') statusText = 'Lệch thiếu';
      else if (r.status === 'SURPLUS') statusText = 'Lệch thừa';
      else if (r.status === 'EXTRA_FILE') statusText = 'Ngoài danh mục File';
      else if (r.status === 'UNSCANNED') statusText = 'Chưa quét';

      summaryRows.push([
        i + 1,
        r.virtualKey,
        r.maVatTu,
        r.batch,
        r.tenVatTu || '',
        r.excelKg,
        r.excelCount,
        r.systemKg,
        r.systemCount,
        r.scannedKg,
        r.scannedCount,
        r.diffScannedVsExcelKg,
        r.diffScannedVsSystemKg,
        statusText
      ]);
    });

    // Sheet 2: Chi tiết cuộn quét
    const detailHeader = ['STT', 'Thời Gian Quét', 'Barcode Tem', 'Mã Vật Tư', 'Batch', 'Khối Lượng Tem (Kg)'];
    const detailRows = [detailHeader];
    scannedRolls.forEach((item, i) => {
      detailRows.push([
        i + 1,
        item.timestamp || '',
        item.barcode,
        item.maVatTu,
        item.batch || '',
        item.kg
      ]);
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_Hop_Doi_Soat');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi_Tiet_Cuon_Quet');

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `Ket_Qua_Kiem_Ke_${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
    showToast(`Đã xuất báo cáo kiểm kê: ${fileName}`, 'success');
  }

  // 9. Camera Scanner (Html5Qrcode)
  if (btnOpenScannerCamera) {
    btnOpenScannerCamera.addEventListener('click', () => {
      const modal = new bootstrap.Modal(cameraModalEl);
      modal.show();
      startCameraScanner();
    });
  }

  if (cameraModalEl) {
    cameraModalEl.addEventListener('hidden.bs.modal', () => {
      stopCameraScanner();
      keepFocusOnScanner();
    });
  }

  function startCameraScanner() {
    if (typeof Html5Qrcode === 'undefined') {
      if (cameraStatusText) cameraStatusText.textContent = 'Thư viện Camera Scanner chưa được tải.';
      return;
    }
    stopCameraScanner();
    try {
      html5QrCodeScanner = new Html5Qrcode('cameraScannerReader');
      const config = { fps: 10, qrbox: { width: 250, height: 180 } };
      html5QrCodeScanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          stopCameraScanner();
          const modal = bootstrap.Modal.getInstance(cameraModalEl);
          if (modal) modal.hide();
          processScannedBarcode(decodedText);
        },
        () => {}
      ).catch(err => {
        if (cameraStatusText) cameraStatusText.textContent = 'Không thể truy cập camera thiết bị: ' + err;
      });
    } catch (e) {
      console.error('Camera error:', e);
    }
  }

  function stopCameraScanner() {
    if (html5QrCodeScanner) {
      try {
        html5QrCodeScanner.stop().then(() => {
          html5QrCodeScanner.clear();
          html5QrCodeScanner = null;
        }).catch(() => {
          html5QrCodeScanner = null;
        });
      } catch (e) {
        html5QrCodeScanner = null;
      }
    }
  }

  // Helpers
  function formatKg(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(msg, type = 'info') {
    const container = document.getElementById('kkToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `alert alert-${type} shadow-lg py-2 px-3 mb-2 small d-flex align-items-center gap-2 kk-toast`;
    toast.style.animation = 'fadeIn 0.2s ease';

    let icon = 'bi-info-circle-fill';
    if (type === 'success') icon = 'bi-check-circle-fill';
    if (type === 'danger') icon = 'bi-exclamation-octagon-fill';
    if (type === 'warning') icon = 'bi-exclamation-triangle-fill';

    toast.innerHTML = `<i class="bi ${icon} fs-5"></i> <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}
