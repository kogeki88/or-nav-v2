-- 0004: fault reports sent from the Admin view ("Send report"), so faults can be read and fixed.
-- Apply by hand in the Supabase SQL editor. A report holds check lines and scrubbed error text only:
-- the app never puts omnibar message text or patient information in it.

create table if not exists public.fault_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  app_version text not null,
  build text not null,
  checks jsonb not null default '[]',
  entries jsonb not null default '[]',
  constraint fault_reports_size check (pg_column_size(entries) < 2000000)
);

create index if not exists fault_reports_sent on public.fault_reports (sent_at desc);

alter table public.fault_reports enable row level security;

-- Anyone signed in may send a report, only as themselves.
drop policy if exists "send own report" on public.fault_reports;
create policy "send own report" on public.fault_reports for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Only admins read reports.
drop policy if exists "admins read reports" on public.fault_reports;
create policy "admins read reports" on public.fault_reports for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- Reports are never changed or removed from the app.
revoke update, delete on public.fault_reports from anon, authenticated;
revoke all on public.fault_reports from anon;

-- Check: should list 2 policies.
select policyname, cmd from pg_policies where tablename = 'fault_reports';
