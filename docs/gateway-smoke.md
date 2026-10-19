# 网关只读业务冒烟（blog#58）

正常前端发布在 MinIO 同步完成后，经实际网关验证下列链路。失败令 CD 失败，但不会自动回滚或重试同步。

- 首页包含 Vue 挂载点和 module 入口；逐个读取首页引用的入口 JS/CSS，校验 HTTP 200、非空正文和资源类型，拒绝重定向、跨源资源与 HTML 回退伪成功。
- `/release.json` 的 schema 与完整前端 SHA 必须和本次通过 CI 的提交一致。
- `/api/site/config` 返回有效公开站名；`/api/articles?page=1&size=1` 返回公开、已发布且可见的文章。
- 使用该文章的 slug（缺省时使用 ID）读取详情 API，核对文章身份、公开状态与非空标题/正文，再检查文章地址的 SPA shell。
- 正常 CD 同时记录后端镜像完整 revision、不可变 image ID、运行状态，以及 MySQL 的库名、最新 Flyway version/checksum 和失败迁移数。网关检查前后各读取一次；后端身份或迁移记录变化、镜像缺失 revision、容器未运行或存在失败迁移时拒绝生成成功报告。

仅发匿名 GET，不携带 Cookie、不调用管理或写接口。文章详情 GET 会沿用后端阅读统计，令所选文章浏览量增加一次。报告只包含路径、状态、文章 ID 和前端 SHA，不保存文章正文、配置值或凭据。单次请求超时 10 秒，无自动重试。站点需要至少一篇公开文章；空站点明确失败，不跳过文章检查。

## 执行与证据

Node 24，无新增依赖。在前端仓库运行：

```sh
node .github/scripts/gateway-smoke.mjs http://localhost <完整前端SHA>
# 或 pnpm smoke:gateway http://localhost <完整前端SHA>
```

手工检查可省略 SHA，此时报告观察到的版本，但不声称验证了预期版本。URL 必须为 HTTP(S) origin，不能含子路径、查询参数或登录凭据。

CD 默认访问部署机 `http://localhost`（compose 的 80 端口网关）；仓库 Actions variable `GATEWAY_URL` 可改为实际对外入口。网关必须能被自托管 runner 访问。报告保存在 CD 的 `gateway-smoke-<SHA>-<attempt>` artifact（90 天）和成功步骤摘要，失败报告同时写入错误原因。网络失败同样令检查失败。

正常 CD 改用 `deployment-evidence.mjs`，需要 runner 具备读取本机 Docker 的权限，并能通过现有 MySQL 容器内部凭据查询 Flyway 表。手动执行：

```sh
node .github/scripts/deployment-evidence.mjs http://localhost <完整前端SHA>
# 或 pnpm verify:deployment http://localhost <完整前端SHA>
```

默认容器为 `blog-backend` 和 `blog-mysql`；手工采集可用 `BACKEND_CONTAINER` / `MYSQL_CONTAINER` 覆盖。密码仅在 MySQL 容器内部使用，不读取 `.env`、不输出容器环境，也不执行迁移或数据修改。该采集器面向本仓单实例 compose 拓扑：网关、后端和数据库必须对应这些容器；外部数据库、多实例或不同网关拓扑需先适配，不能把任意本机容器身份当成远端网关身份。

报告记录当前实际组合通过匿名只读接口验证。它不等同于旧前端/新后端、应用回滚或 schema 降级兼容认证。人工浏览器检查另行记录，不混入脚本自动通过的范围。

## 2026-10-19 现场基线

[脱敏部署记录](verification/deployment-2026-10-19.json) 是本地使用本次采集器读取实际运行服务的结果：前端 `6b9b4dd`、后端 `b99011e` 与 `blog_dev` 的 Flyway V16，8 项网关检查通过。此前对应[前端 CD](https://github.com/Zer0Drv/blog-ui/actions/runs/39193964458) 的第 2 次尝试已成功，其 artifact 记录网关冒烟；新增身份采集步骤在 CD 中的实际执行仍需本 PR 合并后核验。先前 MinIO 未运行导致的失败保留在历史运行中。

在同一实际网关上人工使用真实浏览器验证：首页 → 公开文章（代码块、表格、Mermaid 流程图/时序图），搜索 `test` 命中、正文中不含的 `zzzzzzzzzzzz` 返回空结果，以及匿名访问 `/my/articles` 回到登录页。截图保存在本次工作区的 `screenshots/release-2026-10-19-*.png`。这是公开阅读与匿名权限检查，不是登录/编辑/自动保存/导入/上传的隔离账号 E2E，也尚未加入 CI 浏览器自动化。

自动化回归：`node node_modules/vitest/vitest.mjs run tests/gatewaySmoke.spec.js tests/releaseWorkflow.spec.js`；测试启动临时 loopback HTTP 服务，覆盖断链、HTML 伪成功、错误 SHA、API 错误、受保护内容、路由缺失及匿名读取。它验证脚本行为，不能替代部署现场证据。

## 当前边界

此脚本未运行浏览器 JavaScript，不能证明文章组件正确渲染，也不验证登录、编辑/自动保存、上传或浏览器性能。身份记录只验证本次运行组合，其他跨仓过渡组合仍需隔离环境验收。

当前仅接入正常前端发布。历史回滚可能没有发布清单，保持既有回滚行为；历史产物认证、回滚后冒烟、后端独立发布后的网关检查，以及备份恢复演练仍由 [blog#58](https://github.com/Zer0Drv/blog/issues/58) 跟踪。合并后首次实际正常 CD 的 artifact 才是该提交部署后冒烟证据，本地临时 HTTP 测试不计为生产验收。
