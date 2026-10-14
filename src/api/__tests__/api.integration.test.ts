// Walks through the main flows against the local Supabase, using the same
// functions the app will call. Needs `npm run db:start` first.
//
// The tests run in order and share state (like one long scenario), because each
// step depends on the previous one: Alice creates a family, Bob joins it, and so on.
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

import {
  getCurrentUserId,
  hasSavedSignIn,
  sendEmailCode,
  signInDisplayDevice,
  signOut,
  verifyEmailCode,
} from '../auth';
import { supabase, switchRegion } from '../client';
import { ApiError } from '../errors';
import {
  createFamily,
  createInvite,
  getFamily,
  listMembers,
  listMyFamilies,
  listOpenInvites,
  redeemInvite,
  removeMember,
  revokeInvite,
  setMemberRole,
  switchRegionForInvite,
} from '../families';
import { getSignedUrl, uploadBytes } from '../media';
import { listMessages, sendTextMessage, setMessageHidden, subscribeToMessages } from '../messages';
import { formatInviteCode } from '../region';

const run = Date.now();
const aliceEmail = `alice+${run}@example.com`;
const bobEmail = `bob+${run}@example.com`;

// An admin client (secret key) that can create sign-in codes without sending an
// email. Only tests use it; the app never has the secret key.
const admin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_US_URL!,
  process.env.TEST_SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function signInAs(email: string): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  await verifyEmailCode(email, data.properties.email_otp);
}

/** Reads the newest sign-in code emailed to `email` from Mailpit (the local inbox). */
async function readEmailedCode(email: string): Promise<string> {
  const mailpit = process.env.TEST_MAILPIT_URL!;
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const message = await fetch(`${mailpit}/api/v1/message/${messages[0].ID}`);
      const { Text } = (await message.json()) as { Text: string };
      const code = /\b(\d{6})\b/.exec(Text)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in email arrived for ${email}`);
}

/** Expects `promise` to fail with an ApiError carrying `key`. */
async function expectApiError(promise: Promise<unknown>, key: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(promise).rejects.toHaveProperty('key', key);
}

let familyId: string;
let senderCode: string;
let displayCode: string;

beforeAll(async () => {
  await switchRegion('us');
});

// Stop the token-refresh timer and realtime connection so Jest can exit.
afterAll(async () => {
  await supabase().auth.stopAutoRefresh();
  await supabase().removeAllChannels();
  supabase().realtime.disconnect();
});

test('Alice signs in and creates a family', async () => {
  await signInAs(aliceEmail);
  expect(await getCurrentUserId()).not.toBeNull();

  familyId = await createFamily({
    name: 'Wei family',
    displayLanguage: 'zh-CN',
    adminDisplayName: 'Alice',
  });

  const families = await listMyFamilies();
  expect(families).toHaveLength(1);
  expect(families[0].family.id).toBe(familyId);
  expect(families[0].family.region).toBe('us');
  expect(families[0].role).toBe('admin');
});

test('Alice creates invites', async () => {
  senderCode = await createInvite(familyId, 'sender');
  displayCode = await createInvite(familyId, 'display');
  expect(senderCode).toMatch(/^US/);
  expect(await listOpenInvites(familyId)).toHaveLength(2);
  await expectApiError(createInvite(familyId, 'sender', 60), 'invalid_expiry');
  await signOut();
  expect(await getCurrentUserId()).toBeNull();
});

test('Bob signs in with the code from his email', async () => {
  await switchRegionForInvite(formatInviteCode(senderCode).toLowerCase());
  await sendEmailCode(bobEmail);
  const code = await readEmailedCode(bobEmail);

  const wrongCode = code === '000000' ? '111111' : '000000';
  await expectApiError(verifyEmailCode(bobEmail, wrongCode), 'invalid_email_code');

  await verifyEmailCode(bobEmail, code);
  expect(await getCurrentUserId()).not.toBeNull();
});

test('Bob joins the family with his invite', async () => {
  expect(await redeemInvite(formatInviteCode(senderCode), 'Bob')).toBe(familyId);
  expect((await listMyFamilies())[0].role).toBe('sender');
  await expectApiError(redeemInvite(senderCode, 'Bob'), 'invite_used');
  await expectApiError(redeemInvite('US222222', 'Bob'), 'invite_not_found');
});

test('Bob sends a message and hears about it in real time', async () => {
  let notified!: () => void;
  const heard = new Promise<void>((resolve) => (notified = resolve));
  const unsubscribe = subscribeToMessages(familyId, () => notified());
  // Give the realtime connection a moment to join before sending.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const sent = await sendTextMessage(familyId, '  Hi Mom!  ');
  expect(sent.caption).toBe('Hi Mom!');
  expect(sent.sender_id).toBe(await getCurrentUserId());

  await heard;
  unsubscribe();

  const messages = await listMessages(familyId);
  expect(messages.map((message) => message.id)).toEqual([sent.id]);
});

test('Bob uploads a file and can fetch it through a signed URL', async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const path = await uploadBytes(familyId, bytes, 'jpg');
  expect(path.startsWith(`${familyId}/`)).toBe(true);

  const response = await fetch(await getSignedUrl(path));
  expect(response.status).toBe(200);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  await signOut();
});

test("Grandma's tablet joins with a display invite and can only read", async () => {
  await signInDisplayDevice();
  expect(await redeemInvite(displayCode, 'Grandma')).toBe(familyId);

  const messages = await listMessages(familyId);
  expect(messages).toHaveLength(1);
  expect(messages[0].caption).toBe('Hi Mom!');
  expect((await getFamily(familyId)).display_language).toBe('zh-CN');

  await expect(sendTextMessage(familyId, 'hello')).rejects.toBeInstanceOf(ApiError);
  expect(await hasSavedSignIn()).toBe(true);
  await signOut();
  expect(await hasSavedSignIn()).toBe(false);
});

test('Alice manages the family: roles, hiding, invites, removing', async () => {
  await signInAs(aliceEmail);
  const aliceId = (await getCurrentUserId())!;
  const byName = async (name: string) =>
    (await listMembers(familyId)).find((member) => member.display_name === name)!;

  await setMemberRole(familyId, (await byName('Bob')).user_id, 'aide');
  expect((await byName('Bob')).role).toBe('aide');
  await expectApiError(
    setMemberRole(familyId, (await byName('Grandma')).user_id, 'sender'),
    'role_change_not_allowed',
  );
  await expectApiError(setMemberRole(familyId, aliceId, 'sender'), 'last_admin');
  await expectApiError(removeMember(familyId, aliceId), 'last_admin');

  const [message] = await listMessages(familyId);
  await setMessageHidden(message.id, true);
  // Admins still see hidden messages (marked hidden); the tablet doesn't.
  expect((await listMessages(familyId))[0].hidden).toBe(true);

  await createInvite(familyId, 'sender');
  const [open] = await listOpenInvites(familyId);
  await revokeInvite(open.id);
  expect(await listOpenInvites(familyId)).toHaveLength(0);

  await removeMember(familyId, (await byName('Grandma')).user_id);
  expect((await listMembers(familyId)).map((member) => member.display_name)).toEqual([
    'Alice',
    'Bob',
  ]);
  await signOut();
});
