# Thiết Kế Hệ Thống Mã QR Vị Trí Kệ & Module Quét Tồn Kho (Kho Xà Gồ & Kho Tole)

**Ngày thiết kế:** 26/08/2026  
**Tác giả:** Antigravity & baoddc  
**Trạng thái:** Bản thiết kế đã duyệt (Approved Design)

---

## 1. Bối cảnh & Mục tiêu

### 1.1 Hiện trạng
- Hệ thống quản lý kho Xà gồ (`xg-ton`, `xg-nhap`, `xg-xuat`) và kho Tole (`tole-ton`, `tole-nhap`, `tole-xuat`) đều quản lý theo trường `Vị trí` (Location).
- Tại xưởng thực tế, các cuộn thép và xà gồ được xếp theo các dãy kệ chuẩn:
  - **Dãy A:** Từ `A01` đến `A14` (14 kệ).
  - **Dãy B:** Từ `B01` đến `B14` (14 kệ).
- Công nhân và thủ kho hiện đang phải gõ thủ công vị trí hoặc tìm kiếm cuộn bằng cách gõ text, chưa có nhãn tem định danh dán trên từng kệ và chưa hỗ trợ quét mã QR để thao tác nhanh.

### 1.2 Mục tiêu đề ra
1. **Trang Tạo & In Tem QR Vị Trí Chuyên Nghiệp:** Cho phép thủ kho chọn kho (Xà gồ / Tole / Phụ liệu), chọn dải kệ `A01-A14`, `B01-B14` hoặc vị trí tùy biến, xem trước tem in và in hàng loạt khổ A4 / Tem nhiệt Decal sắc nét chuẩn công nghiệp kèm logo Thép Đại Dũng (DDC).
2. **Cơ Chế QR Thông Minh (Smart Dual Payload):** Mã QR nhúng trực tiếp đường dẫn URL (`https://<domain>/pages/xg/xg-ton.html?vitri=A01`).
   - Khi quét bằng bất kỳ điện thoại nào ngoài xưởng (Camera Zalo, iPhone, Android): Tự động mở trang web và lọc ra danh sách toàn bộ các cuộn tồn kèm tổng kg tại kệ đó.
   - Khi quét bên trong Web App (Camera Scanner hoặc súng bắn mã vạch USB): Bộ giải mã tự động tách chuỗi lấy mã vị trí `A01` để tự động điền vào ô nhập liệu hoặc bộ lọc.
3. **Module Quét QR Camera Tích Hợp (In-App HTML5 Scanner):** Tích hợp nút camera quét vị trí trên các trang `xg-ton`, `tole-ton`, `xg-nhap`, `xg-xuat`, `tole-nhap`, `tole-xuat`.

---

## 2. Kiến Trúc Giải Pháp & Cấu Trúc File

```
web-supabase/
├── pages/
│   ├── in-tem-vitri.html          # Trang tạo & in tem QR vị trí kệ
│   ├── xg/
│   │   ├── xg-ton.html            # Bổ sung nút camera & banner lọc vị trí URL
│   │   ├── xg-nhap.html           # Bổ sung nút quét QR vị trí vào bảng cuộn
│   │   └── xg-xuat.html           # Bổ sung nút quét QR vị trí
│   └── tole/
│       ├── tole-ton.html          # Bổ sung nút camera & banner lọc vị trí URL
│       ├── tole-nhap.html         # Bổ sung nút quét QR vị trí vào bảng cuộn
│       └── tole-xuat.html         # Bổ sung nút quét QR vị trí
├── assets/
│   ├── js/
│   │   ├── common/
│   │   │   └── in-tem-vitri.js    # Logic render preview, sinh mã QR + Barcode, in ấn
│   │   ├── components/
│   │   │   ├── qr-scanner-modal.js # Module Modal quét Camera HTML5 dùng chung
│   │   │   └── sidebar.js         # Bổ sung menu "In Tem Vị Trí"
│   │   ├── xg/
│   │   │   ├── xg-ton.js          # Nhận URL param ?vitri= & tích hợp scanner
│   │   │   ├── xg-nhap.js         # Tích hợp scan QR vị trí vào form
│   │   │   └── xg-xuat.js         # Tích hợp scan QR vị trí
│   │   └── tole/
│   │       ├── tole-ton.js        # Nhận URL param ?vitri= & tích hợp scanner
│   │       ├── tole-nhap.js       # Tích hợp scan QR vị trí vào form
│   │       └── tole-xuat.js       # Tích hợp scan QR vị trí
│   └── css/
│       ├── common/
│       │   └── in-tem-vitri.css   # CSS giao diện & @media print khổ in A4 / Decal
│       └── components/
│           └── qr-scanner-modal.css
```

