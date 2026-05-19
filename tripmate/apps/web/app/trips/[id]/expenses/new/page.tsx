// Wraps the new-expense client form with a server-side prefetch of trip
// members (so the browser doesn't need a second round-trip).
import { requireUser } from '@/lib/auth';
import { NewExpenseForm } from './form';

export const dynamic = 'force-dynamic';

export default async function NewExpensePage({ params }: { params: { id: string } }) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('trips')
    .select('id, currency, trip_members(user_id, profiles(display_name))')
    .eq('id', params.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return <div>未找到旅程</div>;

  const members = (data as any).trip_members.map((m: any) => ({
    user_id: m.user_id, name: m.profiles?.display_name ?? '?',
  }));
  return <NewExpenseForm tripId={params.id} currency={(data as any).currency} members={members} />;
}
