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
