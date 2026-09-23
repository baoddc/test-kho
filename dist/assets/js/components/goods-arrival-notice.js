/**
 * =============================================================================
 * GOODS ARRIVAL NOTICE COMPONENT (Thông báo hàng về kho)
 * Gom nhóm hàng nhập từ xg-nhap và tole-nhap theo Tên công trình & Tồn trơn
 * Đẩy hoặc cập nhật thông báo lên system_announcements trên Supabase
 * =============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GoodsArrivalNotice = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- CORE ENGINE FUNCTIONS (Dùng chung cả Node.js test & Browser) ---

  function parseNumeric(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim().replace(/\s+/g, '');
    if (!s) return 0;
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      // "26,770" -> kiểm tra xem có phải hàng nghìn không hay số thập phân
      const parts = s.split(',');
      if (parts.length === 2 && parts[1].length === 3) {
        // Nhiều khả năng 26,770 là 26.77 nếu phân tách thập phân, hoặc hàng nghìn
        s = s.replace(',', '.');
      } else {
        s = parts.length === 2 ? `${parts[0]}.${parts[1]}` : s.replace(/,/g, '');
      }
    } else if (hasDot) {
      const parts = s.split('.');
      if (parts.length === 2 && parts[1].length === 3) {
        // Dấu chấm phân tách hàng nghìn (ví dụ 7.712 -> 7712)
        s = s.replace(/\./g, '');
      }
    }
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  }

  function generateArrivalTitle(dateStr) {
    if (!dateStr) return 'Hàng về kho';
    let dd = '', mm = '';
    const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      dd = isoMatch[3];
      mm = isoMatch[2];
    } else {
      const ddmmyyyy = String(dateStr).match(/^(\d{1,2})[\/\-](\d{1,2})/);
      if (ddmmyyyy) {
        dd = String(ddmmyyyy[1]).padStart(2, '0');
        mm = String(ddmmyyyy[2]).padStart(2, '0');
      }
    }
    if (dd && mm) return `Hàng về kho ngày ${dd}/${mm}`;
    return 'Hàng về kho';
  }

  function groupArrivalData(rows) {
    const typeMap = {
      XG: new Map(),
      TOLE: new Map()
    };

    (rows || []).forEach(row => {
      const isTole = (row._sourceType === 'TOLE' || row.kho === 'TOLE' || row.kho === 'Tole');
      const typeKey = isTole ? 'TOLE' : 'XG';

      let proj = String(row['Tên công trình'] || '').trim();
      if (!proj) proj = 'Tồn trơn';

      let mat = String(row['Tên vật tư'] || row['Mã vật tư'] || 'Vật tư khác').trim();
      let kg = parseNumeric(row['Số lượng (Kg)']);

      const projectMap = typeMap[typeKey];
      if (!projectMap.has(proj)) {
        projectMap.set(proj, new Map());
      }
      const matMap = projectMap.get(proj);
      matMap.set(mat, (matMap.get(mat) || 0) + kg);
    });

    return typeMap;
  }

  function formatAnnouncementContent(groupedData) {
    if (!groupedData) return '';

    let xgMap = null;
    let toleMap = null;
    if (groupedData instanceof Map) {
      xgMap = groupedData;
    } else {
      xgMap = groupedData.XG;
      toleMap = groupedData.TOLE;
    }

    const formatProjectMap = (projectMap) => {
      if (!projectMap || projectMap.size === 0) return [];
      const sections = [];
      const sortedProjects = Array.from(projectMap.keys()).sort((a, b) => {
        if (a === 'Tồn trơn') return 1;
        if (b === 'Tồn trơn') return -1;
        return a.localeCompare(b, 'vi');
      });

      for (const proj of sortedProjects) {
        const matMap = projectMap.get(proj);
        const lines = [`[${proj}]`];
        for (const [mat, totalKg] of matMap.entries()) {
          const kgStr = totalKg.toLocaleString('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
          });
          lines.push(`${mat}: ${kgStr}kg`);
        }
        sections.push(lines.join('\n'));
      }
      return sections;
    };

    const blocks = [];
    const hasXg = xgMap && xgMap.size > 0;
    const hasTole = toleMap && toleMap.size > 0;

    if (hasXg && hasTole) {
      const xgSections = formatProjectMap(xgMap);
      if (xgSections.length > 0) {
        blocks.push(`XÀ GỒ:\n` + xgSections.join('\n\n'));
      }
      const toleSections = formatProjectMap(toleMap);
      if (toleSections.length > 0) {
        blocks.push(`TOLE:\n` + toleSections.join('\n\n'));
      }
    } else if (hasXg) {
      const xgSections = formatProjectMap(xgMap);
      if (xgSections.length > 0) {
        blocks.push(`XÀ GỒ:\n` + xgSections.join('\n\n'));
      }
    } else if (hasTole) {
      const toleSections = formatProjectMap(toleMap);
      if (toleSections.length > 0) {
        blocks.push(`TOLE:\n` + toleSections.join('\n\n'));
      }
    }

    return blocks.join('\n\n');
  }

  // --- BROWSER UI & SUPABASE INTEGRATION ---
  let isInitialized = false;
  let currentLoadedRows = [];
  let existingAnnouncementId = null;

  function ensureModalInDOM() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('modalGoodsArrivalNotice')) return;

    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal fade';
    modalDiv.id = 'modalGoodsArrivalNotice';
    modalDiv.tabIndex = -1;
    modalDiv.setAttribute('aria-labelledby', 'modalGoodsArrivalNoticeLabel');
    modalDiv.setAttribute('aria-hidden', 'true');

    modalDiv.innerHTML = `
      <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content shadow-lg border-0">
          <div class="modal-header bg-dark text-white py-3">
            <h5 class="modal-title d-flex align-items-center gap-2" id="modalGoodsArrivalNoticeLabel">
              <span class="fs-4">📢</span>
              <span>Thông báo Hàng về kho</span>
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="modal-body p-4" style="background: #f8fafc;">
            <!-- Bộ lọc ngày nhập & Trạng thái thông báo -->
            <div class="card mb-3 border-0 shadow-sm">
              <div class="card-body p-3">
                <div class="row g-3 align-items-center">
                  <div class="col-md-4">
                    <label class="form-label fw-bold text-secondary mb-1">
                      <i class="bi bi-calendar-date me-1"></i> Ngày hàng về kho:
                    </label>
                    <div class="input-group">
                      <input type="date" id="ganFilterDate" class="form-control fw-bold border-primary">
                      <button class="btn btn-primary" type="button" id="ganBtnReloadDate">
                        <i class="bi bi-arrow-repeat me-1"></i> Nạp dữ liệu
                      </button>
                    </div>
                  </div>
                  <div class="col-md-8">
                    <div id="ganStatusBanner" class="alert alert-secondary mb-0 py-2 px-3 d-flex align-items-center gap-2" style="font-size: 0.9rem;">
                      <i class="bi bi-info-circle-fill text-primary fs-5"></i>
                      <span id="ganStatusBannerText">Chọn ngày để nạp danh sách cuộn nhập kho từ Xà gồ và Tole.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bảng danh sách cuộn nhập trong ngày -->
            <div class="card mb-3 border-0 shadow-sm">
              <div class="card-header bg-white py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                  <span class="fw-bold text-dark">
                    <i class="bi bi-list-check me-1 text-primary"></i> Danh sách hàng nhập trong ngày
                  </span>
                  <span class="badge bg-primary rounded-pill" id="ganBadgeTotalRows">0 cuộn</span>
                  <span class="badge bg-success rounded-pill" id="ganBadgeSelectedCount">Đã chọn: 0 cuộn (0 kg)</span>
                </div>
                <div class="d-flex gap-2">
                  <button type="button" id="ganBtnSelectAll" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-check-all me-1"></i> Chọn tất cả
                  </button>
                  <button type="button" id="ganBtnDeselectAll" class="btn btn-sm btn-outline-secondary">
                    <i class="bi bi-square me-1"></i> Bỏ chọn
                  </button>
                </div>
              </div>
              <div class="card-body p-0">
                <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
                  <table class="table table-hover table-striped table-bordered align-middle mb-0" id="ganArrivalTable" style="font-size: 0.88rem;">
                    <thead class="table-light sticky-top" style="z-index: 2;">
                      <tr>
                        <th class="text-center" style="width: 45px;">
                          <input type="checkbox" id="ganTableSelectAll" class="form-check-input" checked title="Chọn/Bỏ chọn tất cả">
                        </th>
                        <th class="text-center" style="width: 75px;">Kho</th>
                        <th>Phiếu nhập</th>
                        <th>Tên vật tư</th>
                        <th>Cuộn ID</th>
                        <th class="text-end" style="width: 110px;">Số kg</th>
                        <th>Công trình</th>
                        <th>Vị trí</th>
                      </tr>
                    </thead>
                    <tbody id="ganTableBody">
                      <tr>
                        <td colspan="8" class="text-center py-4 text-muted">
                          <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                          Đang tải dữ liệu hàng về...
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Khung Live Preview Thông Báo (Chuẩn phong cách Thẻ Thông Báo của app) -->
            <div class="card border-0 shadow-sm" style="background: #0f172a; border-radius: 0.85rem;">
              <div class="card-header border-bottom border-secondary py-2 d-flex justify-content-between align-items-center" style="background: rgba(255, 255, 255, 0.03);">
                <div class="d-flex align-items-center gap-2">
                  <span class="badge" style="background: linear-gradient(135deg, #10b981, #059669); font-size: 0.8rem; padding: 4px 10px;">
                    📢 Thông báo chung
                  </span>
                  <span class="text-light fw-bold" style="font-size: 0.95rem;">Xem trước thông báo (Live Preview)</span>
                </div>
                <small class="text-secondary" style="font-size: 0.78rem;">Sẽ gửi tới toàn bộ người dùng khi Đăng</small>
              </div>
              <div class="card-body p-3" style="color: #f8fafc;">
                <div class="mb-2">
                  <div class="text-secondary small mb-1 fw-bold">Tiêu đề thông báo:</div>
                  <div id="ganPreviewTitle" class="fw-bold text-white fs-5" style="letter-spacing: 0.3px;">Hàng về kho ngày ...</div>
                </div>
                <div class="text-secondary small mb-1 fw-bold">Nội dung thông báo (Tự động phân nhóm công trình & cộng dồn kg):</div>
                <div id="ganPreviewContent" style="
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 0.5rem;
                  padding: 0.85rem 1rem;
                  font-size: 0.88rem;
                  line-height: 1.6;
                  white-space: pre-wrap;
                  color: #e2e8f0;
                  max-height: 220px;
                  overflow-y: auto;
                  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                ">(Chưa chọn dòng hàng nào để tạo thông báo)</div>
              </div>
            </div>
          </div>

          <div class="modal-footer bg-white border-top py-2 d-flex justify-content-between align-items-center">
            <div class="text-muted small" id="ganFooterNote">
              Hệ thống sẽ cập nhật nếu ngày này đã có thông báo trước đó.
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-secondary px-3" data-bs-dismiss="modal">Đóng</button>
              <button type="button" class="btn btn-success px-4 fw-bold shadow-sm d-flex align-items-center gap-2" id="ganBtnPublish">
                <i class="bi bi-send-fill"></i>
                <span id="ganBtnPublishText">Đăng thông báo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalDiv);
    bindModalEvents();
  }

  function getSupabaseClient() {
    if (typeof window !== 'undefined' && window.supabase) return window.supabase;
    return null;
  }

  function normalizeDateToISO(dateVal) {
    if (!dateVal) return '';
    const s = String(dateVal).trim();
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${String(ddmmyyyy[2]).padStart(2, '0')}-${String(ddmmyyyy[1]).padStart(2, '0')}`;
    }

    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return s;
  }

  function getLocalISODate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async function loadArrivalData(dateStr) {
    const supabase = getSupabaseClient();
    const tbody = document.getElementById('ganTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
          Đang nạp dữ liệu từ cả 2 bảng Xà gồ và Tole...
        </td>
      </tr>
    `;

    currentLoadedRows = [];
    existingAnnouncementId = null;

    if (!supabase) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Không kết nối được với Supabase!</td></tr>`;
      return;
    }

    try {
      // Chuẩn hóa chuỗi ngày tìm kiếm sang dạng chuẩn ISO YYYY-MM-DD
      const isoDate = normalizeDateToISO(dateStr);
      if (!isoDate) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">Vui lòng chọn ngày hợp lệ.</td></tr>`;
        return;
      }

      // Cột "Ngày nhập" trong DB là DATE type, PostgREST yêu cầu định dạng ISO YYYY-MM-DD
      const [xgRes, toleRes, annRes] = await Promise.all([
        supabase.from('xg-nhap').select('*').eq('Ngày nhập', isoDate).order('id', { ascending: false }).limit(500),
        supabase.from('tole-nhap').select('*').eq('Ngày nhập', isoDate).order('id', { ascending: false }).limit(500),
        supabase.from('system_announcements').select('*').order('created_at', { ascending: false }).limit(100)
      ]);

      if (xgRes.error) console.error('[GoodsArrivalNotice] xg-nhap query error:', xgRes.error);
      if (toleRes.error) console.error('[GoodsArrivalNotice] tole-nhap query error:', toleRes.error);
      if (annRes.error) console.error('[GoodsArrivalNotice] system_announcements query error:', annRes.error);

      const xgRows = (xgRes.data || []).map(r => ({ ...r, _sourceType: 'XG', _sourceLabel: 'Xà gồ' }));
      const toleRows = (toleRes.data || []).map(r => ({ ...r, _sourceType: 'TOLE', _sourceLabel: 'Tole' }));

      currentLoadedRows = [...xgRows, ...toleRows];

      // Kiểm tra xem ngày này đã có thông báo trên hệ thống chưa
      const expectedTitle = generateArrivalTitle(dateStr);
      const matchedAnn = (annRes.data || []).find(a => a.title && a.title.trim().toLowerCase() === expectedTitle.toLowerCase());
      
      const banner = document.getElementById('ganStatusBanner');
      const bannerText = document.getElementById('ganStatusBannerText');
      const publishBtnText = document.getElementById('ganBtnPublishText');

      if (matchedAnn) {
        existingAnnouncementId = matchedAnn.id;
        if (banner) {
          banner.className = 'alert alert-warning mb-0 py-2 px-3 d-flex align-items-center gap-2';
        }
        if (bannerText) {
          bannerText.innerHTML = `<strong>Đã có thông báo:</strong> "${matchedAnn.title}" trên hệ thống. Khi bấm Lưu sẽ <strong>Cập nhật</strong> nội dung mới.`;
        }
        if (publishBtnText) publishBtnText.textContent = 'Cập nhật thông báo';
      } else {
        existingAnnouncementId = null;
        if (banner) {
          banner.className = 'alert alert-info mb-0 py-2 px-3 d-flex align-items-center gap-2';
        }
        if (bannerText) {
          bannerText.innerHTML = `Chưa có thông báo cho ngày này. Bấm Đăng để <strong>Tạo thông báo mới</strong>.`;
        }
        if (publishBtnText) publishBtnText.textContent = 'Đăng thông báo';
      }

      renderTableRows(currentLoadedRows);
    } catch (err) {
      console.error('[GoodsArrivalNotice] Lỗi nạp dữ liệu:', err);
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Lỗi: ${err.message || err}</td></tr>`;
    }
  }

  function renderTableRows(rows) {
    const tbody = document.getElementById('ganTableBody');
    const badgeTotal = document.getElementById('ganBadgeTotalRows');
    if (badgeTotal) badgeTotal.textContent = `${rows.length} cuộn`;

    if (!tbody) return;
    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-muted">
            <i class="bi bi-box-seam fs-3 d-block mb-1"></i>
            Không tìm thấy cuộn hàng nào được nhập trong ngày này.
          </td>
        </tr>
      `;
      updateLivePreview([]);
      return;
    }

    tbody.innerHTML = rows.map((row, idx) => {
      const kg = parseNumeric(row['Số lượng (Kg)']);
      const kgFormatted = kg.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
      const proj = String(row['Tên công trình'] || '').trim();
      const projBadge = proj
        ? `<span class="badge bg-light text-dark border">${proj}</span>`
        : `<span class="badge bg-secondary opacity-75">Tồn trơn</span>`;
      const typeBadge = row._sourceType === 'XG'
        ? `<span class="badge bg-primary">Xà gồ</span>`
        : `<span class="badge bg-warning text-dark">Tole</span>`;

      return `
        <tr data-index="${idx}">
          <td class="text-center">
            <input type="checkbox" class="form-check-input gan-row-checkbox" data-index="${idx}" checked>
          </td>
          <td class="text-center">${typeBadge}</td>
          <td class="fw-semibold text-secondary">${row['Phiếu nhập'] || row['Mã chứng từ'] || '-'}</td>
          <td class="fw-bold text-dark">${row['Tên vật tư'] || row['Mã vật tư'] || '-'}</td>
          <td><code class="text-primary">${row['Cuộn ID'] || '-'}</code></td>
          <td class="text-end fw-bold">${kgFormatted} kg</td>
          <td>${projBadge}</td>
          <td class="text-muted small">${row['Vị trí'] || '-'}</td>
        </tr>
      `;
    }).join('');

    // Sau khi render bảng, tính toán preview mặc định (tất cả các dòng được tick)
    updateLivePreview(rows);
  }

  function getSelectedRows() {
    const checkboxes = document.querySelectorAll('.gan-row-checkbox:checked');
    const selected = [];
    checkboxes.forEach(cb => {
      const idx = parseInt(cb.getAttribute('data-index'), 10);
      if (currentLoadedRows[idx]) {
        selected.push(currentLoadedRows[idx]);
      }
    });
    return selected;
  }

  function updateLivePreview(selectedRows) {
    const dateInput = document.getElementById('ganFilterDate');
    const titleEl = document.getElementById('ganPreviewTitle');
    const contentEl = document.getElementById('ganPreviewContent');
    const badgeSelected = document.getElementById('ganBadgeSelectedCount');

    const dateVal = dateInput ? dateInput.value : '';
    const title = generateArrivalTitle(dateVal);

    if (titleEl) titleEl.textContent = title;

    let totalKg = 0;
    (selectedRows || []).forEach(r => {
      totalKg += parseNumeric(r['Số lượng (Kg)']);
    });

    if (badgeSelected) {
      const kgStr = totalKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
      badgeSelected.textContent = `Đã chọn: ${selectedRows.length} cuộn (${kgStr} kg)`;
    }

    if (!selectedRows || selectedRows.length === 0) {
      if (contentEl) contentEl.textContent = '(Chưa chọn dòng hàng nào để tạo thông báo)';
      return;
    }

    const grouped = groupArrivalData(selectedRows);
    const content = formatAnnouncementContent(grouped);
    if (contentEl) contentEl.textContent = content;
  }

  function bindModalEvents() {
    const modalEl = document.getElementById('modalGoodsArrivalNotice');
    if (!modalEl) return;

    // Nút Nạp dữ liệu ngày
    const btnReload = document.getElementById('ganBtnReloadDate');
    const dateInput = document.getElementById('ganFilterDate');
    if (btnReload && dateInput) {
      btnReload.onclick = () => {
        loadArrivalData(dateInput.value);
      };
      dateInput.onchange = () => {
        loadArrivalData(dateInput.value);
      };
    }

    // Chọn tất cả / Bỏ chọn tất cả buttons
    const btnSelectAll = document.getElementById('ganBtnSelectAll');
    const btnDeselectAll = document.getElementById('ganBtnDeselectAll');
    const headCheckAll = document.getElementById('ganTableSelectAll');

    function toggleAllCheckboxes(checked) {
      document.querySelectorAll('.gan-row-checkbox').forEach(cb => {
        cb.checked = checked;
      });
      if (headCheckAll) headCheckAll.checked = checked;
      updateLivePreview(getSelectedRows());
    }

    if (btnSelectAll) btnSelectAll.onclick = () => toggleAllCheckboxes(true);
    if (btnDeselectAll) btnDeselectAll.onclick = () => toggleAllCheckboxes(false);
    if (headCheckAll) headCheckAll.onchange = (e) => toggleAllCheckboxes(e.target.checked);

    // Sự kiện thay đổi checkbox từng dòng
    const tableBody = document.getElementById('ganTableBody');
    if (tableBody) {
      tableBody.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('gan-row-checkbox')) {
          updateLivePreview(getSelectedRows());
        }
      });
    }

    // Nút Đăng / Cập nhật thông báo
    const btnPublish = document.getElementById('ganBtnPublish');
    if (btnPublish) {
      btnPublish.onclick = async () => {
        await publishNotice();
      };
    }
  }

  async function publishNotice() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('Lỗi: Chưa kết nối Supabase SDK!');
      return;
    }

    const selectedRows = getSelectedRows();
    if (selectedRows.length === 0) {
      alert('⚠️ Vui lòng tick chọn ít nhất 1 cuộn hàng để tạo thông báo.');
      return;
    }

    const dateInput = document.getElementById('ganFilterDate');
    const dateVal = dateInput ? dateInput.value : '';
    const title = generateArrivalTitle(dateVal);

    const grouped = groupArrivalData(selectedRows);
    const content = formatAnnouncementContent(grouped);

    if (!content) {
      alert('⚠️ Nội dung thông báo trống, vui lòng kiểm tra lại dữ liệu.');
      return;
    }

    const btnPublish = document.getElementById('ganBtnPublish');
    const originalText = btnPublish ? btnPublish.innerHTML : '';
    if (btnPublish) {
      btnPublish.disabled = true;
      btnPublish.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang lưu...`;
    }

    try {
      const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || 'Kho';

      if (existingAnnouncementId) {
        // Cập nhật thông báo cũ
        const { error } = await supabase
          .from('system_announcements')
          .update({
            content: content,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .eq('id', existingAnnouncementId);

        if (error) throw error;
      } else {
        // Thêm thông báo mới
        const { error } = await supabase
          .from('system_announcements')
          .insert([{
            title: title,
            content: content,
            type: 'info',
            is_active: true,
            created_by: currentUser
          }]);

        if (error) throw error;
      }

      alert('✅ Đã đăng thông báo Hàng về kho thành công! Toàn bộ người dùng sẽ thấy thông báo này.');

      // Đóng modal
      const modalEl = document.getElementById('modalGoodsArrivalNotice');
      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
      }

      // Làm mới chuông thông báo nếu có update-checker
      if (typeof window.checkUpdate === 'function') {
        window.checkUpdate();
      }
    } catch (err) {
      console.error('[GoodsArrivalNotice] Lỗi đăng thông báo:', err);
      alert('❌ Lỗi khi đăng thông báo: ' + (err.message || err));
    } finally {
      if (btnPublish) {
        btnPublish.disabled = false;
        btnPublish.innerHTML = originalText;
      }
    }
  }

  function open(defaultDate) {
    if (typeof document === 'undefined') return;
    ensureModalInDOM();

    const dateInput = document.getElementById('ganFilterDate');
    const todayStr = getLocalISODate();

    let autoDate = defaultDate;
    if (!autoDate) {
      if (typeof selectedRowIndex !== 'undefined' && selectedRowIndex >= 0 && typeof tableData !== 'undefined' && tableData[selectedRowIndex]) {
        const row = tableData[selectedRowIndex];
        const dateIdx = typeof COLUMN_HEADERS !== 'undefined' ? COLUMN_HEADERS.indexOf('Ngày nhập') : 2;
        if (dateIdx >= 0 && row[dateIdx]) {
          autoDate = normalizeDateToISO(row[dateIdx]);
        }
      }
    }

    const targetDate = autoDate || (dateInput && dateInput.value) || todayStr;
    const finalIso = normalizeDateToISO(targetDate) || todayStr;

    if (dateInput) {
      dateInput.value = finalIso;
    }

    const modalEl = document.getElementById('modalGoodsArrivalNotice');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modalInstance.show();
    }

    loadArrivalData(finalIso);
  }

  if (typeof document !== 'undefined') {
    const bindBtn = () => {
      const btn = document.getElementById('btnGoodsNotice');
      if (btn && !btn.dataset.ganBound) {
        btn.dataset.ganBound = 'true';
        btn.addEventListener('click', () => open());
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindBtn);
    } else {
      bindBtn();
    }
  }

  return {
    generateArrivalTitle,
    groupArrivalData,
    formatAnnouncementContent,
    parseNumeric,
    open,
    loadArrivalData
  };
}));
