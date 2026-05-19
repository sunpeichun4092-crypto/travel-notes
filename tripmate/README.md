# TripMate · 旅程伴侣

3-8 人小团体出游伴侣：行前一起规划 · 行中省心管账 · 行后留下回忆。

> 🌐 **在线 Demo**：[https://YOUR-USERNAME.github.io/trip-companion/](https://YOUR-USERNAME.github.io/trip-companion/) — 离线 mock，5 模块都能交互（推到 GitHub 后会自动部署）



## 模块（5 个）

| 模块 | 关键能力 |
|---|---|
| 🧭 发现目的地 | 5 步 Wizard + GPT + SerpAPI/Bing 混合，输出 5–7 个候选（小众/风险等级、当地人 tips、来源链接） |
| 🗺 行程协作 | 一键创建旅程，6 位邀请码加入，成员头像、倒计时、子页面 tile |
| 💰 团队记账 | 等额/加权分账，整数分计算，智能净额 + 最少转账方案 |
| 📸 共享相册 | Expo ImagePicker 多选上传，签名 URL 直传 Storage，按拍摄日期分组、点赞 |
| ✈️ AI 游记 | GPT-4o Vision 多图理解，结构化 JSON（开篇/每日/收尾），可保存导出 |

## 技术栈

- **Web**: Next.js 14 (App Router) + Tailwind, Server Components + Server Actions
- **Mobile**: React Native + Expo (managed)
- **Server (可选)**: Node.js + Express + TypeScript（Web 不需要它，Mobile 需要）—— 直接用 `tsx` 运行 TS，无需预编译
- **DB / Auth / Storage**: Supabase Postgres (RLS) + Auth + Storage
- **AI**: OpenAI GPT-4o (text + Vision)
- **Search**: SerpAPI（默认）或 Bing Search v7

## 目录结构

```
tripmate/
├── apps/web/           # Next.js 14 — 部署到 Vercel 即可
├── apps/mobile/        # React Native + Expo
├── server/             # Express API（仅 Mobile App 需要）
├── packages/shared/    # 跨端共享类型与算法（split / settle）
├── supabase/migrations # SQL 迁移 + RLS 策略
├── docs/               # 单文件离线 demo（GitHub Pages 入口）
└── README.md
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 复制 env 并填入 Supabase / OpenAI / SerpAPI key
cp .env.example .env
cp .env.example apps/mobile/.env
cp .env.example server/.env

# 3. 数据库（需要本地 supabase CLI 或线上项目）
supabase link --project-ref <your-ref>
supabase db push                        # 应用 supabase/migrations
psql $DATABASE_URL -f supabase/seed.sql # 可选：导入种子数据

# 4-A. 想要网页版（推荐先试）
cp apps/web/.env.example apps/web/.env.local
# 填入 Supabase URL/anon/service-role + OpenAI key
npm run dev:web                         # 浏览器打开 http://localhost:3001

# 4-B. 想要 App
cp .env.example apps/mobile/.env
cp .env.example server/.env
npm run dev:server &                    # Express 后端
npm run dev:mobile                      # Expo
```

## 部署

### Web（推荐先用这条路）

1. Push 到 GitHub
2. Vercel → New Project → Import → root 选 `apps/web`
3. 在 Vercel "Environment Variables" 加：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`OPENAI_API_KEY`、`SERPAPI_API_KEY`（任选其一搜索 key）
4. Deploy。完成后访问 Vercel 给的 `https://*.vercel.app` 域名即可

注意：Vercel Hobby 套餐的函数超时是 10 秒，但本项目把 `/api/discoveries` 和 `/api/travelogues` 都设成了 60 秒（`maxDuration = 60`），这需要 Vercel Pro。如果只用 Hobby，可改成调用 Express server 或减少候选数量。

### Mobile

- **Server**: Render / Fly.io / Railway —— `cd server && npm run start`
- **Mobile**: EAS Build (`eas build -p ios|android`)，或 Expo Go 内测

### Database

- Supabase 托管项目，迁移用 `supabase db push`
- Storage bucket：已在 migration 中创建 `trip-photos`（私有），通过签名 URL 上传

## 安全

所有跨用户数据隔离通过 Postgres RLS 完成；服务端只用 anon key + JWT 透传。仅在以下场景使用 service role：
- 创建邀请码（避免 race condition）
- AI 游记后台任务持久化
- Storage 签名 URL 生成

## 离线 Demo (GitHub Pages)

`docs/index.html` 是一个**单文件、纯前端 mock** —— 不依赖 Supabase / OpenAI / Vercel，
推到 GitHub 后 Actions 会自动通过 `.github/workflows/pages.yml` 部署到 GitHub Pages。

发布步骤：
1. `git push` 到 GitHub（仓库名建议 `trip-companion`）
2. 仓库 Settings → Pages → Source 选 **GitHub Actions**
3. 等 Actions 跑完，访问 `https://<你的用户名>.github.io/trip-companion/` 即可

## License

MIT.
