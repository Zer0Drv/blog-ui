# blog-ui — 动态博客前端

[![CI](https://github.com/Zer0Drv/blog-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/Zer0Drv/blog-ui/actions/workflows/ci.yml)

基于 Vue 3 + Vite 的博客前台 + 管理后台单页应用，配套后端 [`Zer0Drv/blog`](https://github.com/Zer0Drv/blog)
（Spring Boot，需求基线见其 `docs/requirements-v1.md`）。

已交付：M1–M5（用户/内容/互动/社交/后台）+ M6（GitHub OAuth、MinIO）+ P0（对标 WordPress/Halo），
另有个人设置页、自适应图形验证码（频率触发）、私信/通知 WebSocket 实时推送（轮询兜底）。

## 功能特性

### 阅读侧
- 首页文章列表；文章详情页带 TOC 目录（Markdown 走 MdCatalog 联动，富文本解析 h2/h3 滚动定位）
- 代码高亮 / KaTeX 公式 / Mermaid 流程图自托管渲染（bundle 内注入，不依赖第三方 CDN）
- `/archives` 归档时间线、`/search` 全文搜索（query 驱动 + 分页）
- 页脚接入公开站点配置（站名/描述/ICP），提供 RSS / Atom 订阅链接

### 创作侧
- Markdown（md-editor-v3）/ 富文本（wangEditor）双模式编辑器，按文章切换
- 自动保存：已有文章 30s 防抖走服务端 `/articles/{id}/autosave`，新文章落 localStorage 草稿（进入时提示恢复）
- 定时发布（立即/定时 + datetime 选择）；版本历史抽屉（列表 / 只读预览 / 一键恢复）
- 封面支持本地上传或从附件库选择（AttachmentPicker）
- 我的文章：回收站（恢复回草稿 / 彻底删除）、「定时中」状态标识；附件库分组管理（上传/搜索/换组/复制链接/删除）

### 互动社交
- 评论：两层楼中楼、双排序、@ 提及，触发限流时自动出图形验证码
- 点赞 / 收藏；关注 Feed（`/feed`）；公开用户主页（`/users/:id`）
- 私信：WebSocket 实时收信，断线回退 5s 轮询
- 通知中心：WS 即时插入 + 轮询兜底，顶栏未读角标

### 个人设置
- 资料编辑（头像 / 昵称 / 简介）、修改密码
- 通知偏好：评论回复邮件通知开关

### 管理后台（`/admin`，仅 ADMIN）
- Dashboard 概览；文章管理（置顶 / 推荐 / 下架）
- 评论审核队列（PENDING 通过/拒绝）与评论回收站（恢复/彻底删除）
- 敏感词、标签分类、用户管理（封禁 / 角色）
- `/admin/site` 站点设置（站名/描述/logo/ICP/页脚/base_url/评论审核开关）

## 技术栈

| 组件 | 版本（以 package.json 为准） |
|---|---|
| Vue | ^3.5.13 |
| Vite | ^6.0.11（@vitejs/plugin-vue ^5.2.1） |
| 包管理 | pnpm 12 |
| UI | Element Plus ^2.14.6 + @element-plus/icons-vue ^2.3.1 |
| 状态 / 路由 | Pinia ^2.3.1 + vue-router ^4.5.0 |
| HTTP | axios ^1.7.9 |
| 编辑器 | md-editor-v3 ^5.2.2（Markdown）+ @wangeditor/editor ^5.1.23（富文本） |
| 渲染扩展 | highlight.js ^11.12.0 / katex ^0.16.47 / mermaid ^11.17.2（自托管注入） |
| 实时 | 原生 WebSocket（`/ws`，轮询兜底） |
| 测试 | Vitest ^5.0.2 + @vue/test-utils + jsdom |

## 快速开始

**前置**：后端已在 `http://localhost:8082` 运行（见后端 README）。

```bash
pnpm install
pnpm dev        # 开发服务器，默认 http://localhost:5173（VITE_PORT 可覆盖）
pnpm test       # Vitest 单测
pnpm build      # 产物输出到 dist/
pnpm preview    # 预览构建产物
```

## 与后端的约定

- 开发期前端只访问**同源**，由 Vite 代理到后端，避免 CORS：
  - `/api/xxx` → `http://localhost:8082/xxx`（代理剥掉 `/api` 前缀）
  - `/ws` → WebSocket 代理（`ws: true`），连接形如 `ws://localhost:5173/ws?token=<jwt>`
- 后端统一响应 `{code, data, message}`：`code === '200'` 返回 `data`，否则弹 `ElMessage` 并 reject，
  **reject 的 Error 上挂 `e.code`**（业务码）——如 `40066` = 触发频率限制需过图形验证码
  （常量见 `api/captcha.js` 的 `CAPTCHA_REQUIRED_CODE`）。
- token 存 `localStorage.token`；请求头自动带 `Authorization: Bearer <token>`；401 清除 token 跳 `/login`。
- 自适应验证码：平时不出现；后端判定频率超限后接口返回 `40066`，前端此时展示
  `CaptchaInput` 并在重试时携带 `captchaId/captchaCode`（登录/注册/邮箱验证码/评论已接入）。
- WebSocket 推送帧：`{"type":"private_message","data":MessageVO}`、`{"type":"notification","data":NotificationVO}`。

## 项目结构

```
src/
├── main.js                 应用入口（引入 src/lib/mdEditorConfig.js 完成编辑器扩展注入）
├── App.vue
├── api/                    16 个模块：http/captcha/user/article/comment/interaction/social/
│                           message/notification/attachment/browse/site/tag/category/upload/admin
│   ├── http.js             axios 实例：baseURL '/api'、注入 Bearer、统一拆 Result、
│   │                       401 跳登录；业务错误 reject 的 Error 上挂 e.code
│   └── captcha.js          图形验证码（required 预检 + 取图），导出 CAPTCHA_REQUIRED_CODE
├── lib/
│   └── mdEditorConfig.js   md-editor-v3 扩展自托管：bundle 内注入 highlight.js/katex/mermaid
│                           实例，覆盖默认 unpkg CDN，避免第三方域请求被拦截导致渲染降级
├── components/
│   ├── AttachmentPicker.vue      附件库选择器（封面等场景）
│   ├── CaptchaInput.vue          图形验证码（图片点击刷新，v-model 暴露 captchaId/captchaCode）
│   ├── CommentSection.vue        评论（楼中楼、双排序、@、限流出验证码）
│   └── VersionHistoryDrawer.vue  版本历史抽屉（预览 / 恢复）
├── layouts/
│   ├── MainLayout.vue      前台布局（导航、搜索框、未读角标、页脚 RSS/Atom/ICP）
│   └── AdminLayout.vue     管理后台布局
├── router/index.js         路由 + 前置守卫（无 token 跳 /login，meta.roles 控角色）
├── stores/
│   ├── auth.js             login/register/sendEmailCode/fetchMe/logout；登录态建立后自动连 WS
│   └── realtime.js         WebSocket 连接管理：on/off 事件订阅、指数退避重连、主动断开不重连
└── views/                  15 个页面 + admin/ 7 个子页
    ├── HomeView / ArticleDetailView / ArticleEditView / ArchivesView / SearchView
    ├── LoginView / OAuthCallbackView（GitHub OAuth 回跳）
    ├── MyArticlesView / MyFavoritesView / AttachmentsView / FeedView / UserProfileView
    ├── MessagesView（私信）/ NotificationsView（通知中心）
    ├── SettingsView        个人设置：资料编辑 + 修改密码 + 通知偏好
    └── admin/              dashboard、文章、评论、敏感词、标签分类、用户、站点设置
```

## 测试与 CI

- `pnpm test` 跑 Vitest（jsdom 环境），共 **18 个 spec 文件**，覆盖 api 层（http 拆包/验证码/上传/附件等）、
  stores（auth/realtime）、router 守卫、布局及关键组件/页面（CaptchaInput、CommentSection、LoginView 等）。
- GitHub Actions CI（`.github/workflows/ci.yml`）：push/PR 到 main 触发，
  Node 20 + pnpm 12，`pnpm install --frozen-lockfile` 严格模式（lockfile 未同步直接失败），
  随后依次 `pnpm test`、`pnpm build`。

## 实战笔记（踩过的坑）

- **端口不要用通用环境变量 `PORT`**：`vite.config.js` 读的是 `VITE_PORT`，默认 **5173**。
  宿主环境（如 Ekko Studio）会把自己的服务端口注入到 `PORT`，vite 一旦跟着占用，就会和宿主抢端口，
  进而引发「端口被占用→误杀进程→宿主被杀」的连环故障。**本项目一律用 `VITE_PORT`。**
- 代理目标默认 `http://localhost:8082`，可用 `API_TARGET` 覆盖（HTTP 与 WS 共用）。
- `strictPort: true`：端口被占用时直接报错退出，不会静默漂移，冲突立刻可见。
- md-editor-v3 默认从 unpkg CDN 加载高亮/公式/流程图扩展，易被浏览器 Tracking Prevention 拦截，
  已在 `src/lib/mdEditorConfig.js` 改为 bundle 内实例注入。
- 仓库不提交 `node_modules/` 与 `dist/`。

## 路线图

当前已完成：v1（M1–M5）+ M6 + P0 全量功能，含验证码、实时推送与站点设置。

后续候选：slug 固定链接、文章密码保护、Markdown 导入导出、友情链接、自定义页面、
TOTP 两步验证、AI 摘要/评论审核增强、生产部署链路（镜像化）。
