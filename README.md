# blog-ui — 动态博客前端

配套后端 [`Zer0Drv/blog`](https://github.com/Zer0Drv/blog)。**当前进度：M1–M5（用户/内容/互动/社交/后台）+ M6（GitHub OAuth、MinIO）已完成**；
增量功能：个人设置页、自适应图形验证码（频率触发）、私信/通知 WebSocket 实时推送（轮询兜底）。需求基线见后端仓库 `docs/requirements-v1.md`。

## 技术栈

| 组件 | 版本 |
|---|---|
| Vue | 3.5 |
| Vite | 6 |
| 包管理 | pnpm |
| UI | Element Plus 2.9 + `@element-plus/icons-vue` |
| 状态 / 路由 | Pinia 2 + vue-router 4 |
| HTTP | axios |
| 编辑器 | md-editor-v3（Markdown）+ wangEditor（富文本），按文章双模式 |
| 实时 | 原生 WebSocket（`/ws`，轮询兜底） |

## 目录结构

```
src/
├── main.js                 应用入口
├── App.vue
├── api/
│   ├── http.js             axios 实例：baseURL '/api'、注入 Bearer、统一拆 Result、
│   │                       401 跳登录；业务错误 reject 的 Error 上挂 e.code（如验证码 40066）
│   ├── captcha.js          图形验证码（required 预检 + 取图），导出 CAPTCHA_REQUIRED_CODE
│   ├── user.js             PUT /users/me（资料）、PUT /auth/password（改密）
│   └── ...                 article/comment/interaction/social/message/notification/admin 等
├── components/
│   ├── CaptchaInput.vue    图形验证码（图片点击刷新 + 输入，v-model 暴露 captchaId/captchaCode）
│   └── CommentSection.vue  评论（两层楼中楼、双排序、@、触发限流时出验证码）
├── layouts/
│   ├── MainLayout.vue      前台布局（导航、未读角标、用户菜单含「设置」）
│   └── AdminLayout.vue     管理后台布局
├── router/index.js         路由 + 前置守卫（无 token 跳 /login，meta.roles 控角色）
├── stores/
│   ├── auth.js             login / register / sendEmailCode / fetchMe / logout；登录态建立后自动连 WS
│   └── realtime.js         WebSocket 连接管理：on/off 事件订阅、指数退避重连、主动断开不重连
└── views/
    ├── HomeView / ArticleDetailView / ArticleEditView
    ├── LoginView / OAuthCallbackView
    ├── SettingsView        个人设置：资料编辑（头像/昵称/简介）+ 修改密码
    ├── MessagesView        私信（WS 实时收信，断线回退 5s 轮询）
    ├── NotificationsView   通知中心（WS 即时插入，轮询兜底）
    ├── FeedView / MyArticlesView / MyFavoritesView / UserProfileView
    └── admin/              dashboard、文章、评论、敏感词、标签分类、用户
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

## 本地运行

**前置**：后端已在 `http://localhost:8082` 运行（见后端 README）。

```bash
pnpm install
pnpm dev        # 开发服务器，默认 http://localhost:5173
pnpm test       # Vitest 单测
pnpm build      # 产物输出到 dist/
pnpm preview    # 预览构建产物
```

## 配置注意事项（踩过的坑）

- **端口不要用通用环境变量 `PORT`**：`vite.config.js` 读的是 `VITE_PORT`，默认 **5173**。
  宿主环境（如 Ekko Studio）会把自己的服务端口注入到 `PORT`，vite 一旦跟着占用，就会和宿主抢端口，
  进而引发「端口被占用→误杀进程→宿主被杀」的连环故障。**本项目一律用 `VITE_PORT`。**
- 代理目标默认 `http://localhost:8082`，可用 `API_TARGET` 覆盖（HTTP 与 WS 共用）。
- `strictPort: true`：端口被占用时直接报错退出，不会静默漂移，冲突立刻可见。
- 仓库不提交 `node_modules/` 与 `dist/`。

## 路线图

v1（M1–M5）+ M6 已完成。后续候选：WebSocket 覆盖更多实时场景、AI 辅助评论审核、全文搜索、生产部署链路（镜像化）。
