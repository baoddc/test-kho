# Thiết Kế: Tự Động Điền Thông Tin Chung, Danh Sách Mặt Hàng & Cuộn Xuất Khi Nhập Phiếu Xuất Thủ Công

## 1. Tổng Quan
Tính năng tự động điền (autofill) toàn diện khi người dùng nhập số phiếu xuất thủ công hoặc click chọn từ danh sách gợi ý SAP MB51 trên hai màn hình xuất kho: **Xà Gồ Xuất (`xg-xuat.html`)** và **Tole Xuất (`tole-xuat.html`)**.

Khi người dùng điền số phiếu xuất, hệ thống sẽ:
1. Tự động điền các trường **Thông tin chung**: Mã chứng từ (`PX`), Ngày xuất, Số phiếu, Loại xuất, Mã công trình, Tên công trình.
2. Tự động tạo các thẻ trong **Danh sách mặt hàng** tương ứng với tất cả các mặt hàng có trong phiếu xuất trên SAP MB51 (Mã VT, Tên VT kèm lô, Batch).
3. Tự động tra cứu tồn kho và điền toàn bộ các **Cuộn xuất (Cuộn ID, Số kg)** đang còn tồn kho khớp với Mã VT & Batch vào từng mặt hàng, đồng thời giữ khóa cuộn (`inventoryLockService`) để tránh xuất trùng.
4. Cập nhật đối chiếu tổng khối lượng cuộn thực tế vs khối lượng SAP yêu cầu.

---

## 2. Kiến Trúc & Luồng Dữ Liệu (Architecture & Data Flow)

```
[ Người dùng nhập/chọn Số phiếu xuất ]
                │
                ▼
      [ xg-sap-lookup.js ]
                │
  1. Query SAP MB51 (`xg_sap_mb51`) theo `material_document`
     Lọc theo `debit_credit_ind = 'H'` & Nhóm vật tư phù hợp (XG / Tole)
                │
                ├───────────────────────────────────────────────────────┐
                ▼                                                       ▼
      [ Thông tin chung ]                                     [ Danh sách dòng SAP ]
  - Ngày xuất: `posting_date`                             Gom nhóm theo Material + Batch
  - Số phiếu: `material_document`                                       │
  - Loại xuất: `movement_type_text`                                     ▼
  - Mã CT: `project_id`                              [ Bridge: populateExportReceiptData ]
  - Tên CT: `project_name`                            (trong `xg-xuat.js` / `tole-xuat.js`)
                                                                        │
                                              ┌─────────────────────────┴────────────────────────┐
                                              ▼                                                  ▼
                                    [ Tạo thẻ Mặt hàng ]                                [ Tra cứu Cuộn tồn kho ]
                               - Mã VT: `material`                              - Query `xg-nhap` / `tole-nhap`
                               - Tên VT: `material_description`                   theo `Mã vật tư` & `Batch`
                                 (merge Batch vào Tên VT)                       - Lọc bỏ các `Cuộn ID` đã có trong
                               - Batch: `batch`                                   `xg-xuat` / `tole-xuat`
                                                                                                 │
                                                                                                 ▼
                                                                                     [ Gán Cuộn vào thẻ & Khóa ]
                                                                                - `item.rolls.push({ cuonId, kg })`
                                                                                - `acquireLock(cuonId)`
                                                                                                 │
                                                                                                 ▼
                                                                                     [ Cập nhật Giao diện & Tổng ]
                                                                                - `renderItemCards()`
                                                                                - `updateMultiItemTotals()`
                                                                                - Hiển thị đối chiếu kg vs SAP
```

---

## 3. Chi Tiết Triển Khai Kỹ Thuật

### 3.1. Phía Module Tra Cứu SAP (`assets/js/xg/xg-sap-lookup.js`)
- Mở rộng hàm `applySapRecordToForm(sapRecord, formEl, currentContext)`:
  - Khi ngữ cảnh là `xg-xuat` hoặc `tole-xuat`:
    1. Truy vấn toàn bộ các dòng thuộc `sapRecord.material_document` từ bảng `xg_sap_mb51`.
    2. Gom nhóm các dòng theo cặp `material` + `batch`, tính tổng khối lượng SAP của từng nhóm (`itemTotalSapKg`) và toàn phiếu (`receiptTotalSapKg`).
    3. Điền các trường Thông tin chung:
       - Mã chứng từ: Gán `"PX"`.
       - Ngày xuất: Gán `posting_date`.
       - Số phiếu xuất: Gán `material_document`.
       - Loại xuất: Chọn option phù hợp với `movement_type_text` (nếu không có thì bổ sung option động).
       - Mã công trình: Gán `project_id`.
       - Tên công trình: Gán `project_name`.
    4. Gọi hàm bridge: `window.populateExportReceiptData(sapHeader, sapItemsGrouped)`.

