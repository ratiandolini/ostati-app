-- Removes only the deferred 7-day request restriction from the already-applied
-- cancellation migration. The fixed 29 GEL late-cancellation penalty remains.

begin;

drop trigger if exists job_posts_enforce_client_request_restriction on public.job_posts;
drop trigger if exists bookings_enforce_client_request_restriction on public.bookings;

create or replace function public.apply_late_client_cancellation_consequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := public.current_app_user_id();
  v_free_cancellation_hours integer := 12;
  v_penalty numeric(10, 2) := 29;
begin
  if old.status is not distinct from new.status
    or new.status <> 'cancelled'
    or v_current_user_id is null
    or public.current_app_user_is_admin()
    or new.client_id is distinct from v_current_user_id then
    return new;
  end if;

  select
    coalesce(
      nullif(value_json ->> 'freeCancellationHours', '')::integer,
      v_free_cancellation_hours
    ),
    coalesce(
      nullif(value_json ->> 'lateCancellationPenalty', '')::numeric,
      v_penalty
    )
  into v_free_cancellation_hours, v_penalty
  from public.platform_settings
  where key = 'platform';

  v_free_cancellation_hours := coalesce(v_free_cancellation_hours, 12);
  v_penalty := coalesce(v_penalty, 29);

  if new.scheduled_at - now() < make_interval(hours => v_free_cancellation_hours) then
    new.cancellation_penalty_amount := v_penalty;

    if position('დაგვიანებული გაუქმება' in coalesce(new.cancellation_reason, '')) = 0 then
      new.cancellation_reason := concat_ws(
        ' · ',
        nullif(trim(coalesce(new.cancellation_reason, '')), ''),
        'დაგვიანებული გაუქმება'
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.apply_late_client_cancellation_consequence() from public, anon, authenticated;

drop function if exists public.enforce_client_request_restriction();
drop table if exists public.client_request_restrictions;

update public.platform_settings
set
  value_json = jsonb_set(
    coalesce(value_json, '{}'::jsonb),
    '{cancellationRules}',
    to_jsonb(
      'უფასო გაუქმება შესაძლებელია ვიზიტამდე მითითებული დროით ადრე. ამ დროის შემდეგ კლიენტის გაუქმებაზე სისტემაში ფიქსირდება 29 ლარის გაუქმების სანქცია.'::text
    ),
    true
  ),
  updated_at = now()
where key = 'legal';

commit;
