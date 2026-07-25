alter table public.accounts
  add column if not exists investment_type text,
  add column if not exists statement_day smallint,
  add column if not exists due_day smallint;

alter table public.accounts drop constraint if exists accounts_investment_type_check;
alter table public.accounts add constraint accounts_investment_type_check check (
  investment_type is null or investment_type in ('stock', 'gold', 'fund', 'crypto', 'other')
);

alter table public.accounts drop constraint if exists accounts_statement_day_check;
alter table public.accounts add constraint accounts_statement_day_check check (
  statement_day is null or statement_day between 1 and 31
);

alter table public.accounts drop constraint if exists accounts_due_day_check;
alter table public.accounts add constraint accounts_due_day_check check (
  due_day is null or due_day between 1 and 31
);
