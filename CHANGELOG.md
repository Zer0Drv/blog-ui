# Changelog

本仓库的显著变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Fixed

- 应急处置弹窗挂到页面顶层，避免被用户表格固定列裁剪；适配窄屏并补充实际遮挡与交互回归（Refs #84）。

### Added

- 增加超级管理员处置、独立所有权转移及本机重启状态/生效值核验界面（Refs Zer0Drv/blog#82、Zer0Drv/blog#83）。
- 增加 Cookie 会话自动轮换与失败退出、评论通知撤回及不可用占位（Refs Zer0Drv/blog#26、Zer0Drv/blog#81）。
- 增加头像与清理对象预览/下载，修复友情链接配置跨页面和标签页失效（Refs #77、#78）。

- 历史回滚先认证原始 Actions 产物、完整 CI 与前后端/schema 兼容组合；正常发布及回滚统一网关冒烟，和后端/备份共享现场互斥锁（Refs Zer0Drv/blog#58）。

- 文章路由复用后端匿名原始 HTML 的分享 metadata，切换路由清除旧信息并忽略过期响应；不执行或复制返回 HTML 中的脚本（Refs Zer0Drv/blog#58）。

- 增加生产构建的首页、文章页和编辑页性能基线，固定节流条件及 Markdown 样例，记录九次冷缓存资源/绘制/交互样本并保留 CI 证据（Refs Zer0Drv/blog#58）。

- 新增设置页两步验证与登录验证页，本地二维码、恢复码保存保护及 GitHub 挑战分支；新增经所有者确认的 qrcode 依赖（Refs Zer0Drv/blog#19）。

