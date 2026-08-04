# Design Spec: Pure Supabase Authentication (Remove Hardcoded JS Credentials)

## 1. Overview
Remove all hardcoded user accounts and credentials (`validAccounts`) from frontend JavaScript files (`assets/js/dang_nhap.js` and `dist-app/assets/js/dang_nhap.js`). Authenticate users exclusively via Supabase RPC function (`check_login`), ensuring zero sensitive credentials reside on the client side.

## 2. Architecture & Data Flow

```
[User Input: Username & Password]
         │
         ▼
[Frontend: dang_nhap.js]
         │
         ▼ (RPC call: check_login)
[Supabase Server (SECURITY DEFINER)]
         │
         ├── Checks username & password against public.users table
         │
         ▼
[Returns: User info & permissions (NO PASSWORD)]
         │
         ├── Success (with require_otp = true)  ──► Trigger Email OTP
         ├── Success (with require_otp = false) ──► Complete Login
         └── Failure / Not Found               ──► Display Error Message
```

## 3. Detailed Changes

### 3.1 Frontend `assets/js/dang_nhap.js` & `dist-app/assets/js/dang_nhap.js`
- **Delete Hardcoded Accounts:** Remove `const validAccounts = [...]`.
- **Remove Fallback Auth:** Delete local array match fallback (`validAccounts.find(...)`).
- **Refactor `completeLogin` & Storage Policy:**
  - `localStorage` only stores `currentUser` (username string) and `userPermissions` (permissions object).
  - Absolutely **NO password** or hashed credential is saved to `localStorage`, `sessionStorage`, or cookies upon successful login.

  1. Validate that input username & password are non-empty.
  2. Call `window.supabase.rpc('check_login', { p_username, p_password })`.
  3. If Supabase returns user row:
     - Map fields (`username`, `email`, `requireOtp`, `permissions`).
     - Proceed to OTP verification if `requireOtp` is true, or call `completeLogin`.
  4. If RPC returns empty array or error:
     - Display: `"Tên đăng nhập hoặc mật khẩu không chính xác."`
  5. If `window.supabase` is unavailable or throws network exception:
     - Display: `"Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra lại kết nối mạng hoặc cấu hình."`

### 3.2 Database & Server SQL (`scripts/setup_users_supabase.sql`)
- Verified that `scripts/setup_users_supabase.sql` contains `public.users` table schema and `public.check_login` RPC function.
- No changes required to SQL script; documentation notes that this SQL script must be executed on Supabase Dashboard SQL Editor if not already created.

## 4. Verification & Testing Strategy
1. **Source Code Inspection:**
   - Verify `validAccounts` or any plain-text passwords do NOT exist in any `.js` files.
2. **Behavioral Testing:**
   - Test login with valid credentials existing in Supabase database.
   - Test login with invalid credentials -> observe error message.
   - Test login when network/Supabase client fails -> observe user-friendly error message.
