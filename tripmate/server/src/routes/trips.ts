import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { normalizeInviteCode } from '@tripmate/shared';

export const tripsRouter = Router();
tripsRouter.use(requireAuth);

const CreateTripBody = z.object({
  title: z.string().min(1).max(80),
  destination: z.string().max(80).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cover_url: z.string().url().optional(),
  currency: z.string().min(3).max(3).default('CNY'),
});

// =========================================================================
// POST /trips  — create a new trip; creator becomes owner.
// =========================================================================
tripsRouter.post('/', async (req, res) => {
  const body = CreateTripBody.parse(req.body);
  const userId = req.user!.id;

  const { data: trip, error: tErr } = await req.db!
    .from('trips')
    .insert({ ...body, created_by: userId })
    .select()
    .single();
  if (tErr) throw new HttpError(400, tErr.message);

  // owner row — RLS allows self-insert on trip_members
  const { error: mErr } = await req.db!
    .from('trip_members')
    .insert({ trip_id: trip.id, user_id: userId, role: 'owner' });
  if (mErr) throw new HttpError(400, mErr.message);

  res.status(201).json(trip);
});

// =========================================================================
// GET /trips  — list trips the caller is a member of, with members embedded.
// =========================================================================
tripsRouter.get('/', async (req, res) => {
  const { data, error } = await req.db!
    .from('trips')
    .select('*, trip_members(role, weight, joined_at, user_id, profiles:profiles!inner(id, display_name, avatar_url))')
    .order('created_at', { ascending: false });
  if (error) throw new HttpError(400, error.message);
  res.json(data);
});

// =========================================================================
// GET /trips/:id  — single trip with members.
// =========================================================================
tripsRouter.get('/:id', async (req, res) => {
  const { data, error } = await req.db!
    .from('trips')
    .select('*, trip_members(role, weight, joined_at, user_id, profiles(id, display_name, avatar_url))')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw new HttpError(400, error.message);
  if (!data) throw new HttpError(404, 'trip_not_found');
  res.json(data);
});

// =========================================================================
// PATCH /trips/:id
// =========================================================================
tripsRouter.patch('/:id', async (req, res) => {
  const body = CreateTripBody.partial().parse(req.body);
  const { data, error } = await req.db!
    .from('trips')
    .update(body)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw new HttpError(400, error.message);
  res.json(data);
});

// =========================================================================
// POST /trips/:id/regenerate-invite  — owner only
// =========================================================================
tripsRouter.post('/:id/regenerate-invite', async (req, res) => {
  // RLS allows update only for members; owner role check happens implicitly
  // at the DB level via the policy. We use admin to call the SQL function.
  const { data: trip, error: e1 } = await req.db!
    .from('trips').select('id').eq('id', req.params.id).maybeSingle();
  if (e1) throw new HttpError(400, e1.message);
  if (!trip) throw new HttpError(404, 'trip_not_found');

  // generate a fresh code via SQL function (uniqueness retry inside)
  let attempts = 0;
  while (attempts++ < 5) {
    const { data: codeRow } = await supabaseAdmin
      .rpc('gen_invite_code') as { data: string | null };
    const code = codeRow ?? null;
    if (!code) break;
    const { data, error } = await supabaseAdmin
      .from('trips')
      .update({ invite_code: code })
      .eq('id', req.params.id)
      .select('invite_code')
      .single();
    if (!error && data) return res.json({ invite_code: data.invite_code });
  }
  throw new HttpError(500, 'invite_code_collision');
});

// =========================================================================
// POST /trips/join  — join via 6-char code (uses service role to bypass RLS
// for the trip lookup, then inserts membership as the calling user).
// =========================================================================
const JoinBody = z.object({ invite_code: z.string().min(1) });

tripsRouter.post('/join', async (req, res) => {
  const { invite_code } = JoinBody.parse(req.body);
  const code = normalizeInviteCode(invite_code);
  if (code.length !== 6) throw new HttpError(400, 'invalid_invite_code');

  const userId = req.user!.id;

  const { data: trip, error: tErr } = await supabaseAdmin
    .from('trips').select('id').eq('invite_code', code).maybeSingle();
  if (tErr) throw new HttpError(500, tErr.message);
  if (!trip) throw new HttpError(404, 'invite_code_not_found');

  // Idempotent membership insert
  const { error: mErr } = await supabaseAdmin
    .from('trip_members')
    .upsert({ trip_id: trip.id, user_id: userId, role: 'member' },
            { onConflict: 'trip_id,user_id', ignoreDuplicates: true });
  if (mErr) throw new HttpError(400, mErr.message);

  res.json({ trip_id: trip.id });
});

// =========================================================================
// DELETE /trips/:id/members/:userId  — owner removes member, or member self-removes
// =========================================================================
tripsRouter.delete('/:id/members/:userId', async (req, res) => {
  const { id, userId } = req.params;
  const { error } = await req.db!
    .from('trip_members')
    .delete()
    .eq('trip_id', id)
    .eq('user_id', userId);
  if (error) throw new HttpError(400, error.message);
  res.json({ ok: true });
});
