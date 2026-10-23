-- TEST PROJECT ONLY: ivguranttkxhxsdsppqk. Stage 2/9; source files 13-20 of 47.
-- Verify the Supabase Dashboard project URL/reference before running this entire file.
-- The database cannot independently authenticate its Supabase project reference.
-- Stage 2 requires the completed Stage 1 marker; never skip or replay stages.
begin;
do $e2e_guard$
begin
  if not exists (
    select 1 from public.e2e_sql_editor_install
    where singleton = true
      and project_ref = 'ivguranttkxhxsdsppqk'
      and completed_stage = 1
  ) then
    raise exception 'E2E SQL Editor install: expected completed stage 1; stop and inspect state';
  end if;
end;
$e2e_guard$;

-- BEGIN SOURCE 13: supabase/policies.sql
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

create policy "admins can read disputes"
on public.disputes for select
using (
  public.current_app_user_is_admin()
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
-- END SOURCE 13: supabase/policies.sql

-- BEGIN SOURCE 14: supabase/booking_actions.sql
alter table public.booking_details
add column if not exists work_scope text;

alter table public.booking_details
add column if not exists surface_type text;

alter table public.booking_details
add column if not exists material_note text;

alter table public.booking_details
add column if not exists item_count text;

alter table public.booking_details
add column if not exists current_condition text;

alter table public.booking_details
add column if not exists photo_note text;

alter table public.booking_details
add column if not exists roof_type text;

create or replace function public.create_booking_request(
  p_worker_id uuid,
  p_profession_name text,
  p_scheduled_at timestamptz,
  p_city text,
  p_address_text text,
  p_client_comment text,
  p_booking_fee_amount numeric,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client_user_id uuid;
  target_profession_id uuid;
  created_booking_id uuid;
  worker_user_id uuid;
  platform_settings jsonb;
  booking_fee_amount numeric;
  payment_provider text;
  payment_currency text;
begin
  client_user_id := public.current_app_user_id();

  if client_user_id is null then
    raise exception 'Authentication is required to create a booking';
  end if;

  if not public.worker_can_receive_bookings(p_worker_id) then
    raise exception 'Worker cannot receive bookings right now';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.worker_id = p_worker_id
      and b.scheduled_at = p_scheduled_at
      and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
  ) then
    raise exception 'ეს დრო უკვე დაკავებულია. აირჩიეთ სხვა დრო.';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.worker_id = p_worker_id
      and b.client_id = client_user_id
      and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
  ) then
    raise exception 'ამ ხელოსანთან უკვე გაქვთ აქტიური ჯავშანი. ჯერ დაასრულეთ ან გააუქმეთ არსებული ჯავშანი.';
  end if;

  select workers.user_id
  into worker_user_id
  from public.workers
  where workers.id = p_worker_id;

  select professions.id
  into target_profession_id
  from public.professions
  where professions.name = p_profession_name
    and professions.is_active = true
  limit 1;

  if target_profession_id is null then
    select coalesce(workers.main_profession_id, first_worker_profession.profession_id)
    into target_profession_id
    from public.workers
    left join lateral (
      select worker_professions.profession_id
      from public.worker_professions
      join public.professions
        on professions.id = worker_professions.profession_id
       and professions.is_active = true
      where worker_professions.worker_id = workers.id
      order by professions.name
      limit 1
    ) first_worker_profession on true
    where workers.id = p_worker_id;
  end if;

  select value_json
  into platform_settings
  from public.platform_settings
  where key = 'platform';

  booking_fee_amount := coalesce(
    case
      when platform_settings ? 'bookingFee' then (platform_settings ->> 'bookingFee')::numeric
      else null
    end,
    p_booking_fee_amount,
    0
  );
  payment_provider := coalesce(nullif(platform_settings ->> 'paymentProvider', ''), 'manual_mvp_hold');
  payment_currency := coalesce(nullif(platform_settings ->> 'paymentCurrency', ''), 'GEL');

  insert into public.bookings (
    client_id,
    worker_id,
    profession_id,
    scheduled_at,
    status,
    city,
    address_text,
    client_comment,
    booking_fee_amount,
    payment_status
  )
  values (
    client_user_id,
    p_worker_id,
    target_profession_id,
    p_scheduled_at,
    'pending',
    p_city,
    p_address_text,
    p_client_comment,
    booking_fee_amount,
    case
      when booking_fee_amount > 0 then 'authorized'::public.payment_status
      else 'not_required'::public.payment_status
    end
  )
  returning id into created_booking_id;

  insert into public.booking_details (
    booking_id,
    area,
    height,
    length,
    rooms,
    wall_condition,
    target_surface,
    material_owner,
    plumbing_type,
    floor,
    electric_points,
    electric_panel,
    is_emergency,
    work_scope,
    surface_type,
    material_note,
    item_count,
    current_condition,
    photo_note,
    roof_type,
    extra_measurements,
    uploaded_photo_url
  )
  values (
    created_booking_id,
    nullif(p_details ->> 'area', '')::numeric,
    nullif(p_details ->> 'height', '')::numeric,
    nullif(p_details ->> 'length', '')::numeric,
    nullif(p_details ->> 'rooms', '')::integer,
    nullif(p_details ->> 'wall_condition', ''),
    nullif(p_details ->> 'target_surface', ''),
    coalesce(nullif(p_details ->> 'material_owner', '')::public.material_owner, 'unknown'),
    nullif(p_details ->> 'plumbing_type', ''),
    nullif(p_details ->> 'floor', '')::integer,
    nullif(p_details ->> 'electric_points', '')::integer,
    nullif(p_details ->> 'electric_panel', ''),
    nullif(p_details ->> 'is_emergency', '')::boolean,
    nullif(p_details ->> 'work_scope', ''),
    nullif(p_details ->> 'surface_type', ''),
    nullif(p_details ->> 'material_note', ''),
    nullif(p_details ->> 'item_count', ''),
    nullif(p_details ->> 'current_condition', ''),
    nullif(p_details ->> 'photo_note', ''),
    nullif(p_details ->> 'roof_type', ''),
    coalesce(p_details -> 'extra_measurements', '{}'::jsonb),
    nullif(p_details ->> 'uploaded_photo_url', '')
  );

  if booking_fee_amount > 0 then
    insert into public.payments (
      booking_id,
      payer_id,
      worker_id,
      amount,
      currency,
      provider,
      provider_payment_id,
      status
    )
    values (
      created_booking_id,
      client_user_id,
      p_worker_id,
      booking_fee_amount,
      payment_currency,
      payment_provider,
      'mvp-' || created_booking_id::text,
      'authorized'
    );
  end if;

  insert into public.notifications (
    user_id,
    booking_id,
    type,
    title,
    body
  )
  values (
    worker_user_id,
    created_booking_id,
    'new_booking',
    'ახალი ჯავშანი',
    'კლიენტმა ახალი ჯავშანი გამოგიგზავნათ. გახსენით დეტალები და დაადასტურეთ ან უარყავით.'
  );

  return jsonb_build_object('booking_id', created_booking_id);
