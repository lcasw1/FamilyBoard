import { expect, test } from '@jest/globals';

import { nextAutoIndex, stepIndex } from '../use-rotation';

test('automatic turns go to the next older message, then back to the newest', () => {
  expect(nextAutoIndex(0, 3)).toBe(1);
  expect(nextAutoIndex(1, 3)).toBe(2);
  expect(nextAutoIndex(2, 3)).toBe(0);
  expect(nextAutoIndex(0, 1)).toBe(0);
  expect(nextAutoIndex(0, 0)).toBe(0);
});

test('stepping by hand stops at the newest and the oldest', () => {
  expect(stepIndex(0, +1, 3)).toBe(1);
  expect(stepIndex(2, +1, 3)).toBe(2);
  expect(stepIndex(1, -1, 3)).toBe(0);
  expect(stepIndex(0, -1, 3)).toBe(0);
  expect(stepIndex(0, +1, 0)).toBe(0);
});
