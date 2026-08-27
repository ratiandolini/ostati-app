-- Remonter hotfix: client job-post gallery (up to three photos) and client cancellation.
-- Run after marketplace_growth.sql in Supabase SQL Editor.

alter table public.job_posts
  add column if not exists photo_urls jsonb not null default '[]'::jsonb;

update public.job_posts
set photo_urls = jsonb_build_array(photo_url)
where photo_url is not null
  and photo_url <> ''
  and photo_urls = '[]'::jsonb;

create or replace function public.cancel_my_job_post(p_job_post_id uuid)
returns public.job_posts
language plpgsql
security invoker
set search_path = public
as $$
declare result public.job_posts;
begin
  update public.job_posts
  set status = 'cancelled', updated_at = now()
  where id = p_job_post_id
    and client_id = public.current_app_user_id()
    and status = 'open'
  returning * into result;

  if not found then
    raise exception 'Only an open request created by you can be cancelled';
  end if;

  update public.job_post_interests
  set status = 'withdrawn'
  where job_post_id = p_job_post_id
    and status = 'pending';

  return result;
end;
$$;

grant execute on function public.cancel_my_job_post(uuid) to authenticated;

-- Keep the public gallery bucket constrained to the authenticated user's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-post-photos', 'job-post-photos', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated users can upload job post photos" on storage.objects;
create policy "authenticated users can upload job post photos"
on storage.objects for insert
with check (
  bucket_id = 'job-post-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own job post photos" on storage.objects;
create policy "authenticated users can update own job post photos"
on storage.objects for update
using (
  bucket_id = 'job-post-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'job-post-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
