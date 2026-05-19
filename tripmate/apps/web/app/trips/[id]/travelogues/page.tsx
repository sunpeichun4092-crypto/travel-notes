// /trips/:id/travelogues — list existing AI travelogues + a "new" button
// that opens a photo picker. Server fetches both rows and signed thumbnails.
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { TraveloguesClient, type ThumbnailMap } from './client';

export const dynamic = 'force-dynamic';

interface TravelogueRow {
  id: string; status: 'running' | 'done' | 'error';
  created_at: string; photo_ids: string[];
  content: { intro: string } | null; error: string | null;
}

export default async function TraveloguesPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireUser();

  const [travQ, photoQ] = await Promise.all([
    supabase
      .from('travelogues')
      .select('id, status, created_at, photo_ids, content, error')
      .eq('trip_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('photos')
      .select('id, storage_path, taken_at, created_at')
      .eq('trip_id', params.id),
  ]);
  if (travQ.error) throw new Error(travQ.error.message);
  if (photoQ.error) throw new Error(photoQ.error.message);

  // sign thumbnails for the picker
  let thumbs: ThumbnailMap = {};
  if (photoQ.data?.length) {
    const { data: signed } = await supabaseAdmin.storage.from('trip-photos')
      .createSignedUrls(photoQ.data.map((p: any) => p.storage_path), 60 * 60);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path!, s.signedUrl]));
    for (const p of photoQ.data as any[]) {
      thumbs[p.id] = {
        url: urlByPath.get(p.storage_path) ?? '',
        date: String(p.taken_at ?? p.created_at).slice(0, 10),
      };
    }
  }

  return (
    <div className="space-y-4">
      <Link href={`/trips/${params.id}`} className="text-muted text-sm">← 返回</Link>
      <h1 className="text-2xl font-bold">AI 游记</h1>

      <TraveloguesClient
        tripId={params.id}
        travelogues={(travQ.data ?? []) as TravelogueRow[]}
        thumbs={thumbs}
      />
    </div>
  );
}
