-- Admin-only access to the existing profile contact number for verification review.
-- This does not expose phone data through public worker/search surfaces.
create or replace function public.get_admin_worker_contact_phone(
  p_worker_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to read contact phones';
  end if;

  if not public.current_admin_has_permission('verification') then
    raise exception 'Only admins with verification permission can read contact phones';
  end if;

  return (
    select nullif(trim(u.contact_phone), '')
    from public.workers w
    join public.users u on u.id = w.user_id
    where w.id = p_worker_id
      and w.verification_status in ('pending', 'verified', 'rejected')
  );
end;
$$;

revoke all on function public.get_admin_worker_contact_phone(uuid) from public;
grant execute on function public.get_admin_worker_contact_phone(uuid) to authenticated;