- 新增经所有者批准的 Playwright 开发测试依赖及真实 Chromium E2E：隔离前后端/数据库/缓存/对象存储，覆盖创作、导入、上传、权限与断网保护；两仓 CI/CD 纳入必需浏览器检查并保留日志/截图/trace（Refs [blog#58](https://github.com/Zer0Drv/blog/issues/58)）。
- 发布冒烟报告增加后端镜像 revision/image ID、运行状态和 MySQL Flyway 版本/校验和；前后两次身份采样拒绝部署中途变化，补充真实网关与人工浏览器验证基线（Refs [blog#58](https://github.com/Zer0Drv/blog/issues/58)）。
- 正常前端发布后执行网关只读业务冒烟，核对首页入口资源、完整发布 SHA、公开 API 与文章路由，保存成功/失败报告；新增真实 HTTP 故障回归（Refs [blog#58](https://github.com/Zer0Drv/blog/issues/58)）。

### Changed

- 重启恢复查询同一时刻只保留一个请求，页面卸载后忽略旧响应，网关错误保留待核验任务；附件清理展示类型并明确不支持非受管理图片，补充跨标签页友链浏览器验收（Refs #77、#78、Zer0Drv/blog#82）。

- Markdown 高亮、KaTeX、Mermaid 配置随预览/编辑入口加载，首页不再提前加载这些扩展；保留本地实例、渲染能力与 DOMPurify 消毒（Refs Zer0Drv/blog#58）。

## [1.1.0] - 2026-10-16

### Added

- slug 固定链接的编辑、管理和访问；文章入口优先使用 slug，兼容原 ID 路由（[blog#14](https://github.com/Zer0Drv/blog/issues/14)，[PR #47](https://github.com/Zer0Drv/blog-ui/pull/47)）。
- 密码文章口令门禁、验证码与编辑可见性设置；访问令牌只驻留页面内存，切换路由清除（[blog#15](https://github.com/Zer0Drv/blog/issues/15)，[PR #49](https://github.com/Zer0Drv/blog-ui/pull/49)）。
- Markdown/front matter 导入导出增强、批量 zip、逐条结果和警告提示，以及管理端多篇导出（[blog#16](https://github.com/Zer0Drv/blog/issues/16)，[PR #48](https://github.com/Zer0Drv/blog-ui/pull/48)）。
- 友情链接管理和公开展示；独立页面管理、`/pages/:slug` 阅读与导航排序（[blog#17](https://github.com/Zer0Drv/blog/issues/17)、[blog#18](https://github.com/Zer0Drv/blog/issues/18)，[PR #46](https://github.com/Zer0Drv/blog-ui/pull/46)、[PR #50](https://github.com/Zer0Drv/blog-ui/pull/50)）。
- 个人订阅、邮箱确认与公开退订页，页脚入口、通知筛选及管理端统计（[blog#20](https://github.com/Zer0Drv/blog/issues/20)，[PR #53](https://github.com/Zer0Drv/blog-ui/pull/53)）。
- 系统参数管理页：分组强类型输入、来源/默认值/待重启提示、重置、变更记录与未保存离开保护（[blog#23](https://github.com/Zer0Drv/blog/issues/23)，[PR #59](https://github.com/Zer0Drv/blog-ui/pull/59)）。
- 附件清理管理：扫描、引用保护与回收统计、观察期、恢复保留、物理删除及失败重试；附件库提示与两阶段删除一致（[blog#22](https://github.com/Zer0Drv/blog/issues/22)，[PR #60](https://github.com/Zer0Drv/blog-ui/pull/60)）。

### Changed

- 发布复用同提交完整 CI 的测试构建产物，同步 MinIO 前核对完整 SHA、文件清单与 SHA-256；保留 production 审批，支持 `sha-<8位>` 归档回滚（[PR #36](https://github.com/Zer0Drv/blog-ui/pull/36)、[PR #61](https://github.com/Zer0Drv/blog-ui/pull/61)）。
- 更新 Pinia 4.0.3、md-editor-v3 7.1.0、KaTeX 0.19.0 与 Vitest 5.0.3（[PR #37](https://github.com/Zer0Drv/blog-ui/pull/37)、[PR #39](https://github.com/Zer0Drv/blog-ui/pull/39)–[PR #41](https://github.com/Zer0Drv/blog-ui/pull/41)）。
- 完善架构、Dependabot、提交和发布回滚文档；统一 Issue 结果评论、六类元数据维护与 PR 清单（[blog#69](https://github.com/Zer0Drv/blog/issues/69)，[PR #62](https://github.com/Zer0Drv/blog-ui/pull/62)、[PR #63](https://github.com/Zer0Drv/blog-ui/pull/63)）。

### Fixed

- 自动保存按文章与编辑版本串行合并请求，旧响应不再清除新修改；切换文章、导入草稿时保护原稿并重建表单，防止内容与目标 ID 错配（[#51](https://github.com/Zer0Drv/blog-ui/issues/51)、[#52](https://github.com/Zer0Drv/blog-ui/issues/52)，[PR #58](https://github.com/Zer0Drv/blog-ui/pull/58)）。
- 归档/回滚改用 `mc cp -r` 并增加存在性守卫，修复 `mc mirror` 桶子前缀静默空传（[PR #42](https://github.com/Zer0Drv/blog-ui/pull/42)）。
- 删除 package.json 重复键，统一 md-editor-v3 与 KaTeX 依赖声明（[PR #43](https://github.com/Zer0Drv/blog-ui/pull/43)）。
- 修复部署机 Git Bash 路径失效导致的 CD 故障（[#54](https://github.com/Zer0Drv/blog-ui/issues/54)，[PR #55](https://github.com/Zer0Drv/blog-ui/pull/55)）。

### Security

- Mermaid 升级至 12.2.0，移除间接引入的 KaTeX 0.16.x，修复安全告警及 Dependabot 无改动更新失败（[#56](https://github.com/Zer0Drv/blog-ui/issues/56)，[PR #57](https://github.com/Zer0Drv/blog-ui/pull/57)）。

后端配套范围、验证依据与发布顺序见 [v1.1.0 发布说明](docs/releases/v1.1.0.md)。

## [1.0.0] - 2026-10-12

首个流程化版本锚点：功能完整 + 架构深化 + 开发流程建设完成。

### 功能

- 前台：首页/归档/搜索/标签分类、文章详情（目录/评论/点赞/收藏）、关注流、私信、通知中心、用户主页
- 创作：双编辑器（Markdown / 富文本）、封面与附件、定时发布、历史版本、草稿恢复
- 管理后台：用户/评论/文章/统计/站点设置/附件库
- 鉴权：登录/注册/邮箱验证码/图形验证码/GitHub OAuth/找回密码

### 架构深化（#22、#23）

- 会话体系：`useCurrentUser` 单一入口零样板；`status` 状态字段 + `_applyUser` 单迁移点（WS 生命周期绑定会话）；401 SPA 内跳转不杀草稿；角色常量收口
- 实时推送：`useRealtimeTopic` 订阅+断线轮询兜底一种惯用法（fallback/always 两模式、页面隐藏暂停）
- 编辑器页：12 个纯函数下沉 `utils/articleEdit.js`；`useArticleAutosave` 显式状态机；`RichEditor`/`MdContentPreview` 组件封装（sanitize 唯一挂载点，堵 XSS 缝）

### 产品决策

- 收藏夹已下架文章置灰 +「已下架」角标（visible 字段）
- 违规强删通知作者（ARTICLE_FORCE_DELETED）；防丢稿两修正：版本恢复不顶掉当前草稿、新文章卸载落 localStorage

### 流程

- 测试 34 spec / 236 用例；CI：pnpm + vitest + build；CD：dist 推 MinIO + Nginx 网关 + 环境审批

[Unreleased]: https://github.com/Zer0Drv/blog-ui/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Zer0Drv/blog-ui/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Zer0Drv/blog-ui/tree/v1.0.0
