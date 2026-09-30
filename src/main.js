import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
// md-editor-v3 扩展库（highlight.js/katex/mermaid）改为 bundle 内实例注入，消除 unpkg CDN 请求
import './lib/mdEditorConfig'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
