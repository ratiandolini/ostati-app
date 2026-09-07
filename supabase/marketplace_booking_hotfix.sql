-- FIXART marketplace booking bridge.
-- Run this after schema.sql, policies.sql, booking_actions.sql and marketplace_growth.sql.

alter table public.bookings
add column if not exists job_post_id uuid references public.job_posts(id) on delete set null;

create unique index if not exists bookings_one_per_job_post_idx
on public.bookings (job_post_id)
where job_post_id is not null;

create or replace function public.create_booking_from_job_post(
  p_job_post_id uuid,
  p_scheduled_at timestamptz,
  p_address_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := public.current_app_user_id();
  v_post public.job_posts%rowtype;
  v_booking_id uuid;
  v_worker_user_id uuid;
  v_profession_id uuid;
  v_platform_settings jsonb;
  v_booking_fee numeric;
  v_payment_provider text;
  v_payment_currency text;
begin
  if v_client_id is null then
    raise exception 'Authentication is required to create a booking';
  end if;

  if p_scheduled_at is null or nullif(trim(coalesce(p_address_text, '')), '') is null then
    raise exception 'Exact scheduled date/time and address are required';
  end if;

  select * into v_post
  from public.job_posts
  where id = p_job_post_id
    and client_id = v_client_id
  for update;

  if v_post.id is null then
    raise exception 'Job post not found';
  end if;

  if v_post.status <> 'selected' or v_post.selected_worker_id is null then
    raise exception 'A selected worker is required before creating a booking';
  end if;

  if exists (select 1 from public.bookings where job_post_id = v_post.id) then
    raise exception 'A booking already exists for this job post';
  end if;

  select w.user_id into v_worker_user_id
  from public.workers w
  join public.users u on u.id = w.user_id
  where w.id = v_post.selected_worker_id
    and w.is_active = true
    and w.verification_status = 'verified'
    and u.status = 'active';

  if v_worker_user_id is null then
    raise exception 'Selected worker is no longer available for bookings';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.worker_id = v_post.selected_worker_id
      and b.scheduled_at = p_scheduled_at
      and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
  ) then
    raise exception 'ეს დრო უკვე დაკავებულია. აირჩიეთ სხვა დრო.';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.worker_id = v_post.selected_worker_id
      and b.client_id = v_client_id
      and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
  ) then
    raise exception 'ამ ხელოსანთან უკვე გაქვთ აქტიური ჯავშანი. ჯერ დაასრულეთ ან გააუქმეთ არსებული ჯავშანი.';
  end if;

  select p.id into v_profession_id
  from public.professions p
  where p.name = v_post.profession_name and p.is_active = true
  limit 1;

  if v_profession_id is null then
    select coalesce(w.main_profession_id, wp.profession_id) into v_profession_id
    from public.workers w
    left join lateral (
      select worker_professions.profession_id
      from public.worker_professions
      join public.professions p on p.id = worker_professions.profession_id and p.is_active = true
      where worker_professions.worker_id = w.id
      order by p.name
      limit 1
    ) wp on true
    where w.id = v_post.selected_worker_id;
  end if;

  select value_json into v_platform_settings
  from public.platform_settings where key = 'platform';
  v_booking_fee := coalesce(
    case when v_platform_settings ? 'bookingFee' then (v_platform_settings ->> 'bookingFee')::numeric end,
    15,
    0
  );
  v_payment_provider := coalesce(nullif(v_platform_settings ->> 'paymentProvider', ''), 'manual_mvp_hold');
  v_payment_currency := coalesce(nullif(v_platform_settings ->> 'paymentCurrency', ''), 'GEL');

  insert into public.bookings (
    job_post_id, client_id, worker_id, profession_id, scheduled_at, status,
    city, address_text, client_comment, booking_fee_amount, payment_status
  ) values (
    v_post.id, v_client_id, v_post.selected_worker_id, v_profession_id, p_scheduled_at, 'pending',
    v_post.city, nullif(trim(p_address_text), ''), nullif(trim(v_post.description), ''), v_booking_fee,
    case when v_booking_fee > 0 then 'authorized'::public.payment_status else 'not_required'::public.payment_status end
  ) returning id into v_booking_id;

  insert into public.booking_details (booking_id, work_scope, photo_note, extra_measurements)
  values (
    v_booking_id,
    nullif(trim(v_post.title), ''),
    case when v_post.photo_url is not null then 'მოთხოვნას აქვს დამატებული ფოტოები.' else null end,
    jsonb_build_object('job_post_id', v_post.id, 'area_label', v_post.area_label)
  );

  if v_booking_fee > 0 then
    insert into public.payments (booking_id, payer_id, worker_id, amount, currency, provider, provider_payment_id, status)
    values (v_booking_id, v_client_id, v_post.selected_worker_id, v_booking_fee, v_payment_currency, v_payment_provider, 'mvp-' || v_booking_id::text, 'authorized');
  end if;

  insert into public.notifications (user_id, booking_id, type, title, body)
  values (v_worker_user_id, v_booking_id, 'new_booking', 'ახალი ჯავშანი', 'კლიენტმა არჩეულ მოთხოვნაზე ჯავშანი გამოგიგზავნათ.');

  return jsonb_build_object('booking_id', v_booking_id, 'job_post_id', v_post.id);
end;
$$;

grant execute on function public.create_booking_from_job_post(uuid, timestamptz, text) to authenticated;
