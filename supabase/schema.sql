create extension if not exists "pgcrypto";

create type public.user_role as enum ('client', 'craftsman', 'admin');
create type public.user_status as enum ('active', 'blocked', 'pending');
create type public.price_type as enum ('fixed', 'from', 'range');
create type public.worker_verification_status as enum (
  'not_started',
  'pending',
  'verified',
  'rejected'
);
create type public.subscription_status as enum (
  'trial',
  'active',
  'past_due',
  'paused',
  'cancelled'
);
create type public.booking_status as enum (
  'pending',
  'confirmed',
  'en_route',
  'started',
  'worker_completed',
  'client_confirmed',
  'closed',
  'declined',
  'cancelled',
  'disputed'
);
create type public.payment_status as enum (
  'not_required',
  'authorized',
  'captured',
  'refunded',
  'failed'
);
create type public.material_owner as enum ('client', 'worker', 'unknown');
create type public.reviewee_role as enum ('client', 'craftsman');
create type public.verification_document_type as enum (
  'id_front',
  'id_back',
  'bank_account'
);
create type public.document_status as enum ('pending', 'approved', 'rejected');
create type public.dispute_status as enum (
  'open',
  'reviewing',
  'resolved',
  'rejected'
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  role public.user_role not null,
  phone text not null unique,
  first_name text,
  last_name text,
  photo_url text,
  city text,
  address_text text,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  status public.user_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table public.professions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'რემონტი',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  display_name text,
  city text,
  address_area text,
  about text,
  experience_years integer not null default 0 check (experience_years >= 0),
  price_type public.price_type not null default 'from',
  price_min numeric(10, 2),
  price_max numeric(10, 2),
  main_profession_id uuid references public.professions(id) on delete set null,
  verification_status public.worker_verification_status not null default 'not_started',
  is_active boolean not null default false,
  trial_started_at timestamptz,
  subscription_status public.subscription_status not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workers_price_range_check check (
    price_max is null or price_min is null or price_max >= price_min
  )
);

create table public.worker_professions (
  worker_id uuid not null references public.workers(id) on delete cascade,
  profession_id uuid not null references public.professions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (worker_id, profession_id)
);

create table public.worker_schedule (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint worker_schedule_time_check check (end_time > start_time)
);

create table public.worker_unavailable_ranges (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint unavailable_range_time_check check (ends_at > starts_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  profession_id uuid references public.professions(id) on delete set null,
  scheduled_at timestamptz not null,
  status public.booking_status not null default 'pending',
  city text,
  address_text text,
  client_comment text,
  booking_fee_amount numeric(10, 2) not null default 0,
  payment_status public.payment_status not null default 'not_required',
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_details (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  area numeric(10, 2),
  height numeric(10, 2),
  length numeric(10, 2),
  rooms integer,
  wall_condition text,
  target_surface text,
  material_owner public.material_owner,
  plumbing_type text,
  floor integer,
  electric_points integer,
  electric_panel text,
  is_emergency boolean,
  work_scope text,
  surface_type text,
  material_note text,
  item_count text,
  current_condition text,
  photo_note text,
  roof_type text,
  extra_measurements jsonb not null default '{}'::jsonb,
  uploaded_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete restrict,
  text text not null,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reviewer_id uuid not null references public.users(id) on delete restrict,
  reviewee_id uuid not null references public.users(id) on delete restrict,
  reviewee_role public.reviewee_role not null,
  overall_rating integer not null check (overall_rating between 1 and 5),
  criteria_json jsonb not null default '{}'::jsonb,
  comment text,
  created_at timestamptz not null default now(),
  unique (booking_id, reviewer_id, reviewee_id)
);

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  type public.verification_document_type not null,
  file_url text not null,
  status public.document_status not null default 'pending',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (worker_id, type)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  payer_id uuid not null references public.users(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  amount numeric(10, 2) not null,
  platform_fee_amount numeric(10, 2) not null default 0,
  worker_amount numeric(10, 2) not null default 0,
  currency text not null default 'GEL',
  provider text,
  provider_payment_id text,
  status public.payment_status not null default 'authorized',
  captured_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_amount_check check (amount >= 0),
  constraint payments_fee_check check (platform_fee_amount >= 0 and worker_amount >= 0)
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  opened_by uuid not null references public.users(id) on delete restrict,
    reason text not null,
    details text,
    evidence jsonb not null default '[]'::jsonb,
    status public.dispute_status not null default 'open',
  admin_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.client_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  plan text not null,
  amount numeric(10, 2) not null default 0,
  status public.subscription_status not null default 'trial',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index users_auth_user_id_idx on public.users(auth_user_id);
create index users_phone_idx on public.users(phone);
create index workers_city_idx on public.workers(city);
create index workers_is_active_idx on public.workers(is_active);
create index bookings_client_id_idx on public.bookings(client_id);
create index bookings_worker_id_idx on public.bookings(worker_id);
create index bookings_status_idx on public.bookings(status);
create index bookings_scheduled_at_idx on public.bookings(scheduled_at);
create index messages_booking_id_created_at_idx on public.messages(booking_id, created_at);
create index notifications_user_id_created_at_idx on public.notifications(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger workers_set_updated_at
before update on public.workers
for each row execute function public.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create trigger booking_details_set_updated_at
before update on public.booking_details
for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.workers enable row level security;
alter table public.professions enable row level security;
alter table public.worker_professions enable row level security;
alter table public.worker_schedule enable row level security;
alter table public.worker_unavailable_ranges enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_details enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.verification_documents enable row level security;
alter table public.payments enable row level security;
alter table public.disputes enable row level security;
alter table public.notifications enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;

create policy "professions are public read"
on public.professions for select
using (is_active = true);
