-- Lets a client replace a worker while the request is still pending or after
-- the worker declined it. A new booking keeps the new conversation private.

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
    when 'declined' then 'ხელოსანმა ჯავშანი უარყო. შეგიძლიათ აირჩიოთ სხვა ხელოსანი.'
    when 'cancelled' then 'ჯავშანი გაუქმდა. დეტალებში ნახეთ მიზეზი და თანხის სტატუსი.'
    when 'disputed' then 'ჯავშანზე გაიხსნა პრობლემა და Admin გადაამოწმებს.'
    else 'ჯავშნის სტატუსი შეიცვალა: ' || old_status::text || ' -> ' || new_status::text
  end
$$;

create or replace function public.change_my_booking_worker(
  p_booking_id uuid,
  p_new_worker_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  old_booking public.bookings%rowtype;
  new_booking_id uuid;
  new_worker_user_id uuid;
  replacement_reason text;
  platform_settings jsonb;
  payment_provider text;
  payment_currency text;
  target_payment public.payments%rowtype;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'ხელოსნის შესაცვლელად საჭიროა ავტორიზაცია';
  end if;

  select *
  into old_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if old_booking.id is null then
    raise exception 'ჯავშანი ვერ მოიძებნა';
  end if;

  if old_booking.client_id <> current_user_id then
    raise exception 'ამ ჯავშანზე ხელოსნის შეცვლის უფლება არ გაქვთ';
  end if;

  if old_booking.status not in ('pending', 'declined') then
    raise exception 'ხელოსნის შეცვლა შესაძლებელია მხოლოდ მოლოდინში ან უარყოფილ ჯავშანზე';
  end if;

  if old_booking.worker_id = p_new_worker_id then
    raise exception 'აირჩიეთ სხვა ხელოსანი';
  end if;

  if not public.worker_can_receive_bookings(p_new_worker_id) then
    raise exception 'არჩეული ხელოსანი ამჟამად ჯავშნებს ვერ იღებს';
  end if;

  select workers.user_id
  into new_worker_user_id
  from public.workers
  where workers.id = p_new_worker_id;

  if new_worker_user_id is null then
    raise exception 'არჩეული ხელოსანი ვერ მოიძებნა';
  end if;

  if old_booking.profession_id is not null and not exists (
    select 1
    from public.workers w
    where w.id = p_new_worker_id
      and (
        w.main_profession_id = old_booking.profession_id
        or exists (
          select 1
          from public.worker_professions wp
          where wp.worker_id = w.id
            and wp.profession_id = old_booking.profession_id
        )
      )
  ) then
    raise exception 'არჩეულ ხელოსანს ამ ჯავშნის შესაბამისი პროფესია არ აქვს';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.worker_id = p_new_worker_id
      and b.scheduled_at = old_booking.scheduled_at
      and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
  ) then
    raise exception 'არჩეული ხელოსნის ეს დრო უკვე დაკავებულია';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.worker_id = p_new_worker_id
      and b.client_id = current_user_id
      and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
  ) then
    raise exception 'ამ ხელოსანთან უკვე გაქვთ აქტიური ჯავშანი';
  end if;

  replacement_reason := coalesce(
    nullif(trim(coalesce(p_reason, '')), ''),
    'კლიენტმა სხვა ხელოსანი აირჩია'
  );

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
    old_booking.client_id,
    p_new_worker_id,
    old_booking.profession_id,
    old_booking.scheduled_at,
    'pending',
    old_booking.city,
    old_booking.address_text,
    old_booking.client_comment,
    old_booking.booking_fee_amount,
    case
      when old_booking.booking_fee_amount > 0 then 'authorized'::public.payment_status
      else 'not_required'::public.payment_status
    end
  )
  returning id into new_booking_id;

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
  select
    new_booking_id,
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
  from public.booking_details
  where booking_id = old_booking.id;

  select *
  into target_payment
  from public.payments
  where booking_id = old_booking.id
  order by created_at desc
  limit 1
  for update;

  if target_payment.id is not null and target_payment.status = 'captured' then
    raise exception 'დადასტურებული თანხის მქონე ჯავშანზე ხელოსნის ავტომატური შეცვლა შეუძლებელია';
  end if;

  if target_payment.id is not null and target_payment.status = 'authorized' then
    update public.payments
    set
      booking_id = new_booking_id,
      worker_id = p_new_worker_id
    where id = target_payment.id;
  elsif old_booking.booking_fee_amount > 0 then
    select value_json
    into platform_settings
    from public.platform_settings
    where key = 'platform';

    payment_provider := coalesce(
      nullif(platform_settings ->> 'paymentProvider', ''),
      'manual_mvp_hold'
    );
    payment_currency := coalesce(
      nullif(platform_settings ->> 'paymentCurrency', ''),
      'GEL'
    );

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
      new_booking_id,
      current_user_id,
      p_new_worker_id,
      old_booking.booking_fee_amount,
      payment_currency,
      payment_provider,
      'mvp-reassign-' || new_booking_id::text,
      'authorized'
    );
  end if;

  update public.bookings
  set
    status = case
      when old_booking.status = 'pending' then 'cancelled'::public.booking_status
      else old_booking.status
    end,
    cancellation_reason = replacement_reason,
    payment_status = case
      when old_booking.booking_fee_amount > 0 then 'refunded'::public.payment_status
      else 'not_required'::public.payment_status
    end
  where id = old_booking.id;

  perform public.notify_user(
    new_worker_user_id,
    new_booking_id,
    'new_booking',
    'ახალი ჯავშანი',
    'კლიენტმა აგირჩიათ სხვა ხელოსნის ნაცვლად. გახსენით დეტალები და დაადასტურეთ ან უარყავით.'
  );

  perform public.notify_user(
    current_user_id,
    new_booking_id,
    'booking_status',
    'ხელოსანი შეიცვალა',
    'ახალი მოთხოვნა არჩეულ ხელოსანს გაეგზავნა და პასუხს ელოდება.'
  );

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata_json
  )
  values (
    current_user_id,
    'booking_worker_changed',
    'booking',
    new_booking_id,
    jsonb_build_object(
      'old_booking_id', old_booking.id,
      'old_worker_id', old_booking.worker_id,
      'new_worker_id', p_new_worker_id,
      'reason', replacement_reason
    )
  );

  return jsonb_build_object(
    'old_booking_id', old_booking.id,
    'new_booking_id', new_booking_id,
    'status', 'pending'
  );
end;
$$;

grant execute on function public.change_my_booking_worker(uuid, uuid, text)
to authenticated;
