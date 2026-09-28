# blog-ui — 动态博客前端

配套后端 [`Zer0Drv/blog`](https://github.com/Zer0Drv/blog)。**当前进度：M1（工程骨架 + 登录/注册链路）已完成**，需求基线见后端仓库 `docs/requirements-v1.md`。

## 技术栈

| 组件 | 版本 |
|---|---|
| Vue | 3.5 |
| Vite | 6 |
| 包管理 | pnpm |
| UI | Element Plus 2.9 + `@element-plus/icons-vue` |
| 状态 / 路由 | Pinia 2 + vue-router 4 |
| HTTP | axios |

## 目录结构

```
src/
├── main.js              应用入口
├── App.vue
├── api/http.js          axios 实例：baseURL '/api'、注入 Bearer、统一拆 Result、401 跳登录
├── router/index.js      路由 + 前置守卫（无 token 跳 /login）
├── stores/auth.js       Pinia：login / register / sendEmailCode / fetchMe / logout
└── views/
    ├── LoginView.vue    登录 / 注册（邮箱验证码）
    └── HomeView.vue     首页占位（M2 起接内容）
```

## 与后端的约定

- 开发期前端只访问**同源** `/api`，由 Vite 代理到后端，避免 CORS：`/api/xxx` → `http://localhost:8082/xxx`（代理会剥掉 `/api` 前缀）。
- 后端统一响应 `{code, data, message}`，`http.js` 在响应拦截器里拆包：`code === '200'` 直接返回 `data`，否则弹 `ElMessage` 并 reject。
- token 存在 `localStorage.token`；请求头自动带 `Authorization: Bearer <token>`；收到 401 清除 token 并跳转 `/login`。

## 本地运行

**前置**：后端已在 `http://localhost:8082` 运行（见后端 README）。

```bash
pnpm install
pnpm dev        # 开发服务器，默认 http://localhost:5173
pnpm build      # 产物输出到 dist/
pnpm preview    # 预览构建产物
```

## 配置注意事项（踩过的坑）

- **端口不要用通用环境变量 `PORT`**：`vite.config.js` 读的是 `VITE_PORT`，默认 **5173**。
  早先这里写的是 `process.env.PORT || 5173`，而宿主环境（如 Ekko Studio）会把自己服务的端口注入到 `PORT`，导致 dev server 抢占了宿主自己的端口，进而引发"端口被占用→误杀进程"的连环故障。**本项目一律用 `VITE_PORT`。**
- 代理目标默认 `http://localhost:8082`，可用 `API_TARGET` 覆盖。
- `strictPort: true`：端口被占用时直接报错退出，不会静默漂移到别的端口——这样可以立刻发现冲突，而不是让服务跑在意料之外的端口上。
- 仓库不提交 `node_modules/` 与 `dist/`。

## 后端接口依赖

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/auth/email-code` | 注册前发送邮箱验证码 |
| POST | `/api/auth/register` | 邮箱验证码注册 |
| POST | `/api/auth/login` | 账号密码登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 拉取当前用户 |

## 路线图

随后端里程碑推进：**M2** 首页 / 列表 / 文章详情（Markdown 渲染），**M3** 评论与互动，**M4** 关注 / 私信 / 通知中心，**M5** 管理后台。
