# Kế Hoạch Triển Khai: Chuyển Sang Chọn Thủ Công Mặt Hàng & Cuộn Xuất Khi Nhập Phiếu Xuất

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ngăn chặn việc tự động điền danh sách mặt hàng và cuộn tồn kho khi nhập/chọn số phiếu xuất trên hai màn hình xg-xuat và tole-xuat, chỉ tự động điền Thông tin chung phiếu xuất và để người dùng chọn mặt hàng/cuộn thủ công.

**Architecture:** Điều chỉnh module `xg-sap-lookup.js` để khi tìm thấy phiếu xuất SAP thì chỉ trích xuất thông tin chung (Mã CT, Tên CT, Ngày xuất, Loại xuất, Số phiếu) và chuyển giao cho `window.populateExportReceiptData(headerInfo)`. Đồng thời điều chỉnh `populateExportReceiptFromSap` trong `xg-xuat.js` và `tole-xuat.js` để chỉ gán thông tin chung vào form, giữ nguyên danh sách thẻ mặt hàng thủ công và không tự động truy vấn cuộn tồn kho.

**Tech Stack:** JavaScript (ES6+), Supabase JS Client, Bootstrap 5 Modal & Forms, Node.js test runner.

## Global Constraints
- Nguồn mã nguồn chính nằm ở thư mục `assets/js/`.
- Sau khi chỉnh sửa `assets/js/`, bắt buộc chạy `node scripts/sync-dist.js` (hoặc `npm run build`) để đồng bộ sang `dist/`, `dist-app/`, và `public/`.
- Giữ nguyên các chức năng thủ công hiện có: nút "+ Thêm mặt hàng", nút "+ Chọn cuộn từ kho" (`openInventoryModal`), kiểm tra quyền và khóa cuộn khi người dùng tự chọn cuộn.

---

### Task 1: Điều chỉnh logic SAP Lookup cho màn hình xuất kho trong `assets/js/xg/xg-sap-lookup.js`

**Files:**
- Modify: `assets/js/xg/xg-sap-lookup.js:1320-1395`
- Test: `tests/test-manual-export-autofill.js`

**Interfaces:**
- Consumes: `sapRecord` từ bảng `xg_sap_mb51`
- Produces: `window.populateExportReceiptData(headerInfo)` với `headerInfo: { maChungTu, ngayXuat, phieuXuat, loaiXuat, maCongTrinh, tenCongTrinh }`

- [ ] **Step 1: Viết test case kiểm tra applySapRecordToForm chỉ gọi populateExportReceiptData với headerInfo**

Trong `tests/test-manual-export-autofill.js`, kiểm tra `applySapRecordToForm` với context `xg-xuat` chỉ truyền `headerInfo` mà không truyền mảng `itemsGrouped` tự động điền mặt hàng/cuộn.

- [ ] **Step 2: Chỉnh sửa `assets/js/xg/xg-sap-lookup.js`**

Thay thế khối truy vấn gom nhóm `allDocRows` và gọi `populateExportReceiptData`:
```javascript
      // Chuẩn bị thông tin chung phiếu xuất
      const headerInfo = {
        maChungTu: 'PX',
        ngayXuat: sapRecord.posting_date || '',
        phieuXuat: sapRecord.material_document || '',
        loaiXuat: sapRecord.movement_type_text || '',
        maCongTrinh: sapRecord.project_id || '',
        tenCongTrinh: sapRecord.project_name || ''
      };

      if (typeof window.populateExportReceiptData === 'function') {
        await window.populateExportReceiptData(headerInfo);
      } else {
        showAutofillToast(`Đã tự động điền thông tin phiếu SAP: ${sapRecord.material_document}`);
      }
```

- [ ] **Step 3: Chạy test xác nhận logic lookup**

Run: `node tests/test-manual-export-autofill.js`

- [ ] **Step 4: Commit thay đổi**

```bash
git add assets/js/xg/xg-sap-lookup.js
git commit -m "feat(sap-lookup): only populate export header info without auto items"
```

---

### Task 2: Điều chỉnh `populateExportReceiptFromSap` trong `assets/js/xg/xg-xuat.js`

