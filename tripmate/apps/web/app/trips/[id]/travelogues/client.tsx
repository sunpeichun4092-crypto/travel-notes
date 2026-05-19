'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export type ThumbnailMap = Record<string, { url: string; date: string }>;
type Tone = 'casual' | 'literary' | 'concise';
const TONE_LABEL: Record<Tone, string> = { casual: '轻松', literary: '文艺', concise: '精炼' };

interface TravelogueRow {
  id: string; status: 'running' | 'done' | 'error';
  created_at: string; photo_ids: string[];
  content: { intro: string } | null; error: string | null;
}

export function TraveloguesClient({
  tripId, travelogues, thumbs,
}: { tripId: string; travelogues: TravelogueRow[]; thumbs: ThumbnailMap }) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tone, setTone] = useState<Tone>('casual');
  const [busy, setBusy] = useState(false);

  const photoCount = Object.keys(thumbs).length;
  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [pid, info] of Object.entries(thumbs)) {
      const arr = m.get(info.date) ?? [];
      arr.push(pid);
      m.set(info.date, arr);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [thumbs]);

  function toggle(pid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else if (next.size >= 40) return prev;
      else next.add(pid);
      return next;
    });
  }

  async function generate() {
    if (selected.size === 0) return alert('请至少选 1 张');
    setBusy(true);
    try {
      const r = await fetch(`/api/trips/${tripId}/travelogues`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ photo_ids: Array.from(selected), tone }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? '生成失败');
      const { id } = await r.json();
      router.replace(`/trips/${tripId}/travelogues/${id}`);
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setPickerOpen(true)} disabled={photoCount === 0}>
          {photoCount === 0 ? '需要先上传照片' : '生成新游记'}
        </button>
      </div>

      {travelogues.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          还没有 AI 游记。{photoCount > 0 ? '点右上「生成新游记」开始。' : '先去相册上传几张照片。'}
        </div>
      ) : (
        <div className="space-y-2">
          {travelogues.map((t) => (
            <Link
              key={t.id}
              href={t.status === 'done' ? `/trips/${tripId}/travelogues/${t.id}` : '#'}
              className={`card p-4 block ${t.status === 'done' ? 'hover:border-brand transition' : 'opacity-80'}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted font-semibold">{t.created_at.slice(0, 16).replace('T', ' ')}</span>
                <Badge status={t.status} />
              </div>
              <div className="text-xs text-muted">{t.photo_ids.length} 张照片</div>
              {t.content?.intro && (
                <p className="text-sm mt-2 line-clamp-3 text-ink">{t.content.intro}</p>
              )}
              {t.status === 'error' && (
                <p className="text-xs text-danger mt-1">错误：{t.error}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => !busy && setPickerOpen(false)}>
          <div className="bg-white w-full sm:w-[640px] sm:max-h-[85vh] sm:rounded-2xl rounded-t-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <button className="text-muted text-sm" onClick={() => setPickerOpen(false)} disabled={busy}>取消</button>
              <div className="font-semibold">选照片 ({selected.size}/40)</div>
              <div className="w-10" />
            </div>

            <div className="px-5 pt-3 flex gap-2">
              {(['casual', 'literary', 'concise'] as Tone[]).map((t) => (
                <span key={t} className={`chip ${tone === t ? 'chip-on' : ''}`} onClick={() => setTone(t)}>{TONE_LABEL[t]}</span>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {groups.map(([date, pids]) => (
                <section key={date}>
                  <div className="text-xs text-muted font-semibold mb-1.5">{date}</div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {pids.map((pid) => {
                      const on = selected.has(pid);
                      return (
                        <button key={pid} onClick={() => toggle(pid)} className="relative aspect-square rounded-lg overflow-hidden bg-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumbs[pid].url} alt="" className="w-full h-full object-cover" />
                          {on && (
                            <div className="absolute inset-0 bg-brand/55 flex items-center justify-center text-white font-bold">✓</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-line">
              <button
                className="btn-primary w-full"
                onClick={generate}
                disabled={selected.size === 0 || busy}
              >
                {busy ? '生成中（最长 30 秒）...' : `用 ${selected.size} 张生成游记`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Badge({ status }: { status: TravelogueRow['status'] }) {
  const m = {
    running: ['border-muted text-muted', '生成中...'],
    done:    ['border-ok text-ok',       '已完成'],
    error:   ['border-danger text-danger','失败'],
  } as const;
  const [cls, label] = m[status];
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}