end;
$$;

grant execute on function public.create_booking_request(
  uuid,
  text,
  timestamptz,
  text,
  text,
  text,
  numeric,
  jsonb
) to authenticated;

create or replace function public.update_booking_status_action(
  p_booking_id uuid,
  p_status public.booking_status,
  p_cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_worker_id uuid;
  target_booking public.bookings%rowtype;
  worker_allowed_statuses public.booking_status[] := array[
    'confirmed',
    'declined',
    'en_route',
    'started',
    'worker_completed',
    'cancelled'
  ]::public.booking_status[];
  client_allowed_statuses public.booking_status[] := array[
    'client_confirmed',
    'cancelled',
    'disputed'
  ]::public.booking_status[];
begin
  current_user_id := public.current_app_user_id();
  current_worker_id := public.current_app_worker_id();

  if current_user_id is null then
    raise exception 'Authentication is required to update booking status';
  end if;

  select *
  into target_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if target_booking.id is null then
    raise exception 'Booking not found';
  end if;

  if public.current_app_user_is_admin() then
    null;
  elsif target_booking.worker_id = current_worker_id then
    if not p_status = any(worker_allowed_statuses) then
      raise exception 'Worker cannot set booking status to %', p_status;
    end if;
  elsif target_booking.client_id = current_user_id then
    if not p_status = any(client_allowed_statuses) then
      raise exception 'Client cannot set booking status to %', p_status;
    end if;
  else
    raise exception 'You do not have access to this booking';
  end if;

  update public.bookings
  set
    status = p_status,
    cancellation_reason = case
      when p_status = 'cancelled' then nullif(p_cancellation_reason, '')
      else cancellation_reason
    end
  where id = p_booking_id;

  return jsonb_build_object(
    'booking_id',
    p_booking_id,
    'status',
    p_status
  );
end;
$$;

grant execute on function public.update_booking_status_action(
  uuid,
  public.booking_status,
  text
) to authenticated;
-- END SOURCE 14: supabase/booking_actions.sql

-- BEGIN SOURCE 15: supabase/booking_reason_actions.sql
-- Run after booking_actions.sql and booking_workflow.sql.
-- Makes worker refusal reasons mandatory and delivers them to the other party.

create or replace function public.update_booking_status_action(
  p_booking_id uuid,
  p_status public.booking_status,
  p_cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_worker_id uuid;
  target_booking public.bookings%rowtype;
  worker_allowed_statuses public.booking_status[] := array[
    'confirmed', 'declined', 'en_route', 'started', 'worker_completed', 'cancelled'
  ]::public.booking_status[];
  client_allowed_statuses public.booking_status[] := array[
    'client_confirmed', 'cancelled', 'disputed'
  ]::public.booking_status[];
  clean_reason text := nullif(trim(coalesce(p_cancellation_reason, '')), '');
begin
  current_user_id := public.current_app_user_id();
  current_worker_id := public.current_app_worker_id();

  if current_user_id is null then
    raise exception 'Authentication is required to update booking status';
  end if;

  select * into target_booking from public.bookings where id = p_booking_id for update;
  if target_booking.id is null then
    raise exception 'Booking not found';
  end if;

  if public.current_app_user_is_admin() then
    null;
  elsif target_booking.worker_id = current_worker_id then
    if not p_status = any(worker_allowed_statuses) then
      raise exception 'Worker cannot set booking status to %', p_status;
    end if;
    if p_status in ('declined', 'cancelled') and clean_reason is null then
      raise exception 'A reason is required for declining or cancelling a booking';
    end if;
  elsif target_booking.client_id = current_user_id then
    if not p_status = any(client_allowed_statuses) then
      raise exception 'Client cannot set booking status to %', p_status;
    end if;
  else
    raise exception 'You do not have access to this booking';
  end if;

  update public.bookings
  set
    status = p_status,
    cancellation_reason = case
      when p_status in ('declined', 'cancelled') then clean_reason
      else cancellation_reason
    end
  where id = p_booking_id;

  return jsonb_build_object('booking_id', p_booking_id, 'status', p_status);
end;
$$;

grant execute on function public.update_booking_status_action(
  uuid, public.booking_status, text
) to authenticated;

create or replace function public.notify_booking_status_change()
returns trigger
language plpgsql
as $$
declare
  actor_user_id uuid;
  worker_user_id uuid;
  notification_title text;
  notification_body text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  actor_user_id := public.current_app_user_id();
  select workers.user_id into worker_user_id from public.workers where workers.id = new.worker_id;
  notification_title := public.booking_status_title(new.status);
  notification_body := public.booking_status_body(old.status, new.status);

  if new.status in ('declined', 'cancelled') and new.cancellation_reason is not null then
    notification_body := notification_body || ' მიზეზი: ' || new.cancellation_reason;
  end if;

  if new.client_id is not null and new.client_id is distinct from actor_user_id then
    perform public.notify_user(
      new.client_id,
      new.id,
      case when new.status = 'worker_completed' then 'review' else 'booking_status' end,
      notification_title,
      notification_body
    );
  end if;

  if worker_user_id is not null and worker_user_id is distinct from actor_user_id then
    perform public.notify_user(
      worker_user_id,
      new.id,
      'booking_status',
      notification_title,
      notification_body
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_notify_status_change on public.bookings;
create trigger bookings_notify_status_change
after update of status on public.bookings
for each row execute function public.notify_booking_status_change();

-- A client may leave a reliability review after a worker declines a request.
create or replace function public.create_booking_review(
  p_booking_id uuid,
  p_reviewee_role public.reviewee_role,
  p_overall_rating integer,
  p_criteria_json jsonb default '{}'::jsonb,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_worker_id uuid;
  target_booking public.bookings%rowtype;
  worker_user_id uuid;
  reviewee_user_id uuid;
begin
  current_user_id := public.current_app_user_id();
  current_worker_id := public.current_app_worker_id();
  if current_user_id is null then raise exception 'Authentication is required to create a review'; end if;
  if p_overall_rating < 1 or p_overall_rating > 5 then raise exception 'Overall rating must be between 1 and 5'; end if;

  select * into target_booking from public.bookings where id = p_booking_id;
  if target_booking.id is null then raise exception 'Booking not found'; end if;

  select workers.user_id into worker_user_id from public.workers where workers.id = target_booking.worker_id;
  if p_reviewee_role = 'craftsman' then
    if target_booking.client_id <> current_user_id then raise exception 'Only the client can review the worker for this booking'; end if;
    if target_booking.status not in ('worker_completed', 'client_confirmed', 'closed', 'declined') then
      raise exception 'Booking is not ready for a worker review yet';
    end if;
    reviewee_user_id := worker_user_id;
  elsif p_reviewee_role = 'client' then
    if target_booking.worker_id <> current_worker_id then raise exception 'Only the worker can review the client for this booking'; end if;
    if target_booking.status not in ('worker_completed', 'client_confirmed', 'closed') then
      raise exception 'Booking is not ready for a client review yet';
    end if;
    reviewee_user_id := target_booking.client_id;
  else
    raise exception 'Unsupported reviewee role';
  end if;

  if exists (
    select 1 from public.reviews
    where booking_id = p_booking_id and reviewer_id = current_user_id and reviewee_id = reviewee_user_id
  ) then raise exception 'This booking has already been reviewed by this user'; end if;

  insert into public.reviews (booking_id, reviewer_id, reviewee_id, reviewee_role, overall_rating, criteria_json, comment)
  values (p_booking_id, current_user_id, reviewee_user_id, p_reviewee_role, p_overall_rating, coalesce(p_criteria_json, '{}'::jsonb), nullif(p_comment, ''));

  if p_reviewee_role = 'craftsman' and target_booking.client_id = current_user_id then
    insert into public.client_points (user_id, booking_id, points, reason)
    values (current_user_id, p_booking_id, 10, 'ხელოსნის შეფასება დასრულებული ან უარყოფილი ჯავშნის შემდეგ');
  end if;

  return jsonb_build_object('booking_id', p_booking_id, 'reviewee_role', p_reviewee_role, 'overall_rating', p_overall_rating);
end;
$$;

grant execute on function public.create_booking_review(
  uuid, public.reviewee_role, integer, jsonb, text
) to authenticated;
-- END SOURCE 15: supabase/booking_reason_actions.sql

-- BEGIN SOURCE 16: supabase/profile_actions.sql
drop function if exists public.update_current_user_profile(text, text, text);
drop function if exists public.update_current_user_profile(text, text, text, text, text);
drop function if exists public.update_current_user_profile(text, text, text, text, text, text);

create or replace function public.update_current_user_profile(
  p_first_name text,
  p_last_name text,
  p_contact_phone text,
  p_photo_url text,
  p_city text default null,
  p_address_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to update profile';
  end if;

  update public.users
  set
    first_name = coalesce(nullif(p_first_name, ''), first_name),
    last_name = coalesce(nullif(p_last_name, ''), last_name),
    contact_phone = coalesce(nullif(p_contact_phone, ''), contact_phone),
    photo_url = coalesce(nullif(p_photo_url, ''), photo_url),
    city = coalesce(nullif(p_city, ''), city),
    address_text = coalesce(nullif(p_address_text, ''), address_text),
    updated_at = now()
  where id = current_user_id;

  return jsonb_build_object('user_id', current_user_id);
end;
$$;

grant execute on function public.update_current_user_profile(
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

alter table public.users
add column if not exists city text;

alter table public.users
add column if not exists address_text text;

alter table public.users
add column if not exists contact_phone text;

alter table public.workers
add column if not exists experience_years integer not null default 0;

create or replace function public.get_current_user_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read profile';
  end if;

  select jsonb_build_object(
    'id', id,
    'role', role,
    'phone', phone,
    'contact_phone', contact_phone,
    'first_name', first_name,
    'last_name', last_name,
    'photo_url', photo_url,
    'city', city,
    'address_text', address_text,
    'rating_avg', rating_avg,
    'rating_count', rating_count,
    'status', status
  )
  into result
  from public.users
  where id = current_user_id;

  return result;
end;
$$;

grant execute on function public.get_current_user_profile()
to authenticated;

create or replace function public.get_current_worker_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_worker_id uuid;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();
  current_worker_id := public.current_app_worker_id();

  if current_user_id is null or current_worker_id is null then
    raise exception 'Only a worker can read worker profile';
  end if;

  select jsonb_build_object(
    'first_name', coalesce(
      nullif(u.first_name, ''),
      nullif(split_part(coalesce(w.display_name, ''), ' ', 1), '')
    ),
    'last_name', coalesce(
      nullif(u.last_name, ''),
      nullif(trim(regexp_replace(coalesce(w.display_name, ''), '^\S+\s*', '')), '')
    ),
    'display_name', nullif(w.display_name, ''),
    'photo_url', u.photo_url,
    'contact_phone', u.contact_phone,
    'city', w.city,
    'about', w.about,
    'experience_years', w.experience_years,
    'verification_status', w.verification_status,
    'trial_started_at', w.trial_started_at,
    'subscription_status', w.subscription_status,
    'subscription', (
      select jsonb_build_object(
        'plan', s.plan,
        'amount', s.amount,
        'status', s.status,
        'trial_ends_at', s.trial_ends_at,
        'current_period_start', s.current_period_start,
        'current_period_end', s.current_period_end
      )
      from public.subscriptions s
      where s.worker_id = w.id
        and s.status in ('trial', 'active', 'past_due')
      order by s.created_at desc
      limit 1
    ),
    'verification_documents', jsonb_build_object(
      'id_front', (
        select vd.file_url
        from public.verification_documents vd
        where vd.worker_id = w.id
          and vd.type = 'id_front'
        order by vd.created_at desc
        limit 1
      ),
      'id_back', (
        select vd.file_url
        from public.verification_documents vd
        where vd.worker_id = w.id
          and vd.type = 'id_back'
        order by vd.created_at desc
        limit 1
      ),
      'bank_account', (
        select vd.file_url
        from public.verification_documents vd
        where vd.worker_id = w.id
          and vd.type = 'bank_account'
        order by vd.created_at desc
        limit 1
      )
    ),
    'price_type', w.price_type,
    'price_min', w.price_min,
    'price_max', w.price_max,
    'professions', coalesce(
      (
        select jsonb_agg(p.name order by p.name)
        from public.worker_professions wp
        join public.professions p on p.id = wp.profession_id
        where wp.worker_id = w.id
      ),
      '[]'::jsonb
    ),
    'schedule', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'weekday', ws.weekday,
            'start_time', to_char(ws.start_time, 'HH24:MI'),
            'end_time', to_char(ws.end_time, 'HH24:MI')
          )
          order by ws.weekday
        )
        from public.worker_schedule ws
        where ws.worker_id = w.id
      ),
      '[]'::jsonb
    ),
    'unavailable_ranges', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'start', to_char(wur.starts_at, 'YYYY-MM-DD'),
            'end', to_char(wur.ends_at, 'YYYY-MM-DD')
          )
          order by wur.starts_at
        )
        from public.worker_unavailable_ranges wur
        where wur.worker_id = w.id
      ),
      '[]'::jsonb
    )
  )
  into result
  from public.users u
  join public.workers w on w.user_id = u.id
  where u.id = current_user_id
    and w.id = current_worker_id;

  return result;
