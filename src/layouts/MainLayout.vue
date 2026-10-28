<template>
  <div class="layout">
    <header class="topbar">
      <div class="topbar-inner">
        <router-link to="/" class="brand">{{ siteName }}</router-link>
        <nav class="nav">
          <router-link to="/" class="nav-link">首页</router-link>
          <router-link to="/archives" class="nav-link">归档</router-link>
          <router-link to="/series" class="nav-link">系列</router-link>
          <router-link v-for="page in pageNavigation" :key="page.id" :to="`/pages/${page.slug}`" class="nav-link">{{ page.title }}</router-link>
          <router-link v-if="auth.isLoggedIn" to="/feed" class="nav-link">动态</router-link>
        </nav>
        <div class="spacer" />
        <!-- P0 全文搜索入口：回车跳 /search?keyword=（窄屏隐藏） -->
        <el-input
          v-model="searchKeyword"
          class="search-input"
          size="small"
          placeholder="搜索文章"
          clearable
          @keyup.enter="onSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <template v-if="auth.isLoggedIn">
          <el-button v-if="auth.canWrite" type="primary" @click="router.push('/editor/new')">
            写文章
          </el-button>
          <!-- M4 通知铃铛：未读数 30s 轮询兜底，已读事件/WS 推送即时刷新，页面隐藏暂停 -->
          <el-badge
            :value="unreadCount"
            :hidden="!unreadCount"
            :max="99"
            class="notify-badge"
          >
            <el-icon class="bell" @click="router.push('/notifications')"><Bell /></el-icon>
          </el-badge>
          <el-dropdown trigger="click" @command="onCommand">
            <span class="user-entry">
              <el-avatar
                :size="28"
                :src="auth.user?.avatar ? resolveUploadUrl(auth.user.avatar) : ''"
              >{{ (auth.user?.nickname || auth.user?.username || '用').slice(0, 1) }}</el-avatar>
              {{ auth.user?.nickname || auth.user?.username || '用户' }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="auth.isAdmin" command="admin">管理后台</el-dropdown-item>
                <el-dropdown-item v-if="auth.canWrite" command="mine">我的文章</el-dropdown-item>
                <el-dropdown-item v-if="auth.canWrite" command="series">我的系列</el-dropdown-item>
                <el-dropdown-item command="favorites">我的收藏</el-dropdown-item>
                <el-dropdown-item command="messages">私信</el-dropdown-item>
                <el-dropdown-item command="settings">个人设置</el-dropdown-item>
                <el-dropdown-item command="feed">关注动态</el-dropdown-item>
                <el-dropdown-item command="logout" divided>登出</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
        <el-button v-else type="primary" plain @click="router.push('/login')">登录</el-button>
      </div>
    </header>
    <main class="content">
      <router-view :key="route.name === 'editor-edit' || route.name === 'editor-new' ? route.path : undefined" />
    </main>
    <!-- P0 页脚：站点描述 / ICP / RSS / Atom -->
    <footer class="footer">
      <div class="footer-inner">
        <span v-if="siteDescription" class="footer-desc">{{ siteDescription }}</span>
        <span class="footer-links">
          <a href="/api/rss.xml" target="_blank" rel="noopener">RSS</a>
          <a href="/api/atom.xml" target="_blank" rel="noopener">Atom</a>
          <router-link :to="auth.isLoggedIn ? '/settings' : '/login?redirect=/settings'">订阅新文章</router-link>
          <!-- P1 友情链接入口（site.friend_links_enabled 开关联动，issue #17） -->
          <router-link v-if="friendLinksEnabled" to="/links">友情链接</router-link>
        </span>
        <span v-if="siteIcp" class="footer-icp">{{ siteIcp }}</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, Bell, Search } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'
import { useRealtimeTopic } from '../composables/useRealtimeTopic'
import { getUnreadCount } from '../api/notification'
import { resolveUploadUrl } from '../api/upload'
import { onProfileUpdated } from '../utils/profileSync'
import { onUnreadChanged } from '../utils/unreadSync'
import { ensureSiteConfig, useSiteConfig } from '../composables/useSiteConfig'
import { getPageNavigation } from '../api/page'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const pageNavigation = ref([])
let navigationSequence = 0
async function refreshPageNavigation() {
  const sequence = ++navigationSequence
  try {
    const links = await getPageNavigation()
    if (sequence === navigationSequence) pageNavigation.value = links || []
  } catch { if (sequence === navigationSequence) pageNavigation.value = [] }
}
onMounted(() => {
  refreshPageNavigation()
  window.addEventListener('page-navigation-changed', refreshPageNavigation)
})
onUnmounted(() => window.removeEventListener('page-navigation-changed', refreshPageNavigation))
watch(() => route.path, refreshPageNavigation)

