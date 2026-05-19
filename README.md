# 漫游笔记 · 旅游攻略网站

一个基于纯 HTML + CSS + JavaScript 的全球旅游攻略静态网站，无需后端、无需构建工具，开箱即用。

## ✨ 功能

- **首页（index.html）**：Hero 搜索、热门目的地、功能入口、精选攻略。
- **攻略列表（guides.html）**：按关键词、目的地、标签筛选，按时间/标题排序。
- **攻略详情（guide.html）**：分日行程展示 + 实用 Tips 侧栏。
- **目的地浏览（destinations.html）**：按地区/关键词浏览全球目的地。
- **智能行程规划（planner.html）**：先 LBS 定位/解析出发地（含 IP 兜底），再选择目的地、旅行时间、签证类型、人均预算；自动生成 **去程 + 城内每日 + 返程** 的完整安排（去/返程已计入旅行天数）；内嵌 Leaflet 地图，列表 ↔ 地图标记联动高亮，点击任意条目弹出详情抽屉与订票/预订入口（Skyscanner / 携程 / Klook / Booking 等）。
- **发布攻略（publish.html）**：结构化表单写作，发布后保存在本地并出现在攻略列表与首页。

## 📁 文件结构

```
.
├── index.html            # 首页
├── guides.html           # 攻略列表
├── guide.html            # 攻略详情
├── destinations.html     # 目的地浏览
├── planner.html          # 行程规划工具
├── publish.html          # 发布攻略
├── css/
│   └── style.css         # 全局样式（含响应式）
├── js/
│   ├── data.js           # 示例数据（目的地+签证+坐标+景点/酒店/餐厅/交通推荐 + 攻略）
│   ├── common.js         # 通用工具：localStorage、URL 参数、通用渲染
│   └── planner.js        # 智能行程规划逻辑：表单/算法/Google 地图嵌入
└── README.md
```

## 🚀 本地运行

> **注意：行程规划页的"使用我的当前位置"必须在 https 或 localhost 下才能调用浏览器定位 API。直接双击 `planner.html`（file://）会拿不到精确坐标，但会自动走 IP 粗略定位兜底，也可手动输入城市后点击"解析输入位置"。**

```bash
# Python 3
python3 -m http.server 8080

# Node（npx 自带 http-server）
npx http-server -p 8080
```

随后访问 `http://localhost:8080`。

## ☁️ 一键发布到 GitHub Pages

仓库已自带 `.github/workflows/pages.yml`，推上 `main` 分支后会自动部署。

```bash
git init
git add .
git commit -m "init: 漫游笔记"
git branch -M main

# 方式 A：gh CLI（推荐）
gh repo create travel-notes --public --source=. --remote=origin --push

# 方式 B：手动在 github.com 新建空仓库，再
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

然后到仓库 **Settings → Pages → Source** 选 **GitHub Actions**，等 1~2 分钟。访问 `https://<user>.github.io/<repo>/` 即可。

部署完成后，定位 / Nominatim 反向地理编码、第三方订票链接全部可用（因为页面跑在 https 安全上下文下）。

## 💾 数据说明

- 示例攻略与目的地写在 `js/data.js`，可直接编辑或追加。
- 用户发布的攻略存储在浏览器 `localStorage` 的 `travel_user_guides` 键中，仅在当前浏览器可见。
- 行程规划草稿存储在 `travel_trip_plan` 键。
- 清除浏览器站点数据会清空所有用户数据。

## 🎨 设计

- 主题色：温暖的橙色 `#ff6f3c`，搭配柔和的米白底。
- 自适应：≥960px 三栏 / 四栏；≤720px 单栏移动布局。
- 字体：系统字体（中文优先 PingFang/微软雅黑，英文 -apple-system）。

## 🔧 后续可拓展

- 接入真实后端 API（替换 `data.js` 与发布逻辑）。
- 增加用户登录、收藏、评论。
- 集成地图（如 Leaflet）展示行程路线。
- 支持图片上传与富文本编辑。
- 添加多语言切换。

## 📝 许可

仅作演示用途。所有占位图片来自 Unsplash。
