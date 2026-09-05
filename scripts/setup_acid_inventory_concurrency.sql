-- =============================================================================
-- SQL SETUP: CHUẨN HÓA DỮ LIỆU ACID & KIỂM SOÁT XUNG ĐỘT ĐỒNG THỜI (XG & TOLE)
-- ĐÃ GIA CỐ BẢO MẬT: BẢO VỆ TOKEN JWT, PHÂN QUYỀN RLS & THU HỒI QUYỀN ROLE ẨN DANH (ANON)
-- Chạy script này trong Supabase Dashboard -> SQL Editor
-- =============================================================================

-- 1. Bảng Khóa Tạm Thời Gian Thực (Soft Locks / Reservations with TTL)
CREATE TABLE IF NOT EXISTS public.inventory_locks (
    id BIGSERIAL PRIMARY KEY,
    module_type VARCHAR(20) NOT NULL, -- 'xg' | 'tole'
    cuon_id VARCHAR(100) NOT NULL,
    locked_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_module_cuon UNIQUE (module_type, cuon_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_locks_lookup 
ON public.inventory_locks (module_type, cuon_id, expires_at);

-- Bật Row Level Security và CHỈ CHO PHÉP TÀI KHOẢN ĐÃ ĐĂNG NHẬP
ALTER TABLE public.inventory_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to inventory_locks" ON public.inventory_locks;
DROP POLICY IF EXISTS "Locks authenticated select" ON public.inventory_locks;
DROP POLICY IF EXISTS "Locks authenticated write" ON public.inventory_locks;

CREATE POLICY "Locks authenticated select" ON public.inventory_locks
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Locks authenticated write" ON public.inventory_locks
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);


-- 2. Ràng Buộc Cứng (Hard Unique Constraints) Chống Xuất Trùng Cuộn ID
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'xg-xuat') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_xg_xuat_cuon_id 
        ON public."xg-xuat" ("Cuộn ID") 
        WHERE "Cuộn ID" IS NOT NULL AND TRIM("Cuộn ID") != '';
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tole-xuat') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_tole_xuat_cuon_id 
        ON public."tole-xuat" ("Cuộn ID") 
        WHERE "Cuộn ID" IS NOT NULL AND TRIM("Cuộn ID") != '';
    END IF;
END $$;