end;
$$;

grant execute on function public.get_current_worker_profile() to authenticated;

drop function if exists public.save_current_worker_profile(
  text,
  text,
  text,
  text,
  text,
  text[],
  public.price_type,
  numeric,
  numeric,
  jsonb,
  jsonb
);

drop function if exists public.save_current_worker_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  integer,
  public.price_type,
  numeric,
  numeric,
  jsonb,
  jsonb
);

create or replace function public.save_current_worker_profile(
  p_first_name text,
  p_last_name text,
  p_contact_phone text,
  p_photo_url text,
  p_city text,
  p_about text,
  p_professions text[],
  p_experience_years integer,
  p_price_type public.price_type,
  p_price_min numeric,
  p_price_max numeric,
  p_schedule jsonb,
  p_unavailable_ranges jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_worker_id uuid;
  main_profession uuid;
begin
  current_user_id := public.current_app_user_id();
  current_worker_id := public.current_app_worker_id();

  if current_user_id is null or current_worker_id is null then
    raise exception 'Only a worker can save worker profile';
  end if;

  if p_price_type = 'range' and p_price_max is null then
    raise exception 'Range price requires max price';
  end if;

  update public.users
  set
    first_name = coalesce(nullif(p_first_name, ''), first_name),
    last_name = coalesce(nullif(p_last_name, ''), last_name),
    contact_phone = coalesce(nullif(p_contact_phone, ''), contact_phone),
    photo_url = coalesce(nullif(p_photo_url, ''), photo_url),
    updated_at = now()
  where id = current_user_id;

  insert into public.professions (name, category, is_active)
  select distinct trim(profession_name), 'რემონტი', true
  from unnest(coalesce(p_professions, array[]::text[])) as profession_name
  where trim(profession_name) <> ''
  on conflict (name) do update
  set is_active = true;

  select id
  into main_profession
  from public.professions
  where name = any(coalesce(p_professions, array[]::text[]))
    and is_active = true
  order by array_position(p_professions, name)
  limit 1;

  update public.workers
  set
    display_name = nullif(trim(concat_ws(' ', p_first_name, p_last_name)), ''),
    city = coalesce(nullif(p_city, ''), city),
    about = nullif(p_about, ''),
    experience_years = greatest(coalesce(p_experience_years, experience_years, 0), 0),
    price_type = coalesce(p_price_type, price_type),
    price_min = p_price_min,
    price_max = case when p_price_type = 'range' then p_price_max else null end,
    main_profession_id = main_profession,
    is_active = main_profession is not null
      and verification_status = 'verified'::public.worker_verification_status,
    updated_at = now()
  where id = current_worker_id;

  delete from public.worker_professions
  where worker_id = current_worker_id;

  insert into public.worker_professions (worker_id, profession_id)
  select current_worker_id, p.id
  from public.professions p
  where p.name = any(coalesce(p_professions, array[]::text[]))
    and p.is_active = true
  on conflict do nothing;

  delete from public.worker_schedule
  where worker_id = current_worker_id;

  insert into public.worker_schedule (worker_id, weekday, start_time, end_time)
  select
    current_worker_id,
    (item ->> 'weekday')::integer,
    (item ->> 'start_time')::time,
    (item ->> 'end_time')::time
  from jsonb_array_elements(coalesce(p_schedule, '[]'::jsonb)) item
  where (item ->> 'weekday') is not null
    and (item ->> 'start_time') is not null
    and (item ->> 'end_time') is not null;

  delete from public.worker_unavailable_ranges
  where worker_id = current_worker_id;

  insert into public.worker_unavailable_ranges (
    worker_id,
    starts_at,
    ends_at
  )
  select
    current_worker_id,
    ((item ->> 'start')::date)::timestamptz,
    (((item ->> 'end')::date + interval '1 day')::timestamptz)
  from jsonb_array_elements(coalesce(p_unavailable_ranges, '[]'::jsonb)) item
  where (item ->> 'start') is not null
    and (item ->> 'end') is not null;

  return public.get_current_worker_profile();
end;
$$;

grant execute on function public.save_current_worker_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  integer,
  public.price_type,
  numeric,
  numeric,
  jsonb,
  jsonb
) to authenticated;

