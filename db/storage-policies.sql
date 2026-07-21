-- ============================================================
--  Ikbel Coaching — Storage policies for the 'photos' bucket
--  Run this AFTER you've created a bucket named exactly: photos
--  (Supabase → Storage → New bucket → name "photos", keep it PRIVATE)
--
--  Files are stored as:  <client_id>/<filename>
--  so the first folder in the path IS the owner's user id.
-- ============================================================

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
