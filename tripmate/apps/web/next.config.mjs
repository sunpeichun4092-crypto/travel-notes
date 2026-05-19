/** @type {import('next').NextConfig} */
const nextConfig = {
  // We import the @tripmate/shared workspace as raw TS — Next 14 needs this hint.
  transpilePackages: ['@tripmate/shared'],
  experimental: {
    // server components fetch upstream APIs; nothing fancy needed yet
  },
  images: {
    // Supabase storage signed URLs — host pattern is project-specific.
    // Caller must add their project ref via env at deploy time; we allow any
    // *.supabase.co since signed URLs are still gated by a token.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
};

export default nextConfig;
