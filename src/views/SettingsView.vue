<template>
  <div class="settings-view">
    <h2 class="page-title">个人设置</h2>

    <!-- 资料卡片 -->
    <el-card class="settings-card">
      <template #header>
        <span class="card-title">个人资料</span>
      </template>
      <el-form label-width="80px" class="profile-form">
        <el-form-item label="头像">
          <div class="avatar-row">
            <el-avatar :size="64" :src="resolveUploadUrl(profileForm.avatar)">
              {{ (profileForm.nickname || auth.user?.username || '用').slice(0, 1) }}
            </el-avatar>
            <el-upload :show-file-list="false" accept="image/*" :http-request="onAvatarUpload">
              <el-button :loading="avatarUploading">更换头像</el-button>
            </el-upload>
            <el-button v-if="profileForm.avatar" link type="danger" @click="profileForm.avatar = ''">
              移除
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="profileForm.nickname" maxlength="20" show-word-limit placeholder="不超过 20 字" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input
            v-model="profileForm.bio"
            type="textarea"
            :rows="3"
            maxlength="255"
            show-word-limit
            placeholder="介绍一下自己吧"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="profileSaving" :disabled="!profileForm.nickname.trim()" @click="onSaveProfile">
            保存资料
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 安全卡片 -->
    <el-card class="settings-card">
      <template #header>
        <span class="card-title">账号安全</span>
      </template>
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="80px">
        <el-form-item label="旧密码" prop="oldPassword">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="pwdForm.newPassword" type="password" show-password autocomplete="new-password"
                    placeholder="6~64 位" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password autocomplete="new-password"
                    placeholder="再次输入新密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="pwdSaving" @click="onChangePassword">修改密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 通知偏好卡片 -->
    <el-card class="settings-card">
      <template #header>
        <span class="card-title">通知偏好</span>
      </template>
      <el-form label-width="80px">
        <el-form-item label="邮件通知">
          <el-switch v-model="emailNotifyEnabled" :loading="prefLoading" @change="onToggleEmailNotify" />
          <span class="pref-tip">开启后，新的通知将同步发送到你的邮箱</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { updateMyProfile, changeMyPassword, getMyPreferences, updateMyPreferences } from '../api/user'
import { uploadImage, resolveUploadUrl } from '../api/upload'

const router = useRouter()
const auth = useAuthStore()

// ---- 资料卡片 ----
const profileForm = reactive({ nickname: '', avatar: '', bio: '' })
const profileSaving = ref(false)
const avatarUploading = ref(false)

function fillProfile() {
  profileForm.nickname = auth.user?.nickname || ''
  profileForm.avatar = auth.user?.avatar || ''
  profileForm.bio = auth.user?.bio || ''
}

async function onAvatarUpload({ file }) {
  avatarUploading.value = true
  try {
    const data = await uploadImage(file)
    profileForm.avatar = data.url
  } catch { /* 拦截器已提示 */ } finally {
    avatarUploading.value = false
  }
}

async function onSaveProfile() {
  if (!profileForm.nickname.trim()) {
    ElMessage.warning('昵称不能为空')
    return
  }
  profileSaving.value = true
  try {
    await updateMyProfile({
      nickname: profileForm.nickname.trim(),
      avatar: profileForm.avatar || '',
      bio: profileForm.bio || ''
    })
    await auth.fetchMe()
    ElMessage.success('资料已保存')
  } catch { /* 拦截器已提示 */ } finally {
    profileSaving.value = false
  }
}

// ---- 安全卡片 ----
const pwdFormRef = ref()
const pwdSaving = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwdRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6~64 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, cb) => {
        if (value !== pwdForm.newPassword) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur'
    }
  ]
}

async function onChangePassword() {
  try {
    await pwdFormRef.value.validate()
  } catch {
    return // 前端校验未通过（rules 已提示）
  }
  pwdSaving.value = true
  try {
    await changeMyPassword({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword })
    ElMessage.success('密码已修改，请重新登录')
    await auth.logout()
    router.push('/login')
  } catch { /* 拦截器已提示 */ } finally {
    pwdSaving.value = false
  }
}

onMounted(async () => {
  if (!auth.user) {
    try { await auth.fetchMe() } catch { /* 拦截器已提示 */ }
  }
  fillProfile()
  loadPreferences()
})

// ---- 通知偏好卡片（P0）：切换即保存 ----
const emailNotifyEnabled = ref(true)
const prefLoading = ref(false)

async function loadPreferences() {
  try {
    const data = await getMyPreferences()
    emailNotifyEnabled.value = Boolean(data?.emailNotifyEnabled)
  } catch { /* 拦截器已提示 */ }
}

async function onToggleEmailNotify(value) {
  prefLoading.value = true
  try {
    await updateMyPreferences({ emailNotifyEnabled: value })
    ElMessage.success(value ? '已开启邮件通知' : '已关闭邮件通知')
  } catch {
    // 拦截器已提示；保存失败回滚开关
    emailNotifyEnabled.value = !value
  } finally {
    prefLoading.value = false
  }
}
</script>

<style scoped>
.page-title {
  margin: 0 0 16px;
  color: #303133;
}
.settings-card {
  margin-bottom: 16px;
}
.card-title {
  font-weight: 600;
  color: #303133;
}
.profile-form,
.settings-card :deep(.el-form) {
  max-width: 520px;
}
.avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pref-tip {
  margin-left: 12px;
  font-size: 13px;
  color: #909399;
}
</style>
