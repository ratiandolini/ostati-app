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
      'booking_fee_amount', b.booking_fee_amount,
      'payment_status', coalesce(pay.status, b.payment_status),
      'payment_provider', pay.provider,
      'payment_currency', coalesce(pay.currency, 'GEL'),
      'payment_transaction_id', pay.provider_payment_id,
      'active_dispute', (
        select jsonb_build_object(
          'reason', d.reason,
          'details', d.details,
          'evidence', coalesce(d.evidence, '[]'::jsonb),
          'status', d.status,
          'admin_note', d.admin_note,
          'resolved_at', d.resolved_at
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
      'booking_fee_amount', b.booking_fee_amount,
      'payment_status', coalesce(pay.status, b.payment_status),
      'payment_provider', pay.provider,
      'payment_currency', coalesce(pay.currency, 'GEL'),
      'payment_transaction_id', pay.provider_payment_id,
      'profession_name', coalesce(p.name, 'ხელოსანი'),
      'active_dispute', (
        select jsonb_build_object(
          'reason', d.reason,
          'details', d.details,
          'evidence', coalesce(d.evidence, '[]'::jsonb),
          'status', d.status,
          'admin_note', d.admin_note,
          'resolved_at', d.resolved_at
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
