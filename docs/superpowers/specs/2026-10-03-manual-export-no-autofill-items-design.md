# Thiết Kế: Không Tự Động Điền Mặt Hàng & Cuộn Xuất Khi Nhập Phiếu Xuất (Chọn Thủ Công)

## 1. Tổng Quan & Bối Cảnh
Trước đây, khi người dùng nhập số phiếu xuất hoặc click chọn từ danh sách gợi ý SAP MB51 trên màn hình **Xà Gồ Xuất (`xg-xuat.html`)** và **Tole Xuất (`tole-xuat.html`)**, hệ thống tự động:
1. Điền Thông tin chung phiếu xuất (Mã chứng từ, Ngày xuất, Số phiếu, Loại xuất, Mã CT, Tên CT).
2. Tự động gom nhóm toàn bộ mặt hàng có trong phiếu xuất SAP MB51 và tạo các thẻ mặt hàng.
3. Tự động truy vấn bảng tồn kho (`xg-nhap` / `tole-nhap`) và nhồi tất cả cuộn khớp Mã vật tư & Lô/Batch vào danh sách cuộn xuất.

**Yêu cầu mới**:
- Khi người dùng nhập/chọn phiếu xuất, hệ thống **CHỈ** tự động điền các trường trong **Thông tin chung phiếu xuất** (Mã chứng từ `PX`, Ngày xuất, Loại xuất, Mã công trình, Tên công trình).
- Hệ thống **KHÔNG** tự động điền **Danh sách mặt hàng & cuộn xuất**.
- Phần "Danh sách mặt hàng & cuộn xuất" sẽ do người dùng chủ động thao tác thủ công:
  - Tự nhập hoặc bấm "+ Thêm mặt hàng".
  - Tự bấm nút "+ Chọn cuộn từ kho" để mở modal tra cứu tồn kho và tích chọn các cuộn thực tế cần xuất.

---

## 2. Kiến Trúc & Luồng Dữ Liệu Sau Thay Đổi

```
[ Người dùng nhập/chọn Số phiếu xuất ]
                │
                ▼
      [ xg-sap-lookup.js ]
                │
   Query SAP MB51 (`xg_sap_mb51`) lấy record SAP khớp số phiếu
                │
                ▼
      [ Thông tin chung ]
   - Mã chứng từ: `PX`
   - Ngày xuất: `posting_date`
   - Số phiếu: `material_document`
   - Loại xuất: `movement_type_text`
   - Mã CT: `project_id`
   - Tên CT: `project_name`
                │
                ▼
      [ Bridge: populateExportReceiptData(headerInfo) ]
         (trong `xg-xuat.js` / `tole-xuat.js`)
                │
                ├───────────────────────────────────────────────────────┐
                ▼                                                       ▼
      [ Điền Thông tin chung ]                                [ Danh sách mặt hàng & cuộn ]
   - Gán giá trị vào form thêm                             - KHÔNG tự tạo thẻ mặt hàng từ SAP
   - Hiệu ứng highlight autofill                           - KHÔNG tự động truy vấn cuộn tồn kho
                                                           - Giữ thẻ mặt hàng mặc định rỗng
                                                           - Người dùng tự bấm:
                                                             + "+ Thêm mặt hàng"
                                                             + "+ Chọn cuộn từ kho" (chọn thủ công)
```

---

## 3. Chi Tiết Triển Khai Kỹ Thuật

### 3.1. Phía Module Tra Cứu SAP (`assets/js/xg/xg-sap-lookup.js`)
- Trong hàm `applySapRecordToForm(sapRecord, formEl, currentContext)`:
  - Khi ngữ cảnh là xuất kho (`xg-xuat` hoặc `tole-xuat`):
    - Chuẩn bị `headerInfo`:
      ```javascript
      const headerInfo = {
        maChungTu: 'PX',
        ngayXuat: sapRecord.posting_date || '',
        phieuXuat: sapRecord.material_document || '',
        loaiXuat: sapRecord.movement_type_text || '',
        maCongTrinh: sapRecord.project_id || '',
        tenCongTrinh: sapRecord.project_name || ''
      };
      ```
    - Gọi bridge: `await window.populateExportReceiptData(headerInfo)`.
    - Bỏ việc truy vấn gom nhóm `allDocRows` từ `xg_sap_mb51` và không truyền `itemsGrouped` để tránh tự động điền danh sách mặt hàng/cuộn.

### 3.2. Phía Màn Hình Xuất Kho (`assets/js/xg/xg-xuat.js` & `assets/js/tole/tole-xuat.js`)
- Trong hàm `populateExportReceiptFromSap(headerInfo)`:
  - Điền các trường Thông tin chung: `Mã chứng từ`, `Ngày xuất`, `Số phiếu xuất`, `Loại xuất`, `Mã công trình`, `Tên công trình`.
  - Giữ nguyên thẻ mặt hàng hiện tại hoặc nếu `multiItemsData` đang rỗng thì khởi tạo 1 thẻ mặc định trắng (`rolls: []`).
  - Loại bỏ hoàn toàn:
    - Khối code tự động tạo nhiều thẻ mặt hàng từ `itemsGrouped`.
    - Khối code truy vấn `xg-nhap` / `tole-nhap` và tự thêm hàng loạt cuộn vào `item.rolls`.
  - Hiển thị Toast thông báo:
    - `✓ Đã điền thông tin chung phiếu xuất: [Số phiếu]`
  - Giữ nguyên chức năng thủ công: Người dùng bấm **"+ Chọn cuộn từ kho"** (`btn-item-pick-inv`) để mở modal `openInventoryModal` chọn cuộn theo ý muốn.

### 3.3. Đồng Bộ Bản Build & Cập Nhật Test Suite
- Cập nhật test `tests/test-manual-export-autofill.js` phù hợp với hành vi mới (chỉ điền Thông tin chung, không nạp cuộn tự động).
- Chạy `node scripts/sync-dist.js` để đồng bộ sang `dist/`, `dist-app/`, `public/`.

---

## 4. Tiêu Chí Nghiệm Thu (Acceptance Criteria)
1. Khi nhập/chọn Số phiếu xuất trên modal thêm của `xg-xuat.html`:
   - Các trường Thông tin chung (Mã chứng từ, Ngày xuất, Loại xuất, Mã CT, Tên CT) được điền đầy đủ và chính xác từ SAP.
   - Phần "Danh sách mặt hàng & cuộn xuất" không bị tự động tạo thêm thẻ hay tự động điền cuộn từ cơ sở dữ liệu tồn kho.
   - Nút "+ Thêm mặt hàng" và "+ Chọn cuộn từ kho" vẫn hoạt động bình thường cho phép chọn cuộn thủ công.
2. Khi nhập/chọn Số phiếu xuất trên modal thêm của `tole-xuat.html`:
   - Hoạt động nhất quán như trên màn hình xà gồ xuất.
3. Test suite tự động `node tests/test-manual-export-autofill.js` vượt qua 100% không có lỗi hồi quy.
