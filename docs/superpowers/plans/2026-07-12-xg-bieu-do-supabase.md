# Xg-bieu-do-supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi cơ chế tải dữ liệu của trang Biểu đồ xà gồ sang Supabase database, giữ nguyên cấu trúc biểu đồ, giao diện và logic tính toán hiện tại.

**Architecture:** Bổ sung Supabase SDK vào file HTML. Thay thế logic nạp Google Sheets trong JavaScript bằng các truy vấn kết nối Supabase và chuyển đổi dữ liệu dạng Object nhận được từ database sang mảng hai chiều (2D array) khớp với cấu trúc cột cũ để đảm bảo các biểu đồ hoạt động ổn định.

**Tech Stack:** Vanilla JS, Supabase Client JS, Chart.js

## Global Constraints
- Phải giữ nguyên cấu trúc HTML và các thẻ canvas vẽ biểu đồ.
- Không thay đổi logic xử lý tính toán trong `processDataAndCreateCharts()`, `calculateRollMetrics()`, `calculateInventoryBegin()`.
- Sử dụng cấu hình URL và Anon key của Supabase từ file `/assets/js/supabase-config.js` đã có sẵn.

---

### Task 1: Cấu hình HTML tích hợp Supabase

**Files:**
- Modify: `pages/xg/xg-bieu-do.html`

- [ ] **Step 1: Bổ sung Supabase JS CDN và config script vào HTML**

Thêm các script kết nối Supabase vào trước thẻ script của `xg-bieu-do.js` trong file [xg-bieu-do.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/xg/xg-bieu-do.html).

Tìm dòng:
```html
  <script src="/assets/js/home.js"></script>
  <script src="/assets/js/xg/xg-bieu-do.js"></script>
```

Và thay thế thành:
```html
  <script src="/assets/js/home.js"></script>

  <!-- Supabase JS CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>

  <!-- Supabase config (URL + anon key) -->
  <script src="/assets/js/supabase-config.js"></script>

  <script src="/assets/js/xg/xg-bieu-do.js"></script>
```

- [ ] **Step 2: Xác minh thay đổi**
Mở file `pages/xg/xg-bieu-do.html` trong trình duyệt hoặc kiểm tra mã nguồn để đảm bảo các thẻ script được tải theo đúng thứ tự.

- [ ] **Step 3: Commit**
```bash
git add pages/xg/xg-bieu-do.html
git commit -m "feat(xg-bieu-do): add supabase libraries to html"
```

---

### Task 2: Chuyển đổi JavaScript kết nối Supabase

**Files:**
- Modify: `assets/js/xg/xg-bieu-do.js`

- [ ] **Step 1: Định nghĩa cấu trúc cột Supabase và hàm helper**

Thay thế phần khai báo SHEET_ID và các hằng số Google Sheet ở đầu file [xg-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-bieu-do.js) bằng khai báo tên bảng và danh sách cột Supabase.

Tìm dòng 11 đến 23:
```javascript
// Thay bằng ID Google Sheet của bạn
const SHEET_ID = '1KqP0KIZmKzgKvZcCJRsTVO4lhScOGRa1OzQgE893eUU';

// GID cho các sheet
const SHEET_GID_NHAP = '0';          // Sheet Nhập
const SHEET_GID_XUAT = '1888497588'; // Sheet Xuất
const SHEET_GID_TON = '1968603689';  // Sheet Tồn

// URL để tải file .xlsx
const XLSX_URL_NHAP = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID_NHAP}`;
const XLSX_URL_XUAT = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID_XUAT}`;
const XLSX_URL_TON = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${SHEET_GID_TON}`;
```

Thay thế bằng:
```javascript
// Cấu hình bảng Supabase
const TABLE_NHAP = 'xg-nhap';
const TABLE_XUAT = 'xg-xuat';
const TABLE_TON = 'xg-ton';

// Cấu trúc cột database khớp với xg-nhap-supabase.js và xg-xuat-supabase.js
const COLUMN_HEADERS_NHAP = [
  'id',
  'Mã chứng từ',
  'Ngày nhập',
  'Phiếu nhập',
  'Loại nhập',
  'Mã vật tư',
  'Tên vật tư',
  'Batch',
  'Cuộn ID',
  'Số lượng (Kg)',
  'Vị trí',
  'Mã công trình',
  'Tên công trình',
  'Ghi chú'
];

