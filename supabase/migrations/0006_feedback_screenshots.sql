-- 0006: private bucket for feedback report screenshots (spec #18, ticket #23).
-- Apply by hand in the Supabase SQL editor. Path: <user id>/<report id>.jpg, so a retry overwrites
-- the same picture instead of making a second one. The PC dashboard reads with the service key.

insert into storage.buckets (id, name, public)
values ('feedback-screenshots', 'feedback-screenshots', false)
on conflict (id) do update set public = false;

-- Admins upload only into their own user id folder.
drop policy if exists "admins upload own feedback screenshots" on storage.objects;
create policy "admins upload own feedback screenshots" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

-- A retry may overwrite the admin's own picture (upsert needs update).
drop policy if exists "admins replace own feedback screenshots" on storage.objects;
create policy "admins replace own feedback screenshots" on storage.objects for update to authenticated
  using (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Admins read the screenshots.
drop policy if exists "admins read feedback screenshots" on storage.objects;
create policy "admins read feedback screenshots" on storage.objects for select to authenticated
  using (
    bucket_id = 'feedback-screenshots'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Check: should show one row with public = false, then 3 policies (INSERT, UPDATE, SELECT).
select id, public from storage.buckets where id = 'feedback-screenshots';
select policyname, cmd from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname like '%feedback screenshots%';
