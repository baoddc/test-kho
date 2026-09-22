# Thiết Kế Form & Giao Diện Checklist Kiểm Tra Thiết Bị Theo Tháng Trong Năm (HSE)

**Ngày lập:** 2026-09-22  
**Mục tiêu:** Thiết kế lại phân hệ "Checklist kiểm tra thiết bị" trong `pages/5s/hse.html` thành không gian kiểm tra thiết bị chuyên nghiệp theo tháng, tích hợp Form đánh giá kiểm tra hàng ngày (Daily Check Form) tiện lợi và đồng bộ dữ liệu trực tiếp với Google Sheets qua Apps Script.

---

## 1. Bối cảnh & Vấn đề hiện tại
- Phân hệ `equipment-checklist` ("Checklist kiểm tra thiết bị", GID: `20754979`) hiện đang hiển thị dưới dạng bảng phẳng (flat table) thô sơ.
- Toàn bộ dữ liệu các tháng bị đổ dồn vào một danh sách dài, chưa có bộ lọc phân tách theo từng Tháng / Năm.
- Các giá trị kiểm tra chỉ hiển thị ký tự thô (`O` hoặc để trống), thiếu tính trực quan của báo cáo an toàn HSE.
- Thiếu Form nhập/chấm nhanh kiểm tra định kỳ hàng ngày cho công nhân và nhân viên an toàn tại hiện trường.

---

## 2. Kiến trúc giải pháp (Architecture & Workflow)

### 2.1. Cấu trúc dữ liệu thiết bị
Từ Google Sheet `Checklist kiểm tra thiết bị`, cấu trúc gồm:
- Cột 0: `Ngày` (định dạng `DD/MM/YYYY`)
- Cột 1: `Người kiểm tra` (họ tên nhân sự thực hiện)
- Cột 2..N: Tên các thiết bị cần kiểm tra an toàn (hiện tại: `Dây bẹ 4m`, `Dây bẹ 6m`, `Dây xích cẩu 3m`, và tự động mở rộng nếu thêm cột thiết bị mới).
- Giá trị trạng thái cho mỗi thiết bị:
  - `O`: Đạt chuẩn an toàn (Pass - Màu xanh lá)
  - `X`: Không đạt / Có hư hỏng cần xử lý (Fail - Màu đỏ cảnh báo)
  - Để trống / `-`: Nghỉ / Không sử dụng (Màu xám)

### 2.2. Giao diện người dùng (UI Components)

#### A. Thanh điều hướng chọn Tháng & Thống kê KPI tháng
- **Bộ chọn tháng dạng Tab / Pill Slider**:
  - Tự động quét toàn bộ dữ liệu để trích xuất các tháng có dữ liệu (`Tháng 03/2026`, `Tháng 04/2026`,...).
  - Mặc định mở tháng gần nhất hoặc tháng hiện tại.
  - Cho phép chọn nhanh giữa các tháng chỉ với một cú nhấp.
- **Thẻ KPI tóm tắt tháng**:
  - Số ngày đã kiểm tra: ví dụ `26/31 ngày`.
  - Tỷ lệ thiết bị an toàn: ví dụ `98.5%` (tính trên tổng số lượt kiểm tra đạt `O`).
  - Số điểm không đạt: cảnh báo nếu có trạng thái `X`.

#### B. Form kiểm tra hàng ngày (Daily Inspection Form)
- Bố trí dạng khối Action Card nổi bật phía trên bảng hoặc Collapsible Panel với nút `+ Kiểm tra hôm nay`.
- **Trường nhập liệu**:
  - `Ngày kiểm tra`: Input date picker (mặc định hôm nay).
  - `Người kiểm tra`: Input text (mặc định lấy từ tài khoản đăng nhập `currentUser`, cho phép sửa).
  - `Đánh giá thiết bị`:
    - Danh sách thẻ tương tác cho từng thiết bị (`Dây bẹ 4m`, `Dây bẹ 6m`, `Dây xích cẩu 3m`...).
    - Mỗi thiết bị có 2 nút chọn trạng thái: **`[ ✅ Đạt (O) ]`** và **`[ ❌ Không đạt (X) ]`**.
    - Nút tiện ích: **"⚡ Đánh dấu tất cả ĐẠT"** để tích chọn toàn bộ chỉ trong 1 chạm.
- **Nút lưu dữ liệu**:
  - `[ 💾 Lưu kết quả kiểm tra ]`: Gửi API lên Google Apps Script, cập nhật ngay lập tức vào bảng dữ liệu trên giao diện và hiển thị Toast thông báo.
  - `[ 🔄 Hủy / Đóng ]`: Đóng hoặc đặt lại form về ban đầu.

