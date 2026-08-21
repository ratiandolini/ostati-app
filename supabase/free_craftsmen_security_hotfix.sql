-- Remonter: craftsmen are free to use the platform for now.
-- Run this once in Supabase SQL Editor after reactivating the project.

-- Existing craftsmen stay visible and can keep receiving bookings.
update public.workers
set subscription_status = 'active'
where subscription_status is distinct from 'active'::public.subscription_status;

-- Booking availability no longer depends on a paid subscription.
create or replace function public.worker_can_receive_bookings(target_worker_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workers w
    join public.users u on u.id = w.user_id
    where w.id = target_worker_id
      and w.is_active = true
      and u.status = 'active'
  );
$$;

-- Apply RLS as the querying user instead of the view owner.
alter view public.worker_cards set (security_invoker = true);

grant select on public.worker_cards to anon, authenticated;
