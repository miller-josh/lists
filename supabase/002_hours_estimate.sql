-- =====================================================
-- Migration: Add optional hours estimate to tasks
-- Safe to run on existing database. Idempotent.
-- =====================================================

alter table public.tasks
  add column if not exists hours_estimate numeric
  check (hours_estimate is null or hours_estimate >= 0);
