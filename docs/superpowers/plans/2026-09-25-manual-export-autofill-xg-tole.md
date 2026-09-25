# Kế Hoạch Triển Khai: Tự Động Điền Thông Tin Chung, Danh Sách Mặt Hàng & Cuộn Xuất Khi Nhập Phiếu Xuất Thủ Công

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động điền đầy đủ Thông tin chung, tạo các thẻ Danh sách mặt hàng từ SAP MB51 và tự động tra cứu, điền danh sách Cuộn xuất khả dụng từ kho vào các thẻ mặt hàng khi người dùng nhập phiếu xuất thủ công trên `xg-xuat` và `tole-xuat`.

**Architecture:**
- Bổ sung hàm bridge `window.populateExportReceiptData(headerInfo, itemsGrouped)` trong `assets/js/xg/xg-xuat.js` và `assets/js/tole/tole-xuat.js`.
- Trong hàm bridge, tự động truy vấn tồn kho (`xg-nhap` trừ `xg-xuat` cho XG, `tole-nhap` trừ `tole-xuat` cho Tole) lọc theo `Mã vật tư` và `Batch` của từng mặt hàng, sau đó gán vào `item.rolls` và tự động giữ khóa cuộn (`inventoryLockService.acquireLock`).
- Cập nhật module `assets/js/xg/xg-sap-lookup.js` để khi người dùng chọn hoặc gõ số phiếu xuất, truy vấn tất cả các dòng của phiếu trong `xg_sap_mb51`, gom nhóm theo `Material` + `Batch`, điền thông tin chung và gọi bridge để tự động hoàn thiện danh sách mặt hàng & cuộn xuất.
- Viết test suite `tests/test-manual-export-autofill.js` kiểm tra toàn bộ luồng logic và chạy `node scripts/sync-dist.js` để đồng bộ các thư mục phân phối.

**Tech Stack:** JavaScript (ES6+), Supabase REST API, Node.js Test Suite.

## Global Constraints
- Áp dụng cho cả 2 màn hình xuất kho: `xg-xuat` (kho Xà gồ) và `tole-xuat` (kho Tole).
- Quy tắc SAP phân loại: `debit_credit_ind = 'H'` cho cả 2 trang xuất; Nhóm VT bắt đầu bằng `10040` / `10041` cho XG, và `10030` / `10031` / `10022` / `10091` cho Tole.
- Cuộn xuất được điền tự động phải đang còn tồn trong kho (chưa xuất) và khớp cả `Mã vật tư` lẫn `Batch`.
- Tất cả các cuộn được gán tự động phải được giữ lock qua `inventoryLockService.acquireLock(cuonId)`.
- Khi người dùng xóa cuộn hoặc hủy modal thêm: Phải nhả lock qua `releaseLock(cuonId)`.
- Luôn chạy `node scripts/sync-dist.js` sau khi chỉnh sửa source để đồng bộ sang `public/`, `dist/`, `dist-app/`.

---

### Task 1: Triển Khai Hàm Bridge & Tra Cứu Cuộn Tồn Kho Trong `assets/js/xg/xg-xuat.js`

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`

**Interfaces:**
- Produces: `window.populateExportReceiptData(headerInfo, itemsGrouped)`
  - `headerInfo: { maChungTu, ngayXuat, phieuXuat, loaiXuat, maCongTrinh, tenCongTrinh }`
  - `itemsGrouped: Array<{ maVatTu, tenVatTu, batch, totalSapKg }>`

- [ ] **Step 1: Viết hàm truy vấn cuộn tồn kho theo danh sách mặt hàng và hàm bridge `populateExportReceiptData` trong `assets/js/xg/xg-xuat.js`**

Tìm vị trí sau hàm `populateFieldsFromOcr` và bổ sung:

```javascript
/**
 * Tự động điền dữ liệu phiếu xuất từ SAP MB51 và tra cứu cuộn tồn kho cho từng mặt hàng
 * @param {Object} headerInfo - { maChungTu, ngayXuat, phieuXuat, loaiXuat, maCongTrinh, tenCongTrinh }
 * @param {Array} itemsGrouped - Array of { maVatTu, tenVatTu, batch, totalSapKg }
 */
