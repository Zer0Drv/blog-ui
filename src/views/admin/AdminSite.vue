<template>
  <div class="admin-site">
    <el-card v-loading="loading">
      <template #header>
        <div class="header">
          <span>站点设置</span>
          <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
        </div>
      </template>

      <el-form label-width="120px" class="site-form">
        <el-form-item label="站点名称">
          <el-input v-model="form['site.name']" maxlength="64" placeholder="Blog" />
        </el-form-item>
        <el-form-item label="站点描述">
          <el-input
            v-model="form['site.description']"
            type="textarea"
            :rows="3"
            maxlength="255"
            show-word-limit
            placeholder="用于页脚与 RSS 频道描述"
          />
        </el-form-item>
        <el-form-item label="站点 Logo">
          <el-input v-model="form['site.logo']" maxlength="512" placeholder="Logo 图片 URL（可空）" />
        </el-form-item>
        <el-form-item label="ICP 备案号">
          <el-input v-model="form['site.icp']" maxlength="64" placeholder="非空时显示在页脚" />
        </el-form-item>
        <el-form-item label="页脚文本">
          <el-input v-model="form['site.footer']" maxlength="255" placeholder="自定义页脚内容（可空）" />
        </el-form-item>
        <el-form-item label="站点地址">
          <el-input v-model="form['site.base_url']" maxlength="255" placeholder="http://localhost:5173" />
          <div class="form-tip">前端站点对外地址，用于 RSS/邮件链接</div>
        </el-form-item>
        <el-form-item label="评论审核">
          <el-switch v-model="reviewRequired" />
          <span class="form-tip inline">开启后新评论需审核通过才公开展示</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAdminSiteConfig, saveAdminSiteConfig } from '../../api/admin'

// P0 站点设置：七键表单，打开时 GET /admin/site/config 填表，保存 PUT 全量 map
const KEYS = [
  'site.name',
  'site.description',
  'site.logo',
  'site.icp',
  'site.footer',
  'site.base_url',
  'comment.review_required'
]

const loading = ref(false)
const saving = ref(false)
const form = reactive(Object.fromEntries(KEYS.map(k => [k, ''])))

// el-switch 为布尔，与后端字符串 'true'/'false' 互转
const reviewRequired = computed({
  get: () => form['comment.review_required'] === 'true',
  set: v => { form['comment.review_required'] = v ? 'true' : 'false' }
})

async function load() {
  loading.value = true
  try {
    const data = await getAdminSiteConfig()
    for (const key of KEYS) {
      form[key] = data?.[key] ?? ''
    }
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

async function onSave() {
  saving.value = true
  try {
    const values = Object.fromEntries(KEYS.map(k => [k, form[k] || '']))
    const data = await saveAdminSiteConfig(values)
    for (const key of KEYS) {
      form[key] = data?.[key] ?? values[key]
    }
    ElMessage.success('站点设置已保存')
  } catch { /* 拦截器已提示 */ } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.site-form {
  max-width: 640px;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.form-tip.inline {
  margin-left: 12px;
}
</style>
