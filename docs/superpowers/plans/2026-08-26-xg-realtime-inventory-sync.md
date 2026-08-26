# XG Realtime Inventory Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi người dùng nhập dữ liệu xuất vào file `xg-xuat`, trang `xg-ton` (Tồn xà gồ) và popup chọn tồn kho sẽ lập tức trừ tồn mà không cần reload lại trang.

**Architecture:** Kết hợp đa tầng phản ứng:
1. `BroadcastChannel('xg_sync_channel')` cho giao tiếp tức thì giữa các tab/iframe trên cùng trình duyệt (độ trễ ~0ms).
2. `supabase.channel('public:xg_realtime_ton')` (Supabase Realtime) lắng nghe `postgres_changes` trên bảng `xg-xuat` và `xg-nhap` cho đồng bộ đa thiết bị/đa người dùng.
3. Đồng bộ in-memory `window._rawSupabaseData`, `tableData`, và SWR cache (`swr_cache_xg-ton`) mượt mà không mất filter hay scroll.

**Tech Stack:** Vanilla JavaScript (ES6+), Supabase JS Client v2 (Realtime Channels), BroadcastChannel API, Bootstrap 5.

## Global Constraints
- Không làm mất từ khóa tìm kiếm (`searchInput`), bộ lọc dropdown, hoặc vị trí cuộn trang của người dùng khi trừ tồn.
- Idempotent deduplication: Kiểm tra `Cuộn ID` bằng `Set` để tránh trừ trùng lặp giữa BroadcastChannel và Supabase Realtime.
- Giữ nguyên cấu trúc dữ liệu `COLUMN_HEADERS` và bảng nhóm Grouping trong `xg-ton.js`.

---

### Task 1: Cập nhật `assets/js/xg/xg-xuat.js` phát sự kiện đồng bộ và cập nhật tồn kho nội bộ

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`

**Interfaces:**
- Produces: `xg_sync_channel.postMessage({ type: 'XG_XUAT_INSERT', cuonIds: string[], records: object[] })`, `xg_sync_channel.postMessage({ type: 'XG_XUAT_DELETE', cuonIds: string[], ids: any[] })`

- [ ] **Step 1: Khởi tạo BroadcastChannel và helper đồng bộ trong `xg-xuat.js`**
Thêm khai báo `xgChannel` và hàm tiện ích thông báo:
```javascript
const xgChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('xg_sync_channel') : null;

function broadcastXgEvent(eventType, payload = {}) {
  if (xgChannel) {
    try {
      xgChannel.postMessage({ type: eventType, ...payload, timestamp: Date.now() });
    } catch (err) {
      console.warn('Broadcast error:', err);
    }
  }
}
```

- [ ] **Step 2: Cập nhật logic Thêm dữ liệu (`addDataForm` submit handler) trong `xg-xuat.js`**
Sau khi `supabase.from(TABLE_NAME).insert(...)` thành công:
1. Lấy danh sách `cuonIds` vừa xuất:
```javascript
const exportedCuonIds = rollDataList.map(r => String(r.cuonId || '').trim()).filter(Boolean);
```
2. Cập nhật `cachedInventoryData` loại trừ các `cuonIds` vừa xuất.
3. Cập nhật `sessionStorage` (`setStoredTableCache(TABLE_NAME, window._rawSupabaseData)` và cập nhật hoặc xóa `swr_cache_xg-ton`).
4. Phát thông báo:
```javascript
broadcastXgEvent('XG_XUAT_INSERT', {
  cuonIds: exportedCuonIds,
  records: insertedData || []
});
```

- [ ] **Step 3: Cập nhật logic Xóa dữ liệu (`btnConfirmDelete` handler) trong `xg-xuat.js`**
Sau khi xóa thành công:
1. Trích xuất danh sách `cuonIds` của các dòng vừa bị xóa.
2. Phát thông báo:
```javascript
broadcastXgEvent('XG_XUAT_DELETE', {
  cuonIds: deletedCuonIds,
  ids: idsToDelete
});
```

- [ ] **Step 4: Cập nhật `openInventoryModal` trong `xg-xuat.js`**
Đảm bảo khi mở modal chọn cuộn tồn kho, các cuộn đã xuất trong `window._rawSupabaseData` luôn bị loại trừ ngay lập tức.

- [ ] **Step 5: Commit thay đổi Task 1**
```bash
git add assets/js/xg/xg-xuat.js
git commit -m "feat(xg-xuat): broadcast export events and update local inventory cache immediately"
```

---

### Task 2: Cập nhật `assets/js/xg/xg-ton.js` nhận sự kiện và tự động trừ tồn tức thì

**Files:**
- Modify: `assets/js/xg/xg-ton.js`

**Interfaces:**
- Consumes: `XG_XUAT_INSERT`, `XG_XUAT_DELETE`, `XG_NHAP_INSERT`, `XG_NHAP_DELETE` từ BroadcastChannel và Supabase Realtime.

- [ ] **Step 1: Khởi tạo BroadcastChannel listener và Realtime channel trong `xg-ton.js`**
Thêm BroadcastChannel và đăng ký Supabase Realtime:
```javascript
const xgChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('xg_sync_channel') : null;
if (xgChannel) {
  xgChannel.onmessage = (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;
    handleXgSyncEvent(msg.type, msg);
  };
}

