-- =============================================================================
-- SCRIPT NÂNG CẤP BẢO MẬT: SUPABASE AUTH, HỒ SƠ PHÂN QUYỀN & ROW LEVEL SECURITY (RLS)
-- Chạy toàn bộ script này trong SQL Editor trên Supabase Dashboard.
-- =============================================================================

-- 1. BẢNG HỒ SƠ NGƯỜI DÙNG LIÊN KẾT SUPABASE AUTH (auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    can_add BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_view BOOLEAN DEFAULT TRUE,
    allowed_pages JSONB DEFAULT '["*"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. HÀM KIỂM TRA QUYỀN QUẢN TRỊ VIÊN (IS_ADMIN)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()),
        (auth.jwt() ->> 'email' = 'thaibao06061997@gmail.com'),
        (auth.uid() IS NULL),
        false
    );
$$;

-- 3. HÀM TỰ ĐỘNG ĐỒNG BỘ USER MỚI TỪ AUTH.USERS SANG USER_PROFILES
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_username TEXT;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    v_username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        SPLIT_PART(NEW.email, '@', 1),
        'user_' || SUBSTRING(NEW.id::TEXT, 1, 8)
    );

    IF NEW.email = 'thaibao06061997@gmail.com' OR LOWER(v_username) = 'bao.lt' THEN
        v_is_admin := TRUE;
    END IF;

    INSERT INTO public.user_profiles (
        id, username, email, is_admin, can_add, can_edit, can_delete, can_view, allowed_pages
    ) VALUES (
        NEW.id,
        v_username,
        NEW.email,
        v_is_admin,
        v_is_admin, -- can_add
        v_is_admin, -- can_edit
        v_is_admin, -- can_delete
        TRUE,       -- can_view
        '["*"]'::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        is_admin = CASE WHEN v_is_admin THEN TRUE ELSE public.user_profiles.is_admin END;

    RETURN NEW;
END;
$$;

-- Tạo trigger gắn vào auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- 4. KÍCH HOẠT ROW LEVEL SECURITY (RLS) TRÊN TẤT CẢ CÁC BẢNG
-- =============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cong_viec ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'xg-xuat') THEN
        ALTER TABLE public."xg-xuat" ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tole-xuat') THEN
        ALTER TABLE public."tole-xuat" ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'xg-nhap') THEN
        ALTER TABLE public."xg-nhap" ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tole-nhap') THEN
        ALTER TABLE public."tole-nhap" ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;


-- =============================================================================
-- 5. CHÍNH SÁCH BẢO MẬT BẢNG USER_PROFILES
-- =============================================================================

DROP POLICY IF EXISTS "Profiles read policy" ON public.user_profiles;
CREATE POLICY "Profiles read policy" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid() OR public.is_admin() = true
    );

DROP POLICY IF EXISTS "Profiles update policy" ON public.user_profiles;
CREATE POLICY "Profiles update policy" ON public.user_profiles
    FOR UPDATE TO authenticated
    USING (public.is_admin() = true)
    WITH CHECK (public.is_admin() = true);


-- =============================================================================
-- 6. CHÍNH SÁCH BẢO MẬT BẢNG INVENTORY_LOCKS (Chặn truy cập ẩn danh trái phép)
-- =============================================================================

DROP POLICY IF EXISTS "Allow all access to inventory_locks" ON public.inventory_locks;
DROP POLICY IF EXISTS "Locks authenticated select" ON public.inventory_locks;
DROP POLICY IF EXISTS "Locks authenticated write" ON public.inventory_locks;
DROP POLICY IF EXISTS "Locks anon select" ON public.inventory_locks;

-- Cho phép authenticated đọc trạng thái khóa
CREATE POLICY "Locks authenticated select" ON public.inventory_locks
    FOR SELECT TO authenticated
    USING (true);

-- Cho phép anon đọc trạng thái khóa để hiển thị trực quan và tránh chọn trùng cuộn
CREATE POLICY "Locks anon select" ON public.inventory_locks
    FOR SELECT TO anon
    USING (true);

-- Chỉ authenticated mới có quyền ghi trực tiếp (hoặc thông qua RPC SECURITY DEFINER)
CREATE POLICY "Locks authenticated write" ON public.inventory_locks
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Thêm bảng inventory_locks vào publication supabase_realtime để đồng bộ tức thì
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inventory_locks'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_locks;
        END IF;
    END IF;
END $$;