async function populateExportReceiptFromSap(headerInfo, itemsGrouped) {
  if (!itemsGrouped || itemsGrouped.length === 0) return;
  const form = document.getElementById('addDataForm');
  if (!form) return;

  // 1. Điền Thông tin chung
  const maChungTuSelect = form.querySelector('[name="col_1"]');
  if (maChungTuSelect) {
    maChungTuSelect.value = 'PX';
    triggerAutofillHighlight(maChungTuSelect);
  }

  if (headerInfo.ngayXuat) {
    const ngayInp = form.querySelector('[name="col_2"]');
    if (ngayInp) {
      ngayInp.value = headerInfo.ngayXuat;
      triggerAutofillHighlight(ngayInp);
    }
  }

  if (headerInfo.phieuXuat) {
    const phieuInp = form.querySelector('[name="col_3"]');
    if (phieuInp) {
      phieuInp.value = headerInfo.phieuXuat;
      triggerAutofillHighlight(phieuInp);
    }
  }

  if (headerInfo.loaiXuat) {
    const loaiSelect = form.querySelector('[name="col_4"]');
    if (loaiSelect) {
      let matched = false;
      const targetLower = headerInfo.loaiXuat.toLowerCase();
      for (const opt of loaiSelect.options) {
        if (opt.value && (targetLower.includes(opt.value.toLowerCase()) || opt.value.toLowerCase().includes(targetLower))) {
          loaiSelect.value = opt.value;
          matched = true;
          break;
        }
      }
      if (!matched && headerInfo.loaiXuat) {
        const customOpt = document.createElement('option');
        customOpt.value = headerInfo.loaiXuat;
        customOpt.textContent = headerInfo.loaiXuat;
        loaiSelect.appendChild(customOpt);
        loaiSelect.value = headerInfo.loaiXuat;
      }
      triggerAutofillHighlight(loaiSelect);
    }
  }

  if (headerInfo.maCongTrinh) {
    const maCtInp = form.querySelector('[name="col_10"]') || form.querySelector('[name="add_ext_10"]');
    if (maCtInp) {
      maCtInp.value = headerInfo.maCongTrinh;
      triggerAutofillHighlight(maCtInp);
    }
  }

  if (headerInfo.tenCongTrinh) {
    const tenCtInp = form.querySelector('[name="col_11"]') || form.querySelector('[name="add_ext_11"]');
    if (tenCtInp) {
      tenCtInp.value = headerInfo.tenCongTrinh;
      triggerAutofillHighlight(tenCtInp);
    }
  }

  // 2. Khởi tạo danh sách mặt hàng
  multiItemsData = itemsGrouped.map(item => {
    const rawBatch = (item.batch || '').trim();
    const rawTen = (item.tenVatTu || '').trim();
    return {
      id: Math.random().toString(36).slice(2),
      maVatTu: item.maVatTu || '',
      tenVatTu: mergeBatchIntoTenVatTu(rawTen, rawBatch),
      batch: rawBatch,
      sapKg: item.totalSapKg || 0,
      rolls: []
    };
  });

  renderItemCards();

  // 3. Tự động tra cứu cuộn tồn kho cho từng mặt hàng
  try {
    // Lấy danh sách Cuộn ID đã xuất để loại trừ
    let exportedCuonIds = new Set();
    const { data: xuatData, error: xuatErr } = await supabase
      .from('xg-xuat')
      .select('"Cuộn ID"')
      .not('"Cuộn ID"', 'is', null);
    if (!xuatErr && Array.isArray(xuatData)) {
      xuatData.forEach(row => {
        const cid = String(row['Cuộn ID'] || '').trim().toLowerCase();
        if (cid) exportedCuonIds.add(cid);
      });
    }

    let totalRollsFilled = 0;

    for (const item of multiItemsData) {
      if (!item.maVatTu) continue;
      let query = supabase
        .from('xg-nhap')
        .select('*')
        .ilike('Mã vật tư', `%${item.maVatTu}%`);
      if (item.batch) {
        query = query.ilike('Batch', `%${item.batch}%`);
      }
      const { data: nhapData, error: nhapErr } = await query;
      if (!nhapErr && Array.isArray(nhapData)) {
        const existingInItem = new Set(item.rolls.map(r => String(r.cuonId || '').toLowerCase()));
        nhapData.forEach(r => {
          const cid = String(r['Cuộn ID'] || '').trim();
          if (cid && !exportedCuonIds.has(cid.toLowerCase()) && !existingInItem.has(cid.toLowerCase())) {
            const kgVal = parseNumericInput(r['Số lượng (Kg)']) || 0;
            item.rolls.push({
              id: Math.random().toString(36).slice(2),
              cuonId: cid,
              kg: String(kgVal)
            });
            existingInItem.add(cid.toLowerCase());
            totalRollsFilled++;
            if (window.inventoryLockService) {
              window.inventoryLockService.acquireLock(cid);
            }
          }
        });
      }
    }

    renderItemCards();
    document.querySelectorAll('.item-card').forEach(card => triggerAutofillHighlight(card));

    if (window.XgSapLookup && window.XgSapLookup.showAutofillToast) {
      window.XgSapLookup.showAutofillToast(`✓ Đã điền phiếu xuất: ${multiItemsData.length} mặt hàng, ${totalRollsFilled} cuộn tồn kho`);
    }
  } catch (err) {
    console.error('[xg-xuat] Lỗi tự động tải cuộn tồn kho:', err);
  }
}

