-- Run once after marketplace_growth.sql. This preserves client ownership and
-- pending-candidate checks while allowing the RPC to update interest statuses.
create or replace function public.select_job_post_worker(p_job_post_id uuid, p_worker_id uuid)
returns public.job_posts language plpgsql security definer set search_path = public as $$
declare result public.job_posts; v_client uuid;
begin
  v_client := public.current_app_user_id();
  if v_client is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.job_post_interests
    where job_post_id = p_job_post_id and worker_id = p_worker_id and status = 'pending'
  ) then raise exception 'This craftsman is not available for this request'; end if;
  if not exists (
    select 1 from public.workers
    where id = p_worker_id and is_active and verification_status = 'verified'
  ) then raise exception 'This craftsman is no longer available'; end if;

  update public.job_posts set status='selected', selected_worker_id=p_worker_id, updated_at=now()
  where id=p_job_post_id and client_id=v_client and status='open'
  returning * into result;
  if not found then raise exception 'Request cannot be updated'; end if;

  update public.job_post_interests
  set status=case when worker_id=p_worker_id then 'selected' else 'not_selected' end
  where job_post_id=p_job_post_id;
  return result;
end $$;

grant execute on function public.select_job_post_worker(uuid,uuid) to authenticated;
