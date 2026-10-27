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
/**
 * Lấy hồ sơ người dùng đã xác thực từ Supabase Auth session
 */
// Khóa localStorage nơi supabase-js lưu phiên đăng nhập (dùng chung cho mọi tab)
const SUPABASE_AUTH_STORAGE_KEY = 'sb-' + SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0] + '-auth-token';

/**
 * ID người dùng của phiên Supabase Auth hiện tại (đọc đồng bộ từ localStorage).
 */
function getSessionUserId() {
  try {
    const raw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return (s && s.user && s.user.id) ||
      (s && s.currentSession && s.currentSession.user && s.currentSession.user.id) || null;
  } catch (e) {
    return null;
  }
}

function getCachedUserProfile() {
  try {
    const raw = sessionStorage.getItem('supabase_user_profile') || localStorage.getItem('supabase_user_profile');
    if (!raw) return null;
    const profile = JSON.parse(raw);
    // Hồ sơ được cache THEO TỪNG TAB, còn phiên đăng nhập DÙNG CHUNG mọi tab. Nếu tab khác đã
    // đăng nhập tài khoản khác thì bỏ hồ sơ cũ, tránh hiện nút/quyền của người khác.
    const sessionUserId = getSessionUserId();
    if (!profile || !sessionUserId || profile.id !== sessionUserId) return null;
    return profile;
  } catch (e) {}
  return null;
}

/**
 * Đồng bộ hồ sơ người dùng từ Supabase Auth & public.user_profiles
 */
async function syncUserProfile() {
  if (!window.supabase?.auth) return null;
  try {
    const { data: { session }, error: sessionErr } = await window.supabase.auth.getSession();
    if (!session?.user) return null;

    const { data: profile, error } = await window.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile) {
      sessionStorage.setItem('supabase_user_profile', JSON.stringify(profile));
      localStorage.setItem('currentUser', profile.username);
      return profile;
    }
  } catch (e) {
    console.warn('Lỗi đồng bộ hồ sơ user:', e);
  }
  return null;
}

// Tự động đồng bộ hồ sơ khi phiên Auth thay đổi
if (typeof window !== 'undefined' && window.supabase?.auth) {
  window.supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      // Không await trong callback (tránh khóa phiên của supabase-js); xong thì áp lại quyền
      // để các nút luôn khớp với người đang đăng nhập thật.
      setTimeout(() => {
        syncUserProfile().then(() => applyElementPermissions());
      }, 0);
    } else if (event === 'SIGNED_OUT') {
      sessionStorage.removeItem('supabase_user_profile');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('userPermissions');
    }
  });
}

// Lỗi mạng khi làm mới phiên (offline, máy chủ chậm): không coi là mất phiên để khỏi đăng xuất nhầm
function isAuthNetworkError(error) {
  return Boolean(error) && /fetch|network|timeout|retryable/i.test(`${error.name || ''} ${error.message || ''}`);
}

/**
 * Có phiên Supabase Auth hợp lệ không. Không có phiên thì mọi lệnh đọc/ghi chạy dưới quyền anon
 * và bị từ chối ("permission denied for table ...").
 * @returns {Promise<boolean|null>} true có phiên, false đã mất phiên, null không kiểm tra được (lỗi mạng)
 */
async function hasAuthSession() {
  if (!window.supabase?.auth) return null;
  try {
    const { data, error } = await window.supabase.auth.getSession();
    if (data?.session?.user) return true;
    return isAuthNetworkError(error) ? null : false;
  } catch (e) {
    return isAuthNetworkError(e) ? null : false;
  }
}

// Giao diện còn nhớ tài khoản (currentUser) nhưng phiên Auth đã hết hạn / bị thu hồi:
// xóa trạng thái cũ và đưa về trang đăng nhập thay vì để mọi thao tác báo lỗi quyền.
async function verifyAuthSession() {
  if (!localStorage.getItem('currentUser')) return;
  const path = window.location.pathname;
  if (path === '/' || /\/(pages\/)?index\.html$/.test(path)) return;  // đang ở trang đăng nhập
  if (await hasAuthSession() !== false) return;
  sessionStorage.removeItem('supabase_user_profile');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userPermissions');

  // Trang mở trong tab (iframe) cùng origin: chỉ cửa sổ ngoài cùng báo 1 lần rồi chuyển trang
  let topWin = window;
  try {
    if (window.top && window.top.location.origin === window.location.origin) topWin = window.top;
  } catch (e) {}
  if (topWin.__ddcAuthExpiredHandled) return;
  topWin.__ddcAuthExpiredHandled = true;
  topWin.alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  topWin.location.href = '/pages/index.html';
}

window.hasAuthSession = hasAuthSession;
if (typeof window !== 'undefined' && window.supabase?.auth) verifyAuthSession();

