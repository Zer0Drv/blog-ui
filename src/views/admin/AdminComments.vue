<template>
  <div class="admin-comments">
    <el-card>
      <template #header>
        <div class="header">
          <span>评论治理</span>
          <div class="header-right">
            <el-select
              v-model="status"
              placeholder="全部状态"
              clearable
              style="width: 130px"
              @change="onFilter"
            >
              <el-option label="正常" value="NORMAL" />
              <el-option label="已折叠" value="FOLDED" />
            </el-select>
            <el-input
              v-model="keyword"
              placeholder="搜索评论内容"
              clearable
              style="width: 220px"
              @keyup.enter="onFilter"
              @clear="onFilter"
            >
              <template #append>
                <el-button @click="onFilter">搜索</el-button>
              </template>
            </el-input>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip />
        <el-table-column label="用户" width="110" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.username || row.user?.nickname || row.user?.username || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="文章" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link v-if="row.articleId" type="primary" @click="router.push(`/article/${row.articleId}`)">
              {{ row.articleTitle || `#${row.articleId}` }}
            </el-link>
            <span v-else>{{ row.articleTitle || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="likeCount" label="点赞数" width="80" align="right">
          <template #default="{ row }">{{ row.likeCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'FOLDED' ? 'warning' : 'success'" size="small">
              {{ row.status === 'FOLDED' ? '已折叠' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status !== 'FOLDED'"
              size="small"
              link
              type="warning"
              @click="onFold(row)"
            >折叠</el-button>
            <el-button
              v-else
              size="small"
              link
              type="success"
              @click="onUnfold(row)"
            >恢复</el-button>
            <el-button size="small" link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无评论" />
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="load"
          @size-change="onFilter"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteAdminComment,
  foldComment,
  pageAdminComments,
  unfoldComment
} from '../../api/admin'

const router = useRouter()

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const status = ref('')
const keyword = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const data = await pageAdminComments({
      page: page.value,
      size: size.value,
      status: status.value || undefined,
      keyword: keyword.value || undefined
    })
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

async function onFold(row) {
  try {
    await foldComment(row.id)
    ElMessage.success('已折叠')
    load()
  } catch { /* 拦截器已提示 */ }
}

async function onUnfold(row) {
  try {
    await unfoldComment(row.id)
    ElMessage.success('已恢复')
    load()
  } catch { /* 拦截器已提示 */ }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm('确认删除该评论？连带回复将一并删除，且不可恢复。', '警告', {
      type: 'error',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch { return }
  try {
    await deleteAdminComment(row.id)
    ElMessage.success('已删除')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    load()
  } catch { /* 拦截器已提示 */ }
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
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
  gap: 12px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
