import { expect, test } from '@jest/globals';

import { resizeFor } from '../photo';

test('shrinks a landscape photo by its width', () => {
  expect(resizeFor(4032, 3024)).toEqual({ width: 1600 });
});

test('shrinks a portrait photo by its height', () => {
  expect(resizeFor(3024, 4032)).toEqual({ height: 1600 });
});

test('leaves small photos alone', () => {
  expect(resizeFor(1200, 900)).toBeNull();
  expect(resizeFor(1600, 1600)).toBeNull();
});

test('leaves photos of unknown size alone', () => {
  expect(resizeFor(0, 0)).toBeNull();
});
