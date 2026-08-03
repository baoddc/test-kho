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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bật Row Level Security (RLS) để CHẶN F12 đọc trực tiếp bảng users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- (Không tạo policy SELECT public -> Mặc định gõ supabase.from('users').select() sẽ bị trả về rỗng)

-- 3. Tạo hàm RPC check_login (Chạy 100% trên Server Supabase)
-- Trả về duy nhất các cột quyền hạn & thông tin user. KHÔNG TRẢ VỀ MẬT KHẨU!
CREATE OR REPLACE FUNCTION public.check_login(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    username TEXT,
    email TEXT,
    require_otp BOOLEAN,
    can_add BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_view BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Thực thi với quyền Admin của Server để bỏ qua RLS
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.username,
        u.email,
        u.require_otp,
        u.can_add,
        u.can_edit,
        u.can_delete,
        u.can_view
    FROM public.users u
    WHERE u.username = p_username 
      AND u.password = p_password;
END;
$$;

-- 4. Chèn dữ liệu người dùng ban đầu
INSERT INTO public.users 
    (username, password, email, require_otp, can_add, can_edit, can_delete, can_view)
VALUES 
    ('bao.lt', '6697@', 'thaibao06061997@gmail.com', TRUE, TRUE, TRUE, TRUE, TRUE),
    ('admin', 'admin123', NULL, FALSE, FALSE, FALSE, FALSE, TRUE),
    ('user1', 'pass123', NULL, FALSE, FALSE, FALSE, FALSE, TRUE),
    ('user2', 'pass456', NULL, FALSE, FALSE, FALSE, FALSE, TRUE)
ON CONFLICT (username) 
DO UPDATE SET 
    password = EXCLUDED.password,
    email = EXCLUDED.email,
    require_otp = EXCLUDED.require_otp,
    can_add = EXCLUDED.can_add,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_view = EXCLUDED.can_view;