create or replace function public.add_worker_verification_document(
  p_type public.verification_document_type,
  p_file_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_worker_id uuid;
  completed boolean;
begin
  current_worker_id := public.current_app_worker_id();

  if current_worker_id is null then
    raise exception 'Only a worker can upload verification documents';
  end if;

  insert into public.verification_documents (
    worker_id,
    type,
    file_url,
    status
  )
  values (
    current_worker_id,
    p_type,
    p_file_url,
    'pending'
  )
  on conflict (worker_id, type) do update set
    file_url = excluded.file_url,
    status = 'pending',
    reviewed_by = null,
    reviewed_at = null;

  select count(*) = 3
  into completed
  from public.verification_documents
  where worker_id = current_worker_id
    and type in ('id_front', 'id_back', 'bank_account');

  if completed then
    update public.workers
    set verification_status = 'pending'
    where id = current_worker_id;
  end if;

  return jsonb_build_object(
    'worker_id',
    current_worker_id,
    'verification_status',
    case when completed then 'pending' else 'not_started' end
  );
end;
$$;

grant execute on function public.add_worker_verification_document(
  public.verification_document_type,
  text
) to authenticated;
-- END SOURCE 16: supabase/profile_actions.sql

-- BEGIN SOURCE 17: supabase/review_actions.sql
create table if not exists public.client_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.client_points enable row level security;

drop policy if exists "users can read own client points"
on public.client_points;

create policy "users can read own client points"
on public.client_points for select
using (user_id = public.current_app_user_id());

create or replace function public.create_booking_review(
  p_booking_id uuid,
  p_reviewee_role public.reviewee_role,
  p_overall_rating integer,
  p_criteria_json jsonb default '{}'::jsonb,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_worker_id uuid;
  target_booking public.bookings%rowtype;
  worker_user_id uuid;
  reviewee_user_id uuid;
begin
  current_user_id := public.current_app_user_id();
  current_worker_id := public.current_app_worker_id();

  if current_user_id is null then
    raise exception 'Authentication is required to create a review';
  end if;

  if p_overall_rating < 1 or p_overall_rating > 5 then
    raise exception 'Overall rating must be between 1 and 5';
  end if;

  select *
  into target_booking
  from public.bookings
  where id = p_booking_id;

  if target_booking.id is null then
    raise exception 'Booking not found';
  end if;

  if target_booking.status not in (
    'worker_completed',
    'client_confirmed',
    'closed',
    'cancelled',
    'disputed'
  ) then
    raise exception 'Booking is not ready for review yet';
  end if;

  select workers.user_id
  into worker_user_id
  from public.workers
  where workers.id = target_booking.worker_id;

  if p_reviewee_role = 'craftsman' then
    if target_booking.client_id <> current_user_id then
      raise exception 'Only the client can review the worker for this booking';
    end if;
    reviewee_user_id := worker_user_id;
  elsif p_reviewee_role = 'client' then
    if target_booking.worker_id <> current_worker_id then
      raise exception 'Only the worker can review the client for this booking';
    end if;
    reviewee_user_id := target_booking.client_id;
  else
    raise exception 'Unsupported reviewee role';
  end if;

  if exists (
    select 1
    from public.reviews
    where booking_id = p_booking_id
      and reviewer_id = current_user_id
      and reviewee_id = reviewee_user_id
  ) then
    raise exception 'This booking has already been reviewed by this user';
  end if;

  insert into public.reviews (
    booking_id,
    reviewer_id,
    reviewee_id,
    reviewee_role,
    overall_rating,
    criteria_json,
    comment
  )
  values (
    p_booking_id,
    current_user_id,
    reviewee_user_id,
    p_reviewee_role,
    p_overall_rating,
    coalesce(p_criteria_json, '{}'::jsonb),
    nullif(p_comment, '')
  );

  if p_reviewee_role = 'craftsman' and target_booking.client_id = current_user_id then
    insert into public.client_points (
      user_id,
      booking_id,
      points,
      reason
    )
    values (
      current_user_id,
      p_booking_id,
      10,
      'ხელოსნის შეფასება დასრულებული ჯავშნის შემდეგ'
    );
  end if;

  return jsonb_build_object(
    'booking_id',
    p_booking_id,
    'reviewee_role',
    p_reviewee_role,
    'overall_rating',
    p_overall_rating
  );
end;
$$;

grant execute on function public.create_booking_review(
  uuid,
  public.reviewee_role,
  integer,
  jsonb,
  text
) to authenticated;

create or replace function public.list_my_reviewed_booking_ids(
  p_reviewee_role public.reviewee_role
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read reviews';
  end if;

  select coalesce(jsonb_agg(reviews.booking_id order by reviews.created_at desc), '[]'::jsonb)
  into result
  from public.reviews
  where reviewer_id = current_user_id
    and reviewee_role = p_reviewee_role;

  return result;
end;
$$;

grant execute on function public.list_my_reviewed_booking_ids(
  public.reviewee_role
) to authenticated;

create or replace function public.get_my_client_points()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read points';
  end if;

  select jsonb_build_object(
    'total', coalesce(sum(points), 0),
    'history', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'points', points,
          'reason', reason,
          'createdAt', created_at
        )
        order by created_at desc
      ),
      '[]'::jsonb
    )
  )
  into result
  from public.client_points
  where user_id = current_user_id;

  return result;
