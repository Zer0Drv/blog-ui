# 真实浏览器 E2E（blog#58）

Playwright 1.64.1 是所有者于 2026-10-19 明确批准的开发测试依赖。Chromium 驱动真实 Vue 页面、真实 Spring Boot、安全链、Cookie、MySQL 8.4、Redis 7 与 MinIO；没有 mock 网络响应、替代后端或关闭鉴权。现有 Vitest 快速套件独立保留。

## 业务范围

本轮增加第七条所有者流程：真实密码登录 SUPER_ADMIN、access Cookie 缺失后的 refresh
轮换、普通管理员接口越权拒绝、错误口令拒绝、冻结后旧 access/refresh 失效及解冻。
夹具增加独立 SUPER_ADMIN 与账号 ID，仅测试源码可生成；生产没有测试初始化入口。

| 链路 | 关键断言 |
| --- | --- |
| 登录、编辑、自动保存、刷新恢复、发布阅读 | 真实登录；等待产品原有 30 秒防抖；读取 Redis 草稿 API 核对原文；刷新后恢复表单；正式发布后用匿名新 context 阅读并搜索 |
| 导入与编辑路由 | 当前未保存原稿导入 `.md` 后切换到新文章 ID；原稿 Redis 内容保留；保存导入稿不覆盖原文章 |
| 附件 | 真实 multipart 上传到 MinIO；匿名下载字节与 PNG 夹具一致；浏览器图片解码成功 |
| 权限与失败 | 匿名创作路由跳登录；错误口令被拒绝；USER 写文章返回既有业务码 `40300`，编辑入口无表单 |
| 网络中断保护 | context 断网后路由离开触发真实保存失败；选择继续编辑，内容和路由仍保留；恢复网络后正式保存并核对后端正文 |

没有用加速页面时钟代替真实防抖，没有重试掩盖不稳定用例。所有数据来自新建测试账号及文章；不会登录部署用户或读写其内容。

## 本地复现

准备 JDK 25、Node 24、pnpm 12、Docker Compose；后端 checkout 需包含 [blog#75](https://github.com/Zer0Drv/blog/pull/75) 的测试启动器。后端先运行：

```sh
mvn -B -DskipTests package
```

前端运行：

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
BACKEND_E2E_DIR=/absolute/path/to/blog pnpm test:e2e
```

PowerShell 中设置环境变量：`$env:BACKEND_E2E_DIR='E:\dev\zer0drv\blog'`，再运行 `pnpm test:e2e`。Linux 首次安装 Chromium 可使用 `pnpm exec playwright install --with-deps chromium`。

`-DskipTests package` 仅用于编译固定版本的夹具。两仓原有完整单测、迁移和真实依赖检查仍为发布必需检查。

## 隔离与清理

每轮随机 compose 项目 `blog-browser-e2e-<随机标识>`，显式空 env 文件，复用后端 `compose.real-it.yaml` 的 tmpfs 服务。MySQL/Redis/MinIO 分别仅绑定 23307/26379/29000 的 loopback，后端 28082、前端 25173；应用命令行固定数据库、凭据、桶与端口，启动前经过后端 `RealInfrastructureSafety`。已有端口被占用就失败，不复用或停止已有应用。

测试后端只存在于 `src/test`，通过 Spring Boot PropertiesLauncher 加载；生产 jar 无此入口或测试专用 API。只为独立测试环境关闭 SMTP 健康检查、订阅 worker 和管理员引导，Flyway、真实搜索/存储、验证码及写请求 CSRF 头保持生效。

正常结束或失败会停止自身 Java/Vite 子进程，收集本轮基础设施日志，再仅对自己的 compose 项目执行 down。CI 另有 `always()` 兜底 `node e2e/cleanup.mjs`；它校验本轮随机项目身份，拒绝默认项目或任意项目名。中断后也可在同一前端目录、保持 BACKEND_E2E_DIR 时手动执行该命令清理本轮隔离容器。不会执行默认 compose、FLUSHDB、TRUNCATE 或删除博客部署卷。

## CI 与证据

两仓完整可复用 CI 都增加必需的 `browser-e2e` job，分别 checkout 当前提交和另一仓的固定完整 SHA。前后端独立发布都等待完整 CI，包括真实浏览器 job；不绕过 production 审批。更新接口时同步评估固定的配套提交，不以 `main` 浮动引用代替可复现组合。

`e2e-artifacts/` 保存：两仓 SHA 和源码脏状态、随机运行/项目标识、测试 JUnit/HTML 报告、成功链路截图、失败截图和 trace、前后端与基础设施日志。CI 以 `browser-e2e-<精确提交>-<attempt>` 保留 7 天；只收集夹具日志和数据。启动失败同样失败，测试不会因服务不可用被跳过。`pnpm exec playwright show-trace <trace.zip>` 可检查失败轨迹。

本地首次完整通过为 5 条 Chromium 用例；精确提交与 CI 结果以配套 PR 为准。本轮不覆盖真实 SMTP/GitHub OAuth、其他浏览器、多实例消息广播、历史产物回滚或业务数据恢复。备份现状、RPO/RTO 经所有者反馈仍为待确认，#58 保持开放。

官方依据：[Playwright 配置与证据](https://playwright.dev/docs/test-use-options)、[全局准备与清理](https://playwright.dev/docs/test-global-setup-teardown)、[Spring Boot 外部测试入口](https://docs.spring.io/spring-boot/specification/executable-jar/property-launcher.html)。
