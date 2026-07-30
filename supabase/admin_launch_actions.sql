create table if not exists public.platform_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_members (
  id text primary key,
  user_id uuid unique references public.users(id) on delete set null,
  name text not null,
  role text not null check (role in ('owner', 'verification', 'support', 'finance')),
  permissions text[] not null default '{}'::text[],
  active boolean not null default true,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.admin_members
add column if not exists user_id uuid references public.users(id) on delete set null;

create unique index if not exists admin_members_user_id_uidx
on public.admin_members(user_id)
where user_id is not null;

create table if not exists public.launch_checklist_items (
  id text primary key,
  group_key text not null check (group_key in ('pre_payment', 'mobile_qa')),
  area text,
  label text not null,
  detail text not null,
  note text,
  done boolean not null default false,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.launch_checklist_items
add column if not exists note text;

alter type public.user_status add value if not exists 'limited';

alter table public.platform_settings enable row level security;
alter table public.admin_members enable row level security;
alter table public.launch_checklist_items enable row level security;

drop policy if exists "admins can read platform settings" on public.platform_settings;
create policy "admins can read platform settings"
on public.platform_settings for select
using (public.current_app_user_is_admin());

drop policy if exists "admins can update platform settings" on public.platform_settings;
create policy "admins can update platform settings"
on public.platform_settings for all
using (public.current_app_user_is_admin())
with check (public.current_app_user_is_admin());

drop policy if exists "admins can read admin members" on public.admin_members;
create policy "admins can read admin members"
on public.admin_members for select
using (public.current_app_user_is_admin());

drop policy if exists "owners can manage admin members" on public.admin_members;
create policy "owners can manage admin members"
on public.admin_members for all
using (
  exists (
    select 1
    from public.admin_members
    where id = 'owner'
      and active = true
  )
  and public.current_app_user_is_admin()
)
with check (public.current_app_user_is_admin());

drop policy if exists "admins can read launch checklist" on public.launch_checklist_items;
create policy "admins can read launch checklist"
on public.launch_checklist_items for select
using (public.current_app_user_is_admin());

drop policy if exists "admins can manage launch checklist" on public.launch_checklist_items;
create policy "admins can manage launch checklist"
on public.launch_checklist_items for all
using (public.current_app_user_is_admin())
with check (public.current_app_user_is_admin());

insert into public.platform_settings (key, value_json)
values
  (
    'platform',
    '{
      "bookingFee": 15,
      "commissionPercent": 10,
      "craftsmanMonthlyFee": 30,
      "freeTrialDays": 30,
      "freeCancellationHours": 24,
      "lateCancellationFeePercent": 30,
      "authProvider": "email_password",
      "paymentProvider": "manual_mvp_hold",
      "paymentCurrency": "GEL",
      "productionMode": false
    }'::jsonb
  ),
  (
    'legal',
    '{
      "bookingRules": "ჯავშნისას კლიენტის თანხა დროებით იყინება. ხელოსანს თანხა არ ერიცხება, სანამ სამუშაო პროცესი არ დასრულდება და სტატუსი არ დადასტურდება.",
      "cancellationRules": "უფასო გაუქმება შესაძლებელია ვიზიტამდე მითითებული დროით ადრე. დაგვიანებული გაუქმება ან შეთანხმების დარღვევა აისახება რეიტინგსა და ანგარიშზე.",
      "privacyRules": "ტელეფონის ნომერი და პირადი დეტალები არ ჩანს, სანამ სისტემა კომუნიკაციისთვის უსაფრთხო ეტაპს არ დაადასტურებს. ძირითადი კომუნიკაცია ჩატში რჩება.",
      "supportRules": "დავების დროს Admin ამოწმებს ჯავშნის ისტორიას, მიმოწერას, სტატუსებს და ატვირთულ მტკიცებულებებს."
    }'::jsonb
  )
on conflict (key) do nothing;

insert into public.admin_members (id, name, role, permissions, active)
values
  ('owner', 'მფლობელი', 'owner', array['verification', 'disputes', 'bookings', 'finance', 'users', 'settings', 'audit'], true),
  ('verification', 'ვერიფიკაციის ოპერატორი', 'verification', array['verification', 'audit'], true),
  ('support', 'Support', 'support', array['disputes', 'bookings', 'users', 'audit'], true),
  ('finance', 'ფინანსები', 'finance', array['finance', 'disputes', 'audit'], true)
on conflict (id) do nothing;

