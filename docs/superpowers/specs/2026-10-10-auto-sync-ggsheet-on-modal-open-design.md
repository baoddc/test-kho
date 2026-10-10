# Thiết kế Kỹ thuật: Tự Động Đồng Bộ Google Sheets Khi Mở Modal Thêm / Sửa Dữ Liệu

- **Ngày tạo**: 2026-10-10
- **Trạng thái**: Đã phê duyệt (Phương án 1)
- **Phạm vi áp dụng**: 
  - Giao diện: `pages/xg/xg-nhap.html`, `pages/xg/xg-xuat.html`, `pages/tole/tole-nhap.html`, `pages/tole/tole-xuat.html`
  - Script xử lý: `assets/js/xg/xg-sap-lookup.js`, `assets/js/xg/xg-nhap.js`, `assets/js/xg/xg-xuat.js`, `assets/js/tole/tole-nhap.js`, `assets/js/tole/tole-xuat.js`
  - Build/Sync: `scripts/sync-dist.js` (đồng bộ sang `dist/`, `public/`, `dist-app/`)

---

## 1. Bối cảnh & Yêu cầu Nghiệp Vụ

### 1.1. Thực trạng hiện tại
- Dữ liệu hóa đơn, chứng từ SAP MB51 được cập nhật thường xuyên lên Google Sheets (sheet `mb51`, Spreadsheet ID: `1BPY6k2bQuDu-RNpkRc3BhS57CuM1Ol__FYXvY8ezRjs`).
- Khi thủ kho mở modal **"Thêm dữ liệu"** (hoặc **"Sửa dữ liệu"**) tại 4 màn hình chính:
  1. Kho Xà gồ - Nhập (`xg-nhap.html`)
  2. Kho Xà gồ - Xuất (`xg-xuat.html`)
  3. Kho Tole - Nhập (`tole-nhap.html`)
  4. Kho Tole - Xuất (`tole-xuat.html`)
- Người dùng hiện phải bấm chuột thủ công vào nút **"Đồng bộ Google Sheets"** (`#btnSyncGgSheet` hoặc `#btnEditSyncGgSheet`) để nạp các chứng từ mới nhất vào bảng Supabase `xg_sap_mb51` trước khi tra cứu ô số phiếu nhập/xuất.

### 1.2. Yêu cầu mới
- Khi mở modal **"Thêm dữ liệu"** (và cả modal **"Sửa dữ liệu"**), hệ thống **tự động kích hoạt đồng bộ dữ liệu từ Google Sheets sang Supabase** mà không yêu cầu người dùng phải bấm nút thủ công.
- Quá trình chạy ngầm, không khóa màn hình hay cản trở người dùng nhập liệu các trường khác.
- Giữ nguyên nút bấm thủ công trên modal để người dùng vẫn có thể bấm lại bất kỳ lúc nào nếu muốn ép đồng bộ lại.
- Có cơ chế **chống gọi trùng lặp (Concurrency Control)**: Tránh gửi nhiều request cùng lúc nếu người dùng mở/đóng modal liên tục hoặc nếu tiến trình đồng bộ trước đó chưa hoàn thành.
- Cơ chế xử lý lỗi an toàn (Non-intrusive Error Handling): Nếu chạy tự động mà mạng yếu hoặc lỗi API, chỉ cảnh báo qua Toast nhẹ nhàng, không hiển thị popup `alert()` gây gián đoạn thao tác của người dùng.

---

## 2. Thiết kế Kiến trúc & Giải pháp Chi tiết

### 2.1. Cải tiến module `syncFromGoogleSheets` trong `assets/js/xg/xg-sap-lookup.js`

Module `xg-sap-lookup.js` là nơi tập trung logic đồng bộ dữ liệu GViz Google Sheets về Supabase `xg_sap_mb51`.

1. **Thêm cờ trạng thái module**:
   ```javascript
   let _isSyncing = false;
   let _activeSyncPromise = null;
   ```
2. **Mở rộng tham số hàm `syncFromGoogleSheets(btnEl, options = {})`**:
   - `options.isAuto` (boolean, mặc định `false`): Cho biết lần gọi này là do tự động kích hoạt khi mở modal hay do người dùng bấm thủ công.
   - `options.silentOnError` (boolean, mặc định `false`): Tự động bật khi `isAuto === true`.
3. **Cơ chế chống gọi trùng (Concurrency Guard)**:
   - Nếu `_isSyncing === true`:
     - Nếu có `btnEl` được truyền vào, vẫn cập nhật giao diện của `btnEl` sang trạng thái spinner đang tải.
     - Trả về Promise đang chạy `_activeSyncPromise` thay vì tạo request mới đè lên Supabase.
   - Khi bắt đầu: Đặt `_isSyncing = true`.
   - Lưu Promise đang thực thi vào `_activeSyncPromise`.
