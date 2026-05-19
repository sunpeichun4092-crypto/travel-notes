# 把 TripMate 发到 GitHub（仓库名：trip-companion）

## 一次性操作（在你的终端里跑）

```bash
# 1. 进入项目目录（用你电脑上 tripmate/ 的实际路径）
cd path/to/tripmate

# 2. 初始化 git（如果还没初始化）
git init -b main
git add .
git commit -m "feat: TripMate v0.1 — 5 modules + offline demo"
```

## 在 GitHub 上创建空仓库

1. 打开 https://github.com/new
2. **Repository name**: `trip-companion`
3. **Public** ✓（GitHub Pages 免费版要 Public）
4. ⚠️ **不要**勾 "Add a README" / ".gitignore" / "license" — 项目里已经都有了
5. 点 Create repository

页面会给你两条命令，复制 **"…or push an existing repository from the command line"** 里的两行：

```bash
git remote add origin https://github.com/<你的用户名>/trip-companion.git
git push -u origin main
```

## 开启 GitHub Pages

push 完之后：

1. 进仓库 → **Settings** → **Pages**
2. **Source** 选 **GitHub Actions**（不是 "Deploy from a branch"）
3. 几秒后跳出 "Your site is live at https://<你的用户名>.github.io/trip-companion/"

之后每次 `git push` 到 main，Actions (`.github/workflows/pages.yml`) 都会自动重新部署 `docs/` 目录到 Pages。

## 验证

跑完后访问 `https://<你的用户名>.github.io/trip-companion/` 应该能看到 TripMate 的 5 个 tab 都正常工作（行程 / 发现 / 记账 / 相册 / AI 游记）。

如果 404：等 1-2 分钟（Actions 第一次可能要 30s 跑完，再加上 CDN 缓存），仍然不行的话去 Actions 标签页看 workflow 有没有红 ❌。

## 顺手把 README 里的占位 URL 也改了

```bash
# 把 README 第 5 行的 YOUR-USERNAME 替换成你的 GitHub 用户名
sed -i '' "s|YOUR-USERNAME|<你的用户名>|g" README.md
git add README.md && git commit -m "docs: fix demo URL" && git push
```
