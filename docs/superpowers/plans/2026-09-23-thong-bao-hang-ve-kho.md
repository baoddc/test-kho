# Kế hoạch triển khai: Thông báo hàng về kho (XG-Nhập & Tole-Nhập)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng tính năng tổng hợp và phát thông báo hàng về kho từ `xg-nhap.html` và `tole-nhap.html` lên bảng `system_announcements`, tự động phân loại theo Tên công trình (hoặc [Tồn trơn]) và định dạng chuẩn theo mẫu ảnh.

**Architecture:** Tạo module tái sử dụng `assets/js/components/goods-arrival-notice.js` chịu trách nhiệm render Modal giao diện, truy vấn dữ liệu từ cả 2 bảng `xg-nhap` và `tole-nhap`, gom nhóm theo Tên công trình & cộng dồn Kg theo loại vật tư, hiển thị Live Preview và lưu trữ/cập nhật vào `system_announcements` trên Supabase. Nhúng module và nút bấm vào thanh công cụ của cả hai trang xg-nhap và tole-nhap.

**Tech Stack:** JavaScript (ES6+), Supabase JS Client, Bootstrap 5 Modal, Node.js assert (Unit tests).

## Global Constraints

- Tiêu đề thông báo: `Hàng về kho ngày DD/MM` (VD: `Hàng về kho ngày 29/08`).
- Định dạng nhóm: `[Tên công trình]` hoặc `[Tồn trơn]` (nếu để trống/null/khoảng trắng).
- Định dạng dòng vật tư: `${Tên vật tư}: ${Tổng kg}kg` với dấu chấm hàng nghìn kiểu Việt Nam (VD: `7.712kg`, `26.770kg`).
- Cùng ngày chỉ có tối đa 1 thông báo chung (nếu đã có thì UPDATE, chưa có thì INSERT).
- Luôn chạy `node scripts/sync-dist.js` (hoặc `npm run build`) sau khi sửa đổi mã nguồn.

---

### Task 1: Engine Gom nhóm, Định dạng Thông báo & Unit Tests

**Files:**
- Create: `tests/goods-arrival-notice.test.js`
- Create: `assets/js/components/goods-arrival-notice.js`

**Interfaces:**
- Produces:
  - `generateArrivalTitle(dateStr): string`
  - `groupArrivalData(rows): Map<string, Map<string, number>>`
  - `formatAnnouncementContent(groupedData): string`

- [ ] **Step 1: Viết failing unit test cho engine gom nhóm và định dạng**

Tạo file `tests/goods-arrival-notice.test.js`:
```javascript
const assert = require('assert');
const {
  generateArrivalTitle,
  groupArrivalData,
  formatAnnouncementContent
} = require('../assets/js/components/goods-arrival-notice.js');

console.log('--- RUNNING GOODS ARRIVAL NOTICE TESTS ---');

// Test 1: Sinh tiêu đề từ chuỗi ngày (hỗ trợ YYYY-MM-DD và DD/MM/YYYY)
assert.strictEqual(generateArrivalTitle('2026-08-29'), 'Hàng về kho ngày 29/08');
assert.strictEqual(generateArrivalTitle('29/08/2026'), 'Hàng về kho ngày 29/08');
console.log('✅ Test 1 Passed: Title generation');

// Test 2: Gom nhóm theo Tên công trình và Tồn trơn
const mockRows = [
  { 'Tên công trình': 'Dự án Sky Tower', 'Tên vật tư': '0.75X45VN', 'Số lượng (Kg)': '7712' },
  { 'Tên công trình': 'Dự án Sky Tower', 'Tên vật tư': '1.5X348VN', 'Số lượng (Kg)': 26770 },
  { 'Tên công trình': '', 'Tên vật tư': '1.5X50VN', 'Số lượng (Kg)': 8050 },
  { 'Tên công trình': null, 'Tên vật tư': '1.8X50VN', 'Số lượng (Kg)': '2250' }
];

const grouped = groupArrivalData(mockRows);
assert.strictEqual(grouped.has('Dự án Sky Tower'), true);
assert.strictEqual(grouped.has('Tồn trơn'), true);
assert.strictEqual(grouped.get('Dự án Sky Tower').get('0.75X45VN'), 7712);
assert.strictEqual(grouped.get('Tồn trơn').get('1.8X50VN'), 2250);
console.log('✅ Test 2 Passed: Grouping logic');

// Test 3: Định dạng nội dung thông báo chuẩn
const content = formatAnnouncementContent(grouped);
const expected = `[Dự án Sky Tower]
0.75X45VN: 7.712kg
1.5X348VN: 26.770kg

