# Thiết Kế: Hỗ Trợ Phiếu Xuất Kho Nhiều Mặt Hàng Khác Nhau (XG-XUAT Multi-Item OCR & Form)

## 1. Tổng Quan
Nâng cấp hệ thống nhập xuất xà gồ `xg-xuat` để hỗ trợ các phiếu xuất kho chứa **nhiều mặt hàng (khác Mã vật tư, khác Tên vật tư, khác Lô/Batch)** trong cùng một số `Phiếu xuất`. Khi quét ảnh bằng AI Vision OCR hoặc nhập thủ công, hệ thống tự động nhận diện và cấu trúc thành các thẻ mặt hàng (Item Cards) riêng biệt, cho phép chọn cuộn tồn kho tương ứng cho từng mặt hàng và lưu toàn bộ phiếu xuất trong một giao dịch duy nhất.

## 2. Yêu Cầu & Quy Tắc Thiết Kế

### 2.1. Cấu trúc dữ liệu Header - Detail
- **Thông tin chung (Shared Header)**:
  - `Mã chứng từ`: Mặc định `"PX"`.
  - `Ngày xuất`: Ngày xuất trên phiếu (format `yyyy-mm-dd`).
  - `Phiếu xuất`: Số phiếu xuất (dùng chung cho mọi dòng trong phiếu).
  - `Loại xuất`: Đơn vị nhận (VD: `Xưởng sản xuất`).
  - `Mã công trình` & `Tên công trình`: Đối tượng chi phí.
  - `Ghi chú`: Để trống.

- **Danh sách mặt hàng (Dynamic Item Cards)**:
  Mỗi mặt hàng chứa:
  - `Mã vật tư` (Mã hàng)
  - `Tên vật tư` (Tên hàng)
  - `Batch` (Lô)
  - Danh sách các cuộn xuất của mặt hàng đó (Cuộn ID, Số kg)
  - Nút `+ Chọn cuộn từ kho` (mở modal tồn kho tự động lọc theo mã vật tư của mặt hàng đó)
  - Tổng số kg của riêng mặt hàng đó.

### 2.2. Động cơ OCR AI
- Prompt trích xuất trả về mảng `items`:
  ```json
  {
    "ngayXuat": "2026-08-31",
    "phieuXuat": "4900137996",
    "maChungTu": "PX",
    "loaiXuat": "Xưởng sản xuất",
    "maCongTrinh": "10626-056.01",
    "tenCongTrinh": "DG TN APF ĐỒNG NAI",
    "items": [
      {
        "stt": 1,
        "maVatTu": "10001189",
        "tenVatTu": "Thép phôi kẽm Z275 G450",
        "batch": "1.8X351VN"
      },
      {
        "stt": 2,
        "maVatTu": "10001189",
        "tenVatTu": "Thép phôi kẽm Z275 G450",
        "batch": "2.5X350VN"
      }
    ]
  }
  ```

### 2.3. Quy trình lưu dữ liệu
- Khi bấm **"Thêm"**:
  - Gom toàn bộ cuộn từ tất cả các thẻ mặt hàng.
  - Gán đúng `Mã vật tư`, `Tên vật tư`, `Batch` tương ứng của từng thẻ.
  - Kết hợp với Thông tin chung (`Phiếu xuất`, `Ngày xuất`, `Mã chứng từ = PX`, `Công trình`).
  - Gửi đồng thời tới RPC `xuat_xg_atomic` trong 1 giao dịch.
