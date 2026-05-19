'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-outline !py-1.5 !px-3 text-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await supabaseBrowser().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >登出</button>
  );
}
