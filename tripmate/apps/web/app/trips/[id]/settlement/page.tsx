// Settlement is computed entirely on the server: pull expenses + shares
// via RLS, run settleNet + minimumTransfers from @tripmate/shared, render.
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatCents, settleNet, minimumTransfers, type ExpenseWithShares } from '@tripmate/shared';

export const dynamic = 'force-dynamic';

export default async function SettlementPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireUser();

  const [tripQ, expQ] = await Promise.all([
    supabase
      .from('trips')
      .select('id, currency, trip_members(user_id, profiles(display_name))')
      .eq('id', params.id).maybeSingle(),
    supabase
      .from('expenses')
      .select('id, payer_id, amount_cents, currency, expense_shares(user_id, share_cents)')
      .eq('trip_id', params.id),
  ]);
  if (tripQ.error) throw new Error(tripQ.error.message);
  if (expQ.error) throw new Error(expQ.error.message);
  if (!tripQ.data) return <div>未找到旅程</div>;

  const currency = (tripQ.data as any).currency as string;
  const nameMap = new Map<string, string>();
  for (const m of (tripQ.data as any).trip_members) {
    nameMap.set(m.user_id, m.profiles?.display_name ?? '?');
  }

  const expenses: ExpenseWithShares[] = (expQ.data ?? []).map((e: any) => ({
    id: e.id,
    payer_id: e.payer_id,
    amount_cents: e.amount_cents,
    shares: (e.expense_shares ?? []).map((s: any) => ({
      user_id: s.user_id, share_cents: s.share_cents,
    })),
  })) as ExpenseWithShares[];

  const balances = settleNet(expenses);
  const transfers = minimumTransfers(balances);

  return (
    <div className="space-y-5">
      <Link href={`/trips/${params.id}/expenses`} className="text-muted text-sm">← 团队记账</Link>
      <h1 className="text-2xl font-bold">净额结算</h1>

      <div>
        <div className="label-sm">当前净额</div>
        {balances.length === 0 ? (
          <div className="card p-6 text-center text-muted">暂无账单。</div>
        ) : (
          <div className="space-y-2">
            {balances.map((b) => (
              <div key={b.user_id} className="card p-3 flex items-center justify-between">
                <span>{nameMap.get(b.user_id) ?? '?'}</span>
                <span className={
                  b.balance_cents > 0 ? 'text-ok font-semibold'
                  : b.balance_cents < 0 ? 'text-danger font-semibold'
                  : 'text-muted'
                }>
                  {b.balance_cents > 0
                    ? `应收 ${formatCents(b.balance_cents, currency)}`
                    : b.balance_cents < 0
                    ? `应付 ${formatCents(-b.balance_cents, currency)}`
                    : '已结清'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="label-sm">建议转账（最少笔数）</div>
        {transfers.length === 0 ? (
          <div className="card p-6 text-center text-muted">无需任何转账。</div>
        ) : (
          <div className="space-y-2">
            {transfers.map((t, i) => (
              <div key={i} className="card p-3 flex items-center gap-3">
                <span className="font-medium">{nameMap.get(t.from) ?? '?'}</span>
                <span className="text-muted">→</span>
                <span className="font-medium">{nameMap.get(t.to) ?? '?'}</span>
                <span className="ml-auto text-warn font-bold">{formatCents(t.amount_cents, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
