import { expect, test } from '@jest/globals';

import { colorFor, initialOf } from '../avatar';

test('the letter is the first character of the name, in capitals', () => {
  expect(initialOf('lily')).toBe('L');
  expect(initialOf('  Uncle Wei')).toBe('U');
  expect(initialOf('小丽')).toBe('小');
  expect(initialOf('')).toBe('?');
});

test('the same name always gets the same colour', () => {
  expect(colorFor('Lily')).toBe(colorFor('Lily'));
  expect(colorFor('Lily')).toMatch(/^#[0-9A-F]{6}$/);
});
