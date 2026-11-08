-- OR-Nav multi-tenant structure. Applied in the Supabase SQL editor (project OR-NAV), after 0001.
-- Data belongs to a department; a department belongs to a hospital.
-- Pick and go: a signed-in user adds their own memberships (several allowed).
-- Truth tables (items, preference_cards, card_items) are read-only for users. Changes go through
-- change_requests and become the truth only when another member of the department approves
-- (public.review_change). Nobody approves their own change. Admins = app_metadata.role 'admin'.

create schema if not exists private;  -- not exposed by the Supabase API
grant usage on schema private to authenticated;

-- ---------- Tenants ----------
create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 120),
  city text check (char_length(city) <= 80),
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (hospital_id, name)
);
create index departments_hospital_idx on public.departments (hospital_id);

create table public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  job_role text check (char_length(job_role) <= 60),  -- display only for now
  joined_at timestamptz not null default now(),
  primary key (user_id, department_id)
);
create index memberships_department_idx on public.memberships (department_id);

-- ---------- Content (the truth) ----------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text check (char_length(category) <= 60),
  shelf text check (char_length(shelf) <= 60),
  sub_location text check (char_length(sub_location) <= 60),
  synonyms text[] not null default '{}',
  notes text check (char_length(notes) <= 2000),
  photo_path text check (char_length(photo_path) <= 300),
  version int not null default 1,
  updated_at timestamptz not null default now()
);
create index items_department_idx on public.items (department_id);

create table public.preference_cards (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  surgeon text not null check (char_length(surgeon) between 1 and 120),
  procedure text not null check (char_length(procedure) between 1 and 160),
  specialty text check (char_length(specialty) <= 60),
  notes text check (char_length(notes) <= 4000),
  version int not null default 1,
  updated_at timestamptz not null default now()
);
create index preference_cards_department_idx on public.preference_cards (department_id);

create table public.card_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  card_id uuid not null references public.preference_cards(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  phase text not null check (phase in ('Setup', 'Incision', 'Cannulation/Main', 'Closure')),
  quantity int not null default 1 check (quantity between 1 and 999),
  open_or_hold text not null default 'open' check (open_or_hold in ('open', 'hold')),
  note text check (char_length(note) <= 500),
  sort_order int not null default 0,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
create index card_items_card_idx on public.card_items (card_id);
create index card_items_item_idx on public.card_items (item_id);
create index card_items_department_idx on public.card_items (department_id);

-- ---------- Proposals and reviews ----------
create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  proposed_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('add', 'edit', 'remove')),
  target text not null check (target in ('item', 'card', 'card_item')),
  target_id uuid,  -- the row to edit or remove; for 'add', filled in when approved
  data jsonb not null default '{}',  -- the new values
  base_version int,  -- version the proposer saw; a stale edit is refused
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (kind = 'add' or target_id is not null)
);
create index change_requests_department_idx on public.change_requests (department_id, status);

create table public.change_reviews (
  request_id uuid not null references public.change_requests(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('approve', 'reject')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (request_id, reviewer_id)
);

-- ---------- Helpers ----------
create or replace function private.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- security definer so the memberships policy can call it without looping on itself
create or replace function private.is_member(dept uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.department_id = dept and m.user_id = (select auth.uid())
  )
$$;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_member(uuid) to authenticated;

-- ---------- Privileges: read for signed-in users, writes only where listed ----------
revoke all on public.hospitals, public.departments, public.memberships, public.items,
  public.preference_cards, public.card_items, public.change_requests, public.change_reviews
  from anon, authenticated;
grant select on public.hospitals, public.departments, public.memberships, public.items,
  public.preference_cards, public.card_items, public.change_requests, public.change_reviews
  to authenticated;
grant insert, delete on public.memberships to authenticated;
grant update (job_role) on public.memberships to authenticated;
grant insert on public.change_requests to authenticated;
-- Hospitals and departments are added by an admin in the SQL editor.

-- ---------- Row-level security ----------
alter table public.hospitals enable row level security;
alter table public.departments enable row level security;
alter table public.memberships enable row level security;
alter table public.items enable row level security;
alter table public.preference_cards enable row level security;
alter table public.card_items enable row level security;
alter table public.change_requests enable row level security;
alter table public.change_reviews enable row level security;

create policy "signed-in read" on public.hospitals for select to authenticated using (true);
create policy "signed-in read" on public.departments for select to authenticated using (true);

create policy "read own or same department" on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member(department_id) or private.is_admin());
create policy "join yourself" on public.memberships for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "change own role" on public.memberships for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "leave yourself" on public.memberships for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "members read" on public.items for select to authenticated
  using (private.is_member(department_id) or private.is_admin());
