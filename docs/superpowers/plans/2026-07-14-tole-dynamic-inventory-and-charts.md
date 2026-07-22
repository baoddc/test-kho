# Sửa đổi Logic Tồn kho và Biểu đồ Phân hệ Tole Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi logic hiển thị tồn kho và vẽ biểu đồ phân hệ Tole sang tính toán động 100% từ bảng `tole-nhap` và `tole-xuat`, đồng bộ hóa các trường dữ liệu và tên file xuất excel.

**Architecture:** Thực hiện tính toán động ở phía client (đối chiếu các Cuộn ID đã nhập nhưng chưa xuất). Thực hiện ánh xạ đúng cấu trúc cột giữa bảng giao dịch và bảng tồn kho để không bị rỗng số liệu.

**Tech Stack:** HTML5, Vanilla JS, Supabase Client JS v2, Chart.js.

## Global Constraints
- Không dùng placeholder (TODO/TBD).
- Ánh xạ đúng tên cột 'Khối lượng (kg)' và 'Khối lượng (m)' đối với Tồn tole.
- Sửa tên file xuất Excel cho phân hệ Tole.

---

### Task 1: Cập nhật file tole-ton-supabase.js

**Files:**
- Modify: [tole-ton-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-ton-supabase.js)

**Interfaces:**
- Consumes: Bảng `tole-nhap` và `tole-xuat` từ Supabase.
- Produces: Mảng dữ liệu tồn kho động được ánh xạ khớp các cột của Tồn Tole.

- [ ] **Step 1: Thay thế logic fetch dữ liệu giao dịch xà gồ bằng giao dịch tole**
  Thay thế hàm `loadSupabaseData` để fetch dữ liệu từ `tole-nhap` và `tole-xuat` thay vì `xg-nhap` và `xg-xuat`. Đồng thời ánh xạ trường `'Khối lượng (kg)'` lấy từ `'Số lượng (Kg)'` và `'Khối lượng (m)'` lấy từ `'Số lượng (m)'`.

  Đoạn code cần thay thế (khoảng dòng 240-275):
  ```javascript
    const [nhapAll, xuatAll] = await Promise.all([
      fetchTableData('tole-nhap'),
      fetchTableData('tole-xuat', '"Cuộn ID"')
    ]);

    // 3. Xử lý khớp dữ liệu
    const exportedCuonIds = new Set(
      xuatAll
        .map(row => String(row['Cuộn ID'] || '').trim().toLowerCase())
        .filter(cuonId => cuonId !== '')
    );

    // Lọc các cuộn trong tole-nhap mà chưa bị xuất và PHẢI CÓ Cuộn ID
    const tonData = nhapAll.filter(row => {
      const cuonId = String(row['Cuộn ID'] || '').trim().toLowerCase();
      if (!cuonId) return false;
      return !exportedCuonIds.has(cuonId);
    });

    // Định dạng dữ liệu đầu ra theo cấu trúc tole-ton
    const processedTon = tonData.map(row => {
      return {
        id: row.id,
        'Ngày nhập': row['Ngày nhập'] || '',
        'Thời gian lưu kho': calculateStorageAge(row['Ngày nhập']),
        'Vị trí': row['Vị trí'] || '',
        'Mã vật tư': row['Mã vật tư'] || '',
        'Tên vật tư': row['Tên vật tư'] || '',
        'Batch': row['Batch'] || '',
        'Cuộn ID': row['Cuộn ID'] || '',
        'Khối lượng (kg)': row['Số lượng (Kg)'] || 0,
        'Mã công trình': row['Mã công trình'] || '',
        'Tên công trình': row['Tên công trình'] || '',
        'Khối lượng (m)': row['Số lượng (m)'] || 0,
        'Ghi chú': row['Ghi chú'] || ''
      };
    });
  ```

- [ ] **Step 2: Sửa tên file xuất Excel**
  Sửa tên file xuất Excel tải về ở cuối file từ `"tole_du_lieu_ton.xlsx"`.
  Kiểm tra dòng `XLSX.writeFile(wb, "tole_du_lieu_ton.xlsx");` ở khoảng dòng 693.

