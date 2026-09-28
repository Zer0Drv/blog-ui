<template>
  <div class="login-wrap">
    <el-card class="login-card">
      <h2 class="title">Blog</h2>
      <el-tabs v-model="tab" stretch>
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" label-position="top" @submit.prevent>
            <el-form-item label="用户名">
              <el-input v-model="loginForm.username" autocomplete="username" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="loginForm.password" type="password" show-password
                        autocomplete="current-password" @keyup.enter="onLogin" />
            </el-form-item>
            <el-button type="primary" class="full" :loading="loading" @click="onLogin">登录</el-button>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="注册" name="register">
          <el-form :model="regForm" label-position="top" @submit.prevent>
            <el-form-item label="用户名">
              <el-input v-model="regForm.username" placeholder="3~32 位字母/数字/下划线" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="regForm.password" type="password" show-password placeholder="6~64 位" />
            </el-form-item>
            <el-form-item label="昵称（可选）">
              <el-input v-model="regForm.nickname" />
            </el-form-item>
            <el-form-item label="邮箱">
              <div class="code-row">
                <el-input v-model="regForm.email" placeholder="用于接收验证码" />
                <el-button :disabled="countdown > 0" @click="onSendCode">
                  {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
                </el-button>
              </div>
            </el-form-item>
            <el-form-item label="验证码">
              <el-input v-model="regForm.code" placeholder="6 位数字" maxlength="6" />
            </el-form-item>
            <el-button type="primary" class="full" :loading="loading" @click="onRegister">注册并登录</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const tab = ref('login')
const loading = ref(false)
const countdown = ref(0)

const loginForm = reactive({ username: '', password: '' })
const regForm = reactive({ username: '', password: '', nickname: '', email: '', code: '' })

async function onLogin() {
  loading.value = true
  try {
    await auth.login(loginForm.username, loginForm.password)
    ElMessage.success('登录成功')
    router.push({ name: 'home' })
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

async function onSendCode() {
  if (!regForm.email) {
    ElMessage.warning('请先填写邮箱')
    return
  }
  try {
    await auth.sendEmailCode(regForm.email)
    ElMessage.success('验证码已发送（dev 模式见后端日志）')
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch { /* 拦截器已提示 */ }
}

async function onRegister() {
  loading.value = true
  try {
    await auth.register({ ...regForm })
    ElMessage.success('注册成功')
    router.push({ name: 'home' })
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.login-card {
  width: 400px;
}
.title {
  text-align: center;
  margin: 0 0 12px;
}
.full {
  width: 100%;
}
.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
</style>
