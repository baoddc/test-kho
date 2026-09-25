# Kế Hoạch Triển Khai: Modal Cảnh Báo Phiếu Đã Nhập/Xuất Kho Cho Xà Gồ Và Tole

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị cảnh báo trực quan đa tầng (badge Autocomplete, modal chi tiết khi chọn/rời ô nhập, và xác nhận trước khi submit) cho các phiếu đã nhập hoặc xuất trước đó trên 4 trang `xg-nhap.html`, `xg-xuat.html`, `tole-nhap.html`, `tole-xuat.html`.

**Architecture:**
- Xây dựng service kiểm tra phiếu `checkReceiptProcessed(docNo, pageContext)` và modal cảnh báo `showReceiptProcessedWarningModal(info, onConfirm, onCancel)` tập trung tại `assets/js/xg/xg-sap-lookup.js` (module đã được nhúng ở cả 4 trang HTML).
- Tích hợp tra cứu kép (Local In-Memory Cache `window._rawSupabaseData` tức thì + Remote Supabase Query) để kiểm tra số phiếu tương ứng theo từng kho (`Phiếu nhập` cho `xg-nhap`/`tole-nhap`, `Phiếu xuất` cho `xg-xuat`/`tole-xuat`).
- Chốt chặn tại sự kiện submit của form thêm dữ liệu trên cả 4 trang với cơ chế ghi nhớ xác nhận (`window._confirmedProcessedReceipts`).

**Tech Stack:** JavaScript (ES6+), Bootstrap 5 Modals & Badges, Supabase REST API, Node.js Test Suite.

## Global Constraints
- `xg-nhap`: Bảng `xg-nhap`, cột `Phiếu nhập`.
- `xg-xuat`: Bảng `xg-xuat`, cột `Phiếu xuất`.
- `tole-nhap`: Bảng `tole-nhap`, cột `Phiếu nhập`.
- `tole-xuat`: Bảng `tole-xuat`, cột `Phiếu xuất`.
- Giữ nguyên các chức năng hiện có (đối chiếu kg cuộn SAP, autocomplete, bridge autofill).
- Luôn chạy `node scripts/sync-dist.js` hoặc `npm run build` để đồng bộ source vào `public/`, `dist/`, `dist-app/`.

---

### Task 1: Xây Dựng Hàm Kiểm Tra Phiếu & Render Modal Cảnh Báo Trong `xg-sap-lookup.js`

**Files:**
- Modify: `assets/js/xg/xg-sap-lookup.js`

**Interfaces:**
- Produces:
  - `window.XgSapLookup.checkReceiptProcessed(docNo, pageContext)`: Promise<{ isProcessed: boolean, count: number, totalKg: number, totalM: number, records: Array, firstDate: string, lastDate: string, projectNames: Array, projectIds: Array }>
  - `window.XgSapLookup.showReceiptProcessedWarningModal(options)`: Hiển thị modal cảnh báo chi tiết, nhận `onConfirm` và `onCancel`.

- [ ] **Step 1: Định nghĩa cấu hình bảng và cột phiếu theo trang trong `xg-sap-lookup.js`**
Bổ sung `tableName` và `docColumnName` vào `SAP_PAGE_RULES`:
  - `xg-nhap`: tableName `'xg-nhap'`, docColumnName `'Phiếu nhập'`
  - `xg-xuat`: tableName `'xg-xuat'`, docColumnName `'Phiếu xuất'`
  - `tole-nhap`: tableName `'tole-nhap'`, docColumnName `'Phiếu nhập'`
  - `tole-xuat`: tableName `'tole-xuat'`, docColumnName `'Phiếu xuất'`

- [ ] **Step 2: Viết hàm `checkReceiptProcessed(docNo, pageContext)`**
Tra cứu từ `window._rawSupabaseData` trước. Nếu không tìm thấy hoặc `_rawSupabaseData` rỗng, query Supabase `supabase.from(rule.tableName).select('*').ilike(rule.docColumnName, docNo.trim())`. Tính tổng kg, tổng m (nếu có), đếm số cuộn/dòng, trích xuất ngày và tên công trình.

- [ ] **Step 3: Viết hàm `showReceiptProcessedWarningModal({ docNo, pageContext, processedInfo, sapRecord, onConfirm, onCancel })`**
Tạo element modal `#receiptProcessedWarningModal` (nếu chưa có trong DOM), format hiển thị đẹp mắt theo chuẩn Bootstrap:
  - Header màu vàng cam với icon tam giác cảnh báo.
  - Chi tiết số lượng cuộn đã lưu, tổng kg đã lưu, ngày ghi nhận, tên công trình.
  - So sánh đối chiếu với số kg trên SAP (nếu có `sapRecord`).
  - Nút **"Hủy / Đổi phiếu"** (gọi `onCancel`) và nút **"Tiếp tục điền phiếu"** (gọi `onConfirm`).

- [ ] **Step 4: Export các hàm ra `window.XgSapLookup`**
Export `checkReceiptProcessed` và `showReceiptProcessedWarningModal`.

- [ ] **Step 5: Commit Task 1**
```bash
git add assets/js/xg/xg-sap-lookup.js
git commit -m "feat(sap-lookup): add checkReceiptProcessed and showReceiptProcessedWarningModal"
```

---

### Task 2: Tích Hợp Badge Autocomplete & Cảnh Báo Khi Chọn / Nhập Số Phiếu

**Files:**
- Modify: `assets/js/xg/xg-sap-lookup.js`

**Interfaces:**
- Consumes: `checkReceiptProcessed`, `showReceiptProcessedWarningModal` từ Task 1.

