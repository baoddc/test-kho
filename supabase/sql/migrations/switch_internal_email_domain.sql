-- =============================================================================
-- ĐỔI EMAIL NỘI BỘ CỦA USER THƯỜNG: @ddc.com -> @noemail.baoddc.com (2026-10-15)
--
-- Lý do: ddc.com là tên miền của bên thứ ba. Ai cũng gọi được API "quên mật
-- khẩu" bằng key công khai => link đặt lại mật khẩu gửi tới chủ ddc.com.
-- Chỉ bao.lt dùng email thật; user khác đăng nhập bằng username, email nội bộ
-- thuộc tên miền baoddc.com (không có hộp thư) nên không ai nhận được mail.
--
-- Đổi email TẠI CHỖ: giữ nguyên ID tài khoản, mật khẩu và phân quyền.
-- Chạy xong, tiếp tục chạy lại migrate_legacy_users_to_supabase_auth.sql
-- để cập nhật hàm đồng bộ theo quy tắc mới (idempotent).
-- =============================================================================

DO $$
DECLARE
    u RECORD;
    v_new TEXT;
    v_uid UUID;
BEGIN
    FOR u IN SELECT * FROM public.users WHERE username <> 'bao.lt' LOOP
        v_new := LOWER(u.username) || '@noemail.baoddc.com';

        SELECT a.id INTO v_uid
        FROM auth.users a
        WHERE LOWER(a.email) IN (
            LOWER(u.username) || '@ddc.com',
            LOWER(NULLIF(TRIM(u.email), ''))
        )
        LIMIT 1;

        IF v_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_new) THEN
            UPDATE auth.users SET email = v_new, updated_at = NOW() WHERE id = v_uid;
            UPDATE auth.identities
               SET identity_data = identity_data || jsonb_build_object('email', v_new),
                   updated_at = NOW()
             WHERE user_id = v_uid AND provider = 'email';
            UPDATE public.user_profiles SET email = v_new, updated_at = NOW() WHERE id = v_uid;
        END IF;
    END LOOP;
END $$;

-- Kiểm tra
SELECT p.username, a.email AS auth_email, i.identity_data ->> 'email' AS identity_email, p.email AS profile_email
FROM public.user_profiles p
JOIN auth.users a ON a.id = p.id
LEFT JOIN auth.identities i ON i.user_id = a.id AND i.provider = 'email'
ORDER BY p.username;
