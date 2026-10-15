# Changelog

本仓库的显著变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 系统参数管理（Zer0Drv/blog#23）：新增 `/admin/sys/config`，分组强类型输入、来源/默认值/待重启提示、重置、变更记录与未保存离开保护
- 新文章订阅（Zer0Drv/blog#20）：个人设置订阅与邮箱确认、公开退订页、页脚订阅入口、通知中心订阅筛选和管理统计页面

- 自定义页面（Zer0Drv/blog#18）：管理端页面列表与编辑器、公开 `/pages/:slug` 阅读、站点导航选择与排序；复用安全预览与图片上传，编辑离开提示未保存修改

- 密码保护 / 私密文章（Zer0Drv/blog#15）：详情页口令门禁及自适应验证码、编辑器可见性选项与访问口令设置、创作/管理列表可见性展示；访问令牌仅驻留页面内存，路由切换清除

- 文章 Markdown 导入导出增强（Zer0Drv/blog#16）：编辑器页新增「导入 / 导出」入口；我的文章导入支持 .zip 批量（逐条结果与失败明细提示、多篇成功刷新列表）与导入警告透传（如 status 忽略说明）；管理端文章列表支持勾选多篇批量导出 zip；导入逻辑下沉共享 composable `useArticleImport`
- 文章 slug 固定链接（Zer0Drv/blog#14）：编辑器新增 slug 输入（留空后端自动生成，前端预校验格式）；公众端新增 `/article/:slug` 详情路由（旧 `/article/:id` 保留，数字优先命中 id 路由）；首页/搜索/归档/动态/用户主页/收藏夹文章链接经 `articlePath` 优先走 slug；管理端文章列表新增 Slug 列
- 友情链接：管理端友链管理页（分页/新增/编辑/启停/删除）、公众端 `/links` 友链页与页脚入口；站点设置新增友链展示开关（Zer0Drv/blog#17）
- CD 版本归档与回滚：每次发布归档至 MinIO `blog-frontend-releases/sha-<8位>`，`workflow_dispatch` 填 `rollback_tag` 恢复历史版本（#36、#42）
- 开发流程建设：CONTRIBUTING 规范、Issue/PR 模板、main 分支保护、Dependabot 周更 + 安全扫描、Projects 看板（#30、#31）

### Fixed

- 编辑器自动保存按文章与编辑版本串行合并请求，旧响应不再清除新修改；切换文章或导入草稿时先保护原稿并重建表单，防止内容与目标 ID 错配（#51、#52）
- Mermaid 升至 12.2.0，移除间接引入的 KaTeX 0.16.x，修复安全告警及 Dependabot 无改动更新失败（#56）
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
