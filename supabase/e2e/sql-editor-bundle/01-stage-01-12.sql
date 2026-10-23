-- TEST PROJECT ONLY: ivguranttkxhxsdsppqk. Stage 1/9; source files 1-12 of 47.
-- Verify the Supabase Dashboard project URL/reference before running this entire file.
-- The database cannot independently authenticate its Supabase project reference.
-- Stage 01 requires an empty project with no application or Auth users.
begin;
do $e2e_guard$
begin
  if not (to_regclass('public.users') is null and to_regclass('public.e2e_test_environment') is null and to_regclass('public.e2e_sql_editor_install') is null and not exists (select 1 from auth.users) and not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p'))) then
    raise exception 'E2E SQL Editor install requires a fresh test database';
  end if;
end;
$e2e_guard$;

-- BEGIN SOURCE 1: supabase/schema.sql
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
-- END SOURCE 1: supabase/schema.sql

-- BEGIN SOURCE 2: supabase/auth.sql
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
  phone_value text;
  first_name_value text;
  last_name_value text;
begin
  requested_role := coalesce(
    nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role,
    'client'::public.user_role
  );
  phone_value := coalesce(new.phone, new.raw_user_meta_data ->> 'phone', new.email);
  first_name_value := new.raw_user_meta_data ->> 'first_name';
  last_name_value := new.raw_user_meta_data ->> 'last_name';

  if phone_value is null then
    raise exception 'Cannot create app user without phone or email';
  end if;

  insert into public.users (
    auth_user_id,
    role,
    phone,
    first_name,
    last_name,
    status,
    last_login_at
  ) values (
    new.id,
    requested_role,
    phone_value,
    first_name_value,
    last_name_value,
    'active',
    now()
  )
  on conflict (auth_user_id) do update set
    phone = excluded.phone,
    role = excluded.role,
    first_name = coalesce(excluded.first_name, public.users.first_name),
    last_name = coalesce(excluded.last_name, public.users.last_name),
    status = 'active',
    last_login_at = now();

  if requested_role = 'craftsman' then
    insert into public.workers (
      user_id,
      display_name,
      trial_started_at,
      subscription_status
    )
    select
      users.id,
      trim(coalesce(users.first_name, '') || ' ' || coalesce(users.last_name, '')),
      now(),
      'trial'
    from public.users
    where users.auth_user_id = new.id
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert or update on auth.users
for each row execute function public.handle_new_auth_user();
-- END SOURCE 2: supabase/auth.sql

-- BEGIN SOURCE 3: supabase/seed.sql
insert into public.professions (name, category, sort_order) values
  ('ალუმინის კარ-ფანჯარა', 'კარ-ფანჯარა', 10),
  ('არმატურის სამუშაოები', 'კონსტრუქცია', 20),
  ('ავეჯის აწყობა', 'ავეჯი', 30),
  ('ბეტონის სამუშაოები', 'კონსტრუქცია', 40),
  ('გათბობის ხელოსანი', 'გათბობა', 50),
  ('გიფსოკარდონის ხელოსანი', 'შიდა სამუშაოები', 60),
  ('დურგალი', 'ხე და ავეჯი', 70),
  ('ელექტრიკოსი', 'ელექტროობა', 80),
  ('იზოლაციის ხელოსანი', 'იზოლაცია', 90),
  ('კაფელ-მეტლახის ხელოსანი', 'კერამიკა', 100),
  ('კონდიციონერის ხელოსანი', 'კლიმატი', 110),
  ('ლამინატის ხელოსანი', 'იატაკი', 120),
  ('მალიარი', 'შიდა სამუშაოები', 130),
  ('მეტალის ხელოსანი', 'მეტალი', 140),
  ('მინაპაკეტის ხელოსანი', 'კარ-ფანჯარა', 150),
  ('მონტაჟის ხელოსანი', 'მონტაჟი', 160),
  ('მშრალი იატაკის ხელოსანი', 'იატაკი', 170),
  ('პარკეტის ხელოსანი', 'იატაკი', 180),
  ('პლასტმასის კარ-ფანჯარა', 'კარ-ფანჯარა', 190),
  ('სახურავის ხელოსანი', 'სახურავი', 200),
  ('სანტექნიკოსი', 'სანტექნიკა', 210),
  ('სარემონტო ბრიგადა', 'სრული რემონტი', 220),
  ('სველი წერტილის ხელოსანი', 'სანტექნიკა', 230),
  ('ფასადის ხელოსანი', 'გარე სამუშაოები', 240),
  ('შპალერის ხელოსანი', 'შიდა სამუშაოები', 250),
  ('ჭერის ხელოსანი', 'შიდა სამუშაოები', 260)
on conflict (name) do update set
  category = excluded.category,
  sort_order = excluded.sort_order,
  is_active = true;
-- END SOURCE 3: supabase/seed.sql

-- BEGIN SOURCE 4: supabase/profession_questions.sql
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'booking_question_input_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.booking_question_input_type as enum (
      'text',
      'number',
      'boolean',
      'select',
      'photo'
    );
  end if;
