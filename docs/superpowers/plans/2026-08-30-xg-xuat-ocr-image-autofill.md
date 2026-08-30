# XG-Xuat OCR Image Auto-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an image upload/paste/camera OCR scanning feature in `xg-xuat.html` to automatically extract and populate data from Dai Dung "Phiếu Xuất Kho" receipts into the Add Data modal form.

**Architecture:** A modular `ReceiptOcrService` (`assets/js/core/receipt-ocr-service.js`) handles image preprocessing and extraction using Gemini Vision API (high precision) with client-side OCR fallback. `xg-xuat.js` integrates with the UI dropzone in `pages/xg/xg-xuat.html`, captures paste/drop/upload events, maps the extracted receipt data to form fields according to specific user rules, and triggers feedback animations.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5 Drag & Drop and Clipboard APIs, Bootstrap 5 Modals, CSS3 animations.

## Global Constraints

- `Mã chứng từ`: Default to `"PX"` (auto-add `<option value="PX">PX</option>` if not present and select it).
- `Ngày xuất`: Extracted from date string on receipt (`dd/mm/yyyy` -> `yyyy-mm-dd`).
- `Phiếu xuất`: Extracted from "Số phiếu (No.):".
- `Loại xuất`: Extracted from "Đơn vị nhận" or "Loại giao dịch" (e.g. "Xưởng sản xuất").
- `Mã vật tư`: Extracted from "Mã hàng", auto-enable "+ Thêm cuộn" button.
- `Tên vật tư`: Extracted from "Tên hàng".
- `Batch`: Extracted from "Lô".
- `Mã công trình` & `Tên công trình`: Extracted from "Đối tượng chi phí (Cost Object)" (split code and name).
- `Số lượng (Kg)`: MUST be left empty for manual user entry or inventory roll picking.
- `Ghi chú`: MUST be left empty.

---

### Task 1: Create Receipt OCR Service (`assets/js/core/receipt-ocr-service.js`)

**Files:**
- Create: `assets/js/core/receipt-ocr-service.js`
- Test: `tests/test-receipt-ocr.html`

**Interfaces:**
- Produces: `window.ReceiptOcrService = { processImage(fileOrBlob), setApiKey(key), getApiKey(), hasApiKey() }`
- Output Schema:
  ```json
  {
    "ngayXuat": "2026-08-31",
    "phieuXuat": "4900137998",
    "maChungTu": "PX",
    "loaiXuat": "Xưởng sản xuất",
    "maVatTu": "10002377",
    "tenVatTu": "Phôi tôn mạ 1.0x1200 Z275 G450",
    "batch": "PHN-VN",
    "maCongTrinh": "10626-056.01",
    "tenCongTrinh": "DG TN APF ĐỒNG NAI",
    "soLuongKg": null,
    "ghiChu": ""
  }
  ```

- [ ] **Step 1: Write test harness file for OCR service**

Create `tests/test-receipt-ocr.html` to verify `ReceiptOcrService` instantiation and parsing logic.

- [ ] **Step 2: Implement `assets/js/core/receipt-ocr-service.js`**

Implement `ReceiptOcrService` supporting:
- Gemini Vision API via `generateContent` endpoint (model `gemini-1.5-flash` or `gemini-2.0-flash` with structured system prompt and JSON schema).
- Built-in regex rule parser for raw OCR / fallback text extraction.
- LocalStorage persistence for API Key (`gemini_ocr_api_key`).
- Standardized return format matching the schema above.

- [ ] **Step 3: Commit Task 1**

```bash
git add assets/js/core/receipt-ocr-service.js tests/test-receipt-ocr.html
git commit -m "feat(ocr): add ReceiptOcrService for receipt image data extraction"
```

---

### Task 2: Add Dropzone and Field Highlight Styles (`assets/css/xg/xg-xuat.css`)

**Files:**
- Modify: `assets/css/xg/xg-xuat.css`

- [ ] **Step 1: Add CSS rules for OCR dropzone and animations**

Add styles in `assets/css/xg/xg-xuat.css`:
- `#imageOcrDropzone`: dashed border, rounded corners, hover/dragover glow.
- `.ocr-dropzone-inner`: flex layout, upload/camera buttons, clipboard shortcut badge.
- `.ocr-processing-overlay`: spinner and text pulsing animation.
- `.field-highlight-autofill`: temporary soft green glow (`@keyframes autofillHighlight`) to signify auto-filled fields.

- [ ] **Step 2: Commit Task 2**

```bash
git add assets/css/xg/xg-xuat.css
git commit -m "style(xg-xuat): add OCR dropzone and autofill highlight animations"
```

---

### Task 3: Update `pages/xg/xg-xuat.html` with Dropzone and Script Tag

**Files:**
- Modify: `pages/xg/xg-xuat.html`