/**
 * Checks if a Supabase data record was created over 24 hours ago.
 * Thực thi kiểm tra trên UI (Database RLS đã bảo vệ cứng tầng dưới).
 * @param {Object} record - Raw record object from Supabase.
 * @returns {boolean} True if locked (> 24h old), false otherwise.
 */
function isRecordLocked(record) {
  if (!record) return false;

  const profile = getCachedUserProfile();
  if (profile?.is_admin) {
    return false;
  }

  // BẢO MẬT: Không bypass theo localStorage.currentUser (ai cũng sửa được qua F12).
  // Quyền admin chỉ lấy từ hồ sơ Supabase Auth đã đồng bộ; RLS vẫn là lớp bảo vệ cuối.

  const createdAtStr = record.created_at || record.createdAt || record.created_Time;
  if (!createdAtStr) return false;
  
  const createdTime = new Date(createdAtStr).getTime();
  if (isNaN(createdTime)) return false;
  
  const LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  return (Date.now() - createdTime) > LOCK_DURATION_MS;
}

if (typeof window !== 'undefined') {
  window.isRecordLocked = isRecordLocked;
  window.getCachedUserProfile = getCachedUserProfile;
  window.syncUserProfile = syncUserProfile;
}

/**
 * Gets user permissions for currently logged in user, optionally filtered by group.
 * @param {string} [groupName=null] - Group identifier (e.g. 'xg', 'tole', 'pl', '5s', 'chung')
 * @returns {Object} { canView: boolean, canAdd: boolean, canEdit: boolean, canDelete: boolean, isAdmin: boolean }
 */
function getUserPermissions(groupName = null) {
  const profile = getCachedUserProfile();
  if (profile) {
    if (profile.is_admin) {
      return { canView: true, canAdd: true, canEdit: true, canDelete: true, isAdmin: true };
    }
    // Quyền theo nhóm (allowed_pages.groups) do trang Quản lý user cấu hình
    let allowed = profile.allowed_pages;
    if (typeof allowed === 'string') {
      try { allowed = JSON.parse(allowed); } catch (e) { allowed = null; }
    }
    const gPerm = groupName && allowed && !Array.isArray(allowed) && allowed.groups ? allowed.groups[groupName] : null;
    if (gPerm) {
      return {
        canView: !!gPerm.canView,
        canAdd: !!gPerm.canAdd,
        canEdit: !!gPerm.canEdit,
        canDelete: !!gPerm.canDelete,
        isAdmin: false
      };
    }
    return {
      canView: !!profile.can_view,
      canAdd: !!profile.can_add,
      canEdit: !!profile.can_edit,
      canDelete: !!profile.can_delete,
      isAdmin: !!profile.is_admin
    };
  }

  const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || (typeof window !== 'undefined' && window.currentUser);
  if (!currentUser) {
    return { canView: false, canAdd: false, canEdit: false, canDelete: false, isAdmin: false };
  }

  if (groupName && typeof localStorage !== 'undefined') {
    try {
      const rawGroups = localStorage.getItem('userGroupPermissions');
      if (rawGroups) {
        const groupsObj = JSON.parse(rawGroups);
        const gPerm = groupsObj[groupName];
        if (gPerm) {
          return {
            canView: !!gPerm.canView,
            canAdd: !!gPerm.canAdd,
            canEdit: !!gPerm.canEdit,
            canDelete: !!gPerm.canDelete,
            isAdmin: false
          };
        }
      }
    } catch (e) {
      console.error('Error parsing userGroupPermissions from localStorage', e);
    }
  }

  let storedPerms = null;
  try {
    const raw = localStorage.getItem('userPermissions');
    if (raw) storedPerms = JSON.parse(raw);
  } catch (e) {
    console.error('Error parsing userPermissions from localStorage', e);
  }

  return {
    canView: storedPerms ? !!storedPerms.canView : true,
    canAdd: storedPerms ? !!storedPerms.canAdd : false,
    canEdit: storedPerms ? !!storedPerms.canEdit : false,
    canDelete: storedPerms ? !!storedPerms.canDelete : false,
    isAdmin: false
  };
}

if (typeof window !== 'undefined') {
  window.getUserPermissions = getUserPermissions;
}

/**
 * Tự động phát hiện nhóm nghiệp vụ từ đường dẫn URL
 * @param {string} [pathname] - Đường dẫn URL cần kiểm tra
 * @returns {string} Mã nhóm: 'xg', 'tole', 'pl', 'tem_qr', '5s', 'chung', 'admin'
 */
