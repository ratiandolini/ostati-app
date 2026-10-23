-- TEST PROJECT ONLY: ivguranttkxhxsdsppqk. Stage 8/9; source files 41-46 of 47.
-- Verify the Supabase Dashboard project URL/reference before running this entire file.
-- The database cannot independently authenticate its Supabase project reference.
-- Stage 8 requires the completed Stage 7 marker; never skip or replay stages.
begin;
do $e2e_guard$
begin
  if not exists (
    select 1 from public.e2e_sql_editor_install
    where singleton = true
      and project_ref = 'ivguranttkxhxsdsppqk'
      and completed_stage = 7
  ) then
    raise exception 'E2E SQL Editor install: expected completed stage 7; stop and inspect state';
  end if;
end;
$e2e_guard$;

-- BEGIN SOURCE 41: supabase/booking_list.sql
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
-- END SOURCE 41: supabase/booking_list.sql

-- BEGIN SOURCE 42: supabase/dispute_privacy_and_attribution_hotfix.sql
-- Apply the updated booking_list.sql first so party booking RPCs return only
-- the neutral active_dispute.status value. This hotfix removes the direct
-- table-read path and keeps complete dispute data in Admin-only RPCs.

revoke select on table public.disputes from public, anon, authenticated;

drop policy if exists "booking parties can read disputes" on public.disputes;
drop policy if exists "admins can read disputes" on public.disputes;

create policy "admins can read disputes"
on public.disputes for select
using (public.current_app_user_is_admin());

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

  if nullif(trim(p_reason), '') is null then
    raise exception 'Dispute reason is required';
  end if;

  select role into current_actor_role
  from public.users
  where id = current_user_id;

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

revoke all on function public.open_booking_dispute(uuid, text, text, jsonb)
from public, anon;
grant execute on function public.open_booking_dispute(uuid, text, text, jsonb)
to authenticated;

create or replace function public.list_admin_disputes()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not (
    public.current_admin_has_permission('disputes')
    or public.current_admin_has_permission('finance')
  ) then
    raise exception 'Only admins can list all disputes';
  end if;

  select coalesce(jsonb_agg(item order by (item ->> 'created_at') desc), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'id', d.id,
      'booking_id', d.booking_id,
      'opened_by', d.opened_by,
      'opened_by_role', opened_user.role,
      'reason', d.reason,
      'details', d.details,
      'evidence', coalesce(d.evidence, '[]'::jsonb),
      'status', d.status,
      'resolution', (
        select nullif(a.metadata_json ->> 'resolution', '')
        from public.audit_logs a
        where a.entity_type = 'dispute'
          and a.entity_id = d.id
          and a.action in ('dispute_refunded', 'dispute_released', 'dispute_warning')
        order by a.created_at desc
        limit 1
      ),
      'admin_note', d.admin_note,
      'resolved_at', d.resolved_at,
      'created_at', d.created_at,
      'booking', jsonb_build_object(
        'id', b.id,
        'scheduled_at', b.scheduled_at,
        'status', b.status,
        'city', b.city,
        'address_text', b.address_text,
        'payment_status', b.payment_status,
        'booking_fee_amount', b.booking_fee_amount,
        'profession_name', coalesce(p.name, 'ხელოსანი')
      ),
      'client', jsonb_build_object(
        'id', cu.id,
        'name', nullif(trim(coalesce(cu.first_name, '') || ' ' || coalesce(cu.last_name, '')), ''),
        'phone', cu.phone
      ),
      'worker', jsonb_build_object(
        'id', w.id,
        'name', coalesce(
          nullif(w.display_name, ''),
          nullif(trim(coalesce(wu.first_name, '') || ' ' || coalesce(wu.last_name, '')), ''),
          'ხელოსანი'
        ),
        'phone', wu.phone
      )
    ) as item
    from public.disputes d
    join public.bookings b on b.id = d.booking_id
    join public.users opened_user on opened_user.id = d.opened_by
    join public.users cu on cu.id = b.client_id
    join public.workers w on w.id = b.worker_id
    join public.users wu on wu.id = w.user_id
    left join public.professions p on p.id = b.profession_id
  ) rows;

  return result;
end;
$$;

revoke all on function public.list_admin_disputes() from public, anon;
grant execute on function public.list_admin_disputes() to authenticated;
-- END SOURCE 42: supabase/dispute_privacy_and_attribution_hotfix.sql

