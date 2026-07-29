insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  (
    'profile-photos',
    'profile-photos',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'verification-documents',
    'verification-documents',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'booking-photos',
    'booking-photos',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'worker-portfolio',
    'worker-portfolio',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'chat-attachments',
    'chat-attachments',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read public profile and portfolio files"
on storage.objects;

create policy "public can read public profile and portfolio files"
on storage.objects for select
using (bucket_id in ('profile-photos', 'worker-portfolio'));

drop policy if exists "authenticated users can upload profile photos"
on storage.objects;

create policy "authenticated users can upload profile photos"
on storage.objects for insert
with check (
  bucket_id = 'profile-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own profile photos"
on storage.objects;

create policy "authenticated users can update own profile photos"
on storage.objects for update
using (
  bucket_id = 'profile-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can upload booking photos"
on storage.objects;

create policy "authenticated users can upload booking photos"
on storage.objects for insert
with check (
  bucket_id = 'booking-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can upload chat attachments"
on storage.objects;

create policy "authenticated users can upload chat attachments"
on storage.objects for insert
with check (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own chat attachments"
on storage.objects;

create policy "authenticated users can update own chat attachments"
on storage.objects for update
using (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can upload verification documents"
on storage.objects;

create policy "authenticated users can upload verification documents"
on storage.objects for insert
with check (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own verification documents"
on storage.objects;

create policy "authenticated users can update own verification documents"
on storage.objects for update
using (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can read own private files by folder"
on storage.objects;

create policy "users can read own private files by folder"
on storage.objects for select
using (
  bucket_id in ('verification-documents', 'booking-photos', 'chat-attachments')
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "admins can read verification documents"
on storage.objects;

create policy "admins can read verification documents"
on storage.objects for select
using (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and public.current_app_user_is_admin()
);

drop policy if exists "booking parties can read private booking files"
on storage.objects;

create policy "booking parties can read private booking files"
on storage.objects for select
using (
  auth.role() = 'authenticated'
  and (
    (
      bucket_id = 'chat-attachments'
      and exists (
        select 1
        from public.messages m
        where public.user_can_access_booking(m.booking_id)
          and m.attachment_url is not null
          and (
            m.attachment_url = storage.objects.name
            or m.attachment_url like '%' || storage.objects.name
          )
      )
    )
    or (
      bucket_id = 'booking-photos'
      and exists (
        select 1
        from public.booking_details bd
        where public.user_can_access_booking(bd.booking_id)
          and bd.uploaded_photo_url is not null
          and (
            bd.uploaded_photo_url = storage.objects.name
            or bd.uploaded_photo_url like '%' || storage.objects.name
          )
      )
    )
  )
);
