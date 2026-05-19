import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service-role client — bypasses RLS. Use only for trusted server-side ops:
// invite-code redemption, signed URLs, AI background jobs.
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// User-scoped client — JWT is forwarded so RLS sees the calling user.
export function supabaseFor(jwt: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
