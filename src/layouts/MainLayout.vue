<template>
  <div class="layout">
    <header class="topbar">
      <div class="topbar-inner">
        <router-link to="/" class="brand">Blog</router-link>
        <nav class="nav">
          <router-link to="/" class="nav-link">首页</router-link>
        </nav>
        <div class="spacer" />
        <template v-if="auth.isLoggedIn">
          <el-button v-if="canWrite" type="primary" @click="router.push('/editor/new')">
            写文章
          </el-button>
          <el-dropdown trigger="click" @command="onCommand">
            <span class="user-entry">
              {{ auth.user?.nickname || auth.user?.username || '用户' }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="mine">我的文章</el-dropdown-item>
                <el-dropdown-item command="favorites">我的收藏</el-dropdown-item>
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
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDown } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const canWrite = computed(() => ['ADMIN', 'AUTHOR'].includes(auth.user?.role))

onMounted(() => {
  if (auth.isLoggedIn && !auth.user) auth.fetchMe().catch(() => {})
})

async function onCommand(cmd) {
  if (cmd === 'mine') {
    router.push('/my/articles')
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
