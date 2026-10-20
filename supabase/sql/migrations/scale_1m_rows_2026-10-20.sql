-- =============================================================================
-- MỞ RỘNG QUY MÔ 500.000 – 1.000.000 DÒNG / BẢNG  (2026-10-20)
-- -----------------------------------------------------------------------------
-- Chạy MỘT LẦN trong Supabase Dashboard → SQL Editor (project ahcethtonjwktjtmxzog).
-- Chạy lại nhiều lần vẫn an toàn (idempotent).
--
-- Nội dung:
--   1. RLS: gọi hàm phân quyền 1 lần / truy vấn (initPlan) thay vì 1 lần / dòng
--   2. Cờ con_ton trên bảng nhập (trigger tự cập nhật) → tồn kho không cần tải
--      toàn bộ bảng nhập + xuất về trình duyệt
--   3. Hàm tìm kiếm + index trigram (ILIKE '%...%' dùng được index)
--   4. Index btree cho lọc ngày / loại / mã chứng từ / số phiếu / Cuộn ID
--   5. RPC truy vấn chung: qry_rows / qry_group / qry_distinct
--   6. RPC next_roll_number (số cuộn kế tiếp theo mã vật tư)
--   7. RPC dashboard_kho (biểu đồ xà gồ / tole tính ở server, có cache)
--   8. Bảng tổng hợp phế liệu (pl_tong_hop_khoa) + view pl-chua-thu đọc từ đó
--      + RPC pl_tong_hop
--   9. Quyền thực thi + ANALYZE
--
-- Vì sao các RPC đọc là SECURITY DEFINER:
--   Policy SELECT của các bảng này chỉ là app_has_perm('view') (không phụ thuộc
--   từng dòng). Khi bảng bật RLS, Postgres KHÔNG cho dùng index với các toán tử
--   không "leakproof" như ILIKE / lower() → tìm kiếm phải quét toàn bảng.
--   Nên các RPC tự kiểm tra app_has_perm('view') ở đầu hàm (cùng ngữ nghĩa với
--   policy) rồi chạy truy vấn với quyền chủ sở hữu để dùng được index.
--   Tên bảng / cột luôn được kiểm tra trước khi ghép vào SQL động.
-- =============================================================================

create extension if not exists pg_trgm with schema public;


-- =============================================================================
-- 1. RLS — bọc hàm phân quyền trong (select ...) để Postgres tính 1 lần / truy vấn
--    (ngữ nghĩa giữ nguyên, chỉ đổi cách thực thi)
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['xg-nhap', 'xg-ton', 'tole-ton', 'pl-can-thu', 'pl-da-thu', 'pl-phieu-in'] loop
    execute format('alter policy app_select on public.%I using ((select public.app_has_perm(''view'')))', t);
    execute format('alter policy app_insert on public.%I with check ((select public.app_has_perm(''add'')))', t);
    execute format('alter policy app_update on public.%I using ((select public.app_has_perm(''edit''))) with check ((select public.app_has_perm(''edit'')))', t);
    execute format('alter policy app_delete on public.%I using ((select public.app_has_perm(''delete'')))', t);
  end loop;

  foreach t in array array['xg-xuat', 'tole-xuat'] loop
    execute format('alter policy app_select on public.%I using ((select public.app_has_perm(''view'')))', t);
    execute format('alter policy app_insert on public.%I with check ((select public.app_has_perm(''add'')))', t);
    execute format($p$alter policy app_update on public.%I
      using (((select public.is_admin()) is true) or ((select public.app_has_perm('edit')) and (created_at is null or created_at > now() - interval '24 hours')))
      with check (((select public.is_admin()) is true) or ((select public.app_has_perm('edit')) and (created_at is null or created_at > now() - interval '24 hours')))$p$, t);
    execute format($p$alter policy app_delete on public.%I
      using (((select public.is_admin()) is true) or ((select public.app_has_perm('delete')) and (created_at is null or created_at > now() - interval '24 hours')))$p$, t);
  end loop;
end $$;

alter policy app_select on public.kiem_ke_scans using ((select public.app_has_perm('view')));
alter policy app_insert on public.kiem_ke_scans with check ((select public.app_has_perm('view')));
alter policy app_delete on public.kiem_ke_scans using (((select public.is_admin()) is true));

alter policy app_select on public.xg_sap_mb51 using ((select public.app_has_perm('view')));
alter policy app_write on public.xg_sap_mb51 using ((select public.app_has_perm('add'))) with check ((select public.app_has_perm('add')));

alter policy app_select on public.inventory_locks using ((select public.app_has_perm('view')));
alter policy app_write on public.inventory_locks using ((select public.app_has_perm('add'))) with check ((select public.app_has_perm('add')));


-- =============================================================================
-- 2. CỜ TỒN KHO con_ton + NGÀY XUẤT ngay_xuat trên bảng nhập
--    con_ton   = true khi Cuộn ID khác rỗng và CHƯA có dòng xuất cùng Cuộn ID
--                (so khớp lower(trim()) — y hệt logic cũ ở trình duyệt)
--    ngay_xuat = "Ngày xuất" của dòng xuất mới nhất (id lớn nhất) cùng Cuộn ID có
--                Mã chứng từ + Ngày xuất (dùng cho chỉ số vòng quay ở trang biểu đồ)
--    Cả hai do trigger tự cập nhật, người dùng không ghi đè được.
-- =============================================================================

create index if not exists idx_xg_xuat_cuon_key on public."xg-xuat" (lower(trim("Cuộn ID")));
create index if not exists idx_tole_xuat_cuon_key on public."tole-xuat" (lower(trim("Cuộn ID")));
create index if not exists idx_xg_nhap_cuon_key on public."xg-nhap" (lower(trim("Cuộn ID")));
create index if not exists idx_tole_nhap_cuon_key on public."tole-nhap" (lower(trim("Cuộn ID")));

alter table public."xg-nhap" add column if not exists con_ton boolean not null default false;
alter table public."tole-nhap" add column if not exists con_ton boolean not null default false;
alter table public."xg-nhap" add column if not exists ngay_xuat date;
alter table public."tole-nhap" add column if not exists ngay_xuat date;

-- Trước khi ghi 1 dòng nhập: tự tính con_ton + ngay_xuat
create or replace function public.trg_nhap_con_ton()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(coalesce(new."Cuộn ID", '')));
  v_exported boolean;
  v_ngay_xuat date;
begin
  if v_key = '' then
    new.con_ton := false;
    new.ngay_xuat := null;
  else
    execute format($q$
      select exists (select 1 from public.%1$I x where lower(trim(x."Cuộn ID")) = $1),
             (select x."Ngày xuất" from public.%1$I x
               where lower(trim(x."Cuộn ID")) = $1 and trim(coalesce(x."Mã chứng từ", '')) <> '' and x."Ngày xuất" is not null
               order by x.id desc limit 1)
    $q$, tg_argv[0])
      into v_exported, v_ngay_xuat using v_key;
    new.con_ton := not v_exported;
    new.ngay_xuat := v_ngay_xuat;
  end if;
  return new;
end $$;

-- Sau khi ghi / xóa 1 dòng xuất: cập nhật con_ton + ngay_xuat của các dòng nhập cùng Cuộn ID
create or replace function public.trg_xuat_con_ton()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[] := '{}';
begin
  if tg_op = 'UPDATE'
     and lower(trim(coalesce(new."Cuộn ID", ''))) = lower(trim(coalesce(old."Cuộn ID", '')))
     and new."Ngày xuất" is not distinct from old."Ngày xuất"
     and trim(coalesce(new."Mã chứng từ", '')) = trim(coalesce(old."Mã chứng từ", '')) then
    return null;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_keys := v_keys || lower(trim(coalesce(new."Cuộn ID", '')));
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_keys := v_keys || lower(trim(coalesce(old."Cuộn ID", '')));
  end if;

  execute format($f$
    update public.%1$I n
       set con_ton = k.con_ton, ngay_xuat = k.ngay_xuat
      from (select key,
                   not exists (select 1 from public.%2$I x where lower(trim(x."Cuộn ID")) = key) as con_ton,
                   (select x."Ngày xuất" from public.%2$I x
                     where lower(trim(x."Cuộn ID")) = key and trim(coalesce(x."Mã chứng từ", '')) <> '' and x."Ngày xuất" is not null
                     order by x.id desc limit 1) as ngay_xuat
              from (select distinct unnest($1) as key) u
             where key <> '') k
     where lower(trim(n."Cuộn ID")) = k.key
       and (n.con_ton is distinct from k.con_ton or n.ngay_xuat is distinct from k.ngay_xuat)
  $f$, tg_argv[0], tg_table_name) using v_keys;
  return null;
