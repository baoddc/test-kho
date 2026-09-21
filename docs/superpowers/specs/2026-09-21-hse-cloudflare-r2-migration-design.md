# Thiết Kế Chuyển Đổi Lưu Trữ Hình Ảnh HSE Sang Cloudflare R2

**Ngày lập:** 2026-09-21  
**Mục tiêu:** Chuyển đổi phương thức lưu trữ hình ảnh của module HSE (`hse.html`, `hse.js`) từ Google Drive sang Cloudflare R2 nhằm tăng tốc độ tải ảnh, loại bỏ giới hạn quota/băng thông của Google Drive và tối ưu hiệu suất ghi dữ liệu vào Google Sheets.

---

## 1. Bối cảnh & Vấn đề hiện tại
- Phân hệ hình ảnh HSE (Ảnh mẫu kho `wh-photos`, Ảnh vệ sinh `clean-photos`, Thi đua 5S `5s-race`, Khắc phục 5S `5s-fix`) đang chuyển đổi toàn bộ ảnh thành chuỗi Base64 và gửi lên Google Apps Script Web App (`APPS_SCRIPT_URL_HSE`).
- Google Apps Script lưu tệp vào Google Drive và ghi link Drive vào Google Sheets.
- **Hạn chế:**
  - Payload lớn gửi qua Google Apps Script thường gây chậm, nghẽn mạng hoặc lỗi timeout 30 giây.
  - Link hình ảnh Google Drive (`drive.google.com/thumbnail?id=...`) thường bị giới hạn lượt tải (rate-limit/403/429), tải ảnh chậm và không tối ưu bằng CDN chuyên dụng.
  - Người dùng mong muốn chuyển sang Cloudflare R2 (đã tạo sẵn R2 Bucket trên tài khoản Cloudflare).

---

## 2. Kiến trúc giải pháp (Phương án 1)

### 2.1. Sơ đồ luồng dữ liệu (Data Flow)
1. **Tải lên hình ảnh (Upload Flow):**
   - Người dùng chọn tệp ảnh trên giao diện HSE.
   - Trình duyệt tạo bản xem trước tức thì (Blob URL) để người dùng không phải chờ đợi.
   - Trình duyệt đóng gói tệp vào `FormData` và gửi trực tiếp `POST /upload` tới **Cloudflare Worker API**.
   - Cloudflare Worker chuẩn hóa tên tệp (`hse/{folder}/{YYYY}/{MM}/{timestamp}_{filename}`), lưu trực tiếp vào **Cloudflare R2 Bucket** qua R2 Binding.
   - Worker trả về phản hồi JSON chứa `fileUrl` (đường dẫn CDN công khai) và `key`.
   - Trình duyệt gửi tiếp yêu cầu nhẹ sang **Google Apps Script** (`recordImageRow` hoặc `recordImageCell`) chỉ chứa link text để ghi vào Google Sheet.
   - Hoàn tất trong thời gian < 1 giây.

2. **Hiển thị hình ảnh (Display Flow):**
   - Đọc dữ liệu từ Google Sheets qua CSV như hiện tại.
   - Kiểm tra định dạng link:
     - Nếu chứa `drive.google.com`: dùng URL `https://drive.google.com/thumbnail?id=...` (tương thích 100% với các ảnh cũ đã lưu).
     - Nếu là link R2 / CDN trực tiếp: hiển thị trực tiếp `fileUrl` không qua trung gian.

3. **Xóa hình ảnh (Delete Flow):**
   - Khi xóa ảnh:
     - Nếu ảnh thuộc R2: Gửi `POST /delete` tới Cloudflare Worker để xóa tệp trong R2 Bucket.
     - Gửi yêu cầu sang Google Apps Script (`deleteImageRow` hoặc `deleteImageCell`) để xóa dòng/ô trong Google Sheet.

---

## 3. Chi tiết thiết kế các thành phần

### 3.1. Cloudflare Worker API (`cloudflare-r2/worker.js`)
- **Tên dịch vụ đề xuất:** `hse-r2-api`
- **R2 Bucket Binding:** `HSE_BUCKET` kết nối tới bucket R2 đã tạo của người dùng.
- **Biến môi trường (Environment Variables):**
  - `PUBLIC_URL` (tùy chọn): Tên miền công khai kết nối với R2 bucket (vd: `https://pub-xxxx.r2.dev` hoặc `https://media.domain.com`). Nếu không có biến này, Worker tự động phục vụ ảnh qua endpoint `/file/*`.
