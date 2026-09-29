<template>
  <div class="oauth-callback">
    <el-card class="callback-card">
      <el-icon v-if="pending" class="is-loading" :size="32"><Loading /></el-icon>
      <p>{{ pending ? 'GitHub 登录中，请稍候…' : '登录失败，正在返回登录页…' }}</p>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'

// GitHub OAuth 回跳页：取后端 302 带回的 token → 写 store → fetchMe → 回首页
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const pending = ref(true)

onMounted(async () => {
  const token = route.query.token
  if (!token) {
    pending.value = false
    ElMessage.error('GitHub 登录失败：未获取到 token')
    router.replace('/login')
    return
  }
  try {
    auth.setToken(String(token))
    await auth.fetchMe()
    ElMessage.success('GitHub 登录成功')
    router.replace('/')
  } catch {
    pending.value = false
    ElMessage.error('GitHub 登录失败，请重试')
    auth.logout()
    router.replace('/login')
  }
})
</script>

<style scoped>
.oauth-callback {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.callback-card {
  padding: 24px 48px;
  text-align: center;
  color: #606266;
}
</style>