- [ ] **Step 3: Dọn dẹp comment xà gồ ở đầu file**
  Sửa comment mô tả ở dòng 1-7 thành:
  ```javascript
  /* =============================================================================
     TOLE-TON - SUPABASE VERSION
     Quản lý dữ liệu tồn tole từ Supabase
     Tên bảng: tole-ton (được tính toán động từ tole-nhap và tole-xuat)
  ================================================================================ */
  ```

---

### Task 2: Cập nhật file tole-bieu-do.js

**Files:**
- Modify: [tole-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-bieu-do.js)

**Interfaces:**
- Consumes: Bảng `tole-nhap` và `tole-xuat` từ Supabase.
- Produces: Dữ liệu tồn kho động phục vụ vẽ biểu đồ và tính KPIs.

- [ ] **Step 1: Thay thế hàm loadAllData() tải dữ liệu động**
  Thay thế hàm `loadAllData()` để tải dữ liệu từ `tole-nhap` và `tole-xuat`, sau đó tự động tính toán tồn kho động bằng thuật toán lọc `Cuộn ID` và gán khóa `'Khối lượng (kg)'` và `'Khối lượng (m)'`.

  Đoạn code cần thay thế (khoảng dòng 283-309):
  ```javascript
  async function loadAllData() {
    try {
      document.getElementById('loading').style.display = '';
      document.getElementById('loading').textContent = 'Đang tải dữ liệu từ database...';

      const [rawNhap, rawXuat] = await Promise.all([
        fetchAllFromTable(TABLE_NHAP),
        fetchAllFromTable(TABLE_XUAT)
      ]);

      // Tính toán tồn kho động dựa trên Cuộn ID chưa xuất
      const exportedCuonIds = new Set(
        rawXuat
          .map(row => String(row['Cuộn ID'] || '').trim().toLowerCase())
          .filter(cuonId => cuonId !== '')
      );
      
      const rawTon = rawNhap
        .filter(row => {
          const cuonId = String(row['Cuộn ID'] || '').trim().toLowerCase();
          if (!cuonId) return false;
          return !exportedCuonIds.has(cuonId);
        })
        .map(row => ({
          id: row.id,
          'Ngày nhập': row['Ngày nhập'] || '',
          'Thời gian lưu kho': 0, // Tính sau
          'Vị trí': row['Vị trí'] || '',
          'Mã vật tư': row['Mã vật tư'] || '',
          'Tên vật tư': row['Tên vật tư'] || '',
          'Batch': row['Batch'] || '',
          'Cuộn ID': row['Cuộn ID'] || '',
          'Khối lượng (kg)': row['Số lượng (Kg)'] || 0,
          'Mã công trình': row['Mã công trình'] || '',
          'Tên công trình': row['Tên công trình'] || '',
          'Khối lượng (m)': row['Số lượng (m)'] || 0,
          'Ghi chú': row['Ghi chú'] || ''
        }));

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

---

### Task 3: Sửa các file liên quan tole-nhap-supabase.js và tole-xuat-supabase.js

**Files:**
- Modify: [tole-nhap-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-nhap-supabase.js)
- Modify: [tole-xuat-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-xuat-supabase.js)

- [ ] **Step 1: Sửa tên file xuất Excel & Comment trong tole-nhap-supabase.js**
  - Sửa comment đầu file (dòng 1-8) thành `TOLE-NHAP - SUPABASE VERSION` và `Quản lý dữ liệu nhập tole từ Supabase`.
  - Sửa dòng `XLSX.writeFile(wb, 'xg_du_lieu_nhap.xlsx');` (khoảng dòng 773) thành `XLSX.writeFile(wb, 'tole_du_lieu_nhap.xlsx');`.

- [ ] **Step 2: Sửa tên file xuất Excel & Comment trong tole-xuat-supabase.js**
  - Sửa comment đầu file (dòng 1-8) thành `TOLE-XUAT - SUPABASE VERSION` và `Quản lý dữ liệu xuất tole từ Supabase`.
  - Sửa dòng `XLSX.writeFile(wb, 'xg_du_lieu_xuat.xlsx');` (khoảng dòng 699) thành `XLSX.writeFile(wb, 'tole_du_lieu_xuat.xlsx');`.
