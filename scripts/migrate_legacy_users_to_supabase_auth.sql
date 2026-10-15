-- =============================================================================
-- CHUYỂN TÀI KHOẢN LEGACY (public.users) SANG SUPABASE AUTH (2026-10-15)
--
-- * Giữ nguyên mật khẩu: public.users đã lưu bcrypt ($2a$) — cùng định dạng
--   Supabase Auth dùng, nên chép thẳng hash sang auth.users.encrypted_password.
-- * Email đăng nhập khớp với cách dang_nhap.js suy ra từ username:
--     bao.lt    -> thaibao06061997@gmail.com
--     <user>    -> <email trong public.users> hoặc <user>@ddc.com
-- * Trang Quản lý user (admin_save_user / admin_delete_user) từ nay tự đồng bộ
--   sang auth.users + user_profiles, nên tạo/sửa/xóa user vẫn có hiệu lực.
-- * Idempotent: chạy lại không tạo trùng.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Tài khoản tự đăng ký (signUp) mặc định KHÔNG có quyền gì.
--    Trước đây: can_view = TRUE, allowed_pages = ["*"] cho mọi người đăng ký.
-- -----------------------------------------------------------------------------
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
    v_username := 'pending_' || SUBSTRING(NEW.id::TEXT, 1, 8);

    IF NEW.email = 'thaibao06061997@gmail.com' THEN
        v_is_admin := TRUE;
        v_username := 'bao.lt';
    END IF;

    INSERT INTO public.user_profiles (
        id, username, email, is_admin, can_add, can_edit, can_delete, can_view, allowed_pages
    ) VALUES (
        NEW.id, v_username, NEW.email, v_is_admin,
        v_is_admin, v_is_admin, v_is_admin, v_is_admin,
        CASE WHEN v_is_admin THEN '["*"]'::jsonb ELSE '[]'::jsonb END
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Thu hồi quyền của các hồ sơ không gắn với user legacy nào (tài khoản tự đăng ký)
UPDATE public.user_profiles p SET
    is_admin = FALSE, can_add = FALSE, can_edit = FALSE, can_delete = FALSE,
    can_view = FALSE, allowed_pages = '[]'::jsonb
WHERE p.email IS DISTINCT FROM 'thaibao06061997@gmail.com'
  AND NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE LOWER(COALESCE(NULLIF(TRIM(u.email), ''), u.username || '@ddc.com')) = LOWER(p.email)
  );


-- -----------------------------------------------------------------------------
-- 1. Hàm nội bộ: đồng bộ 1 user legacy -> auth.users + auth.identities + user_profiles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_legacy_user_to_auth(p_legacy_id BIGINT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    u RECORD;
    v_email TEXT;
    v_uid UUID;
BEGIN
    SELECT * INTO u FROM public.users WHERE id = p_legacy_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF u.username = 'bao.lt' THEN
        v_email := 'thaibao06061997@gmail.com';
    ELSE
        v_email := LOWER(COALESCE(NULLIF(TRIM(u.email), ''), u.username || '@ddc.com'));
    END IF;

    -- Chỉ khớp theo EMAIL (không theo username: username của hồ sơ Auth được suy
    -- ra từ email người đăng ký tự khai, ví dụ vuong.pm@evil.com -> "vuong.pm").
    SELECT a.id INTO v_uid FROM auth.users a WHERE LOWER(a.email) = v_email;

    IF v_uid IS NULL THEN
        v_uid := gen_random_uuid();

        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at,
            confirmation_token, recovery_token, email_change_token_new, email_change
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
            v_email, u.password,
            NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
            NOW(), NOW(),
            '', '', '', ''
        );

        INSERT INTO auth.identities (
            id, user_id, provider_id, provider, identity_data,
            last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_uid, v_uid::text, 'email',
            jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
            NOW(), NOW(), NOW()
        );
    ELSE
        -- Đồng bộ mật khẩu (hash) và email khi admin đổi
        UPDATE auth.users SET
            encrypted_password = u.password,
            email = v_email,
            updated_at = NOW()
        WHERE id = v_uid;

        UPDATE auth.identities SET
            identity_data = identity_data || jsonb_build_object('email', v_email),
            updated_at = NOW()
        WHERE user_id = v_uid AND provider = 'email';
    END IF;

    -- Trigger on_auth_user_created đã tạo hồ sơ; đảm bảo tồn tại rồi chép quyền
    INSERT INTO public.user_profiles (id, username, email)
    VALUES (v_uid, u.username, v_email)
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.user_profiles p SET
        username      = u.username,
        email         = v_email,
        is_admin      = (u.username = 'bao.lt'),
        can_add       = COALESCE(u.can_add, FALSE),
        can_edit      = COALESCE(u.can_edit, FALSE),
        can_delete    = COALESCE(u.can_delete, FALSE),
        can_view      = COALESCE(u.can_view, TRUE),
        allowed_pages = COALESCE(u.allowed_pages, '[]'::jsonb),
        updated_at    = NOW()
    WHERE p.id = v_uid;

    RETURN v_uid;
END;
$$;

-- Chỉ dùng nội bộ, không mở qua REST /rpc
REVOKE EXECUTE ON FUNCTION public.sync_legacy_user_to_auth(BIGINT) FROM PUBLIC, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. Chuyển toàn bộ user hiện có
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.users ORDER BY id LOOP
        PERFORM public.sync_legacy_user_to_auth(r.id);
    END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 3. Trang Quản lý user: tự đồng bộ sau mỗi lần tạo / sửa / xóa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_legacy_user_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_uid UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT id INTO v_uid FROM auth.users
        WHERE LOWER(email) = LOWER(COALESCE(NULLIF(TRIM(OLD.email), ''), OLD.username || '@ddc.com'));
        IF v_uid IS NOT NULL AND OLD.username <> 'bao.lt' THEN
            DELETE FROM auth.users WHERE id = v_uid;  -- user_profiles xóa theo (cascade hoặc dòng dưới)
            DELETE FROM public.user_profiles WHERE id = v_uid;
        END IF;
        RETURN OLD;
    END IF;

    PERFORM public.sync_legacy_user_to_auth(NEW.id);
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_sync_legacy_user_to_auth() FROM PUBLIC, anon, authenticated;

-- Chạy SAU trigger băm mật khẩu (BEFORE), nên NEW.password đã là bcrypt
DROP TRIGGER IF EXISTS trg_users_sync_auth ON public.users;
CREATE TRIGGER trg_users_sync_auth
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.trg_sync_legacy_user_to_auth();


-- -----------------------------------------------------------------------------
-- 4. Kiểm tra kết quả
-- -----------------------------------------------------------------------------
SELECT p.username, p.email, p.is_admin, p.can_add, p.can_edit, p.can_delete, p.can_view,
       (a.encrypted_password = u.password) AS password_preserved
FROM public.user_profiles p
JOIN auth.users a ON a.id = p.id
LEFT JOIN public.users u ON u.username = p.username
ORDER BY p.username;
