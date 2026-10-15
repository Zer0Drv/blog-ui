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

  it('Mermaid 使用间接 KaTeX 渲染流程图公式', async () => {
    const mermaid = globalConfig.editorExtensions.mermaid.instance
    const originalConfig = mermaid.mermaidAPI.getConfig()
    // jsdom 不提供 SVG 布局；仅补齐尺寸接口，公式仍由 Mermaid/KaTeX 实际渲染。
    const originalBBox = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox')
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value: () => ({ x: 0, y: 0, width: 100, height: 20 })
    })
    try {
      // jsdom 没有原生 MathML 布局，启用 Mermaid 的 KaTeX HTML 回退。
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', forceLegacyMathML: true })
      const { svg } = await mermaid.render('mermaid-katex-regression',
        'flowchart TD\n A["$$x^2 + y^2 = z^2$$"] --> B["完成"]')
      expect(svg).toContain('katex-mathml')
      expect(svg).toContain('katex-html')
      expect(svg).toContain('完成')
    } finally {
      mermaid.initialize(originalConfig)
      if (originalBBox) {
        Object.defineProperty(SVGElement.prototype, 'getBBox', originalBBox)
      } else {
        delete SVGElement.prototype.getBBox
      }
    }
  })
})
