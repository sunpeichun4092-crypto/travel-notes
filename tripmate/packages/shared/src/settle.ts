// =============================================================================
// Net-balance computation + minimum-transfer settlement.
//
// settleNet(expensesWithShares):
//   For each user, balance = (amount paid as payer) - (sum of their shares
//   across all expenses). Positive means others owe them; negative means
//   they owe.
//
// minimumTransfers(balances):
//   Greedy creditor-debtor pairing — pop the largest creditor + the largest
//   debtor, settle the smaller of the two, repeat. Produces at most n-1
//   transfers (which is the optimal upper bound for this problem variant).
//   For 3–8 person trips this is optimal in practice; finding the absolute
//   minimum is NP-hard in general (subset-sum reduction), but the greedy
//   bound is what users expect from apps like Splitwise.
// =============================================================================

import type { ExpenseWithShares, SettlementTransfer, UUID } from './types';

export interface UserBalance {
  user_id: UUID;
  balance_cents: number;   // > 0 = others owe me; < 0 = I owe
}

export function settleNet(expenses: ExpenseWithShares[]): UserBalance[] {
  const map = new Map<UUID, number>();
  const bump = (uid: UUID, delta: number) => {
    map.set(uid, (map.get(uid) ?? 0) + delta);
  };

  for (const exp of expenses) {
    bump(exp.payer_id, exp.amount_cents);
    let total = 0;
    for (const s of exp.shares) {
      bump(s.user_id, -s.share_cents);
      total += s.share_cents;
    }
    if (total !== exp.amount_cents) {
      throw new Error(
        `expense ${exp.id} shares sum (${total}) != amount (${exp.amount_cents})`,
      );
    }
  }
  return Array.from(map.entries()).map(([user_id, balance_cents]) => ({
    user_id,
    balance_cents,
  }));
}

export function minimumTransfers(balances: UserBalance[]): SettlementTransfer[] {
  const creditors = balances.filter((b) => b.balance_cents > 0)
    .map((b) => ({ ...b }));
  const debtors = balances.filter((b) => b.balance_cents < 0)
    .map((b) => ({ user_id: b.user_id, balance_cents: -b.balance_cents }));

  // Sort descending so largest balances net out first.
  creditors.sort((a, b) => b.balance_cents - a.balance_cents);
  debtors.sort((a, b) => b.balance_cents - a.balance_cents);

  const out: SettlementTransfer[] = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const c = creditors[i], d = debtors[j];
    const move = Math.min(c.balance_cents, d.balance_cents);
    if (move > 0) {
      out.push({ from: d.user_id, to: c.user_id, amount_cents: move });
      c.balance_cents -= move;
      d.balance_cents -= move;
    }
    if (c.balance_cents === 0) i++;
    if (d.balance_cents === 0) j++;
  }
  return out;
}
