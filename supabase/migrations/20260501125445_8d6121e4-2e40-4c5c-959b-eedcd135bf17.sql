-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null,
  type text not null check (type in ('income','expense')),
  category text not null,
  subcategory text,
  amount numeric not null,
  date date not null,
  note text,
  icon text,
  recurring text,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index transactions_user_idx on public.transactions(user_id, date desc);
alter table public.transactions enable row level security;
create policy "tx_select_own" on public.transactions for select using (auth.uid() = user_id);
create policy "tx_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
create policy "tx_update_own" on public.transactions for update using (auth.uid() = user_id);
create policy "tx_delete_own" on public.transactions for delete using (auth.uid() = user_id);

-- Settings
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dark boolean not null default false,
  theme_id text not null default 'midnight',
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "us_select_own" on public.user_settings for select using (auth.uid() = user_id);
create policy "us_insert_own" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "us_update_own" on public.user_settings for update using (auth.uid() = user_id);

-- Auto-create profile + settings on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();