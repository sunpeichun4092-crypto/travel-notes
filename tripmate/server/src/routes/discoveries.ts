import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { openai } from '../lib/openai.js';
import { webSearch } from '../lib/search.js';
import { env } from '../lib/env.js';

export const discoveriesRouter = Router();
discoveriesRouter.use(requireAuth);

const InputsSchema = z.object({
  base: z.string().min(1).max(80),
  budget_min_cents: z.number().int().nonnegative(),
  budget_max_cents: z.number().int().positive(),
  styles: z.array(z.string().min(1).max(20)).min(1).max(8),
  avoid: z.array(z.string().min(1).max(40)).max(10).default([]),
  duration_days: z.number().int().min(1).max(60),
  lodging_pref: z.enum(['hostel', 'hotel', 'homestay', 'mixed']),
  notes: z.string().max(400).optional(),
});

const CandidateSchema = z.object({
  name: z.string().min(1),
  region: z.string().nullable().default(null),
  niche_level: z.number().int().min(1).max(5),
  risk_level: z.number().int().min(1).max(5),
  pitch: z.string().min(1).max(500),
  local_tips: z.array(z.string().min(1).max(200)).max(8).default([]),
  budget_hint: z.string().max(200).nullable().default(null),
  source_indices: z.array(z.number().int().min(0)).max(8).default([]),
});

const CandidatesSchema = z.object({
  candidates: z.array(CandidateSchema).min(3).max(10),
});

// =========================================================================
// POST /discoveries  — create + run synchronously (returns when ready).
// For 5–7 candidates GPT typically responds in <15s, which is acceptable
// for a Wizard "submit" interaction.
// =========================================================================
discoveriesRouter.post('/', async (req, res) => {
  const inputs = InputsSchema.parse(req.body);
  const userId = req.user!.id;

  // 1. insert pending row
  const { data: row, error: e1 } = await req.db!
    .from('discoveries')
    .insert({ created_by: userId, inputs, status: 'running' })
    .select()
    .single();
  if (e1) throw new HttpError(400, e1.message);

  try {
    // 2. fetch real-world snippets to ground GPT
    const queries = [
      `${inputs.styles.join(' ')} 旅行 适合 ${inputs.duration_days} 天`,
      `${inputs.base} 出发 ${inputs.duration_days} 天 ${inputs.styles[0]}`,
      `小众 目的地 ${inputs.styles.join(' ')}`,
    ];
    const searchResults = (await Promise.all(queries.map((q) => webSearch(q, 5)))).flat();
    const dedupedByUrl = Array.from(new Map(searchResults.map((s) => [s.url, s])).values()).slice(0, 12);

    const sourceList = dedupedByUrl.map((s, i) => `[${i}] ${s.title} — ${s.url}\n    ${s.snippet}`).join('\n');

    // 3. ask GPT to produce structured candidates
    const sys = `你是「TripMate · 旅程伴侣」的目的地策划师。基于用户的偏好和提供的网页搜索片段，给出 5-7 个**真实可达、不重复**的目的地候选。
要求：
- 必须以有效 JSON 输出，遵循给定 schema
- niche_level 1=大众 5=小众；risk_level 1=安全 5=高风险
- local_tips 写当地人才知道的实用建议（避坑、季节、隐藏吃喝等）
- source_indices 引用 SOURCES 列表中相关项目的编号
- 严禁编造来源链接，没有依据时 source_indices 留空
- 中文回答`;

    const user = `用户偏好：
- 出发基地: ${inputs.base}
- 预算 (人民币分): ${inputs.budget_min_cents} - ${inputs.budget_max_cents}
- 风格: ${inputs.styles.join('、')}
- 避雷: ${inputs.avoid.join('、') || '无'}
- 时长: ${inputs.duration_days} 天
- 住宿偏好: ${inputs.lodging_pref}
- 备注: ${inputs.notes ?? '无'}

SOURCES (网页搜索结果，仅供参考；不一定每条都用得上):
${sourceList || '（无可用搜索结果，请用通识知识谨慎给建议，并在 budget_hint/local_tips 中说明缺乏外部参考）'}

按 JSON schema 输出，字段 candidates 是数组，每项是
{ name, region, niche_level, risk_level, pitch, local_tips, budget_hint, source_indices }`;

    const completion = await openai().chat.completions.create({
      model: env.OPENAI_MODEL_TEXT,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = CandidatesSchema.parse(JSON.parse(raw));

    // 4. persist candidates with resolved sources
    const candidateRows = parsed.candidates.map((c, i) => ({
      discovery_id: row.id,
      rank: i + 1,
      name: c.name,
      region: c.region,
      niche_level: c.niche_level,
      risk_level: c.risk_level,
      pitch: c.pitch,
      local_tips: c.local_tips,
      budget_hint: c.budget_hint,
      sources: c.source_indices
        .map((idx) => dedupedByUrl[idx])
        .filter(Boolean)
        .map((s) => ({ title: s.title, url: s.url })),
    }));

    const { error: cErr } = await supabaseAdmin
      .from('discovery_candidates').insert(candidateRows);
    if (cErr) throw new Error(cErr.message);

    const { data: done } = await supabaseAdmin
      .from('discoveries')
      .update({ status: 'done', finished_at: new Date().toISOString() })
      .eq('id', row.id)
      .select()
      .single();

    res.status(201).json({ ...done, candidates: candidateRows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, 'discovery_failed');
    await supabaseAdmin.from('discoveries')
      .update({ status: 'error', error: msg, finished_at: new Date().toISOString() })
      .eq('id', row.id);
    throw new HttpError(500, 'discovery_failed', { message: msg });
  }
});

// =========================================================================
// GET /discoveries  — list runs by current user
// =========================================================================
discoveriesRouter.get('/', async (req, res) => {
  const { data, error } = await req.db!
    .from('discoveries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new HttpError(400, error.message);
  res.json(data);
});

// =========================================================================
// GET /discoveries/:id  — with candidates
// =========================================================================
discoveriesRouter.get('/:id', async (req, res) => {
  const { data, error } = await req.db!
    .from('discoveries')
    .select('*, candidates:discovery_candidates(*)')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw new HttpError(400, error.message);
  if (!data) throw new HttpError(404, 'not_found');
  res.json(data);
});
