<template>
  <el-card class="totp-settings">
    <template #header>两步验证</template>
    <p v-if="loading">正在读取安全设置…</p>
    <template v-else-if="state">
      <template v-if="finished">
        <p>安全设置已更新，所有设备需要重新登录。</p>
        <template v-if="codes.length">
          <el-alert title="请先保存恢复码，每枚只能使用一次，离开后无法再次查看。" type="warning" :closable="false" />
          <pre class="recovery-codes">{{ codes.join('\n') }}</pre>
          <el-checkbox v-model="saved">我已将恢复码保存到安全位置</el-checkbox>
        </template>
        <p><el-button type="primary" :disabled="codes.length > 0 && !saved" @click="relogin">重新登录</el-button></p>
      </template>
      <template v-else>
        <p>{{ state.enabled ? `已开启，剩余 ${state.recoveryRemaining} 枚恢复码。` : '尚未开启。开启后，密码和 GitHub 登录都需要第二因子。' }}</p>
        <p>重置密码不会关闭两步验证。仅有 GitHub 登录的账号请先通过邮箱重置设置密码。</p>
        <el-alert v-if="!state.available" title="站点尚未配置两步验证密钥，请联系管理员。" type="warning" :closable="false" />
        <el-form v-else @submit.prevent>
          <el-form-item label="当前密码">
            <el-input v-model="password" type="password" autocomplete="current-password" maxlength="64" />
          </el-form-item>
          <template v-if="setup">
            <p>用验证器扫描二维码，或手动输入密钥；然后填写动态码确认绑定。十分钟内有效。</p>
            <img v-if="qr" :src="qr" alt="两步验证绑定二维码" width="220" height="220" />
            <p v-else>二维码生成失败，可手动输入下方密钥。</p>
            <code class="secret">{{ setup.secret }}</code>
          </template>
          <el-form-item v-if="state.enabled || setup" :label="setup ? '6 位动态码' : '动态码或恢复码'">
            <el-input v-model="code" autocomplete="one-time-code" :maxlength="setup ? 6 : 32" />
          </el-form-item>
          <el-button v-if="!state.enabled && !setup" type="primary" :loading="busy" :disabled="!password" @click="begin">开始绑定</el-button>
          <el-button v-if="setup" type="primary" :loading="busy" :disabled="!password || !code" @click="change('confirm')">确认开启</el-button>
          <el-button v-if="state.enabled" :loading="busy" :disabled="!password || !code" @click="change('recovery')">重新生成恢复码</el-button>
          <el-button v-if="state.enabled" type="danger" :loading="busy" :disabled="!password || !code" @click="change('disable')">关闭两步验证</el-button>
        </el-form>
      </template>
    </template>
    <el-button v-else @click="load">读取失败，重试</el-button>
  </el-card>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import http from '../api/http'
import { useAuthStore } from '../stores/auth'
const router = useRouter()
const auth = useAuthStore()
const state = ref(null), loading = ref(true), busy = ref(false)
const password = ref(''), code = ref(''), setup = ref(null), qr = ref('')
const codes = ref([]), finished = ref(false), saved = ref(false)
let disposed = false
async function load() {
  loading.value = true
  try { state.value = await http.get('/auth/totp') } catch { state.value = null } finally { loading.value = false }
}
async function begin() {
  if (busy.value) return
  busy.value = true
  try {
    const result = await http.post('/auth/totp/setup', { password: password.value })
    if (disposed) return
    setup.value = result
    try {
      const QRCode = await import('qrcode')
      const image = await QRCode.toDataURL(result.uri, { width: 220, margin: 2 })
      if (!disposed) qr.value = image
    } catch { qr.value = '' }
  } catch { /* Shared HTTP error message. */ } finally { busy.value = false }
}
async function change(action) {
  if (busy.value) return
  busy.value = true
  try {
    if (action !== 'confirm') await ElMessageBox.confirm(
      action === 'disable' ? '关闭后登录将不再要求第二因子，确定继续？' : '重新生成后，全部旧恢复码将失效，确定继续？', '安全设置')
    const result = await http.post(`/auth/totp/${action}`, { password: password.value, code: code.value.trim() })
    codes.value = Array.isArray(result) ? result : []
    finished.value = true
    setup.value = null; qr.value = ''; password.value = ''; code.value = ''
    auth.expireSession()
  } catch { /* Cancel or shared HTTP error. */ } finally { busy.value = false }
}
function relogin() { codes.value = []; router.replace('/login') }
function protect(event) {
  if (busy.value || (codes.value.length && !saved.value)) { event.preventDefault(); event.returnValue = '' }
}
onBeforeRouteLeave(() => {
  if (busy.value) return false
  if (codes.value.length && !saved.value) return false
  return true
})
onMounted(() => { load(); window.addEventListener('beforeunload', protect) })
onBeforeUnmount(() => {
  disposed = true; password.value = ''; code.value = ''; setup.value = null; qr.value = ''; codes.value = []
  window.removeEventListener('beforeunload', protect)
})
</script>
<style scoped>
.totp-settings { margin: 20px 0; } p { line-height: 1.6; } .secret { display: block; overflow-wrap: anywhere; margin: 12px 0; }
.recovery-codes { white-space: pre-wrap; overflow-wrap: anywhere; background: #f5f7fa; padding: 16px; }
</style>
