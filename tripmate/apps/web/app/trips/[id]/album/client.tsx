'use client';
// Client-side: file picker + EXIF date extraction + 3-step upload.
// Optimistic likes — fall back to a router refresh if the toggle fails.
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import exifr from 'exifr';
import { supabaseBrowser } from '@/lib/supabase-browser';

export interface PhotoItem {
  id: string;
  signed_url: string;
  caption: string | null;
  like_count: number;
  liked_by_me: boolean;
}
export interface PhotoGroup { date: string; items: PhotoItem[] }

export function AlbumClient({
  tripId, initialGroups,
}: { tripId: string; initialGroups: PhotoGroup[] }) {
  const router = useRouter();
  const [groups, setGroups] = useState<PhotoGroup[]>(initialGroups);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickAndUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      // 1. read EXIF + dimensions per file (best-effort)
      const meta = await Promise.all(files.map(async (f) => {
        const ext = (f.name.split('.').pop() ?? 'jpg').toLowerCase();
        let taken_at: string | undefined;
        try {
          const x = await exifr.parse(f, ['DateTimeOriginal']);
          if (x?.DateTimeOriginal instanceof Date) taken_at = x.DateTimeOriginal.toISOString();
        } catch { /* not a JPEG with EXIF — leave taken_at undefined */ }
        return { file: f, ext, taken_at };
      }));

      // 2. ask server for signed upload URLs
      const signResp = await fetch(`/api/trips/${tripId}/photos/sign-upload`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          files: meta.map((m) => ({ ext: m.ext, taken_at: m.taken_at })),
        }),
      });
      if (!signResp.ok) throw new Error(`sign upload failed: ${await signResp.text()}`);
      const { uploads } = await signResp.json() as {
        uploads: Array<{ photo_id: string; storage_path: string; signed_url: string }>
      };

      // 3. PUT each binary to its signed URL
      for (let i = 0; i < meta.length; i++) {
        const r = await fetch(uploads[i].signed_url, { method: 'PUT', body: meta[i].file });
        if (!r.ok) throw new Error(`upload ${i} failed (${r.status})`);
      }

      // 4. register rows. Album row must exist first; upsert by trip_id.
      const supabase = supabaseBrowser();
      const { data: alb, error: aErr } = await supabase
        .from('albums')
        .upsert({ trip_id: tripId, name: '默认相册' }, { onConflict: 'trip_id' })
        .select('id').single();
      if (aErr) throw aErr;

      const { data: { user } } = await supabase.auth.getUser();
      const rows = uploads.map((u, i) => ({
        id: u.photo_id,
        trip_id: tripId,
        album_id: alb.id,
        uploader_id: user!.id,
        storage_path: u.storage_path,
        taken_at: meta[i].taken_at ?? null,
      }));
      const { error: pErr } = await supabase.from('photos').insert(rows);
      if (pErr) throw pErr;

      router.refresh();
    } catch (e: any) {
      alert('上传失败：' + e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function toggleLike(photoId: string) {
    const supabase = supabaseBrowser();
    // optimistic update
    setGroups((gs) => gs.map((g) => ({
      ...g,
      items: g.items.map((p) => p.id !== photoId ? p : ({
        ...p,
        liked_by_me: !p.liked_by_me,
        like_count: p.like_count + (p.liked_by_me ? -1 : 1),
      })),
    })));
    const { data: { user } } = await supabase.auth.getUser();
    const target = groups.flatMap((g) => g.items).find((p) => p.id === photoId);
    if (!target || !user) return;
    if (target.liked_by_me) {
      await supabase.from('photo_likes').delete()
        .eq('photo_id', photoId).eq('user_id', user.id);
    } else {
      await supabase.from('photo_likes').insert({ photo_id: photoId, user_id: user.id });
    }
    // Don't router.refresh() — that'd flicker. Counts will resync on next page load.
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 flex items-center justify-between">
        <div className="text-sm text-muted">支持多选；JPEG 会读取拍摄时间用于按日分组。</div>
        <label className={`btn-primary cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
          {busy ? '上传中...' : '上传照片'}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={pickAndUpload}
            disabled={busy}
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <div className="card p-8 text-center text-muted">还没有照片，点右上角「上传照片」。</div>
      ) : groups.map((g) => (
        <section key={g.date}>
          <div className="text-xs text-muted font-semibold mb-2">{g.date}</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {g.items.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleLike(p.id)}
                className="relative aspect-square rounded-lg overflow-hidden bg-line group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.signed_url} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-1 right-1 bg-black/55 text-white text-[11px] px-1.5 py-0.5 rounded">
                  {p.liked_by_me ? '❤️' : '🤍'} {p.like_count}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
