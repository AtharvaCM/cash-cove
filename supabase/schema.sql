create extension if not exists "pgcrypto";

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  parent_id uuid references categories(id) on delete set null,
  type text not null check (type in ('expense', 'income')),
  created_at timestamptz default now(),
  unique (user_id, name, parent_id)
);

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  type text not null check (type in ('bank', 'card', 'wallet', 'cash', 'other')),
  current_balance numeric(14, 2) not null default 0,
  currency text not null default 'INR',
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  type text not null check (type in ('expense', 'income')),
  date date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category_id uuid references categories(id) on delete set null,
  payment_method_id uuid references payment_methods(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  notes_enc text,
  is_transfer boolean default false,
  is_recurring boolean default false,
  created_at timestamptz default now()
);

create table if not exists transaction_tags (
  user_id uuid not null default auth.uid(),
  transaction_id uuid references transactions(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (transaction_id, tag_id)
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  month text not null,
  category_id uuid references categories(id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz default now(),
  unique (user_id, month, category_id)
);

create table if not exists funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  type text,
  target_amount numeric(12, 2) not null check (target_amount >= 0),
  current_amount numeric(12, 2) not null default 0 check (current_amount >= 0),
  monthly_contribution numeric(12, 2),
  target_date date,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists fund_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  fund_id uuid references funds(id) on delete cascade,
  date date not null,
  amount numeric(12, 2) not null check (amount <> 0),
  note text,
  created_at timestamptz default now()
);

alter table fund_contributions
  drop constraint if exists fund_contributions_amount_check;

alter table fund_contributions
  drop constraint if exists fund_contributions_amount_nonzero;

alter table fund_contributions
  add constraint fund_contributions_amount_nonzero check (amount <> 0);

alter table categories enable row level security;
alter table payment_methods enable row level security;
alter table accounts enable row level security;
alter table tags enable row level security;
alter table transactions enable row level security;
alter table transaction_tags enable row level security;
alter table budgets enable row level security;
alter table funds enable row level security;
alter table fund_contributions enable row level security;

create policy "Categories are user-owned" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Payment methods are user-owned" on payment_methods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Accounts are user-owned" on accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Tags are user-owned" on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Transactions are user-owned" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Transaction tags are user-owned" on transaction_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Budgets are user-owned" on budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Funds are user-owned" on funds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Fund contributions are user-owned" on fund_contributions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
