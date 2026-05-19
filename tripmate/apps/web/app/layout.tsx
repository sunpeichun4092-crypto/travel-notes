import type { Metadata } from 'next';
import './globals.css';
import { TopNav } from '@/components/TopNav';

export const metadata: Metadata = {
  title: 'TripMate · 旅程伴侣',
  description: '一起出行：发现 · 行程协作 · 团队记账 · 共享相册 · AI 游记',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">
        <TopNav />
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6">{children}</main>
        <footer className="mt-16 py-6 text-center text-xs text-muted">
          TripMate · 旅程伴侣 — Built with Next.js + Supabase
        </footer>
      </body>
    </html>
  );
}
