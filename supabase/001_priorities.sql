-- =====================================================
-- Migration: Add list/task priority feature
-- Safe to run on an existing database. Idempotent.
-- Existing rows are preserved unchanged.
-- =====================================================

-- Flag a list as "prioritized" so its tasks show priority controls.
alter table public.lists
  add column if not exists prioritized boolean default false not null;

-- Task priority. NULL means no priority assigned.
alter table public.tasks
  add column if not exists priority text
  check (priority is null or priority in ('high', 'medium', 'low'));

-- Index to help sort by priority efficiently.
create index if not exists tasks_priority_idx on public.tasks(priority);
