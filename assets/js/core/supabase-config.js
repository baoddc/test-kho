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
function getCachedUserProfile() {
  try {
    const raw = sessionStorage.getItem('supabase_user_profile') || localStorage.getItem('supabase_user_profile');
    if (raw) return JSON.parse(raw);
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
      syncUserProfile();
    } else if (event === 'SIGNED_OUT') {
      sessionStorage.removeItem('supabase_user_profile');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('userPermissions');
    }
  });
}

/**
 * Checks if a Supabase data record was created over 24 hours ago.
 * Thực thi kiểm tra trên UI (Database RLS đã bảo vệ cứng tầng dưới).
 * @param {Object} record - Raw record object from Supabase.
 * @returns {boolean} True if locked (> 24h old), false otherwise.
 */
function isRecordLocked(record) {
  if (!record) return false;

  const profile = getCachedUserProfile();
  if (profile?.is_admin || profile?.username?.toLowerCase() === 'bao.lt') {
    return false;
  }

  // Bypass 24h lock restriction for user "bao.lt"
  const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || (typeof window !== 'undefined' && window.currentUser);
  if (currentUser && String(currentUser).trim().toLowerCase() === 'bao.lt') {
    return false;
  }

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
    if (profile.is_admin || profile.username?.toLowerCase() === 'bao.lt') {
      return { canView: true, canAdd: true, canEdit: true, canDelete: true, isAdmin: true };
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
  
  if (String(currentUser).trim().toLowerCase() === 'bao.lt') {
    return { canView: true, canAdd: true, canEdit: true, canDelete: true, isAdmin: true };
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



