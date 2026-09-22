# Thiết Kế Tổ Chức Nội Dung & Giao Diện Chuyên Sâu Các Phân Hệ HSE (hse.html)

**Ngày lập:** 2026-09-22  
**Mục tiêu:** Nâng cấp và tổ chức lại giao diện, cấu trúc dữ liệu và tính năng tương tác chuyên sâu cho các phân hệ HSE trong `pages/5s/hse.html`, chuyển đổi từ bảng dữ liệu thô sang các giao diện nghiệp vụ trực quan (Bảng xếp hạng thi đua 5S, Thẻ tra cứu CCDC & mã màu phân loại phế liệu, Thẻ tiến độ công việc và lịch ca trực).

---

## 1. Bối cảnh & Hiện trạng hệ thống
Hệ thống quản lý HSE DDC bao gồm 11 phân hệ, chia thành 4 nhóm nghiệp vụ chính:
* **📋 Kế hoạch & Lịch**: `job-plan`, `clean-schedule`, `equipment-checklist`.
* **📸 Hình ảnh & 5S**: `wh-photos`, `clean-photos`, `5s-race`.
* **🛠️ CCDC & Tiêu chuẩn**: `tools-inventory`, `disposal-standards`, `scrap-categories`, `scrap-regs`.
* **⚡ Khắc phục 5S**: `5s-fix`.

### 1.1. Hiện trạng phân hệ đã hoàn thiện
1. `equipment-checklist` (**Checklist kiểm tra thiết bị**): Đã hoàn thiện chuyên sâu với thanh chọn tháng, 3 thẻ KPI an toàn, Form kiểm tra hàng ngày (chấm Đạt/Không đạt, Đánh dấu tất cả) đồng bộ Google Apps Script, và bảng lịch sử có tính năng sửa.
2. `scrap-regs` (**Quy định phân loại phế liệu**): Đã hoàn thiện danh mục tài liệu thẻ, tích hợp trình đọc PDF Lightbox và upload file PDF lên Drive.
3. `5s-fix` (**Khắc phục 5S**): Đã có bảng hiển thị ảnh Trước/Sau trực tiếp trong từng ô dữ liệu, tích hợp tải và xóa ảnh.

### 1.2. Vấn đề của các phân hệ còn lại
1. `5s-race` (**Thi đua 5S**): Hiện đang bị xử lý nhầm thành gallery ảnh thông thường, làm mất đi bản chất cốt lõi của thi đua 5S: Điểm số, thứ hạng các khu vực, xu hướng tăng/giảm và vinh danh.
2. `tools-inventory` (**CCDC**), `disposal-standards` (**Tiêu chuẩn loại bỏ CCDC**), `scrap-categories` (**Danh mục phế liệu**): Hiển thị dạng bảng phẳng thô sơ (`renderTable`), thiếu thẻ phân loại, mã màu nhận diện thùng rác và thống kê tình trạng.
3. `job-plan` (**Kế hoạch công việc**) & `clean-schedule` (**Lịch vệ sinh**): Mới chỉ gom nhóm theo tháng rồi hiển thị bảng thô, thiếu bộ lọc người phụ trách, cảnh báo hạn định (hôm nay, sắp tới, quá hạn) và phân ca trực.
4. `wh-photos` (**Ảnh mẫu kho**) & `clean-photos` (**Ảnh vệ sinh**): Thiếu bộ lọc theo khu vực kho.

---

## 2. Kiến trúc giải pháp & Thiết kế chi tiết từng cụm nghiệp vụ

### 2.1. Cụm 1: Bảng điểm & Vinh danh Thi đua 5S (`5s-race`)

#### A. Cấu trúc dữ liệu
Từ Google Sheet `Thi đua 5S` (hoặc mock data):
* Cột: `Khu vực`, `Điểm 5S`, `Xếp hạng`, `Xu hướng` (hoặc Ngày/Kỳ đánh giá, Người đánh giá, Ghi chú).
* Dữ liệu ảnh hiện trường chấm điểm 5S.

#### B. Thành phần giao diện (UI Components)
1. **Bộ chọn kỳ đánh giá (Period Selector):** Cho phép chuyển đổi nhanh giữa các tháng/kỳ chấm điểm 5S.
2. **Khu vực Bục Vinh Danh Top 3 (Podium Top 3 Cards):**
   * Thiết kế 3 thẻ nổi bật tương ứng 🥇 Vàng, 🥈 Bạc, 🥉 Đồng với hiệu ứng ánh kim Midnight Neo.
   * Hiển thị: Tên khu vực, Điểm số to bản (VD: `96/100`), Badge danh hiệu (Xuất sắc / Tốt), và mũi tên biến động (`↑ 2 bậc`, `↓ 1 bậc`, `→`).
