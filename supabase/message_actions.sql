alter table public.messages
add column if not exists attachment_url text;

alter table public.messages
add column if not exists attachment_type text;

alter table public.messages
add column if not exists attachment_name text;

drop function if exists public.send_booking_message(uuid, text);

create or replace function public.send_booking_message(
  p_booking_id uuid,
  p_text text,
  p_attachment_url text default null,
  p_attachment_type text default null,
  p_attachment_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  created_message_id uuid;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to send a message';
  end if;

  if not public.user_can_access_booking(p_booking_id) then
    raise exception 'You do not have access to this booking';
  end if;

  if nullif(trim(p_text), '') is null and nullif(trim(coalesce(p_attachment_url, '')), '') is null then
    raise exception 'Message text is required';
  end if;

  insert into public.messages (
    booking_id,
    sender_id,
    text,
    attachment_url,
    attachment_type,
    attachment_name
  )
  values (
    p_booking_id,
    current_user_id,
    coalesce(nullif(trim(p_text), ''), 'ფოტო'),
    nullif(trim(coalesce(p_attachment_url, '')), ''),
    nullif(trim(coalesce(p_attachment_type, '')), ''),
    nullif(trim(coalesce(p_attachment_name, '')), '')
  )
  returning id into created_message_id;

  return jsonb_build_object(
    'message_id',
    created_message_id,
    'booking_id',
    p_booking_id
  );
end;
$$;

grant execute on function public.send_booking_message(uuid, text, text, text, text)
to authenticated;

create or replace function public.admin_send_booking_message(
  p_booking_id uuid,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  target_booking public.bookings%rowtype;
  worker_user_id uuid;
  created_message_id uuid;
  message_text text := nullif(trim(coalesce(p_text, '')), '');
begin
  if not public.current_admin_has_permission('bookings') then
    raise exception 'Bookings permission is required to send an admin message';
  end if;

  if actor is null then
    raise exception 'Authentication is required to send a message';
  end if;

  if message_text is null then
    raise exception 'Message text is required';
  end if;

  select *
  into target_booking
  from public.bookings
  where id = p_booking_id;

  if target_booking.id is null then
    raise exception 'Booking not found';
  end if;

  select user_id
  into worker_user_id
  from public.workers
  where id = target_booking.worker_id;

  insert into public.messages (booking_id, sender_id, text)
  values (p_booking_id, actor, message_text)
  returning id into created_message_id;

  perform public.notify_user(
    worker_user_id,
    p_booking_id,
    'admin_message',
    'Admin შეტყობინება',
    message_text
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata_json)
  values (
    actor,
    'admin_message_sent',
    'booking',
    p_booking_id,
    jsonb_build_object('summary', message_text)
  );

  return jsonb_build_object(
    'message_id', created_message_id,
    'booking_id', p_booking_id
  );
end;
$$;

grant execute on function public.admin_send_booking_message(uuid, text)
to authenticated;

create or replace function public.mark_booking_messages_read(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_count integer;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to mark messages read';
  end if;

  if not public.user_can_access_booking(p_booking_id) then
    raise exception 'You do not have access to this booking';
  end if;

  update public.messages
  set read_at = now()
  where booking_id = p_booking_id
    and sender_id <> current_user_id
    and read_at is null;

  get diagnostics updated_count = row_count;

  return jsonb_build_object(
    'booking_id',
    p_booking_id,
    'updated_count',
    updated_count
  );
end;
$$;

grant execute on function public.mark_booking_messages_read(uuid)
to authenticated;

create or replace function public.list_my_message_threads()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_worker_id uuid;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();
  current_worker_id := public.current_app_worker_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read message threads';
  end if;

  select coalesce(jsonb_agg(item order by (item ->> 'archived')::boolean, ((item ->> 'unread_count')::integer > 0) desc, (item ->> 'last_at') desc nulls last), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'booking_id', b.id,
      'title',
        case
          when b.client_id = current_user_id then
            coalesce(w.display_name, trim(concat_ws(' ', wu.first_name, wu.last_name)), 'ხელოსანი')
          else
            trim(concat_ws(' ', cu.first_name, left(coalesce(cu.last_name, ''), 1) || case when cu.last_name is null or cu.last_name = '' then '' else '.' end))
        end,
      'subtitle',
        concat_ws(
          ' · ',
          coalesce(p.name, 'სამუშაო'),
          to_char(b.scheduled_at, 'DD.MM.YYYY'),
          to_char(b.scheduled_at, 'HH24:MI')
        ),
      'status', b.status,
      'last_text', coalesce(last_message.text, 'ჯერ მიმოწერა არ არის'),
      'last_at', last_message.created_at,
      'unread_count', (
        select count(*)
        from public.messages unread_messages
        where unread_messages.booking_id = b.id
          and unread_messages.sender_id <> current_user_id
          and unread_messages.read_at is null
      ),
      'archived', b.status::text in ('client_confirmed', 'closed', 'completed', 'declined', 'cancelled')
    ) as item
    from public.bookings b
    join public.workers w on w.id = b.worker_id
    join public.users wu on wu.id = w.user_id
    join public.users cu on cu.id = b.client_id
    left join public.professions p on p.id = b.profession_id
    left join lateral (
      select
        case
          when m.attachment_url is not null and nullif(m.text, '') is null then 'ფოტო'
          else m.text
        end as text,
        m.created_at
      from public.messages m
      where m.booking_id = b.id
      order by m.created_at desc
      limit 1
    ) last_message on true
    where b.client_id = current_user_id
      or b.worker_id = current_worker_id
      or public.current_app_user_is_admin()
  ) threads;

  return result;
end;
$$;

grant execute on function public.list_my_message_threads()
to authenticated;

create or replace function public.list_booking_messages(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_role public.user_role;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read messages';
  end if;

  if not public.user_can_access_booking(p_booking_id) then
    raise exception 'You do not have access to this booking';
  end if;

  select role
  into current_role
  from public.users
  where id = current_user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'booking_id', m.booking_id,
      'sender',
        case
          when sender_user.role = 'admin' then 'system'
          when m.sender_id = current_user_id then current_role::text
          when current_role = 'client' then 'craftsman'
          else 'client'
        end,
      'text', m.text,
      'attachment_url', m.attachment_url,
      'attachment_type', m.attachment_type,
      'attachment_name', m.attachment_name,
      'created_at', m.created_at,
      'read_at', m.read_at
    )
    order by m.created_at
  ), '[]'::jsonb)
  into result
  from public.messages m
  left join public.users sender_user on sender_user.id = m.sender_id
  where m.booking_id = p_booking_id;

  return result;
end;
$$;

grant execute on function public.list_booking_messages(uuid)
to authenticated;
