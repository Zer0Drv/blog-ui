<template>
  <el-button v-if="auth.user?.role === 'SUPER_ADMIN' && user.role === 'ADMIN'" link type="danger" @click="open = true">应急处置</el-button>
  <el-dialog v-model="open" title="管理员应急处置" width="min(520px, calc(100vw - 32px))" append-to-body class="owner-operations-dialog" @closed="clear">
    <p class="owner-operations-description">目标：{{ user.username }}。操作将撤销目标全部会话；所有权转移后你将降为普通管理员并退出。</p>
    <el-form label-width="120px" @submit.prevent="submit">
      <el-form-item label="操作"><el-select v-model="action">
        <el-option v-for="[value,label] in actions" :key="value" :value="value" :label="label" />
      </el-select></el-form-item>
      <el-form-item v-if="action === 'EMAIL'" label="新邮箱"><el-input v-model="email" type="email" /></el-form-item>
      <p v-if="action === 'RESET_PASSWORD'">现有密码会失效。目标用户须通过邮箱找回密码；已启用的二次验证仍保留。</p>
      <el-form-item label="你的密码"><el-input v-model="password" type="password" autocomplete="current-password" /></el-form-item>
      <el-form-item label="二次验证码"><el-input v-model="code" placeholder="已启用时必填，可用恢复码" autocomplete="one-time-code" /></el-form-item>
      <el-form-item label="确认用户名"><el-input v-model="confirmation" :placeholder="user.username" /></el-form-item>
      <el-button type="danger" :loading="busy" :disabled="confirmation !== user.username || !password" @click="submit">确认执行</el-button>
    </el-form>
  </el-dialog>
</template>
<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import http from '../api/http'
import { useAuthStore } from '../stores/auth'
const props = defineProps({ user: { type: Object, required: true } })
const emit = defineEmits(['changed'])
const auth = useAuthStore()
const open = ref(false), busy = ref(false), action = ref('LOGOUT'), password = ref(''), code = ref(''), confirmation = ref(''), email = ref('')
const actions = [['FREEZE','冻结账号'],['UNFREEZE','解冻账号'],['DEMOTE','降为普通用户'],['LOGOUT','强制下线'],['RESET_PASSWORD','作废密码，要求邮箱重置'],['EMAIL','修正邮箱'],['RESET_TOTP','重置二次验证'],['TRANSFER','转移所有权（自身降权）']]
function clear() { password.value = ''; code.value = ''; confirmation.value = ''; email.value = '' }
async function submit() {
  if (busy.value) return
  busy.value = true
  try {
    await http.post(`/admin/owner/users/${props.user.id}`, { action: action.value, password: password.value, code: code.value, confirmation: confirmation.value, email: email.value })
    ElMessage.success('处置完成，目标会话已撤销')
    open.value = false
    emit('changed')
    if (action.value === 'TRANSFER') await auth.fetchMe()
  } catch { /* API feedback */ } finally { busy.value = false; password.value = ''; code.value = '' }
}
</script>

<style scoped>
.owner-operations-description {
  overflow-wrap: anywhere;
}
</style>