-- 3. Hàm RPC: Chiếm Khóa Tạm (Acquire Inventory Lock)
CREATE OR REPLACE FUNCTION public.acquire_inventory_lock(
    p_module TEXT,
    p_cuon_id TEXT,
    p_user TEXT DEFAULT NULL,
    p_ttl_seconds INT DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_cuon_id TEXT := TRIM(p_cuon_id);
    v_clean_user TEXT := TRIM(COALESCE(NULLIF(auth.jwt() ->> 'email', ''), p_user, 'Anonymous'));
    v_now TIMESTAMPTZ := NOW();
    v_expires_at TIMESTAMPTZ := v_now + (p_ttl_seconds || ' seconds')::INTERVAL;
    v_existing RECORD;
BEGIN
    IF v_clean_cuon_id IS NULL OR v_clean_cuon_id = '' THEN
        RETURN FALSE;
    END IF;

    -- Xóa các khóa cũ đã hết hạn
    DELETE FROM public.inventory_locks WHERE expires_at < v_now;

    -- Tìm xem cuộn có đang bị khóa bởi ai không
    SELECT * INTO v_existing 
    FROM public.inventory_locks 
    WHERE module_type = p_module AND cuon_id ILIKE v_clean_cuon_id;

    IF FOUND THEN
        -- Nếu chính user này đang giữ khóa, gia hạn thêm thời gian
        IF LOWER(TRIM(v_existing.locked_by)) = LOWER(v_clean_user) THEN
            UPDATE public.inventory_locks 
            SET expires_at = v_expires_at 
            WHERE module_type = p_module AND cuon_id ILIKE v_clean_cuon_id;
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
$$;


-- 4. Hàm RPC: Giải Phóng Khóa Tạm (Release Inventory Lock)
CREATE OR REPLACE FUNCTION public.release_inventory_lock(
    p_module TEXT,
    p_cuon_ids TEXT[],
    p_user TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
          OR v_clean_user = 'admin' 
          OR v_clean_user = 'bao.lt'
          OR v_clean_user = 'thaibao06061997@gmail.com'
      );
END;
$$;


-- 5. Hàm RPC: Lấy Danh Sách Khóa Còn Hiệu Lực (Get Active Locks)
CREATE OR REPLACE FUNCTION public.get_active_inventory_locks(p_module TEXT)
RETURNS TABLE (
    cuon_id VARCHAR(100),
    locked_by VARCHAR(100),
    expires_at TIMESTAMPTZ,
    remaining_seconds INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
$$;


-- 6. Hàm RPC Giao Dịch Xuất XG Nguyên Tử (Atomic XG Export) - KIỂM TRA QUYỀN CAN_ADD
CREATE OR REPLACE FUNCTION public.xuat_xg_atomic(
    p_records JSONB,
    p_user TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_cuon_id TEXT;
    v_nhap_count INT;
    v_xuat_count INT;
    v_inserted_rows JSONB := '[]'::JSONB;
    v_row RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- KIỂM TRA QUYỀN HẠN CỦA TÀI KHOẢN GỌI RPC NẾU ĐÃ ĐĂNG NHẬP
    IF auth.uid() IS NOT NULL THEN
        IF NOT (
            (SELECT COALESCE(is_admin, false) FROM public.user_profiles WHERE id = auth.uid()) OR
            (SELECT COALESCE(can_add, false) FROM public.user_profiles WHERE id = auth.uid())
        ) THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: Tài khoản của bạn không có quyền Thêm dữ liệu (can_add = false)!';
        END IF;
    END IF;

    -- BƯỚC 1: KIỂM TRA TOÀN VẸN DỮ LIỆU TẤT CẢ CUỘN (VALIDATION & ISOLATION)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            -- Kiểm tra xem cuộn có trong bảng nhập không
            SELECT COUNT(*) INTO v_nhap_count 
            FROM public."xg-nhap" 
            WHERE TRIM("Cuộn ID") ILIKE v_cuon_id;

            IF v_nhap_count = 0 THEN
                RAISE EXCEPTION 'Cuộn ID "%" không tồn tại trong danh sách Nhập Xà Gồ.', v_cuon_id;
            END IF;

            -- Kiểm tra xem cuộn đã bị xuất trước đó chưa
            SELECT COUNT(*) INTO v_xuat_count 
            FROM public."xg-xuat" 
            WHERE TRIM("Cuộn ID") ILIKE v_cuon_id;

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

        -- Xóa khóa tạm nếu có
        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            DELETE FROM public.inventory_locks 
            WHERE module_type = 'xg' AND cuon_id ILIKE v_cuon_id;
        END IF;
    END LOOP;

    RETURN v_inserted_rows;
END;
$$;


-- 7. Hàm RPC Giao Dịch Xuất TOLE Nguyên Tử (Atomic TOLE Export) - KIỂM TRA QUYỀN CAN_ADD
CREATE OR REPLACE FUNCTION public.xuat_tole_atomic(
    p_records JSONB,
    p_user TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_cuon_id TEXT;
    v_nhap_count INT;
    v_xuat_count INT;
    v_inserted_rows JSONB := '[]'::JSONB;
    v_row RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- KIỂM TRA QUYỀN HẠN CỦA TÀI KHOẢN GỌI RPC NẾU ĐÃ ĐĂNG NHẬP
    IF auth.uid() IS NOT NULL THEN
        IF NOT (
            (SELECT COALESCE(is_admin, false) FROM public.user_profiles WHERE id = auth.uid()) OR
            (SELECT COALESCE(can_add, false) FROM public.user_profiles WHERE id = auth.uid())
        ) THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: Tài khoản của bạn không có quyền Thêm dữ liệu (can_add = false)!';
        END IF;
    END IF;

    -- BƯỚC 1: KIỂM TRA TOÀN VẸN DỮ LIỆU TẤT CẢ CUỘN (VALIDATION & ISOLATION)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            -- Kiểm tra xem cuộn có trong bảng nhập không
            SELECT COUNT(*) INTO v_nhap_count 
            FROM public."tole-nhap" 
            WHERE TRIM("Cuộn ID") ILIKE v_cuon_id;

            IF v_nhap_count = 0 THEN
                RAISE EXCEPTION 'Cuộn ID "%" không tồn tại trong danh sách Nhập Tôn.', v_cuon_id;
            END IF;

            -- Kiểm tra xem cuộn đã bị xuất trước đó chưa
            SELECT COUNT(*) INTO v_xuat_count 
            FROM public."tole-xuat" 
            WHERE TRIM("Cuộn ID") ILIKE v_cuon_id;

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

        -- Xóa khóa tạm nếu có
        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            DELETE FROM public.inventory_locks 
            WHERE module_type = 'tole' AND cuon_id ILIKE v_cuon_id;
        END IF;
    END LOOP;

    RETURN v_inserted_rows;
END;
$$;


-- 8. THU HỒI QUYỀN THỰC THI TỪ ROLE ẨN DANH (ANON)
REVOKE EXECUTE ON FUNCTION public.xuat_xg_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.xuat_tole_atomic FROM anon;
GRANT EXECUTE ON FUNCTION public.xuat_xg_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.xuat_tole_atomic TO authenticated;
