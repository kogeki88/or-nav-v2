-- 0003: daily omnibar message count per person, so the AI bill stays small.
-- Apply by hand in the Supabase SQL editor. Users never write this table directly:
-- only public.use_ai_quota() changes it, and it always acts on the caller's own row.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.ai_usage from anon, authenticated;

-- Counts one message for the caller and returns how many are left today.
-- Raises 'daily limit reached' when the caller is over the limit (the message is not counted then).
create or replace function public.use_ai_quota(p_limit int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  used int;
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then raise exception 'bad limit'; end if;

  insert into public.ai_usage (user_id, day, count) values (me, today, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into used;

  if used > p_limit then
    raise exception 'daily limit reached'; -- the error undoes this call's +1
  end if;
  return p_limit - used;
end;
$$;

revoke all on function public.use_ai_quota(int) from public, anon;
grant execute on function public.use_ai_quota(int) to authenticated;
