import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';

interface Candidate {
  id: string; rank: number; name: string; region: string | null;
  niche_level: number; risk_level: number; pitch: string;
  local_tips: string[]; budget_hint: string | null;
  sources: { title: string; url: string }[];
}

export const dynamic = 'force-dynamic';

export default async function DiscoverResults({ params }: { params: { id: string } }) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('discoveries')
    .select('id, status, error, candidates:discovery_candidates(*)')
    .eq('id', params.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();

  const candidates = ((data as any).candidates as Candidate[]).slice().sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-4">
      <Link href="/discover" className="text-muted text-sm">← 重新填写偏好</Link>
      <h1 className="text-2xl font-bold">候选目的地</h1>

      {(data as any).status === 'error' && (
        <div className="card p-5 text-danger">生成失败：{(data as any).error ?? '未知错误'}</div>
      )}
      {(data as any).status === 'running' && (
        <div className="card p-5 text-muted">仍在生成中，刷新页面再试。</div>
      )}
      {(data as any).status === 'done' && candidates.length === 0 && (
        <div className="card p-5 text-muted">没有结果。</div>
      )}

      {candidates.map((c) => (
        <div key={c.id} className="card p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="text-2xl font-extrabold text-brand min-w-[40px]">#{c.rank}</div>
            <div className="flex-1">
              <div className="text-lg font-bold">{c.name}</div>
              {c.region && <div className="text-sm text-muted">{c.region}</div>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill text={`小众度 ${c.niche_level}/5`} accent={c.niche_level >= 4 ? 'brand' : 'muted'} />
            <Pill
              text={`风险度 ${c.risk_level}/5`}
              accent={c.risk_level >= 4 ? 'danger' : c.risk_level >= 3 ? 'warn' : 'ok'}
            />
          </div>
          <p className="text-[15px] leading-relaxed">{c.pitch}</p>
          {c.budget_hint && (
            <div className="bg-canvas rounded-lg p-3">
              <div className="text-[11px] text-muted font-semibold mb-1">预算参考</div>
              <div className="text-sm">{c.budget_hint}</div>
            </div>
          )}
          {c.local_tips.length > 0 && (
            <div>
              <div className="text-sm font-bold mb-1">当地人才知道</div>
              <ul className="space-y-1 text-sm">
                {c.local_tips.map((t, i) => <li key={i}>• {t}</li>)}
              </ul>
            </div>
          )}
          {c.sources.length > 0 && (
            <div className="border-t border-line pt-3">
              <div className="text-[11px] text-muted font-bold mb-1">参考链接</div>
              <ul className="space-y-1 text-xs">
                {c.sources.map((s, i) => (
                  <li key={i}>
                    <a className="text-brand hover:underline" href={s.url} target="_blank" rel="noopener noreferrer">
                      [{i + 1}] {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Pill({ text, accent }: { text: string; accent: 'brand' | 'muted' | 'warn' | 'danger' | 'ok' }) {
  const map = { brand: 'border-brand text-brand', muted: 'border-muted text-muted',
    warn: 'border-warn text-warn', danger: 'border-danger text-danger', ok: 'border-ok text-ok' };
  return <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${map[accent]}`}>{text}</span>;
}
