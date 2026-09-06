# Thiết Kế Bộ Điều Khiển Camera Quét Mã Vạch: Chuyển Đổi Camera Phụ, Zoom (0.6x - 3.0x) và Đèn Flash

## 1. Mục tiêu & Tổng quan
Nâng cấp trải nghiệm quét mã vạch tem cuộn thép trên thiết bị di động trong môi trường kho:
- Cho phép nhận diện và chuyển đổi giữa các camera trên thiết bị (camera chính, camera phụ góc rộng ultra-wide, camera telephoto/zoom, camera trước).
- Hỗ trợ dải zoom đa năng từ góc rộng **0.6x, 0.7x, 0.8x, 0.9x** đến zoom phóng to **1.0x, 1.5x, 2.0x, 3.0x** phục vụ quét cả tem ở cự ly gần và tem trên cao/ở xa.
- Hỗ trợ bật/tắt đèn Flash (đèn pin/torch) trợ sáng quét tem trong các ngóc ngách hoặc kho tối.
- Áp dụng đồng bộ cho cả 2 màn hình:
  1. **Kiểm Kê Tồn Kho** (`pages/tem-nhan-kiem-ke/kiem-ke.html` & `assets/js/tem-nhan-kiem-ke/kiem-ke.js`)
  2. **Tra Cứu Vị Trí Cuộn** (`pages/tem-nhan-kiem-ke/vi-tri-ton.html` & `assets/js/tem-nhan-kiem-ke/vi-tri-ton.js`)
- Đồng bộ tự động sang `public/`, `dist/`, `dist-app/` qua `scripts/sync-dist.js`.

---

## 2. Thiết Kế Giao Diện (UI/UX Overlay)
Thanh điều khiển được xây dựng dưới dạng overlay nằm trực tiếp bên trên khung hình camera (`#cameraScannerContainer` / `#coilCameraContainer`), phong cách Dark Modern Glassmorphism:

### 2.1. Thanh công cụ góc trên bên phải (Top-Right Actions)
- **Nút Flash (⚡)**:
  - Icon sấm sét (`bi bi-lightning-charge` / `bi bi-lightning-charge-fill`).
  - Khi tắt: Nền đen mờ 60% (`rgba(0,0,0,0.6)`), icon trắng xám.
  - Khi bật: Nền vàng cam phát sáng (`#f59e0b`), icon vàng rực, viền sáng (`box-shadow: 0 0 10px rgba(245,158,11,0.5)`).
  - Tự động ẩn hoặc disabled nếu trình duyệt/thiết bị báo không hỗ trợ `torch`.
- **Nút Đổi Camera / Camera phụ (🔄)**:
  - Icon đảo chiều (`bi bi-camera-reels` hoặc `bi bi-arrow-repeat`).
  - Bấm vào sẽ chuyển luân phiên giữa danh sách các camera tìm thấy trên thiết bị.
  - Khi có trên 2 camera (ví dụ máy có camera 0.6x, 1x, 2x): Hiển thị nhãn tooltip/badge ngắn gọn tên camera (VD: `Cam sau (0.6x)`, `Cam chính (1x)`, `Cam phụ`).

### 2.2. Thanh điều khiển Zoom góc dưới (Bottom Zoom Controller)
- **Hàng nút Preset Zoom nhanh**:
  - Các nút bo tròn nhỏ kiểu camera điện thoại cao cấp:
    - `0.6x` (Góc rộng)
    - `0.8x`
    - `1.0x` (Mặc định tiêu chuẩn)
    - `2.0x` (Phóng to gấp đôi)
  - Nút đang chọn có màu nền nổi bật (active badge màu xanh lam hoặc vàng sáng).
- **Thanh trượt Slider mịn & Nút Tăng/Giảm (+ / −)**:
  - Nút `−` (Zoom out) và nút `+` (Zoom in).
  - Thanh trượt dải giá trị: `min="0.6"`, `max="3.0"`, `step="0.1"`.
  - Hiển thị nhãn số thực tế tức thời: `0.6x`, `0.7x`, `0.8x`, `0.9x`, `1.0x`, `1.5x`, `2.0x`, v.v.

---

## 3. Kiến Trúc Kỹ Thuật & Xử Lý Logic

