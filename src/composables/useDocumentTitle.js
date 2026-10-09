import { computed, onUnmounted, ref, watch } from 'vue'
import { DEFAULT_SITE_NAME, useSiteConfig } from './useSiteConfig'

// 客户端页签标题：统一组合为 `<页面标题> - <站点名>`，无页面标题时只用站点名
// 不引入 @vueuse/head 之类依赖，模块级两份状态 + 一个 watch 即可：
//   routeTitle    —— 由 router.afterEach 同步 to.meta.title
//   titleOverride —— 动态页（文章详情/用户主页）加载完成后覆盖
// siteName 异步到达或覆盖变化时 watch 自动刷新 document.title
const { siteName } = useSiteConfig()

const routeTitle = ref('')
const titleOverride = ref('')

const fullTitle = computed(() => {
  const page = titleOverride.value || routeTitle.value
  const site = siteName.value || DEFAULT_SITE_NAME
  return page ? `${page} - ${site}` : site
})

watch(fullTitle, title => {
  document.title = title
}, { immediate: true })

// router.afterEach 直接注册本函数：清空动态覆盖并套用新路由的 meta.title
export function syncRouteTitle(to) {
  titleOverride.value = ''
  routeTitle.value = to?.meta?.title || ''
}

// 动态页使用：setTitle 覆盖标题，resetTitle/组件卸载时恢复路由 meta 标题
export function useDocumentTitle() {
  function setTitle(title) {
    titleOverride.value = (title || '').trim()
  }

  function resetTitle() {
    titleOverride.value = ''
  }

  onUnmounted(resetTitle)

  return { setTitle, resetTitle }
}
