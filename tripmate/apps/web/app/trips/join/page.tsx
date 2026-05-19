// /trips/join — Look up trip by invite_code (service role, since the user
// isn't a member yet and RLS would hide the row), then upsert membership
// using the user's RLS-scoped client. Idempotent: rejoining is a no-op.
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { normalizeInviteCode, isValidInviteCode } from '@tripmate/shared';

async function joinTrip(formData: FormData) {
  'use server';
  const { user, supabase } = await requireUser();
  const code = normalizeInviteCode(String(formData.get('code') ?? ''));
  if (!isValidInviteCode(code)) throw new Error('邀请码格式不对');

  const { data: trip, error } = await supabaseAdmin
    .from('trips').select('id').eq('invite_code', code).maybeSingle();
  if (error) throw new Error(error.message);
  if (!trip) throw new Error('找不到这个邀请码');

  await supabase.from('trip_members')
    .upsert({ trip_id: trip.id, user_id: user.id, role: 'member' }, { onConflict: 'trip_id,user_id' });

  redirect(`/trips/${trip.id}`);
}

export default async function JoinTripPage() {
  await requireUser();
  return (
    <div className="max-w-md mx-auto">
      <Link href="/trips" className="text-muted text-sm">← 返回</Link>
      <h1 className="text-2xl font-bold mt-3 mb-1">加入旅程</h1>
      <p className="text-sm text-muted mb-6">输入同行人分享给你的 6 位邀请码。</p>
      <form action={joinTrip} className="card p-5 space-y-4">
        <div>
          <label className="label-sm">邀请码</label>
          <input
            className="input font-mono tracking-[0.4em] uppercase text-center text-xl"
            name="code" required maxLength={6} placeholder="ABCDEF"
          />
        </div>
        <button className="btn-primary w-full">加入</button>
      </form>
    </div>
  );
}
