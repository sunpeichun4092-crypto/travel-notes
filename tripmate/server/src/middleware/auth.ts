import type { Request, Response, NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseFor, supabaseAdmin } from '../lib/supabase.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email?: string };
    db?: SupabaseClient;          // RLS-scoped client
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.header('authorization');
  const token = auth?.toLowerCase().startsWith('bearer ')
    ? auth.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: 'missing_bearer_token' });

  // Validate via service-role admin call — getUser(jwt) verifies signature too.
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  req.user = { id: data.user.id, email: data.user.email ?? undefined };
  req.db = supabaseFor(token);
  next();
}
