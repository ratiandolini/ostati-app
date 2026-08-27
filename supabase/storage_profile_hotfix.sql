-- Remonter hotfix: authenticated profile and verification uploads.
-- Run this once when profile or verification uploads are rejected with RLS/Unauthorized.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos', 'profile-photos', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('verification-documents', 'verification-documents', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated users can upload profile photos" on storage.objects;
create policy "authenticated users can upload profile photos"
on storage.objects for insert
with check (
  bucket_id = 'profile-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own profile photos" on storage.objects;
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

drop policy if exists "authenticated users can upload verification documents" on storage.objects;
create policy "authenticated users can upload verification documents"
on storage.objects for insert
with check (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own verification documents" on storage.objects;
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

drop policy if exists "users can read own private files by folder" on storage.objects;
create policy "users can read own private files by folder"
on storage.objects for select
using (
  bucket_id in ('verification-documents', 'booking-photos', 'chat-attachments')
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "admins can read verification documents" on storage.objects;
create policy "admins can read verification documents"
on storage.objects for select
using (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and public.current_app_user_is_admin()
);