3. **Bảng Xếp Hạng Toàn Diện (Leaderboard Matrix):**
   * Danh sách toàn bộ các khu vực / phân xưởng.
   * Thanh Progress Bar trực quan phân màu theo ngưỡng điểm:
     * Xanh lá neon: $\ge 90$ điểm (Xuất sắc)
     * Vàng hoàng yến: $75 - 89$ điểm (Đạt chuẩn)
     * Đỏ cảnh báo: $< 75$ điểm (Cần chấn chỉnh)
   * Nút xem ảnh minh chứng vi phạm / đạt chuẩn của từng khu vực.
4. **Bộ Chuyển Đổi Chế Độ Xem (Dual-Tab Switcher):**
   * Tab `[ 🏆 Bảng xếp hạng ]`: Hiển thị bục vinh danh và bảng điểm tổng hợp.
   * Tab `[ 📸 Ảnh hiện trường chấm điểm ]`: Lưới ảnh chụp thực tế trong đợt kiểm tra 5S, tích hợp Lightbox và nút tải ảnh lên Cloudflare R2 / Google Drive.

---

### 2.2. Cụm 2: CCDC & Danh mục Phế liệu (`tools-inventory`, `disposal-standards`, `scrap-categories`)

#### A. Phân hệ `tools-inventory` (Công cụ dụng cụ)
1. **Thanh KPI Tồn kho & An toàn CCDC:**
   * Tổng chủng loại CCDC đang quản lý.
   * Tỷ lệ CCDC đạt chuẩn sẵn sàng sử dụng (%).
   * Số lượng CCDC đang hỏng hóc hoặc cần bảo dưỡng định kỳ.
2. **Bộ Lọc Đa Tiêu Chí:**
   * Lọc theo Nhóm: *Thiết bị nâng hạ / cẩu hàng*, *Dụng cụ cầm tay điện/khí nén*, *Dụng cụ cơ khí*, *Trang bị PPE*.
   * Lọc theo Tình trạng: *Sử dụng tốt*, *Bảo dưỡng*, *Chờ thanh lý*.
3. **Chế Độ Xem Thẻ Trực Quan & Bảng Rút Gọn (Card / Table View Switcher):**
   * Thẻ Card hiển thị: Tên CCDC, Mã định danh, Vị trí lưu kho, Số lượng tồn, Badge trạng thái.

#### B. Phân hệ `disposal-standards` (Tiêu chuẩn loại bỏ CCDC)
1. **Trực quan hóa dạng Sổ Tay Tiêu Chuẩn (Standard Guide Cards):**
   * Thẻ phân theo từng nhóm CCDC (Dây bẹ cẩu, Dây xích cáp, Máy mài cắt, Thang gấp...).
   * **Dấu hiệu cấm sử dụng (Loại bỏ ngay ❌)**: Viền đỏ cảnh báo, liệt kê các hư hỏng chí mạng (nứt, rách, biến dạng, hở điện).
   * **Dấu hiệu cảnh báo cần kiểm tra (⚠️)**: Viền vàng, cần đánh giá lại trước khi tiếp tục dùng.
   * **Quy trình thanh lý**: Hướng dẫn thủ tục thu hồi và bàn giao phế liệu.

#### C. Phân hệ `scrap-categories` (Danh mục phân loại phế liệu)
1. **Bảng Phân Loại Mã Màu Nhận Diện Chuẩn HSE (Color-Coded Scrap Matrix):**
   * 🟡 **Kim loại / Phế liệu sản xuất** (Thép mẩu, bavia thừa, đầu que hàn, phôi tiện) - Màu Vàng.
   * 🔵 **Tái chế thông thường** (Thùng carton, pallet gỗ gãy, bao bì nilong, chai nhựa) - Màu Xanh.
   * 🔴 **Chất thải nguy hại** (Giẻ lau dính dầu mỡ, vỏ thùng sơn, dầu thải, pin/ắc quy) - Màu Đỏ cảnh báo.
   * ⚫ **Rác sinh hoạt / Khác** - Màu Xám/Đen.
2. **Liên Kết Nhanh:**
   * Nút `[ 📄 Xem Quy định gốc PDF ]` mở trực tiếp tài liệu quy định phế liệu trong Lightbox Viewer.

---