end;
$$;

create table if not exists public.profession_booking_questions (
  id uuid primary key default gen_random_uuid(),
  profession_id uuid not null references public.professions(id) on delete cascade,
  key text not null,
  label text not null,
  placeholder text,
  input_type public.booking_question_input_type not null default 'text',
  options_json jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profession_id, key)
);

create index profession_booking_questions_profession_id_idx
on public.profession_booking_questions(profession_id, sort_order);

alter table public.profession_booking_questions enable row level security;

drop policy if exists "profession booking questions are public read"
on public.profession_booking_questions;

create policy "profession booking questions are public read"
on public.profession_booking_questions for select
using (is_active = true);

insert into public.profession_booking_questions (
  profession_id,
  key,
  label,
  placeholder,
  input_type,
  options_json,
  is_required,
  sort_order
)
select
  p.id,
  q.key,
  q.label,
  q.placeholder,
  q.input_type::public.booking_question_input_type,
  q.options_json::jsonb,
  q.is_required,
  q.sort_order
from public.professions p
join (
  values
    ('მალიარი', 'area', 'ფართი მ²', 'მაგ: 45', 'number', '[]', false, 10),
    ('მალიარი', 'wallCondition', 'კედლის მდგომარეობა', 'მაგ: ძველი საღებავი, ბზარები...', 'text', '[]', false, 20),
    ('მალიარი', 'targetSurface', 'რას ეხება საქმე', 'კედელი, ჭერი, ფასადი...', 'select', '["კედელი","ჭერი","ფასადი","სხვა"]', false, 30),
    ('მალიარი', 'materialOwner', 'მასალა ვისია', 'ჩემი, ხელოსნის, შესათანხმებელია', 'select', '["კლიენტის","ხელოსნის","შესათანხმებელია"]', false, 40),
    ('სანტექნიკოსი', 'plumbingType', 'საქმის ტიპი', 'გაჟონვა, მონტაჟი, შეცვლა...', 'select', '["გაჟონვა","მონტაჟი","შეცვლა","შემოწმება","სხვა"]', false, 10),
    ('სანტექნიკოსი', 'floor', 'სართული', 'მაგ: 5', 'number', '[]', false, 20),
    ('სანტექნიკოსი', 'uploadedPhotoUrl', 'ფოტო', 'სასურველია პრობლემის ფოტოს ატვირთვა', 'photo', '[]', false, 30),
    ('ელექტრიკოსი', 'electricPoints', 'წერტილების რაოდენობა', 'მაგ: 8', 'number', '[]', false, 10),
    ('ელექტრიკოსი', 'electricPanel', 'ელ. ფარის მდგომარეობა', 'ძველი, ახალი, შესაცვლელი...', 'text', '[]', false, 20),
    ('ელექტრიკოსი', 'isEmergency', 'ავარიულია?', 'კი / არა', 'boolean', '[]', false, 30),
    ('კაფელ-მეტლახის ხელოსანი', 'area', 'ფართი მ²', 'მაგ: 18', 'number', '[]', false, 10),
    ('კაფელ-მეტლახის ხელოსანი', 'targetSurface', 'სად იგება', 'იატაკი, კედელი, აბაზანა...', 'select', '["იატაკი","კედელი","აბაზანა","სამზარეულო","სხვა"]', false, 20),
    ('ლამინატის ხელოსანი', 'area', 'ფართი მ²', 'მაგ: 55', 'number', '[]', false, 10),
    ('ლამინატის ხელოსანი', 'rooms', 'ოთახები', 'მაგ: 3', 'number', '[]', false, 20),
    ('დურგალი', 'targetSurface', 'რა არის დასამზადებელი', 'ავეჯი, კარი, კარადა...', 'text', '[]', false, 10),
    ('დურგალი', 'extraMeasurements', 'ზომები', 'მაგ: 240x60x220', 'text', '[]', false, 20)
) as q(profession_name, key, label, placeholder, input_type, options_json, is_required, sort_order)
  on p.name = q.profession_name
