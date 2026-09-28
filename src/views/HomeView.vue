<template>
  <div class="home">
    <el-card class="card">
      <template #header>
        <div class="header">
          <span>Blog 首页（M1 骨架）</span>
          <el-button size="small" @click="onLogout">登出</el-button>
        </div>
      </template>
      <el-descriptions v-if="auth.user" :column="1" border>
        <el-descriptions-item label="ID">{{ auth.user.id }}</el-descriptions-item>
        <el-descriptions-item label="用户名">{{ auth.user.username }}</el-descriptions-item>
        <el-descriptions-item label="昵称">{{ auth.user.nickname }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ auth.user.email }}</el-descriptions-item>
        <el-descriptions-item label="角色">
          <el-tag :type="auth.user.role === 'ADMIN' ? 'danger' : 'primary'">{{ auth.user.role }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ auth.user.createTime }}</el-descriptions-item>
      </el-descriptions>
      <el-skeleton v-else :rows="5" animated />
    </el-card>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

onMounted(() => {
  if (!auth.user) auth.fetchMe().catch(() => {})
})

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding-top: 60px;
  background: #f5f7fa;
}
.card {
  width: 560px;
  height: fit-content;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
