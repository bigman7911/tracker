-- Income table
create table income (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  channel text not null,
  buyer text,
  account text not null,
  item text not null,
  cogs numeric default 0,
  shipping numeric default 0,
  payout numeric default 0,
  net numeric generated always as (payout - cogs - shipping) stored,
  source text default 'manual',
  source_id text,
  date text,
  created_at timestamptz default now()
);

-- Expenses table
create table expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric not null,
  account text not null,
  item text not null,
  category text not null,
  sold_on text,
  notes text,
  source text default 'manual',
  created_at timestamptz default now()
);

-- Settings table (stores proxy URL, marketplace ID, API keys)
create table settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  proxy_url text,
  ebay_token text,
  ebay_app_id text,
  ebay_cert_id text,
  ebay_dev_id text,
  amz_client_id text,
  amz_client_secret text,
  amz_refresh_token text,
  amz_marketplace_id text default 'ATVPDKIKX0DER',
  updated_at timestamptz default now()
);

-- Custom lists table (user-defined account names and sold-on values)
-- list_type: 'income-accounts' | 'expense-accounts' | 'sold-on'
create table custom_lists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  list_type text not null,
  value text not null,
  position integer default 0,
  created_at timestamptz default now(),
  unique(user_id, list_type, value)
);

-- Pulled IDs table (deduplication for API pulls)
create table pulled_ids (
  user_id uuid references auth.users(id) on delete cascade not null,
  source_id text not null,
  primary key (user_id, source_id)
);

-- Row Level Security — users can only see their own data
alter table income enable row level security;
alter table expenses enable row level security;
alter table settings enable row level security;
alter table custom_lists enable row level security;
alter table pulled_ids enable row level security;

create policy "Users own income" on income for all using (auth.uid() = user_id);
create policy "Users own expenses" on expenses for all using (auth.uid() = user_id);
create policy "Users own settings" on settings for all using (auth.uid() = user_id);
create policy "Users own custom_lists" on custom_lists for all using (auth.uid() = user_id);
create policy "Users own pulled_ids" on pulled_ids for all using (auth.uid() = user_id);
