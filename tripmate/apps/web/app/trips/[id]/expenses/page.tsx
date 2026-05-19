import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatCents } from '@tripmate/shared';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('expenses')
    .select('id, description, amount_cents, currency, split_mode, spent_at, expense_shares(user_id)')
    .eq('trip_id', params.id)
    .order('spent_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/trips/${params.id}`} className="text-muted text-sm">← 返回</Link>
        <div className="flex gap-2">
          <Link href={`/trips/${params.id}/settlement`} className="btn-outline">净额结算</Link>
          <Link href={`/trips/${params.id}/expenses/new`} className="btn-primary">新增账单</Link>
        </div>
      </div>

      <h1 className="text-2xl font-bold">团队记账</h1>

      {(!data || data.length === 0) ? (
        <div className="card p-8 text-center text-muted">还没有账单。</div>
      ) : (
        <div className="space-y-2">
          {data.map((e) => (
            <div key={e.id} className="card p-4 flex items-start justify-between">
              <div>
                <div className="font-medium">{e.description ?? '无说明'}</div>
                <div className="text-xs text-muted mt-1">
                  {e.split_mode === 'equal' ? '等额' : '加权'} · {e.expense_shares?.length ?? 0} 人 · {String(e.spent_at).slice(0, 10)}
                </div>
              </div>
              <div className="text-warn font-bold">{formatCents(e.amount_cents, e.currency)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
