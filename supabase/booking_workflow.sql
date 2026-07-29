create or replace function public.is_allowed_booking_status_transition(
  old_status public.booking_status,
  new_status public.booking_status
)
returns boolean
language sql
immutable
as $$
  select
    old_status = new_status
    or (
      old_status = 'pending'
      and new_status in ('confirmed', 'declined', 'cancelled', 'disputed')
    )
    or (
      old_status = 'confirmed'
      and new_status in ('en_route', 'started', 'cancelled', 'disputed')
    )
    or (
      old_status = 'en_route'
      and new_status in ('started', 'cancelled', 'disputed')
    )
    or (
      old_status = 'started'
      and new_status in ('worker_completed', 'cancelled', 'disputed')
    )
    or (
      old_status = 'worker_completed'
      and new_status in ('client_confirmed', 'disputed')
    )
    or (
      old_status = 'client_confirmed'
      and new_status in ('closed', 'disputed')
    )
    or (
      old_status = 'disputed'
      and new_status in ('closed', 'cancelled')
    )
$$;

create or replace function public.validate_booking_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status
    and not public.is_allowed_booking_status_transition(old.status, new.status)
  then
    raise exception 'Invalid booking status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_validate_status_transition on public.bookings;

create trigger bookings_validate_status_transition
before update of status on public.bookings
for each row execute function public.validate_booking_status_transition();

create or replace function public.booking_status_title(
  status public.booking_status
)
returns text
language sql
immutable
as $$
  select case status
    when 'pending' then 'ჯავშანი მოლოდინშია'
    when 'confirmed' then 'ჯავშანი დადასტურდა'
    when 'en_route' then 'ხელოსანი გზაშია'
    when 'started' then 'სამუშაო დაიწყო'
    when 'worker_completed' then 'ხელოსანმა სამუშაო დასრულებულად მონიშნა'
    when 'client_confirmed' then 'კლიენტმა დასრულება დაადასტურა'
    when 'closed' then 'ჯავშანი დაიხურა'
    when 'declined' then 'ჯავშანი უარყოფილია'
    when 'cancelled' then 'ჯავშანი გაუქმებულია'
    when 'disputed' then 'ჯავშანზე დავა გაიხსნა'
  end
$$;

create or replace function public.booking_status_body(
  old_status public.booking_status,
  new_status public.booking_status
)
returns text
language sql
immutable
as $$
  select case new_status
    when 'confirmed' then 'ხელოსანმა დაადასტურა ჯავშანი და მზადაა სამუშაოსთვის.'
    when 'en_route' then 'ხელოსანი გზაშია.'
    when 'started' then 'სამუშაო დაიწყო.'
    when 'worker_completed' then 'ხელოსანმა სამუშაო დასრულებულად მონიშნა. დაადასტურეთ შესრულება და შეაფასეთ.'
    when 'client_confirmed' then 'კლიენტმა სამუშაო დასრულებულად დაადასტურა.'
    when 'closed' then 'ჯავშანი დაიხურა.'
    when 'declined' then 'ხელოსანმა ჯავშანი უარყო. შეგიძლიათ შეაფასოთ გამოცდილება.'
    when 'cancelled' then 'ჯავშანი გაუქმდა. წესის დარღვევა აისახება რეიტინგსა და ანგარიშზე.'
    when 'disputed' then 'ჯავშანზე გაიხსნა პრობლემა და Admin გადაამოწმებს.'
    else 'ჯავშნის სტატუსი შეიცვალა: ' || old_status::text || ' -> ' || new_status::text
  end
$$;

create or replace function public.notify_booking_status_change()
returns trigger
language plpgsql
as $$
declare
  worker_user_id uuid;
  notification_title text;
  notification_body text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select workers.user_id
  into worker_user_id
  from public.workers
    where workers.id = new.worker_id;

  notification_title := public.booking_status_title(new.status);
  notification_body := public.booking_status_body(old.status, new.status);

  perform public.notify_user(
    new.client_id,
    new.id,
    case
      when new.status = 'worker_completed' then 'review'
      else 'booking_status'
    end,
    notification_title,
    notification_body
  );

  perform public.notify_user(
    worker_user_id,
    new.id,
    'booking_status',
    notification_title,
    notification_body
  );

  return new;
end;
$$;

drop trigger if exists bookings_notify_status_change on public.bookings;

create trigger bookings_notify_status_change
after update of status on public.bookings
for each row execute function public.notify_booking_status_change();
