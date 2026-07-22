# Kế hoạch triển khai - Tối ưu hiệu năng Phân hệ Xà gồ (XG)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tối ưu hóa hiệu năng tải trang, tính toán Javascript và hiển thị giao diện của tất cả các file xg (gồm bản Supabase và bản Google Sheets).

**Architecture:** Sử dụng Promise.all để song song hóa các API request, lọc trên Database để giảm tải lượng dữ liệu truyền qua mạng, lưu cache `originalIndex` dạng O(1) để tránh quét `indexOf` O(N), và kết chùm DOM rendering bằng DocumentFragment.

**Tech Stack:** HTML, Javascript, Supabase, SheetJS (XLSX).

## Global Constraints
- Bảo toàn 100% giao diện và toàn bộ chức năng hiện có của hệ thống.
- Sử dụng các API thuần và các phương thức tối ưu nguyên bản của JS.
- Mọi thay đổi mã nguồn phải được commit thường xuyên theo từng Task.

---

### Task 1: Tối ưu hóa song song và thu nhỏ dữ liệu (Concurrency & Payload Reduction)

**Files:**
- Modify: [xg-ton-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-ton-supabase.js)
- Modify: [xg-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-bieu-do.js)

**Interfaces:**
- Consumes: Supabase database connection and existing table structures.
- Produces: Parallel queries and reduced payload (fetching only 'Cuộn ID' columns of exports for inventory count).

- [ ] **Step 1: Song song hóa tải dữ liệu và lọc cột trong `xg-ton-supabase.js`**
  Chỉnh sửa hàm `loadSupabaseData` trong [xg-ton-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-ton-supabase.js):
  ```javascript
  async function loadSupabaseData() {
    try {
      document.getElementById('loading').style.display = '';
      document.getElementById('loading').textContent = 'Đang tải dữ liệu...';

      // Định nghĩa hàm helper tải phân trang để dùng song song
      async function fetchTableData(tableName, selectColumns = '*') {
        let allData = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from(tableName)
            .select(selectColumns)
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

      // Tải song song xg-nhap (lấy hết) và xg-xuat (chỉ lấy Cuộn ID để giảm dung lượng)
      const [nhapAll, xuatAll] = await Promise.all([
        fetchTableData('xg-nhap'),
        fetchTableData('xg-xuat', '"Cuộn ID"')
      ]);

      // Xử lý khớp dữ liệu
      const exportedCuonIds = new Set(
        xuatAll
          .map(row => String(row['Cuộn ID'] || '').trim().toLowerCase())
          .filter(cuonId => cuonId !== '')
      );
      ...
  ```

- [ ] **Step 2: Song song hóa truy vấn trong `xg-bieu-do.js`**
  Chỉnh sửa hàm `loadAllData` trong [xg-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-bieu-do.js):
  ```javascript
  async function loadAllData() {
    try {
      document.getElementById('loading').style.display = '';
      document.getElementById('loading').textContent = 'Đang tải dữ liệu từ database...';

      // Tải song song cả 3 bảng
      const [rawNhap, rawXuat, rawTonResult] = await Promise.all([
        fetchAllFromTable(TABLE_NHAP),
        fetchAllFromTable(TABLE_XUAT),
        fetchAllFromTable(TABLE_TON)
      ]);
      let rawTon = rawTonResult;
      ...
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add assets/js/xg/xg-ton-supabase.js assets/js/xg/xg-bieu-do.js
  git commit -m "perf: run Supabase queries in parallel and reduce payload for inventory mapping"
  ```

---

### Task 2: Tối ưu bộ lọc database (Database-level filtering in Selection Modal)

**Files:**
- Modify: [xg-xuat-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat-supabase.js)

**Interfaces:**
- Consumes: Entered Mã vật tư from modal.
- Produces: Query results matching only the selected Mã vật tư.

