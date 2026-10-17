-- =============================================================================
-- Bảng điểm 5S từng tháng (trang HSE > Thi đua & Bảng điểm 5S)
-- Chạy trong Supabase Dashboard > SQL Editor.
-- Mỗi tháng 1 dòng; items là mảng JSON:
--   [{ "area": "Kho sơn", "s1": 24, "s2": 24, "s3": 14, "s4": 19, "s5": 15, "score": 96, "trend": "↑ 2" }, ...]
-- Tháng chưa có dòng nào thì giao diện rơi về số liệu cũ viết sẵn trong hse.js.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.hse_5s_scores (
    month_key        TEXT PRIMARY KEY CHECK (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- 'YYYY-MM'
    xuong_avg        NUMERIC(5,1),
    items            JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_image_url TEXT,
    updated_by       UUID DEFAULT auth.uid(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hse_5s_scores ENABLE ROW LEVEL SECURITY;

-- Ai có quyền xem thì đọc được; chỉ admin (bao.lt) được ghi, khớp với checkPermission() trong hse.js
DROP POLICY IF EXISTS app_select ON public.hse_5s_scores;
DROP POLICY IF EXISTS app_write  ON public.hse_5s_scores;

CREATE POLICY app_select ON public.hse_5s_scores FOR SELECT TO authenticated
    USING (public.app_has_perm('view'));
CREATE POLICY app_write ON public.hse_5s_scores FOR ALL TO authenticated
    USING (public.is_admin() IS TRUE) WITH CHECK (public.is_admin() IS TRUE);

REVOKE ALL ON public.hse_5s_scores FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hse_5s_scores TO authenticated;
