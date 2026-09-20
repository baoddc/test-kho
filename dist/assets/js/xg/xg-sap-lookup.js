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

  /**
   * Đồng bộ trực tiếp dữ liệu từ Google Sheets sang Supabase
   * Sử dụng Google GViz JSON endpoint (hỗ trợ CORS trực tiếp trên trình duyệt)
   * @param {HTMLElement} btnEl - Nút bấm kích hoạt đồng bộ
   */
  async function syncFromGoogleSheets(btnEl) {
    if (!window.supabase) {
      alert('Kết nối Supabase chưa sẵn sàng. Vui lòng tải lại trang.');
      return;
    }

    const GVIZ_URL = 'https://docs.google.com/spreadsheets/d/1BPY6k2bQuDu-RNpkRc3BhS57CuM1Ol__FYXvY8ezRjs/gviz/tq?tqx=out:json&sheet=mb51';
    const originalHtml = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang tải Google Sheets...';
    }

    try {
      showAutofillToast('Đang tải dữ liệu mới nhất từ Google Sheets...');

      // 1. Tải dữ liệu JSON trực tiếp qua Google GViz API (Hỗ trợ CORS đầy đủ)
      const response = await fetch(GVIZ_URL);
      if (!response.ok) {
        throw new Error(`Không thể kết nối Google Sheets (Mã HTTP ${response.status}).`);
      }
      const rawText = await response.text();
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      if (start === -1 || end === -1) {
        throw new Error('Định dạng dữ liệu Google Sheets trả về không hợp lệ.');
      }
      const data = JSON.parse(rawText.substring(start, end + 1));
      const gvizRows = (data.table && Array.isArray(data.table.rows)) ? data.table.rows : [];

      if (btnEl) {
        btnEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang phân tích dữ liệu...';
      }

      // Helper lấy giá trị text từ cell GViz
      const getVal = (c) => {
        if (!c || c.v === null || c.v === undefined) return null;
        const s = String(c.v).trim();
        return s ? s : null;
      };

      // Helper parse ngày an toàn
      const parseGvizDate = (c) => {
        if (!c) return null;
        const val = c.f || c.v;
        if (!val) return null;
        const s = String(val).trim();
        const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
        const vn = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (vn) {
          let y = parseInt(vn[3], 10);
          if (y < 100) y += y < 50 ? 2000 : 1900;
          return `${y}-${String(vn[2]).padStart(2, '0')}-${String(vn[1]).padStart(2, '0')}`;
        }
        if (typeof val === 'string') {
          const m = val.match(/Date\((\d+),(\d+),(\d+)/);
          if (m) {
            const y = m[1];
            const month = parseInt(m[2], 10) + 1;
            const day = parseInt(m[3], 10);
            return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
        return null;
      };

      // Helper parse số thực
      const parseNum = (c) => {
        if (!c || c.v === null || c.v === undefined) return 0;
        if (typeof c.v === 'number') return c.v;
        let s = String(c.v).trim().replace(/\s+/g, '');
        if (s.includes(',') && s.includes('.')) {
          s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
        } else if (s.includes(',')) {
          s = s.replace(',', '.');
        }
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      };

      const records = [];
      const nowIso = new Date().toISOString();

      // Duyệt qua tất cả các dòng
      for (let i = 0; i < gvizRows.length; i++) {
        const row = gvizRows[i].c;
        if (!row) continue;

        const doc = getVal(row[2]);
        const date = parseGvizDate(row[3]);
        const mat = getVal(row[5]);
        const matDesc = getVal(row[6]);
        const batch = getVal(row[7]);

        // Bỏ qua dòng tiêu đề
        if (doc && (doc.toLowerCase().includes('material') || (date && date.includes('Posting')))) {
          continue;
        }

        // Định dạng cột chuẩn (Cột C / index 2 là Material Document)
        if (doc) {
          records.push({
            material_document: doc,
            posting_date: date,
            material: mat,
            material_description: matDesc,
            batch: batch,
            quantity: parseNum(row[9]),
            unit_of_entry: getVal(row[8]),
            project_id: getVal(row[10]),
            project_name: getVal(row[11]),
            storage_location: getVal(row[12]),
            movement_type: getVal(row[13]),
            movement_type_text: getVal(row[14]),
            plant: getVal(row[16]),
            vendor_name: getVal(row[24]),
            synced_at: nowIso
          });
        } else {
          // Định dạng lệch cột (Cột AF / index 31 hoặc 36)
          const docAlt = getVal(row[31]) || getVal(row[36]);
          if (docAlt && !docAlt.toLowerCase().includes('material')) {
            records.push({
              material_document: docAlt,
              posting_date: date,
              material: mat,
              material_description: matDesc,
              batch: batch,
              quantity: parseNum(row[28]) || parseNum(row[9]),
              unit_of_entry: getVal(row[32]) || getVal(row[8]),
              project_id: getVal(row[10]),
              project_name: getVal(row[33]) || getVal(row[11]),
              vendor_name: getVal(row[24]),
              synced_at: nowIso
            });
          }
        }
      }

      if (btnEl) {
        btnEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang cập nhật Supabase...`;
      }

      // 3. Làm sạch bảng cũ trên Supabase để khớp chính xác dữ liệu Google Sheets
      const { error: delErr } = await window.supabase.from('xg_sap_mb51').delete().gt('id', 0);
      if (delErr) {
        console.warn('[XgSapLookup] Cảnh báo khi xóa bảng cũ:', delErr);
      }

      // Trường hợp Google Sheet không có dòng dữ liệu nào
      if (records.length === 0) {
        showAutofillToast('✓ Google Sheet hiện không có dữ liệu. Đã xóa sạch toàn bộ dữ liệu trên Supabase (0 dòng)!');
        return;
      }

      // 4. Batch insert theo chunks 1.000 dòng
      const batchSize = 1000;
      const totalBatches = Math.ceil(records.length / batchSize);
      for (let b = 0; b < totalBatches; b++) {
        if (btnEl) {
          btnEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang lưu (${b + 1}/${totalBatches})...`;
        }
        const chunk = records.slice(b * batchSize, (b + 1) * batchSize);
        const { error: insertErr } = await window.supabase.from('xg_sap_mb51').insert(chunk);
        if (insertErr) throw insertErr;
      }

      showAutofillToast(`✓ Đã đồng bộ thành công ${records.length.toLocaleString('vi-VN')} dòng từ Google Sheets sang Supabase!`);


      // Kích hoạt tìm kiếm lại nếu ô Phiếu nhập đang có chữ
      const activeInput = document.querySelector('#addDataForm input[name="col_3"]') ||
                          document.querySelector('#editDataForm input[name="col_3"]');
      if (activeInput && activeInput.value.trim().length >= 2) {
        activeInput.dispatchEvent(new Event('input'));
      }

    } catch (err) {
      console.error('[XgSapLookup] Lỗi khi đồng bộ Google Sheets:', err);
      alert(`Lỗi khi đồng bộ Google Sheets: ${err.message || err}`);
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = originalHtml || '<i class="bi bi-arrow-repeat me-1"></i> Đồng bộ Google Sheets';
      }
    }
  }

  // Export các hàm ra window
  window.XgSapLookup = {
    querySapMb51,
    groupSapMb51Rows,
    initSapDocumentAutocomplete,
    applySapRecordToForm,
    updateSapReconciliationDisplay,
    resetSapSelection,
    syncFromGoogleSheets
  };

})();
