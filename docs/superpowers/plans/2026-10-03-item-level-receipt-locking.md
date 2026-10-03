# Kế Hoạch Triển Khai: Khóa Phiếu Nhập Cấp Loại (Mã Vật Tư + Batch) Cho Kho Xà Gồ Và Kho Tole

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi cơ chế khóa từ cấp số phiếu sang cấp loại cụ thể (`Mã vật tư` + `Batch`) trên cả 2 màn hình nhập (`xg-nhap.html` và `tole-nhap.html`), cho phép nhập tiếp các loại chưa hoàn tất trong cùng một phiếu nhập.

**Architecture:**
- Xây dựng hàm kiểm tra cấp loại `checkReceiptItemProcessed(docNo, material, batch, pageContext)` trong `assets/js/xg/xg-sap-lookup.js` hỗ trợ tra cứu In-Memory Cache và Supabase.
- Cập nhật Dropdown gợi ý SAP: dòng nào đã nhập loại đó thì gắn badge `[Đã nhập (X kg) - KHÓA]`, dòng nào chưa nhập thì cho phép chọn và tự động điền form.
- Khi người dùng rời ô nhập số phiếu (`change`), chỉ khóa nếu tất cả các loại của phiếu đã nhập đủ. Nếu còn loại chưa nhập, mở danh sách để người dùng chọn.
- Chốt chặn tại sự kiện submit form của `xg-nhap.js` và `tole-nhap.js`: chỉ chặn khi loại đang nhập (`Phiếu nhập` + `Mã vật tư` + `Batch`) đã có bản ghi trong kho.

**Tech Stack:** JavaScript (ES6+), Bootstrap 5 Modals & Badges, Supabase REST API, Node.js Test Suite.

## Global Constraints
- `xg-nhap`: Bảng `xg-nhap`, cột `Phiếu nhập`, `Mã vật tư`, `Batch`.
- `tole-nhap`: Bảng `tole-nhap`, cột `Phiếu nhập`, `Mã vật tư`, `Batch`.
- Giữ nguyên cơ chế tra cứu cho các màn hình xuất (`xg-xuat`, `tole-xuat`).
- Luôn chạy `node tests/test-receipt-already-processed-warning.js` và `npm run build` để kiểm thử và đồng bộ source vào `public/`, `dist/`, `dist-app/`.

---

### Task 1: Xây Dựng Hàm `checkReceiptItemProcessed` Trong `assets/js/xg/xg-sap-lookup.js`

**Files:**
- Modify: `assets/js/xg/xg-sap-lookup.js`
- Test: `tests/test-receipt-already-processed-warning.js`

**Interfaces:**
- Produces:
  - `window.XgSapLookup.checkReceiptItemProcessed(docNo, material, batch, pageContext)`: Promise<{ isProcessed: boolean, count: number, totalKg: number, totalM: number, records: Array, coilIds: Array, dates: Array, projectNames: Array }>
  - Cập nhật `window.XgSapLookup.checkReceiptProcessed(docNo, pageContext)` để trả về thêm `itemsSummary: { totalItems: number, processedItems: number, remainingItems: number, isAllItemsProcessed: boolean }`.

- [ ] **Step 1: Viết test kiểm tra `checkReceiptItemProcessed` trong `tests/test-receipt-already-processed-warning.js`**

Bổ sung test case kiểm tra:
1. Trả về `isProcessed: true` khi phiếu, mã vật tư và batch đều khớp.
2. Trả về `isProcessed: false` khi cùng số phiếu nhưng khác batch.

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `node tests/test-receipt-already-processed-warning.js`
Expected: FAIL với lỗi `checkReceiptItemProcessed is not a function`.

- [ ] **Step 3: Cài đặt hàm `checkReceiptItemProcessed` trong `assets/js/xg/xg-sap-lookup.js`**

