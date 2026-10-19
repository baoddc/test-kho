-- =============================================================================
-- VÁ LỖ HỔNG BẢO MẬT — ĐỢT 3 (2026-10-19)
-- Dựa trên kiểm tra trực tiếp database production + Supabase Security Advisor.
--
-- E1. cong_viec: policy "app_all" chỉ cần quyền 'view' => tài khoản chỉ-xem
--     đọc / sửa / XÓA được toàn bộ công việc của bao.lt qua REST API.
--     UI chỉ cho chủ công việc hoặc admin thao tác => RLS phải khớp.
-- E2. acquire_inventory_lock: không kiểm tra quyền + TTL không giới hạn =>
--     tài khoản chỉ-xem khóa được bất kỳ cuộn nào trong nhiều năm (chặn xuất kho).
--     So khớp bằng ILIKE => cuon_id '%' khớp mọi cuộn.
-- E3. get_active_inventory_locks: không kiểm tra quyền xem.
-- E4. xuat_xg_atomic / xuat_tole_atomic: phép kiểm tra quyền dạng
--     NOT ((SELECT ..) OR (SELECT ..)) trả về NULL khi thiếu hồ sơ => bỏ qua kiểm tra.
--     So khớp Cuộn ID bằng ILIKE => ký tự % / _ là ký tự đại diện.
--
-- Chạy toàn bộ file trong Supabase Dashboard -> SQL Editor. Chạy lại nhiều lần an toàn.
-- =============================================================================


-- =============================================================================
-- E1. cong_viec — chỉ chủ công việc (user_created) hoặc admin
-- =============================================================================
CREATE OR REPLACE FUNCTION public.app_current_username()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT username FROM public.user_profiles WHERE id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.app_current_username() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_current_username() TO authenticated;

DROP POLICY IF EXISTS app_all ON public.cong_viec;
DROP POLICY IF EXISTS app_owner_all ON public.cong_viec;
CREATE POLICY app_owner_all ON public.cong_viec
    FOR ALL TO authenticated
    USING (
        public.is_admin() IS TRUE
        OR (public.app_has_perm('view')
            AND LOWER(user_created) = LOWER(public.app_current_username()))
    )
    WITH CHECK (
        public.is_admin() IS TRUE
        OR (public.app_has_perm('view')
            AND LOWER(user_created) = LOWER(public.app_current_username()))
    );


-- =============================================================================
-- E2. acquire_inventory_lock — cần quyền 'add', TTL 30..1800 giây, so khớp chính xác
-- =============================================================================
CREATE OR REPLACE FUNCTION public.acquire_inventory_lock(p_module text, p_cuon_id text, p_user text DEFAULT NULL::text, p_ttl_seconds integer DEFAULT 300)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_clean_cuon_id TEXT := TRIM(p_cuon_id);
    v_clean_user TEXT := TRIM(COALESCE(NULLIF(auth.jwt() ->> 'email', ''), p_user, 'Anonymous'));
    v_now TIMESTAMPTZ := NOW();
    v_ttl INT := LEAST(GREATEST(COALESCE(p_ttl_seconds, 300), 30), 1800);
    v_expires_at TIMESTAMPTZ := v_now + make_interval(secs => v_ttl);
    v_existing RECORD;
BEGIN
    IF public.app_has_perm('add') IS NOT TRUE THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Tài khoản của bạn không có quyền Thêm dữ liệu!';
    END IF;

    IF v_clean_cuon_id IS NULL OR v_clean_cuon_id = '' THEN
        RETURN FALSE;
    END IF;

    -- Xóa các khóa cũ đã hết hạn
    DELETE FROM public.inventory_locks WHERE expires_at < v_now;

    -- Tìm xem cuộn có đang bị khóa bởi ai không
    SELECT * INTO v_existing
    FROM public.inventory_locks
    WHERE module_type = p_module AND LOWER(cuon_id) = LOWER(v_clean_cuon_id);

    IF FOUND THEN
        -- Nếu chính user này đang giữ khóa, gia hạn thêm thời gian
        IF LOWER(TRIM(v_existing.locked_by)) = LOWER(v_clean_user) THEN
            UPDATE public.inventory_locks
            SET expires_at = v_expires_at
            WHERE id = v_existing.id;
            RETURN TRUE;
        ELSE
            -- Bị người khác giữ khóa và chưa hết hạn
            RETURN FALSE;
        END IF;
    END IF;

    -- Tạo khóa mới
    INSERT INTO public.inventory_locks (module_type, cuon_id, locked_by, created_at, expires_at)
    VALUES (p_module, v_clean_cuon_id, v_clean_user, v_now, v_expires_at)
    ON CONFLICT (module_type, cuon_id) DO UPDATE
    SET locked_by = v_clean_user, expires_at = v_expires_at;

    RETURN TRUE;
