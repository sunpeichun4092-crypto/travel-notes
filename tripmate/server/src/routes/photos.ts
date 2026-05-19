import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const photosRouter = Router();
photosRouter.use(requireAuth);

const SignUploadBody = z.object({
  files: z.array(z.object({
    ext: z.string().regex(/^[a-zA-Z0-9]{1,8}$/),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    taken_at: z.string().datetime().optional(),
  })).min(1).max(20),
});

// =========================================================================
// POST /trips/:tripId/photos/sign-upload
//   → [{ photo_id, storage_path, signed_url }, ...]
// Mobile uploads each file directly to Storage with these signed URLs,
// then calls POST /trips/:tripId/photos to register the rows.
// =========================================================================
photosRouter.post('/:tripId/photos/sign-upload', async (req, res) => {
  const tripId = req.params.tripId;
  const { files } = SignUploadBody.parse(req.body);
  const userId = req.user!.id;

  // Verify membership via RLS-scoped client
  const { data: trip } = await req.db!
    .from('trips').select('id').eq('id', tripId).maybeSingle();
  if (!trip) throw new HttpError(403, 'not_a_member');

  const out: Array<{ photo_id: string; storage_path: string; signed_url: string; token: string }> = [];
  for (const f of files) {
    const photoId = randomUUID();
    const storagePath = `${tripId}/${photoId}.${f.ext.toLowerCase()}`;
    const { data: signed, error } = await supabaseAdmin
      .storage.from('trip-photos')
      .createSignedUploadUrl(storagePath);
    if (error || !signed) throw new HttpError(500, error?.message ?? 'sign_failed');
    out.push({
      photo_id: photoId,
      storage_path: storagePath,
      signed_url: signed.signedUrl,
      token: signed.token,
    });
  }
  res.json({ uploads: out, uploader_id: userId });
});

const RegisterBody = z.object({
  photos: z.array(z.object({
    photo_id: z.string().uuid(),
    storage_path: z.string().min(1),
    taken_at: z.string().datetime().nullable().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    caption: z.string().max(200).optional(),
  })).min(1),
});

// =========================================================================
// POST /trips/:tripId/photos  — register uploaded files in DB.
// =========================================================================
photosRouter.post('/:tripId/photos', async (req, res) => {
  const tripId = req.params.tripId;
  const userId = req.user!.id;
  const body = RegisterBody.parse(req.body);

  // ensure album exists
  const { data: album, error: aErr } = await req.db!
    .from('albums')
    .upsert({ trip_id: tripId, title: '行程相册' }, { onConflict: 'trip_id' })
    .select()
    .single();
  if (aErr) throw new HttpError(400, aErr.message);

  const rows = body.photos.map((p) => ({
    id: p.photo_id,
    album_id: album.id,
    trip_id: tripId,
    uploader_id: userId,
    storage_path: p.storage_path,
    taken_at: p.taken_at ?? null,
    width: p.width ?? null,
    height: p.height ?? null,
    caption: p.caption ?? null,
  }));

  const { data, error } = await req.db!.from('photos').insert(rows).select();
  if (error) throw new HttpError(400, error.message);
  res.status(201).json(data);
});

// =========================================================================
// GET /trips/:tripId/photos  — group by date, with signed URLs + like counts.
// =========================================================================
photosRouter.get('/:tripId/photos', async (req, res) => {
  const tripId = req.params.tripId;

  const { data: photos, error } = await req.db!
    .from('photos')
    .select('id, album_id, trip_id, uploader_id, storage_path, taken_at, width, height, caption, created_at')
    .eq('trip_id', tripId);
  if (error) throw new HttpError(400, error.message);

  // batch sign URLs (1 hour validity)
  const paths = (photos ?? []).map((p) => p.storage_path);
  let urlMap = new Map<string, string>();
  if (paths.length) {
    const { data: signed, error: sErr } = await supabaseAdmin
      .storage.from('trip-photos')
      .createSignedUrls(paths, 60 * 60);
    if (sErr) throw new HttpError(500, sErr.message);
    urlMap = new Map(signed.map((s) => [s.path!, s.signedUrl]));
  }

  // like counts
  const { data: likes } = await req.db!
    .from('photo_likes').select('photo_id, user_id');
  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const l of likes ?? []) {
    likeCount.set(l.photo_id, (likeCount.get(l.photo_id) ?? 0) + 1);
    if (l.user_id === req.user!.id) likedByMe.add(l.photo_id);
  }

  // group by date
  const grouped = new Map<string, any[]>();
  for (const p of (photos ?? [])
       .map((p) => ({
         ...p,
         signed_url: urlMap.get(p.storage_path) ?? '',
         like_count: likeCount.get(p.id) ?? 0,
         liked_by_me: likedByMe.has(p.id),
       }))
       .sort((a, b) => {
         const ax = a.taken_at ?? a.created_at;
         const bx = b.taken_at ?? b.created_at;
         return bx.localeCompare(ax);
       })) {
    const date = (p.taken_at ?? p.created_at).slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(p);
  }
  res.json({
    groups: Array.from(grouped.entries()).map(([date, items]) => ({ date, items })),
  });
});

// =========================================================================
// POST /photos/:id/like  /  DELETE /photos/:id/like
// =========================================================================
photosRouter.post('/photos/:id/like', async (req, res) => {
  const { error } = await req.db!.from('photo_likes')
    .upsert({ photo_id: req.params.id, user_id: req.user!.id });
  if (error) throw new HttpError(400, error.message);
  res.json({ ok: true });
});

photosRouter.delete('/photos/:id/like', async (req, res) => {
  const { error } = await req.db!.from('photo_likes')
    .delete()
    .eq('photo_id', req.params.id)
    .eq('user_id', req.user!.id);
  if (error) throw new HttpError(400, error.message);
  res.json({ ok: true });
});
