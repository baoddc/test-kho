-- =============================================================================
-- CHẶN USERNAME TRÙNG KHÁC HOA/THƯỜNG + ĐỊNH DẠNG USERNAME (2026-10-15)
--
-- Lỗi: email nội bộ = lower(username) || '@noemail.baoddc.com'. Bảng public.users
-- chỉ UNIQUE(username) phân biệt hoa/thường, nên tạo user "Admin" khi đã có
-- "admin" => cả hai trỏ về CÙNG tài khoản Supabase Auth: mật khẩu và quyền của
-- "admin" bị ghi đè; xóa "Admin" thì "admin" mất luôn tài khoản.
-- Username có dấu cách / tiếng Việt có dấu => email không hợp lệ => không đăng nhập được.
--
-- An toàn để chạy: 3 username hiện có (bao.lt, admin, vuong.pm) đều hợp lệ.
-- =============================================================================

-- 1. Không cho trùng username khác hoa/thường
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON public.users (LOWER(username));

-- 2. Username chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang (2-50 ký tự)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_username_format;
ALTER TABLE public.users ADD CONSTRAINT users_username_format
    CHECK (username ~ '^[A-Za-z0-9._-]{2,50}$');

-- 3. admin_save_user: báo lỗi dễ hiểu thay vì lỗi ràng buộc thô
--    (giữ nguyên toàn bộ logic cũ, chỉ thêm 2 kiểm tra khi TẠO MỚI)
CREATE OR REPLACE FUNCTION public.admin_save_user(
    p_id bigint DEFAULT NULL::bigint,
    p_username text DEFAULT NULL::text,
    p_password text DEFAULT NULL::text,
    p_email text DEFAULT NULL::text,
    p_require_otp boolean DEFAULT false,
    p_can_add boolean DEFAULT false,
    p_can_edit boolean DEFAULT false,
    p_can_delete boolean DEFAULT false,
    p_can_view boolean DEFAULT true,
    p_allowed_pages jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
    -- Kiểm tra quyền Admin bảo mật từ Database
    IF public.is_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Quản trị viên mới có quyền tạo hoặc sửa người dùng!';
    END IF;

    -- Thêm mới người dùng
    IF p_id IS NULL OR p_id = 0 THEN
        IF p_username IS NULL OR p_username = '' THEN
            RETURN QUERY SELECT FALSE, 'Tên đăng nhập không được để trống!';
            RETURN;
        END IF;

        IF p_username !~ '^[A-Za-z0-9._-]{2,50}$' THEN
            RETURN QUERY SELECT FALSE, 'Tên đăng nhập chỉ gồm chữ KHÔNG dấu, số, dấu chấm (.), gạch dưới (_), gạch ngang (-), dài 2-50 ký tự. Ví dụ: nguyen.van.a';
            RETURN;
        END IF;

        IF p_password IS NULL OR p_password = '' THEN
            RETURN QUERY SELECT FALSE, 'Mật khẩu không được để trống khi tạo mới!';
            RETURN;
        END IF;

        IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(p_username)) THEN
            RETURN QUERY SELECT FALSE, 'Tên đăng nhập đã tồn tại (không phân biệt chữ hoa/thường)!';
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
$function$;

-- Kiểm tra
SELECT
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_username_lower_key') AS has_lower_unique_index,
    (SELECT COUNT(*) FROM pg_constraint WHERE conname = 'users_username_format') AS has_format_check,
    (SELECT string_agg(username, ', ') FROM public.users) AS usernames;
