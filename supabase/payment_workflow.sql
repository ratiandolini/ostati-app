create or replace function public.platform_fee_rate()
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  settings jsonb;
  percent numeric;
begin
  select value_json
  into settings
  from public.platform_settings
  where key = 'platform';

  percent := coalesce(nullif(settings ->> 'commissionPercent', '')::numeric, 10);

  return greatest(0, percent) / 100;
end;
$$;

create or replace function public.calculate_platform_fee(total_amount numeric)
returns numeric
language sql
stable
as $$
  select round(greatest(total_amount, 0) * public.platform_fee_rate(), 2)
$$;

create or replace function public.prepare_payment_amounts()
returns trigger
language plpgsql
as $$
begin
  if new.amount < 0 then
    raise exception 'Payment amount cannot be negative';
  end if;

  new.platform_fee_amount := public.calculate_platform_fee(new.amount);
  new.worker_amount := round(new.amount - new.platform_fee_amount, 2);

  if new.worker_amount < 0 then
    raise exception 'Worker amount cannot be negative';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_prepare_amounts on public.payments;

create trigger payments_prepare_amounts
before insert or update of amount on public.payments
for each row execute function public.prepare_payment_amounts();

create or replace function public.sync_booking_payment_status()
returns trigger
language plpgsql
as $$
begin
  update public.bookings
  set payment_status = new.status
  where id = new.booking_id;

  return new;
end;
$$;

drop trigger if exists payments_sync_booking_status on public.payments;

create trigger payments_sync_booking_status
after insert or update of status on public.payments
for each row execute function public.sync_booking_payment_status();

create or replace function public.mark_payment_timestamps()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'captured' and new.captured_at is null then
      new.captured_at := now();
    end if;

    if new.status = 'refunded' and new.refunded_at is null then
      new.refunded_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists payments_mark_timestamps on public.payments;

create trigger payments_mark_timestamps
before update of status on public.payments
for each row execute function public.mark_payment_timestamps();