### 2.3. Cụm 3: Kế hoạch công việc & Lịch vệ sinh (`job-plan`, `clean-schedule`, `wh-photos`, `clean-photos`)

#### A. Phân hệ `job-plan` (Kế hoạch công việc)
1. **Bộ Chỉ Số Tiến Độ Tháng (Progress KPI Cards):**
   * Tổng số đầu việc trong tháng.
   * Tỷ lệ hoàn thành nhiệm vụ (%).
   * Số lượng công việc bị **Quá hạn** (Màu đỏ nổi bật).
2. **Thanh Lọc Đa Tiêu Chí:**
   * Lọc theo Trạng thái: *Tất cả*, *Đang thực hiện*, *Hoàn thành*, *Quá hạn*.
   * Lọc theo Người phụ trách: Dropdown tự động trích xuất danh sách nhân sự từ sheet.
3. **Cảnh Báo Hạn Định Trực Quan (Smart Deadline Badges):**
   * `⚠️ Trễ X ngày` (Quá hạn - Đỏ viền neon).
   * `⏳ Hạn: Ngày mai / Hôm nay` (Sắp đến hạn - Cam cảnh báo).
   * `✓ Hoàn thành` (Xanh lá).

#### B. Phân hệ `clean-schedule` (Lịch vệ sinh)
1. **Khối Tiêu Điểm "Ca Trực Hôm Nay" (Today's Duty Spotlight):**
   * Hiển thị ngay đầu trang: Thứ trong tuần, Khu vực cần vệ sinh, Nhân sự chịu trách nhiệm.
2. **Bảng Phân Ca Trực & Nút Liên Kết:**
   * Phân công theo tuần trong tháng.
   * Nút bấm `[ 📸 Xem ảnh vệ sinh ]` liên kết ngay sang `clean-photos` để đối chiếu kết quả làm sạch.

#### C. Phân hệ `wh-photos` & `clean-photos`
1. **Bộ lọc theo Vị trí / Khu vực:**
   * Nút lọc nhanh: *Tất cả*, *Kho Thành phẩm*, *Kho Nguyên liệu*, *Khu vực CCDC*, *Lối thoát hiểm*.

---

## 3. Kiến trúc kỹ thuật & Luồng dữ liệu

### 3.1. Phân tách Hàm Render trong `hse.js`
Tách các phương thức render chuyên biệt thay vì dùng chung `renderTable`:
* `renderRaceLeaderboard(data)`: Xử lý dữ liệu thi đua, podium, bảng điểm và tab ảnh.
* `renderToolsInventory(data)`: Xử lý CCDC, tính toán KPI tồn kho, chế độ xem thẻ/bảng.
* `renderDisposalStandards(data)`: Xử lý sổ tay tiêu chuẩn loại bỏ dạng cards.
* `renderScrapCategories(data)`: Xử lý ma trận phế liệu mã màu và liên kết PDF.
* `renderJobPlanWorkspace(data)`: Xử lý kế hoạch công việc, lọc trạng thái, cảnh báo deadline.
* `renderCleanScheduleWorkspace(data)`: Xử lý lịch vệ sinh, ca trực hôm nay.

### 3.2. Tính Linh Hoạt & Fallback An Toàn (Defensive Fallback)
* Trích xuất header bằng từ khóa linh hoạt (`indexOf`, `includes`), không phụ thuộc vị trí cột cố định.
* Nếu dữ liệu sheet trả về không khớp cấu trúc nhận diện, hệ thống tự động fallback về bảng hiển thị thông thường (`renderTable`), ngăn ngừa lỗi crash giao diện.

---

## 4. Kế hoạch xác thực (Verification Plan)
1. **Kiểm tra hiển thị từng phân hệ trong Workspace View**: Mở lần lượt từng phân hệ từ màn hình Hub, xác nhận giao diện render đúng thiết kế mới.
2. **Kiểm tra tính năng tương tác**:
   * Chuyển tab Điểm số và Ảnh hiện trường trong Thi đua 5S.
   * Chuyển chế độ xem Thẻ / Bảng trong Công cụ dụng cụ.
   * Lọc theo Trạng thái / Người phụ trách trong Kế hoạch công việc.
   * Mở xem quy định PDF từ Danh mục phế liệu.
3. **Kiểm tra Responsive & Đa nền tảng**: Đảm bảo hiển thị hoàn hảo trên màn hình lớn (Desktop) và di động (Mobile).
4. **Kiểm tra Console JavaScript**: Không có bất kỳ cảnh báo lỗi cú pháp hoặc runtime error nào.