const COLUMN_HEADERS_XUAT = [
  'id',
  'Mã chứng từ',
  'Ngày nhập',
  'Phiếu nhập',
  'Loại nhập',
  'Mã vật tư',
  'Tên vật tư',
  'Batch',
  'Cuộn ID',
  'Số lượng (Kg)',
  'Mã công trình',
  'Tên công trình',
  'Ghi chú'
];

const COLUMN_HEADERS_TON = [
  'id',
  'Ngày nhập',
  'Thời gian lưu kho',
  'Vị trí',
  'Mã vật tư',
  'Tên vật tư',
  'Batch',
  'Cuộn ID',
  'Số lượng (Kg)',
  'Mã công trình',
  'Tên công trình',
  'Ghi chú'
];

// Hàm helper đọc toàn bộ dữ liệu từ 1 bảng Supabase
async function fetchAllFromTable(tableName) {
  let allData = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + batchSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < batchSize) {
        hasMore = false;
      } else {
        from += batchSize;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
}
```

- [ ] **Step 2: Thay thế hàm `loadAllData()` cũ bằng luồng tải dữ liệu từ Supabase**

Tìm hàm `loadAllData()` cũ trong [xg-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-bieu-do.js) (khoảng dòng 232 đến 284) và thay thế bằng logic mới.

Thay thế phần code từ `async function loadAllData() {` đến hết hàm bằng:
```javascript
async function loadAllData() {
  try {
    document.getElementById('loading').style.display = '';
    document.getElementById('loading').textContent = 'Đang tải dữ liệu từ database...';

    // 1. Tải toàn bộ dữ liệu từ 3 bảng trong Supabase
    const rawNhap = await fetchAllFromTable(TABLE_NHAP);
    const rawXuat = await fetchAllFromTable(TABLE_XUAT);
    const rawTon = await fetchAllFromTable(TABLE_TON);

    // 2. Chuyển đổi dữ liệu Object thành dạng mảng 2 chiều (2D array) với dòng đầu là header
    const rowToArray = (obj, headers) => headers.map(col => obj[col] ?? '');

    importData = [COLUMN_HEADERS_NHAP, ...rawNhap.map(r => rowToArray(r, COLUMN_HEADERS_NHAP))];
    exportData = [COLUMN_HEADERS_XUAT, ...rawXuat.map(r => rowToArray(r, COLUMN_HEADERS_XUAT))];
    tonData = [COLUMN_HEADERS_TON, ...rawTon.map(r => rowToArray(r, COLUMN_HEADERS_TON))];

    // 3. Vì mỗi dòng trong Supabase đại diện cho 1 cuộn nên ta gán trực tiếp làm dữ liệu cuộn
    importRollsData = importData;
    exportRollsData = exportData;

    // 4. Xử lý dữ liệu và tạo biểu đồ
    processDataAndCreateCharts();

    // 5. Ẩn loading
    document.getElementById('loading').style.display = 'none';

  } catch (error) {
    document.getElementById('loading').innerHTML =
      `Lỗi kết nối database: ${error.message}<br>Kiểm tra kết nối hoặc cấu hình Supabase.`;
    console.error(error);
  }
}
```

- [ ] **Step 3: Xác minh thay đổi bằng cách chạy thử trang trong browser**
Mở trang `pages/xg/xg-bieu-do.html` trong trình duyệt. Kiểm tra tab Console của Developer Tools xem có lỗi JS nào xuất hiện không.
Kiểm tra xem các biểu đồ và KPIs (Đầu kì, Tổng nhập, Tổng xuất, Vòng quay tồn kho, Số ngày tồn trung bình) có hiển thị đúng dữ liệu từ database không.

- [ ] **Step 4: Commit**
```bash
git add assets/js/xg/xg-bieu-do.js
git commit -m "feat(xg-bieu-do): implement supabase fetch and data mapper"
```
