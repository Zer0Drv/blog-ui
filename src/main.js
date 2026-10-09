import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
// md-editor-v3 扩展库（highlight.js/katex/mermaid）改为 bundle 内实例注入，消除 unpkg CDN 请求
import './lib/mdEditorConfig'
import { ensureSiteConfig } from './composables/useSiteConfig'

// 提前拉站点配置（全应用仅此一次，内部 sessionStorage 缓存 + 去重）：
// 页签标题/品牌名在接口返回后会自动换成真实站点名，失败保持兜底
ensureSiteConfig()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
