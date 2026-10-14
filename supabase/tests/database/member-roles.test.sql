-- Checks changing roles and the last-admin protection (migration member_roles).
-- Run with: npx supabase test db
--
-- Same approach as policies.test.sql: "sign in" by setting the JWT claims, and
-- roll everything back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

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

-- A shortcut for reading someone's role as the owner, ignoring security rules.
create function pg_temp.role_of(p_user_id uuid) returns text language sql as $$
  select role from public.members
  where family_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = p_user_id;
$$;

-- ---------------------------------------------------------------- Who may change roles
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select public.set_member_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin') $$,
  'P0001', 'not_allowed', 'a sender cannot change roles, not even their own'
);
select throws_ok(
  $$ update public.members set role = 'admin' where user_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'nobody can update a role directly'
);

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok(
  $$ select public.set_member_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'admin') $$,
  'P0001', 'not_allowed', 'outsiders cannot change roles'
);

-- ---------------------------------------------------------------- What an admin may do
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ select public.set_member_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'aide') $$,
  'an admin can make a sender an aide'
);
select throws_ok(
  $$ select public.set_member_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'display') $$,
  'P0001', 'role_change_not_allowed', 'nobody can be made a display'
);
select throws_ok(
  $$ select public.set_member_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'sender') $$,
  'P0001', 'role_change_not_allowed', 'Grandma''s tablet keeps the display role'
);
select throws_ok(
  $$ select public.set_member_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'sender') $$,
  'P0001', 'member_not_found', 'only members can be given a role'
);

-- ---------------------------------------------------------------- The last admin
select throws_ok(
  $$ select public.set_member_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'sender') $$,
  'P0001', 'last_admin', 'the only admin cannot step down'
);
select throws_ok(
  $$ delete from public.members where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001', 'last_admin', 'the only admin cannot leave'
);

select lives_ok(
  $$ select public.set_member_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin') $$,
  'an admin can make someone else an admin'
);
select lives_ok(
  $$ select public.set_member_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'sender') $$,
  'with a second admin, an admin can step down'
);

-- Bob is now the only admin.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok(
  $$ delete from public.members where user_id = '33333333-3333-3333-3333-333333333333' $$,
  'an admin can remove a non-admin (here the tablet)'
);
select throws_ok(
  $$ delete from public.members where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'P0001', 'last_admin', 'the new only admin cannot leave either'
);

reset role;
select results_eq(
  $$ select pg_temp.role_of('11111111-1111-1111-1111-111111111111')
     union all select pg_temp.role_of('22222222-2222-2222-2222-222222222222') $$,
  $$ values ('sender'), ('admin') $$,
  'the roles ended up as expected'
);

-- ---------------------------------------------------------------- Deleting a family
select lives_ok(
  $$ delete from public.families where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'deleting a whole family also removes its last admin'
);

select * from finish();
rollback;
