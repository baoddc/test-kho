# Loại bỏ mục Cuộn ID ở phần Thông tin bổ sung (XG - Xuất & XG - Nhập) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ ô nhập "Cuộn ID" ở phần "Thông tin bổ sung" trong popup Thêm và Sửa dữ liệu của hai phân hệ Kho Xà gồ - Xuất (xg-xuat) và Kho Xà gồ - Nhập (xg-nhap).

**Architecture:** Sử dụng phương án ẩn phần tử HTML trong giao diện bằng cách thiết lập `col.style.display = 'none'` trên cột chứa input tương ứng. Điều này giúp ẩn hoàn toàn ô nhập khỏi tầm nhìn của người dùng nhưng vẫn giữ nguyên input trong DOM để tránh lỗi thu lệch dữ liệu cột khi gửi biểu mẫu.

**Tech Stack:** HTML5, Vanilla JavaScript, Bootstrap 5.

## Global Constraints

- Không làm thay đổi cấu trúc mảng index của form submit nhằm đảm bảo tương thích 100% với Google Apps Script.
- Ẩn hoàn toàn trường Cuộn ID trong Thông tin bổ sung trên giao diện.

---

### Task 1: Cập nhật XG - Xuất (`xg-xuat.js`)

**Files:**
- Modify: [xg-xuat.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat.js)

**Interfaces:**
- Consumes: None
- Produces: Ẩn cột 'cuộn id' trong `openAddDataModal` và `openEditDataModal` của phân hệ Xuất xà gồ.

- [ ] **Step 1: Cập nhật `openAddDataModal` trong `xg-xuat.js`**

Chỉnh sửa vòng lặp `for` xử lý additional columns để kiểm tra và ẩn cột `cuộn id`.

Tại dòng ~1323, thay thế:
```javascript
    let input;
    // Số cuộn - readonly
    if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
      col.style.display = 'none';
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else {
      label.textContent = headers[i] || `Cột ${i + 1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';

      // Make required if not Note or Roll ID
      const hName = (headers[i] || '').toLowerCase().trim();
      if (!hName.includes('ghi chú') && !hName.includes('cuộn id')) {
        input.required = true;
        label.innerHTML = `${headers[i] || `Cột ${i + 1}`} <span class="text-danger">*</span>`;
      } else {
        label.textContent = headers[i] || `Cột ${i + 1}`;
      }
    }