function detectCurrentGroupName(pathname) {
  const path = (pathname || (typeof window !== 'undefined' && window.location && window.location.pathname) || '').toLowerCase();
  if (path.includes('/pages/xg/') || path.includes('/xg-')) return 'xg';
  if (path.includes('/pages/tole/') || path.includes('/tole-')) return 'tole';
  if (path.includes('/pages/pl/') || path.includes('/pl-') || path.includes('form-in')) return 'pl';
  if (path.includes('/pages/tem-nhan-kiem-ke/') || path.includes('in-tem-vitri') || path.includes('vi-tri-ton') || path.includes('kiem-ke')) return 'tem_qr';
  if (path.includes('/pages/5s/') || path.includes('hse') || path.includes('so-do')) return '5s';
  if (path.includes('/pages/cong-viec') || path.includes('/cong-viec')) return 'chung';
  if (path.includes('/pages/quan-ly-user') || path.includes('quan-ly-user')) return 'admin';
  return 'chung';
}

const PERM_ACTION_LABELS = { add: 'Thêm', edit: 'Sửa', delete: 'Xóa', view: 'Xem' };

/**
 * Tự động quét và áp dụng quyền thao tác lên tất cả các phần tử có thuộc tính [data-perm].
 * Nút luôn HIỂN THỊ với mọi người dùng; nếu không có quyền, nút được đánh dấu data-perm-locked
 * và mọi cú bấm bị chặn kèm thông báo (Database RLS vẫn là lớp bảo vệ cuối cùng).
 * @param {string} [targetGroup=null] - Mã nhóm cần áp dụng quyền (nếu để trống sẽ tự nhận diện theo URL)
 */
function applyElementPermissions(targetGroup = null) {
  if (typeof document === 'undefined') return;
  const group = targetGroup || detectCurrentGroupName();
  const perms = getUserPermissions(group) || {};

  const elements = document.querySelectorAll('[data-perm]');
  elements.forEach(el => {
    const rawVal = typeof el.getAttribute === 'function' ? el.getAttribute('data-perm') : (el.dataset && el.dataset.perm);
    const requiredPerm = (rawVal || '').toLowerCase().trim();
    if (!requiredPerm) return;

    // data-perm có thể là 1 quyền ("add") hoặc nhiều quyền, chỉ cần 1 ("add|edit")
    const required = requiredPerm.split('|').map(p => p.trim()).filter(Boolean);
    const allowed = !!perms.isAdmin || required.some(p =>
      (p === 'add' && perms.canAdd) ||
      (p === 'edit' && perms.canEdit) ||
      (p === 'delete' && perms.canDelete) ||
      (p === 'view' && perms.canView)
    );

    if (allowed) {
      if (typeof el.removeAttribute === 'function') el.removeAttribute('data-perm-locked');
    } else if (typeof el.setAttribute === 'function') {
      el.setAttribute('data-perm-locked', 'true');
      const hasTitle = typeof el.getAttribute === 'function' && el.getAttribute('title');
      if (!hasTitle) {
        el.setAttribute('title', 'Bạn không có quyền ' + permActionLabel(requiredPerm) + ' dữ liệu ở mục này');
      }
    }
  });
}

function permActionLabel(rawPerm) {
  const parts = String(rawPerm || '').toLowerCase().split('|').map(p => p.trim()).filter(Boolean);
  return parts.length ? parts.map(p => PERM_ACTION_LABELS[p] || p).join('/') : 'thực hiện thao tác với';
}

function showPermDeniedWarning(el) {
  const perm = el && typeof el.getAttribute === 'function' ? el.getAttribute('data-perm') : '';
  showWarningModal(
    'Tài khoản của bạn không có quyền ' + permActionLabel(perm) + ' dữ liệu ở mục này. Vui lòng liên hệ Quản trị viên nếu cần được cấp quyền.',
    'Không có quyền thao tác'
  );
}

function stopPermEvent(e) {
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
}

/**
 * Chặn mọi cú bấm vào nút/nhãn bị khóa quyền (chạy ở pha capture, trước handler của trang
 * và Bootstrap data-bs-toggle), rồi báo cho người dùng biết họ không có quyền.
 */
function blockLockedPermClick(e) {
  const target = e.target;
  const el = target && typeof target.closest === 'function' ? target.closest('[data-perm-locked="true"]') : null;
  if (!el) return;
  stopPermEvent(e);
  showPermDeniedWarning(el);
}

/**
 * Chặn gửi form (kể cả nhấn Enter trong ô nhập) khi nút submit của form đang bị khóa quyền.
 */
function blockLockedPermSubmit(e) {
  const form = e.target;
  let submitter = e.submitter || null;
  if (!submitter && form && typeof form.querySelector === 'function') {
    submitter = form.querySelector('[type="submit"]') ||
      (form.id && typeof document !== 'undefined'
        ? document.querySelector('[type="submit"][form="' + form.id + '"]')
        : null);
  }
  if (!submitter || typeof submitter.getAttribute !== 'function') return;
  if (submitter.getAttribute('data-perm-locked') !== 'true') return;
  stopPermEvent(e);
  showPermDeniedWarning(submitter);
}

