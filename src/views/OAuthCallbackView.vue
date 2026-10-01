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

// GitHub OAuth 回跳页：取后端 302 带回的一次性 code → POST /auth/oauth/exchange 换 Cookie 会话 → 回首页（#13）
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const pending = ref(true)

onMounted(async () => {
  const code = route.query.code
  if (!code) {
    pending.value = false
    ElMessage.error('GitHub 登录失败：未获取到授权码')
    router.replace('/login')
    return
  }
  try {
    await auth.exchangeOAuthCode(String(code))
    ElMessage.success('GitHub 登录成功')
    router.replace('/')
  } catch {
    // code 缺失/过期/已使用（后端 400/401）：提示并回登录页重试
    pending.value = false
    ElMessage.error('GitHub 登录失败：授权码无效或已过期，请重试')
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
