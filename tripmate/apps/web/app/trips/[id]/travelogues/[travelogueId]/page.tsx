// /trips/:id/travelogues/:travelogueId — render the structured content.
// Each day's photo_ids are resolved server-side to signed URLs.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

interface DayBlock { date: string; title: string; body: string; photo_ids: string[] }
interface Content { intro: string; days: DayBlock[]; outro: string }

export const dynamic = 'force-dynamic';

export default async function TravelogueDetail({
  params,
}: { params: { id: string; travelogueId: string } }) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('travelogues')
    .select('id, status, content, error, photo_ids')
    .eq('id', params.travelogueId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();

  const status = (data as any).status as 'running' | 'done' | 'error';

  if (status === 'running') {
    return (
      <div className="card p-10 text-center text-muted">
        AI 正在写作中... 刷新页面查看进度（通常 &lt; 30 秒）。
      </div>
    );
  }
  if (status === 'error' || !(data as any).content) {
    return (
      <div className="card p-10 text-center">
        <div className="text-danger font-semibold mb-2">生成失败</div>
        <div className="text-sm text-muted">{(data as any).error ?? '未知错误'}</div>
      </div>
    );
  }

  const content = (data as any).content as Content;

  // resolve photo_ids → signed URLs
  const allIds = Array.from(new Set(content.days.flatMap((d) => d.photo_ids)));
  let urlMap = new Map<string, string>();
  if (allIds.length) {
    const { data: ps } = await supabase.from('photos')
      .select('id, storage_path').in('id', allIds);
    const paths = (ps ?? []).map((p: any) => p.storage_path);
    if (paths.length) {
      const { data: signed } = await supabaseAdmin.storage.from('trip-photos')
        .createSignedUrls(paths, 60 * 60);
      const byPath = new Map((signed ?? []).map((s) => [s.path!, s.signedUrl]));
      for (const p of ps as any[]) urlMap.set(p.id, byPath.get(p.storage_path) ?? '');
    }
  }

  return (
    <article className="space-y-6">
      <Link href={`/trips/${params.id}/travelogues`} className="text-muted text-sm">← 返回</Link>

      <section className="card p-6 space-y-2">
        <div className="text-[11px] font-bold text-muted tracking-widest uppercase">开篇</div>
        <p className="leading-relaxed text-[15px]">{content.intro}</p>
      </section>

      {content.days.map((d, i) => (
        <section key={i} className="card p-6 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted font-semibold">{d.date}</span>
            <span className="text-brand font-extrabold">Day {i + 1}</span>
          </div>
          <h2 className="text-lg font-bold">{d.title}</h2>
          <p className="leading-relaxed text-[15px]">{d.body}</p>
          {d.photo_ids.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 pt-2">
              {d.photo_ids
                .map((pid) => urlMap.get(pid))
                .filter((u): u is string => !!u)
                .map((url, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={idx} src={url} alt="" className="aspect-square w-full object-cover rounded-lg" />
                ))}
            </div>
          )}
        </section>
      ))}

      <section className="card p-6 space-y-2">
        <div className="text-[11px] font-bold text-muted tracking-widest uppercase">结语</div>
        <p className="leading-relaxed text-[15px]">{content.outro}</p>
      </section>
    </article>
  );
}
