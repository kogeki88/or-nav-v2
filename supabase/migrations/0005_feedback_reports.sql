-- 0005: feedback reports sent by admins from the floating feedback button (ticket #19).
-- Apply by hand in the Supabase SQL editor. Status changes and screenshots come later (tickets #22-#23),
-- from the PC with the service key.

create table if not exists public.feedback_reports (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz not null default now(),
  app_version text not null,
  page text not null check (char_length(page) <= 200),
  tag text not null check (tag in ('broken', 'looks_wrong', 'idea')),
  message text not null check (char_length(message) between 1 and 2000),
  screenshot_path text,
  status text not null default 'new' check (status in ('new', 'ticket_made', 'fixed', 'wont_fix')),
  ticket integer
);

create index if not exists feedback_reports_created on public.feedback_reports (created_at desc);

alter table public.feedback_reports enable row level security;

-- An admin may send a report, only as themselves.
drop policy if exists "admin sends own feedback" on public.feedback_reports;
create policy "admin sends own feedback" on public.feedback_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- Only admins read reports.
drop policy if exists "admins read feedback" on public.feedback_reports;
create policy "admins read feedback" on public.feedback_reports for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- Reports are never changed or removed from the app.
revoke update, delete on public.feedback_reports from anon, authenticated;
revoke all on public.feedback_reports from anon;

-- Check: should list 2 policies (insert and select), and no update or delete.
select policyname, cmd from pg_policies where tablename = 'feedback_reports';
