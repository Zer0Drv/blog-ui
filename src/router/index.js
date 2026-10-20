import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { ROLES, ROLE_GROUPS } from '../constants/roles'
import { syncRouteTitle } from '../composables/useDocumentTitle'
import { resetArticleMetadata } from '../utils/articleMetadata'

// meta.title 供页签标题（afterEach 组合为 `<title> - <站点名>`）；
// 管理后台页自带「- 管理后台」层级，如 站点设置 - 管理后台 - <站点名>
const routes = [
  { path: '/login/totp', name: 'totp-login', component: () => import('../views/TotpLoginView.vue'), meta: { public: true, title: '两步验证' } },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true, title: '登录' } },
  // GitHub OAuth 回跳（后端 302 带一次性 code，前端换取 Cookie 会话）
  { path: '/oauth/callback', name: 'oauth-callback', component: () => import('../views/OAuthCallbackView.vue'), meta: { public: true, title: '登录' } },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('../views/HomeView.vue'), meta: { public: true, title: '首页' } },
      { path: 'pages/:slug', name: 'page-detail', component: () => import('../views/PageDetailView.vue'), meta: { public: true, title: '页面' } },
      { path: 'subscription/unsubscribe', name: 'subscription-unsubscribe', component: () => import('../views/UnsubscribeView.vue'), meta: { public: true, title: '退订' } },
      // 标题由详情加载后覆盖为文章标题（useDocumentTitle）
      // id 路由限定纯数字（旧链接不破坏），slug 固定链接走下方变体（Zer0Drv/blog#14）
      { path: 'article/:id(\\d+)', name: 'article-detail', component: () => import('../views/ArticleDetailView.vue'), meta: { public: true, title: '文章详情' } },
      // slug 固定链接详情：与 id 路由同一组件，按 route.params 分流。
      // 两条路由都带参数正则（得分相同），定义顺序决胜：/article/123 先命中 id 路由；
      // 非法形态（大写/下划线/首尾连字符）由后端报不存在兜底，与错误 id 的体验一致
      { path: 'article/:slug([a-z0-9-]+)', name: 'article-detail-slug', component: () => import('../views/ArticleDetailView.vue'), meta: { public: true, title: '文章详情' } },
      // P0 阅读侧：归档/全文搜索（公开，组件由 frontend-E 提供）
      { path: 'archives', name: 'archives', component: () => import('../views/ArchivesView.vue'), meta: { public: true, title: '归档' } },
      { path: 'search', name: 'search', component: () => import('../views/SearchView.vue'), meta: { public: true, title: '搜索' } },
      // P1 友情链接公开页（issue #17）
      { path: 'links', name: 'friend-links', component: () => import('../views/FriendLinksView.vue'), meta: { public: true, title: '友情链接' } },
      { path: 'my/articles', name: 'my-articles', component: () => import('../views/MyArticlesView.vue'), meta: { roles: ROLE_GROUPS.WRITERS, title: '我的文章' } },
      { path: 'my/favorites', name: 'my-favorites', component: () => import('../views/MyFavoritesView.vue'), meta: { title: '我的收藏' } },
      // P0 作者侧：附件库（需登录，组件由 frontend-D 提供）
      { path: 'my/attachments', name: 'my-attachments', component: () => import('../views/AttachmentsView.vue'), meta: { title: '附件库' } },
      { path: 'settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: '设置' } },
      // M4 社交：通知/用户主页/关注动态/私信（/users/:id 公开，其余需登录）
      { path: 'notifications', name: 'notifications', component: () => import('../views/NotificationsView.vue'), meta: { title: '通知' } },
      // 标题由主页加载后覆盖为用户昵称（useDocumentTitle）
      { path: 'users/:id', name: 'user-profile', component: () => import('../views/UserProfileView.vue'), meta: { public: true, title: '用户主页' } },
      { path: 'feed', name: 'feed', component: () => import('../views/FeedView.vue'), meta: { title: '动态' } },
      { path: 'messages', name: 'messages', component: () => import('../views/MessagesView.vue'), meta: { title: '私信' } },
      { path: 'editor/new', name: 'editor-new', component: () => import('../views/ArticleEditView.vue'), meta: { roles: ROLE_GROUPS.WRITERS, title: '写文章' } },
      { path: 'editor/:id', name: 'editor-edit', component: () => import('../views/ArticleEditView.vue'), meta: { roles: ROLE_GROUPS.WRITERS, title: '编辑文章' } }
    ]
  },
  {
    // M5 管理后台：独立布局，全部仅 ADMIN 可访问
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { roles: [ROLES.ADMIN] },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('../views/admin/AdminDashboard.vue'), meta: { roles: [ROLES.ADMIN], title: '仪表盘 - 管理后台' } },
      { path: 'attachments/cleanup', name: 'admin-attachment-cleanup', component: () => import('../views/admin/AdminAttachmentCleanup.vue'), meta: { roles: [ROLES.ADMIN], title: '附件清理 - 管理后台' } },
      { path: 'articles', name: 'admin-articles', component: () => import('../views/admin/AdminArticles.vue'), meta: { roles: [ROLES.ADMIN], title: '文章管理 - 管理后台' } },
      { path: 'pages', name: 'admin-pages', component: () => import('../views/admin/AdminPages.vue'), meta: { roles: [ROLES.ADMIN], title: '页面管理 - 管理后台' } },
      { path: 'subscriptions', name: 'admin-subscriptions', component: () => import('../views/admin/AdminSubscriptions.vue'), meta: { roles: [ROLES.ADMIN], title: '订阅推送 - 管理后台' } },
      { path: 'pages/new', name: 'admin-page-new', component: () => import('../views/admin/AdminPageEdit.vue'), meta: { roles: [ROLES.ADMIN], title: '新建页面 - 管理后台' } },
      { path: 'pages/:id', name: 'admin-page-edit', component: () => import('../views/admin/AdminPageEdit.vue'), meta: { roles: [ROLES.ADMIN], title: '编辑页面 - 管理后台' } },
      { path: 'comments', name: 'admin-comments', component: () => import('../views/admin/AdminComments.vue'), meta: { roles: [ROLES.ADMIN], title: '评论治理 - 管理后台' } },
      { path: 'sensitive-words', name: 'admin-sensitive-words', component: () => import('../views/admin/AdminSensitiveWords.vue'), meta: { roles: [ROLES.ADMIN], title: '敏感词库 - 管理后台' } },
      { path: 'taxonomy', name: 'admin-taxonomy', component: () => import('../views/admin/AdminTaxonomy.vue'), meta: { roles: [ROLES.ADMIN], title: '标签分类 - 管理后台' } },
      { path: 'users', name: 'admin-users', component: () => import('../views/admin/AdminUsers.vue'), meta: { roles: [ROLES.ADMIN], title: '用户管理 - 管理后台' } },
      { path: 'site', name: 'admin-site', component: () => import('../views/admin/AdminSite.vue'), meta: { roles: [ROLES.ADMIN], title: '站点设置 - 管理后台' } },
      { path: 'sys/config', name: 'admin-sys-config', component: () => import('../views/admin/AdminSysConfig.vue'), meta: { roles: [ROLES.ADMIN], title: '系统参数 - 管理后台' } },
      // P1 友情链接管理（issue #17）
      { path: 'friend-links', name: 'admin-friend-links', component: () => import('../views/admin/AdminFriendLinks.vue'), meta: { roles: [ROLES.ADMIN], title: '友情链接 - 管理后台' } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async to => {
  const auth = useAuthStore()
  // Cookie 会话：无本地 token 可判，首次导航经 GET /auth/me 恢复登录态（ensureSession 幂等）
  await auth.ensureSession()

  if (to.name === 'login' && auth.isLoggedIn) return { name: 'home' }
  if (to.meta.public) return true
  if (!auth.isLoggedIn) return { name: 'login' }

  if (to.meta.roles && !auth.hasAnyRole(...to.meta.roles)) {
    ElMessage.warning('无权限访问该页面')
    return { name: 'home' }
  }
  return true
})

// 页签标题：导航确认后套用 to.meta.title（动态页的覆盖随之失效，回到路由标题）
router.afterEach(syncRouteTitle)
router.afterEach((_to, _from, failure) => { if (!failure) resetArticleMetadata() })

export default router
