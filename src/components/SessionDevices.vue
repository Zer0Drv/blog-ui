<template>
  <el-card class="session-devices">
    <template #header>登录设备</template>
    <p v-if="loading" role="status">正在读取登录设备…</p>
    <div v-else-if="loadFailed" role="alert">
      <p>无法读取登录设备。</p>
      <el-button @click="load">重试</el-button>
    </div>
    <template v-else>
      <el-empty v-if="!devices.length" description="暂无可管理的登录设备" :image-size="72" />
      <template v-else>
        <p v-if="!currentKnown">无法识别当前设备，请重新登录后再管理其他设备。</p>
        <ul class="device-list">
          <li v-for="device in devices" :key="device.id" class="device">
            <div>
              <strong>{{ device.label }}</strong>
              <el-tag v-if="device.current" size="small">当前设备</el-tag>
              <p>登录时间 {{ formatTime(device.signedInAt) }} · 最近活动 {{ formatTime(device.lastActiveAt) }}</p>
            </div>
            <el-button v-if="!device.current && currentKnown" :disabled="Boolean(action)" @click="confirm(device)">
              退出此设备
            </el-button>
          </li>
        </ul>
        <el-button v-if="hasOtherDevices" type="danger" plain :disabled="Boolean(action)" @click="confirm(null)">
          退出所有其他设备
        </el-button>
      </template>
    </template>
    <p v-if="outcome" role="status">{{ outcome }}</p>
  </el-card>

  <el-dialog
    v-model="open"
    :title="action?.device ? '退出此设备' : '退出所有其他设备'"
    width="min(480px, calc(100vw - 32px))"
    append-to-body
    :close-on-click-modal="!busy"
    :close-on-press-escape="!busy"
    :show-close="!busy"
    @closed="clear"
  >
    <p>{{ action?.device ? `确认退出「${action.device.label}」？` : '确认退出除当前设备外的所有设备？' }}</p>
    <p>请输入账号密码验证身份。仅使用 GitHub 登录时，请先通过邮箱重置设置密码。</p>
    <p v-if="loadingSecurity" role="status">正在读取两步验证设置…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <el-button v-if="securityFailed" @click="loadSecurity">重试验证设置</el-button>
    <el-form v-else label-position="top" @submit.prevent="submit">
      <el-form-item label="当前密码">
        <el-input v-model="password" type="password" autocomplete="current-password" maxlength="64" />
      </el-form-item>
      <el-form-item v-if="requiresCode" label="动态码或恢复码">
        <el-input v-model="code" autocomplete="one-time-code" maxlength="32" />
      </el-form-item>
      <el-button :disabled="busy" @click="open = false">取消</el-button>
      <el-button
        native-type="submit"
        type="danger"
        :disabled="loadingSecurity || !password || (requiresCode && !code.trim())"
        :loading="busy"
      >确认退出</el-button>
    </el-form>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import http from '../api/http'
import { listSessionDevices, revokeSessionDevices } from '../api/sessionDevices'

const devices = ref([])
const loading = ref(true)
const loadFailed = ref(false)
const outcome = ref('')
const action = ref(null)
const open = ref(false)
const busy = ref(false)
const password = ref('')
const code = ref('')
const error = ref('')
const loadingSecurity = ref(false)
const securityFailed = ref(false)
const requiresCode = ref(false)
const currentKnown = computed(() => devices.value.some(device => device.current))
const hasOtherDevices = computed(() => currentKnown.value && devices.value.some(device => !device.current))
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
let disposed = false

function formatTime(seconds) {
  return Number.isFinite(seconds) && seconds > 0 ? timeFormat.format(seconds * 1000) : '未知'
}

async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    devices.value = await listSessionDevices() || []
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

async function loadSecurity() {
  const target = action.value
  loadingSecurity.value = true
  securityFailed.value = false
  error.value = ''
  try {
    const state = await http.get('/auth/totp', { silent: true })
    if (open.value && action.value === target) requiresCode.value = Boolean(state?.enabled)
  } catch {
    if (open.value && action.value === target) {
      securityFailed.value = true
      error.value = '无法读取两步验证设置。'
    }
  } finally {
    if (action.value === target) loadingSecurity.value = false
  }
}

function clear() {
  action.value = null
  password.value = ''
  code.value = ''
  error.value = ''
  requiresCode.value = false
}

function confirm(device) {
  if (action.value) return
  action.value = { device }
  outcome.value = ''
  open.value = true
  void loadSecurity()
}

async function submit() {
  if (!open.value || busy.value || loadingSecurity.value || securityFailed.value ||
      !password.value || (requiresCode.value && !code.value.trim())) return
  busy.value = true
  error.value = ''
  try {
    const { count } = await revokeSessionDevices(action.value.device?.id, {
      password: password.value, code: code.value.trim() || null
    })
    if (disposed) return
    outcome.value = count ? `已退出 ${count} 台设备。` : '所选设备已退出。'
    open.value = false
    await load()
  } catch (failure) {
    error.value = failure.response?.data?.message || failure.message || '退出失败，请重试。'
  } finally {
    password.value = ''
    code.value = ''
    busy.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => { disposed = true; clear() })
</script>

<style scoped>
.session-devices { margin: 20px 0; }
.device-list { list-style: none; margin: 0 0 16px; padding: 0; }
.device { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; padding: 12px 0; }
.device + .device { border-top: 1px solid var(--el-border-color-light); }
.device p { margin: 6px 0 0; color: var(--el-text-color-regular); font-size: .875rem; }
.device .el-tag { margin-inline-start: 8px; }
</style>
