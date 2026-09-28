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