end;
$$;

grant execute on function public.get_my_client_points()
to authenticated;
-- END SOURCE 17: supabase/review_actions.sql

-- BEGIN SOURCE 18: supabase/public_review_feed.sql
-- Safe public review feed for a craftsman's profile.
-- It deliberately omits reviewer identity, booking details, phone numbers, and addresses.
create or replace function public.get_worker_public_reviews(p_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  worker_user_id uuid;
begin
  select user_id
  into worker_user_id
  from public.workers
  where id = p_worker_id
    and verification_status = 'verified';

  if worker_user_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', reviews.id,
          'overall', reviews.overall_rating,
          'criteria', reviews.criteria_json,
          'comment', reviews.comment,
          'createdAt', reviews.created_at
        )
        order by reviews.created_at desc
      )
      from (
        select id, overall_rating, criteria_json, comment, created_at
        from public.reviews
        where reviewee_id = worker_user_id
          and reviewee_role = 'craftsman'
        order by created_at desc
        limit 20
      ) as reviews
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.get_worker_public_reviews(uuid) to authenticated;
-- END SOURCE 18: supabase/public_review_feed.sql

-- BEGIN SOURCE 19: supabase/message_actions.sql
alter table public.messages
add column if not exists attachment_url text;

alter table public.messages
add column if not exists attachment_type text;

