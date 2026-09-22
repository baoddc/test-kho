# Kế Hoạch Triển Khai Tổ Chức Nội Dung & Giao Diện Các Phân Hệ HSE

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp và chuyển đổi giao diện, cấu trúc dữ liệu của các phân hệ HSE (`5s-race`, `tools-inventory`, `disposal-standards`, `scrap-categories`, `job-plan`, `clean-schedule`) từ bảng thô sang các giao diện nghiệp vụ trực quan chuyên nghiệp.

**Architecture:** Sử dụng kiến trúc renderer chuyên biệt theo từng phân hệ trong `hse.js`, kết hợp hệ thống component Midnight Neo (Podium Cards, KPI Summary Cards, Smart Badges, Color-coded Scrap Matrix) trong `hse.css`, có cơ chế tự động nhận diện header và fallback an toàn.

**Tech Stack:** Vanilla JavaScript (ES6+ Classes), Vanilla CSS (CSS Variables, Flexbox/Grid, Glassmorphism, Responsive), Google Sheets CSV & Cloudflare R2 / Drive integration.

## Global Constraints
- Không làm thay đổi hoặc phá vỡ cấu trúc Google Sheets ID / GID hiện có trong `HSE_MODULES`.
- Sử dụng cơ chế tìm kiếm header theo từ khóa thay vì hardcode index cố định.
- Tự động fallback về `renderTable(data)` nếu cấu trúc dữ liệu không phù hợp, không bao giờ để xảy ra crash JS.
- Đồng bộ mã nguồn giữa `public/` và `pages/` (hoặc `dist-app/` nếu có).

---

### Task 1: Cụm Điểm Số & Vinh Danh Thi Đua 5S (`5s-race`)

**Files:**
- Modify: `public/assets/css/5s/hse.css`
- Modify: `public/assets/js/5s/hse.js`

**Interfaces:**
- Produces: `renderRaceLeaderboard(data)`
- Consumes: `GSheetsService.fetchSheetData`, `renderGallery`, `openImageLightbox`

- [ ] **Step 1: Viết CSS cho Bục vinh danh Podium, thanh Progress Bar và Bảng xếp hạng 5S**
Thêm CSS classes:
`.race-podium-grid`, `.race-podium-card`, `.podium-rank-1`, `.podium-rank-2`, `.podium-rank-3`, `.race-tab-switch`, `.race-score-bar`, `.race-trend-badge`.

- [ ] **Step 2: Viết hàm `renderRaceLeaderboard(data)` trong `DashboardManager`**
- Trích xuất các dòng và header: Khu vực, Điểm 5S, Xếp hạng, Xu hướng.
- Sắp xếp thứ hạng theo Điểm số giảm dần.
- Render bục Top 3: Hạng 1 (Cúp Vàng 🥇), Hạng 2 (Bạc 🥈), Hạng 3 (Đồng 🥉).
- Render Bảng Leaderboard đầy đủ với Progress Bar màu sắc.
- Tích hợp 2 tab: `[ 🏆 Bảng xếp hạng ]` và `[ 📸 Ảnh hiện trường chấm điểm ]`.

- [ ] **Step 3: Cập nhật `renderModalContent` để gọi `renderRaceLeaderboard`**
Chuyển `if (moduleId === '5s-race')` sang gọi `renderRaceLeaderboard(data)`.

- [ ] **Step 4: Kiểm tra cú pháp JavaScript**
Run: `node -c public/assets/js/5s/hse.js`
Expected: Không có lỗi cú pháp.

- [ ] **Step 5: Commit Task 1**
```bash
git add public/assets/css/5s/hse.css public/assets/js/5s/hse.js
git commit -m "feat(hse): implement 5s-race leaderboard and podium view"
```

---

### Task 2: Cụm CCDC & Tiêu Chuẩn Loại Bỏ (`tools-inventory`, `disposal-standards`)

**Files:**
- Modify: `public/assets/css/5s/hse.css`
- Modify: `public/assets/js/5s/hse.js`

**Interfaces:**
- Produces: `renderToolsInventory(data)`, `renderDisposalStandards(data)`
- Consumes: `GSheetsService.fetchSheetData`

- [ ] **Step 1: Viết CSS cho Thẻ CCDC, Sổ tay tiêu chuẩn và nút View Switcher**
Thêm CSS classes:
`.tools-kpi-grid`, `.tools-card-grid`, `.tool-item-card`, `.view-mode-toggle`, `.disposal-standard-card`, `.danger-criterion-box`, `.warning-criterion-box`.

- [ ] **Step 2: Viết hàm `renderToolsInventory(data)` trong `DashboardManager`**
- Tính toán KPI: Tổng số chủng loại, % Đạt an toàn, Cần bảo dưỡng / Hỏng.
- Bộ lọc theo Nhóm thiết bị và Tình trạng.
- Chuyển đổi giữa Chế độ xem Thẻ trực quan (Card View) và Bảng rút gọn (Table View).

- [ ] **Step 3: Viết hàm `renderDisposalStandards(data)` trong `DashboardManager`**
- Hiển thị sổ tay tiêu chuẩn dạng Card.
- Phân tách rõ ràng Dấu hiệu loại bỏ ngay lập tức (Viền đỏ) vs Dấu hiệu cần kiểm định lại (Viền vàng).

- [ ] **Step 4: Cập nhật `renderModalContent` định tuyến 2 phân hệ**
Định tuyến `tools-inventory` và `disposal-standards` tới 2 hàm mới.