-- BEGIN SOURCE 43: supabase/admin_worker_contact_phone_hotfix.sql
-- Admin-only access to the existing profile contact number for verification review.
-- This does not expose phone data through public worker/search surfaces.
create or replace function public.get_admin_worker_contact_phone(
  p_worker_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to read contact phones';
  end if;

  if not public.current_admin_has_permission('verification') then
    raise exception 'Only admins with verification permission can read contact phones';
  end if;

  return (
    select nullif(trim(u.contact_phone), '')
    from public.workers w
    join public.users u on u.id = w.user_id
    where w.id = p_worker_id
      and w.verification_status in ('pending', 'verified', 'rejected')
  );
end;
$$;

revoke all on function public.get_admin_worker_contact_phone(uuid) from public;
grant execute on function public.get_admin_worker_contact_phone(uuid) to authenticated;
-- END SOURCE 43: supabase/admin_worker_contact_phone_hotfix.sql

-- BEGIN SOURCE 44: supabase/worker_support_messages_hotfix.sql
-- Private Admin <-> Craftsman support conversations. This deliberately does
-- not reuse public.messages, which is reserved for booking participants.

create table if not exists public.worker_support_conversations (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null unique references public.workers(id) on delete restrict,
  created_by_admin_id uuid references public.users(id) on delete set null,
  admin_last_read_at timestamptz,
  worker_last_read_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.worker_support_conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete restrict,
  text text not null check (
    char_length(trim(text)) between 1 and 4000
  ),
  created_at timestamptz not null default now()
);

create index if not exists worker_support_messages_conversation_created_idx
  on public.worker_support_messages(conversation_id, created_at);

create index if not exists worker_support_conversations_last_message_idx
  on public.worker_support_conversations(last_message_at desc);

alter table public.worker_support_conversations enable row level security;
alter table public.worker_support_messages enable row level security;

-- Only the narrowly-scoped SECURITY DEFINER RPCs below may touch support data.
revoke all on table public.worker_support_conversations from public, anon, authenticated;
revoke all on table public.worker_support_messages from public, anon, authenticated;

create or replace function public.get_admin_worker_support_conversation(
  p_worker_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  target_worker public.workers%rowtype;
  target_user public.users%rowtype;
  conversation public.worker_support_conversations%rowtype;
begin
  if actor is null then
    raise exception 'Authentication is required to read support conversations';
  end if;

  if not public.current_admin_has_permission('users') then
    raise exception 'Users permission is required to read support conversations';
  end if;

  select w.*
  into target_worker
  from public.workers w
  join public.users u on u.id = w.user_id
  where w.id = p_worker_id
    and u.role = 'craftsman'
  limit 1;

  if target_worker.id is null then
    raise exception 'Craftsman not found';
  end if;

  select *
  into target_user
  from public.users
  where id = target_worker.user_id
    and role = 'craftsman';

  select *
  into conversation
  from public.worker_support_conversations
  where worker_id = target_worker.id;

  if conversation.id is null then
    return jsonb_build_object(
      'conversation_id', null,
      'worker_id', target_worker.id,
      'title', 'Shenage მხარდაჭერა',
      'subtitle', trim(concat_ws(' ', target_user.first_name, target_user.last_name)),
      'unread_count', 0
    );
  end if;

  return jsonb_build_object(
    'conversation_id', conversation.id,
    'worker_id', target_worker.id,
    'title', 'Shenage მხარდაჭერა',
    'subtitle', trim(concat_ws(' ', target_user.first_name, target_user.last_name)),
    'last_message_at', conversation.last_message_at,
    'unread_count', (
      select count(*)
      from public.worker_support_messages m
      where m.conversation_id = conversation.id
        and m.sender_id = target_user.id
        and m.created_at > coalesce(conversation.admin_last_read_at, '-infinity'::timestamptz)
    )
  );
end;
$$;

create or replace function public.list_admin_worker_support_messages(
  p_worker_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  target_user_id uuid;
  conversation_id uuid;
  result jsonb;
begin
  if actor is null then
    raise exception 'Authentication is required to read support messages';
  end if;

  if not public.current_admin_has_permission('users') then
    raise exception 'Users permission is required to read support messages';
  end if;

  select u.id
  into target_user_id
  from public.workers w
  join public.users u on u.id = w.user_id
  where w.id = p_worker_id
    and u.role = 'craftsman'
  limit 1;

  if target_user_id is null then
    raise exception 'Craftsman not found';
  end if;

  select id into conversation_id
  from public.worker_support_conversations
  where worker_id = p_worker_id;

  if conversation_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'conversation_id', m.conversation_id,
    'sender', case when m.sender_id = target_user_id then 'craftsman' else 'admin' end,
    'text', m.text,
    'created_at', m.created_at
  ) order by m.created_at), '[]'::jsonb)
  into result
  from public.worker_support_messages m
  where m.conversation_id = conversation_id;

  return result;