4. **Cập nhật giao diện nút bấm**:
   - Nút `btnEl` chuyển sang trạng thái disabled và hiển thị:
     `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang đồng bộ Google Sheets...`
5. **Xử lý lỗi**:
   - Nếu lỗi xảy ra trong lần gọi tự động (`options.isAuto === true`):
     - Log chi tiết vào `console.warn('[XgSapLookup] Tự động đồng bộ Google Sheets gặp sự cố:', err);`
     - Hiển thị Toast thông báo nhẹ nhàng: `showAutofillToast('⚠️ Tự động đồng bộ GgSheet không thành công: ' + (err.message || 'Mất kết nối'));`
     - Không dùng hàm `alert(...)` để tránh chặn giao diện người dùng.
   - Nếu lỗi xảy ra khi bấm thủ công (`options.isAuto === false`):
     - Giữ nguyên thông báo `alert(...)` như hiện tại để người dùng biết nguyên nhân.
6. **Khối giải phóng `finally`**:
   - `_isSyncing = false;`
   - `_activeSyncPromise = null;`
   - Phục hồi trạng thái enabled và icon mặc định cho `btnEl`.

---

### 2.2. Tích hợp tự động kích hoạt trong các file Logic nghiệp vụ

#### 1. `assets/js/xg/xg-nhap.js`
- **Hàm `openAddDataModal()`**:
  - Sau khi gắn sự kiện click cho `btnSyncGgSheet`:
    ```javascript
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
    }
    ```
- **Hàm `openEditDataModal()`**:
  - Sau khi gắn sự kiện click cho `btnEditSyncGgSheet`:
    ```javascript
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnEditSyncGgSheet, { isAuto: true });
    }
    ```

#### 2. `assets/js/xg/xg-xuat.js`
- **Hàm `openAddDataModal()`**:
  - Sau khi gắn sự kiện click cho `btnSyncGgSheet`:
    ```javascript
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
    }
    ```

#### 3. `assets/js/tole/tole-nhap.js`
- **Hàm `openAddDataModal()`**:
  - Sau khi gắn sự kiện click cho `btnSyncGgSheet`:
    ```javascript
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
    }
    ```
- **Hàm `openEditDataModal()`**:
  - Sau khi gắn sự kiện click cho `btnEditSyncGgSheet`:
    ```javascript
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnEditSyncGgSheet, { isAuto: true });
    }
    ```

#### 4. `assets/js/tole/tole-xuat.js`
- **Hàm `openAddDataModal()`**:
  - Sau khi gắn sự kiện click cho `btnSyncGgSheet`:
    ```javascript
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
    }
    ```

---

### 2.3. Quy trình Build & Đồng bộ Thư mục (`scripts/sync-dist.js`)

Theo cấu trúc dự án `test-kho`, mã nguồn gốc nằm tại `pages/` và `assets/`.
Sau khi chỉnh sửa xong các file trong `assets/js/`:
1. Chạy lệnh:
   ```powershell
   node scripts/sync-dist.js
   ```
2. Lệnh sẽ tự động sao chép toàn bộ thay đổi sang các thư mục:
   - `dist/assets/`
   - `public/assets/`
   - `dist-app/assets/`

---

## 3. Kế hoạch Kiểm Thử & Tiêu Chí Nghiệm Thu

| STT | Kịch bản kiểm thử | Kết quả mong đợi |
| :---: | :--- | :--- |
| 1 | Mở trang Kho Xà gồ - Nhập (`xg-nhap.html`), bấm "Thêm dữ liệu" | Modal hiển thị; Nút "Đồng bộ Google Sheets" tự động xoay spinner; Sau khi nạp xong, hiện Toast thành công và nút trở về bình thường. Không cần bấm nút. |
| 2 | Mở modal "Sửa dữ liệu" tại `xg-nhap.html` | Nút đồng bộ trên card Thông tin chung tự động chạy ngầm tương tự. |
| 3 | Mở modal "Thêm dữ liệu" tại `xg-xuat.html`, `tole-nhap.html`, `tole-xuat.html` | Tự động kích hoạt đồng bộ thành công ở cả 3 trang. |
| 4 | Mở modal "Sửa dữ liệu" tại `tole-nhap.html` | Tự động kích hoạt đồng bộ thành công. |
| 5 | Bấm nút thủ công khi modal đã mở | Vẫn chạy đồng bộ thủ công bình thường. |
| 6 | Thao tác mở/đóng modal liên tục | Cờ `_isSyncing` ngăn chặn gọi request trùng lặp; không sinh ra lỗi race condition hoặc spam delete/insert vào Supabase. |
| 7 | Mô phỏng ngắt mạng khi mở modal | Hệ thống hiện Toast cảnh báo lỗi nhẹ nhàng, không bật popup `alert()`, người dùng vẫn tiếp tục thao tác form bình thường. |
