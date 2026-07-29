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

create or replace function public.booking_worker_user_id(target_booking_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workers.user_id
  from public.bookings
  join public.workers on workers.id = bookings.worker_id
  where bookings.id = target_booking_id
  limit 1
$$;

create or replace function public.sync_booking_status_from_dispute()
returns trigger
language plpgsql
as $$
begin
  update public.bookings
  set status = 'disputed'
  where id = new.booking_id
    and status not in ('disputed', 'closed', 'cancelled');

  return new;
end;
$$;

drop trigger if exists disputes_sync_booking_status on public.disputes;

create trigger disputes_sync_booking_status
after insert on public.disputes
for each row execute function public.sync_booking_status_from_dispute();

create or replace function public.notify_dispute_change()
returns trigger
language plpgsql
as $$
declare
  client_user_id uuid;
  worker_user_id uuid;
  notification_title text;
begin
  if tg_op = 'INSERT' then
    return new;
  elsif old.status is distinct from new.status then
    notification_title := case new.status
      when 'reviewing' then 'დავა განხილვაშია'
      when 'resolved' then 'დავა დაიხურა'
      else 'დავის სტატუსი შეიცვალა'
    end;
  else
    return new;
  end if;

  if public.current_app_user_is_admin() then
    return new;
  end if;

  select bookings.client_id, public.booking_worker_user_id(bookings.id)
  into client_user_id, worker_user_id
  from public.bookings
  where bookings.id = new.booking_id;

  perform public.notify_user(
    client_user_id,
    new.booking_id,
    'dispute',
    notification_title,
    coalesce(new.admin_note, new.reason, 'დავის დეტალები იხილეთ ჯავშანში')
  );

  perform public.notify_user(
    worker_user_id,
    new.booking_id,
    'dispute',
    notification_title,
    coalesce(new.admin_note, new.reason, 'დავის დეტალები იხილეთ ჯავშანში')
  );

  if new.status in ('resolved', 'rejected') and new.resolved_at is null then
    new.resolved_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists disputes_notify_insert on public.disputes;
drop trigger if exists disputes_notify_update on public.disputes;

create trigger disputes_notify_update
before update of status on public.disputes
for each row execute function public.notify_dispute_change();

create or replace function public.audit_booking_cancellation()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status and new.status = 'cancelled' then
    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata_json
    ) values (
      public.current_app_user_id(),
      'booking_cancelled',
      'booking',
      new.id,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'scheduled_at', new.scheduled_at,
        'cancellation_reason', new.cancellation_reason
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_audit_cancellation on public.bookings;

create trigger bookings_audit_cancellation
after update of status on public.bookings
for each row execute function public.audit_booking_cancellation();
