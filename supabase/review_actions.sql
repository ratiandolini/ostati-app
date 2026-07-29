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
