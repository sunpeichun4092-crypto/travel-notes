// Refresh the Supabase auth cookie on every request so that pages always see
// a fresh access token. Without this, server components would occasionally
// throw "JWT expired" between the browser auto-refresh and the next request.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => res.cookies.set({ name, value, ...options }),
        remove: (name, options) => res.cookies.set({ name, value: '', ...options }),
      },
    },
  );
  await supabase.auth.getUser();
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public).*)'],
};
