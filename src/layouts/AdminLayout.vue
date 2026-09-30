<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="logo">管理后台</div>
      <el-menu
        :default-active="$route.path"
        router
        class="menu"
        background-color="#001529"
        text-color="#a6adb4"
        active-text-color="#fff"
      >
        <el-menu-item index="/admin">
          <el-icon><Odometer /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/admin/articles">
          <el-icon><Document /></el-icon>
          <span>文章管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/comments">
          <el-icon><ChatDotSquare /></el-icon>
          <span>评论治理</span>
        </el-menu-item>
        <el-menu-item index="/admin/sensitive-words">
          <el-icon><Lock /></el-icon>
          <span>敏感词库</span>
        </el-menu-item>
        <el-menu-item index="/admin/taxonomy">
          <el-icon><Collection /></el-icon>
          <span>标签分类</span>
        </el-menu-item>
        <el-menu-item index="/admin/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>
    </aside>

    <div class="main-area">
      <header class="topbar">
        <span class="title">{{ pageTitle }}</span>
        <div class="spacer" />
        <el-button @click="router.push('/')">返回前台</el-button>
      </header>
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChatDotSquare, Collection, Document, Lock, Odometer, Setting, User } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const titles = {
  '/admin': '仪表盘',
  '/admin/articles': '文章管理',
  '/admin/comments': '评论治理',
  '/admin/sensitive-words': '敏感词库',
  '/admin/users': '用户管理',
  '/admin/site': '站点设置'
}

const pageTitle = computed(() => titles[route.path] || '管理后台')
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
}
.sidebar {
  width: 200px;
  flex-shrink: 0;
  background: #001529;
  display: flex;
  flex-direction: column;
}
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.menu {
  border-right: none;
  flex: 1;
}
.main-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 100;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.spacer {
  flex: 1;
}
.content {
  padding: 20px;
}
</style>
