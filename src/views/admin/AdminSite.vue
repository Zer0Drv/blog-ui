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
        <el-form-item label="友情链接">
          <el-switch v-model="friendLinksEnabled" />
          <span class="form-tip inline">点击保存后生效；开启后公众端页脚与友链页展示已启用的友情链接</span>
        </el-form-item>
        <el-form-item label="页面导航">
          <div class="page-navigation">
            <el-select v-model="navigationSlugs" multiple :multiple-limit="20" placeholder="选择页面，按下方顺序展示">
              <el-option v-for="page in pageOptions" :key="page.id" :value="page.slug"
                :label="`${page.title}（${page.status === 'PUBLISHED' ? '已发布' : '未发布'}）`" />
            </el-select>
            <div v-for="(slug, index) in navigationSlugs" :key="slug" class="navigation-row">
              <span>{{ pageOptions.find(page => page.slug === slug)?.title || slug }}</span>
              <el-button size="small" :disabled="index === 0" @click="moveNavigation(index, -1)">上移</el-button>
              <el-button size="small" :disabled="index === navigationSlugs.length - 1" @click="moveNavigation(index, 1)">下移</el-button>
            </div>
            <div class="form-tip">最多 20 个入口；未发布、下架或删除的页面自动隐藏。修改 slug 后请重新选择。</div>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAdminSiteConfig, saveAdminSiteConfig } from '../../api/admin'
import { listAdminPages, notifyPageNavigationChanged } from '../../api/page'
import { publishSiteConfig } from '../../composables/useSiteConfig'

// P0 站点设置：八键表单，打开时 GET /admin/site/config 填表，保存 PUT 全量 map
const KEYS = [
  'site.name',
  'site.description',
  'site.logo',
  'site.icp',
  'site.footer',
  'site.base_url',
  'comment.review_required',
  'site.friend_links_enabled',
  'site.page_navigation'
]

const loading = ref(false)
const saving = ref(false)
const form = reactive(Object.fromEntries(KEYS.map(k => [k, ''])))
const navigationSlugs = ref([])
const pageOptions = ref([])
function parseNavigation(raw) {
  try { const value = JSON.parse(raw || '[]'); return Array.isArray(value) ? value : [] }
  catch { return [] }
}
function moveNavigation(index, direction) {
  const other = index + direction
  if (other < 0 || other >= navigationSlugs.value.length) return
  const copy = [...navigationSlugs.value]
  ;[copy[index], copy[other]] = [copy[other], copy[index]]
  navigationSlugs.value = copy
}

// el-switch 为布尔，与后端字符串 'true'/'false' 互转
const reviewRequired = computed({
  get: () => form['comment.review_required'] === 'true',
  set: v => { form['comment.review_required'] = v ? 'true' : 'false' }
})

// P1 友链展示开关（issue #17），同上布尔互转
const friendLinksEnabled = computed({
  get: () => form['site.friend_links_enabled'] === 'true',
  set: v => { form['site.friend_links_enabled'] = v ? 'true' : 'false' }
})

async function load() {
  loading.value = true
  try {
    const data = await getAdminSiteConfig()
    for (const key of KEYS) {
      form[key] = data?.[key] ?? ''
    }
    navigationSlugs.value = parseNavigation(form['site.page_navigation'])
    const pages = await listAdminPages({ page: 1, size: 500 })
    pageOptions.value = pages.records || []
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

async function onSave() {
  saving.value = true
  try {
    form['site.page_navigation'] = JSON.stringify(navigationSlugs.value)
    const values = Object.fromEntries(KEYS.map(k => [k, form[k] || '']))
    const data = await saveAdminSiteConfig(values)
    for (const key of KEYS) {
      form[key] = data?.[key] ?? values[key]
    }
    publishSiteConfig(Object.fromEntries(['site.name', 'site.description', 'site.icp', 'site.friend_links_enabled'].map(k => [k, form[k]])))
    ElMessage.success('站点设置已保存')
    notifyPageNavigationChanged()
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
.page-navigation { width: 100%; }
.page-navigation .el-select { width: 100%; }
.navigation-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
.navigation-row span { flex: 1; }
.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.form-tip.inline {
  margin-left: 12px;
}
</style>
