-- =====================================================
-- Lists app schema
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- =====================================================

-- Lists table
create table if not exists public.lists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (char_length(name) > 0 and char_length(name) <= 200),
  prioritized boolean default false not null,
  created_at timestamptz default now() not null
);

-- Tasks table
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  list_id uuid references public.lists(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null check (char_length(text) > 0 and char_length(text) <= 2000),
  done boolean default false not null,
  starred boolean default false not null,
  priority text check (priority is null or priority in ('high', 'medium', 'low')),
  hours_estimate numeric check (hours_estimate is null or hours_estimate >= 0),
  created_at timestamptz default now() not null,
  done_at timestamptz
);

-- Indexes for fast lookups
create index if not exists lists_user_id_idx on public.lists(user_id);
create index if not exists lists_created_at_idx on public.lists(created_at);
create index if not exists tasks_list_id_idx on public.tasks(list_id);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_created_at_idx on public.tasks(created_at);
create index if not exists tasks_priority_idx on public.tasks(priority);

-- =====================================================
-- Row-level security
-- Each user can only see and modify their own data
-- =====================================================

alter table public.lists enable row level security;
alter table public.tasks enable row level security;

-- Lists policies
drop policy if exists "Users select own lists" on public.lists;
create policy "Users select own lists" on public.lists
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own lists" on public.lists;
create policy "Users insert own lists" on public.lists
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own lists" on public.lists;
create policy "Users update own lists" on public.lists
  for update using (auth.uid() = user_id);

drop policy if exists "Users delete own lists" on public.lists;
create policy "Users delete own lists" on public.lists
  for delete using (auth.uid() = user_id);

-- Tasks policies
drop policy if exists "Users select own tasks" on public.tasks;
create policy "Users select own tasks" on public.tasks
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own tasks" on public.tasks;
create policy "Users insert own tasks" on public.tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own tasks" on public.tasks;
create policy "Users update own tasks" on public.tasks
  for update using (auth.uid() = user_id);

drop policy if exists "Users delete own tasks" on public.tasks;
create policy "Users delete own tasks" on public.tasks
  for delete using (auth.uid() = user_id);