```javascript
async function checkReceiptItemProcessed(docNo, material, batch, pageContext) {
  const cleanDoc = String(docNo || '').trim();
  const cleanMat = String(material || '').trim();
  const cleanBatch = String(batch || '').trim();

  const emptyResult = {
    isProcessed: false,
    count: 0,
    totalKg: 0,
    totalM: 0,
    records: [],
    firstDate: '',
    lastDate: '',
    projectNames: [],
    projectIds: [],
    coilIds: []
  };

  if (!cleanDoc) return emptyResult;

  const currentContext = detectCurrentPageContext(pageContext);
  const rule = SAP_PAGE_RULES[currentContext] || SAP_PAGE_RULES['xg-nhap'];
  const docCol = rule.docColumnName;
  const matCol = 'Mã vật tư';
  const batchCol = 'Batch';
  const tableName = rule.tableName;

  let matchedRows = [];

  // Tầng 1: Tra cứu từ Local Cache window._rawSupabaseData
  if (typeof window !== 'undefined' && Array.isArray(window._rawSupabaseData) && window._rawSupabaseData.length > 0) {
    matchedRows = window._rawSupabaseData.filter(r => {
      if (!r) return false;
      const rDoc = String(r[docCol] || '').trim().toLowerCase();
      if (rDoc !== cleanDoc.toLowerCase()) return false;

      if (cleanMat) {
        const rMat = String(r[matCol] || '').trim().toLowerCase();
        if (rMat !== cleanMat.toLowerCase()) return false;
      }
      if (cleanBatch) {
        const rBatch = String(r[batchCol] || '').trim().toLowerCase();
        if (rBatch !== cleanBatch.toLowerCase()) return false;
      }
      return true;
    });
  }

  // Tầng 2: Nếu không thấy trong local cache, query Supabase
  if (matchedRows.length === 0 && typeof window !== 'undefined' && window.supabase) {
    try {
      let query = window.supabase.from(tableName).select('*').ilike(docCol, cleanDoc);
      if (cleanMat) query = query.ilike(matCol, cleanMat);
      if (cleanBatch) query = query.ilike(batchCol, cleanBatch);
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        matchedRows = data.filter(r => {
          const rDoc = String(r[docCol] || '').trim().toLowerCase();
          const rMat = String(r[matCol] || '').trim().toLowerCase();
          const rBatch = String(r[batchCol] || '').trim().toLowerCase();
          const matchDoc = rDoc === cleanDoc.toLowerCase();
          const matchMat = !cleanMat || rMat === cleanMat.toLowerCase();
          const matchBatch = !cleanBatch || rBatch === cleanBatch.toLowerCase();
          return matchDoc && matchMat && matchBatch;
        });
      }
    } catch (err) {
      console.warn(`[XgSapLookup] Không thể truy vấn Supabase cho bảng ${tableName}:`, err);
    }
  }

  if (matchedRows.length === 0) return emptyResult;

  let totalKg = 0;
  let totalM = 0;
  const coilIds = [];
  const projectNamesSet = new Set();
  const projectIdsSet = new Set();
  const dates = [];

  matchedRows.forEach(r => {
    const rawKg = r['Số lượng (Kg)'];
    const kg = typeof rawKg === 'number' ? rawKg : (parseFloat(String(rawKg || 0).replace(/,/g, '')) || 0);
    totalKg += kg;

    if (r['Số lượng (m)']) {
      const rawM = r['Số lượng (m)'];
      const m = typeof rawM === 'number' ? rawM : (parseFloat(String(rawM || 0).replace(/,/g, '')) || 0);
      totalM += m;
    }

    const cid = String(r['Cuộn ID'] || '').trim();
    if (cid && !coilIds.includes(cid)) coilIds.push(cid);

    const pName = String(r['Tên công trình'] || '').trim();
    if (pName) projectNamesSet.add(pName);
    const pId = String(r['Mã công trình'] || '').trim();
    if (pId) projectIdsSet.add(pId);

    const dateVal = String(r['Ngày nhập'] || r['Ngày xuất'] || '').trim();
    if (dateVal) dates.push(dateVal);
  });

  dates.sort();

  return {
    isProcessed: true,
    count: matchedRows.length,
    totalKg,
    totalM,
    records: matchedRows,
    firstDate: dates[0] || '',
    lastDate: dates[dates.length - 1] || '',
    projectNames: Array.from(projectNamesSet),
    projectIds: Array.from(projectIdsSet),
    coilIds
  };
}
```

