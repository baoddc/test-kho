-- =============================================================================
-- KHÓA DỮ LIỆU THEO QUYỀN NGƯỜI DÙNG (2026-10-15) — BƯỚC 3
--
-- ⚠️ CHỈ CHẠY SAU KHI:
--   1. Đã chạy migrate_legacy_users_to_supabase_auth.sql
--   2. Cả 3 tài khoản (bao.lt, admin, vuong.pm) đã đăng nhập thử thành công
--   3. Máy chạy backup / đồng bộ MB51 đã đặt biến môi trường
--      SUPABASE_SERVICE_ROLE_KEY (Dashboard -> Settings -> API Keys -> secret)
--
-- Thay thế Phần B (fix_security_vulnerabilities_2026-10-15.sql) và Phần D
-- (fix_security_vulnerabilities_2026-10-15_part2.sql).
--
-- Khác với "authenticated USING (true)": tài khoản tự đăng ký qua signUp
-- (hồ sơ can_view = FALSE) KHÔNG đọc được gì, kể cả khi đăng ký chưa bị tắt.
--
-- Hoàn tác khẩn cấp: xem cuối file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Hàm kiểm tra quyền của người gọi (đọc user_profiles theo auth.uid())
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_has_perm(p_perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((
        SELECT CASE
            WHEN p.is_admin THEN TRUE
            WHEN p_perm = 'view'   THEN COALESCE(p.can_view, FALSE)
            WHEN p_perm = 'add'    THEN COALESCE(p.can_add, FALSE)
            WHEN p_perm = 'edit'   THEN COALESCE(p.can_edit, FALSE)
            WHEN p_perm = 'delete' THEN COALESCE(p.can_delete, FALSE)
            ELSE FALSE
        END
        FROM public.user_profiles p
        WHERE p.id = auth.uid()
    ), FALSE);
$$;

REVOKE EXECUTE ON FUNCTION public.app_has_perm(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_has_perm(TEXT) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. Xóa TOÀN BỘ policy cũ trên các bảng nghiệp vụ, thu hồi quyền anon
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
    pol RECORD;
    tables TEXT[] := ARRAY[
        'xg-nhap', 'xg-xuat', 'xg-ton',
        'tole-nhap', 'tole-xuat', 'tole-ton',
        'pl-can-thu', 'pl-da-thu', 'pl-phieu-in', 'pl-mathang',
        'cong_viec', 'kiem_ke_scans', 'system_announcements', 'xg_sap_mb51',
        'inventory_locks'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            FOR pol IN
                SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
            LOOP
                EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
            END LOOP;
            EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
        END IF;
    END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 3. Bảng dữ liệu kho: xem = can_view, thêm = can_add, sửa = can_edit, xóa = can_delete
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'xg-nhap', 'xg-ton', 'tole-nhap', 'tole-ton',
        'pl-can-thu', 'pl-da-thu', 'pl-phieu-in', 'pl-mathang'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('CREATE POLICY app_select ON public.%I FOR SELECT TO authenticated USING (public.app_has_perm(''view''))', t);
            EXECUTE format('CREATE POLICY app_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.app_has_perm(''add''))', t);
            EXECUTE format('CREATE POLICY app_update ON public.%I FOR UPDATE TO authenticated USING (public.app_has_perm(''edit'')) WITH CHECK (public.app_has_perm(''edit''))', t);
            EXECUTE format('CREATE POLICY app_delete ON public.%I FOR DELETE TO authenticated USING (public.app_has_perm(''delete''))', t);
        END IF;
    END LOOP;
END $$;

-- Phiếu xuất: giữ quy tắc khóa sửa/xóa sau 24h (admin được bỏ qua)
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['xg-xuat', 'tole-xuat'] LOOP
        EXECUTE format('CREATE POLICY app_select ON public.%I FOR SELECT TO authenticated USING (public.app_has_perm(''view''))', t);
        EXECUTE format('CREATE POLICY app_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.app_has_perm(''add''))', t);
        EXECUTE format($f$CREATE POLICY app_update ON public.%I FOR UPDATE TO authenticated
            USING (public.is_admin() IS TRUE OR (public.app_has_perm('edit') AND (created_at IS NULL OR created_at > NOW() - INTERVAL '24 hours')))
            WITH CHECK (public.is_admin() IS TRUE OR (public.app_has_perm('edit') AND (created_at IS NULL OR created_at > NOW() - INTERVAL '24 hours')))$f$, t);
        EXECUTE format($f$CREATE POLICY app_delete ON public.%I FOR DELETE TO authenticated
            USING (public.is_admin() IS TRUE OR (public.app_has_perm('delete') AND (created_at IS NULL OR created_at > NOW() - INTERVAL '24 hours')))$f$, t);
    END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 4. Bảng chức năng chung
-- -----------------------------------------------------------------------------
-- Công việc / nhắc hẹn: mọi tài khoản hợp lệ
CREATE POLICY app_all ON public.cong_viec FOR ALL TO authenticated
    USING (public.app_has_perm('view')) WITH CHECK (public.app_has_perm('view'));

-- Kiểm kê: ai có quyền xem đều quét/ghi được; chỉ admin xóa
CREATE POLICY app_select ON public.kiem_ke_scans FOR SELECT TO authenticated USING (public.app_has_perm('view'));
CREATE POLICY app_insert ON public.kiem_ke_scans FOR INSERT TO authenticated WITH CHECK (public.app_has_perm('view'));
CREATE POLICY app_delete ON public.kiem_ke_scans FOR DELETE TO authenticated USING (public.is_admin() IS TRUE);

-- Thông báo hệ thống: ai cũng đọc; người có quyền Thêm mới được đăng/sửa/xóa
CREATE POLICY app_select ON public.system_announcements FOR SELECT TO authenticated USING (public.app_has_perm('view'));
CREATE POLICY app_write ON public.system_announcements FOR ALL TO authenticated
    USING (public.app_has_perm('add')) WITH CHECK (public.app_has_perm('add'));

-- Dữ liệu SAP MB51: đọc tự do; đồng bộ từ trình duyệt cần quyền Thêm
-- (script nền dùng service_role nên không bị RLS chặn)
CREATE POLICY app_select ON public.xg_sap_mb51 FOR SELECT TO authenticated USING (public.app_has_perm('view'));
CREATE POLICY app_write ON public.xg_sap_mb51 FOR ALL TO authenticated
    USING (public.app_has_perm('add')) WITH CHECK (public.app_has_perm('add'));

-- Khóa cuộn: thao tác chính qua RPC SECURITY DEFINER; cho đọc để hiển thị
CREATE POLICY app_select ON public.inventory_locks FOR SELECT TO authenticated USING (public.app_has_perm('view'));
CREATE POLICY app_write ON public.inventory_locks FOR ALL TO authenticated
    USING (public.app_has_perm('add')) WITH CHECK (public.app_has_perm('add'));


-- -----------------------------------------------------------------------------
-- 5. RPC: không cho anon gọi; ngừng đăng nhập legacy
-- -----------------------------------------------------------------------------
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
              'xuat_xg_atomic', 'xuat_tole_atomic',
              'acquire_inventory_lock', 'release_inventory_lock', 'get_active_inventory_locks',
              'get_xg_nhap_distinct_options', 'rpc_search_xg_nhap',
              'rpc_get_xg_nhap_distinct_column', 'get_xg_nhap_totals'
          )
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
    END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.check_login(TEXT, TEXT) FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- HOÀN TÁC KHẨN CẤP (chỉ khi ứng dụng không dùng được và cần mở lại tạm thời):
--   GRANT EXECUTE ON FUNCTION public.check_login(TEXT, TEXT) TO anon;
--   rồi với từng bảng:  GRANT ALL ON public."<bảng>" TO anon;
--   CREATE POLICY tmp_open ON public."<bảng>" FOR ALL TO anon USING (true) WITH CHECK (true);
-- =============================================================================