// Expose bridge lên window
window.populateExportReceiptData = populateExportReceiptFromSap;
window.multiItemsData = multiItemsData;
window.renderItemCards = renderItemCards;
```

- [ ] **Step 2: Cập nhật sự kiện đóng modal để nhả lock an toàn**
Trong `assets/js/xg/xg-xuat.js`, khi modal `addDataModal` bị đóng/ẩn (sự kiện `hidden.bs.modal`), nếu chưa submit thì duyệt qua `multiItemsData` và nhả lock cuộn nếu có:
```javascript
const addModalEl = document.getElementById('addDataModal');
if (addModalEl) {
  addModalEl.addEventListener('hidden.bs.modal', () => {
    if (!window._isSubmittingAddData && window.inventoryLockService && Array.isArray(multiItemsData)) {
      multiItemsData.forEach(item => {
        (item.rolls || []).forEach(r => {
          if (r.cuonId) window.inventoryLockService.releaseLock(r.cuonId);
        });
      });
    }
    window._isSubmittingAddData = false;
  });
}
```

- [ ] **Step 3: Commit thay đổi Task 1**
```bash
git add assets/js/xg/xg-xuat.js
git commit -m "feat(xg-xuat): add populateExportReceiptData bridge and inventory coil autofill"
```

---

### Task 2: Triển Khai Hàm Bridge & Tra Cứu Cuộn Tồn Kho Trong `assets/js/tole/tole-xuat.js`

**Files:**
- Modify: `assets/js/tole/tole-xuat.js`

**Interfaces:**
- Produces: `window.populateExportReceiptData(headerInfo, itemsGrouped)` cho màn hình Tole Xuất.

- [ ] **Step 1: Viết hàm bridge `populateExportReceiptFromSap` cho Tole Xuất**

Tương tự Task 1 nhưng thao tác với bảng `tole-nhap` và `tole-xuat`:

```javascript
/**
 * Tự động điền dữ liệu phiếu xuất từ SAP MB51 và tra cứu cuộn tồn kho cho từng mặt hàng (Tole)
 * @param {Object} headerInfo - { maChungTu, ngayXuat, phieuXuat, loaiXuat, maCongTrinh, tenCongTrinh }
 * @param {Array} itemsGrouped - Array of { maVatTu, tenVatTu, batch, totalSapKg }
 */
