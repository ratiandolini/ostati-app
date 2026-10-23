-- TEST PROJECT ONLY: ivguranttkxhxsdsppqk. Stage 3/9; source files 21-25 of 47.
-- Verify the Supabase Dashboard project URL/reference before running this entire file.
-- The database cannot independently authenticate its Supabase project reference.
-- Stage 3 requires the completed Stage 2 marker; never skip or replay stages.
begin;
do $e2e_guard$
begin
  if not exists (
    select 1 from public.e2e_sql_editor_install
    where singleton = true
      and project_ref = 'ivguranttkxhxsdsppqk'
      and completed_stage = 2
  ) then
    raise exception 'E2E SQL Editor install: expected completed stage 2; stop and inspect state';
  end if;
end;
$e2e_guard$;

-- BEGIN SOURCE 21: supabase/payment_actions.sql
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
-- END SOURCE 21: supabase/payment_actions.sql

-- BEGIN SOURCE 22: supabase/dispute_actions.sql
alter table public.disputes
add column if not exists evidence jsonb not null default '[]'::jsonb;

drop function if exists public.open_booking_dispute(uuid, text, text);

create or replace function public.open_booking_dispute(
  p_booking_id uuid,
  p_reason text,
  p_details text default null,
  p_evidence jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_actor_role public.user_role;
  created_dispute_id uuid;
  target_client_id uuid;
  target_worker_user_id uuid;
  admin_user_id uuid;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to open a dispute';
  end if;

  if not public.user_can_access_booking(p_booking_id) then
    raise exception 'You do not have access to this booking';
  end if;

  select role into current_actor_role
  from public.users
  where id = current_user_id;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Dispute reason is required';
  end if;

  select b.client_id, w.user_id
  into target_client_id, target_worker_user_id
  from public.bookings b
  join public.workers w on w.id = b.worker_id
  where b.id = p_booking_id;

  insert into public.disputes (
    booking_id,
    opened_by,
    reason,
    details,
    evidence
  )
  values (
    p_booking_id,
    current_user_id,
    trim(p_reason),
    nullif(trim(coalesce(p_details, '')), ''),
    coalesce(p_evidence, '[]'::jsonb)
  )
  returning id into created_dispute_id;

  if target_worker_user_id is not null and target_worker_user_id <> current_user_id then
    perform public.notify_user(
      target_worker_user_id,
      p_booking_id,
      'dispute',
      'ჯავშანზე დავა გაიხსნა',
      'Admin გადაამოწმებს საკითხს და გადაწყვეტილებას შეტყობინებით გამოგიგზავნით.'
    );
  end if;

  if target_client_id is not null then
    perform public.notify_user(
      target_client_id,
      p_booking_id,
      'dispute',
      'პრობლემა გაგზავნილია',
      'დავა გაიხსნა. Admin გადაამოწმებს საკითხს და თანხა დროებით შეჩერებულია.'
    );
  end if;

  for admin_user_id in
    select id
    from public.users
    where role = 'admin'::public.user_role
      and status = 'active'::public.user_status
  loop
    perform public.notify_user(
      admin_user_id,
      p_booking_id,
      'admin_dispute',
      'ახალი დავა გაიხსნა',
      case current_actor_role
        when 'client'::public.user_role then 'კლიენტმა დავა გახსნა. მიზეზი და კომენტარი იხილეთ Admin პანელში.'
        when 'craftsman'::public.user_role then 'ხელოსანმა დავა გახსნა. მიზეზი და კომენტარი იხილეთ Admin პანელში.'
        else 'დავა გაიხსნა. მიზეზი და კომენტარი იხილეთ Admin პანელში.'
      end
    );
  end loop;

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'dispute_id', created_dispute_id,
    'status', 'open'
  );
end;
$$;

grant execute on function public.open_booking_dispute(uuid, text, text, jsonb)
to authenticated;
-- END SOURCE 22: supabase/dispute_actions.sql

-- BEGIN SOURCE 23: supabase/dispute_integrity.sql
-- Prevent more than one unresolved dispute for the same booking.
-- Older duplicate rows are left intact for audit history; the newest one stays active.

with ranked_open_disputes as (
  select
    id,
    row_number() over (partition by booking_id order by created_at desc, id desc) as row_number
  from public.disputes
  where status <> 'resolved'
)
update public.disputes disputes
set
  status = 'resolved',
  resolved_at = coalesce(disputes.resolved_at, now()),
  admin_note = coalesce(
    nullif(disputes.admin_note, ''),
    'დუბლირებული ღია დავა ავტომატურად დაიხურა. აქტიური დარჩა ყველაზე ახალი დავა.'
  )
from ranked_open_disputes ranked
where disputes.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists disputes_one_open_case_per_booking
on public.disputes (booking_id)
where status <> 'resolved';

