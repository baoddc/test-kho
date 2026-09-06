# Thiết Kế Chức Năng Kiểm Kê Tồn Bằng Máy Quét & Đối Soát File Excel (kiem-ke.html)

- **Ngày tạo**: 2026-09-06
- **Trạng thái**: Đã thống nhất thiết kế với người dùng (Phương án 1 - Bảng điều khiển đối soát 3 chiều tích hợp)

## 1. Mục tiêu & Bối cảnh
Xây dựng trang web kiểm kê chuyên dụng (`pages/kiem-ke.html`) phục vụ công tác kiểm đếm tồn kho bằng máy quét mã vạch (Barcode Scanner) kết hợp đối soát 3 chiều:
1. **File Excel cơ sở kiểm kê**: Đọc từ file Excel kế hoạch/sổ sách do thủ kho/kế toán tải lên.
2. **Dữ liệu Tồn Hệ thống**: Tự động tổng hợp tồn hiện hành từ cơ sở dữ liệu Supabase của cả 2 kho (Kho Xà gồ: `xg-nhap` - `xg-xuat` và Kho Tole: `tole-nhap` - `tole-xuat`).
3. **Dữ liệu Thực tế Quét**: Danh sách cuộn thực tế được quét bằng súng quét Barcode cầm tay hoặc Camera scanner tại kho.

Hệ thống tự động nối **Mã vật tư** và **Batch (Lô)** thành **Cột ảo**, tổng hợp số liệu bằng thuật toán **SUMIF** và đối soát chênh lệch trực tiếp trên bảng điều khiển.

---

## 2. Quy chuẩn Cột ảo & Giải thuật Tổng hợp SUMIF

### 2.1. Cột ảo File Excel cơ sở
- Người dùng nạp file Excel (`.xlsx` hoặc `.xls`).
- Ánh xạ cột trong file:
  - **Cột G**: Mã vật tư (`Material`)
  - **Cột K**: Lô (`Batch`)
  - **Cột O**: Khối lượng tồn / Số lượng (`Stock Qty / Kg`)
- **Quy tắc tạo Cột ảo File**:
  $$\text{Cột ảo File} = \text{Trim}(\text{Cột G}) + \text{"-"} + \text{Trim}(\text{Cột K})$$
  *(Ví dụ: `10001189-2.5X75VN`)*
- **SUMIF File**: Gom nhóm theo `Cột ảo File`, tính tổng khối lượng tồn cột O và đếm số dòng trong file.

### 2.2. Cột ảo Hệ thống (Supabase)
- Tải toàn bộ các cuộn tồn (nhập chưa xuất) của cả 2 kho Xà gồ và Tole từ Supabase.
- **Quy tắc tạo Cột ảo Hệ thống**:
  $$\text{Cột ảo Hệ thống} = \text{Trim}(\text{row['Mã vật tư']}) + \text{"-"} + \text{Trim}(\text{row['Batch']})$$
- **SUMIF Hệ thống**: Gom nhóm theo `Cột ảo Hệ thống`, tính tổng khối lượng `Số lượng (Kg)` và đếm số lượng cuộn tồn.

### 2.3. Bóc tách Barcode & Cột ảo Thực tế Quét
- Hỗ trợ súng quét mã vạch cầm tay (USB/Bluetooth HID gửi kèm phím `Enter`) và Camera Scanner (`Html5Qrcode`).
- Định dạng chuỗi Barcode chuẩn trên tem: `Mã vật tư-Batch-Khối lượng` (ví dụ: `10001189-2X349VN-1472` hoặc `10001264-VN-2130.5`).
- Giải thuật tách:
  - `maVatTu = parts[0]`
  - `kg = parseFloat(parts[last])`
  - `batch = parts[1..last-1].join('-')`
  - $\text{Cột ảo Quét} = \text{maVatTu} + \text{"-"} + \text{batch}$
- Cảnh báo quét trùng: Nếu cuộn (hoặc mã barcode gốc) đã có trong danh sách phiên quét hiện tại, phát âm thanh Boop trầm và thông báo từ chối cộng dồn 2 lần.
- Nếu hợp lệ: Phát âm thanh Beep bổng, ghi nhận cuộn vào danh sách và cập nhật ngay lập tức các chỉ số.
- **SUMIF Thực tế Quét**: Gom nhóm theo `Cột ảo Quét`, tính tổng khối lượng `kg` và đếm số cuộn đã quét.

---

## 3. Kiến trúc Giao diện Người Dùng (UI/UX)

Trang `pages/kiem-ke.html` được thiết kế theo chuẩn nhận diện giao diện của dự án (Bootstrap 5, dark mode, responsive, font Inter/Roboto):

### 3.1. Thanh công cụ & Điều khiển nhanh (Top Bar)
- **Khu vực Nạp File Excel**: Nút tải lên file Excel, hiển thị tên file và số dòng dữ liệu đọc được.
- **Ô Quét Barcode Auto-focus**:
  - Ô input lớn, tự động giữ focus liên tục để nhận tín hiệu máy quét mọi lúc.
  - Phím tắt / icon mở camera quét dự phòng.
