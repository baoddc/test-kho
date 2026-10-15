-- =============================================================================
-- VÁ LỖ HỔNG BẢO MẬT (2026-10-15)
-- Chạy trong Supabase Dashboard -> SQL Editor.
--
-- PHẦN A: AN TOÀN, NÊN CHẠY NGAY (không làm hỏng luồng đăng nhập hiện tại)
--   A1. is_admin() không còn trả TRUE cho người dùng ẩn danh (anon)
--   A2. Thu hồi quyền gọi các RPC quản trị từ anon
--   A3. Chặn leo thang quyền qua metadata "username = bao.lt" khi signUp
--   A4. Băm mật khẩu bảng public.users bằng bcrypt (pgcrypto)
--   A5. check_login so khớp bằng bcrypt + chống dò mật khẩu (brute-force)
--   A6. Cố định search_path cho các hàm SECURITY DEFINER
--
-- PHẦN B: KHÓA BẢNG DỮ LIỆU CHỈ CHO TÀI KHOẢN ĐÃ ĐĂNG NHẬP (authenticated)
--   ⚠️ Chỉ chạy khi TẤT CẢ người dùng đã đăng nhập qua Supabase Auth.
--   Tài khoản legacy (đăng nhập qua RPC check_login) sẽ không còn đọc/ghi
--   được dữ liệu. Script đồng bộ MB51 / backup phải dùng SERVICE_ROLE key.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =============================================================================
-- A1. is_admin(): anon KHÔNG BAO GIỜ là admin
--     Lỗ hổng cũ: COALESCE(..., auth.uid() IS NULL, ...) => mọi request bằng
--     anon key (công khai trong mã JS) đều được coi là Quản trị viên.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN auth.uid() IS NULL THEN FALSE
        ELSE COALESCE(
            (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()),
            (auth.jwt() ->> 'email') = 'thaibao06061997@gmail.com',
            FALSE
        )
    END;
$$;

-- =============================================================================
-- A2. Thu hồi quyền thực thi RPC quản trị từ anon / PUBLIC
-- =============================================================================
DO $$
DECLARE
    fn RECORD;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('admin_get_users', 'admin_save_user', 'admin_delete_user', 'is_admin')
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
    END LOOP;
END $$;

