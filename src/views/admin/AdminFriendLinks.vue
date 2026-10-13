<template>
  <div class="admin-friend-links">
    <el-card>
      <template #header>
        <div class="header">
          <span>友情链接</span>
          <div class="header-right">
            <el-input
              v-model="keyword"
              placeholder="搜索名称 / URL"
              clearable
              style="width: 220px"
              @keyup.enter="onFilter"
              @clear="onFilter"
            />
            <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 130px" @change="onFilter">
              <el-option label="启用" :value="1" />
              <el-option label="停用" :value="0" />
            </el-select>
            <el-button type="primary" @click="onCreate">新增友链</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="Logo" width="70">
          <template #default="{ row }">
            <el-avatar v-if="row.logo" :src="row.logo" :size="32" shape="square" />
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
        <el-table-column label="URL" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link :href="row.url" target="_blank" type="primary">{{ row.url }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
        <el-table-column prop="sort" label="排序" width="70" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="onEdit(row)">编辑</el-button>
            <el-button size="small" link :type="row.status === 1 ? 'warning' : 'success'" @click="onToggleStatus(row)">
              {{ row.status === 1 ? '停用' : '启用' }}
            </el-button>
            <el-button size="small" link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无友情链接" />
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="load"
          @size-change="onFilter"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑友链' : '新增友链'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" maxlength="64" placeholder="站点名称" />
        </el-form-item>
        <el-form-item label="URL" prop="url">
          <el-input v-model="form.url" maxlength="512" placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="Logo" prop="logo">
          <el-input v-model="form.logo" maxlength="512" placeholder="Logo 图片 URL（可空）" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="255" show-word-limit placeholder="一句话描述（可空）" />
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="form.sort" :min="0" :max="99999" />
          <span class="form-tip">升序展示，越小越靠前</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createFriendLink,
  deleteFriendLink,
  pageFriendLinks,
  setFriendLinkStatus,
  updateFriendLink
} from '../../api/admin'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const keyword = ref('')
const statusFilter = ref(null)
const loading = ref(false)

const dialogVisible = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({ name: '', url: '', logo: '', description: '', sort: 0 })

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  url: [
    { required: true, message: '请输入链接地址', trigger: 'blur' },
    { pattern: /^https?:\/\//i, message: '链接需以 http:// 或 https:// 开头', trigger: 'blur' }
  ]
}

async function load() {
  loading.value = true
  try {
    const params = { page: page.value, size: size.value }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (statusFilter.value !== null && statusFilter.value !== undefined) params.status = statusFilter.value
    const data = await pageFriendLinks(params)
    rows.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

function onFilter() {
  page.value = 1
  load()
}

function resetForm() {
  form.name = ''
  form.url = ''
  form.logo = ''
  form.description = ''
  form.sort = 0
}

function onCreate() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function onEdit(row) {
  editingId.value = row.id
  form.name = row.name || ''
  form.url = row.url || ''
  form.logo = row.logo || ''
  form.description = row.description || ''
  form.sort = row.sort ?? 0
  dialogVisible.value = true
}

async function onSave() {
  try {
    await formRef.value.validate()
  } catch { return }
  saving.value = true
  const payload = {
    name: form.name.trim(),
    url: form.url.trim(),
    logo: form.logo.trim(),
    description: form.description.trim(),
    sort: form.sort ?? 0
  }
  try {
    if (editingId.value) {
      await updateFriendLink(editingId.value, payload)
      ElMessage.success('已保存')
    } else {
      await createFriendLink(payload)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    load()
  } catch { /* 拦截器已提示 */ } finally {
    saving.value = false
  }
}

async function onToggleStatus(row) {
  const next = row.status === 1 ? 0 : 1
  try {
    await setFriendLinkStatus(row.id, next)
    ElMessage.success(next === 1 ? '已启用' : '已停用')
    load()
  } catch { /* 拦截器已提示 */ }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除友链「${row.name}」？`, '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch { return }
  try {
    await deleteFriendLink(row.id)
    ElMessage.success('已删除')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    load()
  } catch { /* 拦截器已提示 */ }
}

onMounted(load)
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.muted {
  color: #c0c4cc;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-left: 12px;
}
</style>
