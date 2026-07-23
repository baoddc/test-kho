# Tole Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn bộ hệ thống quản lý Tole (`tole-nhap`, `tole-xuat`, `tole-ton`, `tole-bieu-do`) từ Google Sheets sang kết nối trực tiếp với Supabase.

**Architecture:** Sử dụng trực tiếp Supabase client trong trình duyệt qua CDN. Các file Javascript tương tác động với Supabase qua API, tính toán tồn kho động cho trang xuất bằng cách so khớp danh sách nhập và xuất, đồng thời chuyển đổi biểu đồ tole sang nạp dữ liệu trực tiếp từ Supabase.

**Tech Stack:** Supabase JS Client (v2 CDN), Bootstrap 5.3.3, SheetJS (xlsx), Chart.js (được dùng trong bieu-do).

## Global Constraints
* URL Supabase và Anon key được lấy trực tiếp từ `assets/js/supabase-config.js` thông qua biến toàn cục `window.supabase`.
* Toàn bộ tên cột trong bảng Supabase phải khớp chính xác tuyệt đối với hình ảnh thiết kế được người dùng cung cấp.
* Các file JS mới phải được đặt tên là `tole-nhap-supabase.js`, `tole-xuat-supabase.js`, `tole-ton-supabase.js`.
* Trang Biểu đồ sẽ cập nhật trực tiếp trong file `tole-bieu-do.js` để đọc từ Supabase.
* Sau mỗi tác vụ, tiến hành commit code với git message tương ứng.

---

### Task 1: Thiết lập Database SQL và cập nhật trang Nhập Tole
**Files:**
* Modify: [tole-nhap.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-nhap.html)
* Create: [tole-nhap-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-nhap-supabase.js)

**Interfaces:**
* Consumes: Bảng `tole-nhap` trong cơ sở dữ liệu Supabase.
* Produces: Giao diện nhập liệu tole-nhap liên kết Supabase, hỗ trợ thêm, sửa, xóa cuộn kèm thông tin số Kg và số Mét.

- [ ] **Step 1: Cập nhật file tole-nhap.html**
  Sửa đường dẫn file js từ `/assets/js/tole/tole-nhap.js` sang `/assets/js/tole/tole-nhap-supabase.js` và chèn script CDN Supabase + file config trước đó.
  *Tìm và sửa block Script cuối file:*
  ```html
  <!-- Supabase JS CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>

  <!-- SheetJS (xlsx) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

  <!-- Custom JavaScript -->
  <script src="/assets/js/sidebar.js"></script>
  <script src="/assets/js/home.js"></script>

  <!-- Supabase config -->
  <script src="/assets/js/supabase-config.js"></script>

  <!-- Supabase version of tole-nhap -->
  <script src="/assets/js/tole/tole-nhap-supabase.js"></script>
  ```

- [ ] **Step 2: Viết mã nguồn cho tole-nhap-supabase.js**
  Tạo file `assets/js/tole/tole-nhap-supabase.js` bằng cách sao chép cấu trúc `xg-nhap-supabase.js` và chỉnh sửa:
  * Tên bảng: `const TABLE_NAME = 'tole-nhap';`
  * Khai báo COLUMN_HEADERS khớp cấu trúc ảnh:
    ```javascript
    const COLUMN_HEADERS = [
      'id', 'Mã chứng từ', 'Ngày nhập', 'Phiếu nhập', 'Loại nhập',
      'Mã vật tư', 'Tên vật tư', 'Batch', 'Cuộn ID', 'Số lượng (Kg)',
      'Số lượng (m)', 'Vị trí', 'Mã công trình', 'Tên công trình', 'Ghi chú'
    ];
    ```
  * Cập nhật chỉ số cột tương ứng trong các logic form:
    * ` Ngày nhập` (index 2)
    * `Phiếu nhập` (index 3)
    * `Loại nhập` (index 4)
    * `Mã vật tư` (index 5)
    * `Tên vật tư` (index 6)
    * `Batch` (index 7)
    * `Cuộn ID` (index 8)
    * `Số lượng (Kg)` (index 9)
    * `Số lượng (m)` (index 10)
    * `Vị trí` (index 11)
    * `Mã công trình` (index 12)
    * `Tên công trình` (index 13)
    * `Ghi chú` (index 14)
  * Thay đổi logic thêm/sửa dòng để hỗ trợ xử lý cả cột Số lượng (m) lấy từ danh sách cuộn trong modal.

- [ ] **Step 3: Commit code**
  Run: `git add pages/tole/tole-nhap.html assets/js/tole/tole-nhap-supabase.js`
  Run: `git commit -m "feat: migrate tole-nhap to Supabase database"`

---

### Task 2: Cập nhật trang Xuất Tole và tính tồn kho động
**Files:**
* Modify: [tole-xuat.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-xuat.html)
* Create: [tole-xuat-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-xuat-supabase.js)

**Interfaces:**
* Consumes: Bảng `tole-nhap` và `tole-xuat` từ Supabase.
* Produces: Giao diện xuất tole, tính tồn kho động từ chênh lệch phiếu Nhập và phiếu Xuất để cho phép người dùng chọn cuộn tồn thực tế khi xuất.

