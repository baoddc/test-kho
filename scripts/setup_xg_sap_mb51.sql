-- =============================================================================
-- SQL SETUP: BẢNG TRA CỨU DỮ LIỆU SAP MB51 CHO KHO XÀ GỒ (public.xg_sap_mb51)
-- Chạy script này trong Supabase Dashboard -> SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.xg_sap_mb51 (
    id BIGSERIAL PRIMARY KEY,
    material_document TEXT NOT NULL,
    posting_date DATE,
    material TEXT,
    material_description TEXT,
    batch TEXT,
    quantity NUMERIC DEFAULT 0,
    unit_of_entry TEXT,
    project_id TEXT,
    project_name TEXT,
    movement_type TEXT,
    movement_type_text TEXT,
    storage_location TEXT,
    plant TEXT,
    vendor_name TEXT,
    customer_name TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index tối ưu tra cứu nhanh theo Phiếu nhập (material_document)
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_doc ON public.xg_sap_mb51 (material_document);
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_mat ON public.xg_sap_mb51 (material);
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_batch ON public.xg_sap_mb51 (batch);
CREATE INDEX IF NOT EXISTS idx_xg_sap_mb51_composite ON public.xg_sap_mb51 (material_document, material, batch);

-- Bật Row Level Security (RLS)
ALTER TABLE public.xg_sap_mb51 ENABLE ROW LEVEL SECURITY;

-- Cấp quyền SELECT cho anon & authenticated để web tra cứu
DROP POLICY IF EXISTS "Cho phép đọc xg_sap_mb51" ON public.xg_sap_mb51;
CREATE POLICY "Cho phép đọc xg_sap_mb51" ON public.xg_sap_mb51
    FOR SELECT USING (true);

-- Cấp quyền INSERT/UPDATE/DELETE cho anon & authenticated (để script đồng bộ chạy)
DROP POLICY IF EXISTS "Cho phép đồng bộ xg_sap_mb51" ON public.xg_sap_mb51;
CREATE POLICY "Cho phép đồng bộ xg_sap_mb51" ON public.xg_sap_mb51
    FOR ALL USING (true) WITH CHECK (true);
