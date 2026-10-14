import { expect, test } from '@jest/globals';

import { formatDate } from '../format-date';

// A Tuesday. timeZone: 'UTC' keeps the test the same on any computer.
const date = new Date('2026-10-13T12:00:00Z');

test('formats in English', () => {
  expect(formatDate(date, 'en', { weekday: 'long', timeZone: 'UTC' })).toBe('Tuesday');
});

test('formats in Chinese', () => {
  expect(formatDate(date, 'zh-CN', { weekday: 'long', timeZone: 'UTC' })).toBe('星期二');
});
