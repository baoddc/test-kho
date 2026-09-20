# Sơ Đồ Phôi Cuộn 5S Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết kế lại toàn diện trang Sơ đồ kho phôi cuộn (`pages/5s/5s-so-do-phoi-cuon.html` và các file liên quan), chuyển đổi từ Google Sheet CSV sang dữ liệu thời gian thực từ Supabase (`xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`), tích hợp bộ lọc kho Xà gồ / Tole, tìm kiếm highlight, modal chi tiết kệ và xuất Excel.

**Architecture:** Nạp dữ liệu tức thì 0ms qua LocalStorage cache (`xg-ton` & `tole-ton`), đồng thời fetch nền song song qua `fetchAllFromSupabase`. Dữ liệu được tính toán tồn thực tế (Nhập trừ Xuất theo Cuộn ID), chuẩn hóa mã vị trí (`A01-A14`, `B01-B14`, `GRATING`), render sơ đồ 2D tương tác hiện đại với Tailwind + Bootstrap Modal + Lucide Icons + SheetJS.

**Tech Stack:** HTML5, CSS3 / Tailwind / Bootstrap 5.3.3, Vanilla JavaScript (ES6+), Supabase JS Client v2, SheetJS (XLSX), Lucide Icons.

## Global Constraints

- Không làm gián đoạn các trang hiện hữu (`xg-ton.html`, `tole-ton.html`, `vi-tri-ton.html`).
- Sử dụng đúng cấu hình Supabase từ `/assets/js/core/supabase-config.js`.
- Không sử dụng thêm thư viện ngoài chưa có trong dự án ngoại trừ CDN đã được phê duyệt (Bootstrap 5, SheetJS, Lucide, Supabase).
- Hỗ trợ đầy đủ thiết bị di động, máy tính bảng và màn hình lớn.

---

### Task 1: Thiết kế lại cấu trúc HTML trong `pages/5s/5s-so-do-phoi-cuon.html`

**Files:**
- Modify: `pages/5s/5s-so-do-phoi-cuon.html`
- Test: Kiểm tra cấu trúc DOM và import scripts

**Interfaces:**
- Consumes: `/assets/js/core/supabase-config.js`, `/assets/js/core/inventory-lock-service.js`, `/assets/js/core/qr-scanner-service.js`, `/assets/js/components/sidebar.js`, `/assets/js/trang-chu/home.js`
- Produces: Khung DOM đầy đủ chứa `#quickKpiBanner`, `#warehouseFilterTabs`, `#searchInput`, `#mapWrapper`, `#shelfDetailModal`

- [ ] **Step 1: Cập nhật `pages/5s/5s-so-do-phoi-cuon.html`**
  Thêm Bootstrap 5 CSS, Icons, SheetJS, Supabase SDK và cấu trúc Modal chi tiết kệ cùng khung sơ đồ responsive.
- [ ] **Step 2: Kiểm tra liên kết thư viện và file scripts**
  Đảm bảo không có lỗi 404 về file CSS/JS.
- [ ] **Step 3: Commit Task 1**
  `git add pages/5s/5s-so-do-phoi-cuon.html && git commit -m "feat(5s): update html structure and dependencies for coil map"`

---

### Task 2: Nâng cấp CSS & Hiệu ứng trong `assets/css/5s/5s-so-do-phoi-cuon.css`

**Files:**
- Modify: `assets/css/5s/5s-so-do-phoi-cuon.css`

**Interfaces:**
- Produces: CSS classes cho trạng thái kệ (trống, có hàng, quá tải), hiệu ứng tìm kiếm `.shelf-container.highlighted`, `.shelf-container.dimmed`, animation marching-ants & shimmer, modal table styles.

- [ ] **Step 1: Cập nhật CSS với design token đồng bộ**
  Bổ sung animation pulse, styling cho badge đếm cuộn, custom scrollbar và layout bảng modal.
