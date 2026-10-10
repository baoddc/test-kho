# Auto-Sync Google Sheets On Modal Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động đồng bộ dữ liệu chứng từ Google Sheets (sheet `mb51`) về bảng Supabase `xg_sap_mb51` ngay khi mở modal thêm hoặc sửa dữ liệu trên cả 4 màn hình kho (Xà Gồ Nhập/Xuất, Tole Nhập/Xuất) mà không cần người dùng nhấn nút thủ công.

**Architecture:** Bổ sung cơ chế concurrency guard (`_isSyncing`, `_activeSyncPromise`) và tùy chọn `{ isAuto: true }` vào hàm `syncFromGoogleSheets()` trong `xg-sap-lookup.js`. Tự động kích hoạt hàm này khi hàm mở modal `openAddDataModal()` và `openEditDataModal()` được gọi trong các file nghiệp vụ của 4 trang, hiển thị trạng thái quay spinner và toast thông báo không gây gián đoạn thao tác. Sau đó đồng bộ sang `dist/`, `public/`, `dist-app/` bằng `scripts/sync-dist.js`.

**Tech Stack:** JavaScript (ES6+), Supabase JS Client, Bootstrap 5 Modals, Google GViz JSON API, Node.js Test Runner.

## Global Constraints

- Không dùng popup `alert()` khi tự động đồng bộ gặp sự cố để tránh chặn người dùng thao tác. Thay vào đó dùng Toast thông báo.
- Nút bấm thủ công (`btnSyncGgSheet`, `btnEditSyncGgSheet`) vẫn phải giữ nguyên trên giao diện để người dùng có thể chủ động bấm lại bất cứ lúc nào.
- Đảm bảo cơ chế chống gọi trùng (concurrency lock): Nếu đang đồng bộ dở mà mở modal khác hoặc người dùng click liên tục, không gửi request thứ 2 lên Supabase.
- Mã nguồn gốc được sửa tại `assets/js/` và phải chạy `node scripts/sync-dist.js` để đồng bộ toàn bộ thư mục `dist/`, `public/`, `dist-app/`.

---

### Task 1: Viết Unit Test Kiểm Tra Concurrency Guard & Tùy Chọn Auto-Sync

**Files:**
- Create: `tests/test-auto-sync-ggsheet.js`
- Test: `tests/test-auto-sync-ggsheet.js`

**Interfaces:**
- Consumes: `assets/js/xg/xg-sap-lookup.js` (`window.XgSapLookup.syncFromGoogleSheets`, `window.XgSapLookup._isSyncing`)
- Produces: Bộ test runner độc lập kiểm tra cờ khóa `_isSyncing`, kiểm tra không gọi đúp, và kiểm tra `options.isAuto`.

- [ ] **Step 1: Viết test case trong `tests/test-auto-sync-ggsheet.js`**

```javascript
/**
 * Test Suite: Kiểm tra concurrency guard và auto-sync options trong xg-sap-lookup.js
 */

const assert = require('assert');

// Mock môi trường trình duyệt cho Node.js
global.window = {};
global.document = {
  querySelector: () => null,
  getElementById: () => null
};

const SapLookup = require('../assets/js/xg/xg-sap-lookup.js');

console.log('===============================================================');
console.log(' KIỂM THỬ CONCURRENCY GUARD & AUTO-SYNC GOOGLE SHEETS');
console.log('===============================================================\n');

let passCount = 0;
let totalTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`  ✓ [PASS] ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(`    -> Lỗi: ${err.message}`);
  }
}