end $$;

-- Tính lại toàn bộ (tạm bỏ trigger để chạy theo tập hợp, nhanh ở mọi kích thước)
drop trigger if exists trg_con_ton on public."xg-nhap";
drop trigger if exists trg_con_ton on public."tole-nhap";
drop trigger if exists trg_con_ton on public."xg-xuat";
drop trigger if exists trg_con_ton on public."tole-xuat";

with x as (
  select distinct on (lower(trim("Cuộn ID"))) lower(trim("Cuộn ID")) as k,
         case when trim(coalesce("Mã chứng từ", '')) <> '' and "Ngày xuất" is not null then "Ngày xuất" end as d,
         id
    from public."xg-xuat"
   where trim(coalesce("Cuộn ID", '')) <> ''
   order by lower(trim("Cuộn ID")), (trim(coalesce("Mã chứng từ", '')) <> '' and "Ngày xuất" is not null) desc, id desc
), v as (
  select n.id,
         (coalesce(trim(n."Cuộn ID"), '') <> '' and x.k is null) as con_ton,
         x.d as ngay_xuat
    from public."xg-nhap" n
    left join x on x.k = lower(trim(n."Cuộn ID")) and coalesce(trim(n."Cuộn ID"), '') <> ''
)
update public."xg-nhap" n
   set con_ton = v.con_ton, ngay_xuat = v.ngay_xuat
  from v
 where v.id = n.id and (n.con_ton is distinct from v.con_ton or n.ngay_xuat is distinct from v.ngay_xuat);

with x as (
  select distinct on (lower(trim("Cuộn ID"))) lower(trim("Cuộn ID")) as k,
         case when trim(coalesce("Mã chứng từ", '')) <> '' and "Ngày xuất" is not null then "Ngày xuất" end as d,
         id
    from public."tole-xuat"
   where trim(coalesce("Cuộn ID", '')) <> ''
   order by lower(trim("Cuộn ID")), (trim(coalesce("Mã chứng từ", '')) <> '' and "Ngày xuất" is not null) desc, id desc
), v as (
  select n.id,
         (coalesce(trim(n."Cuộn ID"), '') <> '' and x.k is null) as con_ton,
         x.d as ngay_xuat
    from public."tole-nhap" n
    left join x on x.k = lower(trim(n."Cuộn ID")) and coalesce(trim(n."Cuộn ID"), '') <> ''
)
update public."tole-nhap" n
   set con_ton = v.con_ton, ngay_xuat = v.ngay_xuat
  from v
 where v.id = n.id and (n.con_ton is distinct from v.con_ton or n.ngay_xuat is distinct from v.ngay_xuat);

create trigger trg_con_ton before insert or update on public."xg-nhap"
  for each row execute function public.trg_nhap_con_ton('xg-xuat');
create trigger trg_con_ton before insert or update on public."tole-nhap"
  for each row execute function public.trg_nhap_con_ton('tole-xuat');
create trigger trg_con_ton after insert or update or delete on public."xg-xuat"
  for each row execute function public.trg_xuat_con_ton('xg-nhap');
create trigger trg_con_ton after insert or update or delete on public."tole-xuat"
  for each row execute function public.trg_xuat_con_ton('tole-nhap');

create index if not exists idx_xg_nhap_ton on public."xg-nhap" (id) where con_ton;
create index if not exists idx_tole_nhap_ton on public."tole-nhap" (id) where con_ton;
create index if not exists idx_xg_nhap_ton_mavt on public."xg-nhap" ("Mã vật tư", id) where con_ton;
create index if not exists idx_tole_nhap_ton_mavt on public."tole-nhap" ("Mã vật tư", id) where con_ton;


-- =============================================================================
-- 3. TÌM KIẾM — mỗi bảng 1 hàm ghép các cột tìm kiếm + index trigram trên hàm đó.
--    Hàm SQL immutable được Postgres "inline", nên điều kiện
--    public.tim_kiem_xxx(t) ILIKE '%từ khóa%' dùng được index GIN.
-- =============================================================================

create or replace function public.tim_kiem_xg_nhap(r public."xg-nhap")
returns text language sql immutable parallel safe as $$
  select coalesce(r."Mã chứng từ", '') || E'\x1f' || coalesce(r."Phiếu nhập", '') || E'\x1f' ||
         coalesce(r."Loại nhập", '') || E'\x1f' || coalesce(r."Mã vật tư", '') || E'\x1f' ||
         coalesce(r."Tên vật tư", '') || E'\x1f' || coalesce(r."Batch", '') || E'\x1f' ||
         coalesce(r."Cuộn ID", '') || E'\x1f' || coalesce(r."Số lượng (Kg)"::text, '') || E'\x1f' ||
         coalesce(r."Vị trí", '') || E'\x1f' || coalesce(r."Mã công trình", '') || E'\x1f' ||
         coalesce(r."Tên công trình", '') || E'\x1f' || coalesce(r."Ghi chú", '')
$$;

create or replace function public.tim_kiem_tole_nhap(r public."tole-nhap")
returns text language sql immutable parallel safe as $$
  select coalesce(r."Mã chứng từ", '') || E'\x1f' || coalesce(r."Phiếu nhập", '') || E'\x1f' ||
         coalesce(r."Loại nhập", '') || E'\x1f' || coalesce(r."Mã vật tư", '') || E'\x1f' ||
         coalesce(r."Tên vật tư", '') || E'\x1f' || coalesce(r."Batch", '') || E'\x1f' ||
         coalesce(r."Cuộn ID", '') || E'\x1f' || coalesce(r."Số lượng (Kg)"::text, '') || E'\x1f' ||
         coalesce(r."Số lượng (m)"::text, '') || E'\x1f' || coalesce(r."Vị trí", '') || E'\x1f' ||
         coalesce(r."Mã công trình", '') || E'\x1f' || coalesce(r."Tên công trình", '') || E'\x1f' ||
         coalesce(r."Ghi chú", '')
$$;

create or replace function public.tim_kiem_xg_xuat(r public."xg-xuat")
returns text language sql immutable parallel safe as $$
  select coalesce(r."Mã chứng từ", '') || E'\x1f' || coalesce(r."Phiếu xuất", '') || E'\x1f' ||
         coalesce(r."Loại xuất", '') || E'\x1f' || coalesce(r."Mã vật tư", '') || E'\x1f' ||
         coalesce(r."Tên vật tư", '') || E'\x1f' || coalesce(r."Batch", '') || E'\x1f' ||
         coalesce(r."Cuộn ID", '') || E'\x1f' || coalesce(r."Số lượng (Kg)"::text, '') || E'\x1f' ||
         coalesce(r."Mã công trình", '') || E'\x1f' || coalesce(r."Tên công trình", '') || E'\x1f' ||
         coalesce(r."Ghi chú", '')
$$;

create or replace function public.tim_kiem_tole_xuat(r public."tole-xuat")
returns text language sql immutable parallel safe as $$
  select coalesce(r."Mã chứng từ", '') || E'\x1f' || coalesce(r."Phiếu xuất", '') || E'\x1f' ||
         coalesce(r."Loại xuất", '') || E'\x1f' || coalesce(r."Mã vật tư", '') || E'\x1f' ||
         coalesce(r."Tên vật tư", '') || E'\x1f' || coalesce(r."Batch", '') || E'\x1f' ||
         coalesce(r."Cuộn ID", '') || E'\x1f' || coalesce(r."Số lượng (Kg)"::text, '') || E'\x1f' ||
         coalesce(r."Số lượng (m)"::text, '') || E'\x1f' || coalesce(r."Mã công trình", '') || E'\x1f' ||
         coalesce(r."Tên công trình", '') || E'\x1f' || coalesce(r."Ghi chú", '')
$$;

-- Phế liệu: giữ đúng phạm vi tìm kiếm cũ (Xưởng, Loại phế liệu, Ghi chú)
create or replace function public.tim_kiem_pl_can_thu(r public."pl-can-thu")
returns text language sql immutable parallel safe as $$
  select coalesce(r."Xưởng", '') || E'\x1f' || coalesce(r."Loại phế liệu", '') || E'\x1f' || coalesce(r."Ghi chú", '')
$$;

create or replace function public.tim_kiem_pl_da_thu(r public."pl-da-thu")
returns text language sql immutable parallel safe as $$
  select coalesce(r."Xưởng", '') || E'\x1f' || coalesce(r."Loại phế liệu", '') || E'\x1f' || coalesce(r."Ghi chú", '')
$$;

