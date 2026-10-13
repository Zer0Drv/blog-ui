<template>
  <el-card v-loading="loading">
    <template #header>
      <div class="header"><span>页面管理</span><el-button type="primary" @click="router.push('/admin/pages/new')">新建页面</el-button></div>
    </template>
    <el-table :data="rows">
      <el-table-column prop="title" label="标题" min-width="160" />
      <el-table-column prop="slug" label="Slug" min-width="140" />
      <el-table-column label="状态" width="100"><template #default="{ row }">{{ statusText(row.status) }}</template></el-table-column>
      <el-table-column label="操作" width="200"><template #default="{ row }">
        <el-button link type="primary" @click="router.push(`/admin/pages/${row.id}`)">编辑</el-button>
        <el-button v-if="row.status === 'PUBLISHED'" link @click="router.push(`/pages/${row.slug}`)">查看</el-button>
        <el-button link type="danger" @click="remove(row)">删除</el-button>
      </template></el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="prev, pager, next, total" @current-change="load" />
  </el-card>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deletePage, listAdminPages, notifyPageNavigationChanged } from '../../api/page'
const router = useRouter()
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const statusText = status => ({ DRAFT: '草稿', PUBLISHED: '已发布', OFFLINE: '已下架' }[status] || status)
async function load() {
  loading.value = true
  try {
    const data = await listAdminPages({ page: page.value, size: 20 })
    rows.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally { loading.value = false }
}
async function remove(row) {
  try {
    await ElMessageBox.confirm(`确认删除「${row.title}」？删除后导航入口将隐藏，slug 仍保留占位。`, '删除页面', { type: 'warning' })
    await deletePage(row.id)
    notifyPageNavigationChanged()
    ElMessage.success('页面已删除')
    if (rows.value.length === 1 && page.value > 1) page.value--
    await load()
  } catch { /* 取消或拦截器已提示 */ }
}
onMounted(load)
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; }
.el-pagination { margin-top: 20px; }
</style>
