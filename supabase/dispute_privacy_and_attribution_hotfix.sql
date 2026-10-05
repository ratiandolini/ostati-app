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