insert into public.launch_checklist_items (id, group_key, area, label, detail, done)
values
  ('auth', 'pre_payment', null, 'ავტორიზაცია და პროფილები', 'კლიენტი, ხელოსანი და Admin ცალ-ცალკე შედიან და ინახავენ პროფილს.', true),
  ('booking_flow', 'pre_payment', null, 'ჯავშნის სრული სტატუსები', 'მოლოდინში -> დადასტურებული -> გზაშია -> დაიწყო -> დასრულდა -> დახურული.', true),
  ('chat', 'pre_payment', null, 'ჩატი და წაუკითხავი მესიჯები', 'ჯავშანზე მიბმული მიმოწერა, დრო, თარიღი, ფაილის/ფოტოს ატვირთვა.', true),
  ('verification', 'pre_payment', null, 'ხელოსნის ვერიფიკაცია', 'პირადობის წინა/უკანა მხარე და ანგარიშის დოკუმენტი Admin-ის დასადასტურებლად.', true),
  ('reviews', 'pre_payment', null, 'ორმხრივი შეფასებები', 'კლიენტი აფასებს ხელოსანს, ხელოსანი აფასებს კლიენტს დასრულების შემდეგ.', true),
  ('rules', 'pre_payment', null, 'წესები და cancellation პოლიტიკა', 'კლიენტისა და ხელოსნისთვის გასაგები წესები Admin-იდან სამართავად.', false),
  ('supabase', 'pre_payment', null, 'Supabase API რეჟიმის დასრულება', 'core API ფენები მიბმულია Supabase RPC/storage ნაკადზე.', true),
  ('qa', 'pre_payment', null, 'მობილური QA და სცენარების ტესტი', 'კლიენტი/ხელოსანი/Admin ძირითადი გზები უნდა გაიაროს მობილურზე.', false),
  ('client_booking', 'mobile_qa', 'client', 'კლიენტი ჯავშნის ხელოსანს', 'კლიენტი პოულობს ხელოსანს, ირჩევს დღეს/საათს, ავსებს დეტალებს და ხედავს ჯავშნის სტატუსს.', false),
  ('client_cancel', 'mobile_qa', 'client', 'კლიენტი აუქმებს მიზეზით', 'გაუქმებისას ჩანს გაფრთხილება, მიზეზების არჩევა და ჯავშანი გადადის სწორ სტატუსში.', false),
  ('worker_status_flow', 'mobile_qa', 'craftsman', 'ხელოსანი მართავს სამუშაოს სტატუსებს', 'მოლოდინში -> დადასტურებული -> გზაშია -> დაიწყო -> დასრულდა მუშაობს და refresh-ის შემდეგ არ იკარგება.', false),
  ('chat_unread', 'mobile_qa', 'client', 'ჩატი და unread badge', 'მესიჯი ჩანს ორივე მხარეს, წაკითხვის შემდეგ unread ციფრი ქრება, ფოტო/ფაილი ჩანს სწორად.', false),
  ('mobile_reviews', 'mobile_qa', 'client', 'ორმხრივი შეფასება', 'დასრულების შემდეგ კლიენტი აფასებს ხელოსანს, ხელოსანი აფასებს კლიენტს და ქარდები იხურება.', false),
  ('verification_lock', 'mobile_qa', 'admin', 'ვერიფიკაციამდე ხელოსანი დაბლოკილია', 'დოკუმენტების ატვირთვამდე სამუშაო ადგილი არ იხსნება; Admin ხედავს დოკუმენტებს და ამტკიცებს/უარყოფს.', false),
  ('admin_dispute', 'mobile_qa', 'admin', 'Admin ამუშავებს დავას', 'პრობლემის გახსნისას Admin ხედავს მიზეზს, ჩანაწერს, თანხის სტატუსს და audit log-ს.', false),
  ('mobile_layout', 'mobile_qa', 'mobile', 'მობილური ეკრანი არ იშლება', 'ქვედა მენიუ, ფილტრები, ქარდები, modal-ები და Admin tabs არ ფარავს ტექსტს პატარა ეკრანზე.', false)
on conflict (id) do nothing;

