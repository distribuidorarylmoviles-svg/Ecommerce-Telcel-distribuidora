create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_role text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select
    lower(coalesce(u.email, '')),
    coalesce(u.raw_user_meta_data ->> 'rol', '')
  into v_email, v_role
  from auth.users u
  where u.id = auth.uid();

  return v_role in ('admin', 'super_admin')
    or v_email = 'rodriguezlopezfernando26@gmail.com';
end;
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "service_requests_select_admin" on public.service_requests;
create policy "service_requests_select_admin"
on public.service_requests
for select
to authenticated
using (public.is_admin());

drop policy if exists "service_requests_delete_admin" on public.service_requests;
create policy "service_requests_delete_admin"
on public.service_requests
for delete
to authenticated
using (public.is_admin());

grant delete on public.service_requests to authenticated;

do $$
begin
  if to_regclass('public.products') is not null then
    execute 'alter table public.products enable row level security';

    execute 'drop policy if exists "products_public_read" on public.products';
    execute 'create policy "products_public_read"
      on public.products
      for select
      to anon, authenticated
      using (true)';

    execute 'drop policy if exists "products_admin_manage" on public.products';
    execute 'create policy "products_admin_manage"
      on public.products
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin())';

    execute 'grant select on public.products to anon, authenticated';
    execute 'grant insert, update, delete on public.products to authenticated';
  end if;

  if to_regclass('public.orders') is not null then
    execute 'alter table public.orders enable row level security';
    execute 'drop policy if exists "orders_admin_select_all" on public.orders';
    execute 'create policy "orders_admin_select_all"
      on public.orders
      for select
      to authenticated
      using (public.is_admin())';

    execute 'grant select on public.orders to authenticated';
  end if;

  if to_regclass('public.order_items') is not null then
    execute 'alter table public.order_items enable row level security';
    execute 'drop policy if exists "order_items_admin_select_all" on public.order_items';
    execute 'create policy "order_items_admin_select_all"
      on public.order_items
      for select
      to authenticated
      using (public.is_admin())';

    execute 'grant select on public.order_items to authenticated';
  end if;
end
$$;
