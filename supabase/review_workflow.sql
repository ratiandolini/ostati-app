create or replace function public.user_can_review_booking(
  target_booking_id uuid,
  target_reviewer_id uuid,
  target_reviewee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings
    join public.workers on workers.id = bookings.worker_id
    where bookings.id = target_booking_id
      and bookings.status in ('worker_completed', 'client_confirmed', 'closed', 'cancelled', 'disputed')
      and (
        (
          bookings.client_id = target_reviewer_id
          and workers.user_id = target_reviewee_id
        )
        or (
          workers.user_id = target_reviewer_id
          and bookings.client_id = target_reviewee_id
        )
      )
  )
$$;

create or replace function public.validate_review_participants()
returns trigger
language plpgsql
as $$
begin
  if new.reviewer_id = new.reviewee_id then
    raise exception 'Reviewer and reviewee cannot be the same user';
  end if;

  if not public.user_can_review_booking(
    new.booking_id,
    new.reviewer_id,
    new.reviewee_id
  ) then
    raise exception 'Review participants do not match booking parties or booking is not reviewable';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_validate_participants on public.reviews;

create trigger reviews_validate_participants
before insert or update on public.reviews
for each row execute function public.validate_review_participants();

create or replace function public.recalculate_user_rating(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_rating_avg numeric(3, 2);
  next_rating_count integer;
begin
  select
    coalesce(round(avg(overall_rating)::numeric, 2), 0),
    count(*)::integer
  into next_rating_avg, next_rating_count
  from public.reviews
  where reviewee_id = target_user_id;

  update public.users
  set
    rating_avg = next_rating_avg,
    rating_count = next_rating_count
  where id = target_user_id;
end;
$$;

create or replace function public.refresh_reviewee_rating()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_user_rating(old.reviewee_id);
    return old;
  end if;

  perform public.recalculate_user_rating(new.reviewee_id);

  if tg_op = 'UPDATE' and old.reviewee_id is distinct from new.reviewee_id then
    perform public.recalculate_user_rating(old.reviewee_id);
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_refresh_reviewee_rating on public.reviews;

create trigger reviews_refresh_reviewee_rating
after insert or update or delete on public.reviews
for each row execute function public.refresh_reviewee_rating();