create or replace function public.get_admin_launch_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.current_app_user_is_admin() then
    raise exception 'Only admins can read launch state';
  end if;

  select jsonb_build_object(
    'platformSettings', coalesce((select value_json from public.platform_settings where key = 'platform'), '{}'::jsonb),
    'legalSettings', coalesce((select value_json from public.platform_settings where key = 'legal'), '{}'::jsonb),
    'adminMembers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'name', name,
            'role', role,
            'permissions', permissions,
            'active', active,
            'updatedAt', updated_at
          )
          order by case id when 'owner' then 1 when 'verification' then 2 when 'support' then 3 when 'finance' then 4 else 99 end
        )
        from public.admin_members
      ),
      '[]'::jsonb
    ),
    'prePaymentChecklist', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'label', label,
            'detail', detail,
            'note', note,
            'done', done,
            'updatedAt', updated_at
          )
          order by updated_at, id
        )
        from public.launch_checklist_items
        where group_key = 'pre_payment'
      ),
      '[]'::jsonb
    ),
    'mobileQaScenarios', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'area', area,
            'label', label,
            'detail', detail,
            'note', note,
            'done', done,
            'updatedAt', updated_at
          )
          order by updated_at, id
        )
        from public.launch_checklist_items
        where group_key = 'mobile_qa'
      ),
      '[]'::jsonb
    ),
    'verificationQueue', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'workerId', workers.id,
            'userId', users.id,
            'name', trim(coalesce(users.first_name, '') || ' ' || coalesce(users.last_name, '')),
            'phone', users.phone,
            'city', workers.city,
            'verificationStatus', workers.verification_status,
            'accountStatus', users.status,
            'documents', jsonb_build_object(
              'idFront', (
                select file_url
                from public.verification_documents
                where worker_id = workers.id
                  and type = 'id_front'
                limit 1
              ),
              'idBack', (
                select file_url
                from public.verification_documents
                where worker_id = workers.id
                  and type = 'id_back'
                limit 1
              ),
              'bankAccount', (
                select file_url
                from public.verification_documents
                where worker_id = workers.id
                  and type = 'bank_account'
                limit 1
              )
            ),
            'updatedAt', workers.updated_at
          )
          order by
            case workers.verification_status
              when 'pending' then 1
              when 'rejected' then 2
              when 'not_started' then 3
              else 4
            end,
            workers.updated_at desc
        )
        from public.workers
        join public.users on users.id = workers.user_id
        where workers.verification_status in ('pending', 'verified', 'rejected')
      ),
      '[]'::jsonb
    ),
    'auditLogs', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'action', action,
            'entityType', entity_type,
            'entityId', entity_id,
            'metadata', metadata_json,
            'createdAt', created_at
          )
          order by created_at desc
        )
        from (
          select *
          from public.audit_logs
          order by created_at desc
          limit 80
        ) recent_audit
      ),
      '[]'::jsonb
    )
  )
  into result;

  return result;
end;
$$;

create or replace function public.get_current_admin_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  actor_user public.users%rowtype;
  member public.admin_members%rowtype;
  metadata_member_id text := auth.jwt() -> 'user_metadata' ->> 'admin_member_id';
  linked_member_count integer;
begin
  if actor is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into actor_user
  from public.users
  where id = actor;

  if actor_user.id is null or actor_user.role <> 'admin'::public.user_role or actor_user.status <> 'active'::public.user_status then
    raise exception 'Current user is not an active admin';
  end if;

  select *
  into member
  from public.admin_members
  where user_id = actor
    and active = true
  limit 1;

  if member.id is null and metadata_member_id is not null then
    select *
    into member
    from public.admin_members
    where id = metadata_member_id
      and active = true
    limit 1;
  end if;

  select count(*)
  into linked_member_count
  from public.admin_members
  where user_id is not null
    and active = true;

  if member.id is null and linked_member_count = 0 then
    select *
    into member
    from public.admin_members
    where id = 'owner'
      and active = true
    limit 1;
  end if;

  if member.id is null then
    raise exception 'Admin member is not linked to this session';
  end if;

  return jsonb_build_object(
    'appUser', jsonb_build_object(
      'id', actor_user.id,
      'phone', actor_user.phone,
      'firstName', actor_user.first_name,
      'lastName', actor_user.last_name,
      'status', actor_user.status
    ),
    'member', jsonb_build_object(
      'id', member.id,
      'name', member.name,
      'role', member.role,
      'permissions', member.permissions,
      'active', member.active,
      'linkedUserId', member.user_id
    )
  );
end;
$$;

