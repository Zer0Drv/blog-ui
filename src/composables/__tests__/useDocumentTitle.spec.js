import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

// mock 站点配置接口，验证「站点名来自 GET /site/config，失败兜底 Blog」
vi.mock('../../api/site', () => ({
  getSiteConfig: vi.fn()
}))

// 每个用例重置模块注册表，保证模块级状态（站点名/路由标题/覆盖标题）互不污染
async function load() {
  const title = await import('../useDocumentTitle')
  const site = await import('../useSiteConfig')
  const { getSiteConfig } = await import('../../api/site')
  return { ...title, ...site, getSiteConfig }
}

describe('useDocumentTitle / syncRouteTitle', () => {
  beforeEach(() => {
    vi.resetModules()
    sessionStorage.clear()
  })

  it('meta.title 存在：组合为 `<页面标题> - Blog`（兜底站点名）', async () => {
    const { syncRouteTitle } = await load()

    syncRouteTitle({ meta: { title: '首页' } })
    await nextTick()

    expect(document.title).toBe('首页 - Blog')
  })

  it('meta.title 缺失：只显示站点名', async () => {
    const { syncRouteTitle } = await load()

    syncRouteTitle({ meta: {} })
    await nextTick()
    expect(document.title).toBe('Blog')

    syncRouteTitle({})
    await nextTick()
    expect(document.title).toBe('Blog')
  })

  it('站点配置到达后标题自动换成真实站点名（无需再次导航）', async () => {
    const { syncRouteTitle, ensureSiteConfig, getSiteConfig } = await load()
    getSiteConfig.mockResolvedValue({ 'site.name': '我的小站' })

    syncRouteTitle({ meta: { title: '首页' } })
    await nextTick()
    expect(document.title).toBe('首页 - Blog')

    await ensureSiteConfig()
    await nextTick()
    expect(document.title).toBe('首页 - 我的小站')
  })

  it('站点配置拉取失败：保持兜底站点名 Blog', async () => {
    const { syncRouteTitle, ensureSiteConfig, getSiteConfig } = await load()
    getSiteConfig.mockRejectedValue(new Error('网络错误'))

    syncRouteTitle({ meta: { title: '归档' } })
    await ensureSiteConfig()
    await nextTick()

    expect(document.title).toBe('归档 - Blog')
  })

  it('sessionStorage 有缓存时仍重新校验服务器', async () => {
    sessionStorage.setItem('site:config', JSON.stringify({ 'site.name': '缓存小站' }))
    const { syncRouteTitle, ensureSiteConfig, getSiteConfig } = await load()

    await ensureSiteConfig()
    syncRouteTitle({ meta: { title: '首页' } })
    await nextTick()

    expect(getSiteConfig).toHaveBeenCalled()
    expect(document.title).toBe('首页 - Blog')
  })
})

describe('useDocumentTitle 动态覆盖', () => {
  beforeEach(() => {
    vi.resetModules()
    sessionStorage.clear()
  })

  function mountConsumer(mod) {
    return mount(defineComponent({
      template: '<div />',
      setup() {
        return mod.useDocumentTitle()
      }
    }))
  }

  it('setTitle 覆盖为动态标题，resetTitle 恢复路由标题', async () => {
    const mod = await load()
    mod.syncRouteTitle({ meta: { title: '文章详情' } })
    const wrapper = mountConsumer(mod)

    wrapper.vm.setTitle('深入理解 Vue 响应式')
    await nextTick()
    expect(document.title).toBe('深入理解 Vue 响应式 - Blog')

    wrapper.vm.resetTitle()
    await nextTick()
    expect(document.title).toBe('文章详情 - Blog')

    wrapper.unmount()
  })

  it('组件卸载时自动恢复路由标题', async () => {
    const mod = await load()
    mod.syncRouteTitle({ meta: { title: '用户主页' } })
    const wrapper = mountConsumer(mod)

    wrapper.vm.setTitle('neo')
    await nextTick()
    expect(document.title).toBe('neo - Blog')

    wrapper.unmount()
    await nextTick()
    expect(document.title).toBe('用户主页 - Blog')
  })

  it('syncRouteTitle 会清掉动态覆盖（离开详情页回到路由标题）', async () => {
    const mod = await load()
    mod.syncRouteTitle({ meta: { title: '文章详情' } })
    const wrapper = mountConsumer(mod)

    wrapper.vm.setTitle('某篇文章')
    await nextTick()
    expect(document.title).toBe('某篇文章 - Blog')

    mod.syncRouteTitle({ meta: { title: '首页' } })
    await nextTick()
    expect(document.title).toBe('首页 - Blog')

    wrapper.unmount()
  })

  it('setTitle 空值不产生覆盖', async () => {
    const mod = await load()
    mod.syncRouteTitle({ meta: { title: '文章详情' } })
    const wrapper = mountConsumer(mod)

    wrapper.vm.setTitle('')
    await nextTick()
    expect(document.title).toBe('文章详情 - Blog')

    wrapper.unmount()
  })
})
