/* =============================================================================
   SUPABASE CONFIGURATION
   Cấu hình kết nối Supabase - chỉnh sửa file này để cập nhật thông tin kết nối
================================================================================ */

// ⚠️ THAY THẾ các giá trị dưới đây bằng thông tin Supabase của bạn
// Lấy từ: Supabase Dashboard → Settings → API

const SUPABASE_URL = 'https://ahcethtonjwktjtmxzog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zxmsB9cyjDwi9ai9Vw-s1w_QlqKMG0S';

// Lưu library vào biến tạm, sau đó ghi đè window.supabase bằng client
// để tất cả JS files sau có thể dùng: supabase.from(...)
const _supabaseLib = window.supabase;
window.supabase = _supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Checks if a Supabase data record was created over 24 hours ago.
 * @param {Object} record - Raw record object from Supabase.
 * @returns {boolean} True if locked (> 24h old), false otherwise.
 */
function isRecordLocked(record) {
  if (!record) return false;
  const createdAtStr = record.created_at || record.createdAt || record.created_Time;
  if (!createdAtStr) return false;
  
  const createdTime = new Date(createdAtStr).getTime();
  if (isNaN(createdTime)) return false;
  
  const LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  return (Date.now() - createdTime) > LOCK_DURATION_MS;
}

if (typeof window !== 'undefined') {
  window.isRecordLocked = isRecordLocked;
}

/**
 * Displays a centered warning modal popup on screen.
 * @param {string} message - Warning message content.
 * @param {string} [title='Cảnh báo hệ thống'] - Modal title.
 */
function showWarningModal(message, title = 'Cảnh báo hệ thống') {
  let modalEl = document.getElementById('globalWarningModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'globalWarningModal';
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.style.zIndex = '10070';
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg border-0" style="border-radius: 16px; overflow: hidden; background: #2b3553; color: #ffffff;">
          <div class="modal-header border-0 py-3" style="background: rgba(255, 193, 7, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;">
            <h5 class="modal-title fw-bold d-flex align-items-center gap-2 mb-0 text-white" style="color: #ffffff !important;">
              <span style="font-size: 1.3rem;">⚠️</span> ${title}
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body py-4 px-4 fs-6 text-white" id="globalWarningModalBody" style="line-height: 1.6; color: #ffffff !important; font-weight: 500; white-space: pre-wrap; text-align: left; max-height: 350px; overflow-y: auto;">
          </div>
          <div class="modal-footer border-0 justify-content-center pt-0 pb-3">
            <button type="button" class="btn btn-warning px-4 py-2 fw-bold rounded-3 text-dark shadow-sm" data-bs-dismiss="modal">
              Đã hiểu
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  const bodyEl = modalEl.querySelector('#globalWarningModalBody');
  if (bodyEl) bodyEl.textContent = message;

  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  } else {
    alert(message);
  }
}

if (typeof window !== 'undefined') {
  window.showWarningModal = showWarningModal;
}