- [ ] **Step 1: Thêm bộ lọc `ilike` vào truy vấn ở `openInventoryModal`**
  Chỉnh sửa hàm `openInventoryModal` trong [xg-xuat-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat-supabase.js):
  ```javascript
  async function openInventoryModal(target, maVatTu = '') {
    currentModalTarget = target;
    currentMaVatTuFilter = maVatTu;

    const inventoryModal = document.getElementById('inventoryRollsModal');
    if (!inventoryModal) return;

    // Reset selection
    const tbody = document.getElementById('inventoryTableBody');
    if (tbody) tbody.innerHTML = '';

    const loadingDiv = document.getElementById('inventoryLoading');
    if (loadingDiv) { loadingDiv.style.display = ''; loadingDiv.textContent = 'Đang tải dữ liệu tồn...'; }

    const selectedCountEl = document.getElementById('inventorySelectedCount');
    if (selectedCountEl) selectedCountEl.textContent = '0';

    new bootstrap.Modal(inventoryModal).show();

    try {
      let nhapAll = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      // Tải phân trang dữ liệu xg-nhap và lọc ở Database nếu có maVatTu
      while (hasMore) {
        let query = supabase
          .from('xg-nhap')
          .select('*');
        
        if (maVatTu) {
          query = query.ilike('Mã vật tư', `%${maVatTu}%`);
        }
        
        query = query.order('id', { ascending: true })
          .range(from, from + batchSize - 1);

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          nhapAll = nhapAll.concat(data);
          if (data.length < batchSize) {
            hasMore = false;
          } else {
            from += batchSize;
          }
        } else {
          hasMore = false;
        }
      }
      ...
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add assets/js/xg/xg-xuat-supabase.js
  git commit -m "perf: optimize roll selection modal using database-level filtering"
  ```

---

### Task 3: Chỉ mục O(1) và kết chùm DOM rendering phiên bản Supabase

**Files:**
- Modify: [xg-nhap-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-nhap-supabase.js)
- Modify: [xg-xuat-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat-supabase.js)
- Modify: [xg-ton-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-ton-supabase.js)

**Interfaces:**
- Consumes: Loaded database rows.
- Produces: Rendering with DocumentFragment, originalIndex cache setup on load, insert, and update.

- [ ] **Step 1: Cập nhật chỉ mục O(1) và DocumentFragment trong `xg-nhap-supabase.js`**
  - Trong `loadSupabaseData`:
    ```javascript
    // TRƯỚC: tableData = [COLUMN_HEADERS, ...allData.map(rowToArray)];
    // SAU:
    tableData = [COLUMN_HEADERS, ...allData.map((row, idx) => {
      const arr = rowToArray(row);
      arr.originalIndex = idx + 1;
      return arr;
    })];
    ```
  - Trong sự kiện submit form `addDataForm`:
    ```javascript
    // TRƯỚC: tableData.push(rowToArray(row));
    // SAU:
    const arr = rowToArray(row);
    arr.originalIndex = tableData.length;
    tableData.push(arr);
    ```
  - Trong sự kiện submit form `editDataForm`:
    ```javascript
    // TRƯỚC: tableData[selectedRowIndex] = rowToArray(updatedData[0]);
    // SAU:
    const arr = rowToArray(updatedData[0]);
    arr.originalIndex = selectedRowIndex;
    tableData[selectedRowIndex] = arr;
    ```
  - Trong `renderTableData`:
    ```javascript
    // Dùng DocumentFragment làm bộ đệm
    const fragment = document.createDocumentFragment();

    for (let i = 1; i < data.length; i++) {
      // O(1) lookup
      const originalIndex = data[i].originalIndex ?? tableData.indexOf(data[i]);
      const row = document.createElement('tr');
      row.dataset.rowIndex = String(originalIndex);

      const tdCheckbox = document.createElement('td');
      tdCheckbox.innerHTML = `<input type="checkbox" class="row-checkbox" value="${originalIndex}">`;
      row.appendChild(tdCheckbox);

      displayColIndexes.forEach(colIdx => {
        const td = document.createElement('td');
        const cell = data[i][colIdx];
        const header = data[0][colIdx];
        if (header === 'Ngày nhập') {
          td.textContent = formatDate(cell);
        } else {
          td.textContent = formatCellQuantityOrWeight(cell, header);
        }
        row.appendChild(td);
      });

      row.querySelector('.row-checkbox').addEventListener('change', () => updateSelectedRows());
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('row-checkbox')) return;
        document.querySelectorAll('#dataTable tbody tr').forEach(r => r.classList.remove('table-active'));
        row.classList.add('table-active');
        selectedRowIndex = Number(row.dataset.rowIndex);
        document.getElementById('btnEditData').disabled = false;
        document.getElementById('btnDeleteData').disabled = false;
      });

      fragment.appendChild(row); // Thêm vào fragment
    }
    tbody.appendChild(fragment); // Chèn hàng loạt vào DOM
    ```

