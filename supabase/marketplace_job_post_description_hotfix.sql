-- Remonter hotfix: a client may publish a short or empty job description.
-- Run once in Supabase SQL Editor after marketplace_growth.sql.

alter table public.job_posts
  drop constraint if exists job_posts_description_check;

alter table public.job_posts
  add constraint job_posts_description_check
  check (char_length(trim(description)) <= 2000);