on conflict (profession_id, key) do update set
  label = excluded.label,
  placeholder = excluded.placeholder,
  input_type = excluded.input_type,
  options_json = excluded.options_json,
  is_required = excluded.is_required,
  sort_order = excluded.sort_order,
  is_active = true;
-- END SOURCE 4: supabase/profession_questions.sql

-- BEGIN SOURCE 5: supabase/booking_workflow.sql
create or replace function public.is_allowed_booking_status_transition(
  old_status public.booking_status,
  new_status public.booking_status
)
returns boolean
language sql
immutable
as $$
  select
    old_status = new_status
    or (
      old_status = 'pending'
      and new_status in ('confirmed', 'declined', 'cancelled', 'disputed')
    )
    or (
      old_status = 'confirmed'
      and new_status in ('en_route', 'started', 'cancelled', 'disputed')
    )
    or (
      old_status = 'en_route'
      and new_status in ('started', 'cancelled', 'disputed')
    )
    or (
      old_status = 'started'
      and new_status in ('worker_completed', 'cancelled', 'disputed')
    )
    or (
      old_status = 'worker_completed'
      and new_status in ('client_confirmed', 'disputed')
    )
    or (
      old_status = 'client_confirmed'
      and new_status in ('closed', 'disputed')
    )
    or (
      old_status = 'disputed'
      and new_status in ('closed', 'cancelled')
    )
$$;

create or replace function public.validate_booking_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status
    and not public.is_allowed_booking_status_transition(old.status, new.status)
  then
    raise exception 'Invalid booking status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_validate_status_transition on public.bookings;

create trigger bookings_validate_status_transition
before update of status on public.bookings
for each row execute function public.validate_booking_status_transition();

create or replace function public.booking_status_title(
  status public.booking_status
)
returns text
language sql
immutable
as $$
  select case status
    when 'pending' then 'ჯავშანი მოლოდინშია'
    when 'confirmed' then 'ჯავშანი დადასტურდა'
    when 'en_route' then 'ხელოსანი გზაშია'
    when 'started' then 'სამუშაო დაიწყო'
    when 'worker_completed' then 'შეფასება საჭიროა'
    when 'client_confirmed' then 'კლიენტმა დაადასტურა'
    when 'closed' then 'ჯავშანი დაიხურა'
    when 'declined' then 'ჯავშანი უარყოფილია'
    when 'cancelled' then 'ჯავშანი გაუქმებულია'
    when 'disputed' then 'ჯავშანზე დავა გაიხსნა'
  end
$$;