async function populateExportReceiptFromSap(headerInfo, itemsGrouped) {
  if (!itemsGrouped || itemsGrouped.length === 0) return;
  const form = document.getElementById('addDataForm');
  if (!form) return;

  // 1. Điền Thông tin chung
  const maChungTuSelect = form.querySelector('[name="col_1"]');
  if (maChungTuSelect) {
    maChungTuSelect.value = 'PX';
    triggerAutofillHighlight(maChungTuSelect);
  }

  if (headerInfo.ngayXuat) {
    const ngayInp = form.querySelector('[name="col_2"]');
    if (ngayInp) {
      ngayInp.value = headerInfo.ngayXuat;
      triggerAutofillHighlight(ngayInp);
    }
  }

  if (headerInfo.phieuXuat) {
    const phieuInp = form.querySelector('[name="col_3"]');
    if (phieuInp) {
      phieuInp.value = headerInfo.phieuXuat;
      triggerAutofillHighlight(phieuInp);
    }
  }

  if (headerInfo.loaiXuat) {
    const loaiSelect = form.querySelector('[name="col_4"]');
    if (loaiSelect) {
      let matched = false;
      const targetLower = headerInfo.loaiXuat.toLowerCase();
      for (const opt of loaiSelect.options) {
        if (opt.value && (targetLower.includes(opt.value.toLowerCase()) || opt.value.toLowerCase().includes(targetLower))) {
          loaiSelect.value = opt.value;
          matched = true;
          break;
        }
      }
      if (!matched && headerInfo.loaiXuat) {
        const customOpt = document.createElement('option');
        customOpt.value = headerInfo.loaiXuat;
        customOpt.textContent = headerInfo.loaiXuat;
        loaiSelect.appendChild(customOpt);
        loaiSelect.value = headerInfo.loaiXuat;
      }
      triggerAutofillHighlight(loaiSelect);
    }
  }

  if (headerInfo.maCongTrinh) {
    const maCtInp = form.querySelector('[name="col_10"]') || form.querySelector('[name="add_ext_10"]');
    if (maCtInp) {
      maCtInp.value = headerInfo.maCongTrinh;
      triggerAutofillHighlight(maCtInp);
    }
  }

  if (headerInfo.tenCongTrinh) {
    const tenCtInp = form.querySelector('[name="col_11"]') || form.querySelector('[name="add_ext_11"]');
    if (tenCtInp) {
      tenCtInp.value = headerInfo.tenCongTrinh;
      triggerAutofillHighlight(tenCtInp);
    }
  }

  // 2. Khởi tạo danh sách mặt hàng
  multiItemsData = itemsGrouped.map(item => {
    const rawBatch = (item.batch || '').trim();
    const rawTen = (item.tenVatTu || '').trim();
    return {
      id: Math.random().toString(36).slice(2),
      maVatTu: item.maVatTu || '',
      tenVatTu: mergeBatchIntoTenVatTu(rawTen, rawBatch),
      batch: rawBatch,
      sapKg: item.totalSapKg || 0,
      rolls: []
    };
  });

  renderItemCards();

  // 3. Tự động tra cứu cuộn tồn kho cho từng mặt hàng từ tole-nhap
  try {
    let exportedCuonIds = new Set();
    const { data: xuatData, error: xuatErr } = await supabase
      .from('tole-xuat')
      .select('"Cuộn ID"')
      .not('"Cuộn ID"', 'is', null);
    if (!xuatErr && Array.isArray(xuatData)) {
      xuatData.forEach(row => {
        const cid = String(row['Cuộn ID'] || '').trim().toLowerCase();
        if (cid) exportedCuonIds.add(cid);
      });
    }

    let totalRollsFilled = 0;

    for (const item of multiItemsData) {
      if (!item.maVatTu) continue;
      let query = supabase
        .from('tole-nhap')
        .select('*')
        .ilike('Mã vật tư', `%${item.maVatTu}%`);
      if (item.batch) {
        query = query.ilike('Batch', `%${item.batch}%`);
      }
      const { data: nhapData, error: nhapErr } = await query;
      if (!nhapErr && Array.isArray(nhapData)) {
        const existingInItem = new Set(item.rolls.map(r => String(r.cuonId || '').toLowerCase()));
        nhapData.forEach(r => {
          const cid = String(r['Cuộn ID'] || '').trim();
          if (cid && !exportedCuonIds.has(cid.toLowerCase()) && !existingInItem.has(cid.toLowerCase())) {
            const kgVal = parseNumericInput(r['Số lượng (Kg)']) || 0;
            const metVal = parseNumericInput(r['Số lượng (Mét)']) || 0;
            item.rolls.push({
              id: Math.random().toString(36).slice(2),
              cuonId: cid,
              kg: String(kgVal),
              met: String(metVal)
            });
            existingInItem.add(cid.toLowerCase());
            totalRollsFilled++;
            if (window.inventoryLockService) {
              window.inventoryLockService.acquireLock(cid);
            }
          }
        });
      }
    }

    renderItemCards();
    document.querySelectorAll('.item-card').forEach(card => triggerAutofillHighlight(card));

    if (window.XgSapLookup && window.XgSapLookup.showAutofillToast) {
      window.XgSapLookup.showAutofillToast(`✓ Đã điền phiếu xuất: ${multiItemsData.length} mặt hàng, ${totalRollsFilled} cuộn tồn kho`);
    }
  } catch (err) {
    console.error('[tole-xuat] Lỗi tự động tải cuộn tồn kho:', err);
  }
}

