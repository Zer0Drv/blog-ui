# Changelog

本仓库的显著变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 文章 slug 固定链接（Zer0Drv/blog#14）：编辑器新增 slug 输入（留空后端自动生成，前端预校验格式）；公众端新增 `/article/:slug` 详情路由（旧 `/article/:id` 保留，数字优先命中 id 路由）；首页/搜索/归档/动态/用户主页/收藏夹文章链接经 `articlePath` 优先走 slug；管理端文章列表新增 Slug 列
- CD 版本归档与回滚：每次发布归档至 MinIO `blog-frontend-releases/sha-<8位>`，`workflow_dispatch` 填 `rollback_tag` 恢复历史版本（#36、#42）
- 开发流程建设：CONTRIBUTING 规范、Issue/PR 模板、main 分支保护、Dependabot 周更 + 安全扫描、Projects 看板（#30、#31）

### Fixed

- 前端归档静默失效：mc mirror 对桶子前缀空传，归档/回滚改 cp -r + 存在性守卫（#42）
- package.json 重复键（Dependabot 乱序合并）：md-editor-v3 定版 ^7.1.0、katex 去重（#43）
- CI 工具链 Node 20（EOL）→ 24，actions 全部升级 Node 24 运行时（#35）

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

[Unreleased]: https://github.com/Zer0Drv/blog-ui/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Zer0Drv/blog-ui/releases/tag/v1.0.0