function initSupabaseRealtime() {
  if (!window.supabase) return;
  window.supabase
    .channel('public:xg_realtime_ton')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'xg-xuat' }, (payload) => {
      handleRealtimeXuatChange(payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'xg-nhap' }, (payload) => {
      handleRealtimeNhapChange(payload);
    })
    .subscribe();
}
```

- [ ] **Step 2: Cài đặt hàm trừ tồn tức thì `handleXgSyncEvent` và `applyCuonDeduction`**
```javascript
function handleXgSyncEvent(type, payload) {
  if (type === 'XG_XUAT_INSERT') {
    const cuonIds = (payload.cuonIds || []).map(id => String(id).trim().toLowerCase()).filter(Boolean);
    if (cuonIds.length > 0) {
      applyCuonDeduction(cuonIds);
    }
  } else if (type === 'XG_XUAT_DELETE' || type === 'XG_NHAP_INSERT' || type === 'XG_NHAP_DELETE') {
    // Re-sync or refresh data
    reloadInventoryDataQuietly();
  }
}

function applyCuonDeduction(cuonIdsToSubtract) {
  const subtractSet = new Set(cuonIdsToSubtract);
  if (!window._rawSupabaseData || window._rawSupabaseData.length === 0) return;

  const prevLen = window._rawSupabaseData.length;
  window._rawSupabaseData = window._rawSupabaseData.filter(row => {
    const cid = String(row['Cuộn ID'] || '').trim().toLowerCase();
    return !subtractSet.has(cid);
  });

  if (window._rawSupabaseData.length !== prevLen) {
    tableData = [COLUMN_HEADERS, ...window._rawSupabaseData.map(rowToArray)];
    if (typeof setStoredTableCache === 'function') {
      setStoredTableCache('xg-ton', window._rawSupabaseData);
    }
    filterTable(false);
  }
}
```

- [ ] **Step 3: Cài đặt hàm cập nhật nền `reloadInventoryDataQuietly()`**
Tải lại dữ liệu tồn trong nền không hiển thị loading che màn hình và re-render bảng mượt mà.

- [ ] **Step 4: Gọi `initSupabaseRealtime()` khi trang load trong `xg-ton.js`**
Gọi `initSupabaseRealtime()` trong `loadSupabaseData()` hoặc `window.addEventListener('load')`.

- [ ] **Step 5: Commit thay đổi Task 2**
```bash
git add assets/js/xg/xg-ton.js
git commit -m "feat(xg-ton): add realtime and broadcast handlers for instant inventory deduction"
```

---

### Task 3: Cập nhật `assets/js/xg/xg-nhap.js` phát sự kiện khi nhập kho thay đổi

**Files:**
- Modify: `assets/js/xg/xg-nhap.js`

- [ ] **Step 1: Khởi tạo BroadcastChannel trong `xg-nhap.js`**
Thêm `xgChannel` và phát sự kiện `XG_NHAP_INSERT`, `XG_NHAP_DELETE`, `XG_NHAP_UPDATE`.

- [ ] **Step 2: Cập nhật form submit thêm cuộn nhập và xóa dòng nhập**
Phát tin nhắn và xóa/cập nhật cache `swr_cache_xg-ton`.

- [ ] **Step 3: Commit thay đổi Task 3**
```bash
git add assets/js/xg/xg-nhap.js
git commit -m "feat(xg-nhap): broadcast import changes to sync realtime inventory"
```

---

### Task 4: Cập nhật `assets/js/xg/xg-bieu-do.js` tự động đồng bộ biểu đồ và KPI

**Files:**
- Modify: `assets/js/xg/xg-bieu-do.js`

- [ ] **Step 1: Lắng nghe `xg_sync_channel` và Realtime trong `xg-bieu-do.js`**
Khi có sự kiện xuất/nhập, gọi hàm tính toán lại KPI và cập nhật biểu đồ với debounce.

- [ ] **Step 2: Commit thay đổi Task 4**
```bash
git add assets/js/xg/xg-bieu-do.js
git commit -m "feat(xg-bieu-do): update charts and stats on realtime xg inventory events"
```

---

### Task 5: Kiểm thử và Xác minh toàn diện (End-to-End Verification)

- [ ] **Step 1: Kiểm thử thao tác Thêm xuất nhiều cuộn trong `xg-xuat.html`**
Xác minh bảng `xg-ton.html` lập tức loại bỏ các cuộn vừa xuất và cập nhật tổng Kg nhóm tương ứng mà không cần reload trang.

- [ ] **Step 2: Kiểm thử Modal Chọn cuộn Tồn kho trong `xg-xuat.html`**
Xác minh cuộn vừa xuất không còn nằm trong danh sách chọn cuộn của modal nếu mở lại.

- [ ] **Step 3: Kiểm thử thao tác Xóa xuất trong `xg-xuat.html`**
Xác minh cuộn được trả lại bảng `xg-ton.html` tức thì.
