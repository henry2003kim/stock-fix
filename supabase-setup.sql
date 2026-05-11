-- ============================================================
-- StockFix — Run this entire file in Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- 1. Tables
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  investment_budget float default 0,
  created_at timestamptz default now()
);

create table if not exists public.pinned_stocks (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  pinned_at timestamptz default now(),
  unique(user_id, ticker)
);

create table if not exists public.transactions (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  quantity float not null,
  price float not null,
  action text not null default 'BUY',
  note text,
  executed_at timestamptz default now()
);

-- 2. Row Level Security
alter table public.user_profiles enable row level security;
alter table public.pinned_stocks enable row level security;
alter table public.transactions enable row level security;

-- 3. Policies
create policy "own profile select" on public.user_profiles for select using (auth.uid() = id);
create policy "own profile update" on public.user_profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.user_profiles for insert with check (auth.uid() = id);

create policy "own pins all" on public.pinned_stocks for all using (auth.uid() = user_id);
create policy "own transactions all" on public.transactions for all using (auth.uid() = user_id);

-- 4. Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. RPC: look up email by username (used for username-based login)
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.user_profiles p on p.id = u.id
  where p.username = p_username
  limit 1;
$$;

-- 6. RPC: look up username by email (used for "find username" flow)
create or replace function public.get_username_by_email(p_email text)
returns text
language sql
security definer
set search_path = public
as $$
  select p.username
  from auth.users u
  join public.user_profiles p on p.id = u.id
  where u.email = p_email
  limit 1;
$$;
