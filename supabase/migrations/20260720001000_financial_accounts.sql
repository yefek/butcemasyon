-- Account and movement foundation for cash, investment and credit-card support.
-- Apply this migration from the Supabase dashboard before enabling account UI.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null,
  type text not null check (type in ('cash', 'investment', 'credit_card')),
  name text not null,
  opening_balance numeric not null default 0,
  current_value numeric,
  credit_limit numeric,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table public.accounts
  add constraint accounts_user_id_id_key unique (user_id, id);

create unique index if not exists accounts_default_cash_idx
  on public.accounts(user_id)
  where type = 'cash' and is_default and archived_at is null;
create index if not exists accounts_user_idx on public.accounts(user_id, type);

alter table public.accounts enable row level security;
create policy "accounts_select_own" on public.accounts for select using (auth.uid() = user_id);
create policy "accounts_insert_own" on public.accounts for insert with check (auth.uid() = user_id);
create policy "accounts_update_own" on public.accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts_delete_own" on public.accounts for delete using (auth.uid() = user_id);

alter table public.transactions
  add column if not exists movement_type text,
  add column if not exists source_account_id uuid,
  add column if not exists destination_account_id uuid;

alter table public.transactions
  add constraint transactions_user_id_id_key unique (user_id, id),
  add constraint transactions_source_account_fkey
    foreign key (user_id, source_account_id) references public.accounts(user_id, id) on delete set null (source_account_id),
  add constraint transactions_destination_account_fkey
    foreign key (user_id, destination_account_id) references public.accounts(user_id, id) on delete set null (destination_account_id);

update public.transactions
set movement_type = type
where movement_type is null;

alter table public.transactions
  alter column movement_type set default 'expense',
  alter column movement_type set not null;

alter table public.transactions drop constraint if exists transactions_movement_type_check;
alter table public.transactions add constraint transactions_movement_type_check check (
  movement_type in (
    'income', 'expense', 'transfer', 'investment_contribution',
    'investment_withdrawal', 'card_payment', 'balance_adjustment'
  )
);

create table if not exists public.account_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null,
  transaction_id uuid,
  account_id uuid not null,
  amount numeric not null,
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table public.account_movements
  add constraint account_movements_transaction_fkey
    foreign key (user_id, transaction_id) references public.transactions(user_id, id) on delete cascade,
  add constraint account_movements_account_fkey
    foreign key (user_id, account_id) references public.accounts(user_id, id) on delete cascade;

create index if not exists account_movements_user_date_idx
  on public.account_movements(user_id, date desc, created_at desc);
create index if not exists account_movements_account_idx
  on public.account_movements(account_id, date desc);

alter table public.account_movements enable row level security;
create policy "account_movements_select_own" on public.account_movements for select using (auth.uid() = user_id);
create policy "account_movements_insert_own" on public.account_movements for insert with check (auth.uid() = user_id);
create policy "account_movements_update_own" on public.account_movements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "account_movements_delete_own" on public.account_movements for delete using (auth.uid() = user_id);

insert into public.accounts (user_id, client_id, type, name, is_default)
select users.id,
       floor(extract(epoch from coalesce(users.created_at, now())) * 1000)::bigint,
       'cash',
       'Nakit',
       true
from auth.users as users
where not exists (
  select 1 from public.accounts
  where accounts.user_id = users.id
    and accounts.type = 'cash'
    and accounts.is_default
    and accounts.archived_at is null
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'username'
  );
  insert into public.user_settings (user_id) values (new.id);
  insert into public.accounts (user_id, client_id, type, name, is_default)
  values (new.id, floor(extract(epoch from now()) * 1000)::bigint, 'cash', 'Nakit', true);
  return new;
end;
$function$;
