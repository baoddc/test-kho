-- =============================================================================
-- VÁ LỖ HỔNG BẢO MẬT — ĐỢT 2 (2026-10-15)
-- Dựa trên kiểm tra trực tiếp database production + Supabase Security Advisor.
--
-- HIỆN TRẠNG (đã xác minh):
--   * auth.users = 0, public.users = 3  => MỌI người dùng đang chạy với vai trò
--     "anon" (publishable key công khai trong JS). Đăng nhập/OTP chỉ là cờ
--     localStorage, KHÔNG phải ranh giới bảo mật.
--   * Các bảng nghiệp vụ có policy "allow all" cho PUBLIC => bất kỳ ai trên
--     Internet đều đọc / sửa / xóa được toàn bộ dữ liệu kho.
--   * Phần B của file fix_security_vulnerabilities_2026-10-15.sql CHƯA được chạy.
--
-- PHẦN C: AN TOÀN, CHẠY NGAY (không làm hỏng luồng hiện tại)
-- PHẦN D: xem migrate_legacy_users_to_supabase_auth.sql + lock_rls_after_auth_migration.sql
-- =============================================================================


-- =============================================================================
-- C1. View "pl-chua-thu" đang là SECURITY DEFINER (bỏ qua RLS của người gọi)
-- =============================================================================
ALTER VIEW public."pl-chua-thu" SET (security_invoker = true);


-- =============================================================================
-- C2. Cố định search_path cho các hàm còn "role mutable search_path"
-- C3. Các RPC chỉ-đọc xg-nhap không cần SECURITY DEFINER => chuyển sang
--     SECURITY INVOKER để luôn tuân theo RLS của người gọi (sau Phần D sẽ tự
--     chặn anon mà không cần sửa thêm).
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
          AND p.proname IN (
              'get_xg_nhap_distinct_options', 'rpc_search_xg_nhap',
              'rpc_get_xg_nhap_distinct_column', 'get_xg_nhap_totals'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', fn.sig);
        EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', fn.sig);
    END LOOP;
END $$;


-- =============================================================================
-- C4. handle_new_user() là hàm trigger, không được gọi qua REST /rpc
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- C5. release_inventory_lock: tham số p_user do client tự khai báo, trước đây
--     chỉ cần gửi p_user = 'bao.lt' / 'admin' là gỡ được khóa của bất kỳ ai.
--     Quyền gỡ khóa người khác giờ chỉ dựa trên is_admin() (JWT phía server).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.release_inventory_lock(p_module text, p_cuon_ids text[], p_user text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_clean_user TEXT := LOWER(TRIM(COALESCE(NULLIF(auth.jwt() ->> 'email', ''), p_user, 'Anonymous')));
BEGIN
    IF p_cuon_ids IS NULL OR array_length(p_cuon_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    DELETE FROM public.inventory_locks
    WHERE module_type = p_module
      AND cuon_id = ANY(p_cuon_ids)
      AND (
          LOWER(TRIM(locked_by)) = v_clean_user
          OR public.is_admin() IS TRUE
      );
END;
$function$;


-- =============================================================================
-- C6. Dọn quyền thừa của anon trên user_profiles (không có policy cho anon,
--     nhưng không nên để GRANT mở sẵn).
-- =============================================================================
REVOKE ALL ON public.user_profiles FROM anon;


-- =============================================================================
-- PHẦN D — đã chuyển sang 2 file riêng, chạy theo thứ tự:
--   1. scripts/migrate_legacy_users_to_supabase_auth.sql
--   2. (đăng nhập thử cả 3 tài khoản)
--   3. scripts/lock_rls_after_auth_migration.sql
-- =============================================================================