---

## 3. Thiết Kế Chi Tiết

### 3.1 Trang Tạo & In Tem Vị Trí (`pages/in-tem-vitri.html`)

#### a. Bảng điều khiển cấu hình (Control Panel)
- **Chọn phân hệ kho:** Radio/Select: Kho Xà Gồ (`xg`), Kho Tole (`tole`), Kho Phụ Liệu (`pl`).
- **Chọn dải vị trí:**
  - Checkbox dãy A (`A01` đến `A14`) + Checkbox dãy B (`B01` đến `B14`).
  - Nút "Chọn tất cả" / "Bỏ chọn tất cả".
  - Ô nhập vị trí tùy biến (cho phép gõ thêm danh sách ngăn cách bằng dấu phẩy: vd `C01, C02, BAI-01, NGOAI-SAN`).
- **Tùy chọn mẫu tem & khổ in:**
  - Mẫu 1: **Khổ A4 - 4 Tem/Trang** (Tem cỡ lớn 135mm x 95mm, dán mặt trước đầu kệ xưởng).
  - Mẫu 2: **Khổ A4 - 2 Tem/Trang** (Tem siêu lớn 190mm x 135mm, quan sát từ xa).
  - Mẫu 3: **Khổ Decal Nhiệt 100x75mm** (Chuẩn máy in tem công nghiệp).
- **Tùy chỉnh Domain Web App:** Mặc định lấy `window.location.origin` (hoặc cho phép nhập domain cố định như `https://kho.daidung.vn`).

#### b. Thiết kế tem in (Label Design Standard)
Mỗi con tem được đóng khung viền sắc nét, bố cục gồm:
1. **Header:** Logo Thép Đại Dũng (DDC) bên trái, bên phải là tiêu đề phân kho: `CÔNG TY CỔ PHẦN CƠ KHÍ XÂY DỰNG THƯƠNG MẠI ĐẠI DŨNG` - `KHO XÀ GỒ / KHO TOLE`.
2. **Khu vực Kệ (Hero Area):** Mã vị trí kệ (ví dụ: **A01**, **B14**) hiển thị với font chữ Sans-Serif siêu đậm (Bold), cỡ chữ lớn (48pt - 72pt), tương phản cao (High Contrast).
3. **Mã QR Code:** Kích thước 250x250px độ nét cao (Canvas render), chứa đường link tra cứu nhanh.
4. **Mã Barcode Code 128 (Phụ):** Mã vạch 1D bên dưới mã QR hỗ trợ đầu đọc barcode truyền thống.
5. **Footer:** Hướng dẫn ngắn *"Quét mã QR để xem tồn kho hoặc nhập/xuất cuộn"*.

#### c. Tối ưu CSS In Ấn (`@media print`)
- Ẩn toàn bộ thanh công cụ, sidebar, header web.
- Thiết lập `@page { size: A4 portrait; margin: 8mm; }`.
- Sử dụng CSS Grid 2x2 cho khổ 4 tem/trang, tự động phân trang `page-break-inside: avoid; page-break-after: auto;`.
- Xuất in sắc nét bằng lệnh `window.print()` (phím tắt `Ctrl + P`).
- Tùy chọn tải toàn bộ mã QR dạng ảnh PNG (ZIP) hoặc in trực tiếp.

---

### 3.2 Cơ Chế Deep-Link & Tra Cứu Tồn Kho Theo Kệ

#### a. URL Structure
- Kho Xà gồ: `<origin>/pages/xg/xg-ton.html?vitri=A01`
- Kho Tole: `<origin>/pages/tole/tole-ton.html?vitri=A01`

