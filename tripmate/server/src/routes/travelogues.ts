import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { openai } from '../lib/openai.js';
import { env } from '../lib/env.js';

export const traveloguesRouter = Router();
traveloguesRouter.use(requireAuth);

const CreateBody = z.object({
  trip_id: z.string().uuid(),
  photo_ids: z.array(z.string().uuid()).min(1).max(40),
  tone: z.enum(['casual', 'literary', 'concise']).default('casual'),
});

const ContentSchema = z.object({
  intro: z.string().min(1).max(1500),
  days: z.array(z.object({
    date: z.string(),
    title: z.string().min(1).max(80),
    body: z.string().min(1).max(3000),
    photo_ids: z.array(z.string().uuid()).default([]),
  })).min(1).max(40),
  outro: z.string().min(1).max(1500),
});

// =========================================================================
// POST /trips/:tripId/travelogues  — kick off generation, returns row.
// Synchronous: responds when GPT finishes (typically <30s for ≤20 photos).
// =========================================================================
traveloguesRouter.post('/:tripId/travelogues', async (req, res) => {
  const tripId = req.params.tripId;
  const userId = req.user!.id;
  const body = CreateBody.parse({ ...req.body, trip_id: tripId });

  // 1. fetch trip + photos (RLS-scoped)
  const { data: trip, error: tErr } = await req.db!
    .from('trips').select('id, title, destination, start_date, end_date')
    .eq('id', tripId).maybeSingle();
  if (tErr) throw new HttpError(400, tErr.message);
  if (!trip) throw new HttpError(404, 'trip_not_found');

  const { data: photos, error: pErr } = await req.db!
    .from('photos')
    .select('id, storage_path, taken_at, caption, created_at')
    .in('id', body.photo_ids);
  if (pErr) throw new HttpError(400, pErr.message);
  if (!photos || photos.length === 0) throw new HttpError(400, 'no_photos');

  photos.sort((a, b) => {
    const ax = a.taken_at ?? a.created_at;
    const bx = b.taken_at ?? b.created_at;
    return ax.localeCompare(bx);
  });

  // 2. signed URLs for vision input
  const { data: signed, error: sErr } = await supabaseAdmin
    .storage.from('trip-photos')
    .createSignedUrls(photos.map((p) => p.storage_path), 60 * 60);
  if (sErr) throw new HttpError(500, sErr.message);
  const urlMap = new Map(signed.map((s) => [s.path!, s.signedUrl]));

  // 3. insert row
  const { data: row, error: rErr } = await req.db!
    .from('travelogues')
    .insert({
      trip_id: tripId,
      created_by: userId,
      status: 'running',
      photo_ids: body.photo_ids,
    })
    .select().single();
  if (rErr) throw new HttpError(400, rErr.message);

  try {
    const toneHint = {
      casual: '语气轻松活泼，像朋友间聊天',
      literary: '语气文艺克制，注意意象与节奏',
      concise: '语气精炼克制，每段不超过 3 句',
    }[body.tone];

    const sys = `你是「TripMate · 旅程伴侣」的 AI 游记写手。
基于用户提供的多张旅行照片（按拍摄时间排序），写一篇结构化游记。
要求：
- ${toneHint}
- 严格输出 JSON：{ intro, days: [{ date, title, body, photo_ids }], outro }
- 每个 day 选 1-3 张最能代表当日的照片 id 填到 photo_ids
- 不许编造未在照片中出现的具体地名/菜名/人物
- 中文`;

    const photoBlocks = photos.map((p, i) => ({
      type: 'image_url' as const,
      image_url: { url: urlMap.get(p.storage_path)!, detail: 'low' as const },
      // (Note: photo metadata is in the user text below, since image_url
      //  blocks don't carry alt text in the OpenAI SDK)
    }));
    const photoMeta = photos.map((p, i) =>
      `[#${i}] id=${p.id}  taken_at=${p.taken_at ?? p.created_at}  caption=${p.caption ?? ''}`,
    ).join('\n');

    const userText = `行程标题: ${trip.title}
目的地: ${trip.destination ?? '（未填）'}
开始-结束: ${trip.start_date ?? '?'} → ${trip.end_date ?? '?'}

照片元数据 (按时间序)：
${photoMeta}

请基于以上照片生成结构化游记 JSON。photo_ids 字段必须使用上方真实的 UUID。`;

    const completion = await openai().chat.completions.create({
      model: env.OPENAI_MODEL_VISION,
      response_format: { type: 'json_object' },
      temperature: 0.6,
      messages: [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            ...photoBlocks,
          ],
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const content = ContentSchema.parse(JSON.parse(raw));

    const { data: done, error: dErr } = await supabaseAdmin
      .from('travelogues')
      .update({
        status: 'done',
        content,
        finished_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select().single();
    if (dErr) throw new Error(dErr.message);
    res.status(201).json(done);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, 'travelogue_failed');
    await supabaseAdmin.from('travelogues')
      .update({ status: 'error', error: msg, finished_at: new Date().toISOString() })
      .eq('id', row.id);
    throw new HttpError(500, 'travelogue_failed', { message: msg });
  }
});

// =========================================================================
// GET /trips/:tripId/travelogues
// =========================================================================
traveloguesRouter.get('/:tripId/travelogues', async (req, res) => {
  const { data, error } = await req.db!
    .from('travelogues')
    .select('*')
    .eq('trip_id', req.params.tripId)
    .order('created_at', { ascending: false });
  if (error) throw new HttpError(400, error.message);
  res.json(data);
});

traveloguesRouter.get('/:tripId/travelogues/:id', async (req, res) => {
  const { data, error } = await req.db!
    .from('travelogues')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw new HttpError(400, error.message);
  if (!data) throw new HttpError(404, 'not_found');
  res.json(data);
});
