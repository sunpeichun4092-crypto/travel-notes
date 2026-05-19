import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  splitExpense, settleNet, minimumTransfers,
  type ExpenseWithShares,
} from '@tripmate/shared';

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

const Participant = z.object({
  user_id: z.string().uuid(),
  weight: z.number().int().positive().optional(),
  share_cents: z.number().int().nonnegative().optional(),
});

const CreateExpenseBody = z.object({
  trip_id: z.string().uuid(),
  payer_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
  currency: z.string().min(3).max(3).default('CNY'),
  description: z.string().max(200).optional(),
  category: z.string().max(40).optional(),
  spent_at: z.string().datetime().optional(),
  split_mode: z.enum(['equal', 'weighted']),
  participants: z.array(Participant).min(1),
});

// =========================================================================
// POST /trips/:tripId/expenses
// =========================================================================
expensesRouter.post('/:tripId/expenses', async (req, res) => {
  const tripId = req.params.tripId;
  const body = CreateExpenseBody.parse({ ...req.body, trip_id: tripId });

  // Compute shares (server-side, even if client sent share_cents — we accept
  // override only when split_mode === 'equal' is false AND every participant
  // sent a share_cents value AND they sum to amount_cents).
  let shares: { user_id: string; share_cents: number }[];
  const allCustom = body.participants.every((p) => typeof p.share_cents === 'number');
  const customSum = body.participants.reduce((a, p) => a + (p.share_cents ?? 0), 0);
  if (allCustom && customSum === body.amount_cents) {
    shares = body.participants.map((p) => ({
      user_id: p.user_id,
      share_cents: p.share_cents!,
    }));
  } else {
    shares = splitExpense(
      body.split_mode,
      body.amount_cents,
      body.participants.map((p) => ({ user_id: p.user_id, weight: p.weight })),
    );
  }

  const { data: expense, error: eErr } = await req.db!
    .from('expenses')
    .insert({
      trip_id: tripId,
      payer_id: body.payer_id,
      amount_cents: body.amount_cents,
      currency: body.currency,
      description: body.description,
      category: body.category,
      spent_at: body.spent_at ?? new Date().toISOString(),
      split_mode: body.split_mode,
      created_by: req.user!.id,
    })
    .select()
    .single();
  if (eErr) throw new HttpError(400, eErr.message);

  const sharesRows = shares.map((s) => ({ expense_id: expense.id, ...s }));
  const { error: sErr } = await req.db!.from('expense_shares').insert(sharesRows);
  if (sErr) {
    // best-effort cleanup
    await req.db!.from('expenses').delete().eq('id', expense.id);
    throw new HttpError(400, sErr.message);
  }

  res.status(201).json({ ...expense, shares: sharesRows });
});

// =========================================================================
// GET /trips/:tripId/expenses
// =========================================================================
expensesRouter.get('/:tripId/expenses', async (req, res) => {
  const tripId = req.params.tripId;
  const { data: expenses, error: eErr } = await req.db!
    .from('expenses')
    .select('*, shares:expense_shares(user_id, share_cents)')
    .eq('trip_id', tripId)
    .order('spent_at', { ascending: false });
  if (eErr) throw new HttpError(400, eErr.message);
  res.json(expenses);
});

// =========================================================================
// DELETE /trips/:tripId/expenses/:id
// =========================================================================
expensesRouter.delete('/:tripId/expenses/:id', async (req, res) => {
  const { error } = await req.db!
    .from('expenses')
    .delete()
    .eq('id', req.params.id);
  if (error) throw new HttpError(400, error.message);
  res.json({ ok: true });
});

// =========================================================================
// GET /trips/:tripId/settlement
//   → { balances, transfers }
// =========================================================================
expensesRouter.get('/:tripId/settlement', async (req, res) => {
  const tripId = req.params.tripId;
  const { data: rows, error } = await req.db!
    .from('expenses')
    .select(`
      id, trip_id, payer_id, amount_cents, currency, description, category,
      spent_at, split_mode, created_by, created_at,
      shares:expense_shares(expense_id, user_id, share_cents)
    `)
    .eq('trip_id', tripId);
  if (error) throw new HttpError(400, error.message);

  const expenses = (rows ?? []) as unknown as ExpenseWithShares[];
  const balances = settleNet(expenses);
  const transfers = minimumTransfers(balances);
  res.json({ balances, transfers });
});
