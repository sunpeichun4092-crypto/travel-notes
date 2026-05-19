import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card p-10 text-center">
      <div className="text-5xl mb-3">🤷‍♂️</div>
      <div className="text-lg font-bold mb-1">页面不存在</div>
      <div className="text-sm text-muted mb-5">这个链接可能已经被删除，或者你打错了。</div>
      <Link href="/trips" className="btn-primary">返回我的旅程</Link>
    </div>
  );
}
