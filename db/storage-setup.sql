-- ============================================================
--  Ikbel Coaching — create the 'photos' bucket + its policies
--  (does what SETUP.md steps 3 & 4 do, in one run)
-- ============================================================

-- 1. create the private bucket (id and name both 'photos')
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- 2. policies: files are stored as <client_id>/<filename>

-- client can upload into their own folder
drop policy if exists photos_upload on storage.objects;
create policy photos_upload on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- read: owner, or the coach of that client
drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.coaches( ((storage.foldername(name))[1])::uuid )
    )
  );

-- client can delete their own photos
drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