Export `checkReceiptItemProcessed` vào `window.XgSapLookup` và `module.exports`.

- [ ] **Step 4: Chạy lại test suite để kiểm tra tính đúng đắn (Green)**

Run: `node tests/test-receipt-already-processed-warning.js`
Expected: PASS 100%.

- [ ] **Step 5: Commit Task 1**

```bash
git add assets/js/xg/xg-sap-lookup.js tests/test-receipt-already-processed-warning.js; git commit -m "feat(sap-lookup): add checkReceiptItemProcessed function for item-level locking"
```

---

### Task 2: Cập Nhật Autocomplete Dropdown, Sự Kiện Click & Blur Trong `assets/js/xg/xg-sap-lookup.js`

**Files:**
- Modify: `assets/js/xg/xg-sap-lookup.js`

**Interfaces:**
- Consumes: `checkReceiptItemProcessed` từ Task 1.

- [ ] **Step 1: Cập nhật hàm `renderDropdown()` để kiểm tra cấp loại (Mã VT + Batch)**

Trong `renderDropdown()`:
- Đổi từ việc kiểm tra theo `docKey` sang kiểm tra theo `itemKey = `${doc}__${mat}__${batch}``.
- Gọi song song `checkReceiptItemProcessed(g.material_document, g.material, g.batch, currentContext)` cho từng nhóm `g`.
- Nếu loại này `isProcessed === true`:
  - Gắn badge: `<span class="badge bg-danger text-white border border-danger-subtle me-1"><i class="bi bi-slash-circle me-1"></i>Đã nhập (${proc.totalKg.toLocaleString('vi-VN')} kg) - KHÓA</span>`.
  - Đặt style `opacity: 0.72` trên `itemEl` và icon khóa để phân biệt.
- Nếu loại này chưa nhập (`isProcessed === false`):
  - Hiển thị badge số lượng kg SAP màu xanh dương `<span class="badge bg-primary-subtle text-primary border">${qtyFormatted} kg</span>`.

- [ ] **Step 2: Cập nhật sự kiện click vào dòng dropdown**

Khi click vào dòng `g`:
- Nếu `isEditForm`: Áp dụng bình thường.
- Nếu không phải `isEditForm`:
  - Kiểm tra `procInfo = await checkReceiptItemProcessed(g.material_document, g.material, g.batch, currentContext)`.
  - Nếu `procInfo.isProcessed === true`:
    - Hiển thị `showReceiptProcessedWarningModal` với thông báo cụ thể cho loại hàng này.
    - Trong `onCancel`: Không xóa `inputEl.value` (giữ lại số phiếu để người dùng chọn dòng khác), chỉ gọi `resetSapSelection()`.
    - Dừng xử lý (`return`).
  - Nếu `procInfo.isProcessed === false`:
    - Gọi `applySapRecordToForm(g, formEl, currentContext)` để điền form tự động và người dùng tiếp tục nhập.

- [ ] **Step 3: Cập nhật sự kiện `change` trên input số phiếu**

Khi người dùng dán hoặc gõ xong số phiếu và trigger `change`:
- Lấy danh sách các dòng của phiếu từ SAP MB51:
  - Nếu phiếu có nhiều loại:
    - Kiểm tra xem tất cả các loại đã nhập hay chưa.
    - Nếu TẤT CẢ các loại đều đã nhập: Mới hiện `showReceiptProcessedWarningModal` khóa toàn bộ phiếu.
    - Nếu VẪN CÒN loại chưa nhập: **Không** chặn và không xóa input. Tự động hiển thị dropdown các loại để người dùng chọn dòng chưa nhập.
  - Nếu phiếu chỉ có 1 loại duy nhất và loại đó đã nhập: Hiện modal chặn.

- [ ] **Step 4: Chạy test và kiểm tra console không lỗi**

