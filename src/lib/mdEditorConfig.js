// md-editor-v3 全局配置：以 bundle 内实例注入 highlight.js / katex / mermaid，
// 覆盖其默认的 unpkg CDN 地址（editorExtensions 硬编码 https://unpkg.com），
// 避免浏览器 Tracking Prevention 拦截第三方域请求导致代码高亮/公式/流程图渲染降级。
import { config } from 'md-editor-v3'
// CDN 的 highlight.min.js 对应 common 语言子集，保持渲染行为一致
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/atom-one-dark.css'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import mermaid from 'mermaid'

config({
  editorExtensions: {
    highlight: {
      instance: hljs
    },
    katex: {
      instance: katex
    },
    mermaid: {
      instance: mermaid
    }
  }
})