- **Cụm nút tiện ích**:
  - `Tải lại dữ liệu Supabase`: Đồng bộ lại tồn kho mới nhất.
  - `Xuất Báo Cáo Excel`: Xuất bảng đối soát ra file `.xlsx`.
  - `Xóa phiên kiểm kê`: Đặt lại dữ liệu quét để bắt đầu đợt mới (có modal xác nhận).

### 3.2. Thẻ chỉ số tổng quan (Stat Cards)
1. **Tổng mã Batch (Cột ảo)**: Số cặp Mã VT-Batch trong kỳ kiểm kê.
2. **Tồn File Excel**: Tổng khối lượng (Kg) | Số dòng.
3. **Tồn Hệ thống Supabase**: Tổng khối lượng (Kg) | Số cuộn.
4. **Thực tế đã quét**: Tổng khối lượng (Kg) | Số cuộn | % Tiến độ.
5. **Trạng thái Đối soát**: Số mã Khớp hoàn toàn vs Số mã Lệch (thừa/thiếu).

### 3.3. Bảng dữ liệu 2 Tab
- **Tab 1: Bảng tổng hợp đối soát (Cột ảo `[Mã VT]-[Batch]`)**:
  - Cột: STT, Cột ảo, Tên vật tư, File Excel (Kg), Hệ thống (Kg / Cuộn), Đã quét (Kg / Cuộn), Lệch Quét vs File, Lệch Quét vs Hệ thống, Trạng thái.
  - Phân loại trạng thái màu sắc:
    - 🟢 `Khớp hoàn toàn`: Quét = File = Hệ thống (hoặc chênh lệch < 0.1 kg do làm tròn).
    - 🔴 `Lệch thiếu`: Đã quét < Số lượng sổ sách.
    - 🟡 `Lệch thừa`: Đã quét > Số lượng sổ sách.
    - ⚪ `Chưa quét`: Chưa quét cuộn nào thuộc batch này.
    - 🟣 `Ngoài danh mục`: Quét có nhưng không có trong File Excel.
  - Bộ lọc: Tất cả | Khớp | Lệch thiếu | Lệch thừa | Chưa quét.
  - Ô tìm kiếm nhanh lọc theo Mã VT, Batch hoặc Cột ảo.
- **Tab 2: Danh sách chi tiết các cuộn đã quét**:
  - Hiển thị danh sách cuộn vừa quét được sắp xếp mới nhất lên đầu.
  - Cột: STT, Thời gian, Barcode gốc, Mã VT, Batch, Khối lượng tem (Kg), Thao tác (Xóa từng cuộn nếu quét nhầm).

### 3.4. Phản hồi âm thanh & Trực quan
- Tích hợp Web Audio API phát sinh âm thanh trực tiếp từ trình duyệt:
  - Tần số 880Hz (Beep ngắn, trong trẻo) khi quét thành công.
  - Tần số 220Hz (Boop đôi, trầm đục) khi quét trùng hoặc lỗi mã.
- Toast thông báo nhẹ không che khuất màn hình và không làm mất focus của ô quét.

---

## 4. Lưu trữ Phiên & Xuất Báo Cáo

### 4.1. Tự động lưu phiên (LocalStorage)
- Lưu trữ các khóa: `kiem_ke_scanned_rolls_session` và `kiem_ke_excel_cache`.
- Tự động lưu ngay khi quét thêm cuộn mới hoặc nạp file Excel.
- Tự động khôi phục dữ liệu phiên khi người dùng refresh hoặc mở lại trình duyệt.

### 4.2. Xuất Báo Cáo Excel Kết Quả Kiểm Kê
- Xuất file định dạng `Ket_Qua_Kiem_Ke_YYYYMMDD_HHmm.xlsx` qua thư viện SheetJS.
- File gồm 2 Sheet:
  1. `Tong_Hop_Doi_Soat`: Toàn bộ bảng Cột ảo, File, Hệ thống, Đã quét, Chênh lệch và Trạng thái.
  2. `Chi_Tiet_Cuon_Quet`: Danh sách đầy đủ từng cuộn đã quét thực tế (giờ quét, barcode, khối lượng).

---

## 5. Kế hoạch Kiểm thử & Xác minh
1. **Kiểm thử đọc File Excel**: Nạp file mẫu có cột G, K, O; kiểm tra xử lý đúng các trường hợp số có dấu phẩy/chấm/trống.
2. **Kiểm thử Cột ảo & SUMIF**: Kiểm tra logic ghép chuỗi `G-K` và hàm tính tổng theo key Cột ảo.
3. **Kiểm thử máy quét**: Thử nghiệm bắn chuỗi barcode qua ô input; kiểm tra cơ chế phát âm thanh, chặn quét trùng và cập nhật số liệu thời gian thực.
4. **Kiểm thử LocalStorage**: F5 trang kiểm tra khôi phục phiên quét; kiểm tra nút xóa phiên.
5. **Kiểm thử Xuất Excel**: Kiểm tra file tải về mở được trên Microsoft Excel/WPS với đầy đủ 2 Sheet.
