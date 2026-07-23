# Định dạng cột ngày tháng hiển thị thành dd/mm/yyyy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng bộ toàn bộ các cột định dạng ngày tháng hiển thị trên hệ thống (Xà gồ, Tole, Phế liệu, Trợ lý ảo) thành định dạng `dd/mm/yyyy` (ví dụ: `18/07/2026`).

**Architecture:** Sửa đổi giá trị trả về của các hàm tiện ích định dạng ngày (`formatDate`, `formatDateDisplay`) trong các file JS giao diện/nghiệp vụ. Với bản Supabase đổi từ `yyyy/mm/dd` thành `dd/mm/yyyy`. Với bản offline và phế liệu đổi từ `dd/mm/yy` thành `dd/mm/yyyy` bằng cách hiển thị đủ 4 chữ số của năm thay vì rút gọn 2 chữ số cuối.

**Tech Stack:** Thuần HTML, CSS, JavaScript (Vanilla).

## Global Constraints
- Không được thay đổi dữ liệu gốc được lưu trữ trong database (Supabase) hay các file Excel.
- Chỉ thay đổi định dạng hiển thị bên ngoài cho người dùng.
- Giữ nguyên prefix sinh số phiếu tự động theo định dạng YYMM-XX (không sửa đổi).

---

### Task 1: Supabase JS Files (Xà gồ & Tole)

**Files:**
- Modify: `assets/js/xg/xg-xuat-supabase.js`
- Modify: `assets/js/xg/xg-ton-supabase.js`
- Modify: `assets/js/xg/xg-nhap-supabase.js`
- Modify: `assets/js/tole/tole-xuat-supabase.js`
- Modify: `assets/js/tole/tole-ton-supabase.js`
- Modify: `assets/js/tole/tole-nhap-supabase.js`

- [ ] **Step 1: Cập nhật hàm formatDate trong assets/js/xg/xg-xuat-supabase.js**
  - Sửa dòng trả về thành `${day}/${month}/${year}`.
- [ ] **Step 2: Cập nhật hàm formatDate trong assets/js/xg/xg-ton-supabase.js**
  - Sửa dòng trả về thành `${day}/${month}/${year}`.
- [ ] **Step 3: Cập nhật hàm formatDate trong assets/js/xg/xg-nhap-supabase.js**
  - Sửa dòng trả về thành `${day}/${month}/${year}`.
- [ ] **Step 4: Cập nhật hàm formatDate trong assets/js/tole/tole-xuat-supabase.js**
  - Sửa dòng trả về thành `${day}/${month}/${year}`.
- [ ] **Step 5: Cập nhật hàm formatDate trong assets/js/tole/tole-ton-supabase.js**
  - Sửa dòng trả về thành `${day}/${month}/${year}`.
- [ ] **Step 6: Cập nhật hàm formatDate trong assets/js/tole/tole-nhap-supabase.js**
  - Sửa dòng trả về thành `${day}/${month}/${year}`.
- [ ] **Step 7: Commit các thay đổi Supabase**
  - Commit: "feat(date-format): format Supabase date columns to dd/mm/yyyy"

---

### Task 2: Offline/Local JS Files (Xà gồ & Tole)

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`
- Modify: `assets/js/xg/xg-ton.js`
- Modify: `assets/js/xg/xg-nhap.js`
- Modify: `assets/js/tole/tole-xuat.js`
- Modify: `assets/js/tole/tole-ton.js`
- Modify: `assets/js/tole/tole-nhap.js`

- [ ] **Step 1: Cập nhật hàm formatDate trong assets/js/xg/xg-xuat.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 2: Cập nhật hàm formatDate trong assets/js/xg/xg-ton.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 3: Cập nhật hàm formatDate trong assets/js/xg/xg-nhap.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 4: Cập nhật hàm formatDate trong assets/js/tole/tole-xuat.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 5: Cập nhật hàm formatDate trong assets/js/tole/tole-ton.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 6: Cập nhật hàm formatDate trong assets/js/tole/tole-nhap.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 7: Commit các thay đổi offline**
  - Commit: "feat(date-format): format offline date columns to dd/mm/yyyy"

---

### Task 3: Phế liệu (PL) & Trợ lý ảo (Voice Assistant)

**Files:**
- Modify: `assets/js/pl/pl-can-thu.js`
- Modify: `assets/js/pl/pl-da-thu.js`
- Modify: `assets/js/pl/pl-chua-thu.js`
- Modify: `assets/js/pl/pl-tong-hop-can-thu.js`
- Modify: `assets/js/pl/pl-tong-hop-da-thu.js`
- Modify: `assets/js/pl/pl-tong-hop-chua-thu.js`
- Modify: `assets/js/pl/pl-phieu-in.js`
- Modify: `assets/js/voice-assistant.js`

- [ ] **Step 1: Cập nhật assets/js/pl/pl-can-thu.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 2: Cập nhật assets/js/pl/pl-da-thu.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 3: Cập nhật assets/js/pl/pl-chua-thu.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 4: Cập nhật assets/js/pl/pl-tong-hop-can-thu.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 5: Cập nhật assets/js/pl/pl-tong-hop-da-thu.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 6: Cập nhật assets/js/pl/pl-tong-hop-chua-thu.js**
  - Thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 7: Cập nhật assets/js/pl/pl-phieu-in.js**
  - Trong hàm `formatDate`, thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
  - Trong hàm `formatDateDisplay`, thay đổi `const year = String(dateObj.getFullYear()).slice(-2);` thành `const year = dateObj.getFullYear();`.
- [ ] **Step 8: Cập nhật assets/js/voice-assistant.js**
  - Trong hàm `formatDate`, thay đổi `const year = String(date.getFullYear()).slice(-2);` thành `const year = date.getFullYear();`.
- [ ] **Step 9: Commit các thay đổi còn lại**
  - Commit: "feat(date-format): format PL and voice assistant date columns to dd/mm/yyyy"

---

## Verification Plan

### Manual Verification
- Mở trang [tole-ton.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-ton.html) hoặc [xg-ton.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/xg/xg-ton.html) trên trình duyệt, verify hiển thị cột "Ngày nhập" dạng `dd/mm/yyyy`.
- Mở trang [pl-can-thu.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/pl/pl-can-thu.html), verify cột "Ngày" hiển thị dạng `dd/mm/yyyy`.
- Mở thử hộp thoại bộ lọc, chọn lọc theo ngày để xác định chức năng lọc ngày vẫn hoạt động chính xác.
