// Sticky top nav showing the brand + sign-out button when logged in.
import Link from 'next/link';
import { getOptionalUser } from '@/lib/auth';
import { SignOutButton } from './SignOutButton';

export async function TopNav() {
  const user = await getOptionalUser();
  return (
    <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur border-b border-line">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href={user ? '/trips' : '/'} className="font-bold text-ink text-[17px]">
          TripMate <span className="text-muted font-normal text-sm">· 旅程伴侣</span>
        </Link>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted">{user.email}</span>
            <SignOutButton />
          </div>
        ) : (
          <Link className="btn-outline !py-1.5 !px-3 text-sm" href="/login">登录</Link>
        )}
      </div>
    </header>
  );
}
