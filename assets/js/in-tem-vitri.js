/* =============================================================================
   IN TEM VỊ TRÍ QR & BARCODE - SCRIPT
   Quản lý sinh mã QR/Barcode hàng loạt, xuất ảnh ZIP và in nhãn dán kệ kho
================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const rackMatrixContainer = document.getElementById('rackMatrixContainer');
  const labelsContainer = document.getElementById('labelsContainer');
  const selectedCountBadge = document.getElementById('selectedCountBadge');
  const previewSummaryText = document.getElementById('previewSummaryText');
  const layoutSelect = document.getElementById('layoutSelect');
  const warehouseTitleSelect = document.getElementById('warehouseTitleSelect');
  const customWarehouseTitle = document.getElementById('customWarehouseTitle');

  const chkOnlyQRMode = document.getElementById('chkOnlyQRMode');
  const standardCodeOptions = document.getElementById('standardCodeOptions');
  const chkShowQR = document.getElementById('chkShowQR');
  const chkShowBarcode = document.getElementById('chkShowBarcode');
  const chkShowLogo = document.getElementById('chkShowLogo');

  const btnExportZip = document.getElementById('btnExportZip');
  const btnPrint = document.getElementById('btnPrint');
  const btnSelectAll = document.getElementById('btnSelectAll');
  const btnSelectRowA = document.getElementById('btnSelectRowA');
  const btnSelectRowB = document.getElementById('btnSelectRowB');
  const btnSelectGrating = document.getElementById('btnSelectGrating');
  const btnUnselectAll = document.getElementById('btnUnselectAll');
  const btnAddCustomRacks = document.getElementById('btnAddCustomRacks');
  const customRacksInput = document.getElementById('customRacksInput');
  const btnScrollToTop = document.getElementById('btnScrollToTop');
  const btnScrollToBottom = document.getElementById('btnScrollToBottom');
  const btnFloatScrollTop = document.getElementById('btnFloatScrollTop');
  const btnFloatScrollBottom = document.getElementById('btnFloatScrollBottom');

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
    const isQROnly = (chkOnlyQRMode && chkOnlyQRMode.checked) || (layoutSelect && (layoutSelect.value === 'qr-only' || layoutSelect.value === 'a4-grid-12'));
    const modeLabel = isQROnly ? ' - Chỉ mã QR' : '';
    if (previewSummaryText) {
      previewSummaryText.textContent = `${count} tem (${layoutText.split('(')[0].trim()}${modeLabel})`;
    }
  }

  function getWarehouseTitle() {
    if (!warehouseTitleSelect) return 'KHO XÀ GỒ & TOLE - DDC';
    if (warehouseTitleSelect.value === 'custom') {
      return (customWarehouseTitle && customWarehouseTitle.value.trim()) || 'KHO VẬT TƯ - DDC';
    }
    return warehouseTitleSelect.value;
  }

  // Generate QR Canvas Blob for Download/Zip
  function generateQRBlob(targetUrl, rackCode, warehouseTitle) {
    return new Promise((resolve) => {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      document.body.appendChild(tempDiv);

      try {
        new QRCode(tempDiv, {
          text: targetUrl,
          width: 360,
          height: 360,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch (err) {
        console.error('QR Gen error', err);
        document.body.removeChild(tempDiv);
        resolve(null);
        return;
      }

      setTimeout(() => {
        const qrCanvas = tempDiv.querySelector('canvas');
        if (!qrCanvas) {
          document.body.removeChild(tempDiv);
          resolve(null);
          return;
        }

        // Composite Card Canvas (440 x 540 px)
        const canvas = document.createElement('canvas');
        canvas.width = 440;
        canvas.height = 540;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 6;
        ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

        // Header: Warehouse Title
        ctx.fillStyle = '#1e40af';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(warehouseTitle.toUpperCase(), canvas.width / 2, 40);

        // Draw QR code
        ctx.drawImage(qrCanvas, 40, 55, 360, 360);

        // Footer Title & Rack Code
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.fillText('VỊ TRÍ KỆ', canvas.width / 2, 445);

        ctx.fillStyle = '#000000';
        ctx.font = '900 48px Arial, sans-serif';
        ctx.fillText(rackCode, canvas.width / 2, 495);

        ctx.font = '11px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(targetUrl, canvas.width / 2, 520);

        canvas.toBlob((blob) => {
          document.body.removeChild(tempDiv);
          resolve(blob);
        }, 'image/png');
      }, 60);
    });
  }

  // Single QR Download
  async function downloadSingleQR(rackCode) {
    const baseOrigin = window.location.origin;
    const targetUrl = `${baseOrigin}/pages/vi-tri-ton.html?vitri=${encodeURIComponent(rackCode)}`;
    const warehouseTitle = getWarehouseTitle();
    const blob = await generateQRBlob(targetUrl, rackCode, warehouseTitle);
    if (blob) {
      if (typeof saveAs !== 'undefined') {
        saveAs(blob, `QR_VITRI_${rackCode}.png`);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QR_VITRI_${rackCode}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  }

  // Batch Export All QR into ZIP
  async function exportAllQRAsZip() {
    const racksToExport = Array.from(selectedRacks);
    if (racksToExport.length === 0) {
      alert('Vui lòng chọn ít nhất một vị trí kệ để xuất mã QR.');
      return;
    }

    if (typeof JSZip === 'undefined' || typeof saveAs === 'undefined') {
      alert('Thư viện tạo file ZIP đang được tải hoặc không khả dụng.');
      return;
    }

    const origBtnText = btnExportZip.innerHTML;
    btnExportZip.disabled = true;
    btnExportZip.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Đang tạo ảnh QR (0/${racksToExport.length})...`;

    try {
      const zip = new JSZip();
      const folder = zip.folder('MA_QR_VI_TRI_KHO_DDC');
      const baseOrigin = window.location.origin;
      const warehouseTitle = getWarehouseTitle();

      for (let i = 0; i < racksToExport.length; i++) {
        const rackCode = racksToExport[i];
        btnExportZip.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Đang tạo (${i + 1}/${racksToExport.length}) ${rackCode}...`;
        const targetUrl = `${baseOrigin}/pages/vi-tri-ton.html?vitri=${encodeURIComponent(rackCode)}`;
        const blob = await generateQRBlob(targetUrl, rackCode, warehouseTitle);
        if (blob) {
          folder.file(`QR_VITRI_${rackCode}.png`, blob);
        }
      }

      btnExportZip.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Đang nén file ZIP...`;
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `Danh_Sach_Ma_QR_Vi_Tri_Kho_DDC_${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (err) {
      console.error('Lỗi xuất zip:', err);
      alert('Có lỗi khi tạo file ZIP mã QR. Vui lòng thử lại.');
    } finally {
      btnExportZip.disabled = false;
      btnExportZip.innerHTML = origBtnText;
    }
  }

  // Generate All Labels
  function generateLabels() {
    if (!labelsContainer) return;
    labelsContainer.innerHTML = '';

    const currentLayout = layoutSelect ? layoutSelect.value : 'a4-grid-4';
    const isQROnly = (chkOnlyQRMode && chkOnlyQRMode.checked) || currentLayout === 'qr-only' || currentLayout === 'a4-grid-12';
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
    const showQR = isQROnly ? true : (chkShowQR ? chkShowQR.checked : true);
    const showBarcode = isQROnly ? false : (chkShowBarcode ? chkShowBarcode.checked : true);
    const showLogo = isQROnly ? false : (chkShowLogo ? chkShowLogo.checked : true);
    const baseOrigin = window.location.origin;

    racksToGenerate.forEach((rackCode, index) => {
      const targetUrl = `${baseOrigin}/pages/vi-tri-ton.html?vitri=${encodeURIComponent(rackCode)}`;
      const qrContainerId = `qrCanvas_${index}_${rackCode.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const barcodeSvgId = `barcodeSvg_${index}_${rackCode.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const card = document.createElement('div');
      
      if (isQROnly) {
        // QR ONLY MINIMAL CARD
        card.className = 'rack-label-card qr-only-card';
        card.innerHTML = `
          <button class="btn btn-sm btn-light single-qr-download-btn no-print" data-rack="${rackCode}" title="Tải ảnh QR vị trí ${rackCode}">
            <i class="bi bi-download"></i>
          </button>
          <div class="qr-only-header">${warehouseTitle}</div>
          <div class="qr-only-body">
            <div id="${qrContainerId}" class="label-qr-canvas"></div>
          </div>
          <div class="qr-only-footer">
            <span class="qr-only-rack-label">VỊ TRÍ KỆ</span>
            <div class="qr-only-rack-code">${rackCode}</div>
          </div>
        `;
      } else {
        // STANDARD INDUSTRIAL CARD
        card.className = 'rack-label-card';
        card.innerHTML = `
          <button class="btn btn-sm btn-light single-qr-download-btn no-print" data-rack="${rackCode}" title="Tải ảnh QR vị trí ${rackCode}">
            <i class="bi bi-download"></i>
          </button>
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
      }

      labelsContainer.appendChild(card);

      // Render QRCode
      if (showQR && typeof QRCode !== 'undefined') {
        const qrEl = document.getElementById(qrContainerId);
        if (qrEl) {
          try {
            const qrSize = (isQROnly && currentLayout === 'a4-grid-12') ? 110 : (isQROnly ? 145 : 130);
            new QRCode(qrEl, {
              text: targetUrl,
              width: qrSize,
              height: qrSize,
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

    // Wire up single download buttons
    labelsContainer.querySelectorAll('.single-qr-download-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rack = btn.getAttribute('data-rack');
        if (rack) downloadSingleQR(rack);
      });
    });
  }

  function updateAndRenderLabels() {
    updateSelectedCount();
    generateLabels();
  }

  // ==================== EVENT LISTENERS ====================
  if (chkOnlyQRMode) {
    chkOnlyQRMode.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (standardCodeOptions) {
        standardCodeOptions.style.opacity = isChecked ? '0.4' : '1';
        standardCodeOptions.style.pointerEvents = isChecked ? 'none' : 'auto';
      }
      updateAndRenderLabels();
    });
  }

  if (layoutSelect) {
    layoutSelect.addEventListener('change', (e) => {
      if (e.target.value === 'qr-only' || e.target.value === 'a4-grid-12') {
        if (chkOnlyQRMode) chkOnlyQRMode.checked = true;
        if (standardCodeOptions) {
          standardCodeOptions.style.opacity = '0.4';
          standardCodeOptions.style.pointerEvents = 'none';
        }
      }
      updateAndRenderLabels();
    });
  }

  if (btnExportZip) {
    btnExportZip.addEventListener('click', exportAllQRAsZip);
  }

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

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToBottom() {
    const labelsEl = document.getElementById('labelsContainer');
    if (labelsEl && labelsEl.children.length > 0) {
      labelsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight || document.body.scrollHeight, behavior: 'smooth' });
    }
  }

  if (btnScrollToTop) btnScrollToTop.addEventListener('click', scrollToTop);
  if (btnScrollToBottom) btnScrollToBottom.addEventListener('click', scrollToBottom);
  if (btnFloatScrollTop) btnFloatScrollTop.addEventListener('click', scrollToTop);
  if (btnFloatScrollBottom) btnFloatScrollBottom.addEventListener('click', scrollToBottom);

  // Initial Load
  renderRackMatrix();
  generateLabels();
});
