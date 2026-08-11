create or replace function public.default_trial_days()
returns integer
language sql
stable
as $$
  select greatest(
    0,
    coalesce(
      nullif((select value_json ->> 'freeTrialDays' from public.platform_settings where key = 'platform'), '')::integer,
      30
    )
  );
$$;

create or replace function public.default_monthly_subscription_amount()
returns numeric
language sql
immutable
as $$
  select 29.00::numeric;
$$;

create or replace function public.ensure_worker_trial_started()
returns trigger
language plpgsql
as $$
begin
  if new.trial_started_at is null then
    new.trial_started_at := now();
  end if;

  if new.subscription_status is null then
    new.subscription_status := 'trial';
  end if;

  return new;
end;
$$;

drop trigger if exists workers_ensure_trial_started on public.workers;

create trigger workers_ensure_trial_started
before insert on public.workers
for each row execute function public.ensure_worker_trial_started();

create or replace function public.create_worker_trial_subscription()
returns trigger
language plpgsql
as $$
declare
  trial_end timestamptz;
  monthly_amount numeric;
begin
  trial_end := new.trial_started_at + make_interval(days => public.default_trial_days());
  select coalesce(nullif(value_json ->> 'craftsmanMonthlyFee', '')::numeric, public.default_monthly_subscription_amount())
    into monthly_amount
    from public.platform_settings
   where key = 'platform';
  monthly_amount := coalesce(monthly_amount, public.default_monthly_subscription_amount());

  if not exists (
    select 1
    from public.subscriptions
    where worker_id = new.id
      and status in ('trial', 'active', 'past_due')
  ) then
    insert into public.subscriptions (
      worker_id,
      plan,
      amount,
      status,
      trial_ends_at,
      current_period_start,
      current_period_end
    )
    values (
      new.id,
      'starter',
      monthly_amount,
      'trial',
      trial_end,
      new.trial_started_at,
      trial_end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists workers_create_trial_subscription on public.workers;

create trigger workers_create_trial_subscription
after insert on public.workers
for each row execute function public.create_worker_trial_subscription();

create or replace function public.sync_worker_subscription_status()
returns trigger
language plpgsql
as $$
begin
  update public.workers
  set subscription_status = new.status
  where id = new.worker_id;

  return new;
end;
$$;

drop trigger if exists subscriptions_sync_worker_status on public.subscriptions;

create trigger subscriptions_sync_worker_status
after insert or update of status on public.subscriptions
for each row execute function public.sync_worker_subscription_status();

create or replace function public.refresh_expired_worker_trials()
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  with expired as (
    update public.subscriptions
    set
      status = 'past_due',
      current_period_end = null,
      updated_at = now()
    where status = 'trial'
      and trial_ends_at is not null
      and trial_ends_at < now()
    returning worker_id
  )
  select count(*) into affected
  from expired;

  return affected;
end;
$$;

create or replace function public.create_trial_expiry_notifications()
returns integer
language plpgsql
as $$
declare
  created_count integer;
begin
  with created as (
    insert into public.notifications (
      user_id,
      type,
      title,
      body
    )
    select
      w.user_id,
      'subscription',
      'უფასო პერიოდი სრულდება',
      'ხელოსნის უფასო პერიოდი მალე დასრულდება. გადახდის ჩართვის შემდეგ პროფილი აქტიური დარჩება.'
    from public.subscriptions s
    join public.workers w on w.id = s.worker_id
    where s.status = 'trial'
      and s.trial_ends_at is not null
      and s.trial_ends_at between now() and now() + interval '3 days'
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = w.user_id
          and n.type = 'subscription'
          and n.title = 'უფასო პერიოდი სრულდება'
          and n.created_at > now() - interval '7 days'
      )
    returning id
  )
  select count(*) into created_count
  from created;

  return created_count;
end;
$$;

create or replace function public.run_subscription_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
  notification_count integer;
begin
  expired_count := public.refresh_expired_worker_trials();
  notification_count := public.create_trial_expiry_notifications();

  return jsonb_build_object(
    'expiredTrials', expired_count,
    'createdNotifications', notification_count
  );
end;
$$;

grant execute on function public.run_subscription_maintenance()
to authenticated;

create or replace function public.worker_can_receive_bookings(target_worker_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workers w
    join public.users u on u.id = w.user_id
    where w.id = target_worker_id
      and w.is_active = true
      and u.status = 'active'
      and w.subscription_status in ('trial', 'active')
  );
$$;

update public.workers
set trial_started_at = coalesce(trial_started_at, created_at, now())
where trial_started_at is null;

insert into public.subscriptions (
  worker_id,
  plan,
  amount,
  status,
  trial_ends_at,
  current_period_start,
  current_period_end
)
select
  w.id,
  'starter',
  public.default_monthly_subscription_amount(),
  w.subscription_status,
  w.trial_started_at + make_interval(days => public.default_trial_days()),
  w.trial_started_at,
  case
    when w.subscription_status = 'trial'
      then w.trial_started_at + make_interval(days => public.default_trial_days())
    else null
  end
from public.workers w
where not exists (
  select 1
  from public.subscriptions s
  where s.worker_id = w.id
    and s.status in ('trial', 'active', 'past_due')
);
