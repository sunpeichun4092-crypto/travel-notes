import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitEqual, splitWeighted } from '../split';

const u = (i: number) => `00000000-0000-0000-0000-${i.toString().padStart(12, '0')}`;

test('equal split: 100 / 3 = 34/33/33 (remainder to first)', () => {
  const out = splitEqual(100, [
    { user_id: u(1) }, { user_id: u(2) }, { user_id: u(3) },
  ]);
  assert.deepEqual(out.map((x) => x.share_cents), [34, 33, 33]);
});

test('equal split: total preserved exactly across many sizes', () => {
  for (let n = 1; n <= 12; n++) {
    for (const amount of [1, 7, 99, 100, 12345, 99999]) {
      const parts = Array.from({ length: n }, (_, i) => ({ user_id: u(i) }));
      const out = splitEqual(amount, parts);
      const sum = out.reduce((a, b) => a + b.share_cents, 0);
      assert.equal(sum, amount, `n=${n} amount=${amount}`);
      const max = Math.max(...out.map((x) => x.share_cents));
      const min = Math.min(...out.map((x) => x.share_cents));
      assert.ok(max - min <= 1, 'max-min must be ≤ 1');
    }
  }
});

test('weighted split: 100 with weights [1,2,3]', () => {
  const out = splitWeighted(100, [
    { user_id: u(1), weight: 1 },
    { user_id: u(2), weight: 2 },
    { user_id: u(3), weight: 3 },
  ]);
  // exact: 16.66.., 33.33.., 50.00
  // floor: 16, 33, 50; remainder 1; largest fraction is index 0 (.66)
  assert.deepEqual(out.map((x) => x.share_cents), [17, 33, 50]);
});

test('weighted split preserves total', () => {
  for (const amount of [1, 7, 99, 100, 12345, 99999, 1000000]) {
    for (const weights of [[1], [1, 1], [1, 2], [1, 2, 3], [3, 1, 1, 1, 1]]) {
      const parts = weights.map((w, i) => ({ user_id: u(i), weight: w }));
      const out = splitWeighted(amount, parts);
      const sum = out.reduce((a, b) => a + b.share_cents, 0);
      assert.equal(sum, amount);
    }
  }
});

test('weighted split rejects non-positive weights', () => {
  assert.throws(() => splitWeighted(100, [{ user_id: u(1), weight: 0 }]));
  assert.throws(() => splitWeighted(100, [{ user_id: u(1), weight: 1.5 }]));
  assert.throws(() => splitWeighted(100, [{ user_id: u(1), weight: -1 }]));
});
