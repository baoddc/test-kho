# Kế Hoạch Triển Khai: Nâng Cấp Bảo Mật Toàn Diện Hệ Thống API & Cơ Sở Dữ Liệu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để các lỗ hổng bảo mật: ẩn Gemini API Key qua Supabase Edge Function, nâng cấp cơ chế xác thực sang Supabase Auth (JWT), áp dụng Row Level Security (RLS) khóa 24h chống sửa/xóa qua F12, gia cố toàn bộ RPC Functions và loại bỏ fallback direct insert mất tính ACID.

**Architecture:** 
- Frontend gọi Supabase Edge Function `ocr-receipt` thay cho gọi trực tiếp Google AI, API Key được bảo vệ tuyệt đối trong Secrets server.
- Supabase Auth quản lý danh tính và phiên làm việc (JWT Token), liên kết với bảng hồ sơ phân quyền `public.user_profiles`.
- PostgreSQL RLS thực thi chính sách phân quyền và khóa 24h trên database, chặn truy cập ẩn danh (anon) trái phép.
- Các hàm RPC lấy danh tính từ `auth.uid()`, loại bỏ fallback direct insert trên client JavaScript.

**Tech Stack:** Supabase (Auth, PostgreSQL, RLS, Edge Functions Deno), Google Gemini Vision API, JavaScript (ES6+), HTML5, Bootstrap 5.

## Global Constraints
- Không được làm gián đoạn tính năng quét OCR phiếu xuất hiện tại.
- Giữ nguyên giao diện và trải nghiệm người dùng trên các trang `xg-xuat.html`, `tole-xuat.html`, `dang_nhap.html`.
- Tương thích 100% với cả môi trường Web (Vercel) và ứng dụng di động Android (Capacitor).

---

### Task 1: Xây dựng Supabase Edge Function `ocr-receipt` & Cập nhật `receipt-ocr-service.js`

**Files:**
- Create: `supabase/functions/ocr-receipt/index.ts`
- Modify: `assets/js/core/receipt-ocr-service.js`
- Test: `tests/test-ocr-edge-function.js`

**Interfaces:**
- Consumes: `{ base64Data: string, mimeType: string }` từ Client POST request.
- Produces: JSON chuẩn hóa:
  ```json
  {
    "success": true,
    "data": {
      "ngayXuat": "YYYY-MM-DD",
      "phieuXuat": "string",
      "maChungTu": "PX",
      "loaiXuat": "string",
      "maCongTrinh": "string",
      "tenCongTrinh": "string",
      "items": [{ "stt": 1, "maVatTu": "string", "tenVatTu": "string", "batch": "string" }],
      "ghiChu": ""
    }
  }
  ```

- [ ] **Step 1: Tạo mã nguồn Supabase Edge Function `supabase/functions/ocr-receipt/index.ts`**
  Edge Function đọc `Deno.env.get('GEMINI_API_KEY')`, nhận Base64 từ client, gọi Gemini REST API từ server và trả về kết quả JSON.
- [ ] **Step 2: Cập nhật `receipt-ocr-service.js`**
  Xóa bỏ mảng `_SEC_DATA` và hàm `_getEmbeddedKey()`.
  Chuyển hàm `callGeminiVision` sang gọi `window.supabase.functions.invoke('ocr-receipt', { body: { base64Data, mimeType } })`.
- [ ] **Step 3: Viết script kiểm thử mô phỏng request đến Edge Function**
- [ ] **Step 4: Commit thay đổi Task 1**
  ```bash
  git add supabase/functions/ocr-receipt/index.ts assets/js/core/receipt-ocr-service.js tests/test-ocr-edge-function.js
  git commit -m "feat(security): proxy gemini vision ocr through supabase edge function"
  ```

---

### Task 2: Script SQL Thiết Lập `public.user_profiles`, Supabase Auth & RLS Policies

**Files:**
- Create: `scripts/setup_security_hardening_rls.sql`
- Test: Chạy kiểm tra cú pháp trong SQL hoặc script kiểm tra schema.

**Interfaces:**
- Consumes: `auth.users(id)`
- Produces: 
  - Bảng `public.user_profiles` (id, username, email, is_admin, can_add, can_edit, can_delete, can_view, allowed_pages).
  - RLS Policies cho `xg-xuat`, `tole-xuat`, `xg-nhap`, `tole-nhap`, `inventory_locks`, `user_profiles`.

- [ ] **Step 1: Tạo bảng `public.user_profiles` và trigger đồng bộ tài khoản từ `auth.users`**
- [ ] **Step 2: Viết RLS Policies cho các bảng dữ liệu**:
  - `SELECT`: Cho phép `auth.role() = 'authenticated'`.
  - `UPDATE` / `DELETE`: Chỉ cho phép nếu `is_admin = true` HOẶC (`can_edit = true` / `can_delete = true` VÀ `created_at > NOW() - INTERVAL '24 hours'`).
  - Chặn hoàn toàn thao tác ghi từ role `anon`.
- [ ] **Step 3: Khóa bảng `inventory_locks`**:
  - Chỉ cho phép `auth.role() = 'authenticated'` được thao tác khóa.
- [ ] **Step 4: Commit thay đổi Task 2**
  ```bash
  git add scripts/setup_security_hardening_rls.sql
  git commit -m "feat(security): add user profiles schema and rls policies with 24h lock"
  ```

