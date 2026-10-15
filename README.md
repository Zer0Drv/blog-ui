# blog-ui — 动态博客前端

[![CI](https://github.com/Zer0Drv/blog-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/Zer0Drv/blog-ui/actions/workflows/ci.yml)
[![CD](https://github.com/Zer0Drv/blog-ui/actions/workflows/cd.yml/badge.svg)](https://github.com/Zer0Drv/blog-ui/actions/workflows/cd.yml)

基于 Vue 3 + Vite 的博客前台 + 管理后台单页应用，配套后端 [`Zer0Drv/blog`](https://github.com/Zer0Drv/blog)
（Spring Boot，需求基线见其 `docs/requirements-v1.md`）。

已交付：M1–M5（用户/内容/互动/社交/后台）+ M6（GitHub OAuth、MinIO）+ P0（对标 WordPress/Halo），
另有个人设置页、自适应图形验证码（频率触发）、私信/通知 WebSocket 实时推送（轮询兜底）。
近期完成一轮架构深化：会话生命周期收口（#22）、编辑器页拆分（#23）、实时订阅惯用法，
以及 CD 版本归档/回滚链路（见「架构要点」与「测试与 CI/CD」）。

## 功能特性

### 阅读侧
- 自定义页面：`/pages/:slug` 阅读已发布页面，Markdown/富文本安全渲染；导航栏按站点设置顺序展示页面入口，未发布或删除的页面隐藏
- 密码保护文章：id / slug 详情显示口令输入页，触发频率阈值后显示图形验证码；解锁令牌仅保存在当前页面内存（有效期 2 小时），切换文章后清除。私密文章仅作者/管理员可访问。非公开文章不提供公众评论、点赞收藏和导出入口
- 首页文章列表；文章详情页带 TOC 目录（Markdown 走 MdCatalog 联动，富文本解析 h2/h3 滚动定位）
- 代码高亮 / KaTeX 公式 / Mermaid 流程图自托管渲染（bundle 内注入，不依赖第三方 CDN）
- `/archives` 归档时间线、`/search` 全文搜索（query 驱动 + 分页）
- 页脚接入公开站点配置（站名/描述/ICP），提供 RSS / Atom 订阅链接

### 创作侧
- 编辑器支持公开 / 密码保护 / 私密可见性，与草稿、发布、定时发布独立；访问口令留空可保留原口令，填写新口令可更换，明文不进入自动保存或 localStorage；我的文章与管理列表展示可见性
- Markdown（md-editor-v3）/ 富文本（wangEditor）双模式编辑器，按文章切换（编辑已有文章时模式锁定）
- 自动保存：显式状态机（clean/pending/saving/dirtyIdle）；已有文章 30s 防抖走服务端
  `/articles/{id}/autosave`，新文章落 localStorage 草稿（进入时提示恢复）；卸载时未保存内容补存
- 定时发布（立即/定时 + datetime 选择，须晚于当前至少 5 分钟）；版本历史抽屉（列表 / 只读预览 / 一键恢复）
- 封面支持本地上传或从附件库选择（AttachmentPicker）
- 我的文章：回收站（恢复回草稿 / 彻底删除）、「定时中」状态标识；附件库分组管理（上传/搜索/换组/复制链接/删除）
- 文章导入导出：导出 md/html 文件（按编辑器类型默认格式）；导入 .md/.markdown/.txt/.html/.htm（≤2MB）生成草稿并直达编辑页

### 互动社交
- 新文章订阅：页脚入口与个人设置开关，站内订阅、账号邮箱确认后开启邮件、独立关闭邮件；公开退订确认页；通知中心支持「订阅」筛选，管理端展示推送统计
- 评论：两层楼中楼、双排序、@ 提及，触发限流时自动出图形验证码
- 点赞 / 收藏（收藏夹对已下架文章置灰展示、不可进详情）；关注 Feed（`/feed`）；公开用户主页（`/users/:id`）
- 私信：WebSocket 实时收信，断线回退 5s 轮询
- 通知中心：WS 即时插入 + 5s 断线轮询兜底，顶栏未读角标（30s 常轮询，页面隐藏暂停）；
  管理员强制删除文章产生 `ARTICLE_FORCE_DELETED` 通知（只标记已读，不跳转）

### 个人设置
- 资料编辑（头像 / 昵称 / 简介）、修改密码
- 通知偏好：评论回复邮件通知开关

### 管理后台（`/admin`，仅 ADMIN）
- 页面管理：独立页面列表、Markdown/富文本编辑、草稿/发布/下架/删除；站点设置可选择页面导航并调整顺序，页面编辑离开时提示未保存修改
- Dashboard 概览；文章管理（置顶 / 推荐 / 下架 / 强制删除）
- 评论审核队列（PENDING 通过/拒绝）与评论回收站（恢复/彻底删除）
- 敏感词、标签分类、用户管理（封禁 / 角色）
- `/admin/site` 站点设置（站名/描述/logo/ICP/页脚/base_url/评论审核开关）
- `/admin/sys/config` 系统参数：按组编辑强类型运行参数，显示配置来源、默认值、当前生效值与待重启标记，支持重置和分页变更记录（Zer0Drv/blog#23）

## 技术栈

| 组件 | 版本（以 package.json 为准） |
|---|---|
| Vue | ^3.5.13 |
| Vite | ^6.0.11（@vitejs/plugin-vue ^5.2.1） |
| 包管理 | pnpm 12 |
| UI | Element Plus ^2.14.6 + @element-plus/icons-vue ^2.3.1 |
| 状态 / 路由 | Pinia ^4.0.3 + vue-router ^4.5.0 |
| HTTP | axios ^1.7.9 |
| 编辑器 | md-editor-v3 ^7.1.0（Markdown）+ @wangeditor/editor ^5.1.23（富文本） |
| 渲染扩展 | highlight.js ^11.12.0 / katex ^0.19.0 / mermaid ^12.1.0（自托管注入） |
| HTML 消毒 | dompurify ^3.2.4（唯一挂载点 `MdContentPreview.vue`） |
| 实时 | 原生 WebSocket（同源 `/ws`，Cookie 握手，轮询兜底） |
| 测试 | Vitest ^5.0.3 + @vue/test-utils + jsdom |

## 快速开始

**前置**：后端已在 `http://localhost:8082` 运行（见后端 README）。本地工具链：Node 24 + pnpm 12（CI 已对齐）。

```bash
pnpm install
pnpm dev        # 开发服务器，默认 http://localhost:5173（VITE_PORT 可覆盖）
pnpm test       # Vitest 单测
pnpm build      # 产物输出到 dist/
pnpm preview    # 预览构建产物
```

## 与后端的约定

- 开发期前端只访问**同源**，由 Vite 代理到后端，避免 CORS：
  - `/api/xxx` → `http://localhost:8082/xxx`（代理剥掉 `/api` 前缀，并移除 `Origin` 头——
    宿主预览重映射端口时避免命中后端 CORS 兜底白名单导致 403）
  - `/ws` → WebSocket 代理（`ws: true`），连接为同源 `ws(s)://host/ws`，握手由浏览器自动携带 Cookie 鉴权
- 登录态基于后端 **HttpOnly Cookie（AUTH_TOKEN）**：前端不持有 token，`http` 实例 `withCredentials`
  自动携带；`GET /auth/me` 探测会话（200=已登录，401=未登录）。
- **401 出口**：Cookie 会话失效（过期/被踢）时由装配层回调 `expireSession()` 并 SPA 内跳
  `/login?reason=expired&redirect=<原路径>`（不整页刷新，保住内存草稿）；登录页提示「登录已过期」，
  登录成功后回跳 `redirect`；`/auth/me` 探测的 401 属预期结果，静默放行。
- 后端统一响应 `{code, data, message}`：`code === '200'` 返回 `data`，否则弹 `ElMessage` 并 reject，
  **reject 的 Error 上挂 `e.code`**（业务码）——如 `40066` = 触发频率限制需过图形验证码
  （常量见 `api/captcha.js` 的 `CAPTCHA_REQUIRED_CODE`）。
- 自适应验证码：平时不出现；后端判定频率超限后接口返回 `40066`，前端此时展示
  `CaptchaInput` 并在重试时携带 `captchaId/captchaCode`（登录/注册/邮箱验证码/评论已接入）。
- WebSocket 推送帧：`{"type":"private_message","data":MessageVO}`、`{"type":"notification","data":NotificationVO}`。

## 架构要点（#22 / #23 深化后）

### 会话体系
- 角色常量收口于 `src/constants/roles.js`：`ROLES`（`ADMIN` / `AUTHOR` / `USER`，取值与后端
  `User.role` 一致，普通用户是 `USER`）+ `ROLE_GROUPS.WRITERS`（写作者组）；router `meta.roles`
  与 auth store getter 共用同一来源。
- auth store 的 `status` 是唯一会话状态机：`anonymous`（初始/未登录/登出）→ `pending`（探测中）→
  `authenticated` / `expired`；`_applyUser` 是唯一会话迁移点——`null→user` 建 WS、`user→null` 断 WS，
  幂等；`fetchMe` 已降为纯取数（无任何副作用），login / logout / expireSession / ensureSession
  全部经 `_applyUser`。
- 路由守卫首次导航 `await ensureSession()` 恢复会话（幂等，401 视为未登录）。
- 视图层经 `src/composables/useCurrentUser.js` 零样板读取当前用户（全部 computed 转发）；
  契约：仅在守卫 resolve 后使用，禁止视图自行 `fetchMe` 补齐会话。
- 401 反向注册：`http.js` 不 import store/router（防循环依赖），导出 `setUnauthorizedHandler`，
  由装配层 `main.js` 注册「`expireSession` + 跳登录页」回调。

### 实时订阅
- `src/composables/useRealtimeTopic.js` 是「WS 订阅 + 断线轮询兜底」的唯一惯用法：挂载订阅、卸载退订。
  - `mode: 'fallback'`（默认）：WS 断开才按 `interval` 轮询、连上即停；
  - `mode: 'always'`：始终轮询；`pauseWhenHidden` 页面隐藏时暂停、恢复可见立即补一次；
  - `poll: null` = 显式不要轮询兜底。
- 现状：私信 / 通知中心走 5s fallback；顶栏未读角标走 30s `always` + `pauseWhenHidden`。
- realtime store：同源 Cookie 握手（URL 不带 token）、指数退避重连（1s→2s→…→16s，上限 5 次）、
  主动断开不重连。

### 编辑器页拆分
- `src/utils/articleEdit.js`：编辑器页纯逻辑下沉（不依赖 Vue / Element Plus，全部可直测）——
  校验、草稿解析与恢复判定、自动保存请求体、定时发布校验、权限预检、表单状态映射等。
- `src/composables/useArticleAutosave.js`：30s 防抖自动保存，单个在途请求，后续到点修改合并为最新快照串行发送；
  快照按文章 ID / 清场代次 / 编辑版本归属，只有仍对应当前编辑版本的成功响应才能清脏。
  失败 / 正文为空驻留 `dirtyIdle` 不重试（等下次编辑）；初始化与版本恢复回填不自动保存。
  编辑路由按文章重建组件，固定本次表单 ID；切换前 `flush()` 等待原稿落轨，失败可继续编辑或明确放弃后离开；
  正式保存先等待自动保存完成再清场。卸载兜底捕获原稿快照并排在旧请求之后补存（新文章落 `localStorage`）。
- `src/components/RichEditor.vue`：wangeditor 生命周期的唯一主人（Editor/Toolbar 组件、官方 CSS、
  实例销毁全部收口），页面只通过 `v-model` 收发 HTML 字符串，拿不到编辑器实例。
- `src/components/MdContentPreview.vue`：**sanitize 唯一挂载点**——任何 Markdown 正文渲染都必须
  经过本组件（`utils/sanitize.js` 的 DOMPurify），漏接 `:sanitize` 即存储型 XSS 敞口。

### 产品行为（近期决策）
- 收藏夹：已下架 / 定时中文章（`ArticleListVO.visible === false`）置灰保留展示，点击拦截不进详情。
- 通知中心：WS 即时插入 + 5s 断线兜底；`ARTICLE_FORCE_DELETED`（管理员强删）点击只标记已读、不跳转。
- 编辑器：版本恢复回填不再触发自动保存（回填后 `markClean()` 复位）；新文章卸载也落 localStorage 草稿。

## 项目结构

```
src/
├── main.js                 应用入口 / 装配层：注册 401 出口回调（expireSession + SPA 内跳登录）；
│                           引入 src/lib/mdEditorConfig.js 完成编辑器扩展注入
├── App.vue
├── api/                    16 个模块：http/captcha/user/article/comment/interaction/social/
│                           message/notification/attachment/browse/site/tag/category/upload/admin
│   ├── http.js             axios 实例：baseURL '/api'、withCredentials 携带 Cookie、统一拆 Result、
│   │                       业务错误 reject 的 Error 上挂 e.code；401 出口经 setUnauthorizedHandler
│   │                       反向注册（本层不 import store/router，防循环依赖）
│   └── captcha.js          图形验证码（required 预检 + 取图），导出 CAPTCHA_REQUIRED_CODE
├── constants/
│   └── roles.js            ROLES（ADMIN/AUTHOR/USER）+ ROLE_GROUPS.WRITERS，router 与 store 共用
├── composables/
│   ├── useCurrentUser.js       视图读当前用户的零样板入口（computed 转发 auth store）
│   ├── useRealtimeTopic.js     WS 订阅 + 断线轮询兜底惯用法（fallback/always、pauseWhenHidden）
│   ├── useArticleAutosave.js   自动保存状态机（clean/pending/saving/dirtyIdle，卸载补存）
│   ├── useSiteConfig.js        公开站点配置（sessionStorage 缓存 + 去重）
│   └── useDocumentTitle.js     页签标题（meta.title + 动态页覆盖）
├── lib/
│   └── mdEditorConfig.js   md-editor-v3 扩展自托管：bundle 内注入 highlight.js/katex/mermaid
│                           实例，覆盖默认 unpkg CDN，避免第三方域请求被拦截导致渲染降级
├── utils/
│   ├── articleEdit.js      编辑器页纯函数集（校验/草稿/定时发布/表单映射，零依赖可直测）
│   ├── sanitize.js         DOMPurify 统一 HTML 消毒入口
│   └── profileSync.js / unreadSync.js  资料变更 / 未读数跨组件同步事件
├── components/
│   ├── AttachmentPicker.vue      附件库选择器（封面等场景）
│   ├── CaptchaInput.vue          图形验证码（图片点击刷新，v-model 暴露 captchaId/captchaCode）
│   ├── CommentSection.vue        评论（楼中楼、双排序、@、限流出验证码）
│   ├── MdContentPreview.vue      Markdown 正文只读预览（sanitize 唯一挂载点，详情页/版本抽屉共用）
│   ├── RichEditor.vue            富文本编辑器封装（wangeditor 生命周期唯一主人）
│   └── VersionHistoryDrawer.vue  版本历史抽屉（预览 / 恢复）
├── layouts/
│   ├── MainLayout.vue      前台布局（导航、搜索框、未读角标、页脚 RSS/Atom/ICP）
│   └── AdminLayout.vue     管理后台布局
├── router/index.js         路由 + 前置守卫（ensureSession 恢复会话，meta.roles 控角色）
├── stores/
│   ├── auth.js             会话状态机 status + 唯一迁移点 _applyUser；login/register/OAuth 兑换/logout
│   └── realtime.js         WebSocket 连接管理：on/off 事件订阅、指数退避重连、主动断开不重连
└── views/                  15 个页面 + admin/ 7 个子页
    ├── HomeView / ArticleDetailView / ArticleEditView / ArchivesView / SearchView
    ├── LoginView / OAuthCallbackView（GitHub OAuth 回跳）
    ├── MyArticlesView / MyFavoritesView / AttachmentsView / FeedView / UserProfileView
    ├── MessagesView（私信）/ NotificationsView（通知中心）
    ├── SettingsView        个人设置：资料编辑 + 修改密码 + 通知偏好
    └── admin/              dashboard、文章、评论、敏感词、标签分类、用户、站点设置
```

## 测试与 CI/CD

- `pnpm test` 跑 Vitest（jsdom 环境），共 **34 个 spec 文件 / 236 个用例**，覆盖 api 层
  （http 拆包/验证码/上传/附件/导入导出等）、utils 纯函数集（articleEdit/sanitize/同步事件）、
  composables（useArticleAutosave / useRealtimeTopic / useCurrentUser）、stores（auth/realtime）、
  router 守卫与页签标题、布局及关键组件/页面（CaptchaInput、CommentSection、LoginView 等）。
- CI（`.github/workflows/ci.yml`）：push/PR 到 main 触发，**Node 24 + pnpm 12**（与本地工具链对齐，
  Node 20 已 EOL），`pnpm install --frozen-lockfile` 严格模式（lockfile 未同步直接失败），
  随后依次 `pnpm test`、`pnpm build`。
- CD（`.github/workflows/cd.yml`）：push main 触发（按 `src/`、`package.json` 等路径过滤，
  提交信息带 `[skip cd]` 可跳过）：GitHub 托管 runner 构建 dist → 自托管 runner 同步到部署机
  MinIO `blog-frontend` 桶（Nginx 网关边缘缓存直出，`index.html` no-cache 即时生效）。
  **版本归档**：每次发布把 dist 快照到 `blog-frontend-releases/sha-<8位>/`（独立桶，不回删）。
  **回滚**：Actions → CD → Run workflow 填 `rollback_tag` —— 跳过构建，校验归档存在后
  清线上桶并从归档恢复。
- 协作流程：一切变更走 Issue → 分支 → PR → 所有者审批合并，**禁止直推 main**（详见
  [CONTRIBUTING.md](CONTRIBUTING.md)；含 Conventional Commits 中文摘要、P0/P1/P2 优先级 label、
  hotfix 通道、semver tag 发布约定）。Dependabot 每周一跟踪 npm 与 GitHub Actions 更新
  （`chore(deps)` / `chore(ci)` 前缀，各限 5 个在途 PR）。

## 实战笔记（踩过的坑）

- **端口不要用通用环境变量 `PORT`**：`vite.config.js` 读的是 `VITE_PORT`，默认 **5173**。
  宿主环境（如 Ekko Studio）会把自己的服务端口注入到 `PORT`，vite 一旦跟着占用，就会和宿主抢端口，
  进而引发「端口被占用→误杀进程→宿主被杀」的连环故障。**本项目一律用 `VITE_PORT`。**
- 代理目标默认 `http://localhost:8082`，可用 `API_TARGET` 覆盖（HTTP 与 WS 共用）。
- `strictPort: true`：端口被占用时直接报错退出，不会静默漂移，冲突立刻可见。
- md-editor-v3 默认从 unpkg CDN 加载高亮/公式/流程图扩展，易被浏览器 Tracking Prevention 拦截，
  已在 `src/lib/mdEditorConfig.js` 改为 bundle 内实例注入。
- **`mc mirror` 对桶子前缀目标静默空传**（本机 mc 2025-08 版）：MinIO 归档与回滚统一改用
  `mc cp -r`；`mc ls` 对不存在的前缀也返回 0，回滚前必须判空验证归档存在；`mc cp` 本地目录
  必嵌一层目录名，故归档内为 `sha-<8位>/dist/`，回滚源指向该 `dist/` 子前缀（S3→S3 不嵌套）。
- **package.json 重复键**：Dependabot 多个依赖 PR 乱序合并曾引入重复键（md-editor-v3 / katex）——
  JSON 解析静默取后者，声明与 lockfile 漂移；合并依赖 PR 时务必看最终 diff。
- **编辑器页两个曾被测试锁定的行为怪癖已按产品决策修正**：「版本恢复回填会触发一轮自动保存」
  与「新文章卸载不落本地草稿」原是行为锁固定的现状；现为恢复回填后 `markClean()` 复位不再计时，
  卸载补存对新文章同样落 `localStorage`（`draft:new`，含 `savedAt`）。
- 仓库不提交 `node_modules/` 与 `dist/`。

## 路线图

当前已完成：v1（M1–M5）+ M6 + P0 全量功能，含验证码、实时推送与站点设置；
架构深化（会话收口 / 编辑器拆分 / 实时订阅惯用法）与 CI/CD 链路（测试门禁、MinIO 归档与回滚）。

后续候选：slug 固定链接、文章密码保护、友情链接、自定义页面、
TOTP 两步验证、AI 摘要/评论审核增强。