alter table public.messages
add column if not exists attachment_name text;

drop function if exists public.send_booking_message(uuid, text);

create or replace function public.send_booking_message(
  p_booking_id uuid,
  p_text text,
  p_attachment_url text default null,
  p_attachment_type text default null,
  p_attachment_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  created_message_id uuid;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to send a message';
  end if;

  if not public.user_can_access_booking(p_booking_id) then
    raise exception 'You do not have access to this booking';
  end if;

  if nullif(trim(p_text), '') is null and nullif(trim(coalesce(p_attachment_url, '')), '') is null then
    raise exception 'Message text is required';
  end if;

  insert into public.messages (
    booking_id,
    sender_id,
    text,
    attachment_url,
    attachment_type,
    attachment_name
  )
  values (
    p_booking_id,
    current_user_id,
    coalesce(nullif(trim(p_text), ''), 'ფოტო'),
    nullif(trim(coalesce(p_attachment_url, '')), ''),
    nullif(trim(coalesce(p_attachment_type, '')), ''),
    nullif(trim(coalesce(p_attachment_name, '')), '')
  )
  returning id into created_message_id;

  return jsonb_build_object(
    'message_id',
    created_message_id,
    'booking_id',
    p_booking_id
  );
end;
$$;

grant execute on function public.send_booking_message(uuid, text, text, text, text)
to authenticated;

create or replace function public.admin_send_booking_message(
  p_booking_id uuid,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  target_booking public.bookings%rowtype;
  worker_user_id uuid;
  created_message_id uuid := gen_random_uuid();
  message_text text := nullif(trim(coalesce(p_text, '')), '');
begin
  if not public.current_admin_has_permission('bookings') then
    raise exception 'Bookings permission is required to send an admin message';
  end if;

  if actor is null then
    raise exception 'Authentication is required to send a message';
  end if;

  if message_text is null then
    raise exception 'Message text is required';
  end if;

  select *
  into target_booking
  from public.bookings
  where id = p_booking_id;

  if target_booking.id is null then
    raise exception 'Booking not found';
  end if;

  select user_id
  into worker_user_id
  from public.workers
  where id = target_booking.worker_id;

  perform public.notify_user(
    worker_user_id,
    p_booking_id,
    'admin_message',
    'Admin შეტყობინება',
    message_text
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata_json)
  values (
    actor,
    'admin_message_sent',
    'booking',
    p_booking_id,
    jsonb_build_object('summary', message_text)
  );

  return jsonb_build_object(
    'message_id', created_message_id,
    'booking_id', p_booking_id
  );
end;
$$;

grant execute on function public.admin_send_booking_message(uuid, text)
to authenticated;

create or replace function public.mark_booking_messages_read(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_count integer;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to mark messages read';
  end if;

  if not public.user_can_access_booking(p_booking_id) then
    raise exception 'You do not have access to this booking';
  end if;

  update public.messages
  set read_at = now()
  where booking_id = p_booking_id
    and sender_id <> current_user_id
    and read_at is null;

  get diagnostics updated_count = row_count;

  return jsonb_build_object(
    'booking_id',
    p_booking_id,
    'updated_count',
    updated_count
  );
end;
$$;

grant execute on function public.mark_booking_messages_read(uuid)
to authenticated;

create or replace function public.list_my_message_threads()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_worker_id uuid;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();
  current_worker_id := public.current_app_worker_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read message threads';
  end if;

  select coalesce(jsonb_agg(item order by (item ->> 'archived')::boolean, ((item ->> 'unread_count')::integer > 0) desc, (item ->> 'last_at') desc nulls last), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'booking_id', b.id,
      'title',
        case
          when b.client_id = current_user_id then
            coalesce(w.display_name, trim(concat_ws(' ', wu.first_name, wu.last_name)), 'ხელოსანი')
          else
            trim(concat_ws(' ', cu.first_name, left(coalesce(cu.last_name, ''), 1) || case when cu.last_name is null or cu.last_name = '' then '' else '.' end))
        end,
      'subtitle',
        concat_ws(
          ' · ',
          coalesce(p.name, 'სამუშაო'),
          to_char(b.scheduled_at at time zone 'Asia/Tbilisi', 'DD.MM.YYYY'),
          to_char(b.scheduled_at at time zone 'Asia/Tbilisi', 'HH24:MI')
        ),
      'status', b.status,
      'last_text', coalesce(last_message.text, 'ჯერ მიმოწერა არ არის'),
      'last_at', last_message.created_at,
      'unread_count', (
        select count(*)
        from public.messages unread_messages
        left join public.users unread_sender on unread_sender.id = unread_messages.sender_id
        where unread_messages.booking_id = b.id
          and unread_messages.sender_id <> current_user_id
          and unread_messages.read_at is null
          and coalesce(unread_sender.role::text, '') <> 'admin'
          and unread_messages.text not like 'სისტემა:%'
      ),
      'archived', b.status::text in ('client_confirmed', 'closed', 'completed', 'declined', 'cancelled')
    ) as item
    from public.bookings b
    join public.workers w on w.id = b.worker_id
    join public.users wu on wu.id = w.user_id
    join public.users cu on cu.id = b.client_id
    left join public.professions p on p.id = b.profession_id
    left join lateral (
      select
        case
          when m.attachment_url is not null and nullif(m.text, '') is null then 'ფოტო'
          else m.text
        end as text,
        m.created_at
      from public.messages m
      left join public.users sender_user on sender_user.id = m.sender_id
      where m.booking_id = b.id
        and coalesce(sender_user.role::text, '') <> 'admin'
        and m.text not like 'სისტემა:%'
      order by m.created_at desc
      limit 1
    ) last_message on true
    where b.client_id = current_user_id
      or b.worker_id = current_worker_id
      or public.current_app_user_is_admin()
  ) threads;

  return result;
end;
$$;

grant execute on function public.list_my_message_threads()
to authenticated;

create or replace function public.list_booking_messages(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_role public.user_role;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read messages';
  end if;

  if not public.user_can_access_booking(p_booking_id) then
    raise exception 'You do not have access to this booking';
  end if;

  select role
  into current_role
  from public.users
  where id = current_user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'booking_id', m.booking_id,
      'sender',
        case
          when sender_user.role = 'admin' then 'system'
          when m.sender_id = current_user_id then current_role::text
          when current_role = 'client' then 'craftsman'
          else 'client'
        end,
      'text', m.text,
      'attachment_url', m.attachment_url,
      'attachment_type', m.attachment_type,
      'attachment_name', m.attachment_name,
      'created_at', m.created_at,
      'read_at', m.read_at
    )
    order by m.created_at
  ), '[]'::jsonb)
  into result
  from public.messages m
  left join public.users sender_user on sender_user.id = m.sender_id
  where m.booking_id = p_booking_id
    and coalesce(sender_user.role::text, '') <> 'admin'
    and m.text not like 'სისტემა:%';

  return result;