create or replace function public.open_booking_dispute(
  p_booking_id uuid,
  p_reason text,
  p_details text default null,
  p_evidence jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_actor_role public.user_role;
  target_client_id uuid;
  target_worker_user_id uuid;
  created_dispute_id uuid;
  admin_user_id uuid;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to open a dispute';
  end if;

  if not public.user_can_access_booking(p_booking_id) then
    raise exception 'You do not have access to this booking';
  end if;

  select role into current_actor_role
  from public.users
  where id = current_user_id;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Dispute reason is required';
  end if;

  select b.client_id, w.user_id
  into target_client_id, target_worker_user_id
  from public.bookings b
  join public.workers w on w.id = b.worker_id
  where b.id = p_booking_id;

  select id
  into created_dispute_id
  from public.disputes
  where booking_id = p_booking_id
    and status <> 'resolved'
  order by created_at desc
  limit 1;

  if created_dispute_id is not null then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'dispute_id', created_dispute_id,
      'status', 'open'
    );
  end if;

  insert into public.disputes (booking_id, opened_by, reason, details, evidence)
  values (
    p_booking_id,
    current_user_id,
    trim(p_reason),
    nullif(trim(coalesce(p_details, '')), ''),
    coalesce(p_evidence, '[]'::jsonb)
  )
  returning id into created_dispute_id;

  if target_worker_user_id is not null and target_worker_user_id <> current_user_id then
    perform public.notify_user(
      target_worker_user_id,
      p_booking_id,
      'dispute',
      'ჯავშანზე დავა გაიხსნა',
      'Admin გადაამოწმებს საკითხს და გადაწყვეტილებას შეტყობინებით გამოგიგზავნით.'
    );
  end if;

  if target_client_id is not null then
    perform public.notify_user(
      target_client_id,
      p_booking_id,
      'dispute',
      'პრობლემა გაგზავნილია',
      'დავა გაიხსნა. Admin გადაამოწმებს საკითხს და თანხა დროებით შეჩერებულია.'
    );
  end if;

  for admin_user_id in
    select id
    from public.users
    where role = 'admin'::public.user_role
      and status = 'active'::public.user_status
  loop
    perform public.notify_user(
      admin_user_id,
      p_booking_id,
      'admin_dispute',
      'ახალი დავა გაიხსნა',
      case current_actor_role
        when 'client'::public.user_role then 'კლიენტმა დავა გახსნა. მიზეზი და კომენტარი იხილეთ Admin პანელში.'
        when 'craftsman'::public.user_role then 'ხელოსანმა დავა გახსნა. მიზეზი და კომენტარი იხილეთ Admin პანელში.'
        else 'დავა გაიხსნა. მიზეზი და კომენტარი იხილეთ Admin პანელში.'
      end
    );
  end loop;

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'dispute_id', created_dispute_id,
    'status', 'open'
  );
end;
$$;

grant execute on function public.open_booking_dispute(uuid, text, text, jsonb)
to authenticated;
-- END SOURCE 23: supabase/dispute_integrity.sql

-- BEGIN SOURCE 24: supabase/booking_worker_change.sql
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
-- END SOURCE 24: supabase/booking_worker_change.sql

-- BEGIN SOURCE 25: supabase/booking_list.sql
create or replace function public.list_my_client_bookings()
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
    raise exception 'Authentication is required to list bookings';
  end if;

  select coalesce(jsonb_agg(item order by (item ->> 'scheduled_at') desc), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'id', b.id,
      'scheduled_at', b.scheduled_at,
      'status', b.status,
      'city', b.city,
      'address_text', b.address_text,
      'client_comment', b.client_comment,
      'cancellation_reason', b.cancellation_reason,
      'cancellation_penalty_amount', b.cancellation_penalty_amount,
      'booking_fee_amount', b.booking_fee_amount,
      'payment_status', coalesce(pay.status, b.payment_status),
      'payment_provider', pay.provider,
      'payment_currency', coalesce(pay.currency, 'GEL'),
      'payment_transaction_id', pay.provider_payment_id,
      'active_dispute', (
        select jsonb_build_object(
          'status', d.status
        )
        from public.disputes d
        where d.booking_id = b.id
        order by case when d.status <> 'resolved' then 0 else 1 end, d.created_at desc
        limit 1
      ),
      'worker', jsonb_build_object(
        'id', w.id,
        'name', coalesce(
          nullif(w.display_name, ''),
          trim(coalesce(wu.first_name, '') || ' ' || coalesce(wu.last_name, '')),
          'ხელოსანი'
        ),
        'role', coalesce(p.name, 'ხელოსანი'),
        'avatar_url', wu.photo_url,
        'rating_avg', wu.rating_avg,
        'rating_count', wu.rating_count,
        'city', w.city,
        'about', w.about,
        'price_type', w.price_type,
        'price_min', w.price_min,
        'price_max', w.price_max,
        'skills', coalesce(
          (
            select jsonb_agg(distinct p2.name)
            from public.worker_professions wp
            join public.professions p2 on p2.id = wp.profession_id
            where wp.worker_id = w.id
          ),
          '[]'::jsonb
        )
      ),
      'details', jsonb_build_object(
        'area', bd.area,
        'height', bd.height,
        'length', bd.length,
        'rooms', bd.rooms,
        'wall_condition', bd.wall_condition,
        'target_surface', bd.target_surface,
        'material_owner', bd.material_owner,
        'plumbing_type', bd.plumbing_type,
        'floor', bd.floor,
        'electric_points', bd.electric_points,
        'electric_panel', bd.electric_panel,
        'is_emergency', bd.is_emergency,
        'work_scope', bd.work_scope,
        'surface_type', bd.surface_type,
        'material_note', bd.material_note,
        'item_count', bd.item_count,
        'current_condition', bd.current_condition,
        'photo_note', bd.photo_note,
        'roof_type', bd.roof_type,
        'extra_measurements', bd.extra_measurements,
        'uploaded_photo_url', bd.uploaded_photo_url
      )
    ) as item
    from public.bookings b
    join public.workers w on w.id = b.worker_id
    join public.users wu on wu.id = w.user_id
    left join public.professions p on p.id = b.profession_id
    left join public.booking_details bd on bd.booking_id = b.id
    left join lateral (
      select status, provider, currency, provider_payment_id
      from public.payments
      where booking_id = b.id
      order by created_at desc
      limit 1
    ) pay on true
    where b.client_id = current_user_id
  ) rows;

  return result;
