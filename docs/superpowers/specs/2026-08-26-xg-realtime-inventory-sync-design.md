# Thiết kế Kỹ thuật: Đồng bộ Trừ Tồn Xà Gồ Tức Thì (Realtime & Local Reactive Sync)

## 1. Mục tiêu & Bối cảnh
- **Vấn đề:** Hiện tại, khi người dùng nhập/xuất dữ liệu ở trang `xg-xuat` (Xuất xà gồ), trang `xg-ton` (Tồn xà gồ) và popup chọn cuộn tồn kho trong `xg-xuat` không tự động trừ tồn nếu người dùng không reload / F5 lại trang. Ngoài ra, người dùng ở các máy tính khác cũng không thấy tồn kho giảm theo thời gian thực.
- **Giải pháp:** Xây dựng cơ chế phản ứng tức thì (Reactive) kết hợp đa tầng:
  1. **BroadcastChannel (`xg_sync_channel`):** Đồng bộ nội bộ tức thì giữa các tab/iframe trên cùng trình duyệt (độ trễ ~0ms).
  2. **Supabase Realtime (`postgres_changes`):** Lắng nghe sự kiện thêm/sửa/xóa trên các bảng `xg-xuat` và `xg-nhap` để đồng bộ thời gian thực giữa nhiều máy tính / thiết bị khác nhau.
  3. **Local In-Memory & SWR Cache Synchronization:** Cập nhật trực tiếp `window._rawSupabaseData`, bảng hiển thị `tableData`, và `sessionStorage` (`swr_cache_xg-ton`) mà không làm mất trạng thái bộ lọc (filter), tìm kiếm (search), hay vị trí cuộn trang (scroll).

---

## 2. Kiến trúc & Luồng dữ liệu (Data Architecture)

```
┌───────────────────────────────────────┐
│     xg-xuat.js (Thao tác xuất)        │
│  - Thêm dữ liệu xuất nhiều cuộn       │
│  - Sửa / Xóa dữ liệu xuất             │
└──────────────────┬────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
  [Supabase Database]  [BroadcastChannel: 'xg_sync_channel']
  (Bảng: xg-xuat)      (Giao tiếp tức thì giữa các tab/iframe)
         │                   │
         ├───────────────────┘
         │
         ▼ (Sự kiện INSERT / UPDATE / DELETE)
┌────────────────────────────────────────────────────────┐
│  Các module nhận & cập nhật (xg-ton, xg-xuat, xg-bieu-do):
│  - xg-ton.js: Loại bỏ / Phục hồi Cuộn ID trong _rawSupabaseData
│  - xg-ton.js: filterTable(false) -> Cập nhật bảng + group sums
│  - xg-xuat.js: Loại bỏ Cuộn ID khỏi cachedInventoryData
│  - xg-bieu-do.js: Cập nhật lại số liệu KPI & biểu đồ
│  - sessionStorage: Cập nhật đè swr_cache_xg-ton
└────────────────────────────────────────────────────────┘
```

---

## 3. Chi tiết thực hiện từng thành phần

### 3.1. Module Xuất Xà Gồ (`xg-xuat.js`)
1. **Khởi tạo Broadcast Channel:**
   - Tạo kênh `const xgChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('xg_sync_channel') : null;`.
2. **Khi Thêm dữ liệu xuất (`addDataForm` submit thành công):**
   - Sau khi Supabase insert thành công danh sách các cuộn xuất:
     - Lấy danh sách `Cuộn ID` vừa xuất: `const exportedRollIds = rollDataList.map(r => r.cuonId).filter(Boolean);`.
     - Phát tin nhắn qua `xgChannel`:
       ```javascript
       if (xgChannel) {
         xgChannel.postMessage({
           type: 'XG_XUAT_INSERT',
           cuonIds: exportedRollIds,
           records: insertedData
         });
       }
       ```
     - Cập nhật bộ nhớ đệm `cachedInventoryData` trong `xg-xuat.js`: Loại bỏ các cuộn có `Cuộn ID` nằm trong `exportedRollIds`.
     - Đồng bộ lại `sessionStorage`: Cập nhật `swr_cache_xg-xuat` và xóa/cập nhật `swr_cache_xg-ton`.
3. **Khi Xóa dữ liệu xuất (`btnConfirmDelete` thành công):**
   - Lấy danh sách `Cuộn ID` của các dòng xuất bị xóa:
     - Phát tin nhắn `XG_XUAT_DELETE` với danh sách `cuonIds` được hoàn trả về tồn kho.
     - Cập nhật lại cache và phát tín hiệu.
4. **Popup Chọn Cuộn Tồn Kho (`inventoryRollsModal`):**
   - Khi mở modal `openInventoryModal()`, luôn đảm bảo lọc bỏ những `Cuộn ID` đã có trong `window._rawSupabaseData` của `xg-xuat`.

### 3.2. Module Tồn Xà Gồ (`xg-ton.js`)
1. **Lắng nghe BroadcastChannel nội bộ:**
   ```javascript
   const xgChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('xg_sync_channel') : null;
   if (xgChannel) {
     xgChannel.onmessage = (event) => {
       const msg = event.data;
       if (!msg || !msg.type) return;
       handleXgSyncMessage(msg);
     };
   }
   ```
