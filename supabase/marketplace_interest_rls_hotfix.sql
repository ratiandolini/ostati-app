-- Let the interest RPC lock a visible open request without requiring a worker
-- to satisfy the client-only job_posts UPDATE policy. The function retains
-- explicit worker identity, verification, status, and cap checks below.

create or replace function public.express_interest_in_job_post(
  p_job_post_id uuid, p_message text default null, p_estimate_min numeric default null, p_estimate_max numeric default null
) returns public.job_post_interests
language plpgsql
security definer
set search_path = public
as $$
declare v_worker uuid; v_post public.job_posts; v_count integer; result public.job_post_interests;
begin
  v_worker := public.current_app_worker_id();
  if v_worker is null then raise exception 'Only a craftsman can respond to a request'; end if;

  select * into v_post from public.job_posts where id = p_job_post_id for update;
  if not found or v_post.status <> 'open' then raise exception 'This request is no longer open'; end if;

  if not exists (
    select 1 from public.workers w
    where w.id = v_worker and w.is_active and w.verification_status = 'verified'
  ) then raise exception 'Only verified active craftspeople can respond'; end if;

  select count(*) into v_count
  from public.job_post_interests
  where job_post_id = p_job_post_id and status <> 'withdrawn';
  if v_count >= v_post.interest_limit then raise exception 'This request already has enough responses'; end if;

  insert into public.job_post_interests(job_post_id, worker_id, message, estimate_min, estimate_max)
  values(p_job_post_id, v_worker, nullif(trim(coalesce(p_message, '')), ''), p_estimate_min, p_estimate_max)
  returning * into result;
  return result;
end;
$$;

grant execute on function public.express_interest_in_job_post(uuid, text, numeric, numeric) to authenticated;
