/* =============================================================================
   XG-SAP-LOOKUP.JS
   Tra cứu dữ liệu SAP (từ bảng xg_sap_mb51) và tự động điền form trên xg-nhap.html
   Cung cấp tính năng Autocomplete, Autofill 8 trường và đối chiếu khối lượng cuộn vs SAP.
================================================================================ */

(function () {
  'use strict';

  // Biến lưu trữ dòng SAP đang được chọn hiện tại
  window._currentSelectedSapRecord = null;

  // Cấu hình quy tắc phân loại theo trang
  const SAP_PAGE_RULES = {
    'xg-nhap': {
      debitCredit: ['S'],
      allowedPrefixes: ['10040', '10041'],
      allowedGroups: ['10040-Phôi xà gồ mạ', '10041-Xà gồ'],
      warehouse: 'xg',
      direction: 'nhap',
      label: 'Xà Gồ - Nhập kho',
      pageUrl: '/pages/xg/xg-nhap.html',
      defaultDocType: 'MN',
      docFieldPlaceholder: 'Gõ số phiếu nhập để tìm SAP...',
      tableName: 'xg-nhap',
      docColumnName: 'Phiếu nhập'
    },
    'xg-xuat': {
      debitCredit: ['H'],
      allowedPrefixes: ['10040', '10041'],
      allowedGroups: ['10040-Phôi xà gồ mạ', '10041-Xà gồ'],
      warehouse: 'xg',
      direction: 'xuat',
      label: 'Xà Gồ - Xuất kho',
      pageUrl: '/pages/xg/xg-xuat.html',
      defaultDocType: 'PX',
      docFieldPlaceholder: 'Gõ số phiếu xuất để tìm SAP...',
      tableName: 'xg-xuat',
      docColumnName: 'Phiếu xuất'
    },
    'tole-nhap': {
      debitCredit: ['S'],
      allowedPrefixes: ['10030', '10031', '10022', '10091'],
      allowedGroups: ['10030-Phôi tôn mạ', '10031-Tôn', '10022-Thép cuộn Inox', '10091-Nhôm cuộn'],
      warehouse: 'tole',
      direction: 'nhap',
      label: 'Tole - Nhập kho',
      pageUrl: '/pages/tole/tole-nhap.html',
      defaultDocType: 'MN',
      docFieldPlaceholder: 'Gõ số phiếu nhập để tìm SAP...',
      tableName: 'tole-nhap',
      docColumnName: 'Phiếu nhập'
    },
    'tole-xuat': {
      debitCredit: ['H'],
      allowedPrefixes: ['10030', '10031', '10022', '10091'],
      allowedGroups: ['10030-Phôi tôn mạ', '10031-Tôn', '10022-Thép cuộn Inox', '10091-Nhôm cuộn'],
      warehouse: 'tole',
      direction: 'xuat',
      label: 'Tole - Xuất kho',
      pageUrl: '/pages/tole/tole-xuat.html',
      defaultDocType: 'PX',
      docFieldPlaceholder: 'Gõ số phiếu xuất để tìm SAP...',
      tableName: 'tole-xuat',
      docColumnName: 'Phiếu xuất'
    }
  };

  // Tập hợp lưu các số phiếu người dùng đã xác nhận bỏ qua cảnh báo
  if (typeof window !== 'undefined') {
    window._confirmedProcessedReceipts = window._confirmedProcessedReceipts || new Set();
  }

  /**
   * Tự động nhận diện ngữ cảnh trang hiện tại
   * @param {string} [explicitContext]
   * @returns {string}
   */
  function detectCurrentPageContext(explicitContext) {
    if (explicitContext && SAP_PAGE_RULES[explicitContext]) {
      return explicitContext;
    }
    const path = (typeof window !== 'undefined' && window.location && window.location.pathname)
      ? window.location.pathname.toLowerCase()
      : '';
    if (path.includes('xg-xuat')) return 'xg-xuat';
    if (path.includes('xg-nhap')) return 'xg-nhap';
    if (path.includes('tole-xuat')) return 'tole-xuat';
    if (path.includes('tole-nhap')) return 'tole-nhap';
    return 'xg-nhap';
  }

  /**
   * Trích xuất thông tin Debit/Credit và Phân nhóm vật tư từ dòng SAP
   * @param {Object} row 
   * @returns {{dc: string, group: string}}
   */
  function extractSapRowAttributes(row) {
    let dc = '';
    let group = '';
    if (row) {
      if (row.debit_credit_ind) dc = String(row.debit_credit_ind).trim().toUpperCase();
      if (row.material_group) group = String(row.material_group).trim();
      if ((!dc || !group) && row.raw_data && typeof row.raw_data === 'object') {
        if (!dc && row.raw_data.debit_credit_ind) dc = String(row.raw_data.debit_credit_ind).trim().toUpperCase();
        if (!group && row.raw_data.material_group) group = String(row.raw_data.material_group).trim();
      }
    }
    return { dc, group };
  }

  /**
   * Kiểm tra tính hợp lệ của dòng/nhóm SAP với ngữ cảnh trang
   * @param {Object} rowOrGroup 
   * @param {string} contextKey 
   * @returns {{isValid: boolean, isDcMatch: boolean, isGroupMatch: boolean, dc: string, group: string, rules: Object}}
   */
  function validateSapRecordAgainstContext(rowOrGroup, contextKey) {
    const rules = SAP_PAGE_RULES[contextKey] || SAP_PAGE_RULES['xg-nhap'];
    const { dc, group } = extractSapRowAttributes(rowOrGroup);
    
    // Nếu có dc thì phải khớp S hoặc H
    const isDcMatch = !dc || rules.debitCredit.includes(dc);
    // Nếu có group thì phải bắt đầu bằng prefix cho phép
    const isGroupMatch = !group || rules.allowedPrefixes.some(prefix => group.startsWith(prefix));

    return {
      isValid: Boolean(isDcMatch && isGroupMatch),
      isDcMatch: Boolean(isDcMatch),
      isGroupMatch: Boolean(isGroupMatch),
      dc,
      group,
      rules
    };
  }

  /**
   * Kiểm tra xem một số phiếu (chứng từ) đã từng được nhập hoặc xuất trong kho hay chưa
   * @param {string} docNo - Số phiếu cần kiểm tra
   * @param {string} [pageContext] - 'xg-nhap' | 'xg-xuat' | 'tole-nhap' | 'tole-xuat'
   * @returns {Promise<{ isProcessed: boolean, count: number, totalKg: number, totalM: number, records: Array, firstDate: string, lastDate: string, projectNames: Array, projectIds: Array, coilIds: Array }>}
   */
  async function checkReceiptProcessed(docNo, pageContext) {
    const cleanDoc = String(docNo || '').trim();
    const emptyResult = {
      isProcessed: false,
      count: 0,
      totalKg: 0,
      totalM: 0,
      records: [],
      firstDate: '',
      lastDate: '',
      projectNames: [],
      projectIds: [],
      coilIds: []
    };
    if (!cleanDoc) return emptyResult;

    const currentContext = detectCurrentPageContext(pageContext);
    const rule = SAP_PAGE_RULES[currentContext] || SAP_PAGE_RULES['xg-nhap'];
    const colName = rule.docColumnName;
    const tableName = rule.tableName;

    let matchedRows = [];

    // Tầng 1: Tra cứu tức thì từ Local Cache (window._rawSupabaseData)
    if (typeof window !== 'undefined' && Array.isArray(window._rawSupabaseData) && window._rawSupabaseData.length > 0) {
      matchedRows = window._rawSupabaseData.filter(r => {
        if (!r) return false;
        const val = String(r[colName] || '').trim();
        return val.toLowerCase() === cleanDoc.toLowerCase();
      });
    }

    // Tầng 2: Nếu không thấy trong local cache hoặc local cache rỗng, query Supabase
    if (matchedRows.length === 0 && typeof window !== 'undefined' && window.supabase) {
      try {
        const { data, error } = await window.supabase
          .from(tableName)
          .select('*')
          .ilike(colName, cleanDoc);
        if (!error && Array.isArray(data) && data.length > 0) {
          // Lọc chính xác không phân biệt hoa thường
          matchedRows = data.filter(r => String(r[colName] || '').trim().toLowerCase() === cleanDoc.toLowerCase());
        }
      } catch (err) {
        console.warn(`[XgSapLookup] Không thể truy vấn Supabase cho bảng ${tableName}:`, err);
      }
    }

    if (matchedRows.length === 0) return emptyResult;

    let totalKg = 0;
    let totalM = 0;
    const coilIds = [];
    const projectNamesSet = new Set();
    const projectIdsSet = new Set();
    const dates = [];

    matchedRows.forEach(r => {
      // Số lượng Kg
      const rawKg = r['Số lượng (Kg)'];
      const kg = typeof rawKg === 'number' ? rawKg : (parseFloat(String(rawKg || 0).replace(/,/g, '')) || 0);
      totalKg += kg;

      // Số lượng m (cho tole nếu có)
      if (r['Số lượng (m)']) {
        const rawM = r['Số lượng (m)'];
        const m = typeof rawM === 'number' ? rawM : (parseFloat(String(rawM || 0).replace(/,/g, '')) || 0);
        totalM += m;
      }

      // Cuộn ID
      const cid = String(r['Cuộn ID'] || '').trim();
      if (cid && !coilIds.includes(cid)) coilIds.push(cid);

      // Công trình
      const pName = String(r['Tên công trình'] || '').trim();
      if (pName) projectNamesSet.add(pName);
      const pId = String(r['Mã công trình'] || '').trim();
      if (pId) projectIdsSet.add(pId);

      // Ngày nhập / Ngày xuất
      const dateVal = String(r['Ngày nhập'] || r['Ngày xuất'] || '').trim();
      if (dateVal) dates.push(dateVal);
    });

    dates.sort();

    return {
      isProcessed: true,
      count: matchedRows.length,
      totalKg,
      totalM,
      records: matchedRows,
      firstDate: dates[0] || '',
      lastDate: dates[dates.length - 1] || '',
      projectNames: Array.from(projectNamesSet),
      projectIds: Array.from(projectIdsSet),
      coilIds
    };
  }

  /**
   * Hiển thị Modal cảnh báo khi số phiếu đã được nhập hoặc xuất trong kho
   * @param {Object} options
   * @param {string} options.docNo - Số phiếu
   * @param {string} [options.pageContext] - Ngữ cảnh trang
   * @param {Object} options.processedInfo - Dữ liệu trả về từ checkReceiptProcessed
   * @param {Object} [options.sapRecord] - Dòng dữ liệu SAP đối chiếu (nếu có)
   * @param {Function} [options.onConfirm] - Callback khi người dùng bấm "Tiếp tục điền phiếu"
   * @param {Function} [options.onCancel] - Callback khi người dùng bấm "Hủy / Đổi phiếu"
   */
  function showReceiptProcessedWarningModal(options) {
    if (!options) return;
    const { docNo, pageContext, processedInfo, sapRecord, onConfirm, onCancel } = options;
    const currentContext = detectCurrentPageContext(pageContext);
    const rule = SAP_PAGE_RULES[currentContext] || SAP_PAGE_RULES['xg-nhap'];
    const isNhap = rule.direction === 'nhap';
    const actionText = isNhap ? 'nhập' : 'xuất';
    const ActionText = isNhap ? 'Nhập' : 'Xuất';

    let modalEl = document.getElementById('receiptProcessedWarningModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'receiptProcessedWarningModal';
      modalEl.className = 'modal fade';
      modalEl.tabIndex = -1;
      modalEl.setAttribute('aria-hidden', 'true');
      modalEl.setAttribute('data-bs-backdrop', 'static');
      modalEl.style.zIndex = '10080';
      document.body.appendChild(modalEl);
    }

    const totalKg = processedInfo?.totalKg || 0;
    const totalM = processedInfo?.totalM || 0;
    const count = processedInfo?.count || 0;
    const coilIds = processedInfo?.coilIds || [];
    const pNames = processedInfo?.projectNames || [];
    const dateRange = (processedInfo?.firstDate && processedInfo?.lastDate && processedInfo.firstDate !== processedInfo.lastDate)
      ? `${processedInfo.firstDate} ~ ${processedInfo.lastDate}`
      : (processedInfo?.firstDate || processedInfo?.lastDate || 'Chưa ghi nhận ngày');

    const totalKgFormatted = totalKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
    const totalMFormatted = totalM > 0 ? totalM.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : null;

    let sapComparisonHtml = '';
    if (sapRecord) {
      const sapKg = typeof sapRecord.total_quantity === 'number' ? sapRecord.total_quantity : (parseFloat(sapRecord.total_quantity) || 0);
      const sapKgFormatted = sapKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
      const diffKg = sapKg - totalKg;
      let statusBadge = '';
      if (Math.abs(diffKg) < 0.001) {
        statusBadge = `<span class="badge bg-danger fs-6"><i class="bi bi-shield-fill-x me-1"></i>Đã ${actionText} đủ 100% phiếu SAP (${sapKgFormatted} kg)</span>`;
      } else if (diffKg > 0) {
        statusBadge = `<span class="badge bg-warning text-dark fs-6"><i class="bi bi-pie-chart-fill me-1"></i>Đã ${actionText} ${totalKgFormatted} / ${sapKgFormatted} kg (còn thiếu ${diffKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} kg)</span>`;
      } else {
        statusBadge = `<span class="badge bg-danger fs-6"><i class="bi bi-exclamation-triangle-fill me-1"></i>Số kg trong kho (${totalKgFormatted} kg) đã vượt phiếu SAP (${sapKgFormatted} kg)</span>`;
      }

      sapComparisonHtml = `
        <div class="p-3 rounded-3 mb-3" style="background: rgba(245, 158, 11, 0.08); border: 1px dashed #f59e0b;">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <span class="fw-bold text-dark"><i class="bi bi-arrow-left-right me-1 text-warning"></i>Đối chiếu với dữ liệu SAP:</span>
            ${statusBadge}
          </div>
          <div class="row g-2 text-dark small">
            <div class="col-sm-6">
              <strong>Khối lượng SAP:</strong> <span class="badge bg-secondary-subtle text-secondary border">${sapKgFormatted} kg</span>
            </div>
            <div class="col-sm-6">
              <strong>Đã ${actionText} trong kho:</strong> <span class="badge bg-warning text-dark border">${totalKgFormatted} kg</span>
            </div>
          </div>
        </div>
      `;
    }

    const coilListHtml = coilIds.length > 0
      ? `<div class="d-flex flex-wrap gap-1 mt-1" style="max-height: 80px; overflow-y: auto;">
          ${coilIds.map(c => `<span class="badge bg-light text-dark border font-monospace">${escapeHtml(c)}</span>`).join('')}
         </div>`
      : '<span class="text-muted fst-italic">Không có Cuộn ID cụ thể</span>';

    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-lg" style="max-width: 700px;">
        <div class="modal-content shadow-lg border-0" style="border-radius: 16px; overflow: hidden; background: #ffffff;">
          <div class="modal-header py-3 px-4" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff;">
            <div class="d-flex align-items-center gap-2">
              <span class="d-inline-flex align-items-center justify-content-center bg-white text-warning rounded-circle shadow-sm" style="width: 38px; height: 38px; font-size: 1.3rem;">
                <i class="bi bi-exclamation-triangle-fill"></i>
              </span>
              <div>
                <h5 class="modal-title fw-bold mb-0 text-white" style="letter-spacing: 0.3px;">
                  CẢNH BÁO: PHIẾU ĐÃ ${ActionText.toUpperCase()} TRƯỚC ĐÓ
                </h5>
                <small class="text-white-50">${escapeHtml(rule.label)} - Số phiếu: <strong>${escapeHtml(docNo)}</strong></small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" id="btnReceiptWarnCloseX"></button>
          </div>

          <div class="modal-body p-4 text-dark" style="font-size: 0.95rem; line-height: 1.6;">
            <div class="alert alert-warning border-warning-subtle d-flex align-items-center gap-2 py-2 px-3 mb-3">
              <i class="bi bi-info-circle-fill text-warning fs-5"></i>
              <div>
                Số phiếu <strong>${escapeHtml(docNo)}</strong> đã có <strong>${count}</strong> dòng dữ liệu được ${actionText} trong hệ thống <strong>${escapeHtml(rule.label)}</strong>.
              </div>
            </div>

            ${sapComparisonHtml}

            <div class="card border border-light-subtle shadow-sm mb-3">
              <div class="card-header bg-light py-2 px-3 fw-bold small text-muted text-uppercase">
                <i class="bi bi-list-check me-1"></i>Chi tiết dữ liệu đã ghi nhận trong kho
              </div>
              <div class="card-body p-3">
                <table class="table table-sm table-bordered align-middle mb-0">
                  <tbody>
                    <tr>
                      <td class="bg-light text-muted fw-semibold" style="width: 35%;">Phân hệ & Nghiệp vụ</td>
                      <td class="fw-bold text-primary">${escapeHtml(rule.label)} (${ActionText} kho)</td>
                    </tr>
                    <tr>
                      <td class="bg-light text-muted fw-semibold">Thời gian ghi nhận</td>
                      <td><i class="bi bi-calendar-event me-1 text-secondary"></i>${escapeHtml(dateRange)}</td>
                    </tr>
                    <tr>
                      <td class="bg-light text-muted fw-semibold">Công trình</td>
                      <td>${escapeHtml(pNames.join(', ') || 'Tồn trơn / Chưa có tên')}</td>
                    </tr>
                    <tr>
                      <td class="bg-light text-muted fw-semibold">Số lượng bản ghi / Cuộn</td>
                      <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle fs-6">${count} cuộn</span></td>
                    </tr>
                    <tr>
                      <td class="bg-light text-muted fw-semibold">Tổng khối lượng đã lưu</td>
                      <td>
                        <span class="badge bg-warning text-dark border fs-6 fw-bold">${totalKgFormatted} kg</span>
                        ${totalMFormatted ? `<span class="badge bg-info text-dark border ms-1 fs-6">${totalMFormatted} m</span>` : ''}
                      </td>
                    </tr>
                    <tr>
                      <td class="bg-light text-muted fw-semibold align-top pt-2">Danh sách Cuộn ID</td>
                      <td>${coilListHtml}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="text-secondary small fst-italic text-center">
              ⚠️ Nếu bạn vẫn muốn nhập/xuất bổ sung thêm cho phiếu này, hãy bấm <strong>"Tiếp tục điền phiếu"</strong>. Ngược lại, hãy bấm <strong>"Hủy / Đổi phiếu"</strong> để chọn phiếu khác.
            </div>
          </div>

          <div class="modal-footer bg-light py-3 px-4 d-flex justify-content-between">
            <button type="button" class="btn btn-outline-secondary px-3 py-2 fw-semibold" id="btnReceiptWarnCancel">
              <i class="bi bi-x-circle me-1"></i> Hủy / Đổi phiếu khác
            </button>
            <button type="button" class="btn btn-warning px-4 py-2 fw-bold text-dark shadow-sm" id="btnReceiptWarnConfirm">
              <i class="bi bi-check2-circle me-1"></i> Tiếp tục điền phiếu
            </button>
          </div>
        </div>
      </div>
    `;

    const bsModal = typeof bootstrap !== 'undefined' && bootstrap.Modal
      ? bootstrap.Modal.getOrCreateInstance(modalEl)
      : null;

    let isHandled = false;

    const cleanup = () => {
      if (bsModal) bsModal.hide();
      else modalEl.style.display = 'none';
    };

    const handleConfirm = () => {
      if (isHandled) return;
      isHandled = true;
      if (!window._confirmedProcessedReceipts) window._confirmedProcessedReceipts = new Set();
      window._confirmedProcessedReceipts.add(String(docNo).trim().toLowerCase());
      cleanup();
      if (typeof onConfirm === 'function') onConfirm();
    };

    const handleCancel = () => {
      if (isHandled) return;
      isHandled = true;
      cleanup();
      if (typeof onCancel === 'function') onCancel();
    };

    const btnConfirm = modalEl.querySelector('#btnReceiptWarnConfirm');
    const btnCancel = modalEl.querySelector('#btnReceiptWarnCancel');
    const btnCloseX = modalEl.querySelector('#btnReceiptWarnCloseX');

    if (btnConfirm) btnConfirm.onclick = handleConfirm;
    if (btnCancel) btnCancel.onclick = handleCancel;
    if (btnCloseX) btnCloseX.onclick = handleCancel;

    modalEl.addEventListener('hidden.bs.modal', () => {
      if (!isHandled) {
        isHandled = true;
        if (typeof onCancel === 'function') onCancel();
      }
    }, { once: true });

    if (bsModal) {
      bsModal.show();
    } else {
      modalEl.style.display = 'block';
    }
  }

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

      const { dc, group } = extractSapRowAttributes(r);

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          material_document: doc,
          posting_date: r.posting_date,
          material: mat,
          material_description: r.material_description || '',
          material_group: group,
          debit_credit_ind: dc,
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
        if (!item.material_group && group) item.material_group = group;
        if (!item.debit_credit_ind && dc) item.debit_credit_ind = dc;
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
   * Khởi tạo Autocomplete trên ô Phiếu nhập / Phiếu xuất
   * @param {HTMLInputElement} inputEl 
   * @param {HTMLFormElement} formEl 
   * @param {string} [pageContext] - 'xg-nhap' | 'xg-xuat' | 'tole-nhap' | 'tole-xuat'
   */
  function initSapDocumentAutocomplete(inputEl, formEl, pageContext) {
    if (!inputEl) return;

    const currentContext = detectCurrentPageContext(pageContext);
    const rules = SAP_PAGE_RULES[currentContext] || SAP_PAGE_RULES['xg-nhap'];

    if (rules && rules.docFieldPlaceholder) {
      inputEl.placeholder = rules.docFieldPlaceholder;
    }

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
      dropdown.style.width = `${Math.max(rect.width, 460)}px`;
    }

    function hideDropdown() {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      activeIndex = -1;
      currentResults = [];
    }

    async function renderDropdown(groups, searchVal) {
      dropdown.innerHTML = '';
      activeIndex = -1;

      if (!groups || groups.length === 0) {
        currentResults = [];
        dropdown.innerHTML = `
          <div class="p-2 text-muted small text-center">
            <i class="bi bi-info-circle me-1"></i>Không tìm thấy phiếu <strong>${escapeHtml(searchVal)}</strong> trong SAP
          </div>
        `;
        positionDropdown();
        dropdown.style.display = 'block';
        return;
      }

      // Phân loại nhóm hợp lệ vs không hợp lệ theo quy tắc của trang
      const validGroups = [];
      const invalidGroups = [];

      groups.forEach(g => {
        const check = validateSapRecordAgainstContext(g, currentContext);
        if (check.isValid) {
          validGroups.push(g);
        } else {
          invalidGroups.push({ group: g, check });
        }
      });

      currentResults = validGroups;

      // TRƯỜNG HỢP 1: Có các dòng hợp lệ cho trang hiện tại
      if (validGroups.length > 0) {
        // Kiểm tra trạng thái đã nhập/xuất trong kho của các số phiếu
        const processedMap = new Map();
        await Promise.all(validGroups.map(async g => {
          const doc = String(g.material_document || '').trim();
          if (doc && !processedMap.has(doc.toLowerCase())) {
            const info = await checkReceiptProcessed(doc, currentContext);
            processedMap.set(doc.toLowerCase(), info);
          }
        }));

        const headerDiv = document.createElement('div');
        headerDiv.className = 'sap-dropdown-header d-flex justify-content-between align-items-center px-2 py-1 bg-light border-bottom text-muted small';
        headerDiv.innerHTML = `
          <span>Khớp <strong>${validGroups.length}</strong> mục [${escapeHtml(rules.label)}]</span>
          <span class="badge bg-primary">Nhấn để điền</span>
        `;
        dropdown.appendChild(headerDiv);

        const listDiv = document.createElement('div');
        listDiv.className = 'sap-dropdown-list';
        listDiv.style.maxHeight = '280px';
        listDiv.style.overflowY = 'auto';

        validGroups.forEach((g, idx) => {
          const itemEl = document.createElement('div');
          itemEl.className = 'sap-dropdown-item p-2 border-bottom';
          itemEl.dataset.index = String(idx);

          const qtyFormatted = Number(g.total_quantity).toLocaleString('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
          });

          const dcBadge = g.debit_credit_ind === 'S'
            ? '<span class="badge bg-success-subtle text-success border border-success-subtle me-1" title="Debit (Nhập kho)">S</span>'
            : (g.debit_credit_ind === 'H'
              ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle me-1" title="Credit (Xuất kho)">H</span>'
              : '');

          const docKey = String(g.material_document || '').trim().toLowerCase();
          const proc = processedMap.get(docKey);
          const isProc = Boolean(proc && proc.isProcessed);

          const procBadge = isProc
            ? `<span class="badge bg-warning text-dark border border-warning-subtle me-1" title="Phiếu này đã có trong hệ thống: ${proc.count} cuộn (${proc.totalKg.toLocaleString('vi-VN')} kg)"><i class="bi bi-exclamation-triangle-fill me-1"></i>Đã ${rules.direction === 'nhap' ? 'nhập' : 'xuất'} (${proc.totalKg.toLocaleString('vi-VN')} kg)</span>`
            : '';

          itemEl.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
              <div>
                ${dcBadge}
                ${procBadge}
                <span class="fw-bold text-primary"><i class="bi bi-receipt me-1"></i>${escapeHtml(g.material_document)}</span>
              </div>
              <span class="badge bg-primary-subtle text-primary border border-primary-subtle">${qtyFormatted} kg</span>
            </div>
            <div class="text-dark small fw-semibold text-truncate" title="${escapeHtml(g.material_description)}">
              <span class="text-secondary">${escapeHtml(g.material)}</span> - ${escapeHtml(g.material_description)}
            </div>
            <div class="d-flex gap-2 text-muted small mt-1 flex-wrap align-items-center">
              ${g.material_group ? `<span class="badge bg-secondary-subtle text-secondary border">${escapeHtml(g.material_group)}</span>` : ''}
              <span><strong>Batch:</strong> <span class="badge bg-secondary">${escapeHtml(g.batch || 'N/A')}</span></span>
              ${g.posting_date ? `<span><strong>Ngày:</strong> ${escapeHtml(g.posting_date)}</span>` : ''}
              ${g.project_id ? `<span class="text-truncate" style="max-width: 160px;" title="${escapeHtml(g.project_id)} - ${escapeHtml(g.project_name)}"><strong>CT:</strong> ${escapeHtml(g.project_id)}</span>` : ''}
            </div>
          `;

          itemEl.addEventListener('mouseenter', () => {
            highlightItem(idx);
          });

          itemEl.addEventListener('click', async (e) => {
            e.stopPropagation();
            hideDropdown();

            const doc = String(g.material_document || '').trim();
            const procInfo = processedMap.get(doc.toLowerCase()) || await checkReceiptProcessed(doc, currentContext);

            if (procInfo && procInfo.isProcessed && (!window._confirmedProcessedReceipts || !window._confirmedProcessedReceipts.has(doc.toLowerCase()))) {
              showReceiptProcessedWarningModal({
                docNo: doc,
                pageContext: currentContext,
                processedInfo: procInfo,
                sapRecord: g,
                onConfirm: () => {
                  applySapRecordToForm(g, formEl, currentContext);
                },
                onCancel: () => {
                  inputEl.value = '';
                  resetSapSelection();
                }
              });
            } else {
              applySapRecordToForm(g, formEl, currentContext);
            }
          });

          listDiv.appendChild(itemEl);
        });

        dropdown.appendChild(listDiv);

        // Nếu có dòng bị ẩn do khác kho/loại, hiển thị thêm footer chú thích
        if (invalidGroups.length > 0) {
          const footerDiv = document.createElement('div');
          footerDiv.className = 'px-2 py-1 bg-light border-top text-muted small d-flex align-items-center justify-content-between';
          footerDiv.innerHTML = `
            <span><i class="bi bi-funnel me-1"></i>Đã lọc ẩn <strong>${invalidGroups.length}</strong> mục khác loại/kho</span>
            <span class="text-secondary" style="font-size: 0.75rem;">(Chỉ nhận ${rules.direction === 'nhap' ? 'S' : 'H'} & ${rules.warehouse.toUpperCase()})</span>
          `;
          dropdown.appendChild(footerDiv);
        }

        positionDropdown();
        dropdown.style.display = 'block';
        return;
      }

      // TRƯỜNG HỢP 2: Tìm thấy phiếu SAP nhưng KHÔNG HỢP LỆ với trang hiện tại
      if (invalidGroups.length > 0) {
        const warnDiv = document.createElement('div');
        warnDiv.className = 'sap-doc-warning';

        const sample = invalidGroups[0].group;
        const sampleDc = sample.debit_credit_ind === 'S'
          ? 'Nhập kho (Debit: S)'
          : (sample.debit_credit_ind === 'H' ? 'Xuất kho (Credit: H)' : (sample.debit_credit_ind || 'Chưa xác định'));
        const expectedDcStr = rules.direction === 'nhap' ? 'Nhập kho (Debit: S)' : 'Xuất kho (Credit: H)';

        // Xác định trang phù hợp để gợi ý điều hướng thông minh
        const matGroup = String(sample.material_group || sample.material || '').trim();
        const dc = String(sample.debit_credit_ind || '').toUpperCase().trim();
        const isXgGroup = matGroup.startsWith('10040') || matGroup.startsWith('10041');
        const isToleGroup = ['10030', '10031', '10022', '10091'].some(p => matGroup.startsWith(p));

        let targetWarehouse = isXgGroup ? 'xg' : (isToleGroup ? 'tole' : null);
        let targetDir = dc === 'S' ? 'nhap' : (dc === 'H' ? 'xuat' : null);
        let suggestedPage = null;
        if (targetWarehouse && targetDir) {
          const targetKey = `${targetWarehouse}-${targetDir}`;
          if (SAP_PAGE_RULES[targetKey] && targetKey !== currentContext) {
            suggestedPage = SAP_PAGE_RULES[targetKey];
          }
        }

        warnDiv.innerHTML = `
          <div class="sap-warning-header">
            <i class="bi bi-info-circle-fill" style="color: #f59e0b; font-size: 1.15rem;"></i>
            <span>Thông tin phiếu chưa phù hợp với trang ${escapeHtml(rules.label)}</span>
          </div>

          <div class="sap-warning-summary">
            Tìm thấy <strong>${invalidGroups.length}</strong> dòng cho số phiếu <strong>${escapeHtml(searchVal)}</strong> trong SAP:
          </div>

          <div class="sap-warning-card">
            <div class="sap-warning-row">
              <span class="sap-warning-label">• Loại phiếu SAP:</span>
              <span class="sap-tag sap-tag-warning">${escapeHtml(sampleDc)}</span>
              <span class="sap-warning-subtext">(Trang yêu cầu: <strong>${escapeHtml(expectedDcStr)}</strong>)</span>
            </div>
            <div class="sap-warning-row">
              <span class="sap-warning-label">• Phân nhóm VT:</span>
              <span class="sap-tag sap-tag-info">${escapeHtml(sample.material_group || 'Chưa phân nhóm')}</span>
            </div>
            <div class="sap-warning-row">
              <span class="sap-warning-label">• Tên vật tư:</span>
              <span class="sap-warning-desc text-truncate" title="${escapeHtml(sample.material || '')} - ${escapeHtml(sample.material_description || '')}">
                ${escapeHtml(sample.material || '')} - ${escapeHtml(sample.material_description || '')}
              </span>
            </div>
          </div>

          ${suggestedPage ? `
            <div class="sap-warning-suggestion">
              <div class="d-flex align-items-center gap-1">
                <i class="bi bi-lightbulb-fill" style="color: #eab308;"></i>
                <span><strong>Gợi ý:</strong> Phiếu này thuộc phân hệ <strong>${escapeHtml(suggestedPage.label)}</strong>.</span>
              </div>
              <div class="mt-1 ps-3">
                <a href="${escapeHtml(suggestedPage.pageUrl || '#')}" class="sap-warning-link">
                  <i class="bi bi-box-arrow-up-right me-1"></i>Chuyển sang trang <strong>${escapeHtml(suggestedPage.label)}</strong> để nhập liệu
                </a>
              </div>
            </div>
          ` : ''}

          <div class="sap-warning-rule">
            <i class="bi bi-shield-check me-1"></i><strong>Quy định trang:</strong> Chỉ nhận phiếu <strong>${expectedDcStr}</strong> và nhóm VT: <em>${escapeHtml(rules.allowedGroups.join(', '))}</em>.
          </div>
        `;
        dropdown.appendChild(warnDiv);
        positionDropdown();
        dropdown.style.display = 'block';
        return;
      }
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

      // Nếu người dùng thay đổi số phiếu khác với phiếu SAP đang chọn, hủy chọn SAP hiện tại
      if (window._currentSelectedSapRecord && val.toLowerCase() !== String(window._currentSelectedSapRecord.material_document || '').toLowerCase()) {
        resetSapSelection();
        if (typeof window.updateRollTotals === 'function') {
          window.updateRollTotals();
        } else if (typeof window.updateEditRollTotals === 'function' && formEl.id === 'editDataForm') {
          window.updateEditRollTotals();
        }
      }

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
        await renderDropdown(groups, val);
      }, 250);
    });

    // Khi rời khỏi ô nhập hoặc dán nội dung: kiểm tra trùng lặp và tự động áp dụng SAP
    inputEl.addEventListener('change', async () => {
      const val = inputEl.value.trim();
      if (!val) return;

      // 1. Kiểm tra xem phiếu này đã có trong hệ thống hay chưa
      const procInfo = await checkReceiptProcessed(val, currentContext);
      if (procInfo && procInfo.isProcessed && (!window._confirmedProcessedReceipts || !window._confirmedProcessedReceipts.has(val.toLowerCase()))) {
        let matchedSap = null;
        try {
          const rawRows = await querySapMb51(val);
          const groups = groupSapMb51Rows(rawRows);
          const exact = groups.filter(g => String(g.material_document || '').toLowerCase() === val.toLowerCase());
          if (exact.length > 0) matchedSap = exact[0];
        } catch (e) {
          // ignore
        }

        showReceiptProcessedWarningModal({
          docNo: val,
          pageContext: currentContext,
          processedInfo: procInfo,
          sapRecord: matchedSap,
          onConfirm: () => {
            if (matchedSap && !window._currentSelectedSapRecord) {
              const check = validateSapRecordAgainstContext(matchedSap, currentContext);
              if (check.isValid) {
                applySapRecordToForm(matchedSap, formEl, currentContext);
              }
            }
          },
          onCancel: () => {
            inputEl.value = '';
            resetSapSelection();
          }
        });
        return;
      }

      // 2. Nếu chưa được chọn SAP và chưa có cảnh báo, thử auto match SAP chính xác
      if (!window._currentSelectedSapRecord) {
        try {
          const rawRows = await querySapMb51(val);
          const groups = groupSapMb51Rows(rawRows);
          const exact = groups.filter(g => String(g.material_document || '').toLowerCase() === val.toLowerCase());
          if (exact.length === 1) {
            const check = validateSapRecordAgainstContext(exact[0], currentContext);
            if (check.isValid) {
              applySapRecordToForm(exact[0], formEl, currentContext);
            } else {
              showAutofillToast(`⚠️ Phiếu ${val} không được phép nhập vào ${rules.label} (sai loại hoặc phân nhóm)!`);
            }
          }
        } catch (err) {
          console.warn('[XgSapLookup] Lỗi auto match khi change:', err);
        }
      }
    });

    // Lắng nghe phím điều hướng
    inputEl.addEventListener('keydown', async (e) => {
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
          const g = currentResults[activeIndex];
          hideDropdown();

          const doc = String(g.material_document || '').trim();
          const procInfo = await checkReceiptProcessed(doc, currentContext);

          if (procInfo && procInfo.isProcessed && (!window._confirmedProcessedReceipts || !window._confirmedProcessedReceipts.has(doc.toLowerCase()))) {
            showReceiptProcessedWarningModal({
              docNo: doc,
              pageContext: currentContext,
              processedInfo: procInfo,
              sapRecord: g,
              onConfirm: () => {
                applySapRecordToForm(g, formEl, currentContext);
              },
              onCancel: () => {
                inputEl.value = '';
                resetSapSelection();
              }
            });
          } else {
            applySapRecordToForm(g, formEl, currentContext);
          }
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
   * @param {string} [pageContext]
   */
  async function applySapRecordToForm(sapRecord, formEl, pageContext) {
    if (!sapRecord || !formEl) return;

    const currentContext = detectCurrentPageContext(pageContext);
    const rules = SAP_PAGE_RULES[currentContext] || SAP_PAGE_RULES['xg-nhap'];

    window._currentSelectedSapRecord = sapRecord;

    // Helper tìm input theo text label
    const findInputByLabel = (labelPattern) => {
      const labels = formEl.querySelectorAll('label');
      for (const lbl of labels) {
        if (lbl.textContent.trim().toLowerCase().includes(labelPattern.toLowerCase())) {
          const parent = lbl.parentElement;
          if (parent) {
            const input = parent.querySelector('input, select');
            if (input) return input;
          }
        }
      }
      return null;
    };

    // 1. Mã chứng từ mặc định theo hướng (MN cho Nhập, PX cho Xuất)
    const targetDocType = rules.defaultDocType || 'MN';
    const maChungTuSelect = formEl.querySelector('select[name="col_1"]');
    if (maChungTuSelect) {
      let optionExists = false;
      for (let i = 0; i < maChungTuSelect.options.length; i++) {
        if (maChungTuSelect.options[i].value === targetDocType) {
          optionExists = true;
          break;
        }
      }
      if (!optionExists) {
        const opt = document.createElement('option');
        opt.value = targetDocType;
        opt.textContent = targetDocType;
        maChungTuSelect.appendChild(opt);
      }
      maChungTuSelect.value = targetDocType;
    }

    // 2. Ngày chứng từ: Posting Date (YYYY-MM-DD)
    const ngayInput = formEl.querySelector('input[name="col_2"]');
    if (ngayInput && sapRecord.posting_date) {
      ngayInput.value = sapRecord.posting_date;
    }

    // 3. Số phiếu: Material Document
    const phieuInput = formEl.querySelector('input[name="col_3"]');
    if (phieuInput) {
      phieuInput.value = sapRecord.material_document;
    }

    if (rules.direction === 'nhap') {
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
      const maCongTrinhInput = findInputByLabel('Mã công trình') ||
                               findInputByLabel('Mã dự án') ||
                               formEl.querySelector('input[name="add_ext_11"]') ||
                               formEl.querySelector('input[name="edit_ext_11"]') ||
                               formEl.querySelector('input[name="add_ext_12"]') ||
                               formEl.querySelector('input[name="edit_ext_12"]');
      if (maCongTrinhInput) {
        maCongTrinhInput.value = sapRecord.project_id || '';
      }

      // 9. Tên công trình: Project name
      const tenCongTrinhInput = findInputByLabel('Tên công trình') ||
                                findInputByLabel('Tên dự án') ||
                                formEl.querySelector('input[name="add_ext_12"]') ||
                                formEl.querySelector('input[name="edit_ext_12"]') ||
                                formEl.querySelector('input[name="add_ext_13"]') ||
                                formEl.querySelector('input[name="edit_ext_13"]');
      if (tenCongTrinhInput) {
        tenCongTrinhInput.value = sapRecord.project_name || '';
      }

      showAutofillToast(`Đã tự động điền thông tin phiếu SAP: ${sapRecord.material_document} (${sapRecord.material || ''})`);
    } else {
      // Hướng Xuất kho (xg-xuat, tole-xuat)
      const maCtInput = findInputByLabel('Mã công trình') ||
                        findInputByLabel('Mã CT') ||
                        formEl.querySelector('input[name="col_11"]') ||
                        formEl.querySelector('input[name="col_10"]');
      if (maCtInput && sapRecord.project_id) {
        maCtInput.value = sapRecord.project_id;
      }

      const tenCtInput = findInputByLabel('Tên công trình') ||
                         findInputByLabel('Tên CT') ||
                         formEl.querySelector('input[name="col_12"]') ||
                         formEl.querySelector('input[name="col_11"]');
      if (tenCtInput && sapRecord.project_name) {
        tenCtInput.value = sapRecord.project_name;
      }

      // Điền Loại xuất nếu có
      if (sapRecord.movement_type_text) {
        const loaiXuatSelect = formEl.querySelector('select[name="col_4"]');
        if (loaiXuatSelect) {
          const targetLower = sapRecord.movement_type_text.toLowerCase();
          let matched = false;
          for (const opt of loaiXuatSelect.options) {
            if (opt.value && (targetLower.includes(opt.value.toLowerCase()) || opt.value.toLowerCase().includes(targetLower))) {
              loaiXuatSelect.value = opt.value;
              matched = true;
              break;
            }
          }
          if (!matched && sapRecord.movement_type_text) {
            const customOpt = document.createElement('option');
            customOpt.value = sapRecord.movement_type_text;
            customOpt.textContent = sapRecord.movement_type_text;
            loaiXuatSelect.appendChild(customOpt);
            loaiXuatSelect.value = sapRecord.movement_type_text;
          }
        }
      }

      // Truy vấn tất cả các dòng của phiếu từ SAP MB51 để hỗ trợ xuất đa mặt hàng
      let allDocRows = [sapRecord];
      if (window.supabase && sapRecord.material_document) {
        try {
          const { data: docRows, error: docErr } = await window.supabase
            .from('xg_sap_mb51')
            .select('*')
            .eq('material_document', sapRecord.material_document);
          if (!docErr && Array.isArray(docRows) && docRows.length > 0) {
            allDocRows = docRows;
          }
        } catch (e) {
          console.warn('[XgSapLookup] Không thể truy vấn tất cả dòng của phiếu:', e);
        }
      }

      // Lọc các dòng hợp lệ với trang hiện tại
      const validRows = allDocRows.filter(r => {
        const chk = validateSapRecordAgainstContext(r, currentContext);
        return chk.isValid;
      });

      // Gom nhóm theo material + batch
      const itemsMap = new Map();
      validRows.forEach(r => {
        const mat = String(r.material || '').trim();
        const batch = String(r.batch || '').trim();
        const key = `${mat}__${batch}`;
        const rawQty = Math.abs(parseFloat(r.quantity) || 0);

        if (!itemsMap.has(key)) {
          itemsMap.set(key, {
            maVatTu: mat,
            tenVatTu: r.material_description || '',
            batch: batch,
            totalSapKg: rawQty
          });
        } else {
          itemsMap.get(key).totalSapKg += rawQty;
        }
      });
      const itemsGrouped = Array.from(itemsMap.values());

      const headerInfo = {
        maChungTu: 'PX',
        ngayXuat: sapRecord.posting_date || '',
        phieuXuat: sapRecord.material_document || '',
        loaiXuat: sapRecord.movement_type_text || '',
        maCongTrinh: sapRecord.project_id || '',
        tenCongTrinh: sapRecord.project_name || ''
      };

      if (typeof window.populateExportReceiptData === 'function') {
        await window.populateExportReceiptData(headerInfo, itemsGrouped);
      } else {
        // Fallback điền vào thẻ mặt hàng đầu tiên nếu có
        const multiItems = window.multiItemsData;
        if (Array.isArray(multiItems) && multiItems.length > 0) {
          const firstItem = multiItems[0];
          if (sapRecord.material) firstItem.maVatTu = sapRecord.material;
          if (sapRecord.material_description) firstItem.tenVatTu = sapRecord.material_description;
          if (sapRecord.batch) firstItem.batch = sapRecord.batch;
          if (typeof window.renderItemCards === 'function') {
            window.renderItemCards();
          }
        }
        showAutofillToast(`Đã tự động điền thông tin phiếu SAP: ${sapRecord.material_document} (${sapRecord.material || ''})`);
      }
    }

    // Cập nhật lại đối chiếu khối lượng cuộn vs SAP nếu có
    if (typeof window.updateRollTotals === 'function') {
      window.updateRollTotals();
    } else if (typeof window.updateEditRollTotals === 'function' && formEl.id === 'editDataForm') {
      window.updateEditRollTotals();
    }
  }

  /**
   * Cập nhật dòng hiển thị đối chiếu khối lượng trong bảng cuộn và kiểm soát nút Thêm/Cập nhật
   * @param {number} totalRollKg - Tổng kg cuộn người dùng đã nhập
   * @param {boolean} [isEdit=false] - Cờ xác định modal sửa hay thêm
   */
  function updateSapReconciliationDisplay(totalRollKg, isEdit = false) {
    const rowId = isEdit ? 'editSapReconciliationRow' : 'sapReconciliationRow';
    const kgDisplayId = isEdit ? 'editTotalSapKgDisplay' : 'totalSapKgDisplay';
    const badgeId = isEdit ? 'editSapReconciliationBadge' : 'sapReconciliationBadge';
    const submitBtn = isEdit
      ? (document.getElementById('btnEditDataSubmit') || document.querySelector('#editDataForm button[type="submit"]'))
      : (document.getElementById('btnAddDataSubmit') || document.querySelector('#addDataForm button[type="submit"]'));

    const sapRow = document.getElementById(rowId);
    if (!sapRow) return;

    const sapRecord = window._currentSelectedSapRecord;
    if (!sapRecord || typeof sapRecord.total_quantity !== 'number') {
      sapRow.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.title = '';
      }
      return;
    }

    sapRow.style.display = '';

    const sapKg = sapRecord.total_quantity;
    const diff = Math.round((totalRollKg - sapKg) * 100) / 100;
    const absDiff = Math.abs(diff);

    const sapKgEl = document.getElementById(kgDisplayId);
    const badgeEl = document.getElementById(badgeId);

    if (sapKgEl) {
      sapKgEl.textContent = sapKg.toLocaleString('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
      }) + ' kg';
    }

    const actionText = isEdit ? 'cập nhật' : 'thêm';

    // Nút Thêm/Cập nhật vẫn bấm được, nếu chưa khớp sẽ mở modal cảnh báo khi bấm
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.title = '';
    }

    if (badgeEl) {
      if (totalRollKg === 0) {
        badgeEl.className = 'badge bg-secondary py-1 px-2';
        badgeEl.innerHTML = `<i class="bi bi-clock me-1"></i>Chờ nhập kg cuộn`;
      } else if (absDiff < 0.05) {
        badgeEl.className = 'badge bg-success py-1 px-2';
        badgeEl.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>Khớp 100% (0 kg)`;
      } else if (diff > 0) {
        badgeEl.className = 'badge bg-warning text-dark py-1 px-2';
        badgeEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i>Lệch: +${diff.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg (Cuộn > SAP)`;
      } else {
        badgeEl.className = 'badge bg-danger py-1 px-2';
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
    const editSapRow = document.getElementById('editSapReconciliationRow');
    if (editSapRow) editSapRow.style.display = 'none';

    const addBtn = document.getElementById('btnAddDataSubmit') || document.querySelector('#addDataForm button[type="submit"]');
    if (addBtn) {
      addBtn.disabled = false;
      addBtn.title = '';
    }
    const editBtn = document.getElementById('btnEditDataSubmit') || document.querySelector('#editDataForm button[type="submit"]');
    if (editBtn) {
      editBtn.disabled = false;
      editBtn.title = '';
    }
  }

  /**
   * Kiểm tra xem đang có phiếu SAP được chọn hay không
   * @returns {boolean}
   */
  function isSapActive() {
    return !!(window._currentSelectedSapRecord && typeof window._currentSelectedSapRecord.total_quantity === 'number');
  }

  /**
   * Kiểm tra tính hợp lệ về khối lượng so với SAP
   * @param {number} totalRollKg
   * @param {boolean} [isEdit=false]
   * @returns {{ valid: boolean, message?: string, modalHtml?: string, diff?: number, sapKg?: number }}
   */
  function validateSapMatch(totalRollKg, isEdit = false) {
    // Cảnh báo chỉ áp dụng với thêm mới dữ liệu, không áp dụng khi sửa/cập nhật dữ liệu
    if (isEdit) {
      return { valid: true };
    }

    const sapRecord = window._currentSelectedSapRecord;
    if (!sapRecord || typeof sapRecord.total_quantity !== 'number') {
      return { valid: true };
    }

    const sapKg = sapRecord.total_quantity;
    const diff = Math.round((totalRollKg - sapKg) * 100) / 100;
    const absDiff = Math.abs(diff);
    const actionText = isEdit ? 'cập nhật' : 'thêm';
    const ActionText = isEdit ? 'CẬP NHẬT' : 'THÊM';

    if (totalRollKg === 0) {
      const msg = `⚠️ Chưa nhập số kg cho danh sách cuộn!\n\nSố kg SAP yêu cầu: ${sapKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} kg.\nVui lòng nhập đúng và đủ số kg để khớp 100% trước khi ${actionText}.`;
      const modalHtml = `
        <div class="text-start">
          <div class="alert alert-danger border-0 mb-3 d-flex align-items-center gap-3 py-3 px-3 rounded-3" style="background: rgba(220, 53, 69, 0.25);">
            <i class="bi bi-x-octagon-fill fs-2 text-danger flex-shrink-0"></i>
            <div>
              <div class="fw-bold fs-5 text-white">KHÔNG CHO PHÉP ${ActionText} DỮ LIỆU!</div>
              <div class="text-white-50 small">Bạn chưa nhập số kg cho các cuộn. Hệ thống yêu cầu phải nhập đầy đủ và khớp 100% với SAP.</div>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-sm-6">
              <div class="card h-100 border-0" style="background: rgba(13, 110, 253, 0.15); border: 1px solid rgba(13, 110, 253, 0.3) !important; border-radius: 12px;">
                <div class="card-body p-3 text-center">
                  <div class="text-white-50 small text-uppercase fw-semibold mb-1">
                    <i class="bi bi-receipt me-1"></i>Tổng kg SAP yêu cầu
                  </div>
                  <div class="fs-2 fw-bold text-info">
                    ${sapKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} <span class="fs-6 text-white-50">kg</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="card h-100 border-0" style="background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.15) !important; border-radius: 12px;">
                <div class="card-body p-3 text-center">
                  <div class="text-white-50 small text-uppercase fw-semibold mb-1">
                    <i class="bi bi-boxes me-1"></i>Tổng kg cuộn đã nhập
                  </div>
                  <div class="fs-2 fw-bold text-white">
                    0 <span class="fs-6 text-white-50">kg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="p-3 rounded-3 mb-3 text-center" style="background: rgba(220, 53, 69, 0.18); border: 1px solid rgba(220, 53, 69, 0.4);">
            <div class="small fw-semibold text-danger text-uppercase">
              <i class="bi bi-exclamation-diamond-fill me-1"></i> Trạng thái kiểm tra:
            </div>
            <div class="fs-4 fw-bold text-danger mt-1">
              CHƯA NHẬP SỐ KG CUỘN
            </div>
            <div class="small text-white mt-1">
              Cần nhập đủ <strong>${sapKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} kg</strong> để khớp hoàn toàn với phiếu SAP.
            </div>
          </div>

          <div class="card border-0 mb-3" style="background: rgba(255, 255, 255, 0.05); border-radius: 10px;">
            <div class="card-body p-3 small">
              <div class="row g-2">
                <div class="col-sm-6 d-flex justify-content-between">
                  <span class="text-white-50">Phiếu nhập:</span>
                  <span class="fw-bold text-white">${escapeHtml(sapRecord.material_document)}</span>
                </div>
                <div class="col-sm-6 d-flex justify-content-between">
                  <span class="text-white-50">Batch:</span>
                  <span class="fw-bold text-white">${escapeHtml(sapRecord.batch || 'N/A')}</span>
                </div>
                <div class="col-12 d-flex justify-content-between border-top border-secondary pt-2 mt-2">
                  <span class="text-white-50">Vật tư:</span>
                  <span class="fw-bold text-white text-truncate ms-2" title="${escapeHtml(sapRecord.material_description)}">${escapeHtml(sapRecord.material)} - ${escapeHtml(sapRecord.material_description)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="p-3 rounded-3 text-warning small d-flex align-items-center gap-2" style="background: rgba(255, 193, 7, 0.12); border: 1px solid rgba(255, 193, 7, 0.25);">
            <i class="bi bi-shield-exclamation fs-4 flex-shrink-0 text-warning"></i>
            <div>
              <strong>Quy tắc hệ thống:</strong> Chỉ khi khớp hoàn toàn số kg mới được phép ${actionText}!
            </div>
          </div>
        </div>
      `;
      return {
        valid: false,
        message: msg,
        modalHtml,
        diff: -sapKg,
        sapKg
      };
    }

    if (absDiff >= 0.05) {
      const isSurplus = diff > 0;
      const loaiLechText = isSurplus
        ? `Lệch dư (+${diff.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg - Cuộn > SAP)`
        : `Lệch thiếu (${diff.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg - Cuộn < SAP)`;

      const msg = `⚠️ KHÔNG THỂ ${ActionText} DỮ LIỆU!\n\n- Tổng kg cuộn đã nhập: ${totalRollKg.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg\n- Tổng kg SAP: ${sapKg.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg\n- Trạng thái: ${loaiLechText}\n\nTheo quy định, lệnh dư hoặc thiếu đều không được phép ${actionText}!`;

      const modalHtml = `
        <div class="text-start">
          <div class="alert alert-danger border-0 mb-3 d-flex align-items-center gap-3 py-3 px-3 rounded-3" style="background: rgba(220, 53, 69, 0.25);">
            <i class="bi bi-x-octagon-fill fs-2 text-danger flex-shrink-0"></i>
            <div>
              <div class="fw-bold fs-5 text-white">KHÔNG CHO PHÉP ${ActionText} DỮ LIỆU!</div>
              <div class="text-white-50 small">Số kg các cuộn thực nhập <strong>chưa khớp hoàn toàn</strong> với số lượng trên phiếu SAP MB51.</div>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-sm-6">
              <div class="card h-100 border-0" style="background: rgba(13, 110, 253, 0.15); border: 1px solid rgba(13, 110, 253, 0.3) !important; border-radius: 12px;">
                <div class="card-body p-3 text-center">
                  <div class="text-white-50 small text-uppercase fw-semibold mb-1">
                    <i class="bi bi-receipt me-1"></i>Tổng kg SAP yêu cầu
                  </div>
                  <div class="fs-2 fw-bold text-info">
                    ${sapKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} <span class="fs-6 text-white-50">kg</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="card h-100 border-0" style="background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.15) !important; border-radius: 12px;">
                <div class="card-body p-3 text-center">
                  <div class="text-white-50 small text-uppercase fw-semibold mb-1">
                    <i class="bi bi-boxes me-1"></i>Tổng kg cuộn đã nhập
                  </div>
                  <div class="fs-2 fw-bold text-white">
                    ${totalRollKg.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} <span class="fs-6 text-white-50">kg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="p-3 rounded-3 mb-3 text-center" style="background: ${isSurplus ? 'rgba(255, 193, 7, 0.18)' : 'rgba(220, 53, 69, 0.18)'}; border: 1px solid ${isSurplus ? 'rgba(255, 193, 7, 0.4)' : 'rgba(220, 53, 69, 0.4)'};">
            <div class="small fw-semibold ${isSurplus ? 'text-warning' : 'text-danger'} text-uppercase">
              <i class="bi bi-exclamation-diamond-fill me-1"></i> Mức độ chênh lệch:
            </div>
            <div class="fs-3 fw-bold ${isSurplus ? 'text-warning' : 'text-danger'} mt-1">
              ${isSurplus ? '+' : ''}${diff.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg
            </div>
            <div class="small text-white mt-1 fw-medium">
              Trạng thái: <strong>${isSurplus ? 'LỆCH DƯ (Cuộn > SAP)' : 'LỆCH THIẾU (Cuộn < SAP)'}</strong>
            </div>
          </div>

          <div class="card border-0 mb-3" style="background: rgba(255, 255, 255, 0.05); border-radius: 10px;">
            <div class="card-body p-3 small">
              <div class="row g-2">
                <div class="col-sm-6 d-flex justify-content-between">
                  <span class="text-white-50">Phiếu nhập:</span>
                  <span class="fw-bold text-white">${escapeHtml(sapRecord.material_document)}</span>
                </div>
                <div class="col-sm-6 d-flex justify-content-between">
                  <span class="text-white-50">Batch:</span>
                  <span class="fw-bold text-white">${escapeHtml(sapRecord.batch || 'N/A')}</span>
                </div>
                <div class="col-12 d-flex justify-content-between border-top border-secondary pt-2 mt-2">
                  <span class="text-white-50">Vật tư:</span>
                  <span class="fw-bold text-white text-truncate ms-2" title="${escapeHtml(sapRecord.material_description)}">${escapeHtml(sapRecord.material)} - ${escapeHtml(sapRecord.material_description)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="p-3 rounded-3 text-warning small d-flex align-items-center gap-2" style="background: rgba(255, 193, 7, 0.12); border: 1px solid rgba(255, 193, 7, 0.25);">
            <i class="bi bi-shield-exclamation fs-4 flex-shrink-0 text-warning"></i>
            <div>
              <strong>Quy tắc hệ thống:</strong> Lệnh dư hoặc thiếu đều không được phép thêm. Vui lòng kiểm tra và điều chỉnh lại số kg các cuộn sao cho <strong>khớp hoàn toàn 100% (lệch = 0 kg)</strong> để được thêm!
            </div>
          </div>
        </div>
      `;

      return {
        valid: false,
        message: msg,
        modalHtml,
        diff,
        sapKg
      };
    }

    return { valid: true, diff, sapKg };
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
        border: 1px solid #d1d5db;
        border-radius: 10px;
        overflow: hidden;
        display: none;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        max-width: 520px;
      }
      [data-bs-theme="dark"] .sap-autocomplete-dropdown {
        background: #18181b;
        border-color: #3f3f46;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      }
      .sap-dropdown-item {
        cursor: pointer;
        transition: background-color 0.15s ease-in-out;
      }
      .sap-dropdown-item:hover, .sap-dropdown-item.active {
        background-color: #e9f3ff;
      }
      [data-bs-theme="dark"] .sap-dropdown-item:hover, [data-bs-theme="dark"] .sap-dropdown-item.active {
        background-color: #27272a;
      }

      /* Styles cho cảnh báo phiếu không phù hợp - Thân thiện & Dễ đọc */
      .sap-doc-warning {
        padding: 14px 16px;
        background: #fffbeb;
        color: #1e293b;
        font-family: inherit;
        text-align: left;
      }
      [data-bs-theme="dark"] .sap-doc-warning {
        background: #1c1917;
        color: #f1f5f9;
      }
      .sap-warning-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 13.5px;
        color: #b45309;
        margin-bottom: 6px;
      }
      [data-bs-theme="dark"] .sap-warning-header {
        color: #fbbf24;
      }
      .sap-warning-summary {
        font-size: 12.5px;
        color: #475569;
        margin-bottom: 10px;
        line-height: 1.4;
      }
      [data-bs-theme="dark"] .sap-warning-summary {
        color: #cbd5e1;
      }
      .sap-warning-card {
        background: #ffffff;
        border: 1px solid #fde68a;
        border-radius: 8px;
        padding: 9px 12px;
        margin-bottom: 9px;
        font-size: 12.5px;
        line-height: 1.6;
        color: #334155;
      }
      [data-bs-theme="dark"] .sap-warning-card {
        background: #262117;
        border-color: #5c4314;
        color: #e2e8f0;
      }
      .sap-warning-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }
      .sap-warning-row:last-child {
        margin-bottom: 0;
      }
      .sap-warning-label {
        font-weight: 600;
        color: #475569;
        min-width: 105px;
      }
      [data-bs-theme="dark"] .sap-warning-label {
        color: #94a3b8;
      }
      .sap-warning-subtext {
        font-size: 11.5px;
        color: #64748b;
      }
      [data-bs-theme="dark"] .sap-warning-subtext {
        color: #94a3b8;
      }
      .sap-warning-desc {
        max-width: 320px;
      }
      .sap-tag {
        display: inline-block;
        padding: 1px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.4;
      }
      .sap-tag-warning {
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fde68a;
      }
      [data-bs-theme="dark"] .sap-tag-warning {
        background: #451a03;
        color: #fde68a;
        border-color: #78350f;
      }
      .sap-tag-info {
        background: #e0f2fe;
        color: #0369a1;
        border: 1px solid #bae6fd;
      }
      [data-bs-theme="dark"] .sap-tag-info {
        background: #082f49;
        color: #7dd3fc;
        border-color: #0369a1;
      }
      .sap-warning-suggestion {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 12px;
        color: #166534;
        line-height: 1.45;
        margin-bottom: 8px;
      }
      [data-bs-theme="dark"] .sap-warning-suggestion {
        background: #052e16;
        border-color: #14532d;
        color: #86efac;
      }
      .sap-warning-link {
        color: #15803d;
        text-decoration: none;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        transition: color 0.15s ease;
      }
      .sap-warning-link:hover {
        color: #166534;
        text-decoration: underline;
      }
      [data-bs-theme="dark"] .sap-warning-link {
        color: #4ade80;
      }
      [data-bs-theme="dark"] .sap-warning-link:hover {
        color: #86efac;
      }
      .sap-warning-rule {
        font-size: 11.5px;
        color: #64748b;
        line-height: 1.45;
        padding-top: 4px;
        border-top: 1px dashed #e2e8f0;
      }
      [data-bs-theme="dark"] .sap-warning-rule {
        color: #94a3b8;
        border-top-color: #3f3f46;
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
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectSapLookupStyles);
    } else {
      injectSapLookupStyles();
    }
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
        const matGroup = getVal(row[4]);
        const mat = getVal(row[5]);
        const matDesc = getVal(row[6]);
        const batch = getVal(row[7]);
        const dcInd = getVal(row[15]) ? getVal(row[15]).toUpperCase() : null;

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
            raw_data: {
              material_group: matGroup,
              debit_credit_ind: dcInd
            },
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
              raw_data: {
                material_group: matGroup,
                debit_credit_ind: dcInd
              },
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

  // Export các hàm và quy tắc ra window
  window.XgSapLookup = {
    SAP_PAGE_RULES,
    detectCurrentPageContext,
    extractSapRowAttributes,
    validateSapRecordAgainstContext,
    checkReceiptProcessed,
    showReceiptProcessedWarningModal,
    querySapMb51,
    groupSapMb51Rows,
    initSapDocumentAutocomplete,
    applySapRecordToForm,
    updateSapReconciliationDisplay,
    resetSapSelection,
    isSapActive,
    validateSapMatch,
    syncFromGoogleSheets,
    showAutofillToast
  };

  // Hỗ trợ module.exports trong môi trường Node.js (cho unit test)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.XgSapLookup;
  }

})();