// Expose bridge lên window
window.populateExportReceiptData = populateExportReceiptFromSap;
window.multiItemsData = multiItemsData;
window.renderItemCards = renderItemCards;
```

- [ ] **Step 2: Commit thay đổi Task 2**
```bash
git add assets/js/tole/tole-xuat.js
git commit -m "feat(tole-xuat): add populateExportReceiptData bridge and inventory coil autofill"
```

---

### Task 3: Cập Nhật `assets/js/xg/xg-sap-lookup.js` Gọi Bridge Tự Động Điền Đa Mặt Hàng

**Files:**
- Modify: `assets/js/xg/xg-sap-lookup.js`

**Interfaces:**
- Consumes: `xg_sap_mb51` database records & `window.populateExportReceiptData`.

- [ ] **Step 1: Cập nhật hàm `applySapRecordToForm` cho ngữ cảnh xuất kho (`xg-xuat`, `tole-xuat`)**

Trong `assets/js/xg/xg-sap-lookup.js`, khi `rules.direction === 'xuat'`:
1. Truy vấn toàn bộ dòng có cùng `material_document` từ `xg_sap_mb51`:
```javascript
let allDocRows = [sapRecord];
if (window.supabase) {
  try {
    const { data: docRows, error } = await window.supabase
      .from('xg_sap_mb51')
      .select('*')
      .eq('material_document', sapRecord.material_document);
    if (!error && Array.isArray(docRows) && docRows.length > 0) {
      allDocRows = docRows;
    }
  } catch (e) {
    console.warn('[XgSapLookup] Không thể query tất cả dòng của phiếu:', e);
  }
}
```
2. Lọc bỏ các dòng không hợp lệ theo `validateSapRecordAgainstContext`:
```javascript
const validRows = allDocRows.filter(r => {
  const chk = validateSapRecordAgainstContext(r, currentContext);
  return chk.isValid;
});
```
3. Gom nhóm theo `material` + `batch`:
```javascript
const itemsMap = new Map();
validRows.forEach(r => {
  const mat = String(r.material || '').trim();
  const batch = String(r.batch || '').trim();
  const key = `${mat}__${batch}`;
  const rawQty = Math.abs(parseFloat(r.quantity) || 0);

  if (!itemsMap.has(key)) {
    itemsMap.set(key, {
      maVatTu: mat,
      tenVatTu: r.material_description || '',
      batch: batch,
      totalSapKg: rawQty
    });
  } else {
    itemsMap.get(key).totalSapKg += rawQty;
  }
});
const itemsGrouped = Array.from(itemsMap.values());
```
4. Chuẩn bị `headerInfo` và gọi `window.populateExportReceiptData`:
```javascript
const headerInfo = {
  maChungTu: 'PX',
  ngayXuat: sapRecord.posting_date || '',
  phieuXuat: sapRecord.material_document || '',
  loaiXuat: sapRecord.movement_type_text || '',
  maCongTrinh: sapRecord.project_id || '',
  tenCongTrinh: sapRecord.project_name || ''
};

if (typeof window.populateExportReceiptData === 'function') {
  window.populateExportReceiptData(headerInfo, itemsGrouped);
}
```

- [ ] **Step 2: Commit thay đổi Task 3**
```bash
git add assets/js/xg/xg-sap-lookup.js
git commit -m "feat(sap-lookup): support full multi-item export receipt autofill via bridge"
```

---

### Task 4: Viết Test Suite & Kiểm Thử Tự Động

**Files:**
- Create: `tests/test-manual-export-autofill.js`

- [ ] **Step 1: Viết test suite `tests/test-manual-export-autofill.js`**
Kiểm tra:
- Khởi tạo `populateExportReceiptData` với 1 mặt hàng và nhiều mặt hàng.
- Logic gom nhóm mặt hàng từ các dòng SAP MB51.
- Logic lọc cuộn tồn kho (loại trừ các cuộn đã xuất).
- Kích hoạt `acquireLock` trên các cuộn được gán.

- [ ] **Step 2: Chạy test suite bằng Node.js**
Run: `node tests/test-manual-export-autofill.js`
Expected: Tất cả các test cases PASS.

- [ ] **Step 3: Commit test suite**
```bash
git add tests/test-manual-export-autofill.js
git commit -m "test: add test suite for manual export receipt autofill"
```

---

### Task 5: Đồng Bộ Các Thư Mục Phân Phối & Kiểm Tra Toàn Diện

**Files:**
- Sync: `node scripts/sync-dist.js`

- [ ] **Step 1: Chạy script đồng bộ phân phối**
Run: `node scripts/sync-dist.js`
Expected: Hoàn thành đồng bộ vào `public/`, `dist/`, `dist-app/`.

- [ ] **Step 2: Chạy toàn bộ test suites hiện có để đảm bảo không có regression**
Run: `node tests/test-sap-page-validation-rules.js`
Expected: PASS 100%.

- [ ] **Step 3: Commit các file phân phối**
```bash
git add public/ dist/ dist-app/
git commit -m "chore: sync distribution bundles for manual export autofill"
```
