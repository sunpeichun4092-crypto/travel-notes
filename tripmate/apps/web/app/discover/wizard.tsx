'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toCents } from '@tripmate/shared';

const STEPS = ['基地', '预算', '风格', '避雷与时间', '住宿与备注'] as const;
const STYLE_OPTIONS = ['美食', '深度文化', '徒步', '海岛', '摄影', '夜生活', '亲子', '小众'];
const LODGING = [
  { v: 'hotel',    label: '酒店' },
  { v: 'hostel',   label: '青旅' },
  { v: 'homestay', label: '民宿' },
  { v: 'mixed',    label: '随便' },
] as const;

type Lodging = typeof LODGING[number]['v'];

export function DiscoverWizard({ tripId }: { tripId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [base, setBase] = useState('');
  const [bMin, setBMin] = useState('3000');
  const [bMax, setBMax] = useState('8000');
  const [styles, setStyles] = useState<string[]>([]);
  const [avoid, setAvoid] = useState('');
  const [days, setDays] = useState('5');
  const [lodging, setLodging] = useState<Lodging>('hotel');
  const [notes, setNotes] = useState('');

  const toggle = (x: string) =>
    setStyles((arr) => arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x]);

  async function submit() {
    setErr(null);
    if (!base.trim()) return setErr('请填写出发基地');
    if (styles.length === 0) return setErr('请选择至少一个风格');
    setBusy(true);
    try {
      const r = await fetch('/api/discoveries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          base: base.trim(),
          budget_min_cents: toCents(parseFloat(bMin) || 0),
          budget_max_cents: toCents(parseFloat(bMax) || 0),
          styles,
          avoid: avoid.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean),
          duration_days: parseInt(days, 10) || 5,
          lodging_pref: lodging,
          notes: notes.trim() || undefined,
          ...(tripId ? { trip_id: tripId } : {}),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? '生成失败');
      const { id } = await r.json();
      router.replace(`/discover/${id}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Link href={tripId ? `/trips/${tripId}` : '/trips'} className="text-muted text-sm">← 返回</Link>
      <h1 className="text-2xl font-bold mt-3 mb-1">发现目的地</h1>
      <p className="text-sm text-muted mb-5">5 步告诉 AI 你的偏好，10–25 秒返回 5–7 个候选。</p>

      <div className="flex gap-2 mb-3">
        {STEPS.map((_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-brand' : 'bg-line'}`} />
        ))}
      </div>
      <div className="text-center text-sm text-muted mb-4">{step + 1}. {STEPS[step]}</div>

      <div className="card p-5 space-y-4">
        {step === 0 && (
          <Field label="出发基地（城市）">
            <input className="input" value={base} onChange={(e) => setBase(e.target.value)} placeholder="例如：上海" />
          </Field>
        )}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="最低预算（元/人）">
              <input className="input" inputMode="numeric" value={bMin} onChange={(e) => setBMin(e.target.value)} />
            </Field>
            <Field label="最高预算（元/人）">
              <input className="input" inputMode="numeric" value={bMax} onChange={(e) => setBMax(e.target.value)} />
            </Field>
          </div>
        )}
        {step === 2 && (
          <Field label="风格（多选）">
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((x) => (
                <span key={x} className={`chip ${styles.includes(x) ? 'chip-on' : ''}`} onClick={() => toggle(x)}>{x}</span>
              ))}
            </div>
          </Field>
        )}
        {step === 3 && (
          <>
            <Field label="避雷（用空格或逗号分隔）">
              <input className="input" value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="人挤人 黑导游" />
            </Field>
            <Field label="天数">
              <input className="input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
          </>
        )}
        {step === 4 && (
          <>
            <Field label="住宿偏好">
              <div className="flex flex-wrap gap-2">
                {LODGING.map((x) => (
                  <span key={x.v} className={`chip ${lodging === x.v ? 'chip-on' : ''}`} onClick={() => setLodging(x.v)}>{x.label}</span>
                ))}
              </div>
            </Field>
            <Field label="备注（可选）">
              <textarea className="input min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="例如：希望小众、不想自驾、对辣食过敏..." />
            </Field>
          </>
        )}
        {err && <div className="text-danger text-sm">{err}</div>}
      </div>

      <div className="flex gap-2 mt-4">
        {step > 0 && (
          <button className="btn-outline flex-1" onClick={() => setStep(step - 1)} disabled={busy}>上一步</button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="btn-primary flex-1" onClick={() => setStep(step + 1)}>下一步</button>
        ) : (
          <button className="btn-primary flex-1" onClick={submit} disabled={busy}>
            {busy ? '生成中（10–25 秒）...' : '生成候选'}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="label-sm">{label}</div>{children}</div>;
}
