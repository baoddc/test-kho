# OCR API Key Integration and Obfuscation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp sẵn và mã hóa bảo mật API Key Gemini Vision (`GEMINI_API_KEY_REDACTED`) vào hệ thống kho xà gồ và tole, gỡ bỏ UI cấu hình để người dùng không thể thấy hay copy API key.

**Architecture:** Sử dụng kỹ thuật mã hóa mảng byte đa tầng kết hợp biến đổi XOR động trong phạm vi đóng (IIFE closure) của `ReceiptOcrService`, loại bỏ hoàn toàn chuỗi thô của API Key khỏi mã nguồn và `localStorage`. Gỡ bỏ nút cài đặt `#btnOcrSettings` và modal `#ocrSettingsModal` khỏi giao diện `xg-xuat.html` và `tole-xuat.html`. Sau đó đồng bộ toàn bộ thư mục qua `scripts/sync-dist.js`.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, Bootstrap 5, Node.js (sync script).

## Global Constraints
- API Key thô không được xuất hiện dưới bất kỳ hình thức chuỗi văn bản rõ nào trong mã nguồn.
- Không lưu trữ API Key thô vào `localStorage` hoặc `sessionStorage`.
- Giữ nguyên các chức năng quét ảnh, bóc tách phiếu xuất kho của `ReceiptOcrService`.
- Đảm bảo tương thích cả trên Web và ứng dụng Android (Capacitor qua `dist-app`).

---

### Task 1: Mã hóa và nhúng sẵn API Key trong `assets/js/core/receipt-ocr-service.js`

**Files:**
- Modify: `assets/js/core/receipt-ocr-service.js:10-60`
- Test: `tests/test-receipt-ocr.html`

**Interfaces:**
- Produces: `ReceiptOcrService.hasApiKey() -> boolean (luôn true với key nhúng sẵn)`
- Produces: `ReceiptOcrService.getApiKey() -> string (trả về key đã giải mã tức thời)`

- [ ] **Step 1: Cập nhật `tests/test-receipt-ocr.html` để kiểm tra key nhúng sẵn**
Thêm bài test kiểm tra `ReceiptOcrService.hasApiKey()` trả về `true` ngay cả khi `localStorage` rỗng.

- [ ] **Step 2: Triển khai thuật toán giải mã XOR byte array trong closure của `receipt-ocr-service.js`**
Mã hóa chuỗi API Key thành byte array:
```javascript
const _SEC_DATA = [27,48,70,46,20,69,214,197,164,211,201,214,220,207,216,160,187,129,128,174,146,186,130,163,50,81,86,64,40,106,116,30,111,49,126,63,29,59,59,14,2,53,177,195,232,194,218,250,216,248,217,230,177];
function _getEmbeddedKey() {
  return String.fromCharCode(..._SEC_DATA.map((b, i) => b ^ ((0x5A + i * 7) & 0xFF)));
}
```
Cập nhật `getApiKey()` và `hasApiKey()` để luôn fallback về `_getEmbeddedKey()`.

- [ ] **Step 3: Chạy test kiểm tra hàm giải mã**
Run: `node -e "const s=[27,48,70,46,20,69,214,197,164,211,201,214,220,207,216,160,187,129,128,174,146,186,130,163,50,81,86,64,40,106,116,30,111,49,126,63,29,59,59,14,2,53,177,195,232,194,218,250,216,248,217,230,177]; console.log(String.fromCharCode(...s.map((b,i)=>b^((0x5A+i*7)&0xFF))).startsWith('AQ.'));"`
Expected: `true`

- [ ] **Step 4: Commit**
```bash
git add assets/js/core/receipt-ocr-service.js tests/test-receipt-ocr.html
git commit -m "feat(ocr): embed obfuscated Gemini API key in ReceiptOcrService"
```

---

### Task 2: Gỡ bỏ nút Cài đặt & Modal cấu hình trong `pages/xg/xg-xuat.html` và `pages/tole/tole-xuat.html`

**Files:**
- Modify: `pages/xg/xg-xuat.html`
- Modify: `pages/tole/tole-xuat.html`

- [ ] **Step 1: Xóa nút `#btnOcrSettings` khỏi `pages/xg/xg-xuat.html`**
Xóa phần tử `<button type="button" ... id="btnOcrSettings" title="Cấu hình API Key AI">...</button>`.

- [ ] **Step 2: Xóa modal `#ocrSettingsModal` khỏi `pages/xg/xg-xuat.html`**
Xóa khối `<div class="modal fade" id="ocrSettingsModal" ...>...</div>`.

- [ ] **Step 3: Xóa nút `#btnOcrSettings` và modal `#ocrSettingsModal` khỏi `pages/tole/tole-xuat.html`**
Tương tự loại bỏ nút bánh răng và modal cấu hình khỏi `pages/tole/tole-xuat.html`.

- [ ] **Step 4: Commit**
```bash
git add pages/xg/xg-xuat.html pages/tole/tole-xuat.html
git commit -m "refactor(ocr): remove API key settings button and modal from xg and tole xuat pages"
```

---

### Task 3: Dọn dẹp mã JS xử lý cài đặt trong `assets/js/xg/xg-xuat.js` và `assets/js/tole/tole-xuat.js`

**Files:**
- Modify: `assets/js/xg/xg-xuat.js:1460-1580`
- Modify: `assets/js/tole/tole-xuat.js:1460-1580`

- [ ] **Step 1: Dọn dẹp mã gắn sự kiện `#btnOcrSettings` và `#ocrSettingsModal` trong `assets/js/xg/xg-xuat.js`**
Loại bỏ handler mở modal `#ocrSettingsModal`, toggle eye visibility, test key, save key.

- [ ] **Step 2: Dọn dẹp mã gắn sự kiện tương tự trong `assets/js/tole/tole-xuat.js`**
Loại bỏ handler mở modal `#ocrSettingsModal`, toggle eye visibility, test key, save key.

- [ ] **Step 3: Commit**
```bash
git add assets/js/xg/xg-xuat.js assets/js/tole/tole-xuat.js
git commit -m "refactor(ocr): clean up settings modal handlers in xg-xuat.js and tole-xuat.js"
```

---

### Task 4: Đồng bộ build và Kiểm tra toàn diện (Verification)

**Files:**
- Modify: `dist/**`, `public/**`, `dist-app/**` (thông qua `scripts/sync-dist.js`)

- [ ] **Step 1: Chạy đồng bộ dự án**
Run: `node scripts/sync-dist.js`

- [ ] **Step 2: Kiểm tra bảo mật chuỗi (Grep Scan)**
Chạy tìm kiếm chuỗi thô của API Key trong toàn bộ thư mục dự án để đảm bảo không còn xuất hiện ở bất kỳ file nào.
Run: `git grep -F "GEMINI_API_KEY_REDACTED" -- ':!docs/'`
Expected: Không tìm thấy kết quả nào.

- [ ] **Step 3: Commit các file đã sync**
```bash
git add dist public dist-app
git commit -m "build: sync distribution folders with obfuscated OCR service and UI updates"
```