end;
$$;

create or replace function public.send_admin_worker_support_message(
  p_worker_id uuid,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  target_user_id uuid;
  message_text text := nullif(trim(coalesce(p_text, '')), '');
  conversation_id uuid;
  message_id uuid;
begin
  if actor is null then
    raise exception 'Authentication is required to send support messages';
  end if;

  if not public.current_admin_has_permission('users') then
    raise exception 'Users permission is required to send support messages';
  end if;

  if message_text is null then
    raise exception 'Message text is required';
  end if;

  select u.id
  into target_user_id
  from public.workers w
  join public.users u on u.id = w.user_id
  where w.id = p_worker_id
    and u.role = 'craftsman'
  limit 1;

  if target_user_id is null then
    raise exception 'Craftsman not found';
  end if;

  insert into public.worker_support_conversations (
    worker_id,
    created_by_admin_id,
    last_message_at,
    updated_at
  )
  values (p_worker_id, actor, now(), now())
  on conflict (worker_id) do update
  set updated_at = excluded.updated_at
  returning id into conversation_id;

  insert into public.worker_support_messages (conversation_id, sender_id, text)
  values (conversation_id, actor, message_text)
  returning id into message_id;

  update public.worker_support_conversations
  set last_message_at = now(),
      updated_at = now()
  where id = conversation_id;

  perform public.notify_user(
    target_user_id,
    null,
    'support_message',
    'Shenage მხარდაჭერა',
    'ახალი შეტყობინება გაქვთ მხარდაჭერისგან.'
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata_json)
  values (
    actor,
    'admin_support_message_sent',
    'worker_support_conversation',
    conversation_id,
    jsonb_build_object('worker_id', p_worker_id)
  );

  return jsonb_build_object(
    'conversation_id', conversation_id,
    'message_id', message_id
  );
end;
$$;

create or replace function public.mark_admin_worker_support_read(
  p_worker_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  conversation_id uuid;
begin
  if actor is null then
    raise exception 'Authentication is required to mark support messages read';
  end if;

  if not public.current_admin_has_permission('users') then
    raise exception 'Users permission is required to mark support messages read';
  end if;

  select id into conversation_id
  from public.worker_support_conversations
  where worker_id = p_worker_id;

  if conversation_id is null then
    return jsonb_build_object('conversation_id', null, 'updated', false);
  end if;

  update public.worker_support_conversations
  set admin_last_read_at = now(), updated_at = now()
  where id = conversation_id;

  return jsonb_build_object('conversation_id', conversation_id, 'updated', true);
end;
$$;

create or replace function public.list_my_worker_support_threads()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  v_worker_id uuid := public.current_app_worker_id();
  result jsonb;
begin
  if actor is null or v_worker_id is null then
    raise exception 'Craftsman authentication is required to read support messages';
  end if;

  if not exists (
    select 1 from public.users where id = actor and role = 'craftsman'
  ) then
    raise exception 'Only craftsmen can read support messages';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'conversation_id', c.id,
    'title', 'Shenage მხარდაჭერა',
    'subtitle', 'კავშირი ადმინისტრაციასთან',
    'status', 'support',
    'last_text', coalesce(last_message.text, 'ჯერ მიმოწერა არ არის'),
    'last_at', c.last_message_at,
    'unread_count', (
      select count(*) from public.worker_support_messages unread_messages
      where unread_messages.conversation_id = c.id
        and unread_messages.sender_id <> actor
        and unread_messages.created_at > coalesce(c.worker_last_read_at, '-infinity'::timestamptz)
    ),
    'archived', false
  ) order by c.last_message_at desc), '[]'::jsonb)
  into result
  from public.worker_support_conversations c
  left join lateral (
    select m.text
    from public.worker_support_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) last_message on true
  where c.worker_id = v_worker_id;

  return result;
