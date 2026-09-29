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
            <el-form-item v-if="loginCaptcha.visible" label="图形验证码">
              <CaptchaInput ref="loginCaptchaRef" v-model="loginCaptcha.value" scene="login" />
            </el-form-item>
            <div class="forgot-row">
              <el-button link type="primary" size="small" class="forgot-link" @click="goReset">忘记密码？</el-button>
            </div>
            <el-button type="primary" class="full" :loading="loading" @click="onLogin">登录</el-button>
          </el-form>
          <el-divider>其他登录方式</el-divider>
          <el-button class="full github-btn" @click="onGithubLogin">
            <svg class="github-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
            </svg>
            使用 GitHub 登录
          </el-button>
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
        <el-tab-pane label="重置密码" name="reset">
          <el-form ref="resetFormRef" :model="resetForm" :rules="resetRules" label-position="top" @submit.prevent>
            <el-form-item label="邮箱" prop="email">
              <div class="code-row">
                <el-input v-model="resetForm.email" placeholder="注册时使用的邮箱" autocomplete="email" />
                <el-button :disabled="resetCountdown > 0" @click="onSendResetCode">
                  {{ resetCountdown > 0 ? `${resetCountdown}s` : '发送验证码' }}
                </el-button>
              </div>
            </el-form-item>
            <el-form-item label="验证码" prop="code">
              <el-input v-model="resetForm.code" placeholder="6 位数字" maxlength="6" />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input v-model="resetForm.newPassword" type="password" show-password
                        placeholder="6~32 位" autocomplete="new-password" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="resetForm.confirmPassword" type="password" show-password
                        placeholder="再次输入新密码" autocomplete="new-password" />
            </el-form-item>
            <el-button type="primary" class="full" :loading="loading" @click="onResetPassword">重置密码</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const tab = ref('login')
const loading = ref(false)
const countdown = ref(0)

const loginForm = reactive({ username: '', password: '' })
const regForm = reactive({ username: '', password: '', nickname: '', email: '', code: '' })

// 自适应验证码：三个场景（登录/注册/邮箱验证码）状态互相独立，触发 CAPTCHA_REQUIRED 后才显示
const loginCaptcha = reactive({ visible: false, value: { captchaId: '', captchaCode: '' } })
const regCaptcha = reactive({ visible: false, value: { captchaId: '', captchaCode: '' } })
const emailCaptcha = reactive({ visible: false, value: { captchaId: '', captchaCode: '' } })
const loginCaptchaRef = ref()
const regCaptchaRef = ref()
const emailCaptchaRef = ref()

// 验证码可见时把 captchaId/captchaCode 并入请求体
function captchaPayload(c) {
  return c.visible ? { captchaId: c.value.captchaId, captchaCode: c.value.captchaCode } : {}
}

function isCaptchaRequired(err) {
  return err?.code === CAPTCHA_REQUIRED_CODE
}

// 显示验证码；已显示（再次触发）时换新图——验证码一次性，失败即作废
function showCaptcha(c, captchaRef) {
  if (c.visible) captchaRef.value?.refresh()
  c.visible = true
}

function clearCaptcha(c) {
  c.visible = false
  c.value = { captchaId: '', captchaCode: '' }
}

// 密码找回
const resetFormRef = ref()
const resetCountdown = ref(0)
const resetForm = reactive({ email: '', code: '', newPassword: '', confirmPassword: '' })
const resetRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  code: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度 6~32 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, cb) => {
        if (value !== resetForm.newPassword) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur'
    }
  ]
}

// OAuth 失败回跳提示（failure-redirect 带 error=oauth_failed）
onMounted(() => {
  if (route.query.error === 'oauth_failed') {
    ElMessage.error('GitHub 登录失败，请重试')
  }
})

// GitHub OAuth：直连后端授权端点（不走 vite 代理，避免 redirect_uri 被算成前端域名）
function onGithubLogin() {
  const origin = import.meta.env.VITE_API_ORIGIN || 'http://localhost:8082'
  window.location.href = `${origin}/oauth2/authorization/github`
}

async function onLogin() {
  loading.value = true
  try {
    // store 未提供带 captcha 的登录：直调 http，成功后按 auth.login 的既有逻辑落 token/user
    const data = await http.post('/auth/login', {
      username: loginForm.username,
      password: loginForm.password,
      ...captchaPayload(loginCaptcha)
    })
    auth.setToken(data.access_token)
    await auth.fetchMe()
    clearCaptcha(loginCaptcha)
    ElMessage.success('登录成功')
    router.push({ name: 'home' })
  } catch (err) {
    if (isCaptchaRequired(err)) showCaptcha(loginCaptcha, loginCaptchaRef)
  } finally {
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

// 「忘记密码？」切到重置 tab 并预填注册邮箱（如有）
function goReset() {
  resetForm.email = resetForm.email || regForm.email
  tab.value = 'reset'
}

async function onSendResetCode() {
  if (!resetForm.email) {
    ElMessage.warning('请先填写邮箱')
    return
  }
  try {
    await auth.sendResetCode(resetForm.email)
    ElMessage.success('验证码已发送（dev 模式见后端日志）')
    resetCountdown.value = 60
    const timer = setInterval(() => {
      resetCountdown.value -= 1
      if (resetCountdown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch { /* 拦截器已提示（含邮箱未注册 EMAIL_NOT_REGISTERED） */ }
}

async function onResetPassword() {
  try {
    await resetFormRef.value.validate()
  } catch {
    return // 前端校验未通过（rules 已提示）
  }
  loading.value = true
  try {
    await auth.resetPassword({
      email: resetForm.email,
      code: resetForm.code,
      newPassword: resetForm.newPassword
    })
    ElMessage.success('密码已重置，请使用新密码登录')
    loginForm.username = resetForm.email
    resetForm.code = ''
    resetForm.newPassword = ''
    resetForm.confirmPassword = ''
    tab.value = 'login'
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
.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin: -8px 0 12px;
}
.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.github-btn {
  background: #24292f;
  border-color: #24292f;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.github-btn:hover {
  background: #32383f;
  border-color: #32383f;
  color: #fff;
}
.github-icon {
  flex-shrink: 0;
}
</style>