create or replace function public.booking_status_body(
  old_status public.booking_status,
  new_status public.booking_status
)
returns text
language sql
immutable
as $$
  select case new_status
    when 'confirmed' then 'ხელოსანმა დაადასტურა ჯავშანი და მზადაა სამუშაოსთვის.'
    when 'en_route' then 'ხელოსანი გზაშია.'
    when 'started' then 'სამუშაო დაიწყო.'
    when 'worker_completed' then 'ხელოსანმა სამუშაო დასრულებულად მონიშნა. დაადასტურეთ შესრულება და შეაფასეთ.'
    when 'client_confirmed' then 'კლიენტმა სამუშაო დასრულებულად დაადასტურა.'
    when 'closed' then 'ჯავშანი დაიხურა.'
    when 'declined' then 'ხელოსანმა ჯავშანი უარყო. შეგიძლიათ აირჩიოთ სხვა ხელოსანი.'
    when 'cancelled' then 'ჯავშანი გაუქმდა. დეტალებში ნახეთ მიზეზი და თანხის სტატუსი.'
    when 'disputed' then 'ჯავშანზე გაიხსნა პრობლემა და Admin გადაამოწმებს.'
    else 'ჯავშნის სტატუსი შეიცვალა: ' || old_status::text || ' -> ' || new_status::text
  end
$$;

