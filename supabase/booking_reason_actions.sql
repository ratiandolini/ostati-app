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
