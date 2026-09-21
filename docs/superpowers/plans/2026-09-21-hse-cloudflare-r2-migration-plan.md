# HSE Cloudflare R2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn bộ cơ chế lưu trữ hình ảnh của module HSE (`hse.html`, `hse.js`) sang Cloudflare R2 thông qua Cloudflare Worker API, giữ nguyên việc đồng bộ dữ liệu với Google Sheets.

**Architecture:** Tạo Cloudflare Worker API trung gian nhận tải ảnh trực tiếp từ trình duyệt và lưu vào Cloudflare R2 Bucket. Trình duyệt nhận URL ảnh CDN từ Worker và gọi Google Apps Script để ghi nhận link vào Google Sheets. Trình duyệt tự động nhận diện và hiển thị song song ảnh cũ từ Drive và ảnh mới từ R2.

**Tech Stack:** JavaScript (ES6+), Cloudflare Workers (Fetch API, R2 Bucket API), Google Apps Script, Google Sheets CSV.

## Global Constraints
- Bảo toàn 100% khả năng hiển thị các ảnh cũ hiện đang lưu link Google Drive.
- Không phá vỡ cấu trúc cột của Google Sheets (cột URL ảnh giữ nguyên vị trí).
- Worker phải hỗ trợ CORS đầy đủ (`*`) cho phép gọi trực tiếp từ domain triển khai (Vercel/Localhost).

---

### Task 1: Tạo mã nguồn Cloudflare Worker API và cấu hình triển khai

**Files:**
- Create: `cloudflare-r2/worker.js`
- Create: `cloudflare-r2/wrangler.toml`
- Create: `cloudflare-r2/README.md`

