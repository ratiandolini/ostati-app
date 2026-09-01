-- Remonter hotfix: title is optional in the client form and may be short.
-- Run once in Supabase SQL Editor after marketplace_growth.sql.

alter table public.job_posts
  drop constraint if exists job_posts_title_check;

alter table public.job_posts
  add constraint job_posts_title_check
  check (char_length(trim(title)) <= 160);
