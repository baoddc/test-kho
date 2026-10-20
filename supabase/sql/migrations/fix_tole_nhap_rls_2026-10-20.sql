-- =============================================================================
-- Khóa bảng tole-nhap theo đúng quy tắc của các bảng kho khác (2026-10-20)
--
-- Trên prod bảng "tole-nhap" còn policy "allow all" (ALL, role public, USING true)
-- và anon có toàn quyền → ai có anon key (công khai trong trang web) đều đọc / sửa /
-- xóa được dữ liệu nhập tole mà không cần đăng nhập.
-- Thay bằng 4 policy app_* giống "xg-nhap": xem = can_view, thêm = can_add,
-- sửa = can_edit, xóa = can_delete (chỉ tài khoản đã đăng nhập).
-- Đồng thời thu hồi quyền anon còn sót trên view "pl-chua-thu".
-- Chạy lại nhiều lần vẫn an toàn.
-- =============================================================================

begin;

alter table public."tole-nhap" enable row level security;

drop policy if exists "allow all" on public."tole-nhap";
drop policy if exists app_select on public."tole-nhap";
drop policy if exists app_insert on public."tole-nhap";
drop policy if exists app_update on public."tole-nhap";
drop policy if exists app_delete on public."tole-nhap";

create policy app_select on public."tole-nhap" for select to authenticated
  using ((select public.app_has_perm('view')));
create policy app_insert on public."tole-nhap" for insert to authenticated
  with check ((select public.app_has_perm('add')));
create policy app_update on public."tole-nhap" for update to authenticated
  using ((select public.app_has_perm('edit'))) with check ((select public.app_has_perm('edit')));
create policy app_delete on public."tole-nhap" for delete to authenticated
  using ((select public.app_has_perm('delete')));

revoke all on public."tole-nhap" from anon;
revoke all on public."pl-chua-thu" from anon;

commit;
