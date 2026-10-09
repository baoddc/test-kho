(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KiemKeStorage = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const SESSION_KEY = 'kiem_ke_scanned_rolls_session';
  const EXCEL_CACHE_KEY = 'kiem_ke_excel_cache';
  const TABLE_NAME = 'kiem_ke_scans';

  function getSupabaseClient() {
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.from === 'function') {
      return window.supabase;
    }
    return null;
  }

  function checkDuplicate(scannedList, identifier) {
    if (!Array.isArray(scannedList) || !identifier) return false;
    const cleanId = String(identifier).trim().toLowerCase();
    return scannedList.some(item => {
      const b = String(item.barcode || '').trim().toLowerCase();
      const c = String(item.cuonId || '').trim().toLowerCase();
      return b === cleanId || (c && c === cleanId);
    });
  }

  function saveSession(scannedRolls, excelMetadata) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(scannedRolls || []));
      if (excelMetadata) {
        localStorage.setItem(EXCEL_CACHE_KEY, JSON.stringify(excelMetadata));
      }
    } catch (e) {
      console.warn('Lỗi lưu LocalStorage:', e);
    }
  }

  function loadSession() {
    if (typeof localStorage === 'undefined') return { scannedRolls: [], excelMetadata: null };
    try {
      const rawScanned = localStorage.getItem(SESSION_KEY);
      const rawExcel = localStorage.getItem(EXCEL_CACHE_KEY);
      return {
        scannedRolls: rawScanned ? JSON.parse(rawScanned) : [],
        excelMetadata: rawExcel ? JSON.parse(rawExcel) : null
      };
    } catch (e) {
      console.warn('Lỗi đọc LocalStorage:', e);
      return { scannedRolls: [], excelMetadata: null };
    }
  }

  function clearSession() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(EXCEL_CACHE_KEY);
    } catch (e) {
      console.warn('Lỗi xóa LocalStorage:', e);
    }
  }

  function clearScannedOnly() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.warn('Lỗi xóa LocalStorage:', e);
    }
  }

  // ==================== SUPABASE CLOUD OPERATIONS ====================

  /**
   * Tải toàn bộ cuộn đã quét từ bảng kiem_ke_scans trên Supabase
   * Sắp xếp mới nhất lên đầu
   */
  async function fetchScannedRollsFromSupabase() {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase client chưa khả dụng, sử dụng dữ liệu cục bộ.');
      return loadSession().scannedRolls;
    }

    try {
      const { data, error } = await client
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn(`Không thể nạp dữ liệu từ ${TABLE_NAME}:`, error.message || error);
        return loadSession().scannedRolls;
      }

      if (Array.isArray(data)) {
        const formatted = data.map(r => {
          let timeStr = '-';
          if (r.created_at) {
            const d = new Date(r.created_at);
            timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
          }
          return {
            id: String(r.id),
            barcode: r.barcode || '',
            maVatTu: r.ma_vat_tu || '',
            batch: r.batch || '',
            kg: parseFloat(r.kg) || 0,
            timestamp: timeStr,
            scannedBy: r.scanned_by || '',
            createdAt: r.created_at
          };
        });

        // Cập nhật bộ đệm LocalStorage
        saveSession(formatted, loadSession().excelMetadata);
        return formatted;
      }
    } catch (err) {
      console.error('Lỗi khi truy vấn kiem_ke_scans:', err);
    }
    return loadSession().scannedRolls;
  }

  /**
   * Lưu cuộn quét mới lên Supabase kiem_ke_scans
   */
  async function insertScannedRollToSupabase(rollItem) {
    const client = getSupabaseClient();
    if (!client) return rollItem;

    try {
      const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || 'guest';
      const payload = {
        barcode: String(rollItem.barcode || ''),
        ma_vat_tu: String(rollItem.maVatTu || ''),
        batch: String(rollItem.batch || ''),
        kg: parseFloat(rollItem.kg) || 0,
        scanned_by: rollItem.scannedBy || currentUser
      };

      const { data, error } = await client
        .from(TABLE_NAME)
        .insert([payload])
        .select();

      if (error) {
        console.error('Lỗi ghi cuộn quét lên Supabase:', error);
        return rollItem;
      }

      if (data && data.length > 0) {
        return {
          ...rollItem,
          id: String(data[0].id),
          createdAt: data[0].created_at
        };
      }
    } catch (err) {
      console.error('Lỗi khi chèn cuộn quét:', err);
    }
    return rollItem;
  }

  /**
   * Lưu danh sách cuộn quét hàng loạt lên Supabase kiem_ke_scans (chia chunks 100)
   */
  async function insertBatchScannedRollsToSupabase(rollItems) {
    if (!Array.isArray(rollItems) || rollItems.length === 0) return rollItems || [];
    const client = getSupabaseClient();
    if (!client) return rollItems;

    try {
      const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || 'guest';
      const CHUNK_SIZE = 100;
      for (let i = 0; i < rollItems.length; i += CHUNK_SIZE) {
        const chunk = rollItems.slice(i, i + CHUNK_SIZE);
        const payloadChunk = chunk.map(roll => ({
          barcode: String(roll.barcode || ''),
          ma_vat_tu: String(roll.maVatTu || ''),
          batch: String(roll.batch || ''),
          kg: parseFloat(roll.kg) || 0,
          scanned_by: roll.scannedBy || currentUser
        }));

        const { data, error } = await client
          .from(TABLE_NAME)
          .insert(payloadChunk)
          .select();

        if (error) {
          console.error(`Lỗi khi chèn mẻ cuộn quét (${i} -> ${i + chunk.length}):`, error);
        } else if (Array.isArray(data)) {
          // Gán lại ID và created_at từ Supabase
          data.forEach((saved, sIdx) => {
            if (chunk[sIdx]) {
              chunk[sIdx].id = String(saved.id);
              chunk[sIdx].createdAt = saved.created_at;
            }
          });
        }
      }
    } catch (err) {
      console.error('Lỗi ngoại lệ khi chèn batch cuộn quét:', err);
    }
    return rollItems;
  }

  /**
   * Xóa 1 cuộn trên Supabase kiem_ke_scans theo ID (chỉ bao.lt được RLS cho phép)
   */
  async function deleteScannedRollFromSupabase(id) {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Lỗi xóa cuộn trên Supabase:', error);
        throw error;
      }
      return true;
    } catch (err) {
      console.error('Lỗi thực thi deleteScannedRollFromSupabase:', err);
      throw err;
    }
  }

  /**
   * Xóa toàn bộ cuộn đã quét trên Supabase (chỉ bao.lt được RLS cho phép)
   */
  async function clearAllScannedFromSupabase() {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from(TABLE_NAME)
        .delete()
        .neq('id', 0); // Xóa tất cả các bản ghi có ID khác 0

      if (error) {
        console.error('Lỗi xóa toàn bộ trên Supabase:', error);
        throw error;
      }
      return true;
    } catch (err) {
      console.error('Lỗi thực thi clearAllScannedFromSupabase:', err);
      throw err;
    }
  }

  let activeRealtimeChannel = null;

  /**
   * Lắng nghe thay đổi Realtime trên bảng kiem_ke_scans và kênh broadcast
   */
  function subscribeRealtimeChanges(onInsert, onDelete, onReset) {
    const client = getSupabaseClient();
    if (!client || typeof client.channel !== 'function') return null;

    try {
      const channel = client.channel('kiem_ke_scans_realtime_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE_NAME }, payload => {
          if (payload && payload.new && typeof onInsert === 'function') {
            const r = payload.new;
            let timeStr = '-';
            if (r.created_at) {
              const d = new Date(r.created_at);
              timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            }
            onInsert({
              id: String(r.id),
              barcode: r.barcode || '',
              maVatTu: r.ma_vat_tu || '',
              batch: r.batch || '',
              kg: parseFloat(r.kg) || 0,
              timestamp: timeStr,
              scannedBy: r.scanned_by || '',
              createdAt: r.created_at
            });
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE_NAME }, payload => {
          if (payload && payload.old && typeof onDelete === 'function') {
            onDelete(String(payload.old.id));
          }
        })
        .on('broadcast', { event: 'RESET_SESSION' }, eventPayload => {
          if (typeof onReset === 'function') {
            onReset(eventPayload && eventPayload.payload ? eventPayload.payload : {});
          }
        })
        .subscribe();

      activeRealtimeChannel = channel;
      return channel;
    } catch (e) {
      console.warn('Lỗi khởi tạo Supabase Realtime channel:', e);
      return null;
    }
  }

  /**
   * Gửi thông báo broadcast khi quản trị viên reset phiên làm việc
   */
  function broadcastResetSession(resetType) {
    if (!activeRealtimeChannel) return;
    try {
      const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || 'bao.lt';
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'RESET_SESSION',
        payload: {
          resetType: resetType || 'all',
          scannedBy: currentUser,
          timestamp: Date.now()
        }
      });
    } catch (err) {
      console.warn('Lỗi gửi broadcast reset:', err);
    }
  }

  // ==================== WEB AUDIO API FEEDBACK ====================
  let audioCtx = null;
  function getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playBeepSuccess() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([250, 100, 250]); } catch (e) {}
    }
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }

  function playBoopError() {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }

  return {
    checkDuplicate,
    saveSession,
    loadSession,
    clearSession,
    clearScannedOnly,
    fetchScannedRollsFromSupabase,
    insertScannedRollToSupabase,
    insertBatchScannedRollsToSupabase,
    deleteScannedRollFromSupabase,
    clearAllScannedFromSupabase,
    subscribeRealtimeChanges,
    broadcastResetSession,
    playBeepSuccess,
    playBoopError
  };
}));
