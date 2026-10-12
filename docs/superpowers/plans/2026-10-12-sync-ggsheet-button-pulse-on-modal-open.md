# Kế Hoạch Triển Khai: Nút Đồng Bộ Google Sheets Nhấp 3 Lần Khi Mở Modal Thêm / Sửa Dữ Liệu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) hoặc superpowers:executing-plans để thực hiện từng task trong kế hoạch này. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.

**Goal:** Khi mở modal Thêm dữ liệu hoặc Sửa dữ liệu tại 4 màn hình kho (`xg-nhap.html`, `xg-xuat.html`, `tole-nhap.html`, `tole-xuat.html`), nút "Đồng bộ Google Sheets" tự động nhấp nháy 3 nhịp trực quan (pulsing glow/scale & icon spinning) đồng thời chạy tiến trình đồng bộ dữ liệu ngầm từ Google Sheets sang Supabase.

**Architecture:** Sử dụng CSS keyframes `@keyframes syncPulse3x` kết hợp sự kiện DOM `animationend` để tạo hiệu ứng nhấp 3 nhịp trên nút. Tích hợp trực tiếp vào hàm `syncFromGoogleSheets` trong `assets/js/xg/xg-sap-lookup.js` với cờ `isAuto: true`. Bổ sung nút `#btnEditSyncGgSheet` vào modal Sửa tại `xg-xuat.html` và `tole-xuat.html` để đồng nhất 4 trang. Sử dụng `scripts/sync-dist.js` để đồng bộ kết quả sang các thư mục phân phối `dist/`, `public/`, `dist-app/`.

**Tech Stack:** HTML5, CSS3 (@keyframes, transitions), JavaScript ES6+ (DOM Events, Promise, Fetch API), Bootstrap 5.3, Supabase JS Client, Node.js Test Suite.

## Global Constraints
- Không làm gián đoạn hoặc khóa giao diện (non-blocking, non-intrusive UI).
- Không phá vỡ cơ chế Concurrency Guard (`_isSyncing`) đã xây dựng trước đó.
- Nút bấm thủ công vẫn hoạt động bình thường nếu người dùng tự nhấn.
- Chỉ sửa mã nguồn gốc tại `pages/` và `assets/`, sau đó dùng `node scripts/sync-dist.js` để đồng bộ tự động.

---

### Task 1: Định nghĩa CSS Animation Nhấp 3 Nhịp (`.btn-sync-pulsing-3x`)

**Files:**
- Modify: `assets/css/trang-chu/home.css` (khoảng cuối file)
- Test: `tests/test-css-animation.js`

**Interfaces:**
- Produces: CSS class `.btn-sync-pulsing-3x` và keyframe animation `@keyframes syncPulse3x`, `@keyframes syncSpinIcon`.

- [ ] **Step 1: Viết test kiểm tra khai báo CSS animation**

Tạo file `tests/test-css-animation.js`:
```javascript
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cssContent = fs.readFileSync(path.join(__dirname, '../assets/css/trang-chu/home.css'), 'utf8');

console.log('Testing CSS Animation declarations...');
assert(cssContent.includes('@keyframes syncPulse3x'), 'CSS phải có khai báo @keyframes syncPulse3x');
assert(cssContent.includes('.btn-sync-pulsing-3x'), 'CSS phải có class .btn-sync-pulsing-3x');
assert(cssContent.includes('syncPulse3x 0.6s ease-in-out 3'), 'Animation phải chạy đúng 3 chu kỳ 0.6s');
console.log('✓ [PASS] CSS Animation declarations validated');
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `node tests/test-css-animation.js`
Expected: FAIL với "CSS phải có khai báo @keyframes syncPulse3x"

- [ ] **Step 3: Thêm mã CSS vào cuối file `assets/css/trang-chu/home.css`**

Thêm đoạn CSS sau vào cuối `assets/css/trang-chu/home.css`:
```css
/* =============================================================================
   HIỆU ỨNG NÚT ĐỒNG BỘ GOOGLE SHEETS NHẤP 3 LẦN
================================================================================ */
@keyframes syncPulse3x {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.7);
    background-color: #ffffff;
    color: #0d6efd;
  }
  30% {
    transform: scale(1.06);
    box-shadow: 0 0 0 8px rgba(13, 110, 253, 0.35);
    background-color: #0d6efd;
    color: #ffffff;
  }
  60% {
    transform: scale(1.02);
    box-shadow: 0 0 0 12px rgba(13, 110, 253, 0);
    background-color: #0d6efd;
    color: #ffffff;
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(13, 110, 253, 0);
    background-color: #ffffff;
    color: #0d6efd;
  }
}

