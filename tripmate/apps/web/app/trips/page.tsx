// /trips — list of all trips the user belongs to. The Supabase server
// client has the user's JWT, so RLS automatically scopes to their rows.
import Link from 'next/link';
import { requireUser } from '@/lib/auth';

interface TripRow {
  id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  invite_code: string;
}

export const dynamic = 'force-dynamic';

export default async function TripsPage() {
  const { supabase } = await requireUser();
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, invite_code')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的旅程</h1>
        <div className="flex gap-2">
          <Link href="/trips/join" className="btn-outline">加入</Link>
          <Link href="/trips/new" className="btn-primary">新建</Link>
        </div>
      </div>

      {error && <div className="text-danger text-sm">{error.message}</div>}

      {(!trips || trips.length === 0) ? (
        <div className="card p-8 text-center text-muted">
          还没有旅程，点右上角「新建」开始吧。
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {(trips as TripRow[]).map((t) => (
            <Link key={t.id} href={`/trips/${t.id}`} className="card p-4 hover:border-brand transition">
              <div className="font-semibold">{t.title}</div>
              {t.destination && <div className="text-sm text-muted mt-0.5">{t.destination}</div>}
              <div className="text-xs text-muted mt-2 flex items-center justify-between">
                <span>{t.start_date ?? '未定'} → {t.end_date ?? '未定'}</span>
                <span className="px-2 py-0.5 bg-brand/10 text-brand rounded font-mono">{t.invite_code}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
