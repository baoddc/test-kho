# Tài Liệu Đặc Tả Thiết Kế: Nâng Cấp Bảo Mật Toàn Diện Hệ Thống API & Cơ Sở Dữ Liệu

- **Dự án**: Hệ thống Quản lý Kho Phôi Cuộn - DDC (web-supabase)
- **Ngày lập**: 2026-09-05
- **Trạng thái**: Đã phê duyệt (Approved)
- **Tác giả**: Antigravity & User

---

## 1. Mục Tiêu & Phạm Vi (Goals & Scope)

### 1.1 Vấn đề cần giải quyết
Hệ thống hiện tại gặp phải 6 lỗ hổng bảo mật cốt lõi:
1. **Lộ API Key Google Gemini**: API Key Vision AI bị mã hóa XOR đơn giản trong `receipt-ocr-service.js` và gửi qua URL query parameters trên trình duyệt, dễ dàng bị trích xuất qua F12 Console / Network tab.
2. **Phân quyền dựa vào `localStorage`**: Thông tin người dùng (`currentUser`) và nhóm quyền (`userPermissions`) lưu trong bộ nhớ trình duyệt, người dùng có thể giả mạo bằng cách gõ `localStorage.setItem('currentUser', 'bao.lt')` để mở khóa toàn bộ quyền Admin.
3. **Thiếu Row Level Security (RLS)**: Các bảng `xg-xuat`, `tole-xuat`, `inventory_locks` mở quyền thao tác công khai cho Anon Key.
4. **RPC Functions thiếu kiểm tra danh tính**: Các hàm `admin_get_users`, `admin_save_user`, `xuat_xg_atomic` chạy với quyền `SECURITY DEFINER` nhưng không kiểm tra token/vai trò của người gọi.
5. **Mật khẩu người dùng lưu plain text**: Bảng `users` cũ lưu mật khẩu không băm, kiểm tra đăng nhập qua so sánh chuỗi thô.
6. **Fallback mất tính toàn vẹn (ACID)**: Khi RPC `xuat_xg_atomic` hoặc `xuat_tole_atomic` gặp sự cố, code JavaScript tự ý gọi `supabase.from(...).insert(...)`, bỏ qua toàn bộ kiểm tra khóa và tồn kho.

### 1.2 Mục tiêu đạt được
- **Bảo mật tuyệt đối Google AI API Key**: Chuyển việc gọi Gemini Vision AI sang Supabase Edge Function (`ocr-receipt`), API Key được lưu trong Secrets của Supabase.
- **Xác thực chuẩn Supabase Auth**: Sử dụng cơ chế tài khoản chính thức của Supabase với JWT Session Token, tự động băm mật khẩu chuẩn bcrypt/argon2, hỗ trợ Email OTP qua server.
- **Phân quyền phía Server (Database RLS & Profiles)**: Tạo bảng `public.user_profiles` liên kết `auth.users(id)`. Quy tắc khóa 24h và phân quyền thêm/sửa/xóa được áp dụng trực tiếp qua PostgreSQL Row Level Security Policies.
- **Gia cố RPC Functions**: Lấy danh tính người dùng trực tiếp từ JWT Token (`auth.uid()`), kiểm tra quyền Admin trước khi cho phép quản trị user, thu hồi quyền từ role `anon`.
- **Bảo toàn giao dịch kho (Strict ACID)**: Loại bỏ các fallback gọi direct insert trong JavaScript, đảm bảo mọi giao dịch xuất kho đều phải qua RPC nguyên tử.

---

## 2. Kiến Trúc Kỹ Thuật (Technical Architecture)

```
[ Client Browser / Android App ]
      │
      ├── (1) Đăng nhập & Xác thực OTP ──► Supabase Auth (JWT Token)
      │
      ├── (2) Quét OCR Phiếu Xuất ───────► Supabase Edge Function (ocr-receipt)
      │                                             │
      │                                             ▼ [Secret GEMINI_API_KEY]
      │                                    Google Gemini Vision API
      │
      └── (3) Thao tác Dữ liệu & Khóa ───► Supabase Database (PostgreSQL)
                                                    │
                                                    ▼
                                           [RLS Policies & RPC]
                                           - auth.uid() check
                                           - 24h Lock Enforcement
                                           - Atomic Concurrency Validation
```

---

## 3. Chi Tiết Các Hạng Mục Thực Hiện

### 3.1 Hạng Mục 1: Supabase Edge Function cho OCR Receipt
- **Tập tin**: `supabase/functions/ocr-receipt/index.ts`
- **Cấu hình Secrets**: `GEMINI_API_KEY` được thêm vào Supabase Project Secrets.
- **Chức năng**:
  - Nhận payload JSON `{ base64Data, mimeType }` từ client.
  - Kiểm tra Authorization Header (chỉ cho phép request từ người dùng hợp lệ).
  - Gọi Gemini Vision API (`models/gemini-2.5-flash:generateContent`, luân chuyển model tự động nếu quá hạn mức).
  - Trả về cấu trúc JSON đã chuẩn hóa: `{ ngayXuat, phieuXuat, maChungTu, loaiXuat, maCongTrinh, tenCongTrinh, items: [...] }`.
