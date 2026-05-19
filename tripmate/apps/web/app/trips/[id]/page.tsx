// /trips/[id] — countdown, invite code, member list, 4 module tiles.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';

interface TripDetail {
  id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  invite_code: string;
  trip_members: Array<{
    user_id: string; role: 'owner' | 'member';
    profiles: { display_name: string | null } | null;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function TripDetailPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, invite_code, trip_members(user_id, role, profiles(display_name))')
    .eq('id', params.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();

  const trip = data as TripDetail;
  const daysLeft = trip.start_date
    ? Math.ceil((new Date(trip.start_date).getTime() - Date.now()) / 86400000)
    : null;

  const tiles: Array<[string, string, string]> = [
    ['💰', '团队记账', `/trips/${trip.id}/expenses`],
    ['📸', '共享相册', `/trips/${trip.id}/album`],
    ['📝', 'AI 游记',  `/trips/${trip.id}/travelogues`],
    ['🧭', '发现目的地', `/discover?tripId=${trip.id}`],
  ];

  return (
    <div className="space-y-6">
      <Link href="/trips" className="text-muted text-sm">← 我的旅程</Link>

      <div className="card p-5 space-y-2">
        <h1 className="text-2xl font-bold">{trip.title}</h1>
        {trip.destination && <p className="text-muted">{trip.destination}</p>}
        <p className="text-sm text-muted">
          {trip.start_date ?? '?'} → {trip.end_date ?? '?'}
          {daysLeft !== null && daysLeft > 0 && (
            <span className="ml-2 text-brand font-medium">还有 {daysLeft} 天</span>
          )}
        </p>
        <div className="pt-3 border-t border-line mt-3">
          <div className="text-xs text-muted mb-1">邀请码（分享给同行的人）</div>
          <div className="font-mono text-2xl tracking-[0.3em] text-brand">{trip.invite_code}</div>
        </div>
      </div>

      <div>
        <div className="text-sm text-muted mb-2">同行人 ({trip.trip_members.length})</div>
        <div className="flex flex-wrap gap-2">
          {trip.trip_members.map((m) => (
            <span key={m.user_id} className="px-3 py-1.5 rounded-full bg-white border border-line text-sm">
              {m.profiles?.display_name ?? '?'}
              {m.role === 'owner' && <span className="ml-1.5 text-[10px] text-brand">OWNER</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(([icon, title, href]) => (
          <Link key={href} href={href} className="card p-5 text-center hover:border-brand transition">
            <div className="text-3xl mb-2">{icon}</div>
            <div className="font-medium">{title}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
