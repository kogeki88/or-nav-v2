-- Sample library for Sample General Hospital / Main OR (test data only, no patient data).
-- Run by hand in the Supabase SQL editor. Safe to run twice: it does nothing if Main OR already has items.
-- Real content never goes in this way: it goes through change_requests and public.review_change().

do $$
declare
  dept uuid;
  c_lap uuid; c_hernia uuid; c_tka uuid;
begin
  select d.id into dept
  from public.departments d join public.hospitals h on h.id = d.hospital_id
  where h.name = 'Sample General Hospital' and d.name = 'Main OR';

  if dept is null then raise exception 'Main OR not found. Run 0002_tenants.sql first.'; end if;
  if exists (select 1 from public.items where department_id = dept) then
    raise notice 'Main OR already has items. Nothing added.';
    return;
  end if;

  insert into public.items (department_id, name, category, shelf, sub_location, synonyms, notes) values
    (dept, 'Laparoscopic tower', 'Equipment', 'Bay 1', 'Left wall', '{lap tower,video tower}', 'Check CO2 tank before the case.'),
    (dept, 'Veress needle 120 mm', 'Disposable', 'A3', 'Bin 2', '{insufflation needle}', null),
    (dept, '5 mm trocar', 'Disposable', 'A3', 'Bin 4', '{port,5 port}', null),
    (dept, '12 mm trocar', 'Disposable', 'A3', 'Bin 5', '{port,12 port}', null),
    (dept, 'Maryland grasper', 'Instrument', 'B1', 'Lap tray', '{maryland dissector}', null),
    (dept, 'Clip applier 10 mm', 'Instrument', 'B1', 'Lap tray', '{clipper,ligaclip}', null),
    (dept, 'Specimen retrieval bag', 'Disposable', 'A4', 'Bin 1', '{endo bag,endocatch}', null),
    (dept, 'Mesh 15 x 15 cm', 'Implant', 'C2', 'Locked cabinet', '{hernia mesh}', 'Log the lot number.'),
    (dept, 'Tacker 5 mm', 'Disposable', 'C2', 'Shelf 1', '{fixation device}', null),
    (dept, 'Bovie pencil', 'Disposable', 'A1', 'Bin 1', '{cautery,ESU pencil}', null),
    (dept, 'Tourniquet cuff 34 in', 'Equipment', 'D1', 'Hook 3', '{thigh cuff}', null),
    (dept, 'Saw blade sagittal', 'Disposable', 'D2', 'Bin 3', '{oscillating blade}', null),
    (dept, 'Pulse lavage', 'Disposable', 'D2', 'Bin 5', '{interpulse,irrigation gun}', null),
    (dept, 'Bone cement 40 g', 'Implant', 'D3', 'Locked cabinet', '{PMMA,cement}', 'Mix only on surgeon call.'),
    (dept, '0 Vicryl CT-1', 'Suture', 'S1', 'Drawer 2', '{vicryl zero}', null),
    (dept, '4-0 Monocryl PS-2', 'Suture', 'S1', 'Drawer 4', '{monocryl}', null);

  insert into public.preference_cards (department_id, surgeon, procedure, specialty, notes)
  values (dept, 'Dr. Avery', 'Laparoscopic cholecystectomy', 'General', 'Reverse Trendelenburg, left tilt.')
  returning id into c_lap;
  insert into public.preference_cards (department_id, surgeon, procedure, specialty, notes)
  values (dept, 'Dr. Avery', 'Laparoscopic inguinal hernia repair', 'General', null)
  returning id into c_hernia;
  insert into public.preference_cards (department_id, surgeon, procedure, specialty, notes)
  values (dept, 'Dr. Patel', 'Total knee arthroplasty', 'Orthopedics', 'Tourniquet time called at 60 min.')
  returning id into c_tka;

  insert into public.card_items (department_id, card_id, item_id, phase, quantity, open_or_hold, sort_order)
  select dept, x.card, i.id, x.phase, x.qty, x.oh, x.ord
  from (values
    (c_lap, 'Laparoscopic tower', 'Setup', 1, 'open', 1),
    (c_lap, 'Bovie pencil', 'Setup', 1, 'open', 2),
    (c_lap, 'Veress needle 120 mm', 'Incision', 1, 'open', 1),
    (c_lap, '5 mm trocar', 'Incision', 3, 'open', 2),
    (c_lap, '12 mm trocar', 'Incision', 1, 'open', 3),
    (c_lap, 'Maryland grasper', 'Cannulation/Main', 1, 'open', 1),
    (c_lap, 'Clip applier 10 mm', 'Cannulation/Main', 1, 'open', 2),
    (c_lap, 'Specimen retrieval bag', 'Closure', 1, 'hold', 1),
    (c_lap, '0 Vicryl CT-1', 'Closure', 1, 'open', 2),
    (c_lap, '4-0 Monocryl PS-2', 'Closure', 1, 'open', 3),
    (c_hernia, 'Laparoscopic tower', 'Setup', 1, 'open', 1),
    (c_hernia, '5 mm trocar', 'Incision', 2, 'open', 1),
    (c_hernia, '12 mm trocar', 'Incision', 1, 'open', 2),
    (c_hernia, 'Mesh 15 x 15 cm', 'Cannulation/Main', 1, 'hold', 1),
    (c_hernia, 'Tacker 5 mm', 'Cannulation/Main', 1, 'hold', 2),
    (c_hernia, '4-0 Monocryl PS-2', 'Closure', 1, 'open', 1),
    (c_tka, 'Tourniquet cuff 34 in', 'Setup', 1, 'open', 1),
    (c_tka, 'Bovie pencil', 'Setup', 1, 'open', 2),
    (c_tka, 'Saw blade sagittal', 'Cannulation/Main', 2, 'open', 1),
    (c_tka, 'Pulse lavage', 'Cannulation/Main', 1, 'open', 2),
    (c_tka, 'Bone cement 40 g', 'Cannulation/Main', 2, 'hold', 3),
    (c_tka, '0 Vicryl CT-1', 'Closure', 2, 'open', 1),
    (c_tka, '4-0 Monocryl PS-2', 'Closure', 1, 'open', 2)
  ) as x(card, item_name, phase, qty, oh, ord)
  join public.items i on i.department_id = dept and i.name = x.item_name;

  raise notice 'Added 16 items, 3 cards, 23 card lines to Main OR.';
end $$;

-- Read back (expect 16, 3, 23):
select
  (select count(*) from public.items i join public.departments d on d.id = i.department_id where d.name = 'Main OR' and d.hospital_id = (select id from public.hospitals where name = 'Sample General Hospital')) as items,
  (select count(*) from public.preference_cards c join public.departments d on d.id = c.department_id where d.name = 'Main OR' and d.hospital_id = (select id from public.hospitals where name = 'Sample General Hospital')) as cards,
  (select count(*) from public.card_items ci join public.departments d on d.id = ci.department_id where d.name = 'Main OR' and d.hospital_id = (select id from public.hospitals where name = 'Sample General Hospital')) as card_lines;