-- =============================================================================
-- A3. Trigger tạo hồ sơ: chỉ cấp admin theo EMAIL đã xác định,
--     KHÔNG dựa vào raw_user_meta_data (người dùng tự gửi lên khi signUp).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_username TEXT;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    -- Username luôn suy ra từ email (không tin metadata do client gửi)
    v_username := COALESCE(
        NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
        'user_' || SUBSTRING(NEW.id::TEXT, 1, 8)
    );

    IF NEW.email = 'thaibao06061997@gmail.com' THEN
        v_is_admin := TRUE;
        v_username := 'bao.lt';
    END IF;

    INSERT INTO public.user_profiles (
        id, username, email, is_admin, can_add, can_edit, can_delete, can_view, allowed_pages
    ) VALUES (
        NEW.id, v_username, NEW.email, v_is_admin,
        v_is_admin, v_is_admin, v_is_admin, TRUE, '["*"]'::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        is_admin = CASE WHEN v_is_admin THEN TRUE ELSE public.user_profiles.is_admin END;

    RETURN NEW;
END;
$$;

-- =============================================================================
-- A4. Băm mật khẩu bảng legacy public.users (bcrypt)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.hash_user_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    IF NEW.password IS NOT NULL AND NEW.password !~ '^\$2[abxy]\$' THEN
        NEW.password := extensions.crypt(NEW.password, extensions.gen_salt('bf', 10));
    END IF;
    RETURN NEW;
END;
$$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        DROP TRIGGER IF EXISTS trg_hash_user_password ON public.users;
        CREATE TRIGGER trg_hash_user_password
            BEFORE INSERT OR UPDATE OF password ON public.users
            FOR EACH ROW EXECUTE FUNCTION public.hash_user_password();

        -- Băm toàn bộ mật khẩu plaintext hiện có
        UPDATE public.users SET password = password WHERE password !~ '^\$2[abxy]\$';

        -- Đảm bảo bảng users không bao giờ đọc được trực tiếp
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.users FROM anon;
    END IF;
END $$;

-- =============================================================================
-- A5. check_login: so khớp bcrypt + giới hạn 5 lần sai / 15 phút / username
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_time
    ON public.login_attempts (username, attempted_at DESC);
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_attempts FROM anon, authenticated;

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
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_failed INT;
    v_found BOOLEAN := FALSE;
BEGIN
    SELECT COUNT(*) INTO v_failed
    FROM public.login_attempts a
    WHERE a.username = p_username
      AND a.success = FALSE
      AND a.attempted_at > NOW() - INTERVAL '15 minutes';

    IF v_failed >= 5 THEN
        RAISE EXCEPTION 'Tài khoản tạm khóa do đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.';
    END IF;

    RETURN QUERY
    SELECT u.username, u.email, u.require_otp, u.can_add, u.can_edit,
           u.can_delete, u.can_view, u.allowed_pages
    FROM public.users u
    WHERE u.username = p_username
      AND u.password = extensions.crypt(p_password, u.password);

    GET DIAGNOSTICS v_failed = ROW_COUNT;
    v_found := v_failed > 0;

    INSERT INTO public.login_attempts (username, success) VALUES (p_username, v_found);
    DELETE FROM public.login_attempts WHERE attempted_at < NOW() - INTERVAL '1 day';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_login(TEXT, TEXT) TO anon, authenticated;

-- =============================================================================
-- A6. Cố định search_path cho các hàm SECURITY DEFINER còn lại
-- =============================================================================
DO $$
DECLARE
    fn RECORD;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef = TRUE
          AND p.proname IN (
              'admin_get_users', 'admin_save_user', 'admin_delete_user',
              'acquire_inventory_lock', 'release_inventory_lock', 'get_active_inventory_locks',
              'xuat_xg_atomic', 'xuat_tole_atomic'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', fn.sig);
    END LOOP;
END $$;


-- =============================================================================
-- =============================================================================
-- PHẦN B — KHÓA DỮ LIỆU CHỈ CHO TÀI KHOẢN ĐÃ ĐĂNG NHẬP
-- ⚠️ Bỏ comment khối dưới đây SAU KHI đã chuyển hết user sang Supabase Auth
--    và cập nhật script đồng bộ MB51 / backup dùng SUPABASE_SERVICE_ROLE_KEY.
-- =============================================================================
-- =============================================================================
/*
DO $$
DECLARE
    t TEXT;
    pol RECORD;
    tables TEXT[] := ARRAY[
        'pl-can-thu', 'pl-chua-thu', 'pl-da-thu', 'pl-phieu-in', 'pl-mathang',
        'tole-nhap', 'tole-xuat', 'tole-ton',
        'xg-nhap', 'xg-xuat', 'xg-ton',
        'cong_viec', 'system_announcements', 'kiem_ke_scans', 'xg_sap_mb51',
        'inventory_locks'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            -- Xóa mọi policy áp dụng cho anon hoặc PUBLIC (bao gồm anon)
            FOR pol IN
                SELECT policyname FROM pg_policies
                WHERE schemaname = 'public' AND tablename = t
                  AND (roles && ARRAY['anon', 'public']::name[])
            LOOP
                EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
            END LOOP;

            -- Nếu bảng chưa có policy nào cho authenticated thì cấp quyền cơ bản
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = t
                  AND roles && ARRAY['authenticated']::name[]
            ) THEN
                EXECUTE format(
                    'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
                    t || '_authenticated_all', t
                );
            END IF;

            EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
        END IF;
    END LOOP;
END $$;
*/
