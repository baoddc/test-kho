/* =============================================================================
   IN TEM BARCODE CUỘN (XÀ GỒ & TOLE) - JAVASCRIPT CONTROLLER
   Quản lý nạp tồn từ Supabase & file Excel, chọn cuộn, tạo mã vạch và in ấn
   Quy chuẩn Barcode Code 128: width: 4px, height: 90px, fontSize: 35px
   Bố cục in: 2 tem theo hàng ngang khổ A4, chạy dọc xuống hết trang
================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Source & Controls
  const sourceSelect = document.getElementById('sourceSelect');
  const excelFileInput = document.getElementById('excelFileInput');
  const btnTriggerUploadExcel = document.getElementById('btnTriggerUploadExcel');
  const uploadedFileInfo = document.getElementById('uploadedFileInfo');
  const btnReloadData = document.getElementById('btnReloadData');

  const labelStyleSelect = document.getElementById('labelStyleSelect');
  const chkShowCutBorder = document.getElementById('chkShowCutBorder');
  const barcodeModeSelect = document.getElementById('barcodeModeSelect');
  const chkShowLogo = document.getElementById('chkShowLogo');
  const chkShowProject = document.getElementById('chkShowProject');

  // Filter Elements
  const searchInput = document.getElementById('searchInput');
  const rackMatrixContainer = document.getElementById('rackMatrixContainer');
  const btnSelectAllRacks = document.getElementById('btnSelectAllRacks');
  const btnSelectRowA = document.getElementById('btnSelectRowA');
  const btnSelectRowB = document.getElementById('btnSelectRowB');
  const btnSelectGrating = document.getElementById('btnSelectGrating');
  const btnUnselectAllRacks = document.getElementById('btnUnselectAllRacks');

  // Coils Table & Selection Elements
  const coilTableBody = document.getElementById('coilTableBody');
  const chkSelectAllCoils = document.getElementById('chkSelectAllCoils');
  const tableSelectedCount = document.getElementById('tableSelectedCount');
  const tableTotalCount = document.getElementById('tableTotalCount');
  const btnSelectAllTable = document.getElementById('btnSelectAllTable');
  const btnDeselectAllTable = document.getElementById('btnDeselectAllTable');

  // Preview & Action Elements
  const previewSummaryText = document.getElementById('previewSummaryText');
  const labelsContainer = document.getElementById('labelsContainer');
  const btnPrint = document.getElementById('btnPrint');
  const btnExportZip = document.getElementById('btnExportZip');
  const loadingIndicator = document.getElementById('loadingIndicator');

  // Scroll Navigation
  const btnScrollToTop = document.getElementById('btnScrollToTop');
  const btnScrollToBottom = document.getElementById('btnScrollToBottom');
  const btnFloatScrollTop = document.getElementById('btnFloatScrollTop');
  const btnFloatScrollBottom = document.getElementById('btnFloatScrollBottom');

  // State Variables
  let allRawCoils = [];          // Danh sách toàn bộ cuộn nạp từ nguồn
  let filteredCoils = [];        // Danh sách cuộn sau khi qua bộ lọc kệ & tìm kiếm
  let selectedCoilKeys = new Set(); // Bộ Set lưu ID hoặc key duy nhất của các cuộn được chọn in

  const standardRacks = [
    'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'A12', 'A13', 'A14',
    'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12', 'B13', 'B14',
    'GRATING', 'GR-01', 'GR-02'
  ];
  let selectedRacks = new Set(standardRacks);

  /* =============================================================================
     HELPER FUNCTIONS
  ================================================================================ */

  function debounce(func, wait = 250) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  function getCoilUniqueKey(coil, index) {
    const cid = String(coil['Cuộn ID'] || '').trim();
    if (cid) return `${cid}_${index}`;
    return `coil_${index}_${coil['Mã vật tư'] || ''}_${coil['Batch'] || ''}`;
  }

  function formatCoilBarcodeData(row, mode = 'standard') {
    if (!row) return '';
    if (mode === 'cuon_id') {
      return String(row['Cuộn ID'] || row['cuon_id'] || '').trim();
    }
    const maVt = String(row['Mã vật tư'] || row['ma_vat_tu'] || row['Mã VT'] || '').trim();
    const batch = String(row['Batch'] || row['batch'] || row['Lô'] || '').trim();
    const rawKg = row['Số lượng (Kg)'] ?? row['Khối lượng (kg)'] ?? row['kg'] ?? 0;
    const numKg = Math.round(Number(String(rawKg).replace(',', '.')) || 0);
    if (!maVt && !batch) return '';
    return `${maVt}-${batch}-${numKg}`;
  }

  function normalizeExcelRow(rawRow) {
    const row = {};
    for (const key of Object.keys(rawRow)) {
      const cleanKey = key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (cleanKey.includes('ma vat tu') || cleanKey === 'ma vt' || cleanKey === 'mavt') {
        row['Mã vật tư'] = String(rawRow[key] || '').trim();
      } else if (cleanKey.includes('ten vat tu') || cleanKey.includes('ten hang') || cleanKey === 'tenvt') {
        row['Tên vật tư'] = String(rawRow[key] || '').trim();
      } else if (cleanKey === 'batch' || cleanKey.includes('so lo') || cleanKey === 'lo') {
        row['Batch'] = String(rawRow[key] || '').trim();
      } else if (cleanKey.includes('cuon id') || cleanKey.includes('ma cuon') || cleanKey === 'cuonid') {
        row['Cuộn ID'] = String(rawRow[key] || '').trim();
      } else if (cleanKey.includes('so luong') || cleanKey.includes('khoi luong') || cleanKey.includes('kg')) {
        row['Số lượng (Kg)'] = Number(String(rawRow[key] || 0).replace(',', '.')) || 0;
      } else if (cleanKey.includes('chieu dai') || cleanKey.includes('(m)') || cleanKey === 'm') {
        row['Khối lượng (m)'] = Number(String(rawRow[key] || 0).replace(',', '.')) || 0;
      } else if (cleanKey.includes('vi tri') || cleanKey === 'ke' || cleanKey === 'vitri') {
        row['Vị trí'] = String(rawRow[key] || '').trim().toUpperCase();
      } else if (cleanKey.includes('ngay nhap')) {
        row['Ngày nhập'] = String(rawRow[key] || '').trim();
      } else if (cleanKey.includes('cong trinh')) {
        row['Tên công trình'] = String(rawRow[key] || '').trim();
      }
    }
    return row;
  }

  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  }

  /* =============================================================================
     DATA LOADING (SUPABASE & EXCEL)
  ================================================================================ */

  async function loadDataFromSupabase(sourceType) {
    showLoading(true, 'Đang tải dữ liệu tồn kho từ hệ thống...');
    try {
      const fetchFunc = typeof fetchAllFromSupabase === 'function'
        ? fetchAllFromSupabase
        : async (tbl, col) => {
            if (!window.supabase) return [];
            let rows = [], from = 0, batchSize = 1000, hasMore = true;
            while (hasMore) {
              const { data, error } = await supabase.from(tbl).select(col || '*').order('id', { ascending: true }).range(from, from + batchSize - 1);
              if (error) throw error;
              if (data && data.length > 0) {
                rows = rows.concat(data);
                if (data.length < batchSize) hasMore = false; else from += batchSize;
              } else hasMore = false;
            }
            return rows;
          };

      let nhapTable = 'xg-nhap';
      let xuatTable = 'xg-xuat';
      let defaultWarehouse = 'KHO XÀ GỒ - ĐẠI DŨNG';

      if (sourceType === 'tole') {
        nhapTable = 'tole-nhap';
        xuatTable = 'tole-xuat';
        defaultWarehouse = 'KHO TOLE - ĐẠI DŨNG';
      }

      const [nhapAll, xuatAll] = await Promise.all([
        fetchFunc(nhapTable, '*').catch(err => { console.warn('Lỗi tải bảng nhập:', err); return []; }),
        fetchFunc(xuatTable, '"Cuộn ID"').catch(err => { console.warn('Lỗi tải bảng xuất:', err); return []; })
      ]);

      const exportedIds = new Set(
        xuatAll.map(r => String(r['Cuộn ID'] || '').trim().toLowerCase()).filter(Boolean)
      );

      // Active rolls: has Cuộn ID and not in export list
      const tonData = nhapAll.filter(row => {
        const cid = String(row['Cuộn ID'] || '').trim().toLowerCase();
        return cid && !exportedIds.has(cid);
      });

      allRawCoils = tonData.map((row, idx) => ({
        ...row,
        _uniqueKey: `sb_${sourceType}_${idx}_${row['Cuộn ID'] || ''}`,
        _warehouseName: defaultWarehouse
      }));

      // Reset selection to select all by default
      selectedCoilKeys = new Set(allRawCoils.map(r => r._uniqueKey));

      if (uploadedFileInfo) {
        uploadedFileInfo.textContent = `Nguồn: ${defaultWarehouse} (${allRawCoils.length} cuộn tồn)`;
        uploadedFileInfo.className = 'small text-success fw-bold';
      }

      applyFilters();
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu tồn:', err);
      alert('Không thể nạp dữ liệu tồn từ CSDL Supabase: ' + (err.message || err));
    } finally {
      showLoading(false);
    }
  }

  function handleExcelUpload(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      alert('Chưa tải được thư viện đọc Excel (SheetJS). Vui lòng thử lại!');
      return;
    }

    showLoading(true, `Đang đọc dữ liệu từ file "${file.name}"...`);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          alert('File Excel không có dữ liệu!');
          showLoading(false);
          return;
        }

        const normalizedList = rawJson.map((row, idx) => {
          const norm = normalizeExcelRow(row);
          return {
            ...norm,
            _uniqueKey: `excel_${idx}_${norm['Cuộn ID'] || idx}`,
            _warehouseName: 'KHO TỒN VẬT TƯ - DDC'
          };
        }).filter(r => r['Mã vật tư'] || r['Cuộn ID'] || r['Tên vật tư']);

        if (normalizedList.length === 0) {
          alert('Không tìm thấy các cột tồn kho hợp lệ trong file Excel. Vui lòng kiểm tra tiêu đề cột (Mã vật tư, Batch, Cuộn ID, Số lượng...)');
          showLoading(false);
          return;
        }

        allRawCoils = normalizedList;
        selectedCoilKeys = new Set(allRawCoils.map(r => r._uniqueKey));

        if (sourceSelect) sourceSelect.value = 'excel';
        if (uploadedFileInfo) {
          uploadedFileInfo.textContent = `File: ${file.name} (${allRawCoils.length} cuộn)`;
          uploadedFileInfo.className = 'small text-primary fw-bold';
        }

        applyFilters();
      } catch (err) {
        console.error('Lỗi đọc file Excel:', err);
        alert('Lỗi xử lý file Excel: ' + (err.message || err));
      } finally {
        showLoading(false);
      }
    };

    reader.onerror = () => {
      alert('Không thể đọc file đã chọn.');
      showLoading(false);
    };

    reader.readAsArrayBuffer(file);
  }

  function showLoading(show, message = 'Đang xử lý dữ liệu...') {
    if (!loadingIndicator) return;
    if (show) {
      loadingIndicator.style.display = 'block';
      const textSpan = loadingIndicator.querySelector('span');
      if (textSpan) textSpan.textContent = message;
    } else {
      loadingIndicator.style.display = 'none';
    }
  }

  /* =============================================================================
     RACK MATRIX SELECTOR
  ================================================================================ */

  function renderRackMatrix() {
    if (!rackMatrixContainer) return;
    rackMatrixContainer.innerHTML = '';

    standardRacks.forEach(rack => {
      const isChecked = selectedRacks.has(rack);
      const label = document.createElement('label');
      label.className = 'rack-badge-check';
      label.innerHTML = `
        <input type="checkbox" class="form-check-input rack-checkbox" value="${rack}" ${isChecked ? 'checked' : ''}>
        <span>${rack}</span>
      `;

      const input = label.querySelector('input');
      input.addEventListener('change', (e) => {
        if (e.target.checked) selectedRacks.add(rack);
        else selectedRacks.delete(rack);
        applyFilters();
      });

      rackMatrixContainer.appendChild(label);
    });
  }

  /* =============================================================================
     FILTERING & SELECTION
  ================================================================================ */

  function applyFilters() {
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const hasRackConstraint = selectedRacks.size > 0 && selectedRacks.size < standardRacks.length;

    filteredCoils = allRawCoils.filter(coil => {
      // 1. Rack Filter
      if (hasRackConstraint) {
        const pos = String(coil['Vị trí'] || '').trim().toUpperCase();
        if (!selectedRacks.has(pos)) return false;
      }

      // 2. Keyword Filter
      if (keyword) {
        const maVt = String(coil['Mã vật tư'] || '').toLowerCase();
        const tenVt = String(coil['Tên vật tư'] || '').toLowerCase();
        const batch = String(coil['Batch'] || '').toLowerCase();
        const cuonId = String(coil['Cuộn ID'] || '').toLowerCase();
        const viTri = String(coil['Vị trí'] || '').toLowerCase();
        const congTrinh = String(coil['Tên công trình'] || '').toLowerCase();

        const match = maVt.includes(keyword) ||
                      tenVt.includes(keyword) ||
                      batch.includes(keyword) ||
                      cuonId.includes(keyword) ||
                      viTri.includes(keyword) ||
                      congTrinh.includes(keyword);
        if (!match) return false;
      }

      return true;
    });

    renderCoilTable();
    renderPreviewLabels();
  }

  function renderCoilTable() {
    if (!coilTableBody) return;
    coilTableBody.innerHTML = '';

    if (filteredCoils.length === 0) {
      coilTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-muted">
            <i class="bi bi-inbox fs-4 d-block mb-1 text-secondary"></i>
            Không tìm thấy cuộn nào phù hợp với điều kiện lọc.
          </td>
        </tr>
      `;
      updateSelectionCounts();
      return;
    }

    const fragment = document.createDocumentFragment();

    filteredCoils.forEach((coil, idx) => {
      const isChecked = selectedCoilKeys.has(coil._uniqueKey);
      const tr = document.createElement('tr');
      if (isChecked) tr.classList.add('table-active-row');

      const kgVal = coil['Số lượng (Kg)'] ?? coil['Khối lượng (kg)'] ?? 0;
      const mVal = coil['Khối lượng (m)'];
      const weightText = mVal ? `${formatNumber(kgVal)} Kg (${formatNumber(mVal)} m)` : `${formatNumber(kgVal)} Kg`;

      tr.innerHTML = `
        <td class="text-center">
          <input type="checkbox" class="form-check-input coil-row-checkbox" data-key="${coil._uniqueKey}" ${isChecked ? 'checked' : ''}>
        </td>
        <td class="text-center text-muted small">${idx + 1}</td>
        <td>
          <div class="fw-bold text-dark">${coil['Mã vật tư'] || '---'}</div>
          <small class="text-muted text-truncate d-inline-block" style="max-width: 260px;" title="${coil['Tên vật tư'] || ''}">${coil['Tên vật tư'] || ''}</small>
        </td>
        <td>
          <span class="badge bg-secondary font-monospace">${coil['Batch'] || '---'}</span>
        </td>
        <td>
          <span class="fw-bold text-primary font-monospace">${coil['Cuộn ID'] || '---'}</span>
        </td>
        <td class="text-end fw-bold text-dark">${weightText}</td>
        <td class="text-center">
          <span class="badge bg-dark">${coil['Vị trí'] || '---'}</span>
        </td>
      `;

      const chk = tr.querySelector('.coil-row-checkbox');
      chk.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedCoilKeys.add(coil._uniqueKey);
          tr.classList.add('table-active-row');
        } else {
          selectedCoilKeys.delete(coil._uniqueKey);
          tr.classList.remove('table-active-row');
        }
        updateSelectionCounts();
        renderPreviewLabels();
      });

      fragment.appendChild(tr);
    });

    coilTableBody.appendChild(fragment);
    updateSelectionCounts();
  }

  function updateSelectionCounts() {
    const totalCount = allRawCoils.length;
    const selectedCount = selectedCoilKeys.size;

    if (tableTotalCount) tableTotalCount.textContent = totalCount;
    if (tableSelectedCount) tableSelectedCount.textContent = selectedCount;

    // Check header checkbox state
    if (chkSelectAllCoils) {
      if (filteredCoils.length === 0) {
        chkSelectAllCoils.checked = false;
        chkSelectAllCoils.indeterminate = false;
      } else {
        const allFilteredSelected = filteredCoils.every(c => selectedCoilKeys.has(c._uniqueKey));
        const someFilteredSelected = filteredCoils.some(c => selectedCoilKeys.has(c._uniqueKey));
        chkSelectAllCoils.checked = allFilteredSelected;
        chkSelectAllCoils.indeterminate = !allFilteredSelected && someFilteredSelected;
      }
    }

    if (previewSummaryText) {
      previewSummaryText.textContent = `${selectedCount} tem in (Bố cục 2 tem/hàng ngang A4)`;
    }
  }

  /* =============================================================================
     LABEL RENDERING (2 LABELS PER A4 ROW & JSBARCODE)
  ================================================================================ */

  function renderPreviewLabels() {
    if (!labelsContainer) return;
    labelsContainer.innerHTML = '';

    // Get list of coils that are selected
    const coilsToPrint = allRawCoils.filter(c => selectedCoilKeys.has(c._uniqueKey));

    if (coilsToPrint.length === 0) {
      labelsContainer.innerHTML = `
        <div class="col-12 text-center py-5 text-muted bg-white rounded border">
          <i class="bi bi-printer fs-1 text-secondary opacity-50 d-block mb-2"></i>
          <h5>Chưa có tem cuộn nào được chọn để in</h5>
          <p class="small text-muted mb-0">Vui lòng tích chọn các cuộn trong bảng danh sách ở trên.</p>
        </div>
      `;
      return;
    }

    const barcodeMode = barcodeModeSelect ? barcodeModeSelect.value : 'standard';
    const labelStyle = labelStyleSelect ? labelStyleSelect.value : 'barcode-only';
    const showCutBorder = chkShowCutBorder ? chkShowCutBorder.checked : false;
    const showLogo = chkShowLogo ? chkShowLogo.checked : true;
    const showProject = chkShowProject ? chkShowProject.checked : true;

    // Toggle visibility of full-info sub options
    document.querySelectorAll('.full-info-opt').forEach(el => {
      if (labelStyle === 'full-info') el.classList.remove('d-none');
      else el.classList.add('d-none');
    });

    coilsToPrint.forEach((coil, idx) => {
      const barcodeData = formatCoilBarcodeData(coil, barcodeMode);
      const barcodeSvgId = `barcode_svg_${idx}`;

      const card = document.createElement('div');

      if (labelStyle === 'barcode-only') {
        // Chỉ lấy mã Barcode theo đúng ảnh mẫu người dùng yêu cầu
        card.className = `coil-label-card barcode-only-card ${showCutBorder ? 'show-cut-border' : ''}`;
        card.innerHTML = `
          <button type="button" class="btn btn-sm btn-light single-barcode-download-btn no-print" data-idx="${idx}" title="Tải ảnh barcode cuộn này">
            <i class="bi bi-download"></i>
          </button>
          <div class="label-barcode-section barcode-only-section">
            <svg id="${barcodeSvgId}" class="label-barcode-svg"></svg>
          </div>
        `;
      } else {
        // Chế độ đầy đủ thông tin
        card.className = 'coil-label-card';
        const kgVal = coil['Số lượng (Kg)'] ?? coil['Khối lượng (kg)'] ?? 0;
        const mVal = coil['Khối lượng (m)'];
        const weightDisplay = mVal ? `${formatNumber(kgVal)} Kg (${formatNumber(mVal)} m)` : `${formatNumber(kgVal)} Kg`;

        card.innerHTML = `
          <button type="button" class="btn btn-sm btn-light single-barcode-download-btn no-print" data-idx="${idx}" title="Tải ảnh barcode cuộn này">
            <i class="bi bi-download"></i>
          </button>

          <!-- Label Header -->
          <div class="label-header">
            <div class="label-logo-area">
              ${showLogo ? '<img src="/assets/images/logos/Logo-DDC.png" alt="DDC Logo" class="label-logo-img">' : ''}
              <span class="label-company-title">${coil._warehouseName || 'KHO VẬT TƯ - ĐẠI DŨNG'}</span>
            </div>
            <div class="label-rack-pill">${coil['Vị trí'] || '---'}</div>
          </div>

          <!-- Material Name -->
          <div class="label-material-title">${coil['Tên vật tư'] || 'THÉP CUỘN MẠ / PHÔI XÀ GỒ'}</div>

          <!-- Coil Data Grid -->
          <div class="label-data-grid">
            <div class="label-data-item">
              <span class="label-data-label">Mã vật tư</span>
              <span class="label-data-value">${coil['Mã vật tư'] || '---'}</span>
            </div>
            <div class="label-data-item">
              <span class="label-data-label">Cuộn ID</span>
              <span class="label-data-value">${coil['Cuộn ID'] || '---'}</span>
            </div>
            <div class="label-data-item">
              <span class="label-data-label">Số Lô / Batch</span>
              <span class="label-data-value">${coil['Batch'] || '---'}</span>
            </div>
            <div class="label-data-item">
              <span class="label-data-label">Khối lượng</span>
              <span class="label-data-value highlight-weight">${weightDisplay}</span>
            </div>
            <div class="label-data-item">
              <span class="label-data-label">Ngày nhập kho</span>
              <span class="label-data-value">${coil['Ngày nhập'] || '---'}</span>
            </div>
            ${showProject && coil['Tên công trình'] ? `
              <div class="label-data-item">
                <span class="label-data-label">Công trình</span>
                <span class="label-data-value text-truncate" title="${coil['Tên công trình']}">${coil['Tên công trình']}</span>
              </div>
            ` : `
              <div class="label-data-item">
                <span class="label-data-label">Vị trí kệ</span>
                <span class="label-data-value">${coil['Vị trí'] || '---'}</span>
              </div>
            `}
          </div>

          <!-- Barcode Section -->
          <div class="label-barcode-section">
            <svg id="${barcodeSvgId}" class="label-barcode-svg"></svg>
          </div>
        `;
      }

      labelsContainer.appendChild(card);

      // Render Barcode with JsBarcode
      if (typeof JsBarcode !== 'undefined' && barcodeData) {
        const svgEl = document.getElementById(barcodeSvgId);
        if (svgEl) {
          try {
            JsBarcode(svgEl, barcodeData, {
              format: 'CODE128',
              width: 4,               // Độ rộng vạch 4px theo yêu cầu
              height: 90,             // Chiều cao vạch 90px theo yêu cầu
              fontSize: 35,           // Kích thước chữ 35px theo yêu cầu
              displayValue: true,     // Hiển thị chữ dưới mã vạch
              fontOptions: 'bold',
              font: 'Segoe UI, Arial, sans-serif',
              textMargin: 4,
              margin: 4,
              lineColor: '#000000',
              background: '#ffffff'
            });
          } catch (barcodeErr) {
            console.error('Lỗi khi tạo mã vạch cho cuộn:', coil, barcodeErr);
            svgEl.outerHTML = `<div class="text-danger small py-2">Mã vạch lỗi: ${barcodeData}</div>`;
          }
        }
      }
    });

    // Wire up single barcode downloads
    labelsContainer.querySelectorAll('.single-barcode-download-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(idx) && coilsToPrint[idx]) {
          downloadSingleBarcode(coilsToPrint[idx], idx);
        }
      });
    });
  }

  /* =============================================================================
     DOWNLOAD BARCODE (SINGLE & BATCH ZIP)
  ================================================================================ */

  function svgToPngBlob(svgElement) {
    return new Promise((resolve, reject) => {
      try {
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const URLObj = window.URL || window.webkitURL || window;
        const blobURL = URLObj.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth || image.width || 600;
          canvas.height = image.naturalHeight || image.height || 180;
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0);

          canvas.toBlob((blob) => {
            URLObj.revokeObjectURL(blobURL);
            resolve(blob);
          }, 'image/png');
        };
        image.onerror = (err) => {
          URLObj.revokeObjectURL(blobURL);
          reject(err);
        };
        image.src = blobURL;
      } catch (e) {
        reject(e);
      }
    });
  }

  async function downloadSingleBarcode(coil, idx) {
    const svgEl = document.getElementById(`barcode_svg_${idx}`);
    if (!svgEl) return;
    try {
      const blob = await svgToPngBlob(svgEl);
      if (blob && typeof saveAs !== 'undefined') {
        const safeName = (coil['Cuộn ID'] || coil['Mã vật tư'] || `cuon_${idx}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        saveAs(blob, `BARCODE_${safeName}.png`);
      }
    } catch (e) {
      console.error('Lỗi khi tải ảnh barcode:', e);
      alert('Không thể tải ảnh barcode: ' + e.message);
    }
  }

  async function exportAllBarcodesAsZip() {
    const coilsToPrint = allRawCoils.filter(c => selectedCoilKeys.has(c._uniqueKey));
    if (coilsToPrint.length === 0) {
      alert('Vui lòng chọn ít nhất một cuộn để xuất mã vạch.');
      return;
    }

    if (typeof JSZip === 'undefined' || typeof saveAs === 'undefined') {
      alert('Thư viện tạo file ZIP đang được nạp hoặc không khả dụng.');
      return;
    }

    const origBtnHtml = btnExportZip.innerHTML;
    btnExportZip.disabled = true;
    btnExportZip.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Đang tạo ảnh barcode (0/${coilsToPrint.length})...`;

    try {
      const zip = new JSZip();
      const folder = zip.folder('BARCODE_CUON_DDC');

      for (let i = 0; i < coilsToPrint.length; i++) {
        const coil = coilsToPrint[i];
        btnExportZip.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Đang tạo (${i + 1}/${coilsToPrint.length})...`;

        const svgEl = document.getElementById(`barcode_svg_${i}`);
        if (svgEl) {
          const blob = await svgToPngBlob(svgEl);
          if (blob) {
            const safeCid = (coil['Cuộn ID'] || coil['Mã vật tư'] || `cuon_${i}`).replace(/[^a-zA-Z0-9_-]/g, '_');
            folder.file(`BARCODE_${safeCid}.png`, blob);
          }
        }
      }

      btnExportZip.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Đang nén file ZIP...`;
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const nowStr = new Date().toISOString().slice(0, 10);
      saveAs(zipBlob, `Danh_Sach_Barcode_Cuon_DDC_${nowStr}.zip`);
    } catch (err) {
      console.error('Lỗi xuất zip barcode:', err);
      alert('Có lỗi khi tạo file ZIP: ' + (err.message || err));
    } finally {
      btnExportZip.disabled = false;
      btnExportZip.innerHTML = origBtnHtml;
    }
  }

  /* =============================================================================
     EVENT LISTENERS
  ================================================================================ */

  // Source Switcher (Kho Xà gồ vs Kho Tole vs Excel)
  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => {
      const val = sourceSelect.value;
      if (val === 'xg' || val === 'tole') {
        loadDataFromSupabase(val);
      } else if (val === 'excel') {
        if (excelFileInput) excelFileInput.click();
      }
    });
  }

  if (btnTriggerUploadExcel && excelFileInput) {
    btnTriggerUploadExcel.addEventListener('click', () => {
      excelFileInput.click();
    });
  }

  if (excelFileInput) {
    excelFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleExcelUpload(file);
      }
    });
  }

  if (btnReloadData) {
    btnReloadData.addEventListener('click', () => {
      const val = sourceSelect ? sourceSelect.value : 'xg';
      if (val === 'xg' || val === 'tole') {
        loadDataFromSupabase(val);
      } else if (excelFileInput && excelFileInput.files && excelFileInput.files[0]) {
        handleExcelUpload(excelFileInput.files[0]);
      }
    });
  }

  // Barcode Mode & Appearance
  if (labelStyleSelect) {
    labelStyleSelect.addEventListener('change', renderPreviewLabels);
  }
  if (chkShowCutBorder) {
    chkShowCutBorder.addEventListener('change', renderPreviewLabels);
  }
  if (barcodeModeSelect) {
    barcodeModeSelect.addEventListener('change', renderPreviewLabels);
  }
  if (chkShowLogo) {
    chkShowLogo.addEventListener('change', renderPreviewLabels);
  }
  if (chkShowProject) {
    chkShowProject.addEventListener('change', renderPreviewLabels);
  }

  // Search Input
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      applyFilters();
    }, 200));
  }

  // Rack Filter Action Buttons
  if (btnSelectAllRacks) {
    btnSelectAllRacks.addEventListener('click', () => {
      selectedRacks = new Set(standardRacks);
      renderRackMatrix();
      applyFilters();
    });
  }
  if (btnSelectRowA) {
    btnSelectRowA.addEventListener('click', () => {
      selectedRacks = new Set(standardRacks.filter(r => r.startsWith('A')));
      renderRackMatrix();
      applyFilters();
    });
  }
  if (btnSelectRowB) {
    btnSelectRowB.addEventListener('click', () => {
      selectedRacks = new Set(standardRacks.filter(r => r.startsWith('B')));
      renderRackMatrix();
      applyFilters();
    });
  }
  if (btnSelectGrating) {
    btnSelectGrating.addEventListener('click', () => {
      selectedRacks = new Set(standardRacks.filter(r => r.startsWith('GR')));
      renderRackMatrix();
      applyFilters();
    });
  }
  if (btnUnselectAllRacks) {
    btnUnselectAllRacks.addEventListener('click', () => {
      selectedRacks.clear();
      renderRackMatrix();
      applyFilters();
    });
  }

  // Table Selection Handlers
  if (chkSelectAllCoils) {
    chkSelectAllCoils.addEventListener('change', (e) => {
      const checked = e.target.checked;
      filteredCoils.forEach(coil => {
        if (checked) selectedCoilKeys.add(coil._uniqueKey);
        else selectedCoilKeys.delete(coil._uniqueKey);
      });
      renderCoilTable();
      renderPreviewLabels();
    });
  }

  if (btnSelectAllTable) {
    btnSelectAllTable.addEventListener('click', () => {
      allRawCoils.forEach(c => selectedCoilKeys.add(c._uniqueKey));
      renderCoilTable();
      renderPreviewLabels();
    });
  }

  if (btnDeselectAllTable) {
    btnDeselectAllTable.addEventListener('click', () => {
      selectedCoilKeys.clear();
      renderCoilTable();
      renderPreviewLabels();
    });
  }

  // Print & Zip Actions
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      const coilsToPrint = allRawCoils.filter(c => selectedCoilKeys.has(c._uniqueKey));
      if (coilsToPrint.length === 0) {
        alert('Vui lòng chọn ít nhất một cuộn để in tem.');
        return;
      }
      window.print();
    });
  }

  if (btnExportZip) {
    btnExportZip.addEventListener('click', exportAllBarcodesAsZip);
  }

  // Scroll Shortcuts
  if (btnScrollToBottom) {
    btnScrollToBottom.addEventListener('click', () => {
      if (labelsContainer) labelsContainer.scrollIntoView({ behavior: 'smooth' });
    });
  }
  if (btnScrollToTop) {
    btnScrollToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  if (btnFloatScrollBottom) {
    btnFloatScrollBottom.addEventListener('click', () => {
      if (labelsContainer) labelsContainer.scrollIntoView({ behavior: 'smooth' });
    });
  }
  if (btnFloatScrollTop) {
    btnFloatScrollTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Global Ctrl + P listener
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      const coilsToPrint = allRawCoils.filter(c => selectedCoilKeys.has(c._uniqueKey));
      if (coilsToPrint.length > 0) {
        e.preventDefault();
        window.print();
      }
    }
  });

  /* =============================================================================
     INITIALIZATION
  ================================================================================ */
  renderRackMatrix();
  // Default load Xà gồ inventory from Supabase
  loadDataFromSupabase('xg');
});