- [ ] **Step 1: Cập nhật file tole-xuat.html**
  Sửa đường dẫn file js từ `/assets/js/tole/tole-xuat.js` sang `/assets/js/tole/tole-xuat-supabase.js` và chèn script CDN Supabase + file config trước đó.
  *Tìm và sửa block Script cuối file:*
  ```html
  <!-- Supabase JS CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>

  <!-- SheetJS (xlsx) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

  <!-- Custom JavaScript -->
  <script src="/assets/js/sidebar.js"></script>
  <script src="/assets/js/home.js"></script>

  <!-- Supabase config -->
  <script src="/assets/js/supabase-config.js"></script>

  <!-- Supabase version of tole-xuat -->
  <script src="/assets/js/tole/tole-xuat-supabase.js"></script>
  ```

- [ ] **Step 2: Viết mã nguồn cho tole-xuat-supabase.js**
  Tạo file `assets/js/tole/tole-xuat-supabase.js` dựa trên cấu trúc `xg-xuat-supabase.js`:
  * Tên bảng: `const TABLE_NAME = 'tole-xuat';`
  * Bảng tồn kho động: `const NHAP_TABLE_NAME = 'tole-nhap';`
  * Định nghĩa COLUMN_HEADERS:
    ```javascript
    const COLUMN_HEADERS = [
      'id', 'Mã chứng từ', 'Ngày nhập', 'Phiếu nhập', 'Loại nhập',
      'Mã vật tư', 'Tên vật tư', 'Batch', 'Cuộn ID', 'Số lượng (Kg)',
      'Số lượng (m)', 'Mã công trình', 'Tên công trình', 'Ghi chú'
    ];
    ```
  * Chỉnh sửa logic `openInventoryModal` để lấy toàn bộ danh sách cuộn nhập từ `tole-nhap` và danh sách cuộn đã xuất từ `tole-xuat` (trong `_rawSupabaseData`), lọc ra các cuộn nhập chưa bị xuất dựa vào `Cuộn ID`, hiển thị kèm cả khối lượng Kg và Mét quy đổi.
  * Logic thêm cuộn từ bảng tồn kho vào form xuất: mapping đúng các cột `Số lượng (Kg)` và `Số lượng (m)`.

- [ ] **Step 3: Commit code**
  Run: `git add pages/tole/tole-xuat.html assets/js/tole/tole-xuat-supabase.js`
  Run: `git commit -m "feat: migrate tole-xuat to Supabase with dynamic stock validation"`

---

### Task 3: Cập nhật trang Tồn Kho Tole
**Files:**
* Modify: [tole-ton.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-ton.html)
* Create: [tole-ton-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-ton-supabase.js)

**Interfaces:**
* Consumes: Bảng `tole-ton` từ Supabase.
* Produces: Giao diện hiển thị tồn kho tĩnh, hỗ trợ chức năng gom nhóm theo mã vật tư (groupByMode).

- [ ] **Step 1: Cập nhật file tole-ton.html**
  Sửa đường dẫn file js từ `/assets/js/tole/tole-ton.js` sang `/assets/js/tole/tole-ton-supabase.js` và chèn script CDN Supabase + file config trước đó.
  *Tìm và sửa block Script cuối file:*
  ```html
  <!-- Supabase JS CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>

  <!-- SheetJS (xlsx) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

  <!-- Custom JavaScript -->
  <script src="/assets/js/sidebar.js"></script>
  <script src="/assets/js/home.js"></script>

  <!-- Supabase config -->
  <script src="/assets/js/supabase-config.js"></script>

  <!-- Supabase version of tole-ton -->
  <script src="/assets/js/tole/tole-ton-supabase.js"></script>
  ```

- [ ] **Step 2: Viết mã nguồn cho tole-ton-supabase.js**
  Tạo file `assets/js/tole/tole-ton-supabase.js` dựa trên cấu trúc `xg-ton-supabase.js`:
  * Tên bảng: `const TABLE_NAME = 'tole-ton';`
  * Định nghĩa COLUMN_HEADERS:
    ```javascript
    const COLUMN_HEADERS = [
      'id', 'Ngày nhập', 'Thời gian lưu kho', 'Vị trí', 'Mã vật tư', 'Tên vật tư',
      'Batch', 'Cuộn ID', 'Khối lượng (kg)', 'Mã công trình', 'Tên công trình',
      'Khối lượng (m)', 'Ghi chú'
    ];
    ```
  * Cập nhật logic group-by và hiển thị tổng số m (mét) và kg tồn kho tương thích.

- [ ] **Step 3: Commit code**
  Run: `git add pages/tole/tole-ton.html assets/js/tole/tole-ton-supabase.js`
  Run: `git commit -m "feat: migrate tole-ton to Supabase with group-by aggregation"`

---

### Task 4: Cập nhật trang Biểu đồ Tole (tole-bieu-do)
**Files:**
* Modify: [tole-bieu-do.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-bieu-do.html)
* Modify: [tole-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-bieu-do.js)