end;
$$;

grant execute on function public.list_my_client_bookings()
to authenticated;

create or replace function public.list_my_worker_bookings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_worker_id uuid;
  result jsonb;
begin
  current_worker_id := public.current_app_worker_id();

  if current_worker_id is null then
    raise exception 'Only a worker can list worker bookings';
  end if;

  select coalesce(jsonb_agg(item order by (item ->> 'scheduled_at') desc), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'id', b.id,
      'scheduled_at', b.scheduled_at,
      'status', b.status,
      'city', b.city,
      'address_text', b.address_text,
      'client_comment', b.client_comment,
      'cancellation_reason', b.cancellation_reason,
      'cancellation_penalty_amount', b.cancellation_penalty_amount,
      'booking_fee_amount', b.booking_fee_amount,
      'payment_status', coalesce(pay.status, b.payment_status),
      'payment_provider', pay.provider,
      'payment_currency', coalesce(pay.currency, 'GEL'),
      'payment_transaction_id', pay.provider_payment_id,
      'profession_name', coalesce(p.name, 'ხელოსანი'),
      'active_dispute', (
        select jsonb_build_object(
          'status', d.status
        )
        from public.disputes d
        where d.booking_id = b.id
        order by case when d.status <> 'resolved' then 0 else 1 end, d.created_at desc
        limit 1
      ),
      'client', jsonb_build_object(
        'id', cu.id,
        'first_name', cu.first_name,
        'last_initial', case
          when cu.last_name is null or cu.last_name = '' then ''
          else left(cu.last_name, 1) || '.'
        end,
        'rating_avg', cu.rating_avg,
        'rating_count', cu.rating_count
      ),
      'details', jsonb_build_object(
        'area', bd.area,
        'height', bd.height,
        'length', bd.length,
        'rooms', bd.rooms,
        'wall_condition', bd.wall_condition,
        'target_surface', bd.target_surface,
        'material_owner', bd.material_owner,
        'plumbing_type', bd.plumbing_type,
        'floor', bd.floor,
        'electric_points', bd.electric_points,
        'electric_panel', bd.electric_panel,
        'is_emergency', bd.is_emergency,
        'work_scope', bd.work_scope,
        'surface_type', bd.surface_type,
        'material_note', bd.material_note,
        'item_count', bd.item_count,
        'current_condition', bd.current_condition,
        'photo_note', bd.photo_note,
        'roof_type', bd.roof_type,
        'extra_measurements', bd.extra_measurements,
        'uploaded_photo_url', bd.uploaded_photo_url
      )
    ) as item
    from public.bookings b
    join public.users cu on cu.id = b.client_id
    left join public.professions p on p.id = b.profession_id
    left join public.booking_details bd on bd.booking_id = b.id
    left join lateral (
      select status, provider, currency, provider_payment_id
      from public.payments
      where booking_id = b.id
      order by created_at desc
      limit 1
    ) pay on true
    where b.worker_id = current_worker_id
  ) rows;

  return result;
end;
$$;

grant execute on function public.list_my_worker_bookings()
to authenticated;
-- END SOURCE 25: supabase/booking_list.sql

update public.e2e_sql_editor_install
set completed_stage = 3, updated_at = now()
where singleton = true
  and project_ref = 'ivguranttkxhxsdsppqk'
  and completed_stage = 2;
commit;
