import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mirror the mobile theme so the brand stays consistent across surfaces.
        brand:    '#4f6df5',
        brand2:   '#6e5bef',
        accent:   '#b463e8',
        ink:      '#1f2933',
        muted:    '#6b7280',
        line:     '#e5e7eb',
        canvas:   '#fbfaf7',
        ok:       '#16a34a',
        warn:     '#f59e0b',
        danger:   '#ef4444',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, .04), 0 4px 12px rgba(15, 23, 42, .04)',
      },
    },
  },
  plugins: [],
};
export default config;
