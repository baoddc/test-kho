# Hướng Dẫn Thiết Lập Cloudflare R2 & Worker Cho Module HSE

Tài liệu này hướng dẫn chi tiết cách thiết lập Cloudflare Worker để kết nối với Cloudflare R2 Bucket đã tạo và tích hợp với hệ thống HSE.

---

## Cách 1: Triển khai nhanh qua Cloudflare Dashboard (Khuyên dùng - Không cần cài đặt gì)

### Bước 1: Tạo Worker
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Ở thanh menu bên trái, chọn **Workers & Pages** > Nhấp nút **Create Application** (hoặc **Create Worker**).
3. Đặt tên cho Worker (ví dụ: `hse-r2-api`) > Nhấp **Deploy**.
4. Sau khi deploy xong, nhấp vào nút **Edit code**.
5. Xóa toàn bộ nội dung mặc định, mở file [worker.js](file:///c:/Users/benhhc/Desktop/web-supabase/cloudflare-r2/worker.js) trong thư mục này, **sao chép toàn bộ nội dung và dán vào**.
6. Nhấp **Save and deploy**.

### Bước 2: Kết nối Worker với R2 Bucket (Binding)
1. Quay lại trang quản lý Worker `hse-r2-api`.
2. Chọn tab **Settings** > nhấp vào mục **Bindings** (hoặc **Variables & Bindings**).
3. Cuộn xuống phần **R2 Bucket Bindings** > Nhấp **Add binding**.
4. Điền các thông tin:
   - **Variable name**: Nhập chính xác là `HSE_BUCKET` (viết hoa).
   - **R2 bucket**: Chọn tên Bucket R2 mà bạn đã tạo sẵn trên Cloudflare.
5. Nhấp **Save and deploy**.

### Bước 3: (Tùy chọn) Bật Public Access hoặc Custom Domain cho R2
- **Trường hợp A (Đơn giản nhất - Không cần làm gì thêm)**:
  Worker đã tích hợp sẵn tính năng tự phục vụ ảnh qua đường dẫn `/file/*`. Bạn không cần cấu hình thêm gì.
- **Trường hợp B (Muốn dùng subdomain R2.dev hoặc Tên miền riêng)**:
  1. Vào menu **R2** > chọn Bucket của bạn > vào tab **Settings**.
  2. Tại mục **Public Development Subdomain**, nhấp **Enable** (sẽ sinh ra link dạng `https://pub-xxxx.r2.dev`).
  3. Quay lại Worker `hse-r2-api` > **Settings** > **Variables** > **Add variable**:
     - Variable name: `PUBLIC_URL`
     - Value: `https://pub-xxxx.r2.dev` (hoặc tên miền riêng của bạn)
  4. Nhấp **Save and deploy**.

### Bước 4: Lấy URL Worker điền vào Web HSE
1. Tại trang chi tiết của Worker, sao chép địa chỉ Worker URL (dạng `https://hse-r2-api.<ten-subdomain-cua-ban>.workers.dev`).
2. Mở file [assets/js/5s/hse.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/5s/hse.js).
3. Tìm đến dòng cấu hình `CONFIG`:
   ```javascript
   const CONFIG = {
       ...
       R2_WORKER_URL: 'https://hse-r2-api.<ten-subdomain-cua-ban>.workers.dev', // <-- Dán URL Worker tại đây
       ...
   };
   ```

---

## Cách 2: Triển khai bằng Wrangler CLI (Dành cho lập trình viên)

1. Cài đặt Wrangler nếu chưa có:
   ```bash
   npm install -g wrangler
   ```
2. Đăng nhập Cloudflare:
   ```bash
   wrangler login
   ```
3. Mở file `wrangler.toml` và điền tên bucket thực tế vào `bucket_name`.
4. Deploy Worker:
   ```bash
   cd cloudflare-r2
   wrangler deploy
   ```
