<template>
  <section class="restart-panel">
    <p v-if="!capability.available">{{ capability.reason || '正在检查应用重启能力…' }}</p>
    <el-button v-else-if="auth.user?.role === 'SUPER_ADMIN'" type="warning" :disabled="dirty || busy" @click="open = true">重启后端应用</el-button>
    <p v-if="dirty">请先保存或撤销当前修改，再执行重启。</p>
    <p v-if="message" role="status">{{ message }}</p>
    <el-dialog v-model="open" title="确认重启后端应用" width="540px">
      <p>只重启后端应用。请求与实时连接将短暂中断；不会重启宿主机、数据库或对象存储。</p>
      <ul><li v-for="row in pending" :key="row.key">{{ row.description }}：{{ row.activeValue }} → {{ row.value }}</li></ul>
      <p v-if="!pending.length">当前没有待重启参数。</p>
      <el-input v-model="password" type="password" placeholder="你的密码" autocomplete="current-password" />
      <el-input v-model="code" placeholder="已启用二次验证时输入动态码或恢复码" autocomplete="one-time-code" />
      <el-input v-model="confirmation" placeholder="输入 RESTART_BACKEND 确认" />
      <el-button type="warning" :disabled="dirty || busy || !password || confirmation !== 'RESTART_BACKEND'" @click="restart">确认重启</el-button>
    </el-dialog>
  </section>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import http from '../api/http'
import { getSysConfig } from '../api/sysConfig'
import { useAuthStore } from '../stores/auth'
const props = defineProps({ dirty: Boolean, rows: { type: Array, default: () => [] } })
const emit = defineEmits(['recovered'])
const auth = useAuthStore()
const capability = ref({}), busy = ref(false), open = ref(false), password = ref(''), code = ref(''), confirmation = ref(''), message = ref('')
const pending = computed(() => props.rows.filter(row => row.restartRequired))
let timer, job
async function poll() {
  if (!job) return
  if (Date.now() - job.started > 240000) {
    message.value = '恢复验证超时，请人工检查服务；不能确认重启成功。'
    busy.value = false; clearInterval(timer); return
  }
  try {
    const result = await http.get(`/admin/operations/restart/${job.id}`, { silent: true })
    if (result.state === 'FAILED') {
      message.value = result.reason; busy.value = false; clearInterval(timer); return
    }
    if (result.state !== 'RECOVERED') return
    const current = await http.get('/admin/operations/restart', { silent: true })
    if (current.instance === job.instance) return
    const rows = await getSysConfig()
    const effective = job.expected.every(([key,value]) => rows.some(row => row.key === key && !row.restartRequired && JSON.stringify(row.activeValue) === JSON.stringify(value)))
    message.value = effective ? '后端与网关已恢复，待生效参数验证通过。' : '服务已恢复，但参数生效验证未通过，请检查系统参数。'
    busy.value = false; clearInterval(timer); sessionStorage.removeItem('application-restart'); job = null
    emit('recovered')
  } catch { /* A disconnect during restart is expected, never proof of success. */ }
}
async function restart() {
  if (props.dirty || busy.value) return
  busy.value = true
  job = { id: crypto.randomUUID(), instance: capability.value.instance, started: Date.now(), expected: pending.value.map(row => [row.key,row.value]) }
  sessionStorage.setItem('application-restart', JSON.stringify(job))
  message.value = '正在提交并等待恢复；连接断开不代表成功。'
  try {
    await http.post('/admin/operations/restart', { id: job.id, password: password.value, code: code.value, confirmation: confirmation.value })
  } catch (error) {
    if (error.response || error.code) { busy.value = false; job = null; sessionStorage.removeItem('application-restart'); return }
  } finally { open.value = false; password.value = ''; code.value = ''; confirmation.value = '' }
  timer = setInterval(poll, 3000)
}
onMounted(async () => {
  try { capability.value = await http.get('/admin/operations/restart', { silent: true }) } catch { capability.value = { reason: '无法确认运维能力，请刷新或联系服务器管理员。' } }
  try { job = JSON.parse(sessionStorage.getItem('application-restart')); if (job) { busy.value = true; timer = setInterval(poll, 3000); void poll() } } catch { /* invalid storage */ }
})
onUnmounted(() => clearInterval(timer))
</script>
<style scoped>.restart-panel { margin: 16px 0; }.el-input { margin-bottom: 12px; }</style>
