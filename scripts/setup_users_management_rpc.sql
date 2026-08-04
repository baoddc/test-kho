-- =============================================================================
-- SUPABASE USER MANAGEMENT RPC FUNCTIONS
-- Hướng dẫn: Chạy script này trong SQL Editor của Supabase Dashboard
-- =============================================================================

-- 1. Hàm lấy danh sách tất cả người dùng (KHÔNG lấy password)
DROP FUNCTION IF EXISTS public.admin_get_users();
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
    id BIGINT,
    username TEXT,
    email TEXT,
    require_otp BOOLEAN,
    can_add BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_view BOOLEAN,
    allowed_pages JSONB,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.username,
        u.email,
        u.require_otp,
        u.can_add,
        u.can_edit,
        u.can_delete,
        u.can_view,
        u.allowed_pages,
        u.created_at
    FROM public.users u
    ORDER BY u.id ASC;
END;
$$;

-- 2. Hàm Thêm mới hoặc Cập nhật thông tin & phân quyền người dùng
DROP FUNCTION IF EXISTS public.admin_save_user(BIGINT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_save_user(BIGINT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, JSONB);
CREATE OR REPLACE FUNCTION public.admin_save_user(
    p_id BIGINT DEFAULT NULL,
    p_username TEXT DEFAULT NULL,
    p_password TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_require_otp BOOLEAN DEFAULT FALSE,
    p_can_add BOOLEAN DEFAULT FALSE,
    p_can_edit BOOLEAN DEFAULT FALSE,
    p_can_delete BOOLEAN DEFAULT FALSE,
    p_can_view BOOLEAN DEFAULT TRUE,
    p_allowed_pages JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Thêm mới người dùng
    IF p_id IS NULL OR p_id = 0 THEN
        IF p_username IS NULL OR p_username = '' THEN
            RETURN QUERY SELECT FALSE, 'Tên đăng nhập không được để trống!';
            RETURN;
        END IF;

        IF p_password IS NULL OR p_password = '' THEN
            RETURN QUERY SELECT FALSE, 'Mật khẩu không được để trống khi tạo mới!';
            RETURN;
        END IF;

        IF EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
            RETURN QUERY SELECT FALSE, 'Tên đăng nhập đã tồn tại!';
            RETURN;
        END IF;

        INSERT INTO public.users (
            username, password, email, require_otp, can_add, can_edit, can_delete, can_view, allowed_pages
        ) VALUES (
            p_username, p_password, p_email, p_require_otp, p_can_add, p_can_edit, p_can_delete, p_can_view, COALESCE(p_allowed_pages, '[]'::jsonb)
        );

        RETURN QUERY SELECT TRUE, 'Tạo người dùng mới thành công!';
        RETURN;
    ELSE
        -- Cập nhật người dùng đã có
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_id) THEN
            RETURN QUERY SELECT FALSE, 'Không tìm thấy người dùng cần cập nhật!';
            RETURN;
        END IF;

        -- Nếu truyền p_password thì đổi pass, ngược lại giữ nguyên
        IF p_password IS NOT NULL AND p_password <> '' THEN
            UPDATE public.users SET
                password = p_password,
                email = p_email,
                require_otp = p_require_otp,
                can_add = p_can_add,
                can_edit = p_can_edit,
                can_delete = p_can_delete,
                can_view = p_can_view,
                allowed_pages = COALESCE(p_allowed_pages, '[]'::jsonb)
            WHERE id = p_id;
        ELSE
            UPDATE public.users SET
                email = p_email,
                require_otp = p_require_otp,
                can_add = p_can_add,
                can_edit = p_can_edit,
                can_delete = p_can_delete,
                can_view = p_can_view,
                allowed_pages = COALESCE(p_allowed_pages, '[]'::jsonb)
            WHERE id = p_id;
        END IF;

        RETURN QUERY SELECT TRUE, 'Cập nhật thông tin người dùng thành công!';
        RETURN;
    END IF;
END;
$$;

-- 3. Hàm Xóa người dùng an toàn (Ngăn xóa tài khoản bao.lt)
CREATE OR REPLACE FUNCTION public.admin_delete_user(
    p_user_id BIGINT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_username TEXT;
BEGIN
    SELECT username INTO v_username FROM public.users WHERE id = p_user_id;

    IF v_username IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Không tìm thấy người dùng cần xóa!';
        RETURN;
    END IF;

    IF v_username = 'bao.lt' THEN
        RETURN QUERY SELECT FALSE, 'Không thể xóa tài khoản Quản trị viên hệ thống (bao.lt)!';
        RETURN;
    END IF;

    DELETE FROM public.users WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, 'Đã xóa người dùng thành công!';
    RETURN;
END;
$$;