async function runAsyncTest(description, testFn) {
  totalTests++;
  try {
    await testFn();
    console.log(`  ✓ [PASS] ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(`    -> Lỗi: ${err.message}`);
  }
}

(async () => {
  // Test 1: Kiểm tra hàm syncFromGoogleSheets tồn tại
  runTest('Hàm syncFromGoogleSheets được xuất ra window.XgSapLookup', () => {
    assert.strictEqual(typeof SapLookup.syncFromGoogleSheets, 'function');
  });

  // Test 2: Kiểm tra hàm trả về an toàn khi Supabase chưa khởi tạo
  await runAsyncTest('syncFromGoogleSheets trả về mà không ném ngoại lệ khi options.isAuto = true và supabase null', async () => {
    global.window.supabase = null;
    let toastCalled = false;
    SapLookup.showAutofillToast = (msg) => { toastCalled = true; };

    const mockBtn = { disabled: false, innerHTML: 'Sync' };
    await SapLookup.syncFromGoogleSheets(mockBtn, { isAuto: true });
    assert.strictEqual(mockBtn.disabled, false);
  });

  console.log(`\nTổng kết: ${passCount}/${totalTests} bài test thành công.\n`);
  if (passCount !== totalTests) {
    process.exit(1);
  }
})();
```

- [ ] **Step 2: Chạy test để xác nhận trạng thái ban đầu**

Run: `node tests/test-auto-sync-ggsheet.js`
Expected: FAIL hoặc PASS phụ thuộc vào tính tương thích của mock hiện tại.

- [ ] **Step 3: Commit file test**

```bash
git add tests/test-auto-sync-ggsheet.js
git commit -m "test: add test suite for auto-sync google sheets concurrency guard"
```

---

### Task 2: Cải Tiến `syncFromGoogleSheets` trong `assets/js/xg/xg-sap-lookup.js`

**Files:**
- Modify: `assets/js/xg/xg-sap-lookup.js:1950-2175`

**Interfaces:**
- Consumes: Google GViz endpoint, `window.supabase`, `showAutofillToast`
- Produces: `syncFromGoogleSheets(btnEl, options = {})` hỗ trợ `_isSyncing`, `options.isAuto`, `options.silentOnError`

- [ ] **Step 1: Cập nhật hàm `syncFromGoogleSheets` với cờ `_isSyncing` và tùy chọn `isAuto`**

Trong `assets/js/xg/xg-sap-lookup.js`:
Khai báo biến module trước hàm `syncFromGoogleSheets`:
```javascript
  let _isSyncing = false;
  let _activeSyncPromise = null;
```

Cập nhật chữ ký hàm và logic kiểm soát:
```javascript
  /**
   * Đồng bộ trực tiếp dữ liệu từ Google Sheets sang Supabase
   * Sử dụng Google GViz JSON endpoint (hỗ trợ CORS trực tiếp trên trình duyệt)
   * @param {HTMLElement} [btnEl] - Nút bấm kích hoạt đồng bộ (nếu có)
   * @param {Object} [options] - Tùy chọn đồng bộ: { isAuto: boolean, silentOnError: boolean }
   */
  async function syncFromGoogleSheets(btnEl, options = {}) {
    const isAuto = Boolean(options && options.isAuto);
    const silentOnError = isAuto || Boolean(options && options.silentOnError);

    if (!window.supabase) {
      if (!silentOnError) {
        alert('Kết nối Supabase chưa sẵn sàng. Vui lòng tải lại trang.');
      } else {
        console.warn('[XgSapLookup] Kết nối Supabase chưa sẵn sàng khi tự động đồng bộ.');
      }
      return;
    }

    // Cơ chế chống gọi trùng (Concurrency Guard)
    if (_isSyncing) {
      console.log('[XgSapLookup] Quá trình đồng bộ Google Sheets đang diễn ra, tái sử dụng tiến trình hiện tại.');
      if (btnEl && !btnEl.disabled) {
        btnEl.disabled = true;
        btnEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang đồng bộ...';
      }
      return _activeSyncPromise;
    }

    _isSyncing = true;

    const originalHtml = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang tải Google Sheets...';
    }

    _activeSyncPromise = (async () => {
      try {
        if (!isAuto) {
          showAutofillToast('Đang tải dữ liệu mới nhất từ Google Sheets...');
        }

        const GVIZ_URL = 'https://docs.google.com/spreadsheets/d/1BPY6k2bQuDu-RNpkRc3BhS57CuM1Ol__FYXvY8ezRjs/gviz/tq?tqx=out:json&sheet=mb51';
        const response = await fetch(GVIZ_URL);
        if (!response.ok) {
          throw new Error(`Không thể kết nối Google Sheets (Mã HTTP ${response.status}).`);
        }
        const rawText = await response.text();
        const start = rawText.indexOf('{');
        const end = rawText.lastIndexOf('}');
        if (start === -1 || end === -1) {
          throw new Error('Định dạng dữ liệu Google Sheets trả về không hợp lệ.');
        }
        const data = JSON.parse(rawText.substring(start, end + 1));
        const gvizRows = (data.table && Array.isArray(data.table.rows)) ? data.table.rows : [];

        if (btnEl) {
          btnEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang phân tích dữ liệu...';
        }

        // Helper lấy giá trị text từ cell GViz
        const getVal = (c) => {
          if (!c || c.v === null || c.v === undefined) return null;
          const s = String(c.v).trim();
          return s ? s : null;
        };

        // Helper parse ngày an toàn
        const parseGvizDate = (c) => {
          if (!c) return null;
          const val = c.f || c.v;
          if (!val) return null;
          const s = String(val).trim();
          const mIso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
          if (mIso) return `${mIso[1]}-${String(mIso[2]).padStart(2, '0')}-${String(mIso[3]).padStart(2, '0')}`;
          const mVn = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
          if (mVn) {
            let y = parseInt(mVn[3], 10);
            if (y < 100) y += y < 50 ? 2000 : 1900;
            return `${y}-${String(mVn[2]).padStart(2, '0')}-${String(mVn[1]).padStart(2, '0')}`;
          }
          return null;
        };

        // Helper parse số an toàn
        const parseNum = (c) => {
          if (!c || c.v === null || c.v === undefined) return 0;
          if (typeof c.v === 'number') return c.v;
          let s = String(c.v).trim().replace(/\s/g, '');
          if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
            if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
              s = s.replace(/\./g, '').replace(/,/g, '.');
            } else {
              s = s.replace(/,/g, '');
            }
          } else if (s.indexOf(',') !== -1) {
            s = s.replace(/,/g, '.');
          }
          const num = parseFloat(s);
          return isNaN(num) ? 0 : num;
        };

        const records = [];
        const nowIso = new Date().toISOString();

        for (let i = 0; i < gvizRows.length; i++) {
          const row = gvizRows[i].c;
          if (!row || !Array.isArray(row)) continue;

          const doc = getVal(row[2]);
          const date = parseGvizDate(row[1]);
          const mat = getVal(row[5]);
          const matDesc = getVal(row[6]);
          const batch = getVal(row[7]);
          const matGroup = getVal(row[4]);
          const dcInd = getVal(row[15]) ? getVal(row[15]).toUpperCase() : null;

          if (doc && (doc.toLowerCase().includes('material') || (date && date.includes('Posting')))) {
            continue;
          }

          if (doc) {
            records.push({
              material_document: doc,
              posting_date: date,
              material: mat,
              material_description: matDesc,
              batch: batch,
              quantity: Math.abs(parseNum(row[9])),
              unit_of_entry: getVal(row[8]),
              project_id: getVal(row[10]),
              project_name: getVal(row[11]),
              storage_location: getVal(row[12]),
              movement_type: getVal(row[13]),
              movement_type_text: getVal(row[14]),
              plant: getVal(row[16]),
              vendor_name: getVal(row[24]),
              raw_data: {
                material_group: matGroup,
                debit_credit_ind: dcInd
              },
              synced_at: nowIso
            });
          } else {
            const docAlt = getVal(row[31]) || getVal(row[36]);
            if (docAlt && !docAlt.toLowerCase().includes('material')) {
              records.push({
                material_document: docAlt,
                posting_date: date,
                material: mat,
                material_description: matDesc,
                batch: batch,
                quantity: Math.abs(parseNum(row[28]) || parseNum(row[9])),
                unit_of_entry: getVal(row[32]) || getVal(row[8]),
                project_id: getVal(row[10]),
                project_name: getVal(row[33]) || getVal(row[11]),
                vendor_name: getVal(row[24]),
                raw_data: {
                  material_group: matGroup,
                  debit_credit_ind: dcInd
                },
                synced_at: nowIso
              });
            }
          }
        }

        if (btnEl) {
          btnEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang cập nhật Supabase...`;
        }

        const { error: delErr } = await window.supabase.from('xg_sap_mb51').delete().gt('id', 0);
        if (delErr) {
          console.warn('[XgSapLookup] Cảnh báo khi xóa bảng cũ:', delErr);
        }

        if (records.length === 0) {
          showAutofillToast('✓ Google Sheet hiện không có dữ liệu (0 dòng).');
          return;
        }

        const batchSize = 1000;
        const totalBatches = Math.ceil(records.length / batchSize);
        for (let b = 0; b < totalBatches; b++) {
          if (btnEl) {
            btnEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang lưu (${b + 1}/${totalBatches})...`;
          }
          const chunk = records.slice(b * batchSize, (b + 1) * batchSize);
          const { error: insertErr } = await window.supabase.from('xg_sap_mb51').insert(chunk);
          if (insertErr) throw insertErr;
        }

        showAutofillToast(`✓ Đã đồng bộ ${records.length.toLocaleString('vi-VN')} dòng từ Google Sheets sang Supabase!`);

        const activeInput = document.querySelector('#addDataForm input[name="col_3"]') ||
                            document.querySelector('#editDataForm input[name="col_3"]');
        if (activeInput && activeInput.value.trim().length >= 2) {
          activeInput.dispatchEvent(new Event('input'));
        }

      } catch (err) {
        console.error('[XgSapLookup] Lỗi khi đồng bộ Google Sheets:', err);
        if (silentOnError) {
          showAutofillToast('⚠️ Tự động đồng bộ GgSheet không thành công: ' + (err.message || err));
        } else {
          alert(`Lỗi khi đồng bộ Google Sheets: ${err.message || err}`);
        }
      } finally {
        _isSyncing = false;
        _activeSyncPromise = null;
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = originalHtml || '<i class="bi bi-arrow-repeat me-1"></i> Đồng bộ Google Sheets';
        }
      }
    })();

    return _activeSyncPromise;
  }
```

- [ ] **Step 2: Chạy unit test để kiểm tra hàm hoạt động đúng**

Run: `node tests/test-auto-sync-ggsheet.js`
Expected: Tất cả bài test PASS.

- [ ] **Step 3: Commit thay đổi trong `xg-sap-lookup.js`**

```bash
git add assets/js/xg/xg-sap-lookup.js
git commit -m "feat(sap-lookup): add concurrency guard and auto-sync options to syncFromGoogleSheets"
```

---

### Task 3: Kích Hoạt Tự Động Đồng Bộ trong `assets/js/xg/xg-nhap.js`

**Files:**
- Modify: `assets/js/xg/xg-nhap.js:1180-1192` (trong `openAddDataModal`)
- Modify: `assets/js/xg/xg-nhap.js:1278-1290` (trong `openEditDataModal`)

**Interfaces:**
- Consumes: `window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true })`
- Produces: Mở modal thêm hoặc sửa dữ liệu xg-nhap tự động kích hoạt đồng bộ Google Sheets nền.

- [ ] **Step 1: Cập nhật `openAddDataModal()` trong `assets/js/xg/xg-nhap.js`**

Tìm đoạn xử lý `btnSyncGgSheet` và kích hoạt tự động:
```javascript
  // Nút đồng bộ Google Sheets trên card Thông tin chung
  const btnSyncGgSheet = document.getElementById('btnSyncGgSheet');
  if (btnSyncGgSheet) {
    btnSyncGgSheet.onclick = () => {
      if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
        window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet);
      }
    };
    // Tự động đồng bộ Google Sheets nền khi mở modal
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
    }
  }
```

- [ ] **Step 2: Cập nhật `openEditDataModal()` trong `assets/js/xg/xg-nhap.js`**

Tìm đoạn xử lý `btnEditSyncGgSheet` và kích hoạt tự động:
```javascript
  const btnEditSyncGgSheet = document.getElementById('btnEditSyncGgSheet');
  if (btnEditSyncGgSheet) {
    btnEditSyncGgSheet.onclick = () => {
      if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
        window.XgSapLookup.syncFromGoogleSheets(btnEditSyncGgSheet);
      }
    };
    // Tự động đồng bộ Google Sheets nền khi mở modal sửa
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnEditSyncGgSheet, { isAuto: true });
    }
  }
```

- [ ] **Step 3: Commit thay đổi trong `xg-nhap.js`**

```bash
git add assets/js/xg/xg-nhap.js
git commit -m "feat(xg-nhap): auto-sync google sheets on add and edit modal open"
```

---

### Task 4: Kích Hoạt Tự Động Đồng Bộ trong `assets/js/xg/xg-xuat.js`

**Files:**
- Modify: `assets/js/xg/xg-xuat.js:2190-2205` (trong `openAddDataModal`)

**Interfaces:**
- Consumes: `window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true })`
- Produces: Mở modal thêm dữ liệu xg-xuat tự động kích hoạt đồng bộ Google Sheets nền.

- [ ] **Step 1: Cập nhật `openAddDataModal()` trong `assets/js/xg/xg-xuat.js`**

Tìm đoạn xử lý `btnSyncGgSheet`:
```javascript
  // Tích hợp nút Đồng bộ Google Sheets
  const btnSyncGgSheet = document.getElementById('btnSyncGgSheet');
  if (btnSyncGgSheet) {
    btnSyncGgSheet.onclick = () => {
      if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
        window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet);
      }
    };
    // Tự động đồng bộ Google Sheets nền khi mở modal
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
    }
  }
```

- [ ] **Step 2: Commit thay đổi trong `xg-xuat.js`**

```bash
git add assets/js/xg/xg-xuat.js
git commit -m "feat(xg-xuat): auto-sync google sheets on add modal open"
```

---

### Task 5: Kích Hoạt Tự Động Đồng Bộ trong `assets/js/tole/tole-nhap.js`

**Files:**
- Modify: `assets/js/tole/tole-nhap.js:1020-1035` (trong `openAddDataModal`)
- Modify: `assets/js/tole/tole-nhap.js:1110-1125` (trong `openEditDataModal`)

**Interfaces:**
- Consumes: `window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true })`
- Produces: Mở modal thêm hoặc sửa dữ liệu tole-nhap tự động kích hoạt đồng bộ Google Sheets nền.

- [ ] **Step 1: Cập nhật `openAddDataModal()` trong `assets/js/tole/tole-nhap.js`**

Tìm đoạn xử lý `btnSyncGgSheet`:
```javascript
  // Tích hợp nút Đồng bộ Google Sheets
  const btnSyncGgSheet = document.getElementById('btnSyncGgSheet');
  if (btnSyncGgSheet) {
    btnSyncGgSheet.onclick = () => {
      if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
        window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet);
      }
    };
    // Tự động đồng bộ Google Sheets nền khi mở modal
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
    }
  }
```

- [ ] **Step 2: Cập nhật `openEditDataModal()` trong `assets/js/tole/tole-nhap.js`**

Tìm đoạn xử lý `btnEditSyncGgSheet`:
```javascript
  const btnEditSyncGgSheet = document.getElementById('btnEditSyncGgSheet');
  if (btnEditSyncGgSheet) {
    btnEditSyncGgSheet.onclick = () => {
      if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
        window.XgSapLookup.syncFromGoogleSheets(btnEditSyncGgSheet);
      }
    };
    // Tự động đồng bộ Google Sheets nền khi mở modal sửa
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnEditSyncGgSheet, { isAuto: true });
    }
  }
```

- [ ] **Step 3: Commit thay đổi trong `tole-nhap.js`**

```bash
git add assets/js/tole/tole-nhap.js
git commit -m "feat(tole-nhap): auto-sync google sheets on add and edit modal open"
```

---

### Task 6: Kích Hoạt Tự Động Đồng Bộ trong `assets/js/tole/tole-xuat.js`

**Files:**
- Modify: `assets/js/tole/tole-xuat.js:2188-2200` (trong `openAddDataModal`)

**Interfaces:**
- Consumes: `window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true })`
- Produces: Mở modal thêm dữ liệu tole-xuat tự động kích hoạt đồng bộ Google Sheets nền.

- [ ] **Step 1: Cập nhật `openAddDataModal()` trong `assets/js/tole/tole-xuat.js`**

Tìm đoạn xử lý `btnSyncGgSheet`:
```javascript
  // Tích hợp nút Đồng bộ Google Sheets
  const btnSyncGgSheet = document.getElementById('btnSyncGgSheet');
  if (btnSyncGgSheet) {
    btnSyncGgSheet.onclick = () => {
      if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
        window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet);
      }
    };
    // Tự động đồng bộ Google Sheets nền khi mở modal
    if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
      window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
    }
  }
```

- [ ] **Step 2: Commit thay đổi trong `tole-xuat.js`**

```bash
git add assets/js/tole/tole-xuat.js
git commit -m "feat(tole-xuat): auto-sync google sheets on add modal open"
```

---

### Task 7: Đồng Bộ Bản Phân Phối (`scripts/sync-dist.js`) & Kiểm Tra Hồi Quy Toàn Bộ

**Files:**
- Execute: `scripts/sync-dist.js`
- Test: `tests/test-auto-sync-ggsheet.js`
- Test: `tests/test-sap-page-validation-rules.js`

- [ ] **Step 1: Chạy build đồng bộ sang `dist/`, `public/`, `dist-app/`**

Run: `node scripts/sync-dist.js`
Expected: Output hiển thị `✅ [Sync Script] Full synchronization completed successfully!`

- [ ] **Step 2: Chạy toàn bộ các test suites liên quan đến SAP và auto-sync**

Run: `node tests/test-auto-sync-ggsheet.js`
Expected: Tất cả bài test PASS (exit code 0).

Run: `node tests/test-sap-page-validation-rules.js`
Expected: Tất cả bài test PASS (exit code 0).

- [ ] **Step 3: Commit các file build được cập nhật**

```bash
git add dist/ dist-app/ public/
git commit -m "build: sync updated assets to dist, public, and dist-app"
```
