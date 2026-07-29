create or replace function public.capture_booking_payment(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  target_booking public.bookings%rowtype;
  updated_payment_id uuid;
  existing_payment public.payments%rowtype;
  worker_user_id uuid;
  payment_note text;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to capture a payment';
  end if;

  select *
  into target_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if target_booking.id is null then
    raise exception 'Booking not found';
  end if;

  if not (
    target_booking.client_id = current_user_id
    or public.current_app_user_is_admin()
  ) then
    raise exception 'Only the client or admin can capture this payment';
  end if;

  if target_booking.status not in ('client_confirmed', 'closed') then
    raise exception 'Payment can only be captured after client confirmation';
  end if;

  select *
  into existing_payment
  from public.payments
  where booking_id = p_booking_id
  order by created_at desc
  limit 1;

  if existing_payment.id is null then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'payment_id', null,
      'status', 'not_required'
    );
  end if;

  if existing_payment.status = 'captured' then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'payment_id', existing_payment.id,
      'status', 'captured'
    );
  end if;

  if existing_payment.status = 'refunded' then
    raise exception 'Refunded payment cannot be captured';
  end if;

  update public.payments
  set status = 'captured'
  where id = existing_payment.id
    and status = 'authorized'
  returning id into updated_payment_id;

  if updated_payment_id is null then
    raise exception 'Authorized payment not found';
  end if;

  select workers.user_id
  into worker_user_id
  from public.workers
  where workers.id = target_booking.worker_id;

  payment_note := 'დაჯავშნის საფასური დადასტურდა და დაიხურა.';

  perform public.notify_user(
    target_booking.client_id,
    p_booking_id,
    'booking_status',
    'თანხა დადასტურდა',
    payment_note
  );

  perform public.notify_user(
    worker_user_id,
    p_booking_id,
    'booking_status',
    'თანხა დადასტურდა',
    payment_note
  );

  insert into public.messages (booking_id, sender_id, text)
  values (p_booking_id, current_user_id, payment_note);

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata_json
  )
  values (
    current_user_id,
    'payment_captured',
    'booking',
    p_booking_id,
    jsonb_build_object('paymentId', updated_payment_id)
  );

  return jsonb_build_object(
    'booking_id',
    p_booking_id,
    'payment_id',
    updated_payment_id,
    'status',
    'captured'
  );
end;
$$;

grant execute on function public.capture_booking_payment(uuid)
to authenticated;

create or replace function public.refund_booking_payment(
  p_booking_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  target_booking public.bookings%rowtype;
  updated_payment_id uuid;
  existing_payment public.payments%rowtype;
  worker_user_id uuid;
  refund_note text;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to refund a payment';
  end if;

  select *
  into target_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if target_booking.id is null then
    raise exception 'Booking not found';
  end if;

  if not (
    target_booking.client_id = current_user_id
    or target_booking.worker_id = public.current_app_worker_id()
    or public.current_app_user_is_admin()
  ) then
    raise exception 'You do not have access to this payment';
  end if;

  if target_booking.status not in ('declined', 'cancelled', 'disputed') then
    raise exception 'Payment can only be refunded for declined, cancelled, or disputed bookings';
  end if;

  select *
  into existing_payment
  from public.payments
  where booking_id = p_booking_id
  order by created_at desc
  limit 1;

  if existing_payment.id is null then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'payment_id', null,
      'status', 'not_required'
    );
  end if;

  if existing_payment.status = 'refunded' then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'payment_id', existing_payment.id,
      'status', 'refunded'
    );
  end if;

  update public.payments
  set status = 'refunded'
  where id = existing_payment.id
    and status in ('authorized', 'captured')
  returning id into updated_payment_id;

  if updated_payment_id is null then
    raise exception 'Refundable payment not found';
  end if;

  select workers.user_id
  into worker_user_id
  from public.workers
  where workers.id = target_booking.worker_id;

  refund_note := 'დაჯავშნის საფასური დაბრუნებულია.' ||
    case
      when nullif(trim(coalesce(p_reason, '')), '') is not null then ' მიზეზი: ' || trim(p_reason)
      else ''
    end;

  perform public.notify_user(
    target_booking.client_id,
    p_booking_id,
    'booking_status',
    'თანხა დაბრუნდა',
    refund_note
  );

  perform public.notify_user(
    worker_user_id,
    p_booking_id,
    'booking_status',
    'თანხა დაბრუნდა',
    refund_note
  );

  insert into public.messages (booking_id, sender_id, text)
  values (p_booking_id, current_user_id, refund_note);

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata_json
  )
  values (
    current_user_id,
    'payment_refunded',
    'booking',
    p_booking_id,
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object(
    'booking_id',
    p_booking_id,
    'payment_id',
    updated_payment_id,
    'status',
    'refunded'
  );
end;
$$;

grant execute on function public.refund_booking_payment(uuid, text)
to authenticated;

create or replace function public.get_booking_payment_summary(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  target_payment public.payments%rowtype;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read payment summary';
  end if;

  if not public.user_can_access_booking(p_booking_id) then
    raise exception 'You do not have access to this payment';
  end if;

  select *
  into target_payment
  from public.payments
  where booking_id = p_booking_id
  order by created_at desc
  limit 1;

  if target_payment.id is null then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'payment_id', null,
      'amount', 0,
      'platform_fee_amount', 0,
      'worker_amount', 0,
      'currency', 'GEL',
      'provider', null,
      'provider_payment_id', null,
      'status', 'not_required',
      'captured_at', null,
      'refunded_at', null
    );
  end if;

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'payment_id', target_payment.id,
    'amount', target_payment.amount,
    'platform_fee_amount', target_payment.platform_fee_amount,
    'worker_amount', target_payment.worker_amount,
    'currency', target_payment.currency,
    'provider', target_payment.provider,
    'provider_payment_id', target_payment.provider_payment_id,
    'status', target_payment.status,
    'captured_at', target_payment.captured_at,
    'refunded_at', target_payment.refunded_at
  );
end;
$$;

grant execute on function public.get_booking_payment_summary(uuid)
to authenticated;