#### C. Bảng ma trận theo dõi lịch sử tháng (Inspection History Table)
- Hiển thị toàn bộ các ngày đã ghi nhận trong tháng đã chọn:
  - Cột 1: `Ngày` (kèm thứ trong tuần, ví dụ: `02/03/2026 (T2)`).
  - Cột 2: `Người kiểm tra`.
  - Cột 3..N: Badge trạng thái từng thiết bị:
    - Badge xanh lá viền neon cho `O` (Đạt).
    - Badge đỏ cảnh báo cho `X` (Không đạt).
    - Dấu gạch `-` xám mờ nếu ngày nghỉ / không kiểm tra.
  - Cột `Thao tác`: Nút `✏️ Sửa` cho phép nạp lại dữ liệu của ngày đó lên form để chỉnh sửa nhanh.

---

## 3. Luồng dữ liệu & Tích hợp Google Apps Script

### 3.1. Luồng tải dữ liệu (Read)
- Gọi qua `GSheetsService.fetchSheetData(sheetId, 'equipment-checklist')`.
- Hàm `renderEquipmentChecklist(data)` tách biệt xử lý:
  - Parse headers và xác định danh sách thiết bị.
  - Gom nhóm các dòng theo tháng (`MM/YYYY`).
  - Tính toán số liệu thống kê cho tháng đang kích hoạt.
  - Render thanh tháng, thẻ thống kê, form kiểm tra và bảng dữ liệu ngày.

### 3.2. Luồng lưu / cập nhật dữ liệu (Write)
- Payload gửi tới `CONFIG.APPS_SCRIPT_URL_HSE`:
  ```json
  {
    "action": "saveEquipmentChecklist",
    "sheetName": "Checklist kiểm tra thiết bị",
    "date": "22/09/2026",
    "inspector": "Nguyễn Văn Học",
    "deviceResults": {
      "Dây bẹ 4m": "O",
      "Dây bẹ 6m": "O",
      "Dây xích cẩu 3m": "O"
    }
  }
  ```
- **Xử lý Google Apps Script**:
  - Tìm dòng có cột Ngày trùng khớp:
    - Nếu đã có: Cập nhật người kiểm tra và giá trị từng cột thiết bị tương ứng.
    - Nếu chưa có: Thêm dòng mới vào sheet.
  - Trả về JSON `{ status: 'success', message: 'Lưu kiểm tra thiết bị thành công' }`.
- **Cập nhật giao diện (Optimistic / Local Update)**:
  - Cập nhật mảng dữ liệu local `currentModuleFullData`.
  - Re-render bảng tháng ngay lập tức mà không cần fetch lại toàn bộ CSV.

---

## 4. Các tệp tác động (Files to Modify)
1. `assets/js/5s/hse.js`:
   - Thêm phương thức `renderEquipmentChecklist(data)` chuyên biệt cho module `equipment-checklist`.
   - Thêm các hàm phụ trợ: `selectChecklistMonth`, `populateChecklistFormForEdit`, `handleChecklistSubmit`, `quickCheckAllPass`.
   - Kết nối vào switch `renderModalContent` khi `moduleId === 'equipment-checklist'`.
2. `assets/css/5s/hse.css`:
   - Thêm CSS styling cho Checklist Month Pills, KPI Cards, Daily Inspection Form (toggle buttons, neon status badges, quick-action button).
3. `cloudflare-r2/google-apps-script-snippet.gs`:
   - Bổ sung hàm xử lý action `saveEquipmentChecklist` để người quản trị cập nhật vào Google Apps Script khi cần.
4. Đồng bộ các file sang `public/`, `dist/`, `dist-app/` qua lệnh `npm run build`.

---

## 5. Kế hoạch xác thực (Verification Plan)
- **Kiểm tra giao diện**:
  - Mở trang `pages/5s/hse.html`, nhấp vào thẻ "Checklist kiểm tra thiết bị".
  - Kiểm tra thanh chọn tháng hiển thị đúng các tháng (Tháng 03/2026, Tháng 04/2026...).
  - Kiểm tra các thẻ KPI hiển thị chính xác số ngày và tỷ lệ an toàn.
  - Kiểm tra Form kiểm tra hiển thị đúng danh sách thiết bị và các nút toggle `O` / `X` hoạt động mượt mà.
  - Kiểm tra nút "⚡ Đánh dấu tất cả ĐẠT" chọn nhanh tất cả thiết bị thành `O`.
- **Kiểm tra chức năng sửa**:
  - Bấm nút `✏️ Sửa` ở một dòng ngày bất kỳ, xác nhận form tải đúng ngày, người kiểm tra và trạng thái các thiết bị.
- **Kiểm tra đồng bộ**:
  - Lưu form, kiểm tra payload gửi đi và kiểm tra bảng dữ liệu cập nhật ngay lập tức.
