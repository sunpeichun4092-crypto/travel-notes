// =============================================================================
// Expense splitting (integer cents — no floating-point drift).
//
// Rules
//   1. amount_cents and weights are non-negative integers.
//   2. The sum of every share returned MUST equal amount_cents.
//   3. Equal split: distribute as evenly as possible. Any remainder cents
//      (amount % n) are assigned to the FIRST `remainder` participants in
//      stable order. Caller can pass an `order` array for deterministic
//      assignment (default: input array order).
//   4. Weighted split: floor(amount * w_i / sum_w) per person, then assign
//      leftover cents to the participants with the largest fractional part
//      (ties broken by input order).
// =============================================================================

import type { UUID } from './types';

export interface SplitParticipant {
  user_id: UUID;
  weight?: number;        // only used when mode === 'weighted'
}

export interface SplitResult {
  user_id: UUID;
  share_cents: number;
}

export function splitEqual(amount_cents: number, participants: SplitParticipant[]): SplitResult[] {
  assertNonNegInt(amount_cents, 'amount_cents');
  if (participants.length === 0) throw new Error('participants must be non-empty');
  const n = participants.length;
  const base = Math.floor(amount_cents / n);
  const remainder = amount_cents - base * n;     // in [0, n)
  return participants.map((p, idx) => ({
    user_id: p.user_id,
    share_cents: base + (idx < remainder ? 1 : 0),
  }));
}

export function splitWeighted(amount_cents: number, participants: SplitParticipant[]): SplitResult[] {
  assertNonNegInt(amount_cents, 'amount_cents');
  if (participants.length === 0) throw new Error('participants must be non-empty');

  const weights = participants.map((p) => {
    const w = p.weight ?? 1;
    if (!Number.isInteger(w) || w <= 0) {
      throw new Error(`weight must be a positive integer (got ${w} for ${p.user_id})`);
    }
    return w;
  });
  const total_w = weights.reduce((a, b) => a + b, 0);

  // floor share + fractional part for remainder allocation
  const fractions: { idx: number; frac: number }[] = [];
  const out: SplitResult[] = participants.map((p, i) => {
    const exact = (amount_cents * weights[i]) / total_w;
    const floor = Math.floor(exact);
    fractions.push({ idx: i, frac: exact - floor });
    return { user_id: p.user_id, share_cents: floor };
  });

  let remainder = amount_cents - out.reduce((sum, s) => sum + s.share_cents, 0);
  // Largest fractional part wins; ties broken by lower index (stable).
  fractions.sort((a, b) => (b.frac - a.frac) || (a.idx - b.idx));
  let cursor = 0;
  while (remainder > 0) {
    out[fractions[cursor % fractions.length].idx].share_cents += 1;
    remainder -= 1;
    cursor += 1;
  }
  return out;
}

export function splitExpense(
  mode: 'equal' | 'weighted',
  amount_cents: number,
  participants: SplitParticipant[],
): SplitResult[] {
  return mode === 'weighted'
    ? splitWeighted(amount_cents, participants)
    : splitEqual(amount_cents, participants);
}

function assertNonNegInt(n: number, name: string) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer (got ${n})`);
  }
}
