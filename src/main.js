import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from './api/http'
import { useAuthStore } from './stores/auth'
import { ensureSiteConfig } from './composables/useSiteConfig'

// 提前拉站点配置（全应用仅此一次，内部 sessionStorage 缓存 + 去重）：
// 页签标题/品牌名在接口返回后会自动换成真实站点名，失败保持兜底
ensureSiteConfig()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)

// 装配层唯一接线点（#22）：401 → 会话置 expired + SPA 内跳登录页（带过期原因与回跳地址）
setUnauthorizedHandler(() => {
  const auth = useAuthStore()
  auth.expireSession()
  router.push({
    name: 'login',
    query: { reason: 'expired', redirect: router.currentRoute.value.fullPath }
  })
})

app.mount('#app')