2. **Lắng nghe Supabase Realtime đa thiết bị:**
   ```javascript
   function setupSupabaseRealtime() {
     if (!window.supabase) return;
     window.supabase
       .channel('public:xg_realtime_ton')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'xg-xuat' }, (payload) => {
         handleSupabaseXuatChange(payload);
       })
       .on('postgres_changes', { event: '*', schema: 'public', table: 'xg-nhap' }, (payload) => {
         handleSupabaseNhapChange(payload);
       })
       .subscribe();
   }
   ```
3. **Hàm xử lý trừ tồn tức thì (`handleXgSyncMessage` & `handleSupabaseXuatChange`):**
   - Khi có `INSERT` xuất kho:
     - Lấy tập hợp `Set` các `Cuộn ID` (viết thường, trim khoảng trắng).
     - Lọc `window._rawSupabaseData`:
       ```javascript
       window._rawSupabaseData = (window._rawSupabaseData || []).filter(item => {
         const cuonId = String(item['Cuộn ID'] || '').trim().toLowerCase();
         return !exportedCuonIds.has(cuonId);
       });
       ```
     - Tái cấu trúc `tableData = [COLUMN_HEADERS, ...window._rawSupabaseData.map(rowToArray)]`.
     - Gọi `filterTable(false)` để re-render giao diện hiển thị đúng nhóm (Grouping), tổng kg, mà không reset trang (resetPage = false).
     - Lưu lại cache: `setStoredTableCache('xg-ton', window._rawSupabaseData)`.
   - Khi có `DELETE` xuất kho:
     - Tải lại hoặc bổ sung lại cuộn nhập tương ứng vào `window._rawSupabaseData` và re-render.

### 3.3. Module Nhập Xà Gồ (`xg-nhap.js`)
- Khi người dùng thêm, sửa hoặc xóa dòng nhập kho trong `xg-nhap.js`, phát thông báo qua `xg_sync_channel` (`XG_NHAP_INSERT`, `XG_NHAP_DELETE`, `XG_NHAP_UPDATE`) để `xg-ton.js` và `xg-bieu-do.js` tự động bổ sung/trừ cuộn tồn ngay lập tức.

### 3.4. Module Biểu Đồ Dashboard (`xg-bieu-do.js`)
- Lắng nghe `xg_sync_channel` và Supabase Realtime channel `public:xg_realtime_bieudo` để tự động tính toán lại KPI tổng tồn, tổng xuất, tổng nhập và cập nhật biểu đồ ApexCharts mượt mà.

---

## 4. Xử lý trường hợp biên (Edge Cases & Fallbacks)
1. **Trùng lặp sự kiện (Broadcast vs Realtime):**
   - Khi máy A xuất hàng, BroadcastChannel sẽ kích hoạt ngay lập tức (0ms) trên máy A.
   - Vài trăm mili-giây sau, Supabase Realtime gửi lại payload của chính sự kiện đó.
   - Cơ chế kiểm tra `Cuộn ID` dạng `Set` đảm bảo hàm lọc Idempotent (không gây lỗi hay trừ 2 lần nếu cuộn đã bị trừ trước đó).
2. **Mất kết nối mạng / Offline:**
   - BroadcastChannel vẫn hoạt động bình thường trên cùng một trình duyệt ngay cả khi ngắt mạng internet tạm thời.
   - Khi mạng kết nối lại, Supabase Realtime tự động kết nối lại.
3. **Giữ nguyên trạng thái người dùng:**
   - Quá trình trừ tồn và re-render bảng không làm mất từ khóa đang gõ trong thanh tìm kiếm `searchInput` và không đẩy thanh cuộn chuột lên đầu trang.

---

## 5. Kế hoạch kiểm thử & Xác minh (Verification Plan)
1. **Kiểm thử trên cùng trình duyệt (Multi-tab):**
   - Mở tab 1: `xg-ton.html` (chú ý số lượng cuộn và tổng Kg của một mã vật tư cụ thể).
   - Mở tab 2: `xg-xuat.html`. Thực hiện xuất 1 hoặc nhiều cuộn thuộc mã vật tư đó.
   - Chuyển lại tab 1 hoặc quan sát: Xác minh cuộn vừa xuất đã biến mất khỏi bảng Tồn ngay lập tức và tổng Kg đã giảm mà không cần reload trang.
2. **Kiểm thử Modal Chọn cuộn trong `xg-xuat.html`:**
   - Mở popup "Chọn cuộn từ Tồn Kho", chọn 1 cuộn A và bấm Xuất.
   - Sau khi xuất thành công, mở lại popup "Chọn cuộn từ Tồn Kho": Xác minh cuộn A không còn xuất hiện trong danh sách tồn.
3. **Kiểm thử Xóa phiếu xuất:**
   - Trong `xg-xuat.html`, xóa phiếu xuất vừa tạo.
   - Kiểm tra `xg-ton.html`: Cuộn vừa xóa xuất hiện trở lại trong bảng tồn ngay lập tức mà không reload trang.
