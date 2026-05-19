// POST /api/discoveries — runs the wizard end-to-end synchronously, returns
// the row + candidates. The expensive parts (search + GPT) take 10–25s, so
// we set a longer route timeout. Vercel default Hobby is 10s; Pro is 60s.
// On Hobby tier you can shorten by reducing N candidates or N searches.
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { webSearch } from '@/lib/search';
import { chatJSON } from '@/lib/openai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const Inputs = z.object({
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
const Candidates = z.object({ candidates: z.array(CandidateSchema).min(3).max(10) });

export async function POST(req: NextRequest) {
  const { user, supabase } = await requireUser();
  const inputs = Inputs.parse(await req.json());

  // 1. row
  const { data: row, error: e1 } = await supabase
    .from('discoveries')
    .insert({ created_by: user.id, inputs, status: 'running' })
    .select().single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });

  try {
    // 2. ground with web search
    const queries = [
      `${inputs.styles.join(' ')} 旅行 适合 ${inputs.duration_days} 天`,
      `${inputs.base} 出发 ${inputs.duration_days} 天 ${inputs.styles[0]}`,
      `小众 目的地 ${inputs.styles.join(' ')}`,
    ];
    const found = (await Promise.all(queries.map((q) => webSearch(q, 5)))).flat();
    const sources = Array.from(new Map(found.map((s) => [s.url, s])).values()).slice(0, 12);
    const sourceList = sources
      .map((s, i) => `[${i}] ${s.title} — ${s.url}\n    ${s.snippet}`).join('\n');

    // 3. GPT
    const sys = `你是「TripMate · 旅程伴侣」的目的地策划师。基于用户的偏好和提供的网页搜索片段，给出 5-7 个**真实可达、不重复**的目的地候选。
要求：
- 必须以有效 JSON 输出，遵循给定 schema
- niche_level 1=大众 5=小众；risk_level 1=安全 5=高风险
- local_tips 写当地人才知道的实用建议
- source_indices 引用 SOURCES 列表中相关项目的编号
- 严禁编造来源链接，没有依据时 source_indices 留空
- 中文回答`;

    const userMsg = `用户偏好：
- 出发基地: ${inputs.base}
- 预算 (人民币分): ${inputs.budget_min_cents} - ${inputs.budget_max_cents}
- 风格: ${inputs.styles.join('、')}
- 避雷: ${inputs.avoid.join('、') || '无'}
- 时长: ${inputs.duration_days} 天
- 住宿偏好: ${inputs.lodging_pref}
- 备注: ${inputs.notes ?? '无'}

SOURCES:
${sourceList || '（无可用搜索结果）'}

按 schema 输出 candidates 数组。`;

    const raw = await chatJSON({
      model: process.env.OPENAI_MODEL_TEXT ?? 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      temperature: 0.7,
    });
    const parsed = Candidates.parse(raw);

    // 4. persist
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
      sources: c.source_indices.map((idx) => sources[idx])
        .filter(Boolean).map((s) => ({ title: s.title, url: s.url })),
    }));
    await supabaseAdmin.from('discovery_candidates').insert(candidateRows);
    await supabaseAdmin.from('discoveries')
      .update({ status: 'done', finished_at: new Date().toISOString() })
      .eq('id', row.id);
    return NextResponse.json({ id: row.id });
  } catch (err: any) {
    await supabaseAdmin.from('discoveries')
      .update({ status: 'error', error: err.message ?? String(err), finished_at: new Date().toISOString() })
      .eq('id', row.id);
    return NextResponse.json({ error: err.message ?? 'failed' }, { status: 500 });
  }
}