### 3.1. Quản lý danh sách Camera & Camera phụ
- Sử dụng `Html5Qrcode.getCameras()` để lấy toàn bộ thiết bị video đầu vào.
- Phân loại camera dựa trên `label` (chứa các từ khóa như `wide`, `ultra`, `0.6`, `back`, `rear`, `front`, `telephoto`, `camera2 0`, `camera2 1`...):
  - Ưu tiên chọn camera sau chính khi vừa mở modal.
  - Khi người dùng bấm đổi camera: Dừng scanner hiện tại (`html5QrCode.stop()`), đổi sang deviceId tiếp theo và khởi động lại (`html5QrCode.start(deviceId, ...)`).
  - Khôi phục trạng thái flash/zoom nếu camera mới tương thích.

### 3.2. Cơ chế Zoom (Phần cứng & Fallback Kỹ thuật số)
1. **Hardware Zoom**:
   - Truy xuất `videoTrack` từ Html5Qrcode (`stream.getVideoTracks()[0]` hoặc `html5QrCode.getRunningTrackCapabilities()`).
   - Kiểm tra `capabilities.zoom`:
     - Nếu hỗ trợ: Gọi `videoTrack.applyConstraints({ advanced: [{ zoom: targetZoom }] })` hoặc `html5QrCode.applyVideoConstraints({ advanced: [{ zoom: targetZoom }] })`.
     - Cho phép tận dụng cảm biến zoom quang/điện tử của thiết bị mà không vỡ hình.
2. **Ultra-Wide / Góc Rộng (0.6x - 0.9x)**:
   - Nếu phần cứng camera chính có `capabilities.zoom.min <= 0.6`, zoom trực tiếp về giá trị `0.6`.
   - Nếu camera chính chỉ bắt đầu từ `1.0`, khi người dùng bấm `0.6x`, hệ thống tự động tìm và chuyển sang camera phụ góc rộng (Ultra-wide camera nếu có trong danh sách thiết bị).
   - Nếu thiết bị chỉ có 1 camera và zoom phần cứng khóa ở `1.0`: Áp dụng CSS viewport transform scale thông minh trên thẻ video để mô phỏng thu phóng góc nhìn trực quan.

### 3.3. Cơ chế Đèn Flash (Torch)
- Truy xuất `capabilities.torch`:
  - Bật: `videoTrack.applyConstraints({ advanced: [{ torch: true }] })`.
  - Tắt: `videoTrack.applyConstraints({ advanced: [{ torch: false }] })`.
  - Bắt lỗi an toàn (try/catch): Nếu trình duyệt từ chối quyền bật flash, hoàn tác trạng thái nút và hiển thị thông báo nhẹ.

---

## 4. Tệp Cần Chỉnh Sửa & Cập Nhật
1. `assets/css/pages/kiem-ke.css` & `assets/css/pages/vi-tri-ton.css`:
   - Thêm lớp CSS cho `.camera-overlay-controls`, `.cam-control-btn`, `.zoom-pill-group`, `.zoom-slider-container`.
2. `assets/js/core/camera-controller.js` (Module dùng chung) hoặc tích hợp trực tiếp vào:
   - `assets/js/tem-nhan-kiem-ke/kiem-ke.js`
   - `assets/js/tem-nhan-kiem-ke/vi-tri-ton.js`
3. `pages/tem-nhan-kiem-ke/kiem-ke.html` & `pages/tem-nhan-kiem-ke/vi-tri-ton.html`:
   - Bổ sung cấu trúc DOM overlay điều khiển bên trong container camera.
4. Chạy `node scripts/sync-dist.js` để đồng bộ toàn bộ thay đổi sang `public/`, `dist/`, `dist-app/`.

---

## 5. Kế Hoạch Kiểm Thử (Verification Plan)
- **Kiểm thử trên trình duyệt Desktop/Laptop**:
  - Mở camera webcam/laptop: Đổi camera, kiểm tra hiển thị nút zoom và thanh trượt zoom mô phỏng mượt mà.
  - Kiểm tra trạng thái nút Flash (báo không có phần cứng flash một cách mềm mại, không gây crash).
- **Kiểm thử trên thiết bị di động (Smartphone Android / iOS Chrome / Safari)**:
  - Bật đèn Flash: Đèn flash của điện thoại sáng lên và tắt đi chính xác.
  - Bấm các nấc Zoom: `0.6x`, `0.8x`, `1.0x`, `2.0x` hoặc kéo slider: hình ảnh camera thu nhỏ/phóng to mượt mà, quét tem mã vạch thành công ở các mức zoom.
  - Bấm nút chuyển camera: Chuyển đổi qua lại giữa camera chính, camera phụ góc rộng và camera tele.
