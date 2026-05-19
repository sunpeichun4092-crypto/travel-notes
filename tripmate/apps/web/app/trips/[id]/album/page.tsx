// Album: server pulls photo rows + signs URLs (1-hour TTL), groups by date,
// then ships to a client component that handles uploads + likes.
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { AlbumClient, type PhotoGroup } from './client';

export const dynamic = 'force-dynamic';

export default async function AlbumPage({ params }: { params: { id: string } }) {
  const { user, supabase } = await requireUser();

  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, storage_path, taken_at, created_at, caption, photo_likes(user_id)')
    .eq('trip_id', params.id)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  let groups: PhotoGroup[] = [];
  if (photos && photos.length) {
    const paths = photos.map((p: any) => p.storage_path);
    const { data: signed } = await supabaseAdmin.storage.from('trip-photos')
      .createSignedUrls(paths, 60 * 60);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path!, s.signedUrl]));

    const byDate = new Map<string, PhotoGroup['items']>();
    for (const p of photos as any[]) {
      const d = String(p.taken_at ?? p.created_at).slice(0, 10);
      const arr = byDate.get(d) ?? [];
      const likes = (p.photo_likes ?? []) as { user_id: string }[];
      arr.push({
        id: p.id,
        signed_url: urlByPath.get(p.storage_path) ?? '',
        caption: p.caption,
        like_count: likes.length,
        liked_by_me: likes.some((l) => l.user_id === user.id),
      });
      byDate.set(d, arr);
    }
    groups = Array.from(byDate.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({ date, items }));
  }

  return (
    <div className="space-y-4">
      <Link href={`/trips/${params.id}`} className="text-muted text-sm">← 返回</Link>
      <h1 className="text-2xl font-bold">共享相册</h1>
      <AlbumClient tripId={params.id} initialGroups={groups} />
    </div>
  );
}