// P0 搜索框：回车跳搜索页
const searchKeyword = ref('')

function onSearch() {
  const kw = searchKeyword.value.trim()
  if (!kw) return
  router.push({ path: '/search', query: { keyword: kw } })
}

// P0 站点信息：品牌名/页脚；共享 useSiteConfig（sessionStorage 缓存，失败静默保留默认）
const { siteName, siteDescription, siteIcp, friendLinksEnabled } = useSiteConfig()

onMounted(ensureSiteConfig)

// M4 通知未读数轮询（30s 常轮询，页面隐藏暂停由 useRealtimeTopic 内收）
const unreadCount = ref(0)

async function refreshUnread() {
  if (!auth.isLoggedIn || document.visibilityState !== 'visible') return
  try {
    const data = await getUnreadCount()
    unreadCount.value = Number(data?.count) || 0
  } catch { /* 静默失败，下次轮询重试 */ }
}

// 未读徽标：WS 推送（通知/私信）即时刷新 + 30s 常轮询兜底（页面隐藏时暂停、恢复可见立即补一次）
useRealtimeTopic('notification', refreshUnread, { poll: refreshUnread, interval: 30000, mode: 'always', pauseWhenHidden: true })
useRealtimeTopic('private_message', refreshUnread, { poll: null })

// 登录态联动：登录立即补一次未读数；登出清零角标
watch(() => auth.isLoggedIn, loggedIn => {
  if (loggedIn) refreshUnread()
  else unreadCount.value = 0
})

onMounted(() => {
  if (auth.isLoggedIn) refreshUnread()
})

// 资料变更（本标签页保存/其他标签页广播）时刷新全局用户状态，导航栏头像/昵称即时更新
const offProfileUpdated = onProfileUpdated(() => {
  if (auth.isLoggedIn) auth.fetchMe().catch(() => {})
})

// 未读徽标即时刷新（不等 30s 轮询）：
// 1) 本标签页/其他标签页标记已读后广播 unread-changed，立即重拉未读数
// 2) WS 推送新通知/新私信时，未读数立即 +N（由上方 useRealtimeTopic 订阅承担）
const offUnreadChanged = onUnreadChanged(() => refreshUnread())

onUnmounted(() => {
  offProfileUpdated()
  offUnreadChanged()
})

async function onCommand(cmd) {
  if (cmd === 'admin') {
    router.push('/admin')
  } else if (cmd === 'mine') {
    router.push('/my/articles')
  } else if (cmd === 'series') {
    router.push('/my/series')
  } else if (cmd === 'favorites') {
    router.push('/my/favorites')
  } else if (cmd === 'messages') {
    router.push('/messages')
  } else if (cmd === 'settings') {
    router.push('/settings')
  } else if (cmd === 'feed') {
    router.push('/feed')
  } else if (cmd === 'logout') {
    await auth.logout()
    router.push('/')
  }
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}
.topbar {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  position: sticky;
  top: 0;
  z-index: 100;
}
.topbar-inner {
  max-width: 1100px;
  margin: 0 auto;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
}
.brand {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
  text-decoration: none;
}
.nav {
  display: flex;
  gap: 16px;
  min-width: 0;
  max-width: 45%;
  overflow-x: auto;
  align-items: center;
}
.nav-link {
  color: #606266;
  text-decoration: none;
  font-size: 14px;
  flex-shrink: 0;
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-link.router-link-active {
  color: #409eff;
}
.spacer {
  flex: 1;
}
.notify-badge {
  margin-left: 4px;
}
.bell {
  font-size: 20px;
  color: #606266;
  cursor: pointer;
  vertical-align: middle;
}
.bell:hover {
  color: #409eff;
}
.user-entry {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #303133;
  margin-left: 12px;
}
.content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}
/* P0 顶部搜索框：窄屏隐藏 */
.search-input {
  width: 200px;
}
@media (max-width: 768px) {
  .topbar-inner { height: auto; min-height: 56px; flex-wrap: wrap; padding-top: 8px; }
  .nav { order: 3; flex-basis: 100%; max-width: 100%; padding-bottom: 10px; }
  .search-input {
    display: none;
  }
}
/* P0 页脚 */
.footer {
  border-top: 1px solid #e4e7ed;
  background: #fff;
}
.footer-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 16px;
  font-size: 13px;
  color: #909399;
}
.footer-links {
  display: inline-flex;
  gap: 12px;
}
.footer-links a {
  color: #409eff;
  text-decoration: none;
}
.footer-links a:hover {
  text-decoration: underline;
}
</style>
