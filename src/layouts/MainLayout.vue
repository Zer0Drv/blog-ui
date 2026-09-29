<template>
  <div class="layout">
    <header class="topbar">
      <div class="topbar-inner">
        <router-link to="/" class="brand">Blog</router-link>
        <nav class="nav">
          <router-link to="/" class="nav-link">首页</router-link>
          <router-link v-if="auth.isLoggedIn" to="/feed" class="nav-link">动态</router-link>
        </nav>
        <div class="spacer" />
        <template v-if="auth.isLoggedIn">
          <el-button v-if="canWrite" type="primary" @click="router.push('/editor/new')">
            写文章
          </el-button>
          <!-- M4 通知铃铛：未读数 30s 轮询，页面隐藏暂停 -->
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
              {{ auth.user?.nickname || auth.user?.username || '用户' }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="auth.user?.role === 'ADMIN'" command="admin">管理后台</el-dropdown-item>
                <el-dropdown-item v-if="canWrite" command="mine">我的文章</el-dropdown-item>
                <el-dropdown-item command="favorites">我的收藏</el-dropdown-item>
                <el-dropdown-item command="messages">私信</el-dropdown-item>
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
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDown, Bell } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'
import { getUnreadCount } from '../api/notification'

const auth = useAuthStore()
const router = useRouter()

const canWrite = computed(() => ['ADMIN', 'AUTHOR'].includes(auth.user?.role))

onMounted(() => {
  if (auth.isLoggedIn && !auth.user) auth.fetchMe().catch(() => {})
})

// M4 通知未读数轮询（30s；document.hidden 时暂停）
const unreadCount = ref(0)
let timer = null

async function refreshUnread() {
  if (!auth.isLoggedIn || document.visibilityState !== 'visible') return
  try {
    const data = await getUnreadCount()
    unreadCount.value = Number(data?.count) || 0
  } catch { /* 静默失败，下次轮询重试 */ }
}

function startPolling() {
  stopPolling()
  refreshUnread()
  timer = setInterval(refreshUnread, 30000)
}

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  unreadCount.value = 0
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') refreshUnread()
}

watch(() => auth.isLoggedIn, loggedIn => {
  if (loggedIn) startPolling()
  else stopPolling()
})

onMounted(() => {
  if (auth.isLoggedIn) startPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

async function onCommand(cmd) {
  if (cmd === 'admin') {
    router.push('/admin')
  } else if (cmd === 'mine') {
    router.push('/my/articles')
  } else if (cmd === 'favorites') {
    router.push('/my/favorites')
  } else if (cmd === 'messages') {
    router.push('/messages')
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
}
.nav-link {
  color: #606266;
  text-decoration: none;
  font-size: 14px;
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
</style>
