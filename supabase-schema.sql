-- Execute no SQL Editor do seu projeto Supabase.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text,
  price numeric(12,2),
  status text not null default 'Link salvo',
  qc_url text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Users can view their own products"
  on public.products for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can add their own products"
  on public.products for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update their own products"
  on public.products for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own products"
  on public.products for delete to authenticated
  using (auth.uid() = user_id);
