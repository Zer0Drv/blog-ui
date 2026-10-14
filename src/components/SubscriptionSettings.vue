<template>
  <el-card v-loading="loading" class="subscription-settings">
    <template #header>新文章订阅</template>
    <p>订阅后，新公开文章发布时会出现在通知中心。</p>
    <el-switch v-model="state.enabled" :loading="saving" @change="toggle" />
    <span>{{ state.enabled ? '已订阅站内通知' : '未订阅' }}</span>
    <div v-if="state.enabled" class="email-options">
      <template v-if="state.emailEnabled">
        <p>已开启邮件订阅</p>
        <el-button :loading="saving" @click="disableEmail">关闭邮件订阅</el-button>
      </template>
      <template v-else>
        <p>如需邮件推送，请验证当前账号邮箱。邮件附退订入口，并有发送频率限制。</p>
        <el-button :loading="sending" @click="sendCode">发送确认码到账号邮箱</el-button>
        <div class="confirm-row">
          <el-input v-model="code" maxlength="6" placeholder="6 位邮箱确认码" aria-label="邮箱确认码" />
          <el-button type="primary" :loading="saving" @click="confirm">确认邮件订阅</el-button>
        </div>
      </template>
    </div>
  </el-card>
</template>
<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getSubscription, setSubscription, sendSubscriptionCode, confirmSubscriptionEmail, stopSubscriptionEmail } from '../api/subscription'
const state = reactive({ enabled: false, emailEnabled: false })
const code = ref('')
const loading = ref(false), saving = ref(false), sending = ref(false)
async function load() {
  loading.value = true
  try { Object.assign(state, await getSubscription()) } catch { /* 拦截器已提示 */ }
  finally { loading.value = false }
}
async function toggle(value) {
  saving.value = true
  try { await setSubscription(value); if (!value) state.emailEnabled = false; ElMessage.success(value ? '订阅成功' : '已退订') }
  catch { state.enabled = !value }
  finally { saving.value = false }
}
async function sendCode() {
  sending.value = true
  try { await sendSubscriptionCode(); ElMessage.success('确认码已发送，请查收邮箱') }
  catch { /* 拦截器已提示 */ } finally { sending.value = false }
}
async function confirm() {
  if (!/^\d{6}$/.test(code.value)) { ElMessage.warning('请输入 6 位邮箱确认码'); return }
  saving.value = true
  try { await confirmSubscriptionEmail(code.value); state.emailEnabled = true; code.value = ''; ElMessage.success('邮件订阅已开启') }
  catch { /* 拦截器已提示 */ } finally { saving.value = false }
}
async function disableEmail() {
  saving.value = true
  try { await stopSubscriptionEmail(); state.emailEnabled = false }
  catch { /* 拦截器已提示 */ } finally { saving.value = false }
}
onMounted(load)
</script>
<style scoped>
.subscription-settings { margin-bottom: 16px; }
.email-options { margin-top: 16px; }
.confirm-row { display: flex; gap: 10px; margin-top: 12px; max-width: 450px; }
</style>