- [ ] **Step 5: Kiểm tra cú pháp và commit Task 2**
Run: `node -c public/assets/js/5s/hse.js`
```bash
git add public/assets/css/5s/hse.css public/assets/js/5s/hse.js
git commit -m "feat(hse): implement tools inventory cards and disposal standards guide"
```

---

### Task 3: Cụm Danh Mục Phế Liệu Mã Màu (`scrap-categories`)

**Files:**
- Modify: `public/assets/css/5s/hse.css`
- Modify: `public/assets/js/5s/hse.js`

**Interfaces:**
- Produces: `renderScrapCategories(data)`
- Consumes: `openPdfLightbox`

- [ ] **Step 1: Viết CSS cho Ma trận phế liệu mã màu và thẻ nhóm**
Thêm CSS classes:
`.scrap-matrix-grid`, `.scrap-group-card`, `.scrap-color-yellow`, `.scrap-color-blue`, `.scrap-color-red`, `.scrap-color-gray`.

- [ ] **Step 2: Viết hàm `renderScrapCategories(data)` trong `DashboardManager`**
- Gom nhóm phế liệu theo 4 nhóm màu chuẩn HSE DDC: Kim loại (Vàng), Tái chế (Xanh), Nguy hại (Đỏ), Sinh hoạt (Xám).
- Hiển thị danh mục mã phế liệu và hướng dẫn thu gom.
- Nút bấm liên kết `[ 📄 Xem Quy định gốc PDF ]` kích hoạt `openPdfLightbox`.

- [ ] **Step 3: Cập nhật `renderModalContent` định tuyến `scrap-categories`**
- [ ] **Step 4: Kiểm tra cú pháp và commit Task 3**
Run: `node -c public/assets/js/5s/hse.js`
```bash
git add public/assets/css/5s/hse.css public/assets/js/5s/hse.js
git commit -m "feat(hse): implement color-coded scrap categories matrix"
```

---

### Task 4: Cụm Kế Hoạch Công Việc & Lịch Vệ Sinh (`job-plan`, `clean-schedule`)

**Files:**
- Modify: `public/assets/css/5s/hse.css`
- Modify: `public/assets/js/5s/hse.js`

**Interfaces:**
- Produces: `renderJobPlanWorkspace(data)`, `renderCleanScheduleWorkspace(data)`
- Consumes: `openWorkspace`

- [ ] **Step 1: Viết CSS cho Thẻ tiến độ công việc, Smart Deadline Badge và Ca trực hôm nay**
Thêm CSS classes:
`.plan-progress-grid`, `.deadline-badge-overdue`, `.deadline-badge-soon`, `.deadline-badge-done`, `.duty-spotlight-card`.

- [ ] **Step 2: Viết hàm `renderJobPlanWorkspace(data)` trong `DashboardManager`**
- Tính toán KPI tháng: Tổng việc, % Hoàn thành, Số việc quá hạn.
- Bộ lọc đa tiêu chí: Lọc theo Trạng thái (Đang làm, Xong, Trễ hạn) và Người phụ trách.
- Tính toán số ngày trễ hạn hoặc thời gian còn lại trực tiếp từ cột Hạn định.

- [ ] **Step 3: Viết hàm `renderCleanScheduleWorkspace(data)` trong `DashboardManager`**
- Khối "Tiêu điểm ca trực hôm nay": Tự động hiển thị ca trực theo ngày trong tuần hiện tại.
- Bảng lịch phân công theo tuần / tháng.
- Nút liên kết `[ 📸 Xem ảnh vệ sinh ]` mở ngay phân hệ `clean-photos`.

- [ ] **Step 4: Cập nhật `renderModalContent` định tuyến 2 phân hệ**
- [ ] **Step 5: Kiểm tra cú pháp và commit Task 4**
Run: `node -c public/assets/js/5s/hse.js`
```bash
git add public/assets/css/5s/hse.css public/assets/js/5s/hse.js
git commit -m "feat(hse): implement job plan progress filters and clean schedule duty board"
```

---

### Task 5: Đồng Bộ Tệp, Tối Ưu Gallery & Kiểm Thử Toàn Diện

**Files:**
- Modify: `public/assets/js/5s/hse.js`
- Modify: `dist-app/assets/js/5s/hse.js` (đồng bộ nếu có)
- Modify: `dist-app/assets/css/5s/hse.css` (đồng bộ nếu có)

- [ ] **Step 1: Bổ sung bộ lọc vị trí kho cho `wh-photos` và `clean-photos`**
Thêm các nút filter vị trí: *Tất cả*, *Kho Thành phẩm*, *Kho Nguyên liệu*, *Khu vực CCDC*, *Lối đi an toàn*.

- [ ] **Step 2: Đồng bộ mã nguồn sang thư mục phân phối `dist/` và `dist-app/`**
- [ ] **Step 3: Kiểm tra toàn bộ luồng trên trình duyệt**
Kiểm tra mở từng mục trong 11 phân hệ:
- Mở `5s-race`: Xác nhận có bục Top 3 và chuyển tab ảnh.
- Mở `tools-inventory`: Xác nhận KPI và chuyển đổi thẻ/bảng.
- Mở `disposal-standards`: Xác nhận thẻ tiêu chuẩn viền đỏ/vàng.
- Mở `scrap-categories`: Xác nhận 4 khối mã màu và mở PDF lightbox.
- Mở `job-plan`: Xác nhận KPI và lọc người phụ trách.
- Mở `clean-schedule`: Xác nhận ca trực hôm nay.
- [ ] **Step 4: Commit Task 5**
```bash
git add .
git commit -m "feat(hse): complete content organization and UI upgrade for all HSE modules"
```
