-- FIXART job-post soft archive.
-- Run after marketplace_growth.sql and marketplace interest/selection hotfixes.

alter table public.job_posts
  add column if not exists archived_at timestamptz;

drop policy if exists "authenticated users can read open job posts" on public.job_posts;
create policy "authenticated users can read open job posts"
on public.job_posts for select
using (
  auth.role() = 'authenticated'
  and (
    (status = 'open' and archived_at is null)
    or client_id = public.current_app_user_id()
    or public.current_app_user_is_admin()
  )
);

create or replace function public.archive_my_job_post(p_job_post_id uuid)
returns public.job_posts
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.job_posts;
begin
  update public.job_posts
  set
    archived_at = now(),
    updated_at = now(),
    -- An open request must stop accepting interests once archived. Selected
    -- requests keep their existing status so booking history remains intact.
    status = case when status = 'open' then 'cancelled' else status end
  where id = p_job_post_id
    and client_id = public.current_app_user_id()
    and archived_at is null
  returning * into result;

  if not found then
    raise exception 'Only your own non-archived job post can be archived';
  end if;

  return result;
end;
$$;

revoke all on function public.archive_my_job_post(uuid) from public, anon;
grant execute on function public.archive_my_job_post(uuid) to authenticated;
