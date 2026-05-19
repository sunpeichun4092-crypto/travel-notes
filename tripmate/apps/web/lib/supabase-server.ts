// Server Supabase client. Reads the user's auth cookie via next/headers and
// forwards the access token so RLS policies see the right user.
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        // We don't write cookies from server components — only from route
        // handlers and server actions, which use a different client below.
        set() {},
        remove() {},
      },
    },
  );
}

// Used inside route handlers / server actions where Set-Cookie is allowed.
export function supabaseRoute() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value; },
        set(name, value, options) { cookieStore.set({ name, value, ...options }); },
        remove(name, options) { cookieStore.set({ name, value: '', ...options }); },
      },
    },
  );
}

import { createClient } from '@supabase/supabase-js';
// Service-role client for privileged ops (signing storage URLs, server-side
// trip lookups by invite code). NEVER expose the key to the browser.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