if (typeof window !== 'undefined') {
  window.detectCurrentGroupName = detectCurrentGroupName;
  window.applyElementPermissions = applyElementPermissions;

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('click', blockLockedPermClick, true);
    window.addEventListener('submit', blockLockedPermSubmit, true);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => applyElementPermissions());
    } else {
      setTimeout(() => applyElementPermissions(), 0);
    }
  }
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
      <div class="modal-dialog modal-lg modal-dialog-centered" style="max-width: 720px;">
        <div class="modal-content shadow-lg border-0" style="border-radius: 16px; overflow: hidden; background: #1e2438; color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.15) !important;">
          <div class="modal-header border-0 py-3 px-4" style="background: rgba(220, 53, 69, 0.2); border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;">
            <h5 class="modal-title fw-bold fs-5 d-flex align-items-center gap-2 mb-0 text-white" style="color: #ffffff !important;">
              <span style="font-size: 1.5rem;">⚠️</span>
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body py-4 px-4 fs-6 text-white" id="globalWarningModalBody" style="line-height: 1.6; color: #ffffff !important; font-weight: 500; text-align: left; max-height: 560px; overflow-y: auto;">
          </div>
          <div class="modal-footer border-0 justify-content-center pt-2 pb-4">
            <button type="button" class="btn btn-warning btn-lg px-5 py-2 fw-bold rounded-3 text-dark shadow fs-6" data-bs-dismiss="modal">
              <i class="bi bi-check2-circle me-1"></i> Đã hiểu
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  const dialogEl = modalEl.querySelector('.modal-dialog');
  if (dialogEl) {
    dialogEl.classList.add('modal-lg');
    dialogEl.style.maxWidth = '720px';
  }

  const titleEl = modalEl.querySelector('.modal-title');
  if (titleEl) {
    titleEl.innerHTML = '<span style="font-size: 1.3rem;">⚠️</span> ';
    titleEl.appendChild(document.createTextNode(String(title)));
  }

  const bodyEl = modalEl.querySelector('#globalWarningModalBody');
  if (bodyEl) {
    if (typeof message === 'string' && (message.includes('<div') || message.includes('<p') || message.includes('<table') || message.includes('<span') || message.includes('<b'))) {
      bodyEl.innerHTML = message;
    } else {
      bodyEl.textContent = message;
    }
  }

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

/**
 * Fast parallel fetch for Supabase table with automatic batching.
 * @param {string} tableName - Name of Supabase table
 * @param {string} [selectColumns='*'] - Columns to fetch
 * @param {string} [orderBy='id'] - Column name to order by
 * @param {boolean} [ascending=true] - Order direction
 * @returns {Promise<Array>} Array of records
 */
async function fetchAllFromSupabase(tableName, selectColumns = '*', orderBy = 'id', ascending = true) {
  const batchSize = 1000;

  // Query first batch and exact total count
  const { data: firstBatch, error, count } = await window.supabase
    .from(tableName)
    .select(selectColumns, { count: 'exact' })
    .order(orderBy, { ascending })
    .range(0, batchSize - 1);

  if (error) throw error;
  if (!firstBatch || firstBatch.length === 0) return [];

  const totalCount = count ?? firstBatch.length;
  if (totalCount <= batchSize || firstBatch.length < batchSize) {
    return firstBatch;
  }

  // Fetch remaining batches in parallel
  const totalBatches = Math.ceil(totalCount / batchSize);
  const batchPromises = [];

  for (let i = 1; i < totalBatches; i++) {
    const from = i * batchSize;
    const to = Math.min((i + 1) * batchSize - 1, totalCount - 1);
    batchPromises.push(
      window.supabase
        .from(tableName)
        .select(selectColumns)
        .order(orderBy, { ascending })
        .range(from, to)
        .then(res => {
          if (res.error) throw res.error;
          return res.data || [];
        })
    );
  }

  const remainingBatches = await Promise.all(batchPromises);
  return firstBatch.concat(...remainingBatches);
}

/**
 * Storage cache helpers for instant load (SWR)
 */
function getStoredTableCache(key) {
  try {
    const item = sessionStorage.getItem('swr_cache_' + key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
}

function setStoredTableCache(key, data) {
  try {
    sessionStorage.setItem('swr_cache_' + key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to set cache for', key, e);
  }
}

function clearStoredTableCache(key) {
  try {
    if (key) {
      sessionStorage.removeItem('swr_cache_' + key);
    } else {
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('swr_cache_')) sessionStorage.removeItem(k);
      });
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.fetchAllFromSupabase = fetchAllFromSupabase;
  window.getStoredTableCache = getStoredTableCache;
  window.setStoredTableCache = setStoredTableCache;
  window.clearStoredTableCache = clearStoredTableCache;
}



