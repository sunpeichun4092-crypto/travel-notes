import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleNet, minimumTransfers } from '../settle';
import type { ExpenseWithShares } from '../types';

const u = (i: number) => `00000000-0000-0000-0000-${i.toString().padStart(12, '0')}`;

const exp = (overrides: Partial<ExpenseWithShares>): ExpenseWithShares => ({
  id: u(99),
  trip_id: u(0),
  payer_id: u(1),
  amount_cents: 0,
  currency: 'CNY',
  description: null,
  category: null,
  spent_at: '2026-01-01T00:00:00Z',
  split_mode: 'equal',
  created_by: u(1),
  created_at: '2026-01-01T00:00:00Z',
  shares: [],
  ...overrides,
});

test('settleNet: classic 3-person dinner', () => {
  // u1 paid 300, equal split among u1,u2,u3 → u2,u3 each owe 100
  const balances = settleNet([
    exp({
      id: u(99),
      payer_id: u(1),
      amount_cents: 300,
      shares: [
        { expense_id: u(99), user_id: u(1), share_cents: 100 },
        { expense_id: u(99), user_id: u(2), share_cents: 100 },
        { expense_id: u(99), user_id: u(3), share_cents: 100 },
      ],
    }),
  ]);
  const m = new Map(balances.map((b) => [b.user_id, b.balance_cents]));
  assert.equal(m.get(u(1)), 200);
  assert.equal(m.get(u(2)), -100);
  assert.equal(m.get(u(3)), -100);
});

test('settleNet: rejects expense whose shares do not sum to amount', () => {
  assert.throws(() => settleNet([
    exp({
      id: u(99), payer_id: u(1), amount_cents: 100,
      shares: [
        { expense_id: u(99), user_id: u(1), share_cents: 60 },
        { expense_id: u(99), user_id: u(2), share_cents: 30 }, // sum=90 ≠ 100
      ],
    }),
  ]));
});

test('minimumTransfers: 3-person dinner needs 2 transfers', () => {
  const balances = [
    { user_id: u(1), balance_cents: 200 },
    { user_id: u(2), balance_cents: -100 },
    { user_id: u(3), balance_cents: -100 },
  ];
  const transfers = minimumTransfers(balances);
  assert.equal(transfers.length, 2);
  // every transfer is from a debtor to the creditor
  for (const t of transfers) {
    assert.equal(t.to, u(1));
    assert.ok(t.amount_cents > 0);
  }
  const total = transfers.reduce((a, b) => a + b.amount_cents, 0);
  assert.equal(total, 200);
});

test('minimumTransfers: bound is at most n-1 transfers', () => {
  // 5-person scenario with chained debts
  const balances = [
    { user_id: u(1), balance_cents: 500 },
    { user_id: u(2), balance_cents: 200 },
    { user_id: u(3), balance_cents: -300 },
    { user_id: u(4), balance_cents: -250 },
    { user_id: u(5), balance_cents: -150 },
  ];
  const transfers = minimumTransfers(balances);
  assert.ok(transfers.length <= 4, `expected ≤4 transfers, got ${transfers.length}`);
  // sum of inflows for each creditor should match their balance
  const inflow = new Map<string, number>();
  const outflow = new Map<string, number>();
  for (const t of transfers) {
    inflow.set(t.to,   (inflow.get(t.to)   ?? 0) + t.amount_cents);
    outflow.set(t.from, (outflow.get(t.from) ?? 0) + t.amount_cents);
  }
  assert.equal(inflow.get(u(1)),  500);
  assert.equal(inflow.get(u(2)),  200);
  assert.equal(outflow.get(u(3)), 300);
  assert.equal(outflow.get(u(4)), 250);
  assert.equal(outflow.get(u(5)), 150);
});

test('minimumTransfers: balanced ledger produces zero transfers', () => {
  assert.deepEqual(minimumTransfers([
    { user_id: u(1), balance_cents: 0 },
    { user_id: u(2), balance_cents: 0 },
  ]), []);
});