END;
$function$;


-- =============================================================================
-- E3. get_active_inventory_locks — cần quyền 'view'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_active_inventory_locks(p_module text)
 RETURNS TABLE(cuon_id character varying, locked_by character varying, expires_at timestamp with time zone, remaining_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
    IF public.app_has_perm('view') IS NOT TRUE THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        l.cuon_id,
        l.locked_by,
        l.expires_at,
        GREATEST(0, EXTRACT(EPOCH FROM (l.expires_at - NOW()))::INT) AS remaining_seconds
    FROM public.inventory_locks l
    WHERE l.module_type = p_module
      AND l.expires_at > NOW();
END;
$function$;


-- =============================================================================
-- E4. xuat_xg_atomic / xuat_tole_atomic — kiểm tra quyền chặt + so khớp chính xác
-- =============================================================================
CREATE OR REPLACE FUNCTION public.xuat_xg_atomic(p_records jsonb, p_user text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_item JSONB;
    v_cuon_id TEXT;
    v_nhap_count INT;
    v_xuat_count INT;
    v_inserted_rows JSONB := '[]'::JSONB;
    v_row RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- KIỂM TRA QUYỀN (IS NOT TRUE: thiếu hồ sơ / NULL cũng bị chặn)
    IF public.app_has_perm('add') IS NOT TRUE THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Tài khoản của bạn không có quyền Thêm dữ liệu (can_add = false)!';
    END IF;

    IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
        RAISE EXCEPTION 'Dữ liệu xuất kho không hợp lệ.';
    END IF;

    -- BƯỚC 1: KIỂM TRA TOÀN VẸN DỮ LIỆU TẤT CẢ CUỘN (VALIDATION & ISOLATION)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            SELECT COUNT(*) INTO v_nhap_count
            FROM public."xg-nhap"
            WHERE LOWER(TRIM("Cuộn ID")) = LOWER(v_cuon_id);

            IF v_nhap_count = 0 THEN
                RAISE EXCEPTION 'Cuộn ID "%" không tồn tại trong danh sách Nhập Xà Gồ.', v_cuon_id;
            END IF;

            SELECT COUNT(*) INTO v_xuat_count
            FROM public."xg-xuat"
            WHERE LOWER(TRIM("Cuộn ID")) = LOWER(v_cuon_id);

            IF v_xuat_count > 0 THEN
                RAISE EXCEPTION 'Cuộn ID "%" đã được xuất kho trước đó bởi giao dịch khác.', v_cuon_id;
            END IF;
        END IF;
    END LOOP;

    -- BƯỚC 2: THỰC HIỆN GHI DỮ LIỆU VÀ GIẢI PHÓNG KHÓA
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        INSERT INTO public."xg-xuat" (
            "Mã chứng từ",
            "Ngày xuất",
            "Phiếu xuất",
            "Loại xuất",
            "Mã vật tư",
            "Tên vật tư",
            "Batch",
            "Cuộn ID",
            "Số lượng (Kg)",
            "Mã công trình",
            "Tên công trình",
            "Ghi chú",
            "created_at"
        ) VALUES (
            v_item->>'Mã chứng từ',
            CASE
                WHEN v_item->>'Ngày xuất' IS NOT NULL AND v_item->>'Ngày xuất' <> ''
                THEN (v_item->>'Ngày xuất')::DATE
                ELSE CURRENT_DATE
            END,
            v_item->>'Phiếu xuất',
            v_item->>'Loại xuất',
            v_item->>'Mã vật tư',
            v_item->>'Tên vật tư',
            v_item->>'Batch',
            v_item->>'Cuộn ID',
            COALESCE((v_item->>'Số lượng (Kg)')::NUMERIC, 0),
            v_item->>'Mã công trình',
            v_item->>'Tên công trình',
            v_item->>'Ghi chú',
            v_now
        ) RETURNING * INTO v_row;

        v_inserted_rows := v_inserted_rows || to_jsonb(v_row);

        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            DELETE FROM public.inventory_locks
            WHERE module_type = 'xg' AND LOWER(cuon_id) = LOWER(v_cuon_id);
        END IF;
    END LOOP;

    RETURN v_inserted_rows;
END;
$function$;

CREATE OR REPLACE FUNCTION public.xuat_tole_atomic(p_records jsonb, p_user text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_item JSONB;
    v_cuon_id TEXT;
    v_nhap_count INT;
    v_xuat_count INT;
    v_inserted_rows JSONB := '[]'::JSONB;
    v_row RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- KIỂM TRA QUYỀN (IS NOT TRUE: thiếu hồ sơ / NULL cũng bị chặn)
    IF public.app_has_perm('add') IS NOT TRUE THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Tài khoản của bạn không có quyền Thêm dữ liệu (can_add = false)!';
    END IF;

    IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
        RAISE EXCEPTION 'Dữ liệu xuất kho không hợp lệ.';
    END IF;

    -- BƯỚC 1: KIỂM TRA TOÀN VẸN DỮ LIỆU TẤT CẢ CUỘN (VALIDATION & ISOLATION)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            SELECT COUNT(*) INTO v_nhap_count
            FROM public."tole-nhap"
            WHERE LOWER(TRIM("Cuộn ID")) = LOWER(v_cuon_id);

            IF v_nhap_count = 0 THEN
                RAISE EXCEPTION 'Cuộn ID "%" không tồn tại trong danh sách Nhập Tôn.', v_cuon_id;
            END IF;

            SELECT COUNT(*) INTO v_xuat_count
            FROM public."tole-xuat"
            WHERE LOWER(TRIM("Cuộn ID")) = LOWER(v_cuon_id);

            IF v_xuat_count > 0 THEN
                RAISE EXCEPTION 'Cuộn ID "%" đã được xuất kho trước đó bởi giao dịch khác.', v_cuon_id;
            END IF;
        END IF;
    END LOOP;

    -- BƯỚC 2: THỰC HIỆN GHI DỮ LIỆU VÀ GIẢI PHÓNG KHÓA
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        INSERT INTO public."tole-xuat" (
            "Mã chứng từ",
            "Ngày xuất",
            "Phiếu xuất",
            "Loại xuất",
            "Mã vật tư",
            "Tên vật tư",
            "Batch",
            "Cuộn ID",
            "Số lượng (Kg)",
            "Số lượng (m)",
            "Mã công trình",
            "Tên công trình",
            "Ghi chú",
            "created_at"
        ) VALUES (
            v_item->>'Mã chứng từ',
            CASE
                WHEN v_item->>'Ngày xuất' IS NOT NULL AND v_item->>'Ngày xuất' <> ''
                THEN (v_item->>'Ngày xuất')::DATE
                ELSE CURRENT_DATE
            END,
            v_item->>'Phiếu xuất',
            v_item->>'Loại xuất',
            v_item->>'Mã vật tư',
            v_item->>'Tên vật tư',
            v_item->>'Batch',
            v_item->>'Cuộn ID',
            COALESCE((v_item->>'Số lượng (Kg)')::NUMERIC, 0),
            COALESCE((v_item->>'Số lượng (m)')::NUMERIC, 0),
            v_item->>'Mã công trình',
            v_item->>'Tên công trình',
            v_item->>'Ghi chú',
            v_now
        ) RETURNING * INTO v_row;

        v_inserted_rows := v_inserted_rows || to_jsonb(v_row);

        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            DELETE FROM public.inventory_locks
            WHERE module_type = 'tole' AND LOWER(cuon_id) = LOWER(v_cuon_id);
        END IF;
    END LOOP;

    RETURN v_inserted_rows;
END;
$function$;


-- =============================================================================
-- Quyền thực thi: chỉ authenticated (CREATE OR REPLACE giữ grant cũ, chạy lại cho chắc)
-- =============================================================================
REVOKE ALL ON FUNCTION public.acquire_inventory_lock(text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_active_inventory_locks(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.xuat_xg_atomic(jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.xuat_tole_atomic(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_inventory_lock(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_inventory_locks(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xuat_xg_atomic(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xuat_tole_atomic(jsonb, text) TO authenticated;
