import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  // GitHub OAuth 回跳（后端 302 带 token）
  { path: '/oauth/callback', name: 'oauth-callback', component: () => import('../views/OAuthCallbackView.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('../views/HomeView.vue'), meta: { public: true } },
      { path: 'article/:id', name: 'article-detail', component: () => import('../views/ArticleDetailView.vue'), meta: { public: true } },
      { path: 'my/articles', name: 'my-articles', component: () => import('../views/MyArticlesView.vue'), meta: { roles: ['ADMIN', 'AUTHOR'] } },
      { path: 'my/favorites', name: 'my-favorites', component: () => import('../views/MyFavoritesView.vue') },
      { path: 'settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
      // M4 社交：通知/用户主页/关注动态/私信（/users/:id 公开，其余需登录）
      { path: 'notifications', name: 'notifications', component: () => import('../views/NotificationsView.vue') },
      { path: 'users/:id', name: 'user-profile', component: () => import('../views/UserProfileView.vue'), meta: { public: true } },
      { path: 'feed', name: 'feed', component: () => import('../views/FeedView.vue') },
      { path: 'messages', name: 'messages', component: () => import('../views/MessagesView.vue') },
      { path: 'editor/new', name: 'editor-new', component: () => import('../views/ArticleEditView.vue'), meta: { roles: ['ADMIN', 'AUTHOR'] } },
      { path: 'editor/:id', name: 'editor-edit', component: () => import('../views/ArticleEditView.vue'), meta: { roles: ['ADMIN', 'AUTHOR'] } }
    ]
  },
  {
    // M5 管理后台：独立布局，全部仅 ADMIN 可访问
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { roles: ['ADMIN'] },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('../views/admin/AdminDashboard.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'articles', name: 'admin-articles', component: () => import('../views/admin/AdminArticles.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'comments', name: 'admin-comments', component: () => import('../views/admin/AdminComments.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'sensitive-words', name: 'admin-sensitive-words', component: () => import('../views/admin/AdminSensitiveWords.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'taxonomy', name: 'admin-taxonomy', component: () => import('../views/admin/AdminTaxonomy.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'users', name: 'admin-users', component: () => import('../views/admin/AdminUsers.vue'), meta: { roles: ['ADMIN'] } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async to => {
  const token = localStorage.getItem('token')
  if (to.name === 'login' && token) return { name: 'home' }
  if (to.meta.public) return true
  if (!token) return { name: 'login' }

  if (to.meta.roles) {
    const auth = useAuthStore()
    if (!auth.user) {
      try {
        await auth.fetchMe()
      } catch {
        return { name: 'login' }
      }
    }
    if (!to.meta.roles.includes(auth.user?.role)) {
      ElMessage.warning('无权限访问该页面')
      return { name: 'home' }
    }
  }
  return true
})

export default router
