// /trips/new — Create a trip via a server action. After insert we
// also write the creator into trip_members as 'owner'. Both rows go in
// one round-trip so a half-failed trip can't exist without an owner.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import Link from 'next/link';

async function createTrip(formData: FormData) {
  'use server';
  const { user, supabase } = await requireUser();

  const title = String(formData.get('title') ?? '').trim();
  const destination = String(formData.get('destination') ?? '').trim();
  const start = String(formData.get('start_date') ?? '').trim();
  const end = String(formData.get('end_date') ?? '').trim();

  if (!title) throw new Error('请填写标题');

  const { data: trip, error } = await supabase
    .from('trips')
    .insert({
      title,
      destination: destination || null,
      start_date: start || null,
      end_date: end || null,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  await supabase.from('trip_members').insert({
    trip_id: trip.id, user_id: user.id, role: 'owner',
  });

  revalidatePath('/trips');
  redirect(`/trips/${trip.id}`);
}

export default async function NewTripPage() {
  await requireUser();
  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/trips" className="text-muted text-sm">← 返回</Link>
      </div>
      <h1 className="text-2xl font-bold mb-1">新建旅程</h1>
      <p className="text-sm text-muted mb-6">创建后会生成 6 位邀请码，分享给同行的人。</p>

      <form action={createTrip} className="card p-5 space-y-4">
        <div>
          <label className="label-sm">标题 *</label>
          <input className="input" name="title" required maxLength={80} placeholder="例如：四川 8 天 8 夜" />
        </div>
        <div>
          <label className="label-sm">目的地</label>
          <input className="input" name="destination" maxLength={80} placeholder="例如：成都 / 雅安 / 稻城" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-sm">开始日期</label>
            <input className="input" name="start_date" type="date" />
          </div>
          <div>
            <label className="label-sm">结束日期</label>
            <input className="input" name="end_date" type="date" />
          </div>
        </div>
        <button className="btn-primary w-full">创建</button>
      </form>
    </div>
  );
}
