// POST /api/trips/:id/photos/sign-upload
// Body: { files: [{ ext, width?, height?, taken_at? }] }
// Returns: { uploads: [{ photo_id, storage_path, signed_url, token }] }
//
// We require an authenticated user who is a member of the trip — we check
// membership via the user-scoped client (RLS enforces the gate), then use
// the service-role client to create the signed upload URLs (anon key can't
// sign uploads to a private bucket).
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const Body = z.object({
  files: z.array(z.object({
    ext: z.string().min(1).max(5),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
    taken_at: z.string().optional(),
  })).min(1).max(40),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { supabase } = await requireUser();
  const tripId = params.id;

  // membership check via RLS
  const { data: trip } = await supabase.from('trips').select('id').eq('id', tripId).maybeSingle();
  if (!trip) return NextResponse.json({ error: 'not_a_member' }, { status: 403 });

  const body = Body.parse(await req.json());

  const uploads: Array<{ photo_id: string; storage_path: string; signed_url: string; token: string }> = [];
  for (const f of body.files) {
    const photoId = crypto.randomUUID();
    const ext = f.ext.replace(/[^a-z0-9]/gi, '').slice(0, 4) || 'jpg';
    const path = `${tripId}/${photoId}.${ext}`;
    const { data, error } = await supabaseAdmin.storage
      .from('trip-photos').createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    uploads.push({
      photo_id: photoId,
      storage_path: path,
      signed_url: data.signedUrl,
      token: data.token,
    });
  }
  return NextResponse.json({ uploads });
}