create or replace function public.tim_kiem_pl_phieu_in(r public."pl-phieu-in")
returns text language sql immutable parallel safe as $$
  select coalesce(r."Số phiếu", '') || E'\x1f' || coalesce(r."Bên nhận/Xưởng/Đội", '') || E'\x1f' ||
         coalesce(r."Loại xuất", '') || E'\x1f' || coalesce(r."Mặt hàng", '') || E'\x1f' ||
         coalesce(r."Số xe", '') || E'\x1f' || coalesce(r."Mã công trình", '') || E'\x1f' ||
         coalesce(r."Tên công trình", '')
$$;

create index if not exists idx_xg_nhap_tim_kiem on public."xg-nhap" using gin (public.tim_kiem_xg_nhap("xg-nhap") gin_trgm_ops);
create index if not exists idx_tole_nhap_tim_kiem on public."tole-nhap" using gin (public.tim_kiem_tole_nhap("tole-nhap") gin_trgm_ops);
create index if not exists idx_xg_xuat_tim_kiem on public."xg-xuat" using gin (public.tim_kiem_xg_xuat("xg-xuat") gin_trgm_ops);
create index if not exists idx_tole_xuat_tim_kiem on public."tole-xuat" using gin (public.tim_kiem_tole_xuat("tole-xuat") gin_trgm_ops);
create index if not exists idx_pl_can_thu_tim_kiem on public."pl-can-thu" using gin (public.tim_kiem_pl_can_thu("pl-can-thu") gin_trgm_ops);
create index if not exists idx_pl_da_thu_tim_kiem on public."pl-da-thu" using gin (public.tim_kiem_pl_da_thu("pl-da-thu") gin_trgm_ops);
create index if not exists idx_pl_phieu_in_tim_kiem on public."pl-phieu-in" using gin (public.tim_kiem_pl_phieu_in("pl-phieu-in") gin_trgm_ops);

-- Bộ lọc "ilike" theo từng cột ở modal chọn cuộn tồn (Mã vật tư / Batch)
create index if not exists idx_xg_nhap_mavt_trgm on public."xg-nhap" using gin ("Mã vật tư" gin_trgm_ops) where con_ton;
create index if not exists idx_tole_nhap_mavt_trgm on public."tole-nhap" using gin ("Mã vật tư" gin_trgm_ops) where con_ton;


-- =============================================================================
-- 4. INDEX BTREE cho các bộ lọc
-- =============================================================================

create index if not exists idx_xg_nhap_ngay on public."xg-nhap" ("Ngày nhập", id);
create index if not exists idx_xg_nhap_loai on public."xg-nhap" ("Loại nhập");
create index if not exists idx_xg_nhap_mact on public."xg-nhap" ("Mã chứng từ");
create index if not exists idx_xg_nhap_mavt_key on public."xg-nhap" (lower(trim("Mã vật tư")));
create index if not exists idx_xg_nhap_phieu_key on public."xg-nhap" (lower(trim("Phiếu nhập")));
create index if not exists idx_xg_nhap_vitri_key on public."xg-nhap" (lower(trim("Vị trí"))) where con_ton;

create index if not exists idx_tole_nhap_ngay on public."tole-nhap" ("Ngày nhập", id);
create index if not exists idx_tole_nhap_loai on public."tole-nhap" ("Loại nhập");
create index if not exists idx_tole_nhap_mact on public."tole-nhap" ("Mã chứng từ");
create index if not exists idx_tole_nhap_mavt_key on public."tole-nhap" (lower(trim("Mã vật tư")));
create index if not exists idx_tole_nhap_phieu_key on public."tole-nhap" (lower(trim("Phiếu nhập")));
create index if not exists idx_tole_nhap_vitri_key on public."tole-nhap" (lower(trim("Vị trí"))) where con_ton;

create index if not exists idx_xg_xuat_ngay on public."xg-xuat" ("Ngày xuất", id);
create index if not exists idx_xg_xuat_loai on public."xg-xuat" ("Loại xuất");
create index if not exists idx_xg_xuat_mact on public."xg-xuat" ("Mã chứng từ");
create index if not exists idx_xg_xuat_phieu_key on public."xg-xuat" (lower(trim("Phiếu xuất")));

create index if not exists idx_tole_xuat_ngay on public."tole-xuat" ("Ngày xuất", id);
create index if not exists idx_tole_xuat_loai on public."tole-xuat" ("Loại xuất");
create index if not exists idx_tole_xuat_mact on public."tole-xuat" ("Mã chứng từ");
create index if not exists idx_tole_xuat_phieu_key on public."tole-xuat" (lower(trim("Phiếu xuất")));

create index if not exists idx_pl_can_thu_ngay on public."pl-can-thu" ("Ngày", id);
create index if not exists idx_pl_can_thu_kido on public."pl-can-thu" ("Kì đổ");
create index if not exists idx_pl_can_thu_xuong on public."pl-can-thu" ("Xưởng");
create index if not exists idx_pl_can_thu_loai on public."pl-can-thu" ("Loại phế liệu");

create index if not exists idx_pl_da_thu_ngay on public."pl-da-thu" ("Ngày", id);
create index if not exists idx_pl_da_thu_kido on public."pl-da-thu" ("Kì đổ");
create index if not exists idx_pl_da_thu_xuong on public."pl-da-thu" ("Xưởng");
create index if not exists idx_pl_da_thu_loai on public."pl-da-thu" ("Loại phế liệu");

create index if not exists idx_pl_phieu_in_ngay on public."pl-phieu-in" ("Ngày", id);
create index if not exists idx_pl_phieu_in_so_phieu on public."pl-phieu-in" ("Số phiếu");
create index if not exists idx_pl_phieu_in_loai on public."pl-phieu-in" ("Loại xuất");
-- Tra cứu mọi dòng của 1 số phiếu (ieq) và tìm số phiếu lớn nhất trong tháng ("chứa YYMM-")
create index if not exists idx_pl_phieu_in_so_phieu_key on public."pl-phieu-in" (lower(trim("Số phiếu")));
create index if not exists idx_pl_phieu_in_so_phieu_trgm on public."pl-phieu-in" using gin ("Số phiếu" gin_trgm_ops);


-- =============================================================================
-- 5. RPC TRUY VẤN CHUNG (lọc + phân trang + tổng ở server)
--
--    p_filters (jsonb), mọi khóa đều tùy chọn:
--      "range":     [{"col": "Ngày nhập", "gte": "2026-01-01", "lte": "2026-01-31", "gt": .., "lt": ..}]
--      "in":        {"Loại nhập": ["Nhà cung cấp", "Công trình"]}
--      "eq":        {"Mã vật tư": "ABC"}            (null → IS NULL)
--      "ieq":       {"Vị trí": "a01"}               (lower(trim()) bằng nhau)
--      "ilike":     {"Batch": "123"}                (chứa chuỗi, không phân biệt hoa thường)
--      "not_empty": ["Mã chứng từ"]
--      "search":    "từ khóa"                       (hàm tim_kiem_<bảng>)
--      "ton":       true                            (chỉ bảng nhập: con_ton)
--      "ids":       [1, 2, 3]
--      "one_of":    [{"col": "Xưởng", "values": ["A"], "blank": true}]   (thuộc danh sách / ô trống)
--      "and":       [{...bộ lọc con...}]            (AND thêm các nhóm điều kiện)
-- =============================================================================

create or replace function public._qry_require_view()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.app_has_perm('view') is not true then
    raise exception 'Tài khoản không có quyền xem dữ liệu' using errcode = '42501';
  end if;
end $$;

create or replace function public._qry_rel(p_table text)
returns regclass
language plpgsql
stable
set search_path = public
as $$
begin
  if p_table is null or p_table not in (
    'xg-nhap', 'xg-xuat', 'tole-nhap', 'tole-xuat',
    'pl-can-thu', 'pl-da-thu', 'pl-chua-thu', 'pl-phieu-in'
  ) then
    raise exception 'Bảng không được phép truy vấn: %', coalesce(p_table, '(null)') using errcode = '42501';
  end if;
  return format('public.%I', p_table)::regclass;
end $$;

create or replace function public._qry_col(p_rel regclass, p_col text, p_alias text default 't')
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if p_col is null or not exists (
    select 1 from pg_attribute
     where attrelid = p_rel and attname = p_col and attnum > 0 and not attisdropped
  ) then
    raise exception 'Cột không hợp lệ: %', coalesce(p_col, '(null)') using errcode = '42703';
  end if;
  return format('%s.%I', p_alias, p_col);
end $$;