- [ ] **Step 1: Add OCR Dropzone to `#addDataModal`**

Insert the dropzone HTML inside `#addDataForm .modal-body` right before the "Thông tin chung" card:
- Dropzone with file input `<input type="file" id="receiptImageInput" accept="image/*">`, camera input `<input type="file" id="receiptCameraInput" accept="image/*" capture="environment">`.
- Quick API Key setting button (`#btnOcrSettings`).
- Thumbnail preview with reset button.

- [ ] **Step 2: Add API Key Configuration Modal**

Add `#ocrSettingsModal` to allow users to easily set or update their Gemini API key with instructions.

- [ ] **Step 3: Include `receipt-ocr-service.js` script tag**

Include `<script src="/assets/js/core/receipt-ocr-service.js?v=2.0.3"></script>` before `xg-xuat.js`.

- [ ] **Step 4: Commit Task 3**

```bash
git add pages/xg/xg-xuat.html
git commit -m "feat(xg-xuat): add OCR dropzone and settings modal to xg-xuat.html"
```

---

### Task 4: Hook Up Image OCR Extraction & Autofill in `assets/js/xg/xg-xuat.js`

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`

- [ ] **Step 1: Add Event Listeners for Dropzone, Paste, and Camera**

In `assets/js/xg/xg-xuat.js`:
- Listen to `dragover`, `dragleave`, `drop` on `#imageOcrDropzone`.
- Listen to `change` on `#receiptImageInput` and `#receiptCameraInput`.
- Listen to `paste` event on `window` (when `#addDataModal` is visible and active).

- [ ] **Step 2: Implement Autofill and Highlight Logic**

Create function `populateFieldsFromOcr(ocrResult)`:
1. Set `Mã chứng từ`: Ensure `<option value="PX">PX</option>` exists and select it.
2. Set `Ngày xuất`: Format `ocrResult.ngayXuat` into `yyyy-mm-dd` on date input.
3. Set `Phiếu xuất`: Set value from `ocrResult.phieuXuat`.
4. Set `Loại xuất`: Select matching option (e.g. `Xưởng sản xuất`).
5. Set `Mã vật tư`: Set value, update `#addDataMaVatTu`, and enable `#btnAddRoll`.
6. Set `Tên vật tư`: Set value from `ocrResult.tenVatTu`.
7. Set `Batch`: Set value from `ocrResult.batch`.
8. Set `Mã công trình`: Set value from `ocrResult.maCongTrinh`.
9. Set `Tên công trình`: Set value from `ocrResult.tenCongTrinh`.
10. Ensure `Số lượng (Kg)` and `Ghi chú` remain untouched / empty.
11. Apply `.field-highlight-autofill` animation to modified fields.

- [ ] **Step 3: Add API Key Modal Event Handlers**

Connect `#btnOcrSettings`, `#saveApiKeyBtn`, and `#testApiKeyBtn` to `ReceiptOcrService`.

- [ ] **Step 4: Commit Task 4**

```bash
git add assets/js/xg/xg-xuat.js
git commit -m "feat(xg-xuat): implement OCR handlers and autofill mapping logic"
```

---

### Task 5: Sync Distributions & End-to-End Verification

**Files:**
- Sync targets: `public/`, `dist/`, `dist-app/` via `scripts/sync-dist.js`

- [ ] **Step 1: Run `node scripts/sync-dist.js`**

Execute: `node scripts/sync-dist.js`
Verify that `public/pages/xg/xg-xuat.html`, `public/assets/js/core/receipt-ocr-service.js`, `public/assets/js/xg/xg-xuat.js`, and `public/assets/css/xg/xg-xuat.css` are updated.

- [ ] **Step 2: End-to-End Verification**

1. Launch local dev server: `npm run dev` or test file via browser.
2. Open `xg-xuat.html`.
3. Click "Thêm dữ liệu".
4. Upload or paste sample Phiếu Xuất Kho image.
5. Verify extracted fields:
   - `Mã chứng từ` is `"PX"`
   - `Ngày xuất` is `2026-08-31`
   - `Phiếu xuất` is `4900137998`
   - `Loại xuất` is `Xưởng sản xuất`
   - `Mã vật tư` is `10002377`
   - `Tên vật tư` is `Phôi tôn mạ 1.0x1200 Z275 G450`
   - `Batch` is `PHN-VN`
   - `Mã công trình` is `10626-056.01`
   - `Tên công trình` is `DG TN APF ĐỒNG NAI`
   - `Số lượng (Kg)` is empty
   - `Ghi chú` is empty
6. Verify "+ Thêm cuộn" button is enabled with `10002377`.

- [ ] **Step 3: Commit Task 5**

```bash
git add -A
git commit -m "chore: sync distribution files and finalize OCR autofill feature"
```
