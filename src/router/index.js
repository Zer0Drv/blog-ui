import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('../views/HomeView.vue'), meta: { public: true } },
      { path: 'article/:id', name: 'article-detail', component: () => import('../views/ArticleDetailView.vue'), meta: { public: true } },
      { path: 'my/articles', name: 'my-articles', component: () => import('../views/MyArticlesView.vue') },
      { path: 'my/favorites', name: 'my-favorites', component: () => import('../views/MyFavoritesView.vue') },
      // M4 社交：通知/用户主页/关注动态/私信（/users/:id 公开，其余需登录）
      { path: 'notifications', name: 'notifications', component: () => import('../views/NotificationsView.vue') },
      { path: 'users/:id', name: 'user-profile', component: () => import('../views/UserProfileView.vue'), meta: { public: true } },
      { path: 'feed', name: 'feed', component: () => import('../views/FeedView.vue') },
      { path: 'messages', name: 'messages', component: () => import('../views/MessagesView.vue') },
      { path: 'editor/new', name: 'editor-new', component: () => import('../views/ArticleEditView.vue'), meta: { roles: ['ADMIN', 'AUTHOR'] } },
      { path: 'editor/:id', name: 'editor-edit', component: () => import('../views/ArticleEditView.vue'), meta: { roles: ['ADMIN', 'AUTHOR'] } }
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
