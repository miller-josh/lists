-- =====================================================
-- Migration: Add optional weather tag to tasks
-- Safe to run on existing database. Idempotent.
-- =====================================================

alter table public.tasks
  add column if not exists weather text
  check (weather is null or weather in ('sun', 'rain', 'snow'));