create or replace function public._qry_like_escape(p text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(p, '\', '\\'), '%', '\%'), '_', '\_')
$$;

create or replace function public._qry_where(p_table text, p_filters jsonb)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_rel regclass := public._qry_rel(p_table);
  v_parts text[] := array['true'];
  v_item jsonb;
  v_key text;
  v_val jsonb;
  v_col text;
  v_list text;
  v_op record;
begin
  if p_filters is null or jsonb_typeof(p_filters) <> 'object' then
    return 'true';
  end if;

  if jsonb_typeof(p_filters->'range') = 'array' then
    for v_item in select value from jsonb_array_elements(p_filters->'range') loop
      v_col := public._qry_col(v_rel, v_item->>'col');
      for v_op in select * from (values ('gte', '>='), ('lte', '<='), ('gt', '>'), ('lt', '<')) as o(k, sym) loop
        if nullif(v_item->>v_op.k, '') is not null then
          v_parts := v_parts || format('%s %s %L', v_col, v_op.sym, v_item->>v_op.k);
        end if;
      end loop;
    end loop;
  end if;

  if jsonb_typeof(p_filters->'in') = 'object' then
    for v_key, v_val in select key, value from jsonb_each(p_filters->'in') loop
      v_col := public._qry_col(v_rel, v_key);
      if jsonb_typeof(v_val) = 'array' and jsonb_array_length(v_val) > 0 then
        select string_agg(format('%L', x), ', ') into v_list from jsonb_array_elements_text(v_val) as x;
        v_parts := v_parts || format('%s in (%s)', v_col, v_list);
      end if;
    end loop;
  end if;

  if jsonb_typeof(p_filters->'eq') = 'object' then
    for v_key, v_val in select key, value from jsonb_each(p_filters->'eq') loop
      v_col := public._qry_col(v_rel, v_key);
      if jsonb_typeof(v_val) = 'null' then
        v_parts := v_parts || format('%s is null', v_col);
      else
        v_parts := v_parts || format('%s = %L', v_col, v_val #>> '{}');
      end if;
    end loop;
  end if;

  if jsonb_typeof(p_filters->'ieq') = 'object' then
    for v_key, v_val in select key, value from jsonb_each(p_filters->'ieq') loop
      v_col := public._qry_col(v_rel, v_key);
      v_parts := v_parts || format('lower(trim(%s)) = lower(trim(%L))', v_col, v_val #>> '{}');
    end loop;
  end if;

  if jsonb_typeof(p_filters->'ilike') = 'object' then
    for v_key, v_val in select key, value from jsonb_each(p_filters->'ilike') loop
      v_col := public._qry_col(v_rel, v_key);
      if coalesce(v_val #>> '{}', '') <> '' then
        v_parts := v_parts || format('%s ilike %L', v_col, '%' || public._qry_like_escape(v_val #>> '{}') || '%');
      end if;
    end loop;
  end if;

  if jsonb_typeof(p_filters->'not_empty') = 'array' then
    for v_key in select value from jsonb_array_elements_text(p_filters->'not_empty') loop
      v_col := public._qry_col(v_rel, v_key);
      v_parts := v_parts || format('coalesce(trim(%s), '''') <> ''''', v_col);
    end loop;
  end if;

  if coalesce(trim(p_filters->>'search'), '') <> '' then
    if to_regprocedure(format('public.tim_kiem_%s(public.%I)', replace(p_table, '-', '_'), p_table)) is null then
      raise exception 'Bảng % không hỗ trợ tìm kiếm', p_table using errcode = '0A000';
    end if;
    v_parts := v_parts || format('public.%I(t) ilike %L',
      'tim_kiem_' || replace(p_table, '-', '_'),
      '%' || public._qry_like_escape(trim(p_filters->>'search')) || '%');
  end if;

  if coalesce((p_filters->>'ton')::boolean, false) then
    v_parts := v_parts || public._qry_col(v_rel, 'con_ton');
  end if;

  if jsonb_typeof(p_filters->'ids') = 'array' and jsonb_array_length(p_filters->'ids') > 0 then
    select string_agg(format('%L', x), ', ') into v_list from jsonb_array_elements_text(p_filters->'ids') as x;
    v_parts := v_parts || format('t.id in (%s)', v_list);
  end if;

  -- Bộ lọc theo cột trên tiêu đề bảng: giá trị thuộc danh sách, tùy chọn kèm ô trống
  if jsonb_typeof(p_filters->'one_of') = 'array' then
    for v_item in select value from jsonb_array_elements(p_filters->'one_of') loop
      v_col := public._qry_col(v_rel, v_item->>'col');
      v_list := null;
      if jsonb_typeof(v_item->'values') = 'array' then
        select string_agg(format('%L', x), ', ') into v_list
          from jsonb_array_elements_text(v_item->'values') as x where x is not null;
      end if;
      v_parts := v_parts || format('(%s%s)',
        case when v_list is null then 'false' else format('%s in (%s)', v_col, v_list) end,
        case when coalesce((v_item->>'blank')::boolean, false)
             then format(' or %1$s is null or trim(%1$s::text) = ''''', v_col) else '' end);
    end loop;
  end if;

  -- Ghép thêm các nhóm điều kiện (AND), vd: bộ lọc trang + bộ lọc cột trên cùng 1 cột
  if jsonb_typeof(p_filters->'and') = 'array' then
    for v_item in select value from jsonb_array_elements(p_filters->'and') loop
      v_parts := v_parts || ('(' || public._qry_where(p_table, v_item) || ')');
    end loop;
  end if;

  return array_to_string(v_parts, ' and ');
end $$;

-- Danh sách dòng theo trang + (tùy chọn) tổng số dòng và tổng các cột số
create or replace function public.qry_rows(
  p_table text,
  p_filters jsonb default '{}'::jsonb,
  p_order jsonb default '[{"col": "id", "asc": true}]'::jsonb,
  p_limit integer default 100,
  p_offset integer default 0,
  p_with_total boolean default true,
  p_sum_cols text[] default null,
  p_columns text[] default null,
  p_total_hint bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '30s'
as $$
declare
  v_rel regclass;
  v_where text;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 1000);
  v_offset bigint := greatest(coalesce(p_offset, 0), 0);
  v_order_t text := '';      -- thứ tự xuôi (alias t)
  v_order_t_rev text := '';  -- thứ tự ngược (alias t)
  v_order_s text := '';      -- thứ tự xuôi (alias s, để gom kết quả)
  v_has_id boolean := false;
  v_select text := 't.*';
  v_cols text[];
  v_item jsonb;
  v_asc boolean;
  v_col text;
  v_sum_sql text;
  v_stats jsonb;
  v_total bigint;
  v_known bigint;
  v_rows jsonb;
  v_lim2 bigint;
  v_off2 bigint;
begin
  perform public._qry_require_view();
  v_rel := public._qry_rel(p_table);
  v_where := public._qry_where(p_table, p_filters);

  for v_item in select value from jsonb_array_elements(coalesce(p_order, '[]'::jsonb)) loop
    v_col := v_item->>'col';
    v_asc := coalesce((v_item->>'asc')::boolean, true);
    v_order_t := v_order_t || case when v_order_t = '' then '' else ', ' end
      || public._qry_col(v_rel, v_col) || case when v_asc then ' asc' else ' desc' end;
    v_order_t_rev := v_order_t_rev || case when v_order_t_rev = '' then '' else ', ' end
      || public._qry_col(v_rel, v_col) || case when v_asc then ' desc' else ' asc' end;
    v_order_s := v_order_s || case when v_order_s = '' then '' else ', ' end
      || public._qry_col(v_rel, v_col, 's') || case when v_asc then ' asc' else ' desc' end;
    v_cols := v_cols || v_col;
    if v_col = 'id' then v_has_id := true; end if;
  end loop;
  if not v_has_id then
    v_order_t := v_order_t || case when v_order_t = '' then '' else ', ' end || 't.id asc';
    v_order_t_rev := v_order_t_rev || case when v_order_t_rev = '' then '' else ', ' end || 't.id desc';
    v_order_s := v_order_s || case when v_order_s = '' then '' else ', ' end || 's.id asc';
    v_cols := v_cols || 'id'::text;
  end if;

  if p_columns is not null and array_length(p_columns, 1) > 0 then
    select string_agg(public._qry_col(v_rel, c), ', ')
      into v_select
      from (select distinct c from unnest(p_columns || v_cols) as c) x;
  end if;

  if coalesce(p_with_total, false) or coalesce(array_length(p_sum_cols, 1), 0) > 0 then
    if coalesce(array_length(p_sum_cols, 1), 0) > 0 then
      select string_agg(format('%L, coalesce(sum(%s), 0)', c, public._qry_col(v_rel, c)), ', ')
        into v_sum_sql
        from unnest(p_sum_cols) as c;
    end if;
    execute format('select jsonb_build_object(''total'', count(*), ''sums'', jsonb_build_object(%s)) from %s t where %s',
                   coalesce(v_sum_sql, ''), v_rel, v_where)
      into v_stats;
    v_total := (v_stats->>'total')::bigint;
  end if;

  v_known := coalesce(v_total, p_total_hint);

  -- Trang ở nửa sau: đọc theo thứ tự ngược với OFFSET nhỏ rồi đảo lại (trang cuối vẫn nhanh)
  if v_known is not null and v_offset > v_known / 2 then
    v_lim2 := least(v_limit::bigint, greatest(v_known - v_offset, 0));
    v_off2 := greatest(v_known - v_offset - v_limit, 0);
    if v_lim2 <= 0 then
      v_rows := '[]'::jsonb;
    else
      execute format('select coalesce(jsonb_agg(to_jsonb(s) order by %s), ''[]''::jsonb) from (select %s from %s t where %s order by %s limit %s offset %s) s',
                     v_order_s, v_select, v_rel, v_where, v_order_t_rev, v_lim2, v_off2)
        into v_rows;
    end if;
  else
    execute format('select coalesce(jsonb_agg(to_jsonb(s) order by %s), ''[]''::jsonb) from (select %s from %s t where %s order by %s limit %s offset %s) s',
                   v_order_s, v_select, v_rel, v_where, v_order_t, v_limit, v_offset)
      into v_rows;
  end if;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'sums', coalesce(v_stats->'sums', '{}'::jsonb)
  );
end $$;

-- Tổng theo nhóm (vd: tồn kho nhóm theo Mã vật tư)
create or replace function public.qry_group(
  p_table text,
  p_filters jsonb,
  p_group_col text,
  p_sum_cols text[] default null,
  p_keys jsonb default null,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '30s'
as $$
declare
  v_rel regclass;
  v_where text;
  v_group text;
  v_sum_sql text;
  v_list text;
  v_result jsonb;
begin
  perform public._qry_require_view();
  v_rel := public._qry_rel(p_table);
  v_where := public._qry_where(p_table, p_filters);
  v_group := public._qry_col(v_rel, p_group_col);

  if coalesce(array_length(p_sum_cols, 1), 0) > 0 then
    select string_agg(format('%L, coalesce(sum(%s), 0)', c, public._qry_col(v_rel, c)), ', ')
      into v_sum_sql
      from unnest(p_sum_cols) as c;
  end if;

  if jsonb_typeof(p_keys) = 'array' then
    if jsonb_array_length(p_keys) = 0 then
      return '[]'::jsonb;
    end if;
    select string_agg(format('%L', x), ', ') into v_list
      from jsonb_array_elements_text(p_keys) as x where x is not null;
    v_where := v_where || format(' and (%s%s)',
      case when v_list is null then 'false' else format('%s in (%s)', v_group, v_list) end,
      case when p_keys @> '[null]'::jsonb then format(' or %s is null', v_group) else '' end);
  end if;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''key'', g.k, ''count'', g.c, ''sums'', g.s) order by g.k nulls first), ''[]''::jsonb)
       from (select %1$s as k, count(*) as c, jsonb_build_object(%2$s) as s
               from %3$s t where %4$s group by 1 order by 1 nulls first limit %5$s) g',
    v_group, coalesce(v_sum_sql, ''), v_rel, v_where, least(greatest(coalesce(p_limit, 1000), 1), 5000))
    into v_result;
  return v_result;
end $$;

-- Danh sách giá trị khác nhau của 1 cột (cho dropdown lọc).
-- Không có bộ lọc → "loose index scan" (nhảy qua index) nên nhanh ở mọi kích thước bảng.
create or replace function public.qry_distinct(
  p_table text,
  p_col text,
  p_filters jsonb default null,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '30s'
as $$
declare
  v_rel regclass;
  v_col text;
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_result jsonb;
begin
  perform public._qry_require_view();
  v_rel := public._qry_rel(p_table);
  v_col := public._qry_col(v_rel, p_col);

  if (p_filters is null or p_filters = '{}'::jsonb)
     and (select relkind from pg_class where oid = v_rel) = 'r' then
    execute format($q$
      with recursive r(v) as (
        (select %1$s from %2$s t where %1$s is not null order by %1$s limit 1)
        union all
        select (select %1$s from %2$s t where %1$s > r.v order by %1$s limit 1)
          from r where r.v is not null
      )
      select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
        from (select v from r where v is not null limit %3$s) x
    $q$, v_col, v_rel, v_limit)
      into v_result;
  else
    execute format(
      'select coalesce(jsonb_agg(v order by v), ''[]''::jsonb) from (select distinct %1$s as v from %2$s t where %3$s and %1$s is not null order by 1 limit %4$s) x',
      v_col, v_rel, public._qry_where(p_table, p_filters), v_limit)
      into v_result;
  end if;
  return v_result;
end $$;


-- =============================================================================
-- 6. SỐ CUỘN KẾ TIẾP cho 1 mã vật tư (thay cho việc quét toàn bộ bảng ở trình duyệt)
--    Giống getNextRollNumber() cũ: lớn nhất của "Cuộn <số>" + 1, chưa có thì 0
-- =============================================================================

create or replace function public.next_roll_number(
  p_table text,
  p_ma_vt text,
  p_exclude_id bigint default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_max numeric;
begin
  perform public._qry_require_view();
  if p_table not in ('xg-nhap', 'tole-nhap') then
    raise exception 'Bảng không hợp lệ: %', p_table using errcode = '42501';
  end if;
  if coalesce(trim(p_ma_vt), '') = '' then
    return 0;
  end if;
  execute format($q$
    select max(substring(t."Cuộn ID" from '(?i)(?:Cuộn|cuon)\s*(\d+)')::numeric)
      from public.%I t
     where lower(trim(t."Mã vật tư")) = lower(trim($1))
       and ($2::bigint is null or t.id <> $2::bigint)
  $q$, p_table)
    into v_max using p_ma_vt, p_exclude_id;
  return coalesce(v_max + 1, 0);
end $$;


-- =============================================================================
-- 7. DASHBOARD BIỂU ĐỒ (xà gồ / tole) — toàn bộ số liệu tính ở server.
--    Tái hiện đúng các công thức đang có trong xg-bieu-do.js / tole-bieu-do.js.
--    p_today: ngày hiện tại theo giờ máy người dùng (tránh lệch múi giờ UTC).
--    Kết quả được cache; cache tự xóa khi bảng nhập / xuất của kho đó thay đổi.
-- =============================================================================

create or replace function public._dashboard_kho_compute(
  p_kho text,
  p_from date,
  p_to date,
  p_today date
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_nhap regclass;
  v_xuat regclass;
  v_frac constant numeric := 86399999 / 86400000.0;  -- 23:59:59.999 tính theo ngày
  v_end date := coalesce(p_to, p_today);
  v_begin_ref date := coalesce(p_from, p_today);
  v_result jsonb := '{}'::jsonb;
  v_part jsonb;
  v_ton_count bigint;
  v_ton_sum numeric;
  v_earliest date;
  v_start date;
  v_avg numeric;
  v_days numeric;
begin
  if p_kho = 'xg' then
    v_nhap := 'public."xg-nhap"'::regclass;
    v_xuat := 'public."xg-xuat"'::regclass;
  elsif p_kho = 'tole' then
    v_nhap := 'public."tole-nhap"'::regclass;
    v_xuat := 'public."tole-xuat"'::regclass;
  else
    raise exception 'Kho không hợp lệ: %', p_kho using errcode = '22023';
  end if;

  -- Nhập / xuất: gom theo (ngày, loại) 1 lần, rồi suy ra tổng / theo loại / theo tháng
  execute format($q$
    with nd as materialized (
      select d, lower(trim(coalesce(l, ''))) as loai, kg
        from (select "Ngày nhập" as d, "Loại nhập" as l, sum(coalesce("Số lượng (Kg)", 0)) as kg
                from %1$s
               where trim(coalesce("Mã chứng từ", '')) <> '' and "Ngày nhập" is not null
               group by 1, 2) g
    ), xd as materialized (
      select d, lower(trim(coalesce(l, ''))) as loai, kg
        from (select "Ngày xuất" as d, "Loại xuất" as l, sum(coalesce("Số lượng (Kg)", 0)) as kg
                from %2$s
               where trim(coalesce("Mã chứng từ", '')) <> '' and "Ngày xuất" is not null
               group by 1, 2) g
    ), nr as (
      select * from nd where ($1::date is null or d >= $1) and ($2::date is null or d <= $2)
    ), xr as (
      select * from xd where ($1::date is null or d >= $1) and ($2::date is null or d <= $2)
    ), nt as (
      select case
               when strpos(loai, 'nhà cung cấp') > 0 or strpos(loai, 'ncc') > 0 then 'ncc'
               when strpos(loai, 'xưởng') > 0 or strpos(loai, 'sản xuất') > 0 or strpos(loai, 'xuong') > 0 then 'xuong'
               when strpos(loai, 'gia công') > 0 or strpos(loai, 'gia cong') > 0 or strpos(loai, 'giao') > 0 then 'giaCong'
               when strpos(loai, 'công trình') > 0 or strpos(loai, 'cong trinh') > 0 or strpos(loai, 'ct') > 0 then 'congTrinh'
             end as k, sum(kg) as kg
        from nr group by 1
    ), xt as (
      select case
               when strpos(loai, 'xưởng') > 0 or strpos(loai, 'sản xuất') > 0 or strpos(loai, 'xuong') > 0 then 'xuong'
               when strpos(loai, 'điều chuyển') > 0 or strpos(loai, 'dieu chuyen') > 0 or strpos(loai, 'dc') > 0 then 'dieuChuyen'
               when strpos(loai, 'gia công') > 0 or strpos(loai, 'gia cong') > 0 or strpos(loai, 'giao') > 0 then 'giaCong'
               when strpos(loai, 'công trình') > 0 or strpos(loai, 'cong trinh') > 0 or strpos(loai, 'ct') > 0 then 'congTrinh'
             end as k, sum(kg) as kg
        from xr group by 1
    )
    select jsonb_build_object(
      'totalImport', (select coalesce(sum(kg), 0) from nr),
      'totalExport', (select coalesce(sum(kg), 0) from xr),
      'importByType', jsonb_build_object(
        'ncc', coalesce((select kg from nt where k = 'ncc'), 0),
        'xuong', coalesce((select kg from nt where k = 'xuong'), 0),
        'giaCong', coalesce((select kg from nt where k = 'giaCong'), 0),
        'congTrinh', coalesce((select kg from nt where k = 'congTrinh'), 0)),
      'exportByType', jsonb_build_object(
        'xuong', coalesce((select kg from xt where k = 'xuong'), 0),
        'dieuChuyen', coalesce((select kg from xt where k = 'dieuChuyen'), 0),
        'giaCong', coalesce((select kg from xt where k = 'giaCong'), 0),
        'congTrinh', coalesce((select kg from xt where k = 'congTrinh'), 0)),
      'months', coalesce((
        select jsonb_agg(jsonb_build_object('m', m, 'import', imp, 'export', exp) order by m)
          from (select m, sum(imp) as imp, sum(exp) as exp from (
                  select to_char(date_trunc('month', d), 'YYYY-MM') as m, kg as imp, 0::numeric as exp from nr
                  union all
                  select to_char(date_trunc('month', d), 'YYYY-MM'), 0, kg from xr) u
                group by m) mm), '[]'::jsonb),
      'globalMonths', coalesce((
        select jsonb_agg(jsonb_build_object('m', m, 'import', imp, 'export', exp) order by m)
          from (select m, sum(imp) as imp, sum(exp) as exp from (
                  select to_char(date_trunc('month', d), 'YYYY-MM') as m, kg as imp, 0::numeric as exp from nd
                  union all
                  select to_char(date_trunc('month', d), 'YYYY-MM'), 0, kg from xd) u
                group by m) gm), '[]'::jsonb)
    )
  $q$, v_nhap, v_xuat)
    into v_part using p_from, p_to;
  v_result := v_result || v_part;

  -- Tồn kho hiện tại (con_ton) + tuổi tồn trung bình
  if p_kho = 'xg' then
    execute format($q$
      select count(*), coalesce(sum(coalesce("Số lượng (Kg)", 0)), 0),
             avg(($1 - "Ngày nhập") + $2) filter (where "Ngày nhập" is not null and "Ngày nhập" <= $1)
        from %s where con_ton
    $q$, v_nhap)
      into v_ton_count, v_ton_sum, v_avg using v_end, v_frac;
  else
    execute format($q$
      select count(*), coalesce(sum(coalesce("Số lượng (Kg)", 0)), 0),
             avg($1 - "Ngày nhập") filter (where "Ngày nhập" is not null and "Ngày nhập" <= $1)
        from %s where con_ton
    $q$, v_nhap)
      into v_ton_count, v_ton_sum, v_avg using p_today;
  end if;
  v_result := v_result || jsonb_build_object(
    'totalCurrentStock', v_ton_sum,
    'stockCount', v_ton_count,
    'averageStockAge', coalesce(v_avg, 0));

  -- Tồn đầu kì / cuối kì
  if v_ton_count > 0 then
    execute format($q$
      select jsonb_build_object(
        'inventoryBegin', coalesce(sum(coalesce("Số lượng (Kg)", 0)) filter (where "Ngày nhập" <= $1), 0),
        'inventoryEnd', coalesce(sum(coalesce("Số lượng (Kg)", 0)) filter (where "Ngày nhập" <= $2), 0))
        from %s where con_ton and "Ngày nhập" is not null
    $q$, v_nhap)
      into v_part using v_begin_ref, v_end;
  else
    execute format($q$
      with n as (
        select "Ngày nhập" as d, coalesce("Số lượng (Kg)", 0) as kg from %1$s where trim(coalesce("Mã chứng từ", '')) <> ''
      ), x as (
        select "Ngày xuất" as d, coalesce("Số lượng (Kg)", 0) as kg from %2$s where trim(coalesce("Mã chứng từ", '')) <> ''
      )
      select jsonb_build_object(
        'inventoryBegin', greatest(0,
          case when $1::date is null
               then (select coalesce(sum(kg), 0) from n) - (select coalesce(sum(kg), 0) from x)
               else (select coalesce(sum(kg), 0) from n where d < $1) - (select coalesce(sum(kg), 0) from x where d < $1)
          end),
        'inventoryEnd', greatest(0,
          (select coalesce(sum(kg), 0) from n where d <= $2) - (select coalesce(sum(kg), 0) from x where d <= $2)))
    $q$, v_nhap, v_xuat)
      into v_part using p_from, v_end;
  end if;
  v_result := v_result || v_part;

  -- Vòng quay tồn kho & số ngày tồn trung bình theo từng cuộn nhập.
  -- Ngày xuất của cuộn lấy từ cột ngay_xuat (trigger duy trì) nên chỉ cần quét bảng nhập 1 lượt.
  execute format($q$
    select min("Ngày nhập")
      from %s
     where trim(coalesce("Mã chứng từ", '')) <> '' and trim(coalesce("Cuộn ID", '')) <> '' and "Ngày nhập" is not null
  $q$, v_nhap)
    into v_earliest;
  v_start := coalesce(p_from, v_earliest, p_today);

  execute format($q$
    select avg(greatest(0,
             case when $4 = 'xg' then
               case when ngay_xuat is not null and ngay_xuat <= $2 then (ngay_xuat - "Ngày nhập")::numeric
                    else ($2 - "Ngày nhập") + $3 end
             else
               case when ngay_xuat is not null and ngay_xuat <= $2 then (ngay_xuat - greatest("Ngày nhập", $1))::numeric
                    else ($2 - greatest("Ngày nhập", $1)) + $3 end
             end))
      from %s
     where trim(coalesce("Mã chứng từ", '')) <> '' and trim(coalesce("Cuộn ID", '')) <> '' and "Ngày nhập" is not null
       and "Ngày nhập" <= $2
       and not (ngay_xuat is not null and ngay_xuat < $1)
  $q$, v_nhap)
    into v_avg using v_start, v_end, v_frac, p_kho;
  v_days := case when v_end >= v_start then (v_end - v_start) + 1 else (v_start - v_end) end;
  if v_days = 0 then v_days := 1; end if;
  v_result := v_result || jsonb_build_object('rollMetrics', jsonb_build_object(
    'averageStorageDays', coalesce(v_avg, 0),
    'turnover', case when coalesce(v_avg, 0) > 0 then v_days / v_avg else 0 end));

  -- Vật tư nhập / xuất (khóa = "Mã VT - Batch" như JS) và phân bổ xuất theo công trình.
  -- Gom 2 tầng: theo cột gốc trước (nhanh), rồi mới chuẩn hóa khóa trên tập nhỏ.
  execute format($q$
    with g as (
      select "Mã vật tư" as ma0, "Batch" as b0,
             case when trim(coalesce("Mã vật tư", '')) = '' then "Tên vật tư" end as ten0,
             sum(coalesce("Số lượng (Kg)", 0)) as kg, min(id) as first_id,
             min(id) filter (where trim(coalesce("Tên vật tư", '')) <> '') as ten_id
        from %1$s
       where trim(coalesce("Mã chứng từ", '')) <> '' and "Ngày nhập" is not null
         and ($1::date is null or "Ngày nhập" >= $1) and ($2::date is null or "Ngày nhập" <= $2)
       group by 1, 2, 3
    ), k as (
      select *, (batch <> '' and batch <> '-' and lower(batch) not in ('không batch', 'khong batch')) as has_batch
        from (select g.*, trim(coalesce(ma0, '')) as ma, trim(coalesce(b0, '')) as batch, trim(coalesce(ten0, '')) as ten from g) z
    ), top as (
      select key, sum(kg) as qty, min(first_id) as fid, min(ten_id) as tid
        from (select case
                       when ma <> '' and has_batch then ma || ' - ' || batch
                       when ma <> '' then ma
                       when has_batch then batch
                       when ten <> '' then ten
                       else '(Không xác định)'
                     end as key, kg, first_id, ten_id
                from k) kk
       group by key
       order by sum(kg) desc, min(first_id)
       limit 10
    )
    select coalesce(jsonb_agg(jsonb_build_object('key', top.key, 'qty', top.qty, 'ten', coalesce(trim(n."Tên vật tư"), ''))
                              order by top.qty desc, top.fid), '[]'::jsonb)
      from top left join %1$s n on n.id = top.tid
  $q$, v_nhap)
    into v_part using p_from, p_to;
  v_result := v_result || jsonb_build_object('importMaterials', v_part);

  execute format($q$
    with base as not materialized (
      select * from %1$s
       where trim(coalesce("Mã chứng từ", '')) <> '' and "Ngày xuất" is not null
         and ($1::date is null or "Ngày xuất" >= $1) and ($2::date is null or "Ngày xuất" <= $2)
    ), g as (
      select "Mã vật tư" as ma0, "Batch" as b0,
             case when trim(coalesce("Mã vật tư", '')) = '' then "Tên vật tư" end as ten0,
             sum(coalesce("Số lượng (Kg)", 0)) as kg, min(id) as first_id,
             min(id) filter (where trim(coalesce("Tên vật tư", '')) <> '') as ten_id
        from base group by 1, 2, 3
    ), k as (
      select *, (batch <> '' and batch <> '-' and lower(batch) not in ('không batch', 'khong batch')) as has_batch
        from (select g.*, trim(coalesce(ma0, '')) as ma, trim(coalesce(b0, '')) as batch, trim(coalesce(ten0, '')) as ten from g) z
    ), top as (
      select key, sum(kg) as qty, min(first_id) as fid, min(ten_id) as tid
        from (select case
                       when ma <> '' and has_batch then ma || ' - ' || batch
                       when ma <> '' then ma
                       when has_batch then batch
                       when ten <> '' then ten
                       else '(Không xác định)'
                     end as key, kg, first_id, ten_id
                from k) kk
       group by key
       order by sum(kg) desc, min(first_id)
       limit 10
    ), w as (
      select trim(ct0) as ct, sum(kg) as qty, min(first_id) as first_id
        from (select "Tên công trình" as ct0, sum(coalesce("Số lượng (Kg)", 0)) as kg, min(id) as first_id
                from base group by 1) w0
       where trim(coalesce(ct0, '')) <> ''
       group by 1
    )
    select jsonb_build_object(
      'exportMaterials', coalesce((
        select jsonb_agg(jsonb_build_object('key', top.key, 'qty', top.qty, 'ten', coalesce(trim(n."Tên vật tư"), ''))
                         order by top.qty desc, top.fid)
          from top left join %1$s n on n.id = top.tid), '[]'::jsonb),
      'workshops', coalesce((
        select jsonb_agg(jsonb_build_object('name', ct, 'qty', qty) order by qty desc, first_id) from w), '[]'::jsonb)
    )
  $q$, v_xuat)
    into v_part using p_from, p_to;
  v_result := v_result || v_part;

  return v_result;
end $$;

create table if not exists public.dashboard_cache (
  cache_key  text primary key,
  kho        text not null,
  result     jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.dashboard_cache enable row level security;  -- không policy: chỉ hàm SECURITY DEFINER đọc / ghi
revoke all on public.dashboard_cache from anon, authenticated;

create or replace function public.dashboard_kho(
  p_kho text,
  p_from date default null,
  p_to date default null,
  p_today date default current_date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
set statement_timeout = '60s'
as $$
declare
  v_key text := concat_ws('|', p_kho, coalesce(p_from::text, ''), coalesce(p_to::text, ''), coalesce(p_today, current_date)::text);
  v_result jsonb;
begin
  perform public._qry_require_view();

  select result into v_result from public.dashboard_cache where cache_key = v_key;
  if v_result is not null then
    return v_result || jsonb_build_object('cached', true);
  end if;

  v_result := public._dashboard_kho_compute(p_kho, p_from, p_to, coalesce(p_today, current_date));

  delete from public.dashboard_cache where created_at < now() - interval '2 days';
  insert into public.dashboard_cache (cache_key, kho, result)
  values (v_key, p_kho, v_result)
  on conflict (cache_key) do update set result = excluded.result, created_at = now();

  return v_result || jsonb_build_object('cached', false);
end $$;

-- Xóa cache dashboard của kho khi bảng nhập / xuất thay đổi (trigger theo câu lệnh, rất rẻ)
create or replace function public.trg_dashboard_cache_clear()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.dashboard_cache where kho = tg_argv[0];
  return null;
end $$;

drop trigger if exists trg_dashboard_cache on public."xg-nhap";
create trigger trg_dashboard_cache after insert or update or delete or truncate on public."xg-nhap"
  for each statement execute function public.trg_dashboard_cache_clear('xg');
drop trigger if exists trg_dashboard_cache on public."xg-xuat";
create trigger trg_dashboard_cache after insert or update or delete or truncate on public."xg-xuat"
  for each statement execute function public.trg_dashboard_cache_clear('xg');
drop trigger if exists trg_dashboard_cache on public."tole-nhap";
create trigger trg_dashboard_cache after insert or update or delete or truncate on public."tole-nhap"
  for each statement execute function public.trg_dashboard_cache_clear('tole');
drop trigger if exists trg_dashboard_cache on public."tole-xuat";
create trigger trg_dashboard_cache after insert or update or delete or truncate on public."tole-xuat"
  for each statement execute function public.trg_dashboard_cache_clear('tole');


-- =============================================================================
-- 8. PHẾ LIỆU — bảng tổng hợp theo khóa "Kì đổ_Xưởng_Loại" do trigger duy trì.
--    View pl-chua-thu đọc từ bảng này (cùng tên cột, cùng ý nghĩa) nên không
--    còn phải cộng dồn toàn bộ pl-can-thu + pl-da-thu mỗi lần mở trang.
-- =============================================================================

create table if not exists public.pl_tong_hop_khoa (
  ma_khoa     text primary key,
  tong_can    numeric not null default 0,
  tong_da     numeric not null default 0,
  so_dong_can integer not null default 0,
  so_dong_da  integer not null default 0
);

alter table public.pl_tong_hop_khoa enable row level security;
drop policy if exists app_select on public.pl_tong_hop_khoa;
create policy app_select on public.pl_tong_hop_khoa
  for select to authenticated using ((select public.app_has_perm('view')));
revoke all on public.pl_tong_hop_khoa from anon;
grant select on public.pl_tong_hop_khoa to authenticated;

create or replace function public.trg_pl_tong_hop_khoa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_can boolean := tg_table_name = 'pl-can-thu';
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old."Cột 8 (Kì đổ_Xưởng_Loại phế liệu)" is not null then
      insert into public.pl_tong_hop_khoa as k (ma_khoa, tong_can, tong_da, so_dong_can, so_dong_da)
      values (old."Cột 8 (Kì đổ_Xưởng_Loại phế liệu)",
              case when v_is_can then -coalesce(old."Số lượng (kg)", 0) else 0 end,
              case when v_is_can then 0 else -coalesce(old."Số lượng (kg)", 0) end,
              case when v_is_can then -1 else 0 end,
              case when v_is_can then 0 else -1 end)
      on conflict (ma_khoa) do update
        set tong_can = k.tong_can + excluded.tong_can,
            tong_da = k.tong_da + excluded.tong_da,
            so_dong_can = k.so_dong_can + excluded.so_dong_can,
            so_dong_da = k.so_dong_da + excluded.so_dong_da;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new."Cột 8 (Kì đổ_Xưởng_Loại phế liệu)" is not null then
      insert into public.pl_tong_hop_khoa as k (ma_khoa, tong_can, tong_da, so_dong_can, so_dong_da)
      values (new."Cột 8 (Kì đổ_Xưởng_Loại phế liệu)",
              case when v_is_can then coalesce(new."Số lượng (kg)", 0) else 0 end,
              case when v_is_can then 0 else coalesce(new."Số lượng (kg)", 0) end,
              case when v_is_can then 1 else 0 end,
              case when v_is_can then 0 else 1 end)
      on conflict (ma_khoa) do update
        set tong_can = k.tong_can + excluded.tong_can,
            tong_da = k.tong_da + excluded.tong_da,
            so_dong_can = k.so_dong_can + excluded.so_dong_can,
            so_dong_da = k.so_dong_da + excluded.so_dong_da;
    end if;
  end if;

  delete from public.pl_tong_hop_khoa where so_dong_can <= 0 and so_dong_da <= 0;
  return null;
end $$;

drop trigger if exists trg_pl_tong_hop_khoa on public."pl-can-thu";
drop trigger if exists trg_pl_tong_hop_khoa on public."pl-da-thu";

-- Dựng lại bảng tổng hợp từ dữ liệu hiện có
truncate public.pl_tong_hop_khoa;
insert into public.pl_tong_hop_khoa (ma_khoa, tong_can, tong_da, so_dong_can, so_dong_da)
select ma_khoa, sum(tong_can), sum(tong_da), sum(so_dong_can), sum(so_dong_da)
  from (
    select "Cột 8 (Kì đổ_Xưởng_Loại phế liệu)" as ma_khoa, coalesce(sum("Số lượng (kg)"), 0) as tong_can,
           0::numeric as tong_da, count(*)::int as so_dong_can, 0 as so_dong_da
      from public."pl-can-thu" where "Cột 8 (Kì đổ_Xưởng_Loại phế liệu)" is not null group by 1
    union all
    select "Cột 8 (Kì đổ_Xưởng_Loại phế liệu)", 0, coalesce(sum("Số lượng (kg)"), 0), 0, count(*)::int
      from public."pl-da-thu" where "Cột 8 (Kì đổ_Xưởng_Loại phế liệu)" is not null group by 1
  ) u
 group by ma_khoa;

create trigger trg_pl_tong_hop_khoa after insert or update or delete on public."pl-can-thu"
  for each row execute function public.trg_pl_tong_hop_khoa();
create trigger trg_pl_tong_hop_khoa after insert or update or delete on public."pl-da-thu"
  for each row execute function public.trg_pl_tong_hop_khoa();

create or replace view public."pl-chua-thu" with (security_invoker = true) as
select row_number() over (order by k.ma_khoa) as id,
       split_part(k.ma_khoa, '_', 1) as "Kì đổ",
       split_part(k.ma_khoa, '_', 2) as "Xưởng",
       split_part(k.ma_khoa, '_', 3) as "Loại phế liệu",
       k.tong_can - k.tong_da as "Số lượng",
       k.ma_khoa as "Cột 8 (Kì đổ_Xưởng_Loại phế liệu)"
  from public.pl_tong_hop_khoa k
 where k.ma_khoa <> '';

create or replace function public.tim_kiem_pl_chua_thu(r public."pl-chua-thu")
returns text language sql immutable parallel safe as $$
  select coalesce(r."Xưởng", '') || E'\x1f' || coalesce(r."Loại phế liệu", '')
$$;

-- Trang "Tổng hợp phế liệu" + "Sơ đồ kho phế liệu 5S": tổng theo Xưởng × Loại + chi tiết
-- (giới hạn số dòng / nhóm). Nhóm có Xưởng rỗng vẫn trả về (xuong = ''), trang tự quyết định bỏ hay giữ.
create or replace function public.pl_tong_hop(
  p_table text,
  p_period text default null,
  p_detail_limit integer default 300
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '30s'
as $$
declare
  v_rel regclass;
  v_qty text := case when p_table = 'pl-chua-thu' then 't."Số lượng"' else 't."Số lượng (kg)"' end;
  v_ngay text := case when p_table = 'pl-chua-thu' then 'null::date' else 't."Ngày"' end;
  v_note text := case when p_table = 'pl-chua-thu' then '''''' else 'trim(coalesce(t."Ghi chú", ''''))' end;
  v_where text;
  v_periods jsonb;
  v_groups jsonb;
begin
  perform public._qry_require_view();
  if p_table not in ('pl-can-thu', 'pl-da-thu', 'pl-chua-thu') then
    raise exception 'Bảng không hợp lệ: %', p_table using errcode = '42501';
  end if;
  v_rel := public._qry_rel(p_table);

  execute format($q$
    select coalesce(jsonb_agg(p order by p collate "C"), '[]'::jsonb)
      from (select distinct trim(t."Kì đổ") as p from %s t where trim(coalesce(t."Kì đổ", '')) <> '') x
  $q$, v_rel)
    into v_periods;

  v_where := case when p_period is null or p_period = 'All' then 'true'
                  else format('trim(t."Kì đổ") = %L', p_period) end;

  execute format($q$
    with r as materialized (
      select t.id, trim(coalesce(t."Xưởng", '')) as xuong, trim(coalesce(t."Loại phế liệu", '')) as loai,
             coalesce(%1$s, 0) as kg, %2$s as ngay, %3$s as ghi_chu
        from %4$s t where %5$s
    ), g as (
      select xuong, loai, sum(kg) as kg, count(*) as n
        from r where loai <> '' group by xuong, loai
    ), d as (
      select xuong, loai, jsonb_agg(jsonb_build_object('ngay', ngay, 'kg', kg, 'ghi_chu', ghi_chu) order by id) as details
        from (select r.*, row_number() over (partition by xuong, loai order by id) as rn
                from r where loai <> '') rr
       where rn <= %6$s
       group by xuong, loai
    )
    select jsonb_build_object(
      'groups', coalesce((select jsonb_agg(jsonb_build_object('xuong', g.xuong, 'loai', g.loai, 'kg', g.kg, 'n', g.n,
                                                              'details', coalesce(d.details, '[]'::jsonb)))
                            from g left join d using (xuong, loai)), '[]'::jsonb),
      'types', coalesce((select jsonb_agg(jsonb_build_object('loai', loai, 'kg', kg))
                           from (select loai, sum(kg) as kg from r where loai <> '' group by loai) tt), '[]'::jsonb)
    )
  $q$, v_qty, v_ngay, v_note, v_rel, v_where, least(greatest(coalesce(p_detail_limit, 300), 0), 5000))
    into v_groups;

  return jsonb_build_object('periods', v_periods) || v_groups;
end $$;


-- =============================================================================
-- 9. QUYỀN THỰC THI + THỐNG KÊ
-- =============================================================================

-- Hàm nội bộ: không cho gọi trực tiếp qua API
revoke all on function public._qry_require_view() from public, anon, authenticated;
revoke all on function public._qry_rel(text) from public, anon, authenticated;
revoke all on function public._qry_col(regclass, text, text) from public, anon, authenticated;
revoke all on function public._qry_where(text, jsonb) from public, anon, authenticated;
revoke all on function public._dashboard_kho_compute(text, date, date, date) from public, anon, authenticated;
revoke all on function public.trg_nhap_con_ton() from public, anon, authenticated;
revoke all on function public.trg_xuat_con_ton() from public, anon, authenticated;
revoke all on function public.trg_pl_tong_hop_khoa() from public, anon, authenticated;
revoke all on function public.trg_dashboard_cache_clear() from public, anon, authenticated;

-- RPC dùng từ trình duyệt: chỉ người đã đăng nhập
revoke all on function public.qry_rows(text, jsonb, jsonb, integer, integer, boolean, text[], text[], bigint) from public, anon;
revoke all on function public.qry_group(text, jsonb, text, text[], jsonb, integer) from public, anon;
revoke all on function public.qry_distinct(text, text, jsonb, integer) from public, anon;
revoke all on function public.next_roll_number(text, text, bigint) from public, anon;
revoke all on function public.dashboard_kho(text, date, date, date) from public, anon;
revoke all on function public.pl_tong_hop(text, text, integer) from public, anon;

grant execute on function public.qry_rows(text, jsonb, jsonb, integer, integer, boolean, text[], text[], bigint) to authenticated;
grant execute on function public.qry_group(text, jsonb, text, text[], jsonb, integer) to authenticated;
grant execute on function public.qry_distinct(text, text, jsonb, integer) to authenticated;
grant execute on function public.next_roll_number(text, text, bigint) to authenticated;
grant execute on function public.dashboard_kho(text, date, date, date) to authenticated;
grant execute on function public.pl_tong_hop(text, text, integer) to authenticated;

analyze public."xg-nhap", public."xg-xuat", public."tole-nhap", public."tole-xuat",
        public."pl-can-thu", public."pl-da-thu", public."pl-phieu-in", public.pl_tong_hop_khoa;

-- Báo PostgREST nạp lại schema (để thấy các RPC mới ngay)
notify pgrst, 'reload schema';