@keyframes syncSpinIcon {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn-sync-pulsing-3x {
  animation: syncPulse3x 0.6s ease-in-out 3 !important;
  transition: all 0.2s ease;
  z-index: 10;
  position: relative;
}

.btn-sync-pulsing-3x i.bi-arrow-repeat {
  display: inline-block;
  animation: syncSpinIcon 0.6s linear infinite !important;
}
```

- [ ] **Step 4: Chạy test để xác nhận test thành công**

Run: `node tests/test-css-animation.js`
Expected: PASS

- [ ] **Step 5: Commit thay đổi CSS**

```bash
git add assets/css/trang-chu/home.css tests/test-css-animation.js
git commit -m "feat(css): add 3x pulse animation for google sheets sync button"
```

---

### Task 2: Cải tiến logic `triggerButtonPulse3x` và tích hợp vào `syncFromGoogleSheets` trong `xg-sap-lookup.js`

**Files:**
- Modify: `assets/js/xg/xg-sap-lookup.js`
- Modify: `tests/test-auto-sync-ggsheet.js`

**Interfaces:**
- Consumes: CSS class `.btn-sync-pulsing-3x`.
- Produces: `window.XgSapLookup.triggerButtonPulse3x(btnEl)` và `syncFromGoogleSheets(btnEl, { isAuto: true })` tự động kích hoạt hiệu ứng 3 nhịp trên nút.

- [ ] **Step 1: Viết test cho `triggerButtonPulse3x` trong `tests/test-auto-sync-ggsheet.js`**

Mở rộng `tests/test-auto-sync-ggsheet.js` với kiểm thử cho hàm `triggerButtonPulse3x`:
```javascript
  // Test 4: Kiểm tra hàm triggerButtonPulse3x được xuất ra và gán class chính xác
  runTest('Hàm triggerButtonPulse3x thêm class btn-sync-pulsing-3x và xử lý gỡ class sau animationend', () => {
    assert.strictEqual(typeof SapLookup.triggerButtonPulse3x, 'function');
    let classes = [];
    let listeners = {};
    const mockEl = {
      classList: {
        add: (cls) => classes.push(cls),
        remove: (cls) => { classes = classes.filter(c => c !== cls); },
        contains: (cls) => classes.includes(cls)
      },
      offsetWidth: 100,
      addEventListener: (evt, fn) => { listeners[evt] = fn; },
      removeEventListener: (evt, fn) => { delete listeners[evt]; }
    };
    SapLookup.triggerButtonPulse3x(mockEl);
    assert(mockEl.classList.contains('btn-sync-pulsing-3x'), 'Phải gắn class btn-sync-pulsing-3x vào nút');
    assert(typeof listeners['animationend'] === 'function', 'Phải đăng ký lắng nghe sự kiện animationend');
    
    // Giả lập animation kết thúc
    listeners['animationend']();
    assert(!mockEl.classList.contains('btn-sync-pulsing-3x'), 'Phải gỡ bỏ class btn-sync-pulsing-3x sau animationend');
  });
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `node tests/test-auto-sync-ggsheet.js`
Expected: FAIL với "SapLookup.triggerButtonPulse3x is not a function"

- [ ] **Step 3: Triển khai hàm `triggerButtonPulse3x` và tích hợp vào `syncFromGoogleSheets`**

Trong `assets/js/xg/xg-sap-lookup.js`:
1. Thêm hàm `triggerButtonPulse3x`:
```javascript
  /**
   * Kích hoạt hiệu ứng nhấp nháy 3 nhịp trực quan trên nút
   * @param {HTMLElement} btnEl
   */
  function triggerButtonPulse3x(btnEl) {
    if (!btnEl) return;
    if (btnEl.classList && typeof btnEl.classList.remove === 'function') {
      btnEl.classList.remove('btn-sync-pulsing-3x');
      void btnEl.offsetWidth; // Force reflow
      btnEl.classList.add('btn-sync-pulsing-3x');

      const onAnimationEnd = () => {
        if (btnEl.classList) {
          btnEl.classList.remove('btn-sync-pulsing-3x');
        }
        if (typeof btnEl.removeEventListener === 'function') {
          btnEl.removeEventListener('animationend', onAnimationEnd);
        }
      };

      if (typeof btnEl.addEventListener === 'function') {
        btnEl.addEventListener('animationend', onAnimationEnd);
      }
    }
  }
```

2. Trong hàm `syncFromGoogleSheets(btnEl, options = {})`:
Khi `btnEl` được truyền vào và `isAuto === true`:
- Gọi ngay `triggerButtonPulse3x(btnEl)`.
- Khi ở chế độ tự động `isAuto === true`, giữ nguyên `innerHTML` và icon xoay quay tròn trong 3 nhịp đầu (không đổi thành text `Đang tải Google Sheets...` ngay lập tức để người dùng thấy rõ nút nguyên bản đang nhấp nháy 3 nhịp).
- Sau khi kết thúc hoặc trong `finally`, phục hồi nút và gỡ bỏ class nếu còn.

3. Export `triggerButtonPulse3x` trong đối tượng `window.XgSapLookup`.

- [ ] **Step 4: Chạy lại test suite để kiểm tra tính đúng đắn**

Run: `node tests/test-auto-sync-ggsheet.js`
Expected: PASS (toàn bộ 4/4 test pass)

- [ ] **Step 5: Commit thay đổi trong `xg-sap-lookup.js`**

```bash
git add assets/js/xg/xg-sap-lookup.js tests/test-auto-sync-ggsheet.js
git commit -m "feat(sap-lookup): implement triggerButtonPulse3x and integrate into syncFromGoogleSheets"
```

---

### Task 3: Bổ sung nút `#btnEditSyncGgSheet` vào Modal Sửa tại `xg-xuat.html` và `tole-xuat.html`

**Files:**
- Modify: `pages/xg/xg-xuat.html`
- Modify: `pages/tole/tole-xuat.html`
- Test: `tests/test-html-buttons.js`

**Interfaces:**
- Produces: Thẻ button `#btnEditSyncGgSheet` trong header card Thông tin chung của `#editDataModal` trên 2 trang xuất.

- [ ] **Step 1: Viết test kiểm tra sự tồn tại của các nút đồng bộ trên 4 trang HTML**

Tạo file `tests/test-html-buttons.js`:
```javascript
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pages = [
  { file: 'pages/xg/xg-nhap.html', addBtn: true, editBtn: true },
  { file: 'pages/xg/xg-xuat.html', addBtn: true, editBtn: true },
  { file: 'pages/tole/tole-nhap.html', addBtn: true, editBtn: true },
  { file: 'pages/tole/tole-xuat.html', addBtn: true, editBtn: true },
];

console.log('Testing HTML buttons existence...');
pages.forEach(p => {
  const content = fs.readFileSync(path.join(__dirname, '..', p.file), 'utf8');
  if (p.addBtn) {
    assert(content.includes('id="btnSyncGgSheet"'), `${p.file} phải có nút btnSyncGgSheet`);
  }
  if (p.editBtn) {
    assert(content.includes('id="btnEditSyncGgSheet"'), `${p.file} phải có nút btnEditSyncGgSheet`);
  }
});
console.log('✓ [PASS] All 4 pages have both add and edit sync buttons');
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `node tests/test-html-buttons.js`
Expected: FAIL vì `pages/xg/xg-xuat.html` chưa có `btnEditSyncGgSheet`

- [ ] **Step 3: Cập nhật HTML cho `pages/xg/xg-xuat.html` và `pages/tole/tole-xuat.html`**

1. Tại `pages/xg/xg-xuat.html`:
Tìm đoạn:
```html
              <!-- Common fields section -->
              <div class="card mb-3">
                <div class="card-header bg-primary text-white py-2">
                  <h6 class="mb-0">Thông tin chung</h6>
                </div>
                <div class="card-body">
```
Thay thế bằng:
```html
              <!-- Common fields section -->
              <div class="card mb-3">
                <div class="card-header bg-primary text-white py-2 d-flex justify-content-between align-items-center">
                  <h6 class="mb-0">Thông tin chung</h6>
                  <button type="button" id="btnEditSyncGgSheet" class="btn btn-sm btn-light text-primary fw-bold" title="Đồng bộ dữ liệu mới nhất từ Google Sheets">
                    <i class="bi bi-arrow-repeat me-1"></i> Đồng bộ Google Sheets
                  </button>
                </div>
                <div class="card-body">
```

2. Tại `pages/tole/tole-xuat.html`:
Tìm đoạn:
```html
              <!-- Common fields section -->
              <div class="card mb-3">
                <div class="card-header bg-primary text-white py-2">
                  <h6 class="mb-0">Thông tin chung</h6>
                </div>
                <div class="card-body">
```
Thay thế bằng:
```html
              <!-- Common fields section -->
              <div class="card mb-3">
                <div class="card-header bg-primary text-white py-2 d-flex justify-content-between align-items-center">
                  <h6 class="mb-0">Thông tin chung</h6>
                  <button type="button" id="btnEditSyncGgSheet" class="btn btn-sm btn-light text-primary fw-bold" title="Đồng bộ dữ liệu mới nhất từ Google Sheets">
                    <i class="bi bi-arrow-repeat me-1"></i> Đồng bộ Google Sheets
                  </button>
                </div>
                <div class="card-body">
```

- [ ] **Step 4: Chạy test để xác nhận test thành công**

Run: `node tests/test-html-buttons.js`
Expected: PASS

- [ ] **Step 5: Commit thay đổi HTML**

```bash
git add pages/xg/xg-xuat.html pages/tole/tole-xuat.html tests/test-html-buttons.js
git commit -m "feat(pages): add btnEditSyncGgSheet to edit modal in xg-xuat and tole-xuat"
```

---

### Task 4: Cập nhật JavaScript Nghiệp Vụ tại 4 Module (`xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`)

**Files:**
- Modify: `assets/js/xg/xg-nhap.js`
- Modify: `assets/js/xg/xg-xuat.js`
- Modify: `assets/js/tole/tole-nhap.js`
- Modify: `assets/js/tole/tole-xuat.js`

**Interfaces:**
- Consumes: `window.XgSapLookup.syncFromGoogleSheets(btn, { isAuto: true })`.
- Produces: Tự động kích hoạt khi mở `openAddDataModal()` và `openEditDataModal()` ở cả 4 trang.

- [ ] **Step 1: Cập nhật `assets/js/xg/xg-xuat.js` cho `openEditDataModal`**

Tìm hàm `openEditDataModal` trong `assets/js/xg/xg-xuat.js`, thêm xử lý nút `#btnEditSyncGgSheet`:
```javascript
  // Tích hợp nút Đồng bộ Google Sheets trong modal Sửa
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

- [ ] **Step 2: Cập nhật `assets/js/tole/tole-xuat.js` cho `openEditDataModal`**

Tìm hàm `openEditDataModal` trong `assets/js/tole/tole-xuat.js`, thêm xử lý nút `#btnEditSyncGgSheet`:
```javascript
  // Tích hợp nút Đồng bộ Google Sheets trong modal Sửa
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

- [ ] **Step 3: Kiểm tra và hoàn thiện `xg-nhap.js` và `tole-nhap.js`**

Xác nhận cả 2 hàm `openAddDataModal` và `openEditDataModal` trong `xg-nhap.js` và `tole-nhap.js` đều đã gắn sự kiện click và kích hoạt `{ isAuto: true }` cho `btnSyncGgSheet` và `btnEditSyncGgSheet`.

- [ ] **Step 4: Kiểm tra cú pháp (Syntax Check)**

Run:
```powershell
node -c assets/js/xg/xg-nhap.js
node -c assets/js/xg/xg-xuat.js
node -c assets/js/tole/tole-nhap.js
node -c assets/js/tole/tole-xuat.js
```
Expected: Không có lỗi cú pháp (exit code 0).

- [ ] **Step 5: Commit các thay đổi JS**

```bash
git add assets/js/xg/xg-xuat.js assets/js/tole/tole-xuat.js
git commit -m "feat(js): integrate edit modal auto-sync and pulse in xg-xuat and tole-xuat"
```

---

### Task 5: Đồng bộ thư mục phân phối và kiểm thử tổng thể

**Files:**
- Run: `node scripts/sync-dist.js`
- Test: Chạy toàn bộ test suites `node tests/test-auto-sync-ggsheet.js`, `node tests/test-css-animation.js`, `node tests/test-html-buttons.js`

- [ ] **Step 1: Chạy build đồng bộ `sync-dist.js`**

Run: `node scripts/sync-dist.js`
Expected: Output hiển thị `✅ [Sync Script] Full synchronization completed successfully!`

- [ ] **Step 2: Chạy kiểm tra toàn bộ test suites**

Run:
```powershell
node tests/test-auto-sync-ggsheet.js
node tests/test-css-animation.js
node tests/test-html-buttons.js
```
Expected: Toàn bộ các bài test đều PASS.

- [ ] **Step 3: Kiểm tra trạng thái Git và commit kết quả phân phối**

Run: `git status`
Commit:
```bash
git add dist/ public/ dist-app/
git commit -m "build: sync 3x pulse auto-sync assets to dist, public, and dist-app"
```

---

## Plan Self-Review Check
- [x] **Spec coverage**: Đáp ứng đầy đủ cả 4 trang (`xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`) và cả 2 loại modal (Thêm dữ liệu, Sửa dữ liệu).
- [x] **No Placeholders**: Mọi bước đều có mã nguồn cụ thể, lệnh chạy rõ ràng.
- [x] **Type & Name Consistency**: Tên class `.btn-sync-pulsing-3x`, tên animation `@keyframes syncPulse3x`, id nút `#btnSyncGgSheet` & `#btnEditSyncGgSheet` đồng nhất 100%.
