create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_app_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where auth_user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  )
$$;

create or replace function public.current_app_worker_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workers.id
  from public.workers
  join public.users on users.id = workers.user_id
  where users.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.user_can_access_booking(target_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings
    where bookings.id = target_booking_id
      and (
        bookings.client_id = public.current_app_user_id()
        or bookings.worker_id = public.current_app_worker_id()
        or public.current_app_user_is_admin()
      )
  )
$$;

create policy "users can read own profile"
on public.users for select
using (
  id = public.current_app_user_id()
  or public.current_app_user_is_admin()
);

create policy "users can update own profile"
on public.users for update
using (id = public.current_app_user_id())
with check (id = public.current_app_user_id());

create policy "workers are public read when active"
on public.workers for select
using (
  is_active = true
  or user_id = public.current_app_user_id()
  or public.current_app_user_is_admin()
);

create policy "workers can update own profile"
on public.workers for update
using (user_id = public.current_app_user_id())
with check (user_id = public.current_app_user_id());

create policy "workers can insert own profile"
on public.workers for insert
with check (user_id = public.current_app_user_id());

create policy "worker professions public read"
on public.worker_professions for select
using (
  exists (
    select 1
    from public.workers
    where workers.id = worker_professions.worker_id
      and (
        workers.is_active = true
        or workers.user_id = public.current_app_user_id()
        or public.current_app_user_is_admin()
      )
  )
);

create policy "workers manage own professions"
on public.worker_professions for all
using (worker_id = public.current_app_worker_id())
with check (worker_id = public.current_app_worker_id());

create policy "worker schedule public read"
on public.worker_schedule for select
using (
  exists (
    select 1
    from public.workers
    where workers.id = worker_schedule.worker_id
      and workers.is_active = true
  )
  or worker_id = public.current_app_worker_id()
  or public.current_app_user_is_admin()
);

create policy "workers manage own schedule"
on public.worker_schedule for all
using (worker_id = public.current_app_worker_id())
with check (worker_id = public.current_app_worker_id());

create policy "worker unavailable public read"
on public.worker_unavailable_ranges for select
using (
  exists (
    select 1
    from public.workers
    where workers.id = worker_unavailable_ranges.worker_id
      and workers.is_active = true
  )
  or worker_id = public.current_app_worker_id()
  or public.current_app_user_is_admin()
);

create policy "workers manage own unavailable ranges"
on public.worker_unavailable_ranges for all
using (worker_id = public.current_app_worker_id())
with check (worker_id = public.current_app_worker_id());

create policy "booking parties can read bookings"
on public.bookings for select
using (
  client_id = public.current_app_user_id()
  or worker_id = public.current_app_worker_id()
  or public.current_app_user_is_admin()
);

create policy "clients create own bookings"
on public.bookings for insert
with check (client_id = public.current_app_user_id());

create policy "booking parties can update bookings"
on public.bookings for update
using (
  client_id = public.current_app_user_id()
  or worker_id = public.current_app_worker_id()
  or public.current_app_user_is_admin()
)
with check (
  client_id = public.current_app_user_id()
  or worker_id = public.current_app_worker_id()
  or public.current_app_user_is_admin()
);

create policy "booking parties can read booking details"
on public.booking_details for select
using (public.user_can_access_booking(booking_id));

create policy "booking parties can manage booking details"
on public.booking_details for all
using (public.user_can_access_booking(booking_id))
with check (public.user_can_access_booking(booking_id));

create policy "booking parties can read messages"
on public.messages for select
using (public.user_can_access_booking(booking_id));

create policy "booking parties can send messages"
on public.messages for insert
with check (
  sender_id = public.current_app_user_id()
  and public.user_can_access_booking(booking_id)
);

create policy "booking parties can update message read state"
on public.messages for update
using (public.user_can_access_booking(booking_id))
with check (public.user_can_access_booking(booking_id));

create policy "booking parties can read reviews"
on public.reviews for select
using (public.user_can_access_booking(booking_id));

create policy "booking parties can create reviews"
on public.reviews for insert
with check (
  reviewer_id = public.current_app_user_id()
  and public.user_can_access_booking(booking_id)
);

create policy "workers can read own verification documents"
on public.verification_documents for select
using (
  worker_id = public.current_app_worker_id()
  or public.current_app_user_is_admin()
);

create policy "workers can upload own verification documents"
on public.verification_documents for insert
with check (worker_id = public.current_app_worker_id());

create policy "workers can update own pending verification documents"
on public.verification_documents for update
using (
  worker_id = public.current_app_worker_id()
  and status = 'pending'
)
with check (
  worker_id = public.current_app_worker_id()
  and status = 'pending'
);

create policy "booking parties can read payments"
on public.payments for select
using (
  payer_id = public.current_app_user_id()
  or worker_id = public.current_app_worker_id()
  or public.current_app_user_is_admin()
);

create policy "booking parties can read disputes"
on public.disputes for select
using (
  opened_by = public.current_app_user_id()
  or public.user_can_access_booking(booking_id)
  or public.current_app_user_is_admin()
);

create policy "booking parties can create disputes"
on public.disputes for insert
with check (
  opened_by = public.current_app_user_id()
  and public.user_can_access_booking(booking_id)
);

create policy "users can read own notifications"
on public.notifications for select
using (
  user_id = public.current_app_user_id()
  or public.current_app_user_is_admin()
);

create policy "users can update own notification read state"
on public.notifications for update
using (user_id = public.current_app_user_id())
with check (user_id = public.current_app_user_id());

create policy "workers can read own subscriptions"
on public.subscriptions for select
using (
  worker_id = public.current_app_worker_id()
  or public.current_app_user_is_admin()
);

create policy "admins can read audit logs"
on public.audit_logs for select
using (public.current_app_user_is_admin());