---

### Task 3: Gia Cố Bảo Mật Các RPC Functions

**Files:**
- Modify: `scripts/setup_acid_inventory_concurrency.sql`
- Modify: `scripts/setup_users_management_rpc.sql`

**Interfaces:**
- Consumes: Session token `auth.uid()`, `auth.jwt()`
- Produces: 
  - `xuat_xg_atomic(p_records JSONB)`: Lấy user từ `auth.jwt() ->> 'email'`.
  - `xuat_tole_atomic(p_records JSONB)`: Lấy user từ `auth.jwt() ->> 'email'`.
  - `admin_get_users()`: Kiểm tra `is_admin = true`, chặn nếu không phải admin.
  - `admin_save_user(...)`: Kiểm tra `is_admin = true`.

- [ ] **Step 1: Cập nhật `setup_acid_inventory_concurrency.sql`**
  Bảo vệ `acquire_inventory_lock`, `release_inventory_lock`, `xuat_xg_atomic`, `xuat_tole_atomic`. Xác thực người dùng qua JWT.
- [ ] **Step 2: Cập nhật `setup_users_management_rpc.sql`**
  Thêm kiểm tra quyền Admin từ `public.user_profiles` bên trong hàm, thu hồi quyền từ role `anon`.
- [ ] **Step 3: Commit thay đổi Task 3**
  ```bash
  git add scripts/setup_acid_inventory_concurrency.sql scripts/setup_users_management_rpc.sql
  git commit -m "feat(security): harden rpc functions with jwt authentication and admin checks"
  ```

---

### Task 4: Nâng Cấp Frontend Đăng Nhập & Cấu Hình Phiên Làm Việc

**Files:**
- Modify: `assets/js/dang_nhap.js`
- Modify: `assets/js/core/supabase-config.js`
- Modify: `pages/index.html`

**Interfaces:**
- Consumes: `supabase.auth.signInWithPassword`
- Produces: Phiên đăng nhập JWT an toàn, hàm `getUserPermissions()` truy vấn profile từ Supabase Auth session thay vì chỉ đọc `localStorage`.

- [ ] **Step 1: Cập nhật `supabase-config.js`**
  Hàm `getUserPermissions()` kiểm tra session hiện hành `supabase.auth.getSession()` và đọc profile đồng bộ an toàn.
- [ ] **Step 2: Cập nhật `dang_nhap.js`**
  Thay thế hàm `check_login` bằng `supabase.auth.signInWithPassword({ email, password })`.
  Lấy danh sách quyền từ `user_profiles`. Xóa bỏ logic sinh OTP ngẫu nhiên ở client và popup Toast demo.
- [ ] **Step 3: Commit thay đổi Task 4**
  ```bash
  git add assets/js/dang_nhap.js assets/js/core/supabase-config.js pages/index.html
  git commit -m "feat(security): migrate authentication to official supabase auth"
  ```

---

### Task 5: Loại Bỏ Fallback Direct Insert và Cập Nhật `xg-xuat.js` & `tole-xuat.js`

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`
- Modify: `assets/js/tole/tole-xuat.js`

**Interfaces:**
- Consumes: `supabase.rpc('xuat_xg_atomic')`, `supabase.rpc('xuat_tole_atomic')`
- Produces: Xử lý lỗi ACID nghiêm ngặt, loại bỏ hoàn toàn fallback sang direct insert.

- [ ] **Step 1: Chỉnh sửa `assets/js/xg/xg-xuat.js`**
  Gỡ bỏ hoàn toàn khối `if (rpcErr.message.includes(...)) { supabase.from(TABLE_NAME).insert(...) }`.
  Hiển thị thông báo lỗi chi tiết từ RPC nếu giao dịch thất bại.
- [ ] **Step 2: Chỉnh sửa `assets/js/tole/tole-xuat.js`**
  Tương tự `xg-xuat.js`, gỡ bỏ fallback direct insert.
- [ ] **Step 3: Commit thay đổi Task 5**
  ```bash
  git add assets/js/xg/xg-xuat.js assets/js/tole/tole-xuat.js
  git commit -m "fix(security): remove non-acid direct insert fallback in xuat pages"
  ```

---

### Task 6: Kiểm Thử Toàn Diện & Đánh Giá An Toàn (Verification)

**Files:**
- Create: `tests/verify-security-hardening.js`
- Test: Chạy kiểm thử tự động xác nhận các lỗ hổng đã được bịt kín.

- [ ] **Step 1: Kiểm tra rò rỉ API Key**
  Chạy lệnh grep tìm kiếm `_SEC_DATA` hoặc API key trên client JS. Kết quả mong đợi: 0 kết quả.
- [ ] **Step 2: Kiểm thử Bypass F12**
  Kiểm tra thao tác ghi khi không có Auth token. Kết quả mong đợi: Bị Database RLS từ chối.
- [ ] **Step 3: Kiểm thử RPC Quản Trị User**
  Gọi RPC `admin_save_user` mà không có quyền Admin. Kết quả mong đợi: PostgreSQL trả về ngoại lệ `Truy cập bị từ chối`.
- [ ] **Step 4: Commit thay đổi Task 6**
  ```bash
  git add tests/verify-security-hardening.js
  git commit -m "test(security): add comprehensive verification tests for hardened api"
  ```