- [ ] **Step 2: Thực hiện tương tự cho `xg-xuat-supabase.js`**
  Thực hiện cập nhật lưu chỉ mục và dùng DocumentFragment tương ứng cho `loadSupabaseData`, submit form add/edit, và `renderTableData` trong `xg-xuat-supabase.js`.

- [ ] **Step 3: Cập nhật DocumentFragment trong `xg-ton-supabase.js`**
  - Chỉnh sửa `renderTableData`:
    ```javascript
    const fragment = document.createDocumentFragment();
    for (let i = 1; i < data.length; i++) {
      const row = document.createElement('tr');
      data[i].forEach((cell, colIndex) => {
        const td = document.createElement('td');
        if (colIndex === 1) {
          td.textContent = formatDate(cell);
        } else {
          td.textContent = formatCellQuantityOrWeight(cell, data[0][colIndex]);
        }
        row.appendChild(td);
      });
      fragment.appendChild(row);
    }
    tbody.appendChild(fragment);
    ```
  - Chỉnh sửa `renderGroupedTable`:
    ```javascript
    const fragment = document.createDocumentFragment();
    for (const [key, groupRows] of groups) {
      ...
      const tr = document.createElement('tr');
      tr.className = 'group-summary-row';
      ...
      fragment.appendChild(tr);

      for (const row of groupRows) {
        const dtr = document.createElement('tr');
        dtr.className = 'group-detail-row';
        ...
        fragment.appendChild(dtr);
      }
    }
    tbody.appendChild(fragment);
    ```

- [ ] **Step 4: Commit**
  ```bash
  git add assets/js/xg/xg-nhap-supabase.js assets/js/xg/xg-xuat-supabase.js assets/js/xg/xg-ton-supabase.js
  git commit -m "perf: implement O(1) originalIndex cache and DocumentFragment batch rendering"
  ```

---

### Task 4: Chỉ mục O(1) và kết chùm DOM rendering phiên bản Google Sheets cũ

**Files:**
- Modify: [xg-nhap.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-nhap.js)
- Modify: [xg-xuat.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat.js)
- Modify: [xg-ton.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-ton.js)

**Interfaces:**
- Consumes: JSON array parsed from Google Sheet Excel parser.
- Produces: Optimized array mapping and rendering.

- [ ] **Step 1: Cập nhật chỉ mục O(1) và DocumentFragment trong `xg-nhap.js`**
  - Trong `loadGoogleSheet`:
    ```javascript
    // Gán index gốc vào phần tử
    tableData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }).map((row, idx) => {
      row.originalIndex = idx;
      return row;
    });
    ```
  - Chỉnh sửa `renderTableData` để dùng `originalIndex` và `DocumentFragment`.

- [ ] **Step 2: Cập nhật tương tự trong `xg-xuat.js`**
  Cập nhật hàm `loadGoogleSheet` và `renderTableData` trong `xg-xuat.js` tương tự như trên.

- [ ] **Step 3: Cập nhật DocumentFragment trong `xg-ton.js`**
  Chỉnh sửa `renderTableData` và `renderGroupedTable` trong `xg-ton.js` để kết chùm chèn thẻ vào DOM thông qua `DocumentFragment`.

- [ ] **Step 4: Commit**
  ```bash
  git add assets/js/xg/xg-nhap.js assets/js/xg/xg-xuat.js assets/js/xg/xg-ton.js
  git commit -m "perf: apply index caching and fragment rendering to legacy Google Sheet scripts"
  ```
