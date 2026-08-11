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
      'კლიენტმა დავა გახსნა. მიზეზი და კომენტარი იხილეთ Admin პანელში.'
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
