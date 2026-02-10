-- Whiteboards table for cloud storage
create table if not exists public.whiteboards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password_hash text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique name for upsert semantics (one whiteboard per name)
create unique index if not exists whiteboards_name_key on public.whiteboards (name);

-- RLS: allow anon read/write. Anyone with the project URL can list/save/load/overwrite
-- whiteboards. Password-protected boards require the password to load. For multi-tenant
-- or production, replace with auth-based policies (e.g. to anon insert only, to authenticated select/update own rows).
alter table public.whiteboards enable row level security;

create policy "Allow anon all"
  on public.whiteboards
  for all
  to anon
  using (true)
  with check (true);