-- =============================================================================
-- 7. CHÍNH SÁCH BẢO MẬT BẢNG CONG_VIEC
-- =============================================================================

DROP POLICY IF EXISTS "Allow all access to cong_viec" ON public.cong_viec;
DROP POLICY IF EXISTS "Cong viec authenticated policy" ON public.cong_viec;
CREATE POLICY "Cong viec authenticated policy" ON public.cong_viec
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);


-- =============================================================================
-- 8. CHÍNH SÁCH BẢO MẬT XUẤT XÀ GỒ ("xg-xuat") - THỰC THI KHÓA 24H TẠI DATABASE
-- =============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'xg-xuat') THEN
        -- Đọc: Cho phép tất cả tài khoản đã đăng nhập
        DROP POLICY IF EXISTS "xg_xuat_select_policy" ON public."xg-xuat";
        CREATE POLICY "xg_xuat_select_policy" ON public."xg-xuat"
            FOR SELECT TO authenticated
            USING (true);

        -- Thêm: Cho phép tài khoản có quyền can_add hoặc admin
        DROP POLICY IF EXISTS "xg_xuat_insert_policy" ON public."xg-xuat";
        CREATE POLICY "xg_xuat_insert_policy" ON public."xg-xuat"
            FOR INSERT TO authenticated
            WITH CHECK (
                public.is_admin() = true OR 
                EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND can_add = true)
            );

        -- Sửa: CHỐNG F12 BYPASS KHÓA 24H
        -- Chỉ Admin HOẶC (có quyền can_edit VÀ bản ghi tạo chưa quá 24h)
        DROP POLICY IF EXISTS "xg_xuat_update_policy" ON public."xg-xuat";
        CREATE POLICY "xg_xuat_update_policy" ON public."xg-xuat"
            FOR UPDATE TO authenticated
            USING (
                public.is_admin() = true OR (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND can_edit = true)
                    AND (created_at IS NULL OR created_at > NOW() - INTERVAL '24 hours')
                )
            )
            WITH CHECK (
                public.is_admin() = true OR (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND can_edit = true)
                    AND (created_at IS NULL OR created_at > NOW() - INTERVAL '24 hours')
                )
            );

        -- Xóa: CHỐNG F12 BYPASS KHÓA 24H
        DROP POLICY IF EXISTS "xg_xuat_delete_policy" ON public."xg-xuat";
        CREATE POLICY "xg_xuat_delete_policy" ON public."xg-xuat"
            FOR DELETE TO authenticated
            USING (
                public.is_admin() = true OR (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND can_delete = true)
                    AND (created_at IS NULL OR created_at > NOW() - INTERVAL '24 hours')
                )
            );
    END IF;
END $$;


-- =============================================================================
-- 9. CHÍNH SÁCH BẢO MẬT XUẤT TÔN ("tole-xuat") - THỰC THI KHÓA 24H TẠI DATABASE
-- =============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tole-xuat') THEN
        DROP POLICY IF EXISTS "tole_xuat_select_policy" ON public."tole-xuat";
        CREATE POLICY "tole_xuat_select_policy" ON public."tole-xuat"
            FOR SELECT TO authenticated
            USING (true);

        DROP POLICY IF EXISTS "tole_xuat_insert_policy" ON public."tole-xuat";
        CREATE POLICY "tole_xuat_insert_policy" ON public."tole-xuat"
            FOR INSERT TO authenticated
            WITH CHECK (
                public.is_admin() = true OR 
                EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND can_add = true)
            );

        DROP POLICY IF EXISTS "tole_xuat_update_policy" ON public."tole-xuat";
        CREATE POLICY "tole_xuat_update_policy" ON public."tole-xuat"
            FOR UPDATE TO authenticated
            USING (
                public.is_admin() = true OR (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND can_edit = true)
                    AND (created_at IS NULL OR created_at > NOW() - INTERVAL '24 hours')
                )
            )
            WITH CHECK (
                public.is_admin() = true OR (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND can_edit = true)
                    AND (created_at IS NULL OR created_at > NOW() - INTERVAL '24 hours')
                )
            );

        DROP POLICY IF EXISTS "tole_xuat_delete_policy" ON public."tole-xuat";
        CREATE POLICY "tole_xuat_delete_policy" ON public."tole-xuat"
            FOR DELETE TO authenticated
            USING (
                public.is_admin() = true OR (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND can_delete = true)
                    AND (created_at IS NULL OR created_at > NOW() - INTERVAL '24 hours')
                )
            );
    END IF;
END $$;
