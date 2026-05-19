// POST /api/trips/:id/travelogues — generate a structured travelogue using
// GPT-4o Vision over the supplied photo IDs. Synchronous (typically <30s).
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { chatJSON } from '@/lib/openai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const Body = z.object({
  photo_ids: z.array(z.string().uuid()).min(1).max(40),
  tone: z.enum(['casual', 'literary', 'concise']).default('casual'),
});

const Content = z.object({
  intro: z.string().min(1).max(1500),
  days: z.array(z.object({
    date: z.string(),
    title: z.string().min(1).max(80),
    body: z.string().min(1).max(3000),
    photo_ids: z.array(z.string().uuid()).default([]),
  })).min(1).max(40),
  outro: z.string().min(1).max(1500),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, supabase } = await requireUser();
  const tripId = params.id;
  const body = Body.parse(await req.json());

  const { data: trip } = await supabase
    .from('trips').select('id, title, destination, start_date, end_date')
    .eq('id', tripId).maybeSingle();
  if (!trip) return NextResponse.json({ error: 'trip_not_found' }, { status: 404 });

  const { data: photos } = await supabase
    .from('photos')
    .select('id, storage_path, taken_at, created_at, caption')
    .in('id', body.photo_ids);
  if (!photos || photos.length === 0)
    return NextResponse.json({ error: 'no_photos' }, { status: 400 });

  photos.sort((a: any, b: any) =>
    String(a.taken_at ?? a.created_at).localeCompare(String(b.taken_at ?? b.created_at)));

  const { data: signed } = await supabaseAdmin.storage.from('trip-photos')
    .createSignedUrls(photos.map((p: any) => p.storage_path), 60 * 60);
  const urlMap = new Map((signed ?? []).map((s) => [s.path!, s.signedUrl]));

  const { data: row, error: rErr } = await supabase
    .from('travelogues')
    .insert({ trip_id: tripId, created_by: user.id, status: 'running', photo_ids: body.photo_ids })
    .select().single();
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 });

  try {
    const toneHint = {
      casual: '语气轻松活泼，像朋友间聊天',
      literary: '语气文艺克制，注意意象与节奏',
      concise: '语气精炼克制，每段不超过 3 句',
    }[body.tone];

    const sys = `你是「TripMate · 旅程伴侣」的 AI 游记写手。
基于用户提供的多张旅行照片（按拍摄时间排序），写一篇结构化游记。
- ${toneHint}
- 严格输出 JSON：{ intro, days: [{ date, title, body, photo_ids }], outro }
- 每个 day 选 1-3 张最能代表当日的照片 id 填到 photo_ids
- 不许编造未在照片中出现的具体地名/菜名/人物
- 中文`;

    const photoMeta = photos.map((p: any, i) =>
      `[#${i}] id=${p.id}  taken_at=${p.taken_at ?? p.created_at}  caption=${p.caption ?? ''}`,
    ).join('\n');

    const userText = `行程标题: ${trip.title}
目的地: ${(trip as any).destination ?? '（未填）'}
开始-结束: ${(trip as any).start_date ?? '?'} → ${(trip as any).end_date ?? '?'}

照片元数据 (按时间序)：
${photoMeta}

请基于以上照片生成结构化游记 JSON。photo_ids 字段必须使用上方真实的 UUID。`;

    const userContent: any[] = [{ type: 'text', text: userText }];
    for (const p of photos as any[]) {
      userContent.push({
        type: 'image_url',
        image_url: { url: urlMap.get(p.storage_path)!, detail: 'low' },
      });
    }

    const raw = await chatJSON({
      model: process.env.OPENAI_MODEL_VISION ?? 'gpt-4o',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: userContent }],
      temperature: 0.6,
    });
    const content = Content.parse(raw);

    await supabaseAdmin.from('travelogues')
      .update({ status: 'done', content, finished_at: new Date().toISOString() })
      .eq('id', row.id);
    return NextResponse.json({ id: row.id });
  } catch (err: any) {
    await supabaseAdmin.from('travelogues')
      .update({ status: 'error', error: err.message ?? String(err), finished_at: new Date().toISOString() })
      .eq('id', row.id);
    return NextResponse.json({ error: err.message ?? 'failed' }, { status: 500 });
  }
}