- **Frontend ([`receipt-ocr-service.js`](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/core/receipt-ocr-service.js))**:
  - Gỡ bỏ hoàn toàn `_SEC_DATA`, `_getEmbeddedKey()`, và các lệnh gọi trực tiếp đến `googleapis.com`.
  - Thay thế bằng `supabase.functions.invoke('ocr-receipt', { body: { base64Data, mimeType } })`.

### 3.2 Hạng Mục 2: Supabase Auth & Hồ Sơ Phân Quyền
- **Tạo bảng `public.user_profiles`**:
  ```sql
  CREATE TABLE public.user_profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      is_admin BOOLEAN DEFAULT FALSE,
      can_add BOOLEAN DEFAULT FALSE,
      can_edit BOOLEAN DEFAULT FALSE,
      can_delete BOOLEAN DEFAULT FALSE,
      can_view BOOLEAN DEFAULT TRUE,
      allowed_pages JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- **Migration dữ liệu người dùng**:
  - Di chuyển các tài khoản hiện có (`bao.lt`, `admin`, `user1`, `user2`) vào `auth.users` và thiết lập hồ sơ trong `public.user_profiles`.
- **Cập nhật giao diện Đăng nhập ([`dang_nhap.js`](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/dang_nhap.js))**:
  - Sử dụng `supabase.auth.signInWithPassword({ email, password })`.
  - Quản lý phiên làm việc bằng `supabase.auth.getSession()` và `onAuthStateChange`.
  - Loại bỏ biến `currentGeneratedOtp` client-side và Toast demo OTP.

### 3.3 Hạng Mục 3: Row Level Security (RLS) & Khóa 24h
- **Bật RLS**:
  ```sql
  ALTER TABLE public."xg-xuat" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."tole-xuat" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."xg-nhap" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."tole-nhap" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.inventory_locks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
  ```
- **Chính sách SELECT**:
  - Chỉ cho phép người dùng đã xác thực (`auth.role() = 'authenticated'`).
- **Chính sách UPDATE & DELETE (Bảo vệ quy tắc 24h trên Database)**:
  ```sql
  CREATE POLICY "xg_xuat_update_policy" ON public."xg-xuat"
  FOR UPDATE TO authenticated
  USING (
      -- Admin luôn được phép
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
      OR
      -- Người dùng thường chỉ được sửa trong vòng 24h và có quyền can_edit
      (
          EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND can_edit = true)
          AND (created_at > NOW() - INTERVAL '24 hours')
      )
  );
  ```
- Tương tự với thao tác `DELETE` và áp dụng cho cả bảng `tole-xuat`.

### 3.4 Hạng Mục 4: Gia Cố RPC Functions
- **`xuat_xg_atomic` & `xuat_tole_atomic`**:
  - Sử dụng `COALESCE(auth.jwt() ->> 'email', p_user, 'authenticated_user')` làm người thao tác; kiểm tra người dùng phải đăng nhập.
- **`admin_get_users` & `admin_save_user`**:
  - Kiểm tra `is_admin` từ `user_profiles` của `auth.uid()`. Nếu không phải Admin, lập tức báo lỗi `403 Forbidden`.
  - `REVOKE EXECUTE ON FUNCTION admin_get_users FROM anon;`
  - `REVOKE EXECUTE ON FUNCTION admin_save_user FROM anon;`
- **Frontend ([`xg-xuat.js`](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat.js) & [`tole-xuat.js`](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-xuat.js))**:
  - Xóa bỏ đoạn mã fallback `supabase.from(TABLE_NAME).insert(...)`. Báo lỗi rõ ràng nếu RPC từ chối giao dịch.

---

## 4. Kế Hoạch Xác Minh & Kiểm Thử (Verification Plan)
1. **Kiểm tra rò rỉ API Key**:
   - Tìm kiếm toàn bộ codebase để đảm bảo không còn chuỗi `_SEC_DATA` hay API Key Google nào trong client JS.
   - Kiểm tra DevTools Network tab khi bấm quét ảnh OCR xem key có xuất hiện không.
2. **Kiểm tra Bypass qua DevTools F12**:
   - Thử chạy `localStorage.setItem('currentUser', 'bao.lt')` trên trình duyệt ở tài khoản thường rồi gửi request cập nhật/xóa bản ghi cũ > 24h. Xác nhận Database trả về lỗi từ chối của RLS.
3. **Kiểm tra gọi trái phép RPC Quản Trị**:
   - Thử gọi `supabase.rpc('admin_save_user', ...)` bằng Anon client. Xác nhận PostgreSQL từ chối với lỗi Permission Denied.
4. **Kiểm tra Tính Toàn Vẹn Xuất Kho (ACID)**:
   - Thử xuất cùng 1 mã cuộn 2 lần đồng thời để xác nhận RPC bắt lỗi xuất trùng và không có hành vi tự ý chèn thô vào database.
