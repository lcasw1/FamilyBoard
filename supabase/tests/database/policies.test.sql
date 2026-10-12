-- Checks the security rules from the initial schema. Run with: npx supabase test db
--
-- Each test "signs in" by setting the JWT claims that auth.uid() reads, then
-- switching to the `authenticated` role that real app users get. Everything runs
-- inside one transaction that is rolled back, so the database is left unchanged.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Test users (fixed ids so the claims below are easy to read).
insert into auth.users (id, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', false),  -- admin
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', false),    -- sender
  ('33333333-3333-3333-3333-333333333333', null, true),                  -- Grandma's tablet
  ('44444444-4444-4444-4444-444444444444', 'mallory@example.com', false),-- outsider
  ('55555555-5555-5555-5555-555555555555', 'carol@example.com', false);  -- aide

-- ---------------------------------------------------------------- Alice sets up
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select ok(
  set_config('test.family', public.create_family('Wei family', 'us', 'zh-CN', 'Alice')::text, true) is not null,
  'a signed-in user can create a family'
);
select is(public.my_role(current_setting('test.family')::uuid), 'admin', 'the creator becomes admin');

select matches(
  set_config('test.sender_code', public.create_invite(current_setting('test.family')::uuid, 'sender'), true),
  '^US[A-HJKMNP-Z2-9]{6}$',
  'invite codes start with the region and avoid look-alike characters'
);
select set_config('test.sender_code_2', public.create_invite(current_setting('test.family')::uuid, 'sender'), true);
select set_config('test.display_code', public.create_invite(current_setting('test.family')::uuid, 'display'), true);
select set_config('test.aide_code', public.create_invite(current_setting('test.family')::uuid, 'aide'), true);
select set_config('test.expired_code', public.create_invite(current_setting('test.family')::uuid, 'sender'), true);

reset role;
update public.invites set expires_at = now() - interval '1 day'
where code = current_setting('test.expired_code');

-- ---------------------------------------------------------------- Joining
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  format($$ select public.redeem_invite(%L, 'Bob') $$,
         lower(substr(current_setting('test.sender_code'), 1, 2) || '-' || substr(current_setting('test.sender_code'), 3))),
  'codes work with a dash and in lower case'
);
select is(public.my_role(current_setting('test.family')::uuid), 'sender', 'Bob joins with the invite role');

select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok(
  format($$ select public.redeem_invite(%L, 'Carol') $$, current_setting('test.sender_code')),
  'P0001', 'invite_used', 'an invite works only once'
);
select lives_ok(
  format($$ select public.redeem_invite(%L, 'Carol') $$, current_setting('test.aide_code')),
  'Carol joins as aide'
);
select throws_ok(
  format($$ select public.redeem_invite(%L, 'Carol') $$, current_setting('test.sender_code_2')),
  'P0001', 'already_member', 'joining the same family twice is refused'
);

-- The tablet is an anonymous session.
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":true}', true);
select throws_ok(
  format($$ select public.redeem_invite(%L, 'Grandma') $$, current_setting('test.sender_code_2')),
  'P0001', 'invite_role_not_allowed', 'the tablet cannot use a sender invite'
);
select lives_ok(
  format($$ select public.redeem_invite(%L, 'Grandma') $$, current_setting('test.display_code')),
  'the tablet joins with a display invite'
);
select throws_ok(
  $$ select public.create_family('Tablet family', 'us', 'en', 'Tablet') $$,
  'P0001', 'not_allowed', 'the tablet cannot create families'
);

-- ---------------------------------------------------------------- Outsiders
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is_empty($$ select * from public.families $$, 'outsiders see no families');
select is_empty($$ select * from public.members $$, 'outsiders see no members');
select throws_ok(
  format($$ select public.create_invite(%L, 'admin') $$, current_setting('test.family')),
  'P0001', 'not_allowed', 'outsiders cannot create invites'
);
select throws_ok(
  format($$ select public.redeem_invite(%L, 'Mallory') $$, current_setting('test.expired_code')),
  'P0001', 'invite_expired', 'expired invites are refused'
);
select throws_ok(
  $$ select public.redeem_invite('US222222', 'Mallory') $$,
  'P0001', 'invite_not_found', 'unknown codes are refused'
);

-- ---------------------------------------------------------------- Messages
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok(
  format($$ insert into public.messages (family_id, type, caption) values (%L, 'text', 'Hi Mom!') $$,
         current_setting('test.family')),
  'a sender can post a text message'
);
select is(
  (select sender_id from public.messages limit 1),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'sender_id is filled in from the signed-in user'
);
select throws_ok(
  format($$ insert into public.messages (family_id, sender_id, type, caption)
            values (%L, '11111111-1111-1111-1111-111111111111', 'text', 'fake') $$,
         current_setting('test.family')),
  '42501', null, 'nobody can post as someone else'
);
select throws_ok(
  format($$ insert into public.messages (family_id, type, file_path)
            values (%L, 'photo', '00000000-0000-0000-0000-000000000000/x.jpg') $$,
         current_setting('test.family')),
  '23514', null, 'a message cannot point at another family''s files'
);
select throws_ok(
  $$ update public.members set role = 'admin' where user_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'members cannot change their own role'
);
select lives_ok(
  $$ update public.members set display_name = 'Bobby' where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'members can change their own name'
);
update public.messages set hidden = true;
select is((select hidden from public.messages limit 1), false, 'senders cannot hide messages');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":true}', true);
select throws_ok(
  format($$ insert into public.messages (family_id, type, caption) values (%L, 'text', 'x') $$,
         current_setting('test.family')),
  '42501', null, 'the tablet cannot post messages'
);
select is((select count(*)::int from public.messages), 1, 'the tablet sees the message');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
update public.messages set hidden = true;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":true}', true);
select is((select count(*)::int from public.messages), 0, 'hidden messages disappear from the tablet');

select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 1, 'aides still see hidden messages');

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 0, 'outsiders see no messages');

-- ---------------------------------------------------------------- Storage
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name, owner_id) values ('media', %L, %L) $$,
         current_setting('test.family') || '/photo.jpg', '22222222-2222-2222-2222-222222222222'),
  'a sender can upload into the family folder'
);

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":true}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'media'), 1, 'the tablet can read family files');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('media', %L) $$,
         current_setting('test.family') || '/tablet.jpg'),
  '42501', null, 'the tablet cannot upload'
);

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'media'), 0, 'outsiders cannot read family files');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('media', %L) $$,
         current_setting('test.family') || '/evil.jpg'),
  '42501', null, 'outsiders cannot upload into a family folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('media', 'not-a-uuid/x.jpg') $$,
  '42501', null, 'paths outside a family folder are refused'
);

select * from finish();
rollback;