### 3.2. Phía Màn Hình Xuất Kho (`assets/js/xg/xg-xuat.js` & `assets/js/tole/tole-xuat.js`)
- Định nghĩa hàm công khai `window.populateExportReceiptData(headerInfo, itemsGrouped)`:
  - **Bước 1**: Nhận mảng các mặt hàng từ SAP `itemsGrouped: Array<{ maVatTu, tenVatTu, batch, totalSapKg }>`.
  - **Bước 2**: Khởi tạo mảng `multiItemsData`:
    ```javascript
    multiItemsData = itemsGrouped.map(item => ({
      id: Math.random().toString(36).slice(2),
      maVatTu: item.maVatTu,
      tenVatTu: mergeBatchIntoTenVatTu(item.tenVatTu, item.batch),
      batch: item.batch,
      sapKg: item.totalSapKg,
      rolls: []
    }));
    ```
  - **Bước 3**: Tra cứu tồn kho bất đồng bộ cho từng mặt hàng:
    - Truy vấn danh sách cuộn trong kho tương ứng:
      - XG: Bảng `xg-nhap` (chưa có trong `xg-xuat`).
      - Tole: Bảng `tole-nhap` (chưa có trong `tole-xuat`).
    - Lọc các cuộn khớp với `Mã vật tư` và `Batch`.
    - Thêm các cuộn tồn tìm được vào `item.rolls`:
      ```javascript
      item.rolls.push({
        id: Math.random().toString(36).slice(2),
        cuonId: row['Cuộn ID'],
        kg: String(row['Số lượng (Kg)'] || row['Tồn cuối (Kg)'] || 0)
      });
      ```
    - Kích hoạt khóa đồng thời: `if (window.inventoryLockService) window.inventoryLockService.acquireLock(cuonId)`.
  - **Bước 4**: Render lại giao diện:
    - Gọi `renderItemCards()`.
    - Gọi `updateMultiItemTotals()`.
    - Hiển thị badge / thanh đối chiếu khối lượng cuộn vs khối lượng SAP.
    - Hiển thị Toast thông báo thành công: *"✓ Đã tự động điền phiếu xuất [Số phiếu]: [X] mặt hàng, [Y] cuộn tồn kho"*.

### 3.3. Xử Lý Khi Hủy Modal / Xóa Cuộn
- Khi người dùng bấm xóa 1 cuộn khỏi thẻ mặt hàng: Tự động gọi `releaseLock(cuonId)`.
- Khi người dùng bấm nút Hủy hoặc đóng modal thêm: Duyệt qua toàn bộ cuộn đã được gán và gọi `releaseLock` cho tất cả cuộn đang giữ.

---

## 4. Kiểm Thử & Tiêu Chí Nghiệm Thu (Testing & Acceptance Criteria)
1. **Kiểm thử tự động (Unit / Integration Test)**:
   - Viết test suite kiểm tra:
     - Khi truyền vào phiếu xuất có 1 mặt hàng: Tạo đúng 1 thẻ mặt hàng và gán cuộn tồn kho tương ứng.
     - Khi truyền vào phiếu xuất có nhiều mặt hàng (multi-item): Tạo đủ N thẻ mặt hàng độc lập, mỗi thẻ chứa đúng cuộn của mặt hàng đó.
     - Kiểm tra các trường Thông tin chung (PX, Ngày, Loại xuất, Mã CT, Tên CT) được điền chính xác.
     - Kiểm tra tính toán tổng khối lượng và đối chiếu vs SAP.
2. **Kiểm thử giao diện thực tế trên cả 2 trang**:
   - `pages/xg/xg-xuat.html`
   - `pages/tole/tole-xuat.html`
   - Đồng bộ đầy đủ các file đã build sang `public/`, `dist/`, `dist-app/` qua `node scripts/sync-dist.js`.