```
Bằng:
```javascript
    let input;
    const normHeader = normalizeHeaderText(headers[i]);
    // Số cuộn - readonly
    if (normHeader === 'so cuon' || normHeader.includes('so cuon')) {
      col.style.display = 'none';
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else if (normHeader === 'cuon id' || normHeader.includes('cuon id')) {
      col.style.display = 'none';
      label.textContent = headers[i] || 'Cuộn ID';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = '';
    } else {
      label.textContent = headers[i] || `Cột ${i + 1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';

      // Make required if not Note or Roll ID
      const hName = (headers[i] || '').toLowerCase().trim();
      if (!hName.includes('ghi chú') && !hName.includes('cuộn id') && !normHeader.includes('cuon id')) {
        input.required = true;
        label.innerHTML = `${headers[i] || `Cột ${i + 1}`} <span class="text-danger">*</span>`;
      } else {
        label.textContent = headers[i] || `Cột ${i + 1}`;
      }
    }
```

- [ ] **Step 2: Cập nhật `openEditDataModal` trong `xg-xuat.js`**

Tại dòng ~1598, thay thế:
```javascript
    let input;
    if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
      col.style.display = 'none';
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = existingKg ? '1' : '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else {
      label.textContent = headers[i] || `Cột ${i + 1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = rowData[i] ?? '';

      // Make required if not Note or Roll ID
      const hName = (headers[i] || '').toLowerCase().trim();
      if (!hName.includes('ghi chú') && !hName.includes('cuộn id')) {
        input.required = true;
        label.innerHTML = `${headers[i] || `Cột ${i + 1}`} <span class="text-danger">*</span>`;
      } else {
        label.textContent = headers[i] || `Cột ${i + 1}`;
      }
    }
```
Bằng:
```javascript
    let input;
    const normHeader = normalizeHeaderText(headers[i]);
    if (normHeader === 'so cuon' || normHeader.includes('so cuon')) {
      col.style.display = 'none';
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = existingKg ? '1' : '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else if (normHeader === 'cuon id' || normHeader.includes('cuon id')) {
      col.style.display = 'none';
      label.textContent = headers[i] || 'Cuộn ID';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = rowData[i] ?? '';
    } else {
      label.textContent = headers[i] || `Cột ${i + 1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = rowData[i] ?? '';

      // Make required if not Note or Roll ID
      const hName = (headers[i] || '').toLowerCase().trim();
      if (!hName.includes('ghi chú') && !hName.includes('cuộn id') && !normHeader.includes('cuon id')) {
        input.required = true;
        label.innerHTML = `${headers[i] || `Cột ${i + 1}`} <span class="text-danger">*</span>`;
      } else {
        label.textContent = headers[i] || `Cột ${i + 1}`;
      }
    }
```

- [ ] **Step 3: Commit các thay đổi của `xg-xuat.js`**

Run:
```bash
git add assets/js/xg/xg-xuat.js
git commit -m "feat: hide Cuon ID in Additional Info for XG-Xuat Add/Edit modals"
```

---

### Task 2: Cập nhật XG - Nhập (`xg-nhap.js`)

**Files:**
- Modify: [xg-nhap.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-nhap.js)

**Interfaces:**
- Consumes: None
- Produces: Ẩn cột 'cuộn id' trong `openAddDataModal` và `openEditDataModal` của phân hệ Nhập xà gồ.

- [ ] **Step 1: Cập nhật `openAddDataModal` trong `xg-nhap.js`**

Chỉnh sửa vòng lặp `for` xử lý additional columns tại dòng ~1311 để kiểm tra và ẩn cột `cuộn id`.

Thay thế:
```javascript
    let input;
    // Số cuộn - readonly
    if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
      col.style.display = 'none';
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else {
      label.textContent = headers[i] || `Cột ${i + 1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';

      // Make required if not Note or Roll ID
      const hName = (headers[i] || '').toLowerCase().trim();
      if (!hName.includes('ghi chú') && !hName.includes('cuộn id')) {
        input.required = true;
        label.innerHTML = `${headers[i] || `Cột ${i + 1}`} <span class="text-danger">*</span>`;
      } else {
        label.textContent = headers[i] || `Cột ${i + 1}`;
      }
    }
```
Bằng:
```javascript
    let input;
    const normHeader = normalizeHeaderText(headers[i]);
    // Số cuộn - readonly
    if (normHeader === 'so cuon' || normHeader.includes('so cuon')) {
      col.style.display = 'none';
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else if (normHeader === 'cuon id' || normHeader.includes('cuon id')) {
      col.style.display = 'none';
      label.textContent = headers[i] || 'Cuộn ID';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = '';
    } else {
      label.textContent = headers[i] || `Cột ${i + 1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';

      // Make required if not Note or Roll ID
      const hName = (headers[i] || '').toLowerCase().trim();
      if (!hName.includes('ghi chú') && !hName.includes('cuộn id') && !normHeader.includes('cuon id')) {
        input.required = true;
        label.innerHTML = `${headers[i] || `Cột ${i + 1}`} <span class="text-danger">*</span>`;
      } else {
        label.textContent = headers[i] || `Cột ${i + 1}`;
      }
    }
```

- [ ] **Step 2: Cập nhật `openEditDataModal` trong `xg-nhap.js`**

Chỉnh sửa vòng lặp `for` xử lý additional columns tại dòng ~1590.

Thay thế:
```javascript
    let input;
    if (headerName === 'số cuộn' || headerName.includes('số cuộn')) {
      col.style.display = 'none';
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = existingKg ? '1' : '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else {
      label.textContent = headers[i] || `Cột ${i + 1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = rowData[i] ?? '';

      // Make required if not Note or Roll ID
      const hName = (headers[i] || '').toLowerCase().trim();
      if (!hName.includes('ghi chú') && !hName.includes('cuộn id')) {
        input.required = true;
        label.innerHTML = `${headers[i] || `Cột ${i + 1}`} <span class="text-danger">*</span>`;
      } else {
        label.textContent = headers[i] || `Cột ${i + 1}`;
      }
    }
```
Bằng:
```javascript
    let input;
    const normHeader = normalizeHeaderText(headers[i]);
    if (normHeader === 'so cuon' || normHeader.includes('so cuon')) {
      col.style.display = 'none';
      label.textContent = 'Tổng số cuộn';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = existingKg ? '1' : '0';
      input.readOnly = true;
      input.style.backgroundColor = '#e9ecef';
    } else if (normHeader === 'cuon id' || normHeader.includes('cuon id')) {
      col.style.display = 'none';
      label.textContent = headers[i] || 'Cuộn ID';
      input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = rowData[i] ?? '';
    } else {
      label.textContent = headers[i] || `Cột ${i + 1}`;
      input = document.createElement('input');
      input.className = 'form-control form-control-sm fw-bold';
      input.name = `col_${i}`;
      input.type = 'text';
      input.value = rowData[i] ?? '';

      // Make required if not Note or Roll ID
      const hName = (headers[i] || '').toLowerCase().trim();
      if (!hName.includes('ghi chú') && !hName.includes('cuộn id') && !normHeader.includes('cuon id')) {
        input.required = true;
        label.innerHTML = `${headers[i] || `Cột ${i + 1}`} <span class="text-danger">*</span>`;
      } else {
        label.textContent = headers[i] || `Cột ${i + 1}`;
      }
    }
```

- [ ] **Step 3: Commit các thay đổi của `xg-nhap.js`**

Run:
```bash
git add assets/js/xg/xg-nhap.js
git commit -m "feat: hide Cuon ID in Additional Info for XG-Nhap Add/Edit modals"
```