create or replace function public.notify_booking_status_change()
returns trigger
language plpgsql
as $$
declare
  actor_user_id uuid;
  worker_user_id uuid;
  notification_title text;
  notification_body text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  actor_user_id := public.current_app_user_id();

  select workers.user_id
  into worker_user_id
  from public.workers
    where workers.id = new.worker_id;

  notification_title := public.booking_status_title(new.status);
  notification_body := public.booking_status_body(old.status, new.status);

  if new.client_id is not null and new.client_id is distinct from actor_user_id then
    perform public.notify_user(
      new.client_id,
      new.id,
      case
        when new.status = 'worker_completed' then 'review'
        else 'booking_status'
      end,
      notification_title,
      notification_body
    );
  end if;

  if worker_user_id is not null and worker_user_id is distinct from actor_user_id then
    perform public.notify_user(
      worker_user_id,
      new.id,
      'booking_status',
      notification_title,
      notification_body
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_notify_status_change on public.bookings;

create trigger bookings_notify_status_change
after update of status on public.bookings
for each row execute function public.notify_booking_status_change();
-- END SOURCE 5: supabase/booking_workflow.sql

-- BEGIN SOURCE 6: supabase/review_workflow.sql
create or replace function public.user_can_review_booking(
  target_booking_id uuid,
  target_reviewer_id uuid,
  target_reviewee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings
    join public.workers on workers.id = bookings.worker_id
    where bookings.id = target_booking_id
      and bookings.status in ('worker_completed', 'client_confirmed', 'closed', 'cancelled', 'disputed')
      and (
        (
          bookings.client_id = target_reviewer_id
          and workers.user_id = target_reviewee_id
        )
        or (
          workers.user_id = target_reviewer_id
          and bookings.client_id = target_reviewee_id
        )
      )
  )
$$;

create or replace function public.validate_review_participants()
returns trigger
language plpgsql
as $$
begin
  if new.reviewer_id = new.reviewee_id then
    raise exception 'Reviewer and reviewee cannot be the same user';
  end if;

  if not public.user_can_review_booking(
    new.booking_id,
    new.reviewer_id,
    new.reviewee_id
  ) then
    raise exception 'Review participants do not match booking parties or booking is not reviewable';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_validate_participants on public.reviews;

create trigger reviews_validate_participants
before insert or update on public.reviews
for each row execute function public.validate_review_participants();

create or replace function public.recalculate_user_rating(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_rating_avg numeric(3, 2);
  next_rating_count integer;
begin
  select
    coalesce(round(avg(overall_rating)::numeric, 2), 0),
    count(*)::integer
  into next_rating_avg, next_rating_count
  from public.reviews
  where reviewee_id = target_user_id;

  update public.users
  set
    rating_avg = next_rating_avg,
    rating_count = next_rating_count
  where id = target_user_id;
end;
$$;

create or replace function public.refresh_reviewee_rating()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_user_rating(old.reviewee_id);
    return old;
  end if;

  perform public.recalculate_user_rating(new.reviewee_id);

  if tg_op = 'UPDATE' and old.reviewee_id is distinct from new.reviewee_id then
    perform public.recalculate_user_rating(old.reviewee_id);
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_refresh_reviewee_rating on public.reviews;

create trigger reviews_refresh_reviewee_rating
after insert or update or delete on public.reviews
for each row execute function public.refresh_reviewee_rating();
-- END SOURCE 6: supabase/review_workflow.sql

-- TEST-ONLY PREREQUISITE: platform_settings is created in the later Admin SQL.
create table if not exists public.platform_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;

-- BEGIN SOURCE 7: supabase/payment_workflow.sql
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
-- END SOURCE 7: supabase/payment_workflow.sql

-- BEGIN SOURCE 8: supabase/dispute_workflow.sql
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.booking_worker_user_id(target_booking_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workers.user_id
  from public.bookings
  join public.workers on workers.id = bookings.worker_id
  where bookings.id = target_booking_id
  limit 1
$$;

create or replace function public.sync_booking_status_from_dispute()
returns trigger
language plpgsql
as $$
begin
  update public.bookings
  set status = 'disputed'
  where id = new.booking_id
    and status not in ('disputed', 'closed', 'cancelled');

  return new;
end;
$$;

drop trigger if exists disputes_sync_booking_status on public.disputes;

create trigger disputes_sync_booking_status
after insert on public.disputes
for each row execute function public.sync_booking_status_from_dispute();

create or replace function public.notify_dispute_change()
returns trigger
language plpgsql
as $$
declare
  client_user_id uuid;
  worker_user_id uuid;
  notification_title text;
begin
  if tg_op = 'INSERT' then
    return new;
  elsif old.status is distinct from new.status then
    notification_title := case new.status
      when 'reviewing' then 'დავა განხილვაშია'
      when 'resolved' then 'დავა დაიხურა'
      else 'დავის სტატუსი შეიცვალა'
    end;
  else
    return new;
  end if;

  if public.current_app_user_is_admin() then
    return new;
  end if;

  select bookings.client_id, public.booking_worker_user_id(bookings.id)
  into client_user_id, worker_user_id
  from public.bookings
  where bookings.id = new.booking_id;

  perform public.notify_user(
    client_user_id,
    new.booking_id,
    'dispute',
    notification_title,
    coalesce(new.admin_note, new.reason, 'დავის დეტალები იხილეთ ჯავშანში')
  );

  perform public.notify_user(
    worker_user_id,
    new.booking_id,
    'dispute',
    notification_title,
    coalesce(new.admin_note, new.reason, 'დავის დეტალები იხილეთ ჯავშანში')
  );

  if new.status in ('resolved', 'rejected') and new.resolved_at is null then
    new.resolved_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists disputes_notify_insert on public.disputes;
drop trigger if exists disputes_notify_update on public.disputes;

create trigger disputes_notify_update
before update of status on public.disputes
for each row execute function public.notify_dispute_change();

create or replace function public.audit_booking_cancellation()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status and new.status = 'cancelled' then
    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata_json
    ) values (
      public.current_app_user_id(),
      'booking_cancelled',
      'booking',
      new.id,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'scheduled_at', new.scheduled_at,
        'cancellation_reason', new.cancellation_reason
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_audit_cancellation on public.bookings;

create trigger bookings_audit_cancellation
after update of status on public.bookings
for each row execute function public.audit_booking_cancellation();
-- END SOURCE 8: supabase/dispute_workflow.sql

-- BEGIN SOURCE 9: supabase/subscription_workflow.sql
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
-- END SOURCE 9: supabase/subscription_workflow.sql

-- BEGIN SOURCE 10: supabase/subscription_pricing.sql
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
-- END SOURCE 10: supabase/subscription_pricing.sql

-- BEGIN SOURCE 11: supabase/public_catalog.sql
drop function if exists public.get_public_worker_cards();
drop view if exists public.worker_cards;

create or replace view public.worker_cards as
with worker_profession_names as (
  select
    wp.worker_id,
    array_remove(array_agg(distinct p.name order by p.name), null) as skills,
    min(p.name) as first_profession
  from public.worker_professions wp
  join public.professions p on p.id = wp.profession_id
  where p.is_active = true
  group by wp.worker_id
)
select
  w.id,
  coalesce(
    nullif(w.display_name, ''),
    nullif(trim(
      coalesce(u.first_name, '') ||
      case
        when u.last_name is null or u.last_name = '' then ''
        else ' ' || left(u.last_name, 1) || '.'
      end
    ), ''),
    'ხელოსანი'
  ) as name,
  coalesce(p.name, wpn.first_profession, 'ხელოსანი') as role,
  u.photo_url as avatar_url,
  u.rating_avg,
  u.rating_count,
  w.city,
  w.about,
  w.price_type,
  w.price_min,
  w.price_max,
  w.experience_years,
  w.verification_status,
  coalesce(wpn.skills, array[]::text[]) as skills,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'weekday', ws.weekday,
          'start_time', to_char(ws.start_time, 'HH24:MI'),
          'end_time', to_char(ws.end_time, 'HH24:MI')
        )
        order by ws.weekday
      )
      from public.worker_schedule ws
      where ws.worker_id = w.id
    ),
    '[]'::jsonb
  ) as schedule,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'start', to_char(wur.starts_at, 'YYYY-MM-DD'),
          'end', to_char(wur.ends_at, 'YYYY-MM-DD')
        )
        order by wur.starts_at
      )
      from public.worker_unavailable_ranges wur
      where wur.worker_id = w.id
    ),
    '[]'::jsonb
  ) as unavailable_ranges,
  coalesce(
    (
      select array_remove(
        array_agg(
          to_char(b.scheduled_at at time zone 'Asia/Tbilisi', 'YYYY-MM-DD"T"HH24:MI')
          order by b.scheduled_at
        ),
        null
      )
      from public.bookings b
      where b.worker_id = w.id
        and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
    ),
    array[]::text[]
  ) as booked_slots,
  w.created_at
