# Thiết Kế: Tự Động Điền Dữ Liệu Từ Ảnh Phiếu Xuất Kho (XG-XUAT OCR Auto-Fill)

## 1. Tổng Quan
Tính năng cho phép người dùng tải lên, chụp ảnh hoặc dán (`Ctrl + V`) ảnh **Phiếu xuất kho** (mẫu Đại Dũng Corporation) ngay trong modal "Thêm dữ liệu" của trang `xg-xuat.html`. Hệ thống sử dụng động cơ phân tích ảnh (Vision AI / OCR) để tự động trích xuất các thông tin trên phiếu và điền vào các trường biểu mẫu, giảm thiểu thao tác nhập thủ công và hạn chế sai sót.

## 2. Mục Tiêu & Yêu Cầu
- **Vị trí UI**: Tích hợp dropzone tải/dán ảnh trực tiếp ở phần đầu modal "Thêm dữ liệu - Xuất nhiều cuộn" (`#addDataModal`).
- **Thao tác thuận tiện**: Hỗ trợ kéo thả, chọn file từ máy, chụp từ camera điện thoại/tablet, hoặc nhấn `Ctrl + V` để dán ảnh chụp màn hình.
- **Quy tắc trích xuất & Điền dữ liệu**:
  1. `Mã chứng từ`: Mặc định gán là `"PX"` (tự động bổ sung option `"PX"` vào dropdown nếu chưa có và chọn sẵn).
  2. `Ngày xuất`: Trích xuất ngày từ ảnh (VD: `31/08/2026`) -> chuyển sang định dạng `yyyy-mm-dd` (VD: `2026-08-31`).
  3. `Phiếu xuất`: Trích xuất từ mục "Số phiếu (No.):" (VD: `4900137998`).
  4. `Loại xuất`: Trích xuất từ "Đơn vị nhận" hoặc "Loại giao dịch" (VD: `Xưởng sản xuất`).
  5. `Mã vật tư`: Trích xuất từ cột "Mã hàng" trong bảng (VD: `10002377`), điền vào ô và tự động kích hoạt nút `+ Thêm cuộn`.
  6. `Tên vật tư`: Trích xuất từ cột "Tên hàng" trong bảng (VD: `Phôi tôn mạ 1.0x1200 Z275 G450`).
  7. `Batch`: Trích xuất từ cột "Lô" (VD: `PHN-VN`).
  8. `Mã công trình` & `Tên công trình`: Trích xuất từ dòng "Đối tượng chi phí (Cost Object):" (VD: `10626-056.01` và `DG TN APF ĐỒNG NAI`).
  9. `Số lượng (Kg)`: **Để trống** để người dùng tự chọn cuộn trong tồn kho hoặc tự điền.
  10. `Ghi chú`: **Để trống**.
- **Động cơ OCR**:
  - Hỗ trợ Gemini Vision API (nhận diện cấu trúc bảng và tiếng Việt cực kỳ chính xác) với khóa API lưu an toàn trong `localStorage` / modal cài đặt nhanh.
  - Tích hợp fallback parser xử lý OCR phía client.

## 3. Kiến Trúc & Thay Đổi Chi Tiết

### 3.1. File mới: `assets/js/core/receipt-ocr-service.js`
- Quản lý việc đọc ảnh, gửi request tới Gemini Vision API hoặc OCR Engine.
- Chứa prompt cấu trúc chuyên dụng cho mẫu Phiếu xuất kho DDC:
  - Trích xuất JSON có cấu trúc chuẩn xác: `{ ngayXuat, phieuXuat, maChungTu: "PX", loaiXuat, maVatTu, tenVatTu, batch, maCongTrinh, tenCongTrinh }`.
- Cung cấp hàm `ReceiptOcrService.processImage(fileOrBlob)` trả về kết quả JSON đã bóc tách.

### 3.2. Cập nhật: `pages/xg/xg-xuat.html`
- Thêm container `#imageOcrDropzone` vào đầu `#addDataForm .modal-body`:
  - Khung tải/dán ảnh viền nét đứt đẹp mắt, icon camera/upload.
  - Nút cài đặt API key (modal cài đặt nhỏ gọn) nếu người dùng muốn dùng Gemini API miễn phí cá nhân.
  - Vùng hiển thị trạng thái quét (loading spinner) và preview ảnh sau khi trích xuất.
- Nhúng script `receipt-ocr-service.js`.

### 3.3. Cập nhật: `assets/js/xg/xg-xuat.js`
- Bổ sung logic lắng nghe sự kiện kéo thả, chọn file, và sự kiện `paste` (Ctrl+V) khi `#addDataModal` đang mở.
- Khi nhận diện xong:
  - Điền giá trị vào các trường tương ứng trong `#addDataCommonFields` và `#addDataAdditionalFields`.
  - Nếu dropdown `Mã chứng từ` chưa có option `"PX"`, tự động thêm `<option value="PX" selected>PX</option>` và chọn `"PX"`.
  - Cập nhật trường `#addDataMaVatTu` và mở khóa (enable) nút `#btnAddRoll`.
  - Tạo hiệu ứng highlight xanh nhạt lên các ô vừa được điền để báo cho người dùng biết dữ liệu đã sẵn sàng.

### 3.4. Cập nhật CSS: `assets/css/xg/xg-xuat.css`
- Thêm styles cho dropzone tải ảnh, trạng thái kéo thả dragover, nút camera, và hiệu ứng highlight trường dữ liệu.

## 4. Kế Hoạch Kiểm Thử (Verification Plan)
1. **Kiểm tra giao diện dropzone**: Mở modal "Thêm dữ liệu", kiểm tra vùng tải ảnh hiển thị đúng, responsive trên mobile/desktop.
2. **Kiểm tra dán ảnh (`Ctrl + V`)**: Copy ảnh mẫu Phiếu xuất kho vào clipboard, mở modal và bấm `Ctrl + V`.
3. **Kiểm tra trích xuất dữ liệu**:
   - `Mã chứng từ` = `"PX"`
   - `Ngày xuất` = `2026-08-31`
   - `Phiếu xuất` = `4900137998`
   - `Loại xuất` = `Xưởng sản xuất`
   - `Mã vật tư` = `10002377`
   - `Tên vật tư` = `Phôi tôn mạ 1.0x1200 Z275 G450`
   - `Batch` = `PHN-VN`
   - `Mã công trình` = `10626-056.01`
   - `Tên công trình` = `DG TN APF ĐỒNG NAI`
   - `Số lượng (Kg)` = trống
   - `Ghi chú` = trống
4. **Kiểm tra thao tác tiếp theo**: Bấm `+ Thêm cuộn`, kiểm tra modal tồn kho mở ra và lọc đúng theo mã vật tư `10002377`.
5. **Kiểm tra đồng bộ**: Chạy `node scripts/sync-dist.js` để đồng bộ đầy đủ các thư mục phân phối.
