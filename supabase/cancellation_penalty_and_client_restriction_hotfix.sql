-- FIXART cancellation consequence: fixed 29 GEL late-cancellation penalty.
--
-- This migration preserves all booking, message, interest and job-post history.
-- It only applies to future client cancellations.

alter table public.bookings
  add column if not exists cancellation_penalty_amount numeric(10, 2);

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

drop trigger if exists bookings_apply_late_client_cancellation_consequence on public.bookings;
create trigger bookings_apply_late_client_cancellation_consequence
before update of status on public.bookings
for each row execute function public.apply_late_client_cancellation_consequence();

update public.platform_settings
set
  value_json = jsonb_set(
    coalesce(value_json, '{}'::jsonb),
    '{lateCancellationPenalty}',
    to_jsonb(29::numeric),
    true
  ),
  updated_at = now()
where key = 'platform';

update public.platform_settings
set
  value_json = jsonb_set(
    jsonb_set(
      coalesce(value_json, '{}'::jsonb),
      '{privacyRules}',
      to_jsonb(
        'FIXART ამუშავებს მხოლოდ სერვისის გასაწევად აუცილებელ პირად მონაცემებს. ჯავშნისა და მხარდაჭერის პროცესში საჭირო ინფორმაცია ხელმისაწვდომია მხოლოდ შესაბამისი პროცესის მონაწილეებისთვის და პლატფორმის ფუნქციონირების ფარგლებში. ძირითადი კომუნიკაცია ჩატში რჩება.'::text
      ),
      true
    ),
    '{cancellationRules}',
    to_jsonb(
      'უფასო გაუქმება შესაძლებელია ვიზიტამდე მითითებული დროით ადრე. ამ დროის შემდეგ კლიენტის გაუქმებაზე სისტემაში ფიქსირდება 29 ლარის გაუქმების სანქცია.'::text
    ),
    true
  ),
  updated_at = now()
where key = 'legal';

notify pgrst, 'reload schema';
