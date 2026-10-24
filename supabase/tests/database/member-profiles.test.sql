-- Checks who may change members' names and photos (migration member_profiles).
-- Run with: npx supabase test db
--
-- Same approach as policies.test.sql: "sign in" by setting the JWT claims, and
-- roll everything back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Set up directly as the database owner (no security rules apply here).
insert into auth.users (id, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', false),  -- admin
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', false),    -- sender
  ('33333333-3333-3333-3333-333333333333', null, true),                  -- Grandma's tablet
  ('44444444-4444-4444-4444-444444444444', 'mallory@example.com', false);-- outsider

insert into public.families (id, name, region)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Wei family', 'us');

insert into public.members (family_id, user_id, display_name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Alice', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Bob', 'sender'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Grandma', 'display');

-- A shortcut for reading someone's name as the owner, ignoring security rules.
create function pg_temp.name_of(p_user_id uuid) returns text language sql as $$
  select display_name from public.members
  where family_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = p_user_id;
$$;

-- ---------------------------------------------------------------- A sender
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

update public.members set display_name = 'Bobby'
where user_id = '22222222-2222-2222-2222-222222222222';
-- Security rules hide rows you may not change, so this changes nothing (no error).
update public.members set display_name = 'Not Alice'
where user_id = '11111111-1111-1111-1111-111111111111';

reset role;
select is(pg_temp.name_of('22222222-2222-2222-2222-222222222222'), 'Bobby', 'a sender can rename themselves');
select is(pg_temp.name_of('11111111-1111-1111-1111-111111111111'), 'Alice', 'a sender cannot rename someone else');

-- ---------------------------------------------------------------- The tablet and an outsider
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
update public.members set display_name = 'Tablet was here'
where user_id = '22222222-2222-2222-2222-222222222222';

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
update public.members set display_name = 'Mallory was here'
where user_id = '22222222-2222-2222-2222-222222222222';

reset role;
select is(pg_temp.name_of('22222222-2222-2222-2222-222222222222'), 'Bobby', 'the tablet and outsiders cannot rename anyone');

-- ---------------------------------------------------------------- An admin
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

update public.members
set display_name = 'Uncle Bob', photo_path = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bob.jpg'
where user_id = '22222222-2222-2222-2222-222222222222';
update public.members set display_name = 'Nana'
where user_id = '33333333-3333-3333-3333-333333333333';

select throws_ok(
  $$ update public.members set photo_path = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x.jpg'
     where user_id = '22222222-2222-2222-2222-222222222222' $$,
  '23514', null, 'a photo must be in the family''s own folder'
);
select throws_ok(
  $$ update public.members set role = 'admin' where user_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'an admin still cannot change a role directly'
);
select throws_ok(
  $$ update public.members set display_name = '' where user_id = '22222222-2222-2222-2222-222222222222' $$,
  '23514', null, 'a name cannot be empty'
);

reset role;
select is(pg_temp.name_of('22222222-2222-2222-2222-222222222222'), 'Uncle Bob', 'an admin can rename a member');
select is(
  (select photo_path from public.members where user_id = '22222222-2222-2222-2222-222222222222'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bob.jpg',
  'an admin can set a member''s photo'
);
select is(pg_temp.name_of('33333333-3333-3333-3333-333333333333'), 'Nana', 'an admin can rename the tablet');

select * from finish();
rollback;
