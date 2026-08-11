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