- **Các API Endpoints:**
  - `OPTIONS /*`: Xử lý CORS Preflight cho phép gọi từ web app.
  - `POST /upload`: Nhận `multipart/form-data` gồm `file` và `folder`. Lưu tệp và trả về:
    ```json
    {
      "status": "success",
      "fileUrl": "https://pub-xxxx.r2.dev/hse/clean-photos/2026/09/1726900000_photo.jpg",
      "key": "hse/clean-photos/2026/09/1726900000_photo.jpg",
      "size": 102400,
      "mimeType": "image/jpeg"
    }
    ```
  - `POST /delete`: Nhận JSON `{ "key": "..." }` hoặc `{ "fileUrl": "..." }` và xóa tệp khỏi R2.
  - `GET /file/*`: Trả về nội dung tệp ảnh kèm header `Cache-Control: public, max-age=31536000, immutable`.

### 3.2. Cập nhật mã nguồn Client (`assets/js/5s/hse.js`)
- Bổ sung `R2_WORKER_URL` vào đối tượng `CONFIG`:
  ```javascript
  const CONFIG = {
      API_KEY: '...',
      SPREADSHEET_ID: '1keZMSZqlHFIe7la0H2eR-PDmO2S2ChHo5vn3-H1uoh8',
      APPS_SCRIPT_URL_HSE: 'https://script.google.com/macros/s/.../exec',
      R2_WORKER_URL: 'https://hse-r2-api.your-subdomain.workers.dev', // Điền link Worker
      ...
  };
  ```
- Nâng cấp hàm `generateGalleryItemHtml(row, moduleId)`: Hỗ trợ linh hoạt link Drive cũ và link R2 mới.
- Nâng cấp hàm `handleImageUpload(event, moduleId)`: Tải lên Cloudflare Worker trước, sau đó ghi link vào Sheet qua Apps Script.
- Nâng cấp hàm `handleTableCellUpload(event)`: Tải lên Cloudflare Worker trước, sau đó ghi link vào ô tương ứng trong Sheet.
- Nâng cấp hàm `deleteImage(event, moduleId, imageUrl, btnElement)` và `deleteTableCellImage(row, column, url)`: Xóa tệp R2 và cập nhật Sheet.

### 3.3. Cập nhật Google Apps Script (`Code.gs`)
Bổ sung các nhánh xử lý gọn nhẹ trong `doPost`:
- `recordImageRow`: Nhận `sheetName`, `fileName`, `fileUrl`, `date` -> Ghi thẳng dòng mới vào Google Sheet bằng `sheet.appendRow([fileName, date, fileUrl, ''])`.
- `recordImageCell`: Nhận `sheetName`, `row`, `column`, `fileUrl` -> Gán giá trị ô bằng `sheet.getRange(row, col).setValue(fileUrl)`.

---

## 4. Cấu trúc thư mục bổ sung trong dự án
```text
c:\Users\benhhc\Desktop\web-supabase\
├── cloudflare-r2/
│   ├── worker.js            # Mã nguồn Cloudflare Worker API
│   ├── wrangler.toml        # File cấu hình Wrangler CLI
│   └── README.md            # Hướng dẫn chi tiết triển khai từng bước
├── assets/js/5s/hse.js      # File xử lý chính đã tích hợp R2
└── public/assets/js/5s/     # Đồng bộ sang bản phân phối
```

---

## 5. Kế hoạch xác thực (Verification Plan)
1. **Kiểm tra Cloudflare Worker**:
   - Gửi yêu cầu OPTIONS đảm bảo đầy đủ CORS headers.
   - Upload file ảnh thử nghiệm qua `POST /upload` và kiểm tra phản hồi trả về link truy cập hợp lệ.
2. **Kiểm tra hiển thị**:
   - Kiểm tra hiển thị cả ảnh cũ (Google Drive) và ảnh mới (Cloudflare R2) trên Gallery.
   - Kiểm tra mở ảnh qua Modal Lightbox phóng to.
3. **Kiểm tra tải lên & ghi nhận Sheet**:
   - Thử nghiệm tải ảnh mới vào mục "Ảnh vệ sinh" và kiểm tra Google Sheet được cập nhật dòng mới có URL R2.
   - Thử nghiệm tải ảnh Before/After vào bảng "Khắc phục 5S" và kiểm tra ô được cập nhật.
4. **Kiểm tra xóa**:
   - Thử nghiệm xóa ảnh và xác nhận tệp bị xóa trên R2 đồng thời hàng/ô trong Sheet được làm sạch.
