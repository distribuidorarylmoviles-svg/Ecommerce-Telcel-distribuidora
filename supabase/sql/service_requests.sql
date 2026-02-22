-- Tabla para solicitudes de servicios desde formularios públicos.
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  service_type text not null check (service_type in ('planes', 'portabilidad', 'recuperacion')),
  nombre text not null,
  correo_electronico text null,
  telefono_celular text null,
  comentario text null,
  payload jsonb not null default '{}'::jsonb,
  destination_email text not null default 'rodriguezlopezfernando26@gmail.com',
  email_sent boolean not null default false,
  email_error text null,
  user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.service_requests enable row level security;

drop policy if exists "service_requests_insert_public" on public.service_requests;
create policy "service_requests_insert_public"
on public.service_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists "service_requests_select_own" on public.service_requests;
create policy "service_requests_select_own"
on public.service_requests
for select
to authenticated
using (auth.uid() = user_id);

grant insert on public.service_requests to anon, authenticated;
grant select on public.service_requests to authenticated;