#### b. Xử lý logic trên `xg-ton.js` và `tole-ton.js`
Khi trang được tải:
1. Kiểm tra tham số URL: `const urlParams = new URLSearchParams(window.location.search); const targetViTri = urlParams.get('vitri') || urlParams.get('location');`
2. Nếu có `targetViTri`:
   - Gán giá trị vào ô tìm kiếm hoặc bộ lọc vị trí.
   - Lọc bảng dữ liệu: Chỉ giữ lại các dòng có cột `Vị trí` trùng khớp với `targetViTri` (không phân biệt hoa thường).
   - Hiển thị thanh thông báo nổi (Alert Badge):
     > 📍 **Đang xem vị trí kệ: [ A01 ]** — Tổng số cuộn: **8 cuộn** | Tổng khối lượng: **24,500 Kg**  
     > `[ Nút: Xem toàn bộ kho ]`
   - Khi bấm "Xem toàn bộ kho", xóa query param trên URL (`history.replaceState`) và hiển thị lại toàn bộ dữ liệu.

---

### 3.3 Module Quét Mã QR Camera (`qr-scanner-modal.js`)

#### a. Thư viện tích hợp
- Sử dụng thư viện mã nguồn mở nhẹ và phổ biến: `html5-qrcode` (CDN: `https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js`).
- Hỗ trợ đổi camera trước/sau trên điện thoại, tự động bật Flash/Đèn pin nếu trình duyệt hỗ trợ.

#### b. Bộ giải mã thông minh (Smart Location Parser)
Hàm `parseLocationFromQr(qrText)` xử lý linh hoạt:
- Nếu là URL: `https://domain.com/pages/xg/xg-ton.html?vitri=A01` ➔ Trích xuất ra `A01`.
- Nếu là format tiền tố: `LOC:A01` hoặc `VITRI:A01` ➔ Trích xuất ra `A01`.
- Nếu là text thô: `A01`, `B12` ➔ Trích xuất ra `A01`, `B12`.
- Chuẩn hóa viết hoa và xóa khoảng trắng thừa (`trim().toUpperCase()`).

#### c. Tích hợp trên các màn hình
1. **Trang Tồn Kho (`xg-ton.html`, `tole-ton.html`):**
   - Đặt nút icon camera `📷 Quét kệ` ngay bên cạnh ô tìm kiếm.
   - Khi quét thành công: Điền vị trí vào ô tìm kiếm và kích hoạt hàm lọc.
2. **Trang Nhập Kho (`xg-nhap.html`, `tole-nhap.html`):**
   - Trong Modal "Thêm dữ liệu - Nhập nhiều cuộn":
     + Thêm nút `📷 Quét QR vị trí` ở tiêu đề danh sách cuộn và từng dòng cuộn.
     + Quét xong tự điền vị trí cho dòng cuộn hiện tại; có popup hỏi *"Bạn có muốn áp dụng vị trí [A01] cho tất cả các cuộn trong lô này không?"*.
3. **Trang Xuất Kho (`xg-xuat.html`, `tole-xuat.html`):**
   - Trong Modal xuất cuộn: Nút `📷 Quét vị trí kệ` để lọc nhanh danh sách cuộn cần xuất thuộc kệ đó.

---

## 4. Kế Hoạch Kiểm Thử (Verification Plan)

1. **Kiểm thử Sinh & In Tem (`in-tem-vitri.html`):**
   - Kiểm tra hiển thị đủ 28 tem kệ (`A01-A14` và `B01-B14`).
   - Kiểm tra thêm kệ tùy chỉnh (`C01`, `NGOAI-SAN`).
   - Kiểm tra in thử khổ A4 (4 tem/trang, 2 tem/trang) trên Chrome/Edge Print Preview không bị tràn trang.
2. **Kiểm thử Deep-link Tra cứu:**
   - Mở thử link `/pages/xg/xg-ton.html?vitri=A01` ➔ Kiểm tra bảng chỉ hiển thị cuộn ở kệ A01, banner tổng số lượng và kg hiển thị chính xác.
   - Mở thử link `/pages/tole/tole-ton.html?vitri=B05` ➔ Kiểm tra dữ liệu kho tole lọc đúng kệ B05.
3. **Kiểm thử Quét Camera (HTML5 QR Scanner):**
   - Mở modal quét camera trên điện thoại và laptop.
   - Quét mã QR URL và mã QR text thô ➔ Kiểm tra kết quả trả về đúng mã vị trí.
4. **Kiểm thử Nhập/Xuất kho:**
   - Quét QR vị trí khi thêm cuộn trong `xg-nhap` và `tole-nhap` ➔ Kiểm tra dữ liệu được lưu đúng vào Supabase.