create or replace function public.save_admin_platform_settings(
  p_platform_settings jsonb,
  p_legal_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
begin
  if not public.current_admin_has_permission('settings') then
    raise exception 'Only admins can update platform settings';
  end if;

  insert into public.platform_settings (key, value_json, updated_by, updated_at)
  values ('platform', p_platform_settings, actor, now())
  on conflict (key) do update
  set value_json = excluded.value_json,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.platform_settings (key, value_json, updated_by, updated_at)
  values ('legal', p_legal_settings, actor, now())
  on conflict (key) do update
  set value_json = excluded.value_json,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.audit_logs (actor_id, action, entity_type, metadata_json)
  values (
    actor,
    'platform_settings_updated',
    'platform_settings',
    jsonb_build_object('platformSettings', p_platform_settings, 'legalSettings', p_legal_settings)
  );

  return public.get_admin_launch_state();
end;
$$;

grant execute on function public.save_admin_platform_settings(jsonb, jsonb)
to authenticated;

grant execute on function public.get_current_admin_context()
to authenticated;

create or replace function public.current_admin_has_permission(
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  metadata_member_id text := auth.jwt() -> 'user_metadata' ->> 'admin_member_id';
  linked_member_count integer;
begin
  if not public.current_app_user_is_admin() then
    return false;
  end if;

  if exists (
    select 1
    from public.admin_members
    where user_id = actor
      and active = true
      and (role = 'owner' or p_permission = any(permissions))
  ) then
    return true;
  end if;

  if metadata_member_id is not null and exists (
    select 1
    from public.admin_members
    where id = metadata_member_id
      and active = true
      and (role = 'owner' or p_permission = any(permissions))
  ) then
    return true;
  end if;

  select count(*)
  into linked_member_count
  from public.admin_members
  where user_id is not null
    and active = true;

  return linked_member_count = 0
    and exists (
      select 1
      from public.admin_members
      where id = 'owner'
        and active = true
        and (role = 'owner' or p_permission = any(permissions))
    );
end;
$$;

grant execute on function public.current_admin_has_permission(text)
to authenticated;

create or replace function public.update_admin_member_state(
  p_id text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
begin
  if not public.current_admin_has_permission('settings') then
    raise exception 'Only admins can update admin members';
  end if;

  update public.admin_members
  set active = p_active,
      updated_by = actor,
      updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'Admin member not found: %', p_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, metadata_json)
  values (
    actor,
    'admin_member_updated',
    'admin_member',
    jsonb_build_object('id', p_id, 'active', p_active)
  );

  return public.get_admin_launch_state();
end;
$$;

drop function if exists public.update_launch_checklist_item(text, boolean);
drop function if exists public.update_launch_checklist_item(text, boolean, text);

create or replace function public.update_launch_checklist_item(
  p_id text,
  p_done boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
begin
  if not public.current_admin_has_permission('settings') then
    raise exception 'Only admins can update launch checklist';
  end if;

  update public.launch_checklist_items
  set done = p_done,
      note = coalesce(p_note, note),
      updated_by = actor,
      updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'Checklist item not found: %', p_id;
  end if;

  update public.launch_checklist_items
  set done = (
        select bool_and(done)
        from public.launch_checklist_items
        where group_key = 'mobile_qa'
      ),
      updated_by = actor,
      updated_at = now()
  where id = 'qa'
    and exists (
      select 1
      from public.launch_checklist_items
      where id = p_id
        and group_key = 'mobile_qa'
    );

  insert into public.audit_logs (actor_id, action, entity_type, metadata_json)
  values (
    actor,
    'launch_checklist_updated',
    'launch_checklist_item',
    jsonb_build_object('id', p_id, 'done', p_done, 'note', p_note)
  );

  return public.get_admin_launch_state();
end;
$$;

create or replace function public.update_admin_account_status(
  p_target_role text,
  p_phone text,
  p_status text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  target_user_id uuid;
  target_role public.user_role;
  status_value public.user_status;
  normalized_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if not public.current_admin_has_permission('users') then
    raise exception 'Only admins can update account status';
  end if;

  if p_target_role not in ('client', 'craftsman') then
    raise exception 'Unsupported account role: %', p_target_role;
  end if;

  if p_status not in ('active', 'limited', 'blocked') then
    raise exception 'Unsupported account status: %', p_status;
  end if;

  if normalized_phone = '' then
    raise exception 'Phone is required';
  end if;

  target_role := p_target_role::public.user_role;
  status_value := p_status::public.user_status;

  select id
  into target_user_id
  from public.users
  where role = target_role
    and regexp_replace(phone, '\D', '', 'g') = normalized_phone
  order by case when phone = p_phone then 0 else 1 end, created_at desc
  limit 1;

  if target_user_id is null then
    raise exception 'User not found for role % and phone %', p_target_role, p_phone;
  end if;

  update public.users
  set status = status_value,
      updated_at = now()
  where id = target_user_id;

  if target_role = 'craftsman'::public.user_role then
    update public.workers
    set is_active = (
          status_value = 'active'::public.user_status
          and verification_status = 'verified'::public.worker_verification_status
        ),
        updated_at = now()
    where user_id = target_user_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata_json)
  values (
    actor,
    case
      when target_role = 'client'::public.user_role then 'client_status_changed'
      else 'craftsman_status_changed'
    end,
    'user',
    target_user_id,
    jsonb_build_object(
      'summary',
      case
        when target_role = 'client'::public.user_role then 'კლიენტის სტატუსი შეიცვალა'
        else 'ხელოსნის სტატუსი შეიცვალა'
      end || ': ' || p_status,
      'role',
      p_target_role,
      'phone',
      p_phone,
      'status',
      p_status,
      'adminNote',
      nullif(trim(coalesce(p_admin_note, '')), '')
    )
  );

  return public.get_admin_launch_state();
end;
$$;

create or replace function public.admin_update_booking_action(
  p_booking_id uuid,
  p_action text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  target_booking public.bookings%rowtype;
  target_payment_id uuid;
  next_booking_status public.booking_status;
  next_payment_status public.payment_status;
  audit_action text;
  summary text;
  note_text text := nullif(trim(coalesce(p_admin_note, '')), '');
begin
  if not public.current_app_user_is_admin() then
    raise exception 'Only admins can update booking actions';
  end if;

  if p_action in ('close_release', 'cancel_refund', 'hold_authorized')
    and not public.current_admin_has_permission('finance') then
    raise exception 'Finance permission is required for this booking action';
  end if;

  if p_action = 'mark_disputed'
    and not (
      public.current_admin_has_permission('bookings')
      or public.current_admin_has_permission('disputes')
    ) then
    raise exception 'Bookings or disputes permission is required for this booking action';
  end if;

  if p_action not in ('close_release', 'cancel_refund', 'mark_disputed', 'hold_authorized') then
    raise exception 'Unsupported admin booking action: %', p_action;
  end if;

  select *
  into target_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if target_booking.id is null then
    raise exception 'Booking not found';
  end if;

  if p_action = 'close_release' then
    next_booking_status := 'closed'::public.booking_status;
    next_payment_status := 'captured'::public.payment_status;
    audit_action := 'booking_closed';
    summary := 'Admin-მა ჯავშანი დახურა და თანხა ხელოსანზე გაუშვა';
  elsif p_action = 'cancel_refund' then
    next_booking_status := 'cancelled'::public.booking_status;
    next_payment_status := 'refunded'::public.payment_status;
    audit_action := 'booking_refunded';
    summary := 'Admin-მა ჯავშანი გააუქმა და თანხა დააბრუნა';
  elsif p_action = 'hold_authorized' then
    next_booking_status := target_booking.status;
    next_payment_status := 'authorized'::public.payment_status;
    audit_action := 'payment_status_changed';
    summary := 'Admin-მა თანხა დაბლოკილ მდგომარეობაში დააბრუნა';
  else
    next_booking_status := 'disputed'::public.booking_status;
    next_payment_status := target_booking.payment_status;
    audit_action := 'payment_status_changed';
    summary := 'Admin-მა ჯავშანი დავაში დატოვა';
  end if;

  update public.bookings
  set status = next_booking_status,
      cancellation_reason = case
        when next_booking_status = 'cancelled'::public.booking_status
          then coalesce(note_text, cancellation_reason)
        else cancellation_reason
      end,
      updated_at = now()
  where id = p_booking_id;

  select id
  into target_payment_id
  from public.payments
  where booking_id = p_booking_id
  order by created_at desc
  limit 1;

  if target_payment_id is not null and p_action <> 'mark_disputed' then
    update public.payments
    set status = next_payment_status
    where id = target_payment_id;
  end if;

  if p_action = 'mark_disputed' then
    insert into public.disputes (booking_id, opened_by, reason, details, status, admin_note)
    select
      p_booking_id,
      actor,
      'Admin ჩარევა',
      coalesce(note_text, 'Admin-მა ჯავშანი დავაში დატოვა'),
      'reviewing',
      note_text
    where not exists (
      select 1
      from public.disputes
      where booking_id = p_booking_id
        and status <> 'resolved'
    );
  end if;

  if p_action in ('mark_disputed', 'hold_authorized') then
    perform public.notify_user(
      target_booking.client_id,
      p_booking_id,
      'admin_booking_action',
      'Admin-მა ჯავშანი განაახლა',
      coalesce(note_text, summary)
    );

    perform public.notify_user(
      (select user_id from public.workers where id = target_booking.worker_id),
      p_booking_id,
      'admin_booking_action',
      'Admin-მა ჯავშანი განაახლა',
      coalesce(note_text, summary)
    );
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata_json)
  values (
    actor,
    audit_action,
    'booking',
    p_booking_id,
    jsonb_build_object(
      'summary',
      summary,
      'action',
      p_action,
      'bookingStatus',
      next_booking_status,
      'paymentStatus',
      next_payment_status,
      'adminNote',
      note_text
    )
  );

  return public.get_admin_launch_state();
end;
$$;

create or replace function public.admin_mark_dispute_reviewing(
  p_dispute_id uuid,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  target_dispute public.disputes%rowtype;
  target_booking public.bookings%rowtype;
  note_text text := nullif(trim(coalesce(p_admin_note, '')), '');
begin
  if not public.current_admin_has_permission('disputes') then
    raise exception 'Only admins can review disputes';
  end if;

  select *
  into target_dispute
  from public.disputes
  where id = p_dispute_id
  for update;

  if target_dispute.id is null then
    raise exception 'Dispute not found';
  end if;

  select *
  into target_booking
  from public.bookings
  where id = target_dispute.booking_id;

  update public.disputes
  set status = 'reviewing',
      admin_note = coalesce(note_text, admin_note)
  where id = p_dispute_id;

  insert into public.notifications (user_id, booking_id, type, title, body)
  values
    (
      target_booking.client_id,
      target_booking.id,
      'dispute_reviewing',
      'დავა გადავიდა განხილვაში',
      coalesce(note_text, 'Admin ამოწმებს დავის დეტალებს.')
    ),
    (
      (select user_id from public.workers where id = target_booking.worker_id),
      target_booking.id,
      'dispute_reviewing',
      'დავა გადავიდა განხილვაში',
      coalesce(note_text, 'Admin ამოწმებს დავის დეტალებს.')
    );

  insert into public.messages (booking_id, sender_id, text)
  values (
    target_booking.id,
    actor,
    'დავა გადავიდა განხილვაში. ' || coalesce(note_text, 'Admin ამოწმებს დეტალებს.')
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata_json)
  values (
    actor,
    'dispute_reviewing',
    'dispute',
    p_dispute_id,
    jsonb_build_object(
      'summary',
      'Admin-მა დავა განხილვაში გადაიყვანა',
      'bookingId',
      target_dispute.booking_id,
      'adminNote',
      note_text
    )
  );

  return public.get_admin_launch_state();
end;
$$;

create or replace function public.admin_resolve_dispute_action(
  p_dispute_id uuid,
  p_resolution text,
  p_admin_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  target_dispute public.disputes%rowtype;
  target_booking public.bookings%rowtype;
  next_booking_status public.booking_status;
  next_payment_status public.payment_status;
  audit_action text;
  summary text;
  note_text text := nullif(trim(coalesce(p_admin_note, '')), '');
  target_payment_id uuid;
begin
  if not public.current_admin_has_permission('disputes') then
    raise exception 'Only admins can resolve disputes';
  end if;

  if p_resolution in ('refund_client', 'release_worker')
    and not public.current_admin_has_permission('finance') then
    raise exception 'Finance permission is required for money dispute resolution';
  end if;

  if p_resolution not in ('refund_client', 'release_worker', 'warning') then
    raise exception 'Unsupported dispute resolution: %', p_resolution;
  end if;

  if note_text is null then
    raise exception 'Admin note is required to resolve a dispute';
  end if;

  select *
  into target_dispute
  from public.disputes
  where id = p_dispute_id
  for update;

  if target_dispute.id is null then
    raise exception 'Dispute not found';
  end if;

  select *
  into target_booking
  from public.bookings
  where id = target_dispute.booking_id
  for update;

  if p_resolution = 'refund_client' then
    next_booking_status := 'cancelled'::public.booking_status;
    next_payment_status := 'refunded'::public.payment_status;
    audit_action := 'dispute_refunded';
    summary := 'დავა დაიხურა კლიენტისთვის თანხის დაბრუნებით';
  elsif p_resolution = 'release_worker' then
    next_booking_status := 'closed'::public.booking_status;
    next_payment_status := 'captured'::public.payment_status;
    audit_action := 'dispute_released';
    summary := 'დავა დაიხურა ხელოსანზე თანხის გაშვებით';
  else
    next_booking_status := target_booking.status;
    next_payment_status := target_booking.payment_status;
    audit_action := 'dispute_warning';
    summary := 'დავა დაიხურა გაფრთხილებით';
  end if;

  update public.disputes
  set status = 'resolved',
      admin_note = note_text,
      resolved_at = now()
  where id = p_dispute_id;

  update public.bookings
  set status = next_booking_status,
      payment_status = next_payment_status,
      cancellation_reason = case
        when next_booking_status = 'cancelled'::public.booking_status
          then note_text
        else cancellation_reason
      end,
      updated_at = now()
  where id = target_booking.id;

  select id
  into target_payment_id
  from public.payments
  where booking_id = target_booking.id
  order by created_at desc
  limit 1;

  if target_payment_id is not null and p_resolution <> 'warning' then
    update public.payments
    set status = next_payment_status
    where id = target_payment_id;
  end if;

  insert into public.notifications (user_id, booking_id, type, title, body)
  values
    (
      target_booking.client_id,
      target_booking.id,
      'dispute_resolved',
      'დავა დაიხურა',
      summary || '. Admin ჩანაწერი: ' || note_text
    ),
    (
      (select user_id from public.workers where id = target_booking.worker_id),
      target_booking.id,
      'dispute_resolved',
      'დავა დაიხურა',
      summary || '. Admin ჩანაწერი: ' || note_text
    );

  insert into public.messages (booking_id, sender_id, text)
  values (
    target_booking.id,
    actor,
    summary || '. Admin ჩანაწერი: ' || note_text
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata_json)
  values (
    actor,
    audit_action,
    'dispute',
    p_dispute_id,
    jsonb_build_object(
      'summary',
      summary,
      'bookingId',
      target_booking.id,
      'resolution',
      p_resolution,
      'bookingStatus',
      next_booking_status,
      'paymentStatus',
      next_payment_status,
      'adminNote',
      note_text
    )
  );

  return public.get_admin_launch_state();
end;
$$;

grant execute on function public.admin_update_booking_action(uuid, text, text)
to authenticated;

grant execute on function public.admin_mark_dispute_reviewing(uuid, text)
to authenticated;

grant execute on function public.admin_resolve_dispute_action(uuid, text, text)
to authenticated;

create or replace function public.admin_review_worker_verification(
  p_worker_id uuid,
  p_status text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  target_worker public.workers%rowtype;
  target_user public.users%rowtype;
  required_documents_count integer;
  note_text text := nullif(trim(coalesce(p_admin_note, '')), '');
  next_verification_status public.worker_verification_status;
  audit_action text;
begin
  if not public.current_admin_has_permission('verification') then
    raise exception 'Only admins can review worker verification';
  end if;

  if p_status not in ('verified', 'rejected') then
    raise exception 'Unsupported verification status: %', p_status;
  end if;

  if p_status = 'rejected' and note_text is null then
    raise exception 'Admin note is required when rejecting verification';
  end if;

  select *
  into target_worker
  from public.workers
  where id = p_worker_id
  for update;

  if target_worker.id is null then
    raise exception 'Worker not found';
  end if;

  select *
  into target_user
  from public.users
  where id = target_worker.user_id
  for update;

  select count(*)
  into required_documents_count
  from public.verification_documents
  where worker_id = p_worker_id
    and type in ('id_front', 'id_back', 'bank_account');

  if p_status = 'verified' and required_documents_count < 3 then
    raise exception 'All three verification documents are required';
  end if;

  next_verification_status := p_status::public.worker_verification_status;
  audit_action := case
    when next_verification_status = 'verified'::public.worker_verification_status
      then 'verification_approved'
    else 'verification_rejected'
  end;

  update public.verification_documents
  set status = case
        when next_verification_status = 'verified'::public.worker_verification_status
          then 'approved'::public.document_status
        else 'rejected'::public.document_status
      end,
      reviewed_by = actor,
      reviewed_at = now()
  where worker_id = p_worker_id;

  update public.workers
  set verification_status = next_verification_status,
      is_active = next_verification_status = 'verified'::public.worker_verification_status,
      updated_at = now()
  where id = p_worker_id;

  update public.users
  set status = case
        when next_verification_status = 'verified'::public.worker_verification_status
          then 'active'::public.user_status
        else 'pending'::public.user_status
      end,
      updated_at = now()
  where id = target_worker.user_id;

  insert into public.notifications (user_id, type, title, body)
  values (
    target_worker.user_id,
    'verification_reviewed',
    case
      when next_verification_status = 'verified'::public.worker_verification_status
        then 'ვერიფიკაცია დადასტურდა'
      else 'ვერიფიკაცია უარყოფილია'
    end,
    coalesce(
      note_text,
      case
        when next_verification_status = 'verified'::public.worker_verification_status
          then 'თქვენი პროფილი დადასტურდა და სამუშაოების მიღება შეგიძლიათ.'
        else 'დოკუმენტები ხელახლაა გადასამოწმებელი.'
      end
    )
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata_json)
  values (
    actor,
    audit_action,
    'worker',
    p_worker_id,
    jsonb_build_object(
      'summary',
      case
        when next_verification_status = 'verified'::public.worker_verification_status
          then 'ხელოსნის ვერიფიკაცია დადასტურდა'
        else 'ხელოსნის ვერიფიკაცია უარყოფილია'
      end,
      'workerId',
      p_worker_id,
      'userId',
      target_worker.user_id,
      'phone',
      target_user.phone,
      'verificationStatus',
      next_verification_status,
      'adminNote',
      note_text
    )
  );

  return public.get_admin_launch_state();
end;
$$;

grant execute on function public.admin_review_worker_verification(uuid, text, text)
to authenticated;

create or replace function public.list_admin_bookings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not (
    public.current_admin_has_permission('bookings')
    or public.current_admin_has_permission('finance')
    or public.current_admin_has_permission('disputes')
  ) then
    raise exception 'Only admins can list all bookings';
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
      'booking_fee_amount', b.booking_fee_amount,
      'payment_status', b.payment_status,
      'cancellation_reason', b.cancellation_reason,
      'client', jsonb_build_object(
        'id', cu.id,
        'first_name', cu.first_name,
        'last_name', cu.last_name,
        'last_initial', case
          when cu.last_name is null or cu.last_name = '' then ''
          else left(cu.last_name, 1) || '.'
        end,
        'phone', cu.phone,
        'rating_avg', cu.rating_avg,
        'rating_count', cu.rating_count,
        'status', cu.status
      ),
      'worker', jsonb_build_object(
        'id', w.id,
        'user_id', wu.id,
        'name', coalesce(
          nullif(w.display_name, ''),
          nullif(trim(coalesce(wu.first_name, '') || ' ' || coalesce(wu.last_name, '')), ''),
          'ხელოსანი'
        ),
        'phone', wu.phone,
        'role', coalesce(p.name, 'ხელოსანი'),
        'avatar_url', wu.photo_url,
        'rating_avg', wu.rating_avg,
        'rating_count', wu.rating_count,
        'city', w.city,
        'about', w.about,
        'price_type', w.price_type,
        'price_min', w.price_min,
        'price_max', w.price_max,
        'verification_status', w.verification_status,
        'is_active', w.is_active,
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
      'active_dispute', (
        select jsonb_build_object(
          'id', d.id,
          'reason', d.reason,
          'details', d.details,
          'evidence', coalesce(d.evidence, '[]'::jsonb),
          'status', d.status,
          'admin_note', d.admin_note,
          'created_at', d.created_at,
          'resolved_at', d.resolved_at
        )
        from public.disputes d
        where d.booking_id = b.id
        order by case when d.status <> 'resolved' then 0 else 1 end, d.created_at desc
        limit 1
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
        'extra_measurements', bd.extra_measurements,
        'uploaded_photo_url', bd.uploaded_photo_url
      )
    ) as item
    from public.bookings b
    join public.users cu on cu.id = b.client_id
    join public.workers w on w.id = b.worker_id
    join public.users wu on wu.id = w.user_id
    left join public.professions p on p.id = b.profession_id
    left join public.booking_details bd on bd.booking_id = b.id
  ) rows;

  return result;
end;
$$;

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
    join public.users cu on cu.id = b.client_id
    join public.workers w on w.id = b.worker_id
    join public.users wu on wu.id = w.user_id
    left join public.professions p on p.id = b.profession_id
  ) rows;

  return result;
end;
$$;

grant execute on function public.list_admin_bookings()
to authenticated;

grant execute on function public.list_admin_disputes()
to authenticated;

create or replace function public.list_admin_users()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.current_admin_has_permission('users') then
    raise exception 'Only admins can list users';
  end if;

  select coalesce(jsonb_agg(item order by (item ->> 'created_at') desc), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'id', u.id,
      'role', u.role,
      'first_name', u.first_name,
      'last_name', u.last_name,
      'phone', u.phone,
      'photo_url', u.photo_url,
      'city', coalesce(w.city, null),
      'status', u.status,
      'rating_avg', u.rating_avg,
      'rating_count', u.rating_count,
      'worker_id', w.id,
      'worker_role', coalesce(p.name, 'ხელოსანი'),
      'verification_status', w.verification_status,
      'is_worker_active', w.is_active,
      'created_at', u.created_at,
      'last_login_at', u.last_login_at,
      'stats', jsonb_build_object(
        'total', coalesce(stats.total, 0),
        'active', coalesce(stats.active, 0),
        'disputed', coalesce(stats.disputed, 0),
        'cancelled', coalesce(stats.cancelled, 0),
        'completed', coalesce(stats.completed, 0),
        'amount', coalesce(stats.amount, 0),
        'last_activity', stats.last_activity
      )
    ) as item
    from public.users u
    left join public.workers w on w.user_id = u.id
    left join public.professions p on p.id = w.main_profession_id
    left join lateral (
      select
        count(*)::integer as total,
        count(*) filter (
          where b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
        )::integer as active,
        count(*) filter (where b.status = 'disputed')::integer as disputed,
        count(*) filter (where b.status = 'cancelled')::integer as cancelled,
        count(*) filter (
          where b.status in ('closed', 'client_confirmed', 'declined')
        )::integer as completed,
        coalesce(sum(b.booking_fee_amount), 0) as amount,
        max(b.scheduled_at) as last_activity
      from public.bookings b
      where (
        u.role = 'client'::public.user_role
        and b.client_id = u.id
      )
      or (
        u.role = 'craftsman'::public.user_role
        and b.worker_id = w.id
      )
    ) stats on true
    where u.role in ('client', 'craftsman')
  ) rows;

  return result;
end;
$$;

grant execute on function public.list_admin_users()
to authenticated;
