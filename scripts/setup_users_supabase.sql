-- =============================================================================
-- SUPABASE USERS & AUTHENTICATION SETUP SCRIPT (CHỐNG F12 LỘ MẬT KHẨU)
-- Hướng dẫn: Chép toàn bộ script này và dán vào SQL Editor trên Supabase Dashboard.
-- =============================================================================

-- 1. Tạo bảng users
CREATE TABLE IF NOT EXISTS public.users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    require_otp BOOLEAN DEFAULT FALSE,
    can_add BOOLEAN DEFAULT FALSE,    -- Quyền Thêm dữ liệu
    can_edit BOOLEAN DEFAULT FALSE,   -- Quyền Sửa dữ liệu
    can_delete BOOLEAN DEFAULT FALSE, -- Quyền Xóa dữ liệu
    can_view BOOLEAN DEFAULT TRUE,    -- Quyền Xem dữ liệu
    allowed_pages JSONB DEFAULT '[]'::jsonb, -- Quyền truy cập các file HTML
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm cột allowed_pages nếu bảng đã tồn tại từ trước
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS allowed_pages JSONB DEFAULT '[]'::jsonb;

-- 2. Bật Row Level Security (RLS) để CHẶN F12 đọc trực tiếp bảng users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- (Không tạo policy SELECT public -> Mặc định gõ supabase.from('users').select() sẽ bị trả về rỗng)

-- 3. Tạo hàm RPC check_login (Chạy 100% trên Server Supabase)
-- Trả về duy nhất các cột quyền hạn & thông tin user. KHÔNG TRẢ VỀ MẬT KHẨU!
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DROP FUNCTION IF EXISTS public.check_login(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.check_login(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    username TEXT,
    email TEXT,
    require_otp BOOLEAN,
    can_add BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_view BOOLEAN,
    allowed_pages JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Thực thi với quyền Admin của Server để bỏ qua RLS
SET search_path = public, extensions
AS $$
BEGIN
    -- Mật khẩu được lưu dạng bcrypt (xem scripts/fix_security_vulnerabilities_2026-10-15.sql)
    RETURN QUERY
    SELECT 
        u.username,
        u.email,
        u.require_otp,
        u.can_add,
        u.can_edit,
        u.can_delete,
        u.can_view,
        u.allowed_pages
    FROM public.users u
    WHERE u.username = p_username 
      AND u.password = extensions.crypt(p_password, u.password);
END;
$$;

-- 4. Dữ liệu người dùng ban đầu
-- BẢO MẬT: KHÔNG lưu mật khẩu mẫu trong mã nguồn. Tạo người dùng qua trang
-- Quản lý người dùng (RPC admin_save_user) — mật khẩu sẽ được băm bcrypt tự động.
