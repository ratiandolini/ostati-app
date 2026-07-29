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