- [ ] **Step 2: Commit Task 2**
  `git add assets/css/5s/5s-so-do-phoi-cuon.css && git commit -m "style(5s): enhance shelf animations, badges and modal styling"`

---

### Task 3: Viết lại toàn bộ Logic trong `assets/js/5s/5s-so-do-phoi-cuon.js`

**Files:**
- Modify: `assets/js/5s/5s-so-do-phoi-cuon.js`

**Interfaces:**
- Consumes: `supabase` từ `supabase-config.js`, `fetchAllFromSupabase`, `getStoredTableCache`, `setStoredTableCache`, `XLSX` từ SheetJS.
- Produces: Module sơ đồ phôi cuộn với bộ lọc kho, nạp dữ liệu tồn từ Supabase, hiển thị KPI, tìm kiếm, modal chi tiết và xuất Excel.

- [ ] **Step 1: Viết module quản lý dữ liệu tồn kho**
  - Hàm chuẩn hóa vị trí `normalizeRackId(pos)`.
  - Hàm nạp dữ liệu: 0ms cache từ `xg-ton` + `tole-ton`, sau đó gọi song song `fetchAllFromSupabase` cho 4 bảng (`xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`).
  - Phân loại cuộn theo kệ `A01`..`A14`, `B01`..`B14`, `GRATING`, và `UNASSIGNED`.
- [ ] **Step 2: Viết logic render giao diện & tương tác**
  - Render Quick KPI Cards (Tổng cuộn, Khối lượng Kg/Tấn, phân bổ XG vs Tole, số kệ có hàng).
  - Render Bộ lọc kho (`all` / `xg` / `tole`).
  - Render Sơ đồ 2D (Dãy B, Lối đi giữa, Dãy A, Grating, Đường xe).
  - Render Hover preview tooltip.
- [ ] **Step 3: Viết logic Tìm kiếm & Highlight**
  - Lọc cuộn theo Mã VT, Tên VT, Batch, Cuộn ID.
  - Highlight các kệ khớp tìm kiếm kèm badge số lượng cuộn.
- [ ] **Step 4: Viết logic Modal chi tiết kệ & Xuất Excel**
  - Khi click kệ: Mở Modal hiển thị toàn bộ cuộn với bảng chi tiết, có ô tìm kiếm trong kệ.
  - Nút xuất file Excel (.xlsx) theo chuẩn SheetJS cho danh sách cuộn của kệ.
  - Nút chuyển hướng sang `/pages/tem-nhan-kiem-ke/vi-tri-ton.html?vitri=...`.
- [ ] **Step 5: Kiểm tra cú pháp JS với `node -c`**
  Run: `node -c assets/js/5s/5s-so-do-phoi-cuon.js`
- [ ] **Step 6: Commit Task 3**
  `git add assets/js/5s/5s-so-do-phoi-cuon.js && git commit -m "feat(5s): rewrite coil map logic with supabase data, filters, modal and excel export"`

---

### Task 4: Đồng bộ bản sao tệp và Kiểm thử tổng thể (Verification)

**Files:**
- Copy / Sync: Đồng bộ các file sang `public/`, `dist/` nếu cần.
- Test: Kiểm tra hiển thị và vận hành đầy đủ trên trình duyệt.

- [ ] **Step 1: Đồng bộ các file cập nhật sang thư mục public**
- [ ] **Step 2: Mở trình duyệt kiểm tra thực tế sơ đồ phôi cuộn**
  - Kiểm tra tải dữ liệu từ Supabase thành công.
  - Kiểm tra đổi bộ lọc [Tất cả] / [Kho Xà gồ] / [Kho Tole].
  - Kiểm tra tìm kiếm và highlight kệ.
  - Kiểm tra click mở modal chi tiết kệ và xuất Excel.
- [ ] **Step 3: Commit Task 4**
  `git add . && git commit -m "chore(5s): sync dist/public and verify coil map redesign"`
