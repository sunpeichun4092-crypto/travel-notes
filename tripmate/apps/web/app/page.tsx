import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOptionalUser } from '@/lib/auth';

export default async function Home() {
  const user = await getOptionalUser();
  if (user) redirect('/trips');

  const features: Array<[string, string, string]> = [
    ['🧭', '发现目的地', '5 步向导 + GPT-4o + 真实搜索来源，给你 5–7 个可达且不重复的候选'],
    ['✈️', '行程协作', '邀请码加入，多人同看一份行程'],
    ['💰', '团队记账', '等额 / 加权分账，整数分元，自动算出最少转账方案'],
    ['📸', '共享相册', '按拍摄时间分组、点赞，照片直传 Supabase 私有桶'],
    ['📝', 'AI 游记', '挑几张照片，让 GPT-4o Vision 帮你写成结构化游记'],
  ];

  return (
    <div className="space-y-12 py-8">
      <section className="text-center space-y-4">
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
          一起出行，<span className="text-brand">省心一整路。</span>
        </h1>
        <p className="text-muted text-base sm:text-lg max-w-xl mx-auto">
          TripMate · 旅程伴侣 把发现 / 协作 / 记账 / 相册 / AI 游记五件事整合到一个 App 里。
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/login" className="btn-primary">立即开始</Link>
          <a href="https://github.com" className="btn-outline">查看源码</a>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map(([icon, title, body]) => (
          <div key={title} className="card p-5">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="font-semibold mb-1">{title}</div>
            <div className="text-sm text-muted leading-relaxed">{body}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
