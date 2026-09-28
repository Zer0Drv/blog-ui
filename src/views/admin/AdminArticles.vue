<template>
  <div class="admin-articles">
    <el-card>
      <template #header>
        <div class="header">
          <span>文章管理</span>
          <div class="header-right">
            <el-select
              v-model="status"
              placeholder="全部状态"
              clearable
              style="width: 130px"
              @change="onFilter"
            >
              <el-option label="草稿" value="DRAFT" />
              <el-option label="已发布" value="PUBLISHED" />
              <el-option label="已下架" value="OFFLINE" />
            </el-select>
            <el-input
              v-model="keyword"
              placeholder="搜索标题 / 摘要"
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
        <el-table-column label="标题" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="router.push(`/article/${row.id}`)">{{ row.title }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="作者" width="110" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.author?.nickname || row.author?.username || row.authorNickname || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="置顶" width="70" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="!!row.isTop"
              :loading="row._topLoading"
              @change="val => onToggleTop(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="推荐" width="70" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="!!row.isRecommended"
              :loading="row._recLoading"
              @change="val => onToggleRecommend(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="viewCount" label="浏览量" width="90" align="right">
          <template #default="{ row }">{{ row.viewCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.publishTime || row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="router.push(`/article/${row.id}`)">
              查看
            </el-button>
            <el-button
              v-if="row.status !== 'OFFLINE'"
              size="small"
              link
              type="danger"
              @click="onOffline(row)"
            >强制下架</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无文章" />
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
  offlineArticle,
  pageAdminArticles,
  setArticleRecommended,
  setArticleTop
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
    const data = await pageAdminArticles({
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

async function onToggleTop(row, val) {
  row._topLoading = true
  try {
    await setArticleTop(row.id, val ? 1 : 0)
    row.isTop = val ? 1 : 0
    ElMessage.success(val ? '已置顶' : '已取消置顶')
  } catch { /* 拦截器已提示 */ } finally {
    row._topLoading = false
  }
}

async function onToggleRecommend(row, val) {
  row._recLoading = true
  try {
    await setArticleRecommended(row.id, val ? 1 : 0)
    row.isRecommended = val ? 1 : 0
    ElMessage.success(val ? '已设为推荐' : '已取消推荐')
  } catch { /* 拦截器已提示 */ } finally {
    row._recLoading = false
  }
}

async function onOffline(row) {
  try {
    await ElMessageBox.confirm(`确认强制下架《${row.title}》？`, '警告', {
      type: 'warning',
      confirmButtonText: '下架',
      cancelButtonText: '取消'
    })
  } catch { return }
  try {
    await offlineArticle(row.id)
    ElMessage.success('已下架')
    load()
  } catch { /* 拦截器已提示 */ }
}

function statusText(s) {
  return { DRAFT: '草稿', PUBLISHED: '已发布', OFFLINE: '已下架' }[s] || s
}

function statusType(s) {
  return { DRAFT: 'info', PUBLISHED: 'success', OFFLINE: 'warning' }[s] || 'info'
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