create policy "members read" on public.preference_cards for select to authenticated
  using (private.is_member(department_id) or private.is_admin());
create policy "members read" on public.card_items for select to authenticated
  using (private.is_member(department_id) or private.is_admin());

create policy "members read" on public.change_requests for select to authenticated
  using (private.is_member(department_id) or private.is_admin());
create policy "members propose" on public.change_requests for insert to authenticated
  with check (
    proposed_by = (select auth.uid())
    and status = 'pending' and decided_at is null
    and private.is_member(department_id)
  );

create policy "members read" on public.change_reviews for select to authenticated
  using (exists (
    select 1 from public.change_requests r
    where r.id = request_id and (private.is_member(r.department_id) or private.is_admin())
  ));

-- ---------- Applying an approved change (internal, not callable from the app) ----------
create or replace function private.apply_change(req public.change_requests) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  d jsonb := req.data;
  new_id uuid;
  n int;
begin
  if req.target = 'item' then
    if req.kind = 'add' then
      insert into public.items (department_id, name, category, shelf, sub_location, synonyms, notes, photo_path)
      values (req.department_id, d->>'name', d->>'category', d->>'shelf', d->>'sub_location',
              array(select jsonb_array_elements_text(coalesce(d->'synonyms', '[]'))), d->>'notes', d->>'photo_path')
      returning id into new_id;
      return new_id;
    elsif req.kind = 'edit' then
      update public.items i set
        name = case when d ? 'name' then d->>'name' else i.name end,
        category = case when d ? 'category' then d->>'category' else i.category end,
        shelf = case when d ? 'shelf' then d->>'shelf' else i.shelf end,
        sub_location = case when d ? 'sub_location' then d->>'sub_location' else i.sub_location end,
        synonyms = case when d ? 'synonyms'
          then array(select jsonb_array_elements_text(d->'synonyms')) else i.synonyms end,
        notes = case when d ? 'notes' then d->>'notes' else i.notes end,
        photo_path = case when d ? 'photo_path' then d->>'photo_path' else i.photo_path end,
        version = i.version + 1, updated_at = now()
      where i.id = req.target_id and i.department_id = req.department_id
        and (req.base_version is null or i.version = req.base_version);
    else
      if exists (select 1 from public.card_items ci where ci.item_id = req.target_id) then
        raise exception 'This item is on a preference card. Remove it from the cards first.';
      end if;
      delete from public.items i where i.id = req.target_id and i.department_id = req.department_id;
    end if;

  elsif req.target = 'card' then
    if req.kind = 'add' then
      insert into public.preference_cards (department_id, surgeon, procedure, specialty, notes)
      values (req.department_id, d->>'surgeon', d->>'procedure', d->>'specialty', d->>'notes')
      returning id into new_id;
      return new_id;
    elsif req.kind = 'edit' then
      update public.preference_cards c set
        surgeon = case when d ? 'surgeon' then d->>'surgeon' else c.surgeon end,
        procedure = case when d ? 'procedure' then d->>'procedure' else c.procedure end,
        specialty = case when d ? 'specialty' then d->>'specialty' else c.specialty end,
        notes = case when d ? 'notes' then d->>'notes' else c.notes end,
        version = c.version + 1, updated_at = now()
      where c.id = req.target_id and c.department_id = req.department_id
        and (req.base_version is null or c.version = req.base_version);
    else
      delete from public.preference_cards c where c.id = req.target_id and c.department_id = req.department_id;
    end if;

  else  -- card_item
    if req.kind = 'add' then
      if not exists (select 1 from public.preference_cards c
                     where c.id = (d->>'card_id')::uuid and c.department_id = req.department_id)
         or not exists (select 1 from public.items i
                        where i.id = (d->>'item_id')::uuid and i.department_id = req.department_id) then
        raise exception 'The card and the item must both belong to this department.';
      end if;
      insert into public.card_items (department_id, card_id, item_id, phase, quantity, open_or_hold, note, sort_order)
      values (req.department_id, (d->>'card_id')::uuid, (d->>'item_id')::uuid, d->>'phase',
              coalesce((d->>'quantity')::int, 1), coalesce(d->>'open_or_hold', 'open'),
              d->>'note', coalesce((d->>'sort_order')::int, 0))
      returning id into new_id;
      return new_id;
    elsif req.kind = 'edit' then
      update public.card_items ci set
        phase = case when d ? 'phase' then d->>'phase' else ci.phase end,
        quantity = case when d ? 'quantity' then (d->>'quantity')::int else ci.quantity end,
        open_or_hold = case when d ? 'open_or_hold' then d->>'open_or_hold' else ci.open_or_hold end,
        note = case when d ? 'note' then d->>'note' else ci.note end,
        sort_order = case when d ? 'sort_order' then (d->>'sort_order')::int else ci.sort_order end,
        version = ci.version + 1, updated_at = now()
      where ci.id = req.target_id and ci.department_id = req.department_id
        and (req.base_version is null or ci.version = req.base_version);
    else
      delete from public.card_items ci where ci.id = req.target_id and ci.department_id = req.department_id;
    end if;
  end if;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Not found in this department, or someone changed it first. Reload and try again.';
  end if;
  return req.target_id;