Run: `node tests/test-receipt-already-processed-warning.js`
Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add assets/js/xg/xg-sap-lookup.js; git commit -m "feat(sap-lookup): update autocomplete dropdown and input events to lock only processed item types"
```

---

### Task 3: Cập Nhật Chốt Chặn Khi Submit Trong `xg-nhap.js` Và `tole-nhap.js`

**Files:**
- Modify: `assets/js/xg/xg-nhap.js`
- Modify: `assets/js/tole/tole-nhap.js`

**Interfaces:**
- Consumes: `window.XgSapLookup.checkReceiptItemProcessed`

- [ ] **Step 1: Cập nhật submit handler trong `assets/js/xg/xg-nhap.js`**

Tìm đoạn kiểm tra trước khi insert dữ liệu (khoảng dòng 1596 - 1618):
Thay vì chỉ kiểm tra `phieuNhapInputVal`:
```javascript
const phieuNhapInputVal = (form.querySelector('input[name="col_3"]')?.value || '').trim();
const maVatTuInputVal = (form.querySelector('input[name="col_5"]')?.value || '').trim();
const batchInputVal = (form.querySelector('input[name="col_7"]')?.value || '').trim();

if (phieuNhapInputVal && window.XgSapLookup && typeof window.XgSapLookup.checkReceiptItemProcessed === 'function') {
  const procCheck = await window.XgSapLookup.checkReceiptItemProcessed(phieuNhapInputVal, maVatTuInputVal, batchInputVal, 'xg-nhap');
  if (procCheck && procCheck.isProcessed) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
    hideLoadingOverlay();
    window.XgSapLookup.showReceiptProcessedWarningModal({
      docNo: phieuNhapInputVal,
      pageContext: 'xg-nhap',
      processedInfo: procCheck,
      sapRecord: window._currentSelectedSapRecord,
      onCancel: () => {
        // Giữ lại số phiếu để người dùng chọn loại khác
        if (typeof window.XgSapLookup.resetSapSelection === 'function') {
          window.XgSapLookup.resetSapSelection();
        }
      }
    });
    return;
  }
}
```

- [ ] **Step 2: Cập nhật submit handler trong `assets/js/tole/tole-nhap.js`**

Áp dụng tương tự cho `tole-nhap.js` (với context `'tole-nhap'`).

- [ ] **Step 3: Chạy test suite để xác minh không hồi quy**

Run: `node tests/test-receipt-already-processed-warning.js`
Expected: PASS 100%.

- [ ] **Step 4: Commit Task 3**

```bash
git add assets/js/xg/xg-nhap.js assets/js/tole/tole-nhap.js; git commit -m "feat: enforce item-level duplicate check on submit for xg-nhap and tole-nhap"
```

---

### Task 4: Viết Bộ Test Mở Rộng & Đồng Bộ Toàn Bộ Bản Build

**Files:**
- Modify: `tests/test-receipt-already-processed-warning.js`
- Output: `public/`, `dist/`, `dist-app/`

**Interfaces:**
- Produces: Test suite bao phủ đầy đủ kịch bản 1 loại vs nhiều loại.

- [ ] **Step 1: Bổ sung các test cases chi tiết vào `tests/test-receipt-already-processed-warning.js`**
  - Test kịch bản: Phiếu 5000042978 có 3 loại (Batch A, Batch B, Batch C).
  - Kho đã nhập Batch A.
  - Kiểm tra `checkReceiptItemProcessed(..., Batch A)` $\rightarrow$ `isProcessed = true`.
  - Kiểm tra `checkReceiptItemProcessed(..., Batch B)` $\rightarrow$ `isProcessed = false`.
  - Kiểm tra `checkReceiptItemProcessed(..., Batch C)` $\rightarrow$ `isProcessed = false`.

- [ ] **Step 2: Chạy kiểm thử tự động**

Run: `node tests/test-receipt-already-processed-warning.js`
Expected: Tất cả các test cases ĐẠT (PASS 100%).

- [ ] **Step 3: Chạy build đồng bộ dự án**

Run: `npm run build`
Expected: `Full synchronization completed successfully!`

- [ ] **Step 4: Commit Task 4**

```bash
git add tests/test-receipt-already-processed-warning.js public/ dist/ dist-app/; git commit -m "test: add item-level locking tests and sync build artifacts"
```