**Interfaces:**
* Consumes: Bảng `tole-nhap`, `tole-xuat`, `tole-ton` từ Supabase.
* Produces: Giao diện biểu đồ tole đồng bộ dữ liệu tức thời từ database.

- [ ] **Step 1: Cập nhật file tole-bieu-do.html**
  Thêm script CDN Supabase và config tương tự như các file trên.
  *Tìm và sửa block Script cuối file:*
  ```html
  <!-- Supabase JS CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>

  <!-- SheetJS (xlsx) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

  <!-- Custom JavaScript -->
  <script src="/assets/js/sidebar.js"></script>
  <script src="/assets/js/home.js"></script>

  <!-- Supabase config -->
  <script src="/assets/js/supabase-config.js"></script>

  <!-- Chart JS -->
  <script src="/assets/js/tole/tole-bieu-do.js"></script>
  ```

- [ ] **Step 2: Cập nhật file tole-bieu-do.js**
  Thay thế hàm `loadAllData()` cũ để truy vấn dữ liệu trực tiếp từ 3 bảng Supabase.
  *Khai báo biến hằng bảng:*
  ```javascript
  const TABLE_NHAP = 'tole-nhap';
  const TABLE_XUAT = 'tole-xuat';
  const TABLE_TON = 'tole-ton';

  const COLUMN_HEADERS_NHAP = [
    'id', 'Mã chứng từ', 'Ngày nhập', 'Phiếu nhập', 'Loại nhập',
    'Mã vật tư', 'Tên vật tư', 'Batch', 'Cuộn ID', 'Số lượng (Kg)',
    'Số lượng (m)', 'Vị trí', 'Mã công trình', 'Tên công trình', 'Ghi chú'
  ];

  const COLUMN_HEADERS_XUAT = [
    'id', 'Mã chứng từ', 'Ngày nhập', 'Phiếu nhập', 'Loại nhập',
    'Mã vật tư', 'Tên vật tư', 'Batch', 'Cuộn ID', 'Số lượng (Kg)',
    'Số lượng (m)', 'Mã công trình', 'Tên công trình', 'Ghi chú'
  ];

  const COLUMN_HEADERS_TON = [
    'id', 'Ngày nhập', 'Thời gian lưu kho', 'Vị trí', 'Mã vật tư', 'Tên vật tư',
    'Batch', 'Cuộn ID', 'Khối lượng (kg)', 'Mã công trình', 'Tên công trình',
    'Khối lượng (m)', 'Ghi chú'
  ];
  ```
  *Bổ sung hàm helper `fetchAllFromTable`:*
  ```javascript
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
  *Viết lại hàm `loadAllData()` để chuyển dữ liệu object từ Supabase sang mảng 2 chiều truyền vào Chart logic:*
  ```javascript
  async function loadAllData() {
    try {
      document.getElementById('loading').style.display = '';
      document.getElementById('loading').textContent = 'Đang tải dữ liệu từ database...';

      const rawNhap = await fetchAllFromTable(TABLE_NHAP);
      const rawXuat = await fetchAllFromTable(TABLE_XUAT);
      const rawTon = await fetchAllFromTable(TABLE_TON);

      const rowToArray = (obj, headers) => headers.map(col => obj[col] ?? '');

      importData = [COLUMN_HEADERS_NHAP, ...rawNhap.map(r => rowToArray(r, COLUMN_HEADERS_NHAP))];
      exportData = [COLUMN_HEADERS_XUAT, ...rawXuat.map(r => rowToArray(r, COLUMN_HEADERS_XUAT))];
      tonData = [COLUMN_HEADERS_TON, ...rawTon.map(r => rowToArray(r, COLUMN_HEADERS_TON))];

      importRollsData = importData;
      exportRollsData = exportData;

      processDataAndCreateCharts();
      document.getElementById('loading').style.display = 'none';

    } catch (error) {
      document.getElementById('loading').innerHTML =
        `Lỗi kết nối database: ${error.message}<br>Kiểm tra kết nối hoặc cấu hình Supabase.`;
      console.error(error);
    }
  }
  ```

- [ ] **Step 3: Commit code**
  Run: `git add pages/tole/tole-bieu-do.html assets/js/tole/tole-bieu-do.js`
  Run: `git commit -m "feat: migrate tole-bieu-do charts to Supabase"`

---

### Task 5: Kiểm tra và hoàn tất tích hợp
**Files:**
* Modify: [task.md](file:///C:/Users/benhhc/.gemini/antigravity-ide/brain/641bcb82-211b-43f4-a88c-82d8df446e07/task.md)

- [ ] **Step 1: Kiểm thử toàn bộ hệ thống**
  Chạy ứng dụng, mở các trang `Nhập`, `Xuất`, `Tồn` và `Biểu đồ` của Tole để kiểm tra xem dữ liệu có tải mượt mà không, các cuộn có thêm/sửa/xóa bình thường trên database và biểu đồ vẽ đúng không.
- [ ] **Step 2: Tạo file walkthrough.md**
  Mô tả lại các bước di chuyển hoàn tất và đính kèm danh sách file thay đổi.