- [ ] **Step 1: Cập nhật hàm `renderDropdown()` trong `initSapDocumentAutocomplete()`**
Khi render các mục SAP hợp lệ (`validGroups`), kiểm tra nhanh xem số phiếu `g.material_document` đã có trong hệ thống hay chưa (thông qua `_rawSupabaseData` hoặc cache).
Nếu đã có, gắn thêm badge cảnh báo:
`<span class="badge bg-warning text-dark border border-warning-subtle" title="Phiếu này đã có dữ liệu trong hệ thống"><i class="bi bi-exclamation-triangle-fill me-1"></i>Đã ${rules.direction === 'nhap' ? 'nhập' : 'xuất'} (${processedKg} kg)</span>`

- [ ] **Step 2: Cập nhật sự kiện click vào dropdown item**
Khi người dùng click vào dòng phiếu SAP:
Nếu phiếu đã có trong hệ thống:
  - Hiện modal cảnh báo `showReceiptProcessedWarningModal`.
  - Nếu người dùng bấm "Tiếp tục điền phiếu": gọi `applySapRecordToForm()`, lưu phiếu vào `window._confirmedProcessedReceipts`.
  - Nếu người dùng bấm "Hủy / Đổi phiếu": Xóa giá trị input, không điền form.
Nếu phiếu chưa có: gọi `applySapRecordToForm()` bình thường.

- [ ] **Step 3: Cập nhật sự kiện `change` trên input số phiếu**
Khi người dùng gõ tay hoặc dán số phiếu và rời ô nhập:
Kiểm tra qua `checkReceiptProcessed()`. Nếu đã có dữ liệu trong hệ thống và chưa được xác nhận:
  - Bật modal cảnh báo `showReceiptProcessedWarningModal`.

- [ ] **Step 4: Commit Task 2**
```bash
git add assets/js/xg/xg-sap-lookup.js
git commit -m "feat(sap-lookup): integrate processed badge and warning modal into autocomplete & input events"
```

---

### Task 3: Tích Hợp Chốt Chặn Khi Submit Form Trong 4 Trang (`xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`)

**Files:**
- Modify: `assets/js/xg/xg-nhap.js`
- Modify: `assets/js/xg/xg-xuat.js`
- Modify: `assets/js/tole/tole-nhap.js`
- Modify: `assets/js/tole/tole-xuat.js`

**Interfaces:**
- Consumes: `window.XgSapLookup.checkReceiptProcessed`, `window.XgSapLookup.showReceiptProcessedWarningModal`.

- [ ] **Step 1: Cập nhật submit handler trong `assets/js/xg/xg-nhap.js`**
Trước khi thực hiện `supabase.from('xg-nhap').insert()`:
Kiểm tra giá trị ô Phiếu nhập `input[name="col_3"]`.
Nếu phiếu đã có trong hệ thống và chưa có trong `window._confirmedProcessedReceipts`:
  - Khôi phục trạng thái nút submit (`submitBtn.disabled = false`).
  - Ẩn overlay loading.
  - Hiện `showReceiptProcessedWarningModal`.
  - Khi người dùng bấm "Tiếp tục": Thêm phiếu vào `_confirmedProcessedReceipts` và gọi lại submit.

- [ ] **Step 2: Cập nhật submit handler trong `assets/js/xg/xg-xuat.js`**
Tương tự, trước khi gọi RPC `xuat_xg_atomic`:
Kiểm tra `Phiếu xuất`. Nếu đã tồn tại và chưa xác nhận, chặn lại và hiện modal cảnh báo xác nhận.

- [ ] **Step 3: Cập nhật submit handler trong `assets/js/tole/tole-nhap.js`**
Tương tự cho `tole-nhap` với bảng `tole-nhap` và cột `Phiếu nhập`.

- [ ] **Step 4: Cập nhật submit handler trong `assets/js/tole/tole-xuat.js`**
Tương tự cho `tole-xuat` với bảng `tole-xuat` và cột `Phiếu xuất`.

- [ ] **Step 5: Commit Task 3**
```bash
git add assets/js/xg/xg-nhap.js assets/js/xg/xg-xuat.js assets/js/tole/tole-nhap.js assets/js/tole/tole-xuat.js
git commit -m "feat: add submit-time duplicate receipt check and warning across all 4 warehouse pages"
```

---

### Task 4: Viết Bộ Test Tự Động & Đồng Bộ Toàn Bộ Bản Build

**Files:**
- Create: `tests/test-receipt-already-processed-warning.js`
- Run: `node scripts/sync-dist.js`

**Interfaces:**
- Produces: Test suite kiểm tra logic `checkReceiptProcessed`, hiển thị badge, cảnh báo và chặn submit.

- [ ] **Step 1: Tạo file test `tests/test-receipt-already-processed-warning.js`**
Viết các kịch bản kiểm thử:
  - Kịch bản 1: Kiểm tra `checkReceiptProcessed` trên local `_rawSupabaseData` cho cả 4 context (`xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`).
  - Kịch bản 2: Kiểm tra tính toán tổng kg, số cuộn, ngày ghi nhận, danh sách Cuộn ID.
  - Kịch bản 3: Kiểm tra cơ chế `_confirmedProcessedReceipts` bypass cảnh báo sau khi đã xác nhận.

- [ ] **Step 2: Chạy test kiểm thử tự động**
```bash
node tests/test-receipt-already-processed-warning.js
```
Expected: PASS 100% tất cả các test case.

- [ ] **Step 3: Chạy build đồng bộ dự án sang `public/`, `dist/`, `dist-app/`**
```bash
npm run build
```
Expected: `Full synchronization completed successfully!`

- [ ] **Step 4: Commit Task 4**
```bash
git add tests/test-receipt-already-processed-warning.js public/ dist/ dist-app/
git commit -m "test: add comprehensive test suite for already processed receipts warning and sync build artifacts"
```
