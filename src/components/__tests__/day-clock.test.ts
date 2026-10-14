import { expect, test } from '@jest/globals';

import { partOfDay } from '../day-clock';

test('names the part of the day from the hour', () => {
  expect(partOfDay(5)).toBe('morning');
  expect(partOfDay(11)).toBe('morning');
  expect(partOfDay(12)).toBe('afternoon');
  expect(partOfDay(16)).toBe('afternoon');
  expect(partOfDay(17)).toBe('evening');
  expect(partOfDay(20)).toBe('evening');
  expect(partOfDay(21)).toBe('night');
  expect(partOfDay(0)).toBe('night');
  expect(partOfDay(4)).toBe('night');
});