end;
$$;

create or replace function public.list_my_worker_support_messages(
  p_conversation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  v_worker_id uuid := public.current_app_worker_id();
  result jsonb;
begin
  if actor is null or v_worker_id is null then
    raise exception 'Craftsman authentication is required to read support messages';
  end if;

  if not exists (
    select 1 from public.users where id = actor and role = 'craftsman'
  ) then
    raise exception 'Only craftsmen can read support messages';
  end if;

  if not exists (
    select 1 from public.worker_support_conversations
    where id = p_conversation_id and worker_id = v_worker_id
  ) then
    raise exception 'Support conversation not found';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'conversation_id', m.conversation_id,
    'sender', case when m.sender_id = actor then 'craftsman' else 'admin' end,
    'text', m.text,
    'created_at', m.created_at
  ) order by m.created_at), '[]'::jsonb)
  into result
  from public.worker_support_messages m
  where m.conversation_id = p_conversation_id;

  return result;
end;
$$;

create or replace function public.send_my_worker_support_message(
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  v_worker_id uuid := public.current_app_worker_id();
  message_text text := nullif(trim(coalesce(p_text, '')), '');
  conversation_id uuid;
  message_id uuid;
begin
  if actor is null or v_worker_id is null then
    raise exception 'Craftsman authentication is required to send support messages';
  end if;

  if not exists (
    select 1 from public.users where id = actor and role = 'craftsman'
  ) then
    raise exception 'Only craftsmen can send support messages';
  end if;

  if message_text is null then
    raise exception 'Message text is required';
  end if;

  select id into conversation_id
  from public.worker_support_conversations
  where worker_id = v_worker_id;

  if conversation_id is null then
    raise exception 'Support conversation has not been opened';
  end if;

  insert into public.worker_support_messages (conversation_id, sender_id, text)
  values (conversation_id, actor, message_text)
  returning id into message_id;

  update public.worker_support_conversations
  set last_message_at = now(), updated_at = now()
  where id = conversation_id;

  return jsonb_build_object(
    'conversation_id', conversation_id,
    'message_id', message_id
  );
end;
$$;

create or replace function public.mark_my_worker_support_read(
  p_conversation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  v_worker_id uuid := public.current_app_worker_id();
begin
  if actor is null or v_worker_id is null then
    raise exception 'Craftsman authentication is required to mark support messages read';
  end if;

  if not exists (
    select 1 from public.users where id = actor and role = 'craftsman'
  ) then
    raise exception 'Only craftsmen can mark support messages read';
  end if;

  update public.worker_support_conversations
  set worker_last_read_at = now(), updated_at = now()
  where id = p_conversation_id
    and worker_id = v_worker_id;

  if not found then
    raise exception 'Support conversation not found';
  end if;

  return jsonb_build_object('conversation_id', p_conversation_id, 'updated', true);
end;
$$;

revoke all on function public.get_admin_worker_support_conversation(uuid) from public, anon;
revoke all on function public.list_admin_worker_support_messages(uuid) from public, anon;
revoke all on function public.send_admin_worker_support_message(uuid, text) from public, anon;
revoke all on function public.mark_admin_worker_support_read(uuid) from public, anon;
revoke all on function public.list_my_worker_support_threads() from public, anon;
revoke all on function public.list_my_worker_support_messages(uuid) from public, anon;
revoke all on function public.send_my_worker_support_message(text) from public, anon;
revoke all on function public.mark_my_worker_support_read(uuid) from public, anon;

grant execute on function public.get_admin_worker_support_conversation(uuid) to authenticated;
grant execute on function public.list_admin_worker_support_messages(uuid) to authenticated;
grant execute on function public.send_admin_worker_support_message(uuid, text) to authenticated;
grant execute on function public.mark_admin_worker_support_read(uuid) to authenticated;
grant execute on function public.list_my_worker_support_threads() to authenticated;
grant execute on function public.list_my_worker_support_messages(uuid) to authenticated;
grant execute on function public.send_my_worker_support_message(text) to authenticated;
grant execute on function public.mark_my_worker_support_read(uuid) to authenticated;
-- END SOURCE 44: supabase/worker_support_messages_hotfix.sql

-- BEGIN SOURCE 45: supabase/rename_brand_to_shenage_hotfix.sql
-- Update only the public legal privacy copy stored in production settings.
-- The application reads this value through get_public_app_settings().

update public.platform_settings
set
  value_json = jsonb_set(
    coalesce(value_json, '{}'::jsonb),
    '{privacyRules}',
    to_jsonb(
      'შენაგე ამუშავებს მხოლოდ სერვისის გასაწევად აუცილებელ პირად მონაცემებს. ჯავშნისა და მხარდაჭერის პროცესში საჭირო ინფორმაცია ხელმისაწვდომია მხოლოდ შესაბამისი პროცესის მონაწილეებისთვის და პლატფორმის ფუნქციონირების ფარგლებში. ძირითადი კომუნიკაცია ჩატში რჩება.'::text
    ),
    true
  ),
  updated_at = now()
where key = 'legal';

notify pgrst, 'reload schema';
-- END SOURCE 45: supabase/rename_brand_to_shenage_hotfix.sql

-- BEGIN SOURCE 46: supabase/rpc_execute_permissions_hotfix.sql
-- FIXART production RPC execute-permission hotfix.
--
-- PostgreSQL grants EXECUTE to PUBLIC by default. An explicit grant to
-- authenticated does not remove that inherited access from anon. Start by
-- removing the default public grant from every application function, then
-- restore access deliberately by role.

-- 1. No application RPC is callable through the public default role.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- 2. Authenticated browser flows use Supabase's authenticated role. Their
-- own function-level ownership and admin checks remain the authorization
-- boundary for their existing product actions.
grant execute on all functions in schema public to authenticated;

-- 3. These are the only intentionally anonymous, read-only marketplace RPCs.
grant execute on function public.get_public_worker_cards() to anon;
grant execute on function public.get_worker_public_reviews(uuid) to anon;
grant execute on function public.get_public_app_settings() to anon;

-- 4. Internal trigger, notification, subscription, payment and workflow
-- helpers must not be callable directly by an authenticated browser session.
-- They are still callable by their owning SECURITY DEFINER functions/triggers
-- and by service_role for operational work.
do $$
declare
  function_signature text;
begin
  for function_signature in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'notify_user',
        'notify_booking_status_change',
        'notify_dispute_change',
        'audit_booking_cancellation',
        'booking_status_body',
        'booking_status_title',
        'is_allowed_booking_status_transition',
        'validate_booking_status_transition',
        'booking_worker_user_id',
        'sync_booking_status_from_dispute',
        'platform_fee_rate',
        'calculate_platform_fee',
        'prepare_payment_amounts',
        'sync_booking_payment_status',
        'mark_payment_timestamps',
        'default_trial_days',
        'default_monthly_subscription_amount',
        'ensure_worker_trial_started',
        'create_worker_trial_subscription',
        'sync_worker_subscription_status',
        'refresh_expired_worker_trials',
        'create_trial_expiry_notifications',
        'run_subscription_maintenance',
        'sync_subscription_from_platform_settings',
        'worker_can_receive_bookings',
        'user_can_review_booking',
        'validate_review_participants',
        'recalculate_user_rating',
        'refresh_reviewee_rating',
        'set_updated_at',
        'handle_new_auth_user',
        'current_admin_has_permission'
      ])
  loop
    execute format('revoke execute on function %s from authenticated', function_signature);
  end loop;
end
$$;

-- notify_user is an internal helper with no caller ownership check. Keep this
-- explicit assertion close to the audit finding so it cannot be re-exposed by
-- a later broad authenticated grant.
revoke execute on function public.notify_user(uuid, uuid, text, text, text)
  from anon, authenticated, public;

-- Classification:
--   intentionally public: get_public_worker_cards, get_worker_public_reviews,
--     get_public_app_settings (anon + authenticated)
--   authenticated-only: client/craftsman/admin product RPCs (authenticated)
--   internal/service-only: the helpers revoked above (service_role/owners only)
-- END SOURCE 46: supabase/rpc_execute_permissions_hotfix.sql

update public.e2e_sql_editor_install
set completed_stage = 8, updated_at = now()
where singleton = true
  and project_ref = 'ivguranttkxhxsdsppqk'
  and completed_stage = 7;
commit;
