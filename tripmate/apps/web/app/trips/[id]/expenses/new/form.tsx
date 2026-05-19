'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { toCents, splitExpense } from '@tripmate/shared';

interface Member { user_id: string; name: string }

export function NewExpenseForm({
  tripId, currency, members,
}: { tripId: string; currency: string; members: Member[] }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [payerId, setPayerId] = useState<string>(members[0]?.user_id ?? '');
  const [mode, setMode] = useState<'equal' | 'weighted'>('equal');
  const [included, setIncluded] = useState<Record<string, boolean>>(
    Object.fromEntries(members.map((m) => [m.user_id, true])),
  );
  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(members.map((m) => [m.user_id, '1'])),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) return setErr('金额无效');
    if (!payerId) return setErr('请选择付款人');

    const participants = members
      .filter((m) => included[m.user_id])
      .map((m) => ({
        user_id: m.user_id,
        weight: mode === 'weighted' ? parseInt(weights[m.user_id] || '1', 10) : 1,
      }));
    if (participants.length === 0) return setErr('至少 1 位参与者');

    const cents = toCents(amt);
    const shares = splitExpense(
      mode,
      cents,
      participants.map((p) => ({ user_id: p.user_id, weight: p.weight })),
    );

    setBusy(true);
    try {
      const supabase = supabaseBrowser();
      const { data: exp, error } = await supabase.from('expenses').insert({
        trip_id: tripId,
        payer_id: payerId,
        amount_cents: cents,
        currency,
        description: desc.trim() || null,
        split_mode: mode,
      }).select('id').single();
      if (error) throw new Error(error.message);

      const rows = shares.map((s) => ({
        expense_id: exp.id,
        user_id: s.user_id,
        share_cents: s.share_cents,
        weight: mode === 'weighted'
          ? participants.find((p) => p.user_id === s.user_id)?.weight ?? 1
          : 1,
      }));
      const { error: e2 } = await supabase.from('expense_shares').insert(rows);
      if (e2) throw new Error(e2.message);

      router.replace(`/trips/${tripId}/expenses`);
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? '保存失败');
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <Link href={`/trips/${tripId}/expenses`} className="text-muted text-sm">← 返回</Link>
      <h1 className="text-2xl font-bold">新增账单</h1>

      <form onSubmit={submit} className="card p-5 space-y-4">
        <div>
          <label className="label-sm">金额（元） *</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label-sm">说明</label>
          <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="例如：晚饭" />
        </div>

        <div>
          <div className="label-sm">付款人</div>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span
                key={m.user_id}
                onClick={() => setPayerId(m.user_id)}
                className={`chip ${payerId === m.user_id ? 'chip-on' : ''}`}
              >{m.name}</span>
            ))}
          </div>
        </div>

        <div>
          <div className="label-sm">分账方式</div>
          <div className="flex gap-2">
            <span className={`chip ${mode === 'equal' ? 'chip-on' : ''}`} onClick={() => setMode('equal')}>等额</span>
            <span className={`chip ${mode === 'weighted' ? 'chip-on' : ''}`} onClick={() => setMode('weighted')}>加权</span>
          </div>
        </div>

        <div>
          <div className="label-sm">参与者</div>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={!!included[m.user_id]}
                  onChange={(e) => setIncluded({ ...included, [m.user_id]: e.target.checked })}
                />
                <span className="flex-1">{m.name}</span>
                {mode === 'weighted' && included[m.user_id] && (
                  <input
                    className="input w-20 text-center"
                    inputMode="numeric"
                    value={weights[m.user_id]}
                    onChange={(e) => setWeights({ ...weights, [m.user_id]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {err && <div className="text-danger text-sm">{err}</div>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? '保存中...' : '保存账单'}</button>
      </form>
    </div>
  );
}