end;
$$;

grant execute on function public.list_booking_messages(uuid)
to authenticated;
-- END SOURCE 19: supabase/message_actions.sql

-- BEGIN SOURCE 20: supabase/notification_actions.sql
create or replace function public.notify_user(
  p_user_id uuid,
  p_booking_id uuid default null,
  p_type text default 'booking_status',
  p_title text default '',
  p_body text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notifications (
    user_id,
    booking_id,
    type,
    title,
    body
  )
  values (
    p_user_id,
    p_booking_id,
    coalesce(nullif(trim(p_type), ''), 'booking_status'),
    coalesce(nullif(trim(p_title), ''), 'შეტყობინება'),
    nullif(trim(coalesce(p_body, '')), '')
  );
end;
$$;

grant execute on function public.notify_user(uuid, uuid, text, text, text)
to authenticated;

create or replace function public.list_my_notifications(
  p_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read notifications';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'booking_id', n.booking_id,
      'type', n.type,
      'title', n.title,
      'body', n.body,
      'read_at', n.read_at,
      'created_at', n.created_at
    )
    order by n.created_at desc
  ), '[]'::jsonb)
  into result
  from (
    select *
    from public.notifications
    where user_id = current_user_id
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 100))
  ) n;

  return result;
end;
$$;

grant execute on function public.list_my_notifications(integer)
to authenticated;

