-- OR-Nav profiles: first sign-in questionnaire answers. Applied in the Supabase SQL editor (project OR-NAV).
-- Each user reads and writes only their own row; admins (app_metadata.role = 'admin') can read all rows.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 100),
  nickname text check (char_length(nickname) <= 40),
  facility text not null check (char_length(facility) between 1 and 120),
  department text not null check (char_length(department) between 1 and 60),
  role text not null check (char_length(role) between 1 and 60),
  avatar_emoji text check (char_length(avatar_emoji) <= 16),
  favorite_specialty text check (char_length(favorite_specialty) <= 40),
  years_in_or text check (years_in_or in ('<1','1-3','3-10','10+')),
  walkup_song text check (char_length(walkup_song) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read own or admin" on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "insert own" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
