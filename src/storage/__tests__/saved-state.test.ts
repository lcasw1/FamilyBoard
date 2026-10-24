import { describe, expect, test } from '@jest/globals';

import { MAX_RECENT_MESSAGES, parseDisplaySnapshot, recentForDisplay } from '../display-snapshot';
import { parseRememberedFamily } from '../remembered-family';

test('reads back a remembered family', () => {
  const saved = JSON.stringify({ familyId: 'f1', role: 'display' });
  expect(parseRememberedFamily(saved)).toEqual({ familyId: 'f1', role: 'display' });
});

test('ignores a missing or damaged remembered family', () => {
  expect(parseRememberedFamily(null)).toBeNull();
  expect(parseRememberedFamily('not json')).toBeNull();
  expect(parseRememberedFamily(JSON.stringify({ familyId: 'f1', role: 'boss' }))).toBeNull();
  expect(parseRememberedFamily(JSON.stringify({ role: 'admin' }))).toBeNull();
});

test('reads back a display snapshot, with or without messages', () => {
  const empty = { language: 'zh-CN', items: [] };
  expect(parseDisplaySnapshot(JSON.stringify(empty))).toEqual(empty);

  const two = {
    language: 'en',
    items: [
      { message: { id: 'm2', type: 'text' }, senderName: 'Lily', senderPhotoPath: 'f1/lily.jpg' },
      { message: { id: 'm1', type: 'photo' }, senderName: null, senderPhotoPath: null },
    ],
  };
  expect(parseDisplaySnapshot(JSON.stringify(two))).toEqual(two);
});

test('reads a snapshot saved by the older one-message version', () => {
  const oldEmpty = { language: 'zh-CN', message: null, senderName: null };
  expect(parseDisplaySnapshot(JSON.stringify(oldEmpty))).toEqual({ language: 'zh-CN', items: [] });

  const old = { language: 'en', message: { id: 'm1', type: 'text' }, senderName: 'Lily' };
  expect(parseDisplaySnapshot(JSON.stringify(old))).toEqual({
    language: 'en',
    items: [{ message: { id: 'm1', type: 'text' }, senderName: 'Lily', senderPhotoPath: null }],
  });
});

test('reads items saved before profile photos existed', () => {
  const saved = {
    language: 'en',
    items: [{ message: { id: 'm1', type: 'text' }, senderName: 'Lily' }],
  };
  expect(parseDisplaySnapshot(JSON.stringify(saved))).toEqual({
    language: 'en',
    items: [{ message: { id: 'm1', type: 'text' }, senderName: 'Lily', senderPhotoPath: null }],
  });
});

test('ignores a missing or damaged display snapshot', () => {
  expect(parseDisplaySnapshot(null)).toBeNull();
  expect(parseDisplaySnapshot('{')).toBeNull();
  expect(parseDisplaySnapshot(JSON.stringify({ language: 'fr', items: [] }))).toBeNull();
  expect(parseDisplaySnapshot(JSON.stringify({ language: 'en', message: 'hi' }))).toBeNull();
  expect(
    parseDisplaySnapshot(JSON.stringify({ language: 'en', items: [{ senderName: 'x' }] })),
  ).toBeNull();
});

describe('recentForDisplay', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const at = (id: string, iso: string) => ({ id, created_at: iso });

  test('keeps the messages of the last 24 hours, newest first', () => {
    const messages = [
      at('today', '2026-10-21T09:00:00Z'),
      at('yesterday-noon', '2026-10-20T12:00:00Z'),
      at('two-days-ago', '2026-10-19T08:00:00Z'),
    ];
    expect(recentForDisplay(messages, now).map((m) => m.id)).toEqual(['today', 'yesterday-noon']);
  });

  test('keeps the newest message when nothing came in the last day', () => {
    const messages = [at('last-week', '2026-10-14T09:00:00Z'), at('older', '2026-10-01T09:00:00Z')];
    expect(recentForDisplay(messages, now).map((m) => m.id)).toEqual(['last-week']);
  });

  test('returns nothing when the family has sent nothing', () => {
    expect(recentForDisplay([], now)).toEqual([]);
  });

  test('takes at most MAX_RECENT_MESSAGES on a busy day', () => {
    const many = Array.from({ length: MAX_RECENT_MESSAGES + 5 }, (_, i) =>
      at(`m${i}`, '2026-10-21T11:00:00Z'),
    );
    expect(recentForDisplay(many, now)).toHaveLength(MAX_RECENT_MESSAGES);
  });
});