from public.workers w
join public.users u on u.id = w.user_id
left join public.professions p on p.id = w.main_profession_id
left join worker_profession_names wpn on wpn.worker_id = w.id
where w.is_active = true
  and w.verification_status = 'verified'::public.worker_verification_status
  and u.status = 'active';

alter view public.worker_cards set (security_invoker = true);

grant select on public.worker_cards to anon, authenticated;

create or replace function public.get_public_worker_cards()
returns setof public.worker_cards
language sql stable security definer set search_path = public as $$
  select * from public.worker_cards
  order by rating_avg desc nulls last, rating_count desc, created_at desc;
$$;

revoke all on function public.get_public_worker_cards() from public;
grant execute on function public.get_public_worker_cards() to anon, authenticated;
-- END SOURCE 11: supabase/public_catalog.sql

-- BEGIN SOURCE 12: supabase/free_craftsmen_security_hotfix.sql
-- Remonter: craftsmen are free to use the platform for now.
-- Run this once in Supabase SQL Editor after reactivating the project.

-- Existing craftsmen stay visible and can keep receiving bookings.
update public.workers
set subscription_status = 'active'
where subscription_status is distinct from 'active'::public.subscription_status;

-- Booking availability no longer depends on a paid subscription.
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
  );
$$;

-- Apply RLS as the querying user instead of the view owner.
alter view public.worker_cards set (security_invoker = true);

grant select on public.worker_cards to anon, authenticated;
-- END SOURCE 12: supabase/free_craftsmen_security_hotfix.sql

create table public.e2e_sql_editor_install (
  singleton boolean primary key default true check (singleton),
  project_ref text not null check (project_ref = 'ivguranttkxhxsdsppqk'),
  completed_stage smallint not null check (completed_stage between 1 and 9),
  updated_at timestamptz not null default now()
);
alter table public.e2e_sql_editor_install enable row level security;
revoke all on table public.e2e_sql_editor_install from public, anon, authenticated;
insert into public.e2e_sql_editor_install (singleton, project_ref, completed_stage)
values (true, 'ivguranttkxhxsdsppqk', 1);
commit;
