/* =============================================================================
   XG-SAP-LOOKUP.JS
   Tra cứu dữ liệu SAP (từ bảng xg_sap_mb51) và tự động điền form trên xg-nhap.html
   Cung cấp tính năng Autocomplete, Autofill 8 trường và đối chiếu khối lượng cuộn vs SAP.
================================================================================ */

(function () {
  'use strict';

  // Biến lưu trữ dòng SAP đang được chọn hiện tại
  window._currentSelectedSapRecord = null;

  /**
   * Tra cứu dữ liệu từ bảng xg_sap_mb51
   * @param {string} query - Chuỗi tìm kiếm (số phiếu)
   * @returns {Promise<Array>}
   */
  async function querySapMb51(query) {
    if (!window.supabase) {
      console.warn('[XgSapLookup] window.supabase chưa sẵn sàng');
      return [];
    }

    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) return [];

    try {
      const { data, error } = await window.supabase
        .from('xg_sap_mb51')
        .select('*')
        .ilike('material_document', `%${cleanQuery}%`)
        .order('posting_date', { ascending: false })
        .limit(60);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[XgSapLookup] Lỗi tra cứu xg_sap_mb51:', err);
      return [];
    }
  }

  /**
   * Gom nhóm các dòng kết quả từ SAP theo Material Document + Material + Batch
   * Tính tổng Quantity (kg) của mỗi nhóm
   * @param {Array} rows 
   * @returns {Array}
   */
  function groupSapMb51Rows(rows) {
    if (!rows || rows.length === 0) return [];

    const groupMap = new Map();

    for (const r of rows) {
      const doc = String(r.material_document || '').trim();
      const mat = String(r.material || '').trim();
      const batch = String(r.batch || '').trim();
      const key = `${doc}__${mat}__${batch}`;

      const rawQty = typeof r.quantity === 'number' ? r.quantity : parseFloat(r.quantity) || 0;
      // Trọng lượng tuyệt đối để đối chiếu thực nhập
      const absQty = Math.abs(rawQty);

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          material_document: doc,
          posting_date: r.posting_date,
          material: mat,
          material_description: r.material_description || '',
          batch: batch,
          project_id: r.project_id || '',
          project_name: r.project_name || '',
          movement_type: r.movement_type || '',
          movement_type_text: r.movement_type_text || '',
          vendor_name: r.vendor_name || '',
          total_quantity: absQty,
          count: 1,
          raw_items: [r]
        });
      } else {
        const item = groupMap.get(key);
        item.total_quantity += absQty;
        item.count += 1;
        item.raw_items.push(r);
        // Ưu tiên ngày gần nhất nếu có
        if (r.posting_date && (!item.posting_date || r.posting_date > item.posting_date)) {
          item.posting_date = r.posting_date;
        }
        if (!item.project_name && r.project_name) item.project_name = r.project_name;
        if (!item.vendor_name && r.vendor_name) item.vendor_name = r.vendor_name;
      }
    }

    return Array.from(groupMap.values());
  }

  /**
   * Khởi tạo Autocomplete trên ô Phiếu nhập
   * @param {HTMLInputElement} inputEl 
   * @param {HTMLFormElement} formEl 
   */
  function initSapDocumentAutocomplete(inputEl, formEl) {
    if (!inputEl) return;

    // Đảm bảo container gợi ý
    let dropdown = document.getElementById('sapDocAutocompleteMenu');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'sapDocAutocompleteMenu';
      dropdown.className = 'sap-autocomplete-dropdown shadow-lg';
      document.body.appendChild(dropdown);
    }

    let debounceTimer = null;
    let activeIndex = -1;
    let currentResults = [];

    // Định vị dropdown ngay dưới input
    function positionDropdown() {
      const rect = inputEl.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + window.scrollY + 2}px`;
      dropdown.style.left = `${rect.left + window.scrollX}px`;
      dropdown.style.width = `${Math.max(rect.width, 380)}px`;
    }

    function hideDropdown() {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      activeIndex = -1;
      currentResults = [];
    }

    function renderDropdown(groups, searchVal) {
      currentResults = groups;
      dropdown.innerHTML = '';
      activeIndex = -1;

      if (groups.length === 0) {
        dropdown.innerHTML = `
          <div class="p-2 text-muted small text-center">
            <i class="bi bi-info-circle me-1"></i>Không tìm thấy phiếu <strong>${escapeHtml(searchVal)}</strong> trong SAP
          </div>
        `;
        positionDropdown();
        dropdown.style.display = 'block';
        return;
      }

      const headerDiv = document.createElement('div');
      headerDiv.className = 'sap-dropdown-header d-flex justify-content-between align-items-center px-2 py-1 bg-light border-bottom text-muted small';
      headerDiv.innerHTML = `
        <span>Tìm thấy <strong>${groups.length}</strong> mục SAP</span>
        <span class="badge bg-primary">Nhấn để điền</span>
      `;
      dropdown.appendChild(headerDiv);

      const listDiv = document.createElement('div');
      listDiv.className = 'sap-dropdown-list';
      listDiv.style.maxHeight = '280px';
      listDiv.style.overflowY = 'auto';

      groups.forEach((g, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'sap-dropdown-item p-2 border-bottom';
        itemEl.dataset.index = String(idx);

        const qtyFormatted = Number(g.total_quantity).toLocaleString('vi-VN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3
        });

        itemEl.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="fw-bold text-primary"><i class="bi bi-receipt me-1"></i>${escapeHtml(g.material_document)}</span>
            <span class="badge bg-success-subtle text-success border border-success-subtle">${qtyFormatted} kg</span>
          </div>
          <div class="text-dark small fw-semibold text-truncate" title="${escapeHtml(g.material_description)}">
            <span class="text-secondary">${escapeHtml(g.material)}</span> - ${escapeHtml(g.material_description)}
          </div>
          <div class="d-flex gap-2 text-muted small mt-1 flex-wrap">
            <span><strong>Batch:</strong> <span class="badge bg-secondary">${escapeHtml(g.batch || 'N/A')}</span></span>
            ${g.posting_date ? `<span><strong>Ngày:</strong> ${escapeHtml(g.posting_date)}</span>` : ''}
            ${g.project_id ? `<span class="text-truncate" style="max-width: 180px;" title="${escapeHtml(g.project_id)} - ${escapeHtml(g.project_name)}"><strong>CT:</strong> ${escapeHtml(g.project_id)}</span>` : ''}
          </div>
        `;

        itemEl.addEventListener('mouseenter', () => {
          highlightItem(idx);
        });

        itemEl.addEventListener('click', (e) => {
          e.stopPropagation();
          applySapRecordToForm(g, formEl);
          hideDropdown();
        });

        listDiv.appendChild(itemEl);
      });

      dropdown.appendChild(listDiv);
      positionDropdown();
      dropdown.style.display = 'block';
    }

    function highlightItem(index) {
      const items = dropdown.querySelectorAll('.sap-dropdown-item');
      items.forEach((it, i) => {
        if (i === index) {
          it.classList.add('active');
          it.scrollIntoView({ block: 'nearest' });
        } else {
          it.classList.remove('active');
        }
      });
      activeIndex = index;
    }

    // Lắng nghe gõ phím
    inputEl.addEventListener('input', () => {
      const val = inputEl.value.trim();
      clearTimeout(debounceTimer);

      if (val.length < 2) {
        hideDropdown();
        return;
      }

      debounceTimer = setTimeout(async () => {
        positionDropdown();
        dropdown.innerHTML = '<div class="p-2 text-muted small text-center"><span class="spinner-border spinner-border-sm me-1"></span>Đang tìm dữ liệu SAP...</div>';
        dropdown.style.display = 'block';

        const rawRows = await querySapMb51(val);
        const groups = groupSapMb51Rows(rawRows);
        renderDropdown(groups, val);
      }, 250);
    });

    // Lắng nghe phím điều hướng
    inputEl.addEventListener('keydown', (e) => {
      if (dropdown.style.display !== 'block' || currentResults.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = activeIndex < currentResults.length - 1 ? activeIndex + 1 : 0;
        highlightItem(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = activeIndex > 0 ? activeIndex - 1 : currentResults.length - 1;
        highlightItem(prev);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < currentResults.length) {
          e.preventDefault();
          applySapRecordToForm(currentResults[activeIndex], formEl);
          hideDropdown();
        }
      } else if (e.key === 'Escape') {
        hideDropdown();
      }
    });

    // Đóng khi click ngoài
    document.addEventListener('click', (e) => {
      if (!inputEl.contains(e.target) && !dropdown.contains(e.target)) {
        hideDropdown();
      }
    });

    // Cập nhật vị trí khi scroll modal
    window.addEventListener('resize', () => {
      if (dropdown.style.display === 'block') positionDropdown();
    });
  }

  /**
   * Tự động điền dữ liệu SAP vào các trường trong form
   * @param {Object} sapRecord - Dòng dữ liệu SAP đã chọn
   * @param {HTMLFormElement} formEl 
   */
  function applySapRecordToForm(sapRecord, formEl) {
    if (!sapRecord || !formEl) return;

    window._currentSelectedSapRecord = sapRecord;

    // 1. Mã chứng từ mặc định là MN
    const maChungTuSelect = formEl.querySelector('select[name="col_1"]');
    if (maChungTuSelect) {
      let optionExists = false;
      for (let i = 0; i < maChungTuSelect.options.length; i++) {
        if (maChungTuSelect.options[i].value === 'MN') {
          optionExists = true;
          break;
        }
      }
      if (!optionExists) {
        const opt = document.createElement('option');
        opt.value = 'MN';
        opt.textContent = 'MN';
        maChungTuSelect.appendChild(opt);
      }
      maChungTuSelect.value = 'MN';
    }

    // 2. Ngày nhập: Posting Date (YYYY-MM-DD)
    const ngayNhapInput = formEl.querySelector('input[name="col_2"]');
    if (ngayNhapInput && sapRecord.posting_date) {
      ngayNhapInput.value = sapRecord.posting_date;
    }

    // 3. Phiếu nhập: Material Document
    const phieuNhapInput = formEl.querySelector('input[name="col_3"]');
    if (phieuNhapInput) {
      phieuNhapInput.value = sapRecord.material_document;
    }

    // 4. Loại nhập: Mặc định là Nhà cung cấp
    const loaiNhapSelect = formEl.querySelector('select[name="col_4"]');
    if (loaiNhapSelect) {
      loaiNhapSelect.value = 'Nhà cung cấp';
    }

    // 5. Mã vật tư: Material
    const maVatTuInput = formEl.querySelector('input[name="col_5"]');
    if (maVatTuInput) {
      maVatTuInput.value = sapRecord.material || '';
      // Kích hoạt sinh Cuộn ID
      maVatTuInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 6. Tên vật tư: Material Description
    const tenVatTuInput = formEl.querySelector('input[name="col_6"]');
    if (tenVatTuInput) {
      tenVatTuInput.value = sapRecord.material_description || '';
    }

    // 7. Batch: Batch
    const batchInput = formEl.querySelector('input[name="col_7"]');
    if (batchInput) {
      batchInput.value = sapRecord.batch || '';
    }

    // 8. Mã công trình: Project ID
    const maCongTrinhInput = formEl.querySelector('input[name="add_ext_11"]') ||
                             formEl.querySelector('input[name="edit_ext_11"]');
    if (maCongTrinhInput) {
      maCongTrinhInput.value = sapRecord.project_id || '';
    }

    // 9. Tên công trình: Project name
    const tenCongTrinhInput = formEl.querySelector('input[name="add_ext_12"]') ||
                              formEl.querySelector('input[name="edit_ext_12"]');
    if (tenCongTrinhInput) {
      tenCongTrinhInput.value = sapRecord.project_name || '';
    }

    // Gợi ý thông báo nhẹ
    showAutofillToast(`Đã tự động điền thông tin phiếu SAP: ${sapRecord.material_document} (${sapRecord.material})`);

    // Cập nhật lại đối chiếu khối lượng cuộn vs SAP
    if (typeof window.updateRollTotals === 'function') {
      window.updateRollTotals();
    }
  }

  /**
   * Cập nhật dòng hiển thị đối chiếu khối lượng trong bảng cuộn
   * @param {number} totalRollKg - Tổng kg cuộn người dùng đã nhập
   * @param {boolean} [isEdit=false] - Cờ xác định modal sửa hay thêm
   */
  function updateSapReconciliationDisplay(totalRollKg, isEdit = false) {
    const rowId = isEdit ? 'editSapReconciliationRow' : 'sapReconciliationRow';
    const kgDisplayId = isEdit ? 'editTotalSapKgDisplay' : 'totalSapKgDisplay';
    const badgeId = isEdit ? 'editSapReconciliationBadge' : 'sapReconciliationBadge';

    const sapRow = document.getElementById(rowId);
    if (!sapRow) return;

    const sapRecord = window._currentSelectedSapRecord;
    if (!sapRecord || typeof sapRecord.total_quantity !== 'number') {
      sapRow.style.display = 'none';
      return;
    }

    sapRow.style.display = '';

    const sapKg = sapRecord.total_quantity;
    const diff = totalRollKg - sapKg;
    const absDiff = Math.abs(diff);

    const sapKgEl = document.getElementById(kgDisplayId);
    const badgeEl = document.getElementById(badgeId);

    if (sapKgEl) {
      sapKgEl.textContent = sapKg.toLocaleString('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
      }) + ' kg';
    }

    if (badgeEl) {
      if (totalRollKg === 0) {
        badgeEl.className = 'badge bg-secondary';
        badgeEl.innerHTML = '<i class="bi bi-clock me-1"></i>Chờ nhập kg cuộn';
      } else if (absDiff < 0.05) {
        badgeEl.className = 'badge bg-success';
        badgeEl.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Khớp 100% (0 kg)';
      } else if (diff > 0) {
        badgeEl.className = 'badge bg-warning text-dark';
        badgeEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i>Lệch: +${diff.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg (Cuộn > SAP)`;
      } else {
        badgeEl.className = 'badge bg-danger';
        badgeEl.innerHTML = `<i class="bi bi-exclamation-octagon-fill me-1"></i>Lệch: ${diff.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg (Cuộn < SAP)`;
      }
    }
  }

  /**
   * Reset trạng thái chọn phiếu SAP
   */
  function resetSapSelection() {
    window._currentSelectedSapRecord = null;
    const sapRow = document.getElementById('sapReconciliationRow');
    if (sapRow) sapRow.style.display = 'none';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showAutofillToast(msg) {
    let toast = document.getElementById('sapAutofillToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sapAutofillToast';
      toast.className = 'sap-autofill-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // Inject CSS style cho autocomplete và reconciliation
  function injectSapLookupStyles() {
    if (document.getElementById('sapLookupStyles')) return;
    const style = document.createElement('style');
    style.id = 'sapLookupStyles';
    style.textContent = `
      .sap-autocomplete-dropdown {
        position: absolute;
        z-index: 1060;
        background: #ffffff;
        border: 1px solid #ced4da;
        border-radius: 8px;
        overflow: hidden;
        display: none;
      }
      .sap-dropdown-item {
        cursor: pointer;
        transition: background-color 0.15s ease-in-out;
      }
      .sap-dropdown-item:hover, .sap-dropdown-item.active {
        background-color: #e9f3ff;
      }
      .sap-autofill-toast {
        position: fixed;
        bottom: 25px;
        right: 25px;
        background: rgba(33, 37, 41, 0.92);
        color: #ffffff;
        padding: 10px 18px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        z-index: 1080;
        pointer-events: none;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.25s ease, transform 0.25s ease;
      }
      .sap-autofill-toast.show {
        opacity: 1;
        transform: translateY(0);
      }
      #sapReconciliationRow td {
        vertical-align: middle;
      }
    `;
    document.head.appendChild(style);
  }

  // Khởi chạy khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSapLookupStyles);
  } else {
    injectSapLookupStyles();
  }

  // Export các hàm ra window
  window.XgSapLookup = {
    querySapMb51,
    groupSapMb51Rows,
    initSapDocumentAutocomplete,
    applySapRecordToForm,
    updateSapReconciliationDisplay,
    resetSapSelection
  };

})();
