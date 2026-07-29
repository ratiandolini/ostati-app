create or replace function public.notify_user(
  p_user_id uuid,
  p_booking_id uuid default null,
  p_type text default 'booking_status',
  p_title text default '',
  p_body text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notifications (
    user_id,
    booking_id,
    type,
    title,
    body
  )
  values (
    p_user_id,
    p_booking_id,
    coalesce(nullif(trim(p_type), ''), 'booking_status'),
    coalesce(nullif(trim(p_title), ''), 'შეტყობინება'),
    nullif(trim(coalesce(p_body, '')), '')
  );
end;
$$;

grant execute on function public.notify_user(uuid, uuid, text, text, text)
to authenticated;

create or replace function public.list_my_notifications(
  p_limit integer default 30
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
    raise exception 'Authentication is required to read notifications';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'booking_id', n.booking_id,
      'type', n.type,
      'title', n.title,
      'body', n.body,
      'read_at', n.read_at,
      'created_at', n.created_at
    )
    order by n.created_at desc
  ), '[]'::jsonb)
  into result
  from (
    select *
    from public.notifications
    where user_id = current_user_id
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 100))
  ) n;

  return result;
end;
$$;

grant execute on function public.list_my_notifications(integer)
to authenticated;

create or replace function public.get_unread_notification_count()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  unread_count integer;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read notifications';
  end if;

  select count(*)
  into unread_count
  from public.notifications
  where user_id = current_user_id
    and read_at is null;

  return jsonb_build_object('unread_count', unread_count);
end;
$$;

grant execute on function public.get_unread_notification_count()
to authenticated;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to update notifications';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = current_user_id;

  if not found then
    raise exception 'Notification not found';
  end if;

  return jsonb_build_object('notification_id', p_notification_id);
end;
$$;

grant execute on function public.mark_notification_read(uuid)
to authenticated;

create or replace function public.mark_booking_notifications_read(
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
    raise exception 'Authentication is required to update notifications';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where booking_id = p_booking_id
    and user_id = current_user_id
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

grant execute on function public.mark_booking_notifications_read(uuid)
to authenticated;

create or replace function public.mark_all_notifications_read()
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
    raise exception 'Authentication is required to update notifications';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where user_id = current_user_id
    and read_at is null;

  get diagnostics updated_count = row_count;

  return jsonb_build_object('updated_count', updated_count);
end;
$$;

grant execute on function public.mark_all_notifications_read()
to authenticated;