**Files:**
- Modify: `assets/js/xg/xg-xuat.js:1480-1625`
- Test: `tests/test-manual-export-autofill.js`

**Interfaces:**
- Consumes: `headerInfo` từ `xg-sap-lookup.js`
- Produces: Điền trường Thông tin chung phiếu xuất, giữ nguyên thẻ mặt hàng thủ công, không nạp cuộn tự động.

- [ ] **Step 1: Sửa hàm `populateExportReceiptFromSap` trong `assets/js/xg/xg-xuat.js`**

Cập nhật hàm để:
1. Điền Mã chứng từ (`PX`), Ngày xuất, Phiếu xuất, Loại xuất, Mã công trình, Tên công trình.
2. Kiểm tra nếu `multiItemsData` chưa có thẻ nào thì tạo 1 thẻ mặc định trắng (`rolls: []`). Nếu đã có thẻ thì giữ nguyên để người dùng tự nhập hoặc bấm "+ Chọn cuộn từ kho".
3. Loại bỏ hoàn toàn khối truy vấn `xg-nhap` nạp cuộn tự động.
4. Hiển thị Toast: `✓ Đã điền thông tin chung phiếu xuất: ${headerInfo.phieuXuat || ''}`.

- [ ] **Step 2: Kiểm tra cú pháp và biến toàn cục**

Xác nhận `window.populateExportReceiptData` vẫn được expose bình thường.

- [ ] **Step 3: Commit thay đổi**

```bash
git add assets/js/xg/xg-xuat.js
git commit -m "feat(xg-xuat): keep manual items and coils selection on export receipt entry"
```

---

### Task 3: Điều chỉnh `populateExportReceiptFromSap` trong `assets/js/tole/tole-xuat.js`

**Files:**
- Modify: `assets/js/tole/tole-xuat.js:1480-1625`
- Test: `tests/test-manual-export-autofill.js`

**Interfaces:**
- Consumes: `headerInfo` từ `xg-sap-lookup.js`
- Produces: Tương tự xg-xuat, chỉ điền Thông tin chung, để danh sách mặt hàng và cuộn xuất thủ công.

- [ ] **Step 1: Sửa hàm `populateExportReceiptFromSap` trong `assets/js/tole/tole-xuat.js`**

Cập nhật hàm để:
1. Điền các trường Thông tin chung phiếu xuất.
2. Giữ nguyên thẻ mặt hàng trắng, loại bỏ khối code truy vấn `tole-nhap` nạp cuộn tự động.
3. Hiển thị Toast: `✓ Đã điền thông tin chung phiếu xuất: ${headerInfo.phieuXuat || ''}`.

- [ ] **Step 2: Commit thay đổi**

```bash
git add assets/js/tole/tole-xuat.js
git commit -m "feat(tole-xuat): keep manual items and coils selection on export receipt entry"
```

---

### Task 4: Cập nhật kiểm thử tự động, đồng bộ bản build và nghiệm thu

**Files:**
- Modify: `tests/test-manual-export-autofill.js`
- Sync: `node scripts/sync-dist.js`

- [ ] **Step 1: Cập nhật test suite `tests/test-manual-export-autofill.js`**

Kiểm tra:
1. `applySapRecordToForm` gọi `populateExportReceiptData` với đầy đủ `headerInfo` (Mã CT, Tên CT, Ngày xuất, Loại xuất, Số phiếu).
2. `populateExportReceiptData` không tự động tạo nhiều thẻ mặt hàng và không tự chèn cuộn từ kho.
3. Chức năng chọn cuộn thủ công qua `openInventoryModal` và thêm thẻ thủ công bằng `btnAddItemCard` sẵn sàng hoạt động.

- [ ] **Step 2: Chạy kiểm thử tự động**

Run: `node tests/test-manual-export-autofill.js`
Expected: Tất cả các bài test đều PASS.

- [ ] **Step 3: Đồng bộ toàn bộ các thư mục phân phối**

Run: `node scripts/sync-dist.js`
Expected: Cập nhật thành công vào `dist/`, `dist-app/`, `public/`.

- [ ] **Step 4: Commit hoàn tất**

```bash
git add tests/test-manual-export-autofill.js dist/ dist-app/ public/
git commit -m "test & build: update test suite and sync distribution builds"
```
