-- OR-Nav: test for migration 0002_tenants. Paste into the Supabase SQL editor and Run.
-- It ALWAYS ends in a red error box, on purpose: the error undoes all test data.
-- Read the message: "PASSED: ..." = every check worked. "FAILED: n ..." names the broken check.
do $$
declare
  a1 uuid := gen_random_uuid();  -- nurse 1, Sample General / Main OR
  a2 uuid := gen_random_uuid();  -- nurse 2, Sample General / Main OR
  b1 uuid := gen_random_uuid();  -- nurse 3, Demo Heart / CVOR
  dept_a uuid; dept_b uuid; item_a uuid; item_b uuid; req uuid; n int; ok boolean; st text;
begin
  select d.id into dept_a from public.departments d join public.hospitals h on h.id = d.hospital_id
    where h.name = 'Sample General Hospital' and d.name = 'Main OR';
  select d.id into dept_b from public.departments d join public.hospitals h on h.id = d.hospital_id
    where h.name = 'Demo Heart Center' and d.name = 'CVOR / Cardiac OR';
  if dept_a is null or dept_b is null then
    raise exception 'FAILED: 0 sample hospitals missing. Run 0002_tenants.sql first.';
  end if;

  -- Setup as the database owner
  insert into auth.users (id, email, aud, role) values
    (a1, 'ornav-test-a1@example.invalid', 'authenticated', 'authenticated'),
    (a2, 'ornav-test-a2@example.invalid', 'authenticated', 'authenticated'),
    (b1, 'ornav-test-b1@example.invalid', 'authenticated', 'authenticated');
  insert into public.items (department_id, name) values (dept_a, 'Test sponge A') returning id into item_a;
  insert into public.items (department_id, name) values (dept_b, 'Test sponge B') returning id into item_b;

  -- From here on, act as a signed-in app user
  perform set_config('role', 'authenticated', true);

  -- Each nurse joins their own department (pick and go)
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);
  insert into public.memberships (user_id, department_id, job_role) values (a1, dept_a, 'Scrub nurse');
  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true);
  insert into public.memberships (user_id, department_id, job_role) values (a2, dept_a, 'Circulating nurse');
  perform set_config('request.jwt.claims', json_build_object('sub', b1, 'role', 'authenticated')::text, true);
  insert into public.memberships (user_id, department_id, job_role) values (b1, dept_b, 'Scrub nurse');

  -- Nurse 1
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);

  select count(*) into n from public.items where id in (item_a, item_b);
  if n <> 1 or not exists (select 1 from public.items where id = item_a) then
    raise exception 'FAILED: 1 nurse 1 should see only Main OR items (saw %).', n;
  end if;

  ok := false;
  begin insert into public.items (department_id, name) values (dept_a, 'Sneaky'); exception when others then ok := true; end;
  if not ok then raise exception 'FAILED: 2 nurse 1 could add an item directly, without review.'; end if;

  ok := false;
  begin update public.items set name = 'Sneaky' where id = item_a; exception when others then ok := true; end;
  if not ok then raise exception 'FAILED: 3 nurse 1 could edit an item directly, without review.'; end if;

  select count(*) into n from public.memberships where department_id = dept_b;
  if n <> 0 then raise exception 'FAILED: 4 nurse 1 can see who is in the other hospital.'; end if;

  insert into public.change_requests (department_id, proposed_by, kind, target, data)
    values (dept_a, a1, 'add', 'item', '{"name": "Test clamp", "shelf": "B2"}') returning id into req;

  ok := false;
  begin
    insert into public.change_requests (department_id, proposed_by, kind, target, data)
      values (dept_b, a1, 'add', 'item', '{"name": "Wrong place"}');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAILED: 5 nurse 1 could propose a change in another hospital.'; end if;

  ok := false;
  begin perform public.review_change(req, 'approve'); exception when others then ok := true; end;
  if not ok then raise exception 'FAILED: 6 nurse 1 could approve their own change.'; end if;

  -- Nurse 3 (other hospital) tries to approve
  perform set_config('request.jwt.claims', json_build_object('sub', b1, 'role', 'authenticated')::text, true);
  ok := false;
  begin perform public.review_change(req, 'approve'); exception when others then ok := true; end;
  if not ok then raise exception 'FAILED: 7 a nurse from another hospital could approve.'; end if;

  -- Nurse 2 (same department) approves
  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true);
  st := public.review_change(req, 'approve', 'Looks right');
  select count(*) into n from public.items where department_id = dept_a and name = 'Test clamp' and shelf = 'B2';
  if st <> 'approved' or n <> 1 then
    raise exception 'FAILED: 8 approval by nurse 2 did not add the item (status %, found %).', st, n;
  end if;
  select status into st from public.change_requests where id = req;
  if st <> 'approved' then raise exception 'FAILED: 9 the request is not marked approved (%).', st; end if;

  -- Signed out
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('role', 'anon', true);
  ok := false;
  begin select count(*) into n from public.items; exception when others then ok := true; end;
  if not ok and n > 0 then raise exception 'FAILED: 10 a signed-out visitor could read items.'; end if;

  raise exception 'PASSED: all 10 checks. Test data was removed.';
end
$$;