create or replace function public.get_unread_notification_count()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  unread_count integer;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read notifications';
  end if;

  select count(*)
  into unread_count
  from public.notifications
  where user_id = current_user_id
    and read_at is null;

  return jsonb_build_object('unread_count', unread_count);
end;
$$;

grant execute on function public.get_unread_notification_count()
to authenticated;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to update notifications';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = current_user_id;

  if not found then
    raise exception 'Notification not found';
  end if;

  return jsonb_build_object('notification_id', p_notification_id);
end;
$$;

grant execute on function public.mark_notification_read(uuid)
to authenticated;

create or replace function public.mark_booking_notifications_read(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_count integer;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to update notifications';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where booking_id = p_booking_id
    and user_id = current_user_id
    and read_at is null;

  get diagnostics updated_count = row_count;

  return jsonb_build_object(
    'booking_id',
    p_booking_id,
    'updated_count',
    updated_count
  );
end;
$$;

grant execute on function public.mark_booking_notifications_read(uuid)
to authenticated;

create or replace function public.mark_all_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_count integer;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to update notifications';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where user_id = current_user_id
    and read_at is null;

  get diagnostics updated_count = row_count;

  return jsonb_build_object('updated_count', updated_count);
end;
$$;

grant execute on function public.mark_all_notifications_read()
to authenticated;
-- END SOURCE 20: supabase/notification_actions.sql

update public.e2e_sql_editor_install
set completed_stage = 2, updated_at = now()
where singleton = true
  and project_ref = 'ivguranttkxhxsdsppqk'
  and completed_stage = 1;
commit;
