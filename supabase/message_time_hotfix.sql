-- Remonter hotfix: show booking times in Tbilisi time inside message threads.
-- Run this once in Supabase SQL Editor.

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
      'title', case
        when b.client_id = current_user_id then coalesce(w.display_name, trim(concat_ws(' ', wu.first_name, wu.last_name)), 'ხელოსანი')
        else trim(concat_ws(' ', cu.first_name, left(coalesce(cu.last_name, ''), 1) || case when cu.last_name is null or cu.last_name = '' then '' else '.' end))
      end,
      'subtitle', concat_ws(
        ' · ',
        coalesce(p.name, 'სამუშაო'),
        to_char(b.scheduled_at at time zone 'Asia/Tbilisi', 'DD.MM.YYYY'),
        to_char(b.scheduled_at at time zone 'Asia/Tbilisi', 'HH24:MI')
      ),
      'status', b.status,
      'last_text', coalesce(last_message.text, 'ჯერ მიმოწერა არ არის'),
      'last_at', last_message.created_at,
      'unread_count', (
        select count(*) from public.messages unread_messages
        left join public.users unread_sender on unread_sender.id = unread_messages.sender_id
        where unread_messages.booking_id = b.id
          and unread_messages.sender_id <> current_user_id
          and unread_messages.read_at is null
          and coalesce(unread_sender.role::text, '') <> 'admin'
          and unread_messages.text not like 'სისტემა:%'
      ),
      'archived', b.status::text in ('client_confirmed', 'closed', 'completed', 'declined', 'cancelled')
    ) as item
    from public.bookings b
    join public.workers w on w.id = b.worker_id
    join public.users wu on wu.id = w.user_id
    join public.users cu on cu.id = b.client_id
    left join public.professions p on p.id = b.profession_id
    left join lateral (
      select case when m.attachment_url is not null and nullif(m.text, '') is null then 'ფოტო' else m.text end as text, m.created_at
      from public.messages m
      left join public.users sender_user on sender_user.id = m.sender_id
      where m.booking_id = b.id
        and coalesce(sender_user.role::text, '') <> 'admin'
        and m.text not like 'სისტემა:%'
      order by m.created_at desc limit 1
    ) last_message on true
    where b.client_id = current_user_id
      or b.worker_id = current_worker_id
      or public.current_app_user_is_admin()
  ) threads;
  return result;
end;
$$;

grant execute on function public.list_my_message_threads() to authenticated;
notify pgrst, 'reload schema';