**Interfaces:**
- Produces:
  - `OPTIONS /*`: Trả về CORS headers (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: *`).
  - `POST /upload`: Nhận `multipart/form-data` gồm `file` và `folder`. Trả về `{ status: "success", fileUrl: string, key: string, size: number, mimeType: string }`.
  - `POST /delete`: Nhận JSON `{ key?: string, fileUrl?: string }`. Trả về `{ status: "success", message: string }`.
  - `GET /file/*`: Trả về nội dung tệp nhị phân từ R2 bucket với header `Cache-Control`.

- [ ] **Step 1: Tạo file `cloudflare-r2/worker.js`**
Triển khai toàn bộ logic xử lý request, CORS, upload lên R2 bucket binding `HSE_BUCKET`, xóa tệp và phục vụ tệp trực tiếp.

- [ ] **Step 2: Tạo file `cloudflare-r2/wrangler.toml`**
Cấu hình mẫu cho Wrangler CLI nếu người dùng muốn deploy bằng dòng lệnh hoặc CI/CD.

- [ ] **Step 3: Tạo file `cloudflare-r2/README.md`**
Hướng dẫn chi tiết từng bước:
1. Copy code vào Cloudflare Dashboard (Workers & Pages).
2. Thiết lập R2 Bucket Binding tên `HSE_BUCKET`.
3. Cấu hình biến `PUBLIC_URL` hoặc sử dụng Worker URL trực tiếp.
4. Lấy URL Worker dán vào `hse.js`.

- [ ] **Step 4: Kiểm tra cú pháp mã Worker**
Chạy kiểm tra cú pháp node để đảm bảo `worker.js` không có lỗi cú pháp Javascript.

- [ ] **Step 5: Commit Task 1**
```bash
git add cloudflare-r2/
git commit -m "feat(r2): add cloudflare worker api and configuration for r2 storage"
```

---

### Task 2: Tạo đoạn mã cập nhật Google Apps Script

**Files:**
- Create: `cloudflare-r2/google-apps-script-snippet.gs`

**Interfaces:**
- Produces:
  - Hàm xử lý `recordImageRow`: nhận `sheetName`, `fileName`, `fileUrl`, `date` -> ghi dòng mới `[fileName, date, fileUrl, '']`.
  - Hàm xử lý `recordImageCell`: nhận `sheetName`, `row`, `column`, `fileUrl` -> cập nhật ô tương ứng.

- [ ] **Step 1: Tạo file `cloudflare-r2/google-apps-script-snippet.gs`**
Viết đoạn mã Apps Script tối ưu, nhận payload JSON hoặc form-data gọn nhẹ không chứa Base64, ghi trực tiếp vào Google Sheets trong < 500ms.

- [ ] **Step 2: Commit Task 2**
```bash
git add cloudflare-r2/google-apps-script-snippet.gs
git commit -m "feat(gas): add lightweight google apps script snippet for r2 url recording"
```

---

### Task 3: Cập nhật mã nguồn Client (`assets/js/5s/hse.js`)

**Files:**
- Modify: `assets/js/5s/hse.js`
- Modify: `public/assets/js/5s/hse.js`

**Interfaces:**
- Consumes:
  - Worker API `POST /upload`, `POST /delete`.
  - Google Apps Script `recordImageRow`, `recordImageCell`.

- [ ] **Step 1: Cập nhật `CONFIG` trong `assets/js/5s/hse.js`**
Thêm trường `R2_WORKER_URL: ''` và cấu hình mặc định.

- [ ] **Step 2: Cập nhật hàm xử lý hiển thị ảnh**
  - Trong `generateGalleryItemHtml(row, moduleId)`: Kiểm tra nếu là link Google Drive thì dùng thumbnail, ngược lại nếu là link R2/CDN thì dùng trực tiếp `originalUrl`.
  - Trong `renderTable(data)`: Cột ảnh kiểm tra tương tự để tạo thumbnail hiển thị tối ưu.
  - Trong `openImageLightbox(imageUrl)`: Hỗ trợ hiển thị ảnh gốc R2 trực tiếp với chất lượng tối đa.

- [ ] **Step 3: Cập nhật hàm `handleImageUpload(event, moduleId)`**
  - Kiểm tra `CONFIG.R2_WORKER_URL`. Nếu chưa cấu hình, cảnh báo hướng dẫn người dùng điền URL.
  - Hiển thị preview ngay lập tức bằng `URL.createObjectURL(file)`.
  - Gửi `POST /upload` tới Cloudflare Worker.
  - Khi có `fileUrl`, gửi tiếp tới `CONFIG.APPS_SCRIPT_URL_HSE` với action `recordImageRow`.
  - Cập nhật giao diện thành công.

- [ ] **Step 4: Cập nhật hàm `handleTableCellUpload(event)`**
  - Tương tự, tải ảnh lên Cloudflare Worker trước.
  - Sau đó gọi Google Apps Script cập nhật ô với action `recordImageCell`.

- [ ] **Step 5: Cập nhật hàm `deleteImage` và `deleteTableCellImage`**
  - Nếu ảnh thuộc Cloudflare R2, gọi Worker `POST /delete` để giải phóng dung lượng.
  - Đồng thời gọi Google Apps Script để xóa dữ liệu trong Sheet.

- [ ] **Step 6: Đồng bộ sang `public/assets/js/5s/hse.js`**
Sao chép nội dung mới sang thư mục phân phối `public/assets/js/5s/hse.js`.

- [ ] **Step 7: Commit Task 3**
```bash
git add assets/js/5s/hse.js public/assets/js/5s/hse.js
git commit -m "feat(hse): integrate cloudflare r2 upload and direct cdn rendering in hse.js"
```

---

### Task 4: Kiểm thử và xác thực toàn diện

**Files:**
- Verification only

- [ ] **Step 1: Kiểm tra tính toàn vẹn cú pháp JS của `hse.js`**
Kiểm tra cú pháp node không có lỗi cú pháp.

- [ ] **Step 2: Kiểm tra tương thích hiển thị ảnh Drive và R2**
Tạo kịch bản test kiểm tra regex và hàm xử lý URL đảm bảo cả link Drive cũ và link R2 mới đều render đúng markup `<img>`.

- [ ] **Step 3: Commit hoàn tất**
```bash
git status
```