end
$$;
revoke all on function private.apply_change(public.change_requests) from public;

-- ---------- Reviewing: the one way a change becomes the truth ----------
create or replace function public.review_change(p_request_id uuid, p_decision text, p_note text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  req public.change_requests;
  me uuid := auth.uid();
  result_id uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject.';
  end if;
  select * into req from public.change_requests r where r.id = p_request_id for update;
  if not found then raise exception 'Change request not found.'; end if;
  if req.status <> 'pending' then raise exception 'This change was already %.', req.status; end if;
  if req.proposed_by = me then raise exception 'You cannot review your own change. Ask a colleague.'; end if;
  if not (private.is_member(req.department_id) or private.is_admin()) then
    raise exception 'You are not a member of this department.';
  end if;

  insert into public.change_reviews (request_id, reviewer_id, decision, note)
  values (req.id, me, p_decision, p_note);

  if p_decision = 'approve' then
    result_id := private.apply_change(req);
    update public.change_requests r
      set status = 'approved', decided_at = now(), target_id = result_id
      where r.id = req.id;
    return 'approved';
  end if;
  update public.change_requests r set status = 'rejected', decided_at = now() where r.id = req.id;
  return 'rejected';
end
$$;
revoke all on function public.review_change(uuid, text, text) from public, anon;
grant execute on function public.review_change(uuid, text, text) to authenticated;

-- ---------- Sample tenants (made up, for testing) ----------
insert into public.hospitals (name, city) values
  ('Sample General Hospital', 'Springfield'),
  ('Demo Heart Center', 'Riverside')
on conflict (name) do nothing;

insert into public.departments (hospital_id, name)
select h.id, d.name
from public.hospitals h
cross join (values ('Main OR'), ('CVOR / Cardiac OR')) as d(name)
where h.name in ('Sample General Hospital', 'Demo Heart Center')
on conflict (hospital_id, name) do nothing;
