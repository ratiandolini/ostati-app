-- Keeps worker subscription amount and trial duration in sync with Admin settings.
-- Run this once in Supabase SQL Editor after subscription_workflow.sql.

create or replace function public.default_monthly_subscription_amount()
returns numeric
language sql
immutable
as $$
  select 29.00::numeric;
$$;

create or replace function public.sync_subscription_from_platform_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  monthly_amount numeric;
  trial_days integer;
begin
  if new.key <> 'platform' then
    return new;
  end if;

  monthly_amount := greatest(0, coalesce((new.value_json ->> 'craftsmanMonthlyFee')::numeric, 29));
  trial_days := greatest(0, coalesce((new.value_json ->> 'freeTrialDays')::integer, public.default_trial_days()));

  update public.subscriptions
     set amount = monthly_amount,
         trial_ends_at = case
           when status = 'trial' and current_period_start is not null
             then current_period_start + make_interval(days => trial_days)
           else trial_ends_at
         end,
         current_period_end = case
           when status = 'trial' and current_period_start is not null
             then current_period_start + make_interval(days => trial_days)
           else current_period_end
         end
   where status in ('trial', 'active', 'past_due')
     and (
       amount is distinct from monthly_amount
       or (
         status = 'trial'
         and current_period_start is not null
         and trial_ends_at is distinct from current_period_start + make_interval(days => trial_days)
       )
     );

  return new;
end;
$$;

drop trigger if exists platform_settings_sync_subscription_amount on public.platform_settings;
create trigger platform_settings_sync_subscription_amount
after insert or update of value_json on public.platform_settings
for each row execute function public.sync_subscription_from_platform_settings();

insert into public.platform_settings (key, value_json)
values ('platform', '{"craftsmanMonthlyFee": 29}'::jsonb)
on conflict (key) do update
set value_json = jsonb_set(
  public.platform_settings.value_json,
  '{craftsmanMonthlyFee}',
  '29'::jsonb,
  true
);

update public.subscriptions
   set amount = 29
 where status in ('trial', 'active', 'past_due')
   and amount is distinct from 29;
