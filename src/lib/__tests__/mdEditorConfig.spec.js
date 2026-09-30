// 验证 md-editor-v3 全局配置：highlight.js/katex/mermaid 已切换为 bundle 内实例注入，
// 实例存在时 md-editor-v3 运行时不会向 unpkg CDN 发起 script/link 请求
import { describe, it, expect, beforeAll } from 'vitest'

describe('mdEditorConfig', () => {
  let globalConfig

  beforeAll(async () => {
    await import('../mdEditorConfig')
    // config() 就地合并并返回库内 globalConfig 单例，空合并用于读取当前配置
    const { config } = await import('md-editor-v3')
    globalConfig = config({})
  })

  it('注入 highlight.js 打包实例（含高亮能力）', () => {
    const hljs = globalConfig.editorExtensions.highlight.instance
    expect(hljs).toBeTruthy()
    expect(typeof hljs.highlight).toBe('function')
    expect(hljs.highlight('const a = 1', { language: 'javascript' }).value).toContain('hljs')
  })

  it('注入 katex 打包实例', () => {
    const katex = globalConfig.editorExtensions.katex.instance
    expect(katex).toBeTruthy()
    expect(typeof katex.renderToString).toBe('function')
    expect(katex.renderToString('x^2')).toContain('katex')
  })

  it('注入 mermaid 打包实例', () => {
    const mermaid = globalConfig.editorExtensions.mermaid.instance
    expect(mermaid).toBeTruthy()
    expect(typeof mermaid.initialize).toBe('function')
    expect(typeof mermaid.render).toBe('function')
  })
})
