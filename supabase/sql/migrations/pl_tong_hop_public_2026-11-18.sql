-- =============================================================================
-- Cho phép xem công khai (không cần đăng nhập) 3 trang Tổng hợp phế liệu:
--   pl-tong-hop-can-thu.html, pl-tong-hop-da-thu.html, pl-tong-hop-chua-thu.html
-- (và sơ đồ kho phế liệu 5S, cùng dùng RPC này).
--
-- Chạy trong Supabase SQL Editor. Chỉ đổi RPC pl_tong_hop:
--   * bỏ bước _qry_require_view() (bắt buộc đăng nhập + quyền 'view')
--   * cấp execute cho anon
-- Hàm vẫn chỉ nhận 3 bảng pl-can-thu / pl-da-thu / pl-chua-thu và chỉ trả số liệu tổng hợp
-- (Xưởng × Loại phế liệu, kg, ngày, ghi chú) — không mở quyền đọc trực tiếp bảng.
-- Hoàn tác: chạy lại phần pl_tong_hop trong scale_1m_rows_2026-10-20.sql (mục 8 và 9).
-- =============================================================================

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

revoke all on function public.pl_tong_hop(text, text, integer) from public;
grant execute on function public.pl_tong_hop(text, text, integer) to anon, authenticated;

-- Kiểm tra (chỉ đọc): anon_exec phải là true
select has_function_privilege('anon', 'public.pl_tong_hop(text, text, integer)', 'execute') as anon_exec;
