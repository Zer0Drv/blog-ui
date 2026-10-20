<template>
  <main class="totp-login">
    <el-card>
      <h1>两步验证</h1>
      <p>输入验证器中的 6 位动态码，或使用一枚未使用的恢复码。动态码仅可使用一次。</p>
      <el-form @submit.prevent="submit">
        <el-form-item label="动态码或恢复码">
          <el-input v-model="code" autocomplete="one-time-code" maxlength="32" autofocus />
        </el-form-item>
        <el-button native-type="submit" type="primary" :loading="busy" :disabled="!code.trim()">验证并登录</el-button>
        <el-button :disabled="busy" @click="restart">重新登录</el-button>
      </el-form>
      <p>验证请求五分钟内有效。刷新本页后请重新登录。</p>
    </el-card>
  </main>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const code = ref('')
const busy = ref(false)
function restart() { auth.cancelMfa(); router.replace('/login') }
onMounted(() => { if (!auth.mfaChallenge) restart() })
onUnmounted(() => { auth.cancelMfa(); code.value = '' })
async function submit() {
  if (busy.value || !code.value.trim()) return
  busy.value = true
  try {
    await auth.completeMfa(code.value.trim())
    const target = String(route.query.redirect || '/')
    await router.replace(target.startsWith('/') && !target.startsWith('//') ? target : '/')
  } catch { code.value = '' } finally { busy.value = false }
}
</script>
<style scoped>
.totp-login { max-width: 480px; margin: 64px auto; padding: 16px; }
h1 { font-size: 24px; } p { line-height: 1.7; color: #606266; }
</style>
