import { expect, test } from '@jest/globals';

import { parseDisplaySnapshot } from '../display-snapshot';
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

test('reads back a display snapshot, with or without a message', () => {
  const empty = { language: 'zh-CN', message: null, senderName: null };
  expect(parseDisplaySnapshot(JSON.stringify(empty))).toEqual(empty);

  const withMessage = { language: 'en', message: { id: 'm1', type: 'text' }, senderName: 'Lily' };
  expect(parseDisplaySnapshot(JSON.stringify(withMessage))).toEqual(withMessage);
});

test('ignores a missing or damaged display snapshot', () => {
  expect(parseDisplaySnapshot(null)).toBeNull();
  expect(parseDisplaySnapshot('{')).toBeNull();
  expect(parseDisplaySnapshot(JSON.stringify({ language: 'fr', message: null }))).toBeNull();
  expect(parseDisplaySnapshot(JSON.stringify({ language: 'en', message: 'hi' }))).toBeNull();
});
