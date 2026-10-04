# Thiết Kế Tìm Kiếm Toàn Bộ Tồn Kho Trong Modal Chọn Cuộn (Xà Gồ & Tole)

## 1. Mục tiêu & Bối cảnh
Khi thủ kho lập phiếu xuất xà gồ hoặc tole, người dùng nhấn nút `+ Chọn cuộn từ kho` để mở modal `inventoryRollsModal`.
Trước đây, hệ thống chỉ truy vấn từ cơ sở dữ liệu các cuộn khớp chính xác với `Mã vật tư` và `Lô (Batch)` của mặt hàng hiện tại. Điều này dẫn đến:
- Danh sách cuộn bị giới hạn cục bộ trong lô/mã đó.
- Ô tìm kiếm "Tìm kiếm tất cả..." chỉ lọc trên số ít cuộn đã được tải về, không thể tìm được các cuộn khác trong kho (khác lô, khác mã, hoặc tìm trực tiếp theo mã vạch / Cuộn ID toàn kho).

Mục tiêu của thiết kế này là:
1. Khi mở modal, tải toàn bộ danh sách cuộn tồn khả dụng trong kho (chưa xuất) vào bộ nhớ tạm (`allInventoryData`).
2. Mặc định hiển thị danh sách cuộn ưu tiên theo `Mã vật tư` và `Batch` của mặt hàng hiện tại.
3. Cung cấp nút bấm nhanh "Xem tất cả tồn kho / Xóa lọc" trên tiêu đề modal.
4. Khi người dùng nhập bất kỳ từ khóa nào vào ô tìm kiếm ("Tìm kiếm tất cả..."), hệ thống tự động tìm kiếm trên TOÀN BỘ tồn kho (mọi Mã VT, Tên VT, Batch, Cuộn ID).
5. Khi người dùng chọn cuộn và bấm "Đồng ý", nếu thẻ mặt hàng đang trống Mã VT, Tên VT hoặc Batch thì tự động điền theo cuộn đã chọn. Nếu đã có sẵn thì giữ nguyên thông tin phiếu xuất.

---

## 2. Chi Tiết Kỹ Thuật

### 2.1. Tải và Lưu Trữ Dữ Liệu Tồn Kho (`openInventoryModal`)
Áp dụng trên cả `assets/js/xg/xg-xuat.js` và `assets/js/tole/tole-xuat.js`:
- Loại bỏ điều kiện lọc cứng `.ilike('Mã vật tư', ...)` và `.ilike('Batch', ...)` trong vòng lặp phân trang tải dữ liệu nhập kho (`xg-nhap` / `tole-nhap`).
- Lọc bỏ các cuộn đã xuất thông qua danh sách `exportedCuonIds` lấy từ bảng xuất (`xg-xuat` / `tole-xuat`).
- Lưu toàn bộ danh sách tồn khả dụng vào biến `allInventoryData`.
- Lưu trữ bộ lọc mặc định ban đầu:
  - `currentMaVatTuFilter = maVatTu`
  - `currentBatchFilter = batch`
  - `isFilterCleared = false`

### 2.2. Giao Diện Tiêu Đề Modal (`#inventoryFilterInfo`)
- Hiển thị thông tin lọc khi `isFilterCleared === false` và có `maVatTu` hoặc `batch`:
  ```html
  Đang lọc: Mã VT: <strong>...</strong> | Lô (Batch): <strong>...</strong>
  <button type="button" class="btn btn-xs btn-outline-light ms-2 py-0 px-2 rounded-pill" id="btnClearInventoryFilter" style="font-size: 0.75rem;">
    <i class="bi bi-x-circle me-1"></i>Xem tất cả kho
  </button>
  ```
- Khi người dùng click nút "Xem tất cả kho":
  - Đặt `isFilterCleared = true`.
  - Hiển thị toàn bộ tồn kho `allInventoryData`.
  - Cập nhật tiêu đề sang: `Hiển thị toàn bộ tồn kho`.
- Khi người dùng gõ vào ô tìm kiếm (`#inventorySearchInput`):
  - Nếu từ khóa có độ dài > 0: Tìm kiếm trên toàn bộ `allInventoryData` qua các cột: `Mã vật tư`, `Tên vật tư`, `Batch`, `Cuộn ID`.
  - Nếu từ khóa bị xóa trống:
    - Nếu `isFilterCleared === true`: Hiển thị toàn bộ `allInventoryData`.
    - Nếu `isFilterCleared === false`: Hiển thị lại danh sách lọc theo `currentMaVatTuFilter` và `currentBatchFilter`.

### 2.3. Cập Nhật Thẻ Mặt Hàng Khi Xác Nhận (`btnConfirmInventorySelection`)
- Khi chọn các cuộn và bấm "Đồng ý":
  - Duyệt qua các checkbox được chọn:
    - Lấy thông tin `cuonId`, `tonKg`, `maVatTu`, `tenVatTu`, `batch` từ dataset của dòng hoặc đối tượng tương ứng.
    - Thêm cuộn vào mảng `item.rolls`.
  - Kiểm tra thẻ mặt hàng hiện tại (`multiItemsData[currentItemTargetIndex]`):
    - Nếu `!item.maVatTu` và cuộn có `Mã vật tư`: Gán `item.maVatTu = roll.maVatTu`.
    - Nếu `!item.tenVatTu` và cuộn có `Tên vật tư`: Gán `item.tenVatTu = roll.tenVatTu`.
    - Nếu `!item.batch` và cuộn có `Batch`: Gán `item.batch = roll.batch`.
  - Cập nhật lại giao diện các thẻ mặt hàng (`renderItemCards()`).

---

## 3. Quản Lý Khóa Cuộn (`inventoryLockService`)
- Tích hợp liền mạch với dịch vụ khóa cuộn `window.inventoryLockService`:
  - Giữ nguyên cơ chế kiểm tra `isLockedByOther` và `isLocked && isMe`.
  - Khi render lại bảng cuộn (sau khi tìm kiếm hoặc xóa lọc), giữ nguyên trạng thái checkbox đã tick của người dùng và các cuộn đang bị khóa bởi tài khoản khác.

---

## 4. Kế Hoạch Đồng Bộ & Kiểm Thử
1. Viết test suite `tests/test-search-all-warehouse-rolls.js` kiểm tra các kịch bản:
   - Truy vấn không lọc cứng mã/batch khi lấy tồn kho.
   - Cơ chế tìm kiếm toàn bộ kho khi ô tìm kiếm có nội dung.
   - Cơ chế nút "Xem tất cả kho" và tự động điền thông tin vào thẻ mặt hàng khi trống.
2. Cập nhật `xg-xuat.js`, `tole-xuat.js`, `xg-xuat.html`, `tole-xuat.html`.
3. Chạy `scripts/sync-dist.js` để đồng bộ sang `dist/`, `dist-app/`, `public/`.
