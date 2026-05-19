// Singleton Supabase client for the browser. Uses @supabase/ssr so that
// auth tokens persist in cookies (rather than localStorage), which lets
// server components read the same session.
'use client';
import { createBrowserClient } from '@supabase/ssr';

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
