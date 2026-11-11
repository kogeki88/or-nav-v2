-- 0005: feedback reports from the admins' floating feedback button (spec #18, ticket #19).
-- Apply by hand in the Supabase SQL editor. The phone makes each report's id (a later offline queue
-- can keep one id per report). Status and ticket change only from the PC with the service key, never the app.

create table if not exists public.feedback_reports (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null,
  sent_at timestamptz not null default now(),
  app_version text not null,
  page text not null,
  tag text not null check (tag in ('broken', 'looks_wrong', 'idea')),
  message text not null check (char_length(message) between 1 and 4000),
  screenshot_path text,
  status text not null default 'new' check (status in ('new', 'ticket_made', 'fixed', 'wont_fix')),
  ticket integer
);

create index if not exists feedback_reports_created on public.feedback_reports (created_at desc);

alter table public.feedback_reports enable row level security;

-- Only admins send, and only as themselves. A new report always starts as "new" with no ticket.
drop policy if exists "admins send own feedback" on public.feedback_reports;
create policy "admins send own feedback" on public.feedback_reports for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    and status = 'new'
    and ticket is null
  );

-- Only admins read reports.
drop policy if exists "admins read feedback" on public.feedback_reports;
create policy "admins read feedback" on public.feedback_reports for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- Reports are never changed or removed from the app.
revoke update, delete on public.feedback_reports from anon, authenticated;
revoke all on public.feedback_reports from anon;

-- Check: should list 2 policies (INSERT and SELECT).
select policyname, cmd from pg_policies where tablename = 'feedback_reports';
