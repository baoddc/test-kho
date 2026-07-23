# Kế hoạch thực thi: Loại bỏ mục Tổng số cuộn trong tất cả các popup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ hiển thị mục "Tổng số cuộn" trong tất cả các popup của cả 4 phân hệ (XG - Nhập, XG - Xuất, Tole - Nhập, Tole - Xuất).

**Architecture:** Sử dụng CSS `d-none` (Bootstrap 5) trong file HTML để ẩn dòng tổng số cuộn của bảng Danh sách cuộn, và gán `style.display = 'none'` cho thẻ div bọc ngoài (`col`) chứa trường nhập liệu "Tổng số cuộn" trong JavaScript để đảm bảo cấu trúc DOM và tính đúng đắn khi gửi dữ liệu lên Google Sheets.

**Tech Stack:** HTML5, JavaScript (Vanilla), Bootstrap 5

## Global Constraints
- Chỉ thay đổi cách hiển thị (ẩn đi), không xóa phần tử DOM hoặc logic JavaScript tính toán để tránh lỗi runtime hoặc làm lệch thứ tự cột dữ liệu khi submit.

---

### Task 1: Ẩn dòng "Tổng số cuộn" trong các bảng HTML của popup

**Files:**
- Modify: [xg-xuat.html](file:///c:/Users/benhhc/Desktop/web/pages/xg/xg-xuat.html)
- Modify: [xg-nhap.html](file:///c:/Users/benhhc/Desktop/web/pages/xg/xg-nhap.html)
- Modify: [tole-xuat.html](file:///c:/Users/benhhc/Desktop/web/pages/tole/tole-xuat.html)
- Modify: [tole-nhap.html](file:///c:/Users/benhhc/Desktop/web/pages/tole/tole-nhap.html)

**Interfaces:**
- Consumes: Thẻ `<tr>` của phần tổng số cuộn trong bảng `rollsTable` và `editRollsTable`.
- Produces: Ẩn hiển thị của các thẻ `<tr>` này bằng class `d-none`.

- [ ] **Step 1: Sửa file xg-xuat.html**
  Sửa thẻ `<tr>` chứa `totalRollsCount` và `editTotalRollsCount` để thêm class `d-none`.
  
  ```diff
  -                         <tr class="table-info">
  +                         <tr class="table-info d-none">
                              <td colspan="3" class="text-end fw-bold">Tổng số cuộn:</td>
                              <td class="fw-bold" id="totalRollsCount">0</td>
  ```
  ```diff
  -                         <tr class="table-info">
  +                         <tr class="table-info d-none">
                              <td class="text-end fw-bold">Tổng số cuộn:</td>
                              <td class="fw-bold" id="editTotalRollsCount">0</td>
  ```

- [ ] **Step 2: Sửa file xg-nhap.html**
  ```diff
  -                         <tr class="table-info">
  +                         <tr class="table-info d-none">
                              <td class="text-end fw-bold">Tổng số cuộn:</td>
                              <td class="fw-bold" id="totalRollsCount">0</td>
  ```
  ```diff
  -                         <tr class="table-info">
  +                         <tr class="table-info d-none">
                              <td class="text-end fw-bold">Tổng số cuộn:</td>
                              <td class="fw-bold" id="editTotalRollsCount">0</td>
  ```

- [ ] **Step 3: Sửa file tole-xuat.html**
  ```diff
  -                         <tr class="table-info">
  +                         <tr class="table-info d-none">
                              <td colspan="3" class="text-end fw-bold">Tổng số cuộn:</td>
                              <td class="fw-bold" id="totalRollsCount">0</td>
  ```
  ```diff
  -                         <tr class="table-info">
  +                         <tr class="table-info d-none">
                              <td class="text-end fw-bold">Tổng số cuộn:</td>
                              <td class="fw-bold" id="editTotalRollsCount">0</td>
  ```

- [ ] **Step 4: Sửa file tole-nhap.html**
  ```diff
  -                         <tr class="table-info">
  +                         <tr class="table-info d-none">
                              <td class="text-end fw-bold">Tổng số cuộn:</td>
                              <td class="fw-bold" id="totalRollsCount">0</td>
  ```
  ```diff
  -                         <tr class="table-info">
  +                         <tr class="table-info d-none">
                              <td class="text-end fw-bold">Tổng số cuộn:</td>
                              <td class="fw-bold" id="editTotalRollsCount">0</td>
  ```

- [ ] **Step 5: Commit thay đổi HTML**
  ```bash
  git add pages/xg/*.html pages/tole/*.html
  git commit -m "style: hide total rolls row in popups HTML table footer"
  ```

---

### Task 2: Ẩn trường "Số cuộn" (Tổng số cuộn) trong form dynamic của JavaScript

**Files:**
- Modify: [xg-xuat.js](file:///c:/Users/benhhc/Desktop/web/assets/js/xg/xg-xuat.js)
- Modify: [xg-nhap.js](file:///c:/Users/benhhc/Desktop/web/assets/js/xg/xg-nhap.js)
- Modify: [tole-xuat.js](file:///c:/Users/benhhc/Desktop/web/assets/js/tole/tole-xuat.js)
- Modify: [tole-nhap.js](file:///c:/Users/benhhc/Desktop/web/assets/js/tole/tole-nhap.js)

**Interfaces:**
- Consumes: Logic tạo trường input cho cột "Số cuộn" / "số cuộn".
- Produces: Ẩn cột bọc ngoài bằng CSS `col.style.display = 'none';`.

- [ ] **Step 1: Sửa file xg-xuat.js**
  Thêm `col.style.display = 'none';` ở cả hai hàm `openAddDataModal` và `openEditDataModal`.
  
  ```javascript
      // Trong openAddDataModal (dòng ~1325)
      // Số cuộn - readonly
      if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
        col.style.display = 'none';
        label.textContent = 'Tổng số cuộn';
        input = document.createElement('input');
        ...
      }
  ```
  ```javascript
      // Trong openEditDataModal (dòng ~1599)
      if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
        col.style.display = 'none';
        label.textContent = 'Tổng số cuộn';
        input = document.createElement('input');
        ...
      }
  ```

- [ ] **Step 2: Sửa file xg-nhap.js**
  Thêm `col.style.display = 'none';` ở cả hai vị trí tương tự.
  
  ```javascript
      // Trong openAddDataModal (dòng ~1314)
      if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
        col.style.display = 'none';
        label.textContent = 'Tổng số cuộn';
        input = document.createElement('input');
        ...
      }
  ```
  ```javascript
      // Trong openEditDataModal (dòng ~1585)
      if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
        col.style.display = 'none';
        label.textContent = 'Tổng số cuộn';
        input = document.createElement('input');
        ...
      }
  ```

- [ ] **Step 3: Sửa file tole-xuat.js**
  Thêm `col.style.display = 'none';` ở cả hai vị trí tương tự.
  
  ```javascript
      // Trong openAddDataModal (dòng ~1323)
      if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
        col.style.display = 'none';
        label.textContent = 'Tổng số cuộn';
        input = document.createElement('input');
        ...
      }
  ```
  ```javascript
      // Trong openEditDataModal (dòng ~1579)
      if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
        col.style.display = 'none';
        label.textContent = 'Tổng số cuộn';
        input = document.createElement('input');
        ...
      }
  ```

- [ ] **Step 4: Sửa file tole-nhap.js**
  Thêm `col.style.display = 'none';` ở cả hai vị trí tương tự.
  
  ```javascript
      // Trong openAddDataModal (dòng ~1312)
      if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
        col.style.display = 'none';
        label.textContent = 'Tổng số cuộn';
        input = document.createElement('input');
        ...
      }
  ```
  ```javascript
      // Trong openEditDataModal (dòng ~1596)
      if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
        col.style.display = 'none';
        label.textContent = 'Tổng số cuộn';
        input = document.createElement('input');
        ...
      }
  ```

- [ ] **Step 5: Commit thay đổi JS**
  ```bash
  git add assets/js/xg/*.js assets/js/tole/*.js
  git commit -m "feat: hide dynamically generated total rolls field in javascript popups"
  ```

---

## Verification Plan

### Manual Verification
1. Mở trang web ứng dụng và kiểm thử từng phân hệ:
   - **XG Nhập** và **XG Xuất**
   - **Tole Nhập** và **Tole Xuất**
2. Mở modal "Thêm dữ liệu" / "Sửa dữ liệu":
   - Xác minh trường "Tổng số cuộn" không hiển thị trong phần Thông tin bổ sung.
   - Xác minh dòng "Tổng số cuộn: 0" không hiển thị ở chân bảng Danh sách cuộn.
3. Nhập dữ liệu thử nghiệm, thêm cuộn và lưu:
   - Đảm bảo việc thêm/sửa dữ liệu hoạt động bình thường, không gây ra bất cứ lỗi JS runtime nào trong console.
   - Xác minh số lượng cuộn được cập nhật chính xác trên bảng giao diện chính (dataTable) sau khi modal đóng lại.
