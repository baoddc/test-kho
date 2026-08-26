/**
 * INVENTORY LOCK & CONCURRENCY SERVICE
 * Quản lý trạng thái khóa mềm (Soft-Lock), Live Presence và đồng bộ Race Condition
 * Dùng chung cho phân hệ Xà Gồ (XG) và Tôn (TOLE).
 */

(function(window) {
  'use strict';

  class InventoryLockService {
    constructor() {
      this.moduleType = null; // 'xg' | 'tole'
      this.currentUser = null;
      this.activeLocks = new Map(); // cuonId.toLowerCase() -> { cuonId, lockedBy, expiresAt }
      this.myLockedRolls = new Set(); // cuonId.toLowerCase()
      this.listeners = new Set();
      this.broadcastChannel = null;
      this.realtimeChannel = null;
      this.pollInterval = null;
      this.isInitialized = false;
    }

    /**
     * Khởi tạo dịch vụ cho một phân hệ cụ thể ('xg' hoặc 'tole')
     * @param {'xg'|'tole'} moduleType 
     */
    async init(moduleType) {
      if (this.isInitialized && this.moduleType === moduleType) return;
      this.moduleType = moduleType;
      this.currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || 'anonymous';

      // 1. BroadcastChannel nội bộ (0ms latency giữa các tab cùng trình duyệt)
      const channelName = `${moduleType}_inventory_lock_channel`;
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          if (this.broadcastChannel) this.broadcastChannel.close();
          this.broadcastChannel = new BroadcastChannel(channelName);
          this.broadcastChannel.onmessage = (event) => this.handleChannelMessage(event.data);
        } catch (e) {
          console.warn('[InventoryLockService] BroadcastChannel not supported:', e);
        }
      }

      // 2. Supabase Realtime Channel
      this.setupSupabaseRealtime();

      // 3. Tải danh sách khóa hiện hành từ Supabase
      await this.refreshLocks();

      // 4. Polling nhẹ định kỳ mỗi 15s để loại bỏ khóa hết hạn và làm mới
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.pollInterval = setInterval(() => {
        this.cleanExpiredLocks();
        this.refreshLocks(true); // background silent refresh
      }, 15000);

      // 5. Tự động giải phóng các cuộn do chính user đang giữ khi đóng/reload tab
      window.addEventListener('beforeunload', () => {
        this.releaseAllMyLocks();
      });

      this.isInitialized = true;
    }

    setupSupabaseRealtime() {
      if (!window.supabase || typeof window.supabase.channel !== 'function') return;

      try {
        const topic = `public:inventory_locks_${this.moduleType}`;
        if (this.realtimeChannel) {
          window.supabase.removeChannel(this.realtimeChannel);
        }

        this.realtimeChannel = window.supabase
          .channel(topic)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'inventory_locks',
            filter: `module_type=eq.${this.moduleType}`
          }, (payload) => {
            this.handlePostgresChange(payload);
          })
          .subscribe();
      } catch (err) {
        console.warn('[InventoryLockService] Supabase Realtime setup warning:', err);
      }
    }

    handlePostgresChange(payload) {
      if (!payload) return;
      const eventType = payload.eventType; // 'INSERT', 'UPDATE', 'DELETE'
      const newRec = payload.new;
      const oldRec = payload.old;

      if (eventType === 'DELETE' && oldRec) {
        // Find by id or refresh
        this.refreshLocks(true);
      } else if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRec) {
        const cuonId = String(newRec.cuon_id || '').trim();
        if (cuonId) {
          this.activeLocks.set(cuonId.toLowerCase(), {
            cuonId: cuonId,
            lockedBy: newRec.locked_by,
            expiresAt: new Date(newRec.expires_at).getTime()
          });
          this.notifyListeners();
        }
      }
    }

    handleChannelMessage(msg) {
      if (!msg || !msg.type) return;

      if (msg.type === 'LOCK_ACQUIRED') {
        const cuonId = String(msg.cuonId || '').trim();
        if (cuonId) {
          this.activeLocks.set(cuonId.toLowerCase(), {
            cuonId: cuonId,
            lockedBy: msg.user,
            expiresAt: msg.expiresAt || (Date.now() + 300000)
          });
          this.notifyListeners();
        }
      } else if (msg.type === 'LOCK_RELEASED') {
        const ids = Array.isArray(msg.cuonIds) ? msg.cuonIds : [msg.cuonId];
        ids.forEach(id => {
          if (id) this.activeLocks.delete(String(id).trim().toLowerCase());
        });
        this.notifyListeners();
      } else if (msg.type === 'LOCK_REFRESH_REQUEST') {
        this.refreshLocks(true);
      }
    }

    /**
     * Tải lại toàn bộ khóa còn hiệu lực từ Database
     */
    async refreshLocks(silent = false) {
      if (!window.supabase) return;
      try {
        const now = new Date().toISOString();
        const { data, error } = await window.supabase
          .from('inventory_locks')
          .select('cuon_id, locked_by, expires_at')
          .eq('module_type', this.moduleType)
          .gt('expires_at', now);

        if (error) {
          // Bảng chưa tạo hoặc lỗi quyền -> fallback RPC hoặc bỏ qua nhẹ nhàng
          return;
        }

        this.activeLocks.clear();
        if (data && Array.isArray(data)) {
          data.forEach(item => {
            const cid = String(item.cuon_id || '').trim();
            if (cid) {
              this.activeLocks.set(cid.toLowerCase(), {
                cuonId: cid,
                lockedBy: item.locked_by,
                expiresAt: new Date(item.expires_at).getTime()
              });
            }
          });
        }

        if (!silent) this.notifyListeners();
      } catch (e) {
        if (!silent) console.warn('[InventoryLockService] refreshLocks error:', e);
      }
    }

    cleanExpiredLocks() {
      const now = Date.now();
      let hasChanges = false;
      for (const [key, val] of this.activeLocks.entries()) {
        if (val.expiresAt && val.expiresAt <= now) {
          this.activeLocks.delete(key);
          this.myLockedRolls.delete(key);
          hasChanges = true;
        }
      }
      if (hasChanges) this.notifyListeners();
    }

    /**
     * Chiếm khóa cho 1 cuộn
     * @param {string} cuonId 
     * @param {boolean} shouldNotify - Có gọi listeners nội bộ không (mặc định true)
     * @returns {Promise<boolean>} True nếu chiếm khóa thành công
     */
    async acquireLock(cuonId, shouldNotify = true) {
      const cleanId = String(cuonId || '').trim();
      if (!cleanId || !window.supabase) return true;

      const key = cleanId.toLowerCase();
      const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || this.currentUser || 'anonymous';

      // Kiểm tra local cache trước
      const currentLock = this.activeLocks.get(key);
      if (currentLock && currentLock.expiresAt > Date.now()) {
        if (String(currentLock.lockedBy).trim().toLowerCase() !== String(currentUser).trim().toLowerCase()) {
          return false; // Đã bị người khác khóa
        }
      }

      try {
        const expiresAt = Date.now() + 300000;
        this.activeLocks.set(key, {
          cuonId: cleanId,
          lockedBy: currentUser,
          expiresAt: expiresAt
        });
        this.myLockedRolls.add(key);

        // Phát tin qua BroadcastChannel
        if (this.broadcastChannel) {
          this.broadcastChannel.postMessage({
            type: 'LOCK_ACQUIRED',
            cuonId: cleanId,
            user: currentUser,
            expiresAt: expiresAt
          });
        }

        if (shouldNotify) this.notifyListeners();

        // Gửi RPC lên Supabase không đồng bộ
        window.supabase.rpc('acquire_inventory_lock', {
          p_module: this.moduleType,
          p_cuon_id: cleanId,
          p_user: currentUser,
          p_ttl_seconds: 300
        }).then(({ data, error }) => {
          if (error) {
            console.warn('[InventoryLockService] acquireLock RPC error:', error);
          } else if (data === false) {
            // Không chiếm được trên DB -> rollback local
            this.activeLocks.delete(key);
            this.myLockedRolls.delete(key);
            this.notifyListeners();
          }
        }).catch(err => {
          console.warn('[InventoryLockService] acquireLock exception:', err);
        });

        return true;
      } catch (err) {
        console.error('[InventoryLockService] acquireLock error:', err);
        return true;
      }
    }

    /**
     * Giải phóng khóa cho một hoặc nhiều cuộn
     * @param {string|string[]} cuonIds 
     * @param {boolean} shouldNotify - Có gọi listeners nội bộ không (mặc định true)
     */
    async releaseLock(cuonIds, shouldNotify = true) {
      if (!cuonIds) return;
      const ids = Array.isArray(cuonIds) ? cuonIds : [cuonIds];
      const cleanIds = ids.map(id => String(id || '').trim()).filter(Boolean);
      if (cleanIds.length === 0 || !window.supabase) return;

      const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || this.currentUser || 'anonymous';

      cleanIds.forEach(id => {
        const key = id.toLowerCase();
        this.activeLocks.delete(key);
        this.myLockedRolls.delete(key);
      });

      // Phát Broadcast
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'LOCK_RELEASED',
          cuonIds: cleanIds,
          user: currentUser
        });
      }

      if (shouldNotify) this.notifyListeners();

      try {
        window.supabase.rpc('release_inventory_lock', {
          p_module: this.moduleType,
          p_cuon_ids: cleanIds,
          p_user: currentUser
        }).catch(e => console.warn('[InventoryLockService] releaseLock RPC error:', e));
      } catch (e) {
        console.warn('[InventoryLockService] releaseLock error:', e);
      }
    }

    /**
     * Giải phóng tất cả các cuộn mà chính user này đang giữ
     */
    releaseAllMyLocks() {
      if (this.myLockedRolls.size === 0) return;
      const ids = Array.from(this.myLockedRolls);
      this.releaseLock(ids);
    }

    /**
     * Kiểm tra xem 1 Cuộn ID có đang bị NGƯỜI KHÁC khóa hay không
     * @param {string} cuonId 
     * @returns {{ isLocked: boolean, lockedBy: string, isMe: boolean, remainingSeconds: number }}
     */
    getLockStatus(cuonId) {
      const cleanId = String(cuonId || '').trim();
      if (!cleanId) return { isLocked: false, lockedBy: '', isMe: false, remainingSeconds: 0 };

      const key = cleanId.toLowerCase();
      const lock = this.activeLocks.get(key);
      const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || this.currentUser || 'anonymous';

      if (!lock || !lock.expiresAt || lock.expiresAt <= Date.now()) {
        return { isLocked: false, lockedBy: '', isMe: false, remainingSeconds: 0 };
      }

      const isMe = String(lock.lockedBy || '').trim().toLowerCase() === String(currentUser).trim().toLowerCase();
      const remainingSeconds = Math.max(0, Math.floor((lock.expiresAt - Date.now()) / 1000));

      return {
        isLocked: true,
        lockedBy: lock.lockedBy,
        isMe: isMe,
        remainingSeconds: remainingSeconds
      };
    }

    /**
     * Đăng ký lắng nghe thay đổi danh sách khóa
     * @param {Function} callback 
     * @returns {Function} Hàm hủy đăng ký (unsubscribe)
     */
    onLocksChange(callback) {
      if (typeof callback === 'function') {
        this.listeners.add(callback);
      }
      return () => {
        this.listeners.delete(callback);
      };
    }

    notifyListeners() {
      this.listeners.forEach(cb => {
        try { cb(this.activeLocks); } catch (e) { console.error(e); }
      });
    }
  }

  // Khởi tạo Singleton toàn cục
  window.inventoryLockService = new InventoryLockService();

})(typeof window !== 'undefined' ? window : this);