[Tồn trơn]
1.5X50VN: 8.050kg
1.8X50VN: 2.250kg`;

assert.strictEqual(content.trim(), expected.trim());
console.log('✅ Test 3 Passed: Content format matches screenshot style');
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `node tests/goods-arrival-notice.test.js`
Expected: FAIL vì `goods-arrival-notice.js` chưa tồn tại.

- [ ] **Step 3: Viết module `assets/js/components/goods-arrival-notice.js` với các hàm cốt lõi**

Tạo `assets/js/components/goods-arrival-notice.js` hỗ trợ cả Node (CommonJS) và Browser:
```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GoodsArrivalNotice = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  function parseNumeric(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim().replace(/\s+/g, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  }

  function generateArrivalTitle(dateStr) {
    if (!dateStr) return 'Hàng về kho';
    let dd = '', mm = '';
    const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      dd = isoMatch[3];
      mm = isoMatch[2];
    } else {
      const ddmmyyyy = String(dateStr).match(/^(\d{1,2})[\/\-](\d{1,2})/);
      if (ddmmyyyy) {
        dd = String(ddmmyyyy[1]).padStart(2, '0');
        mm = String(ddmmyyyy[2]).padStart(2, '0');
      }
    }
    if (dd && mm) return `Hàng về kho ngày ${dd}/${mm}`;
    return 'Hàng về kho';
  }

  function groupArrivalData(rows) {
    const projectMap = new Map();
    (rows || []).forEach(row => {
      let proj = String(row['Tên công trình'] || '').trim();
      if (!proj) proj = 'Tồn trơn';

      let mat = String(row['Tên vật tư'] || row['Mã vật tư'] || 'Vật tư khác').trim();
      let kg = parseNumeric(row['Số lượng (Kg)']);

      if (!projectMap.has(proj)) {
        projectMap.set(proj, new Map());
      }
      const matMap = projectMap.get(proj);
      matMap.set(mat, (matMap.get(mat) || 0) + kg);
    });
    return projectMap;
  }

  function formatAnnouncementContent(groupedData) {
    if (!groupedData || groupedData.size === 0) return '';
    const sections = [];

    const sortedProjects = Array.from(groupedData.keys()).sort((a, b) => {
      if (a === 'Tồn trơn') return 1;
      if (b === 'Tồn trơn') return -1;
      return a.localeCompare(b, 'vi');
    });

    for (const proj of sortedProjects) {
      const matMap = groupedData.get(proj);
      const lines = [`[${proj}]`];
      for (const [mat, totalKg] of matMap.entries()) {
        const kgStr = totalKg.toLocaleString('vi-VN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3
        });
        lines.push(`${mat}: ${kgStr}kg`);
      }
      sections.push(lines.join('\n'));
    }

    return sections.join('\n\n');
  }

  return {
    generateArrivalTitle,
    groupArrivalData,
    formatAnnouncementContent,
    parseNumeric
  };
}));
```

- [ ] **Step 4: Chạy lại test để xác nhận pass**

Run: `node tests/goods-arrival-notice.test.js`
Expected: PASS toàn bộ 3 test.

- [ ] **Step 5: Commit task 1**

```bash
git add tests/goods-arrival-notice.test.js assets/js/components/goods-arrival-notice.js
git commit -m "feat: implement arrival notice grouping and formatting engine with unit tests"
```

---

### Task 2: Hoàn thiện Giao diện Modal & Tích hợp Supabase trong `goods-arrival-notice.js`

**Files:**
- Modify: `assets/js/components/goods-arrival-notice.js`

**Interfaces:**
- Produces:
  - `GoodsArrivalNotice.open(defaultDate?: string): Promise<void>`
  - `GoodsArrivalNotice.loadDayArrivals(dateStr: string): Promise<Array>`
  - `GoodsArrivalNotice.publishNotice(): Promise<void>`

- [ ] **Step 1: Mở rộng `goods-arrival-notice.js` với Modal HTML Generator & Event Handlers**
  - Tự động tạo phần tử `#modalGoodsArrivalNotice` trong `document.body` nếu chưa có.
  - Thiết kế Modal Bootstrap 5 gồm:
    - Input Date + Nút Nạp lại.
    - Nút Chọn tất cả / Bỏ chọn tất cả + Đếm số lượng/Kg đã chọn.
    - Bảng danh sách hàng nạp từ `xg-nhap` và `tole-nhap` với checkbox từng dòng.
    - Box Live Preview màu nền tối (#1e293b) chuẩn phong cách thẻ thông báo của ứng dụng.
    - Trạng thái kiểm tra xem ngày này đã có thông báo cũ trong `system_announcements` chưa.
  - Hàm `publishNotice`:
    - Gom dữ liệu các dòng được tick chọn.
    - Gọi Supabase `.from('system_announcements')`.
    - Nếu đã có thông báo ngày này: `.update(...)`. Nếu chưa: `.insert(...)`.
    - Hiển thị Toast thông báo thành công và làm mới chuông thông báo nếu có `update-checker.js`.

- [ ] **Step 2: Commit task 2**

```bash
git add assets/js/components/goods-arrival-notice.js
git commit -m "feat: complete GoodsArrivalNotice modal UI and Supabase integration"
```

---

### Task 3: Tích hợp nút bấm và script vào `xg-nhap.html` và `tole-nhap.html`

**Files:**
- Modify: `pages/xg/xg-nhap.html`
- Modify: `pages/tole/tole-nhap.html`

- [ ] **Step 1: Thêm nút vào `pages/xg/xg-nhap.html`**
  - Thêm nút vào Action buttons bar:
    ```html
    <button id="btnGoodsNotice" data-perm="add" class="btn btn-sm btn-info text-white fw-bold shadow-sm" title="Tạo hoặc cập nhật thông báo hàng về kho">
      <i class="bi bi-megaphone-fill me-1"></i> Thông báo hàng về
    </button>
    ```
  - Thêm thẻ `<script src="../../assets/js/components/goods-arrival-notice.js"></script>` trước đóng thẻ body.
  - Gắn sự kiện click `btnGoodsNotice` để gọi `GoodsArrivalNotice.open()`.

- [ ] **Step 2: Thêm nút vào `pages/tole/tole-nhap.html`**
  - Tương tự như trên đối với `pages/tole/tole-nhap.html`.

- [ ] **Step 3: Commit task 3**

```bash
git add pages/xg/xg-nhap.html pages/tole/tole-nhap.html
git commit -m "feat: add GoodsArrivalNotice trigger button to xg-nhap and tole-nhap pages"
```

---

### Task 4: Đồng bộ build, Verification & E2E Testing

**Files:**
- Run: `node scripts/sync-dist.js`

- [ ] **Step 1: Đồng bộ mã nguồn ra `dist/`, `dist-app/`, `public/`**

Run: `node scripts/sync-dist.js`
Expected: Báo `Full synchronization completed successfully!`.

- [ ] **Step 2: Chạy kiểm tra Unit Test**

Run: `node tests/goods-arrival-notice.test.js`
Expected: Toàn bộ pass.

- [ ] **Step 3: Kiểm tra các file html đã sinh đúng trong public/ và dist/**
  - Kiểm tra sự xuất hiện của `btnGoodsNotice` và `goods-arrival-notice.js` trong:
    - `public/pages/xg/xg-nhap.html`
    - `public/pages/tole/tole-nhap.html`
    - `public/assets/js/components/goods-arrival-notice.js`

- [ ] **Step 4: Commit task 4**

```bash
git add .
git commit -m "chore: sync build dist and verify goods arrival notification feature"
```
