/* =============================================================================
   IN TEM VỊ TRÍ QR & BARCODE - SCRIPT
   Quản lý sinh mã QR/Barcode hàng loạt và in nhãn dán kệ kho
================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const rackMatrixContainer = document.getElementById('rackMatrixContainer');
  const labelsContainer = document.getElementById('labelsContainer');
  const selectedCountBadge = document.getElementById('selectedCountBadge');
  const previewSummaryText = document.getElementById('previewSummaryText');
  const layoutSelect = document.getElementById('layoutSelect');
  const warehouseTitleSelect = document.getElementById('warehouseTitleSelect');
  const customWarehouseTitle = document.getElementById('customWarehouseTitle');

  const chkShowQR = document.getElementById('chkShowQR');
  const chkShowBarcode = document.getElementById('chkShowBarcode');
  const chkShowLogo = document.getElementById('chkShowLogo');

  const btnPrint = document.getElementById('btnPrint');
  const btnSelectAll = document.getElementById('btnSelectAll');
  const btnSelectRowA = document.getElementById('btnSelectRowA');
  const btnSelectRowB = document.getElementById('btnSelectRowB');
  const btnSelectGrating = document.getElementById('btnSelectGrating');
  const btnUnselectAll = document.getElementById('btnUnselectAll');
  const btnAddCustomRacks = document.getElementById('btnAddCustomRacks');
  const customRacksInput = document.getElementById('customRacksInput');
  const btnScrollToTop = document.getElementById('btnScrollToTop');

  // Default Standard Racks
  let standardRacks = (window.qrScannerService && window.qrScannerService.getAllStandardRacks)
    ? window.qrScannerService.getAllStandardRacks()
    : [
        'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'A12', 'A13', 'A14',
        'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12', 'B13', 'B14',
        'GRATING', 'GR-01', 'GR-02'
      ];

  let selectedRacks = new Set(standardRacks);

  // Initialize Checkbox Matrix
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
        if (e.target.checked) {
          selectedRacks.add(rack);
        } else {
          selectedRacks.delete(rack);
        }
        updateAndRenderLabels();
      });

      rackMatrixContainer.appendChild(label);
    });

    updateSelectedCount();
  }

  function updateSelectedCount() {
    const count = selectedRacks.size;
    if (selectedCountBadge) selectedCountBadge.textContent = count;
    const layoutText = layoutSelect ? layoutSelect.options[layoutSelect.selectedIndex].text : '';
    if (previewSummaryText) {
      previewSummaryText.textContent = `${count} tem (${layoutText.split('(')[0].trim()})`;
    }
  }

  function getWarehouseTitle() {
    if (!warehouseTitleSelect) return 'KHO XÀ GỒ & TOLE - DDC';
    if (warehouseTitleSelect.value === 'custom') {
      return (customWarehouseTitle && customWarehouseTitle.value.trim()) || 'KHO VẬT TƯ - DDC';
    }
    return warehouseTitleSelect.value;
  }

  // Generate All Labels
  function generateLabels() {
    if (!labelsContainer) return;
    labelsContainer.innerHTML = '';

    const currentLayout = layoutSelect ? layoutSelect.value : 'a4-grid-4';
    labelsContainer.className = `labels-container layout-${currentLayout}`;

    const racksToGenerate = Array.from(selectedRacks);
    if (racksToGenerate.length === 0) {
      labelsContainer.innerHTML = `
        <div class="col-12 text-center py-5 text-muted">
          <i class="bi bi-exclamation-circle fs-2 text-warning"></i>
          <p class="mt-2">Chưa chọn vị trí kệ nào để in. Vui lòng tích chọn các kệ ở bảng trên.</p>
        </div>
      `;
      return;
    }

    const warehouseTitle = getWarehouseTitle();
    const showQR = chkShowQR ? chkShowQR.checked : true;
    const showBarcode = chkShowBarcode ? chkShowBarcode.checked : true;
    const showLogo = chkShowLogo ? chkShowLogo.checked : true;
    const baseOrigin = window.location.origin;

    racksToGenerate.forEach((rackCode, index) => {
      const targetUrl = `${baseOrigin}/pages/vi-tri-ton.html?vitri=${encodeURIComponent(rackCode)}`;
      const qrContainerId = `qrCanvas_${index}_${rackCode.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const barcodeSvgId = `barcodeSvg_${index}_${rackCode.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const card = document.createElement('div');
      card.className = 'rack-label-card';
      card.innerHTML = `
        <div class="label-header">
          ${showLogo ? `<img src="/assets/images/logos/Logo-DDC.png" alt="Logo DDC" class="label-logo">` : `<div></div>`}
          <div class="label-company-info">
            <div class="label-company-name">CÔNG TY CP CƠ KHÍ XÂY DỰNG THƯƠNG MẠI ĐẠI DŨNG</div>
            <div class="label-warehouse-name">${warehouseTitle}</div>
          </div>
        </div>

        <div class="label-body">
          <div class="label-rack-code-box">
            <span class="label-rack-title">VỊ TRÍ KỆ</span>
            <div class="label-rack-code">${rackCode}</div>
          </div>
          ${showQR ? `
            <div class="label-qr-box">
              <div id="${qrContainerId}" class="label-qr-canvas"></div>
            </div>
          ` : ''}
        </div>

        <div class="label-footer">
          ${showBarcode ? `<svg id="${barcodeSvgId}" class="label-barcode-svg"></svg>` : ''}
          <div class="label-instruction">Quét mã QR để tra cứu tồn kho hoặc quét khi Nhập / Xuất</div>
          <div class="label-url-text">${targetUrl}</div>
        </div>
      `;

      labelsContainer.appendChild(card);

      // Render QRCode
      if (showQR && typeof QRCode !== 'undefined') {
        const qrEl = document.getElementById(qrContainerId);
        if (qrEl) {
          try {
            new QRCode(qrEl, {
              text: targetUrl,
              width: 130,
              height: 130,
              colorDark: '#000000',
              colorLight: '#ffffff',
              correctLevel: QRCode.CorrectLevel.M
            });
          } catch (e) {
            console.error('Error generating QR for', rackCode, e);
          }
        }
      }

      // Render Barcode Code 128
      if (showBarcode && typeof JsBarcode !== 'undefined') {
        const svgEl = document.getElementById(barcodeSvgId);
        if (svgEl) {
          try {
            JsBarcode(svgEl, rackCode, {
              format: 'CODE128',
              lineColor: '#000000',
              width: 1.8,
              height: 32,
              displayValue: false,
              margin: 0
            });
          } catch (e) {
            console.error('Error generating Barcode for', rackCode, e);
          }
        }
      }
    });
  }

  function updateAndRenderLabels() {
    updateSelectedCount();
    generateLabels();
  }

  // ==================== EVENT LISTENERS ====================
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      selectedRacks = new Set(standardRacks);
      renderRackMatrix();
      updateAndRenderLabels();
    });
  }

  if (btnUnselectAll) {
    btnUnselectAll.addEventListener('click', () => {
      selectedRacks.clear();
      renderRackMatrix();
      updateAndRenderLabels();
    });
  }

  if (btnSelectRowA) {
    btnSelectRowA.addEventListener('click', () => {
      selectedRacks = new Set(standardRacks.filter(r => r.startsWith('A')));
      renderRackMatrix();
      updateAndRenderLabels();
    });
  }

  if (btnSelectRowB) {
    btnSelectRowB.addEventListener('click', () => {
      selectedRacks = new Set(standardRacks.filter(r => r.startsWith('B')));
      renderRackMatrix();
      updateAndRenderLabels();
    });
  }

  if (btnSelectGrating) {
    btnSelectGrating.addEventListener('click', () => {
      selectedRacks = new Set(standardRacks.filter(r => r.includes('GR')));
      renderRackMatrix();
      updateAndRenderLabels();
    });
  }

  if (btnAddCustomRacks && customRacksInput) {
    btnAddCustomRacks.addEventListener('click', () => {
      const text = customRacksInput.value.trim();
      if (!text) return;
      const items = text.split(/[,;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      items.forEach(item => {
        if (!standardRacks.includes(item)) {
          standardRacks.push(item);
        }
        selectedRacks.add(item);
      });
      customRacksInput.value = '';
      renderRackMatrix();
      updateAndRenderLabels();
    });
  }

  if (layoutSelect) layoutSelect.addEventListener('change', updateAndRenderLabels);
  if (chkShowQR) chkShowQR.addEventListener('change', updateAndRenderLabels);
  if (chkShowBarcode) chkShowBarcode.addEventListener('change', updateAndRenderLabels);
  if (chkShowLogo) chkShowLogo.addEventListener('change', updateAndRenderLabels);

  if (warehouseTitleSelect) {
    warehouseTitleSelect.addEventListener('change', (e) => {
      if (customWarehouseTitle) {
        if (e.target.value === 'custom') {
          customWarehouseTitle.classList.remove('d-none');
          customWarehouseTitle.focus();
        } else {
          customWarehouseTitle.classList.add('d-none');
        }
      }
      updateAndRenderLabels();
    });
  }

  if (customWarehouseTitle) {
    customWarehouseTitle.addEventListener('input', updateAndRenderLabels);
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  if (btnScrollToTop) {
    btnScrollToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Initial Load
  renderRackMatrix();
  generateLabels();
});
