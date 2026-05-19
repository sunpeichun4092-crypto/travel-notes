'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    const supabase = supabaseBrowser();
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: displayName || email.split('@')[0] } },
        });
        if (error) throw error;
      }
      router.replace('/trips');
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? '操作失败');
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-sm mx-auto card p-6 mt-8">
      <h1 className="text-xl font-bold mb-1">{mode === 'signin' ? '欢迎回来' : '创建账号'}</h1>
      <p className="text-sm text-muted mb-5">
        {mode === 'signin' ? '登录后开始你的旅程' : '注册一个 TripMate 账号'}
      </p>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="label-sm">显示名</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：阿毛" />
          </div>
        )}
        <div>
          <label className="label-sm">邮箱</label>
          <input
            className="input" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label-sm">密码</label>
          <input
            className="input" type="password" required minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err && <div className="text-danger text-sm">{err}</div>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? '...' : mode === 'signin' ? '登录' : '注册'}
        </button>
      </form>
      <button
        className="text-sm text-brand mt-4 block mx-auto"
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
      >
        {mode === 'signin' ? '还没账号？去注册' : '已有账号？去登录'}
      </button>
    </div>
  );
}
