<template>
  <div class="admin-dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="16">
      <el-col v-for="c in cards" :key="c.label" :xs="12" :sm="12" :md="8" :lg="8" class="stat-col">
        <el-card shadow="hover" class="stat-card">
          <el-statistic :title="c.label" :value="c.value">
            <template #prefix>
              <el-icon :color="c.color"><component :is="c.icon" /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最新列表 -->
    <el-row :gutter="16" class="recent-row">
      <el-col :xs="24" :md="8">
        <el-card>
          <template #header><span>最新用户</span></template>
          <el-table :data="recent.latestUsers" size="small" v-loading="recentLoading">
            <el-table-column prop="username" label="用户名" min-width="90" show-overflow-tooltip />
            <el-table-column prop="nickname" label="昵称" min-width="90" show-overflow-tooltip>
              <template #default="{ row }">{{ row.nickname || '-' }}</template>
            </el-table-column>
            <el-table-column label="注册时间" width="100">
              <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
            </el-table-column>
            <template #empty><el-empty description="暂无数据" :image-size="60" /></template>
          </el-table>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card>
          <template #header><span>最新文章</span></template>
          <el-table :data="recent.latestArticles" size="small" v-loading="recentLoading">
            <el-table-column label="标题" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">
                <el-link type="primary" @click="router.push(`/article/${row.id}`)">{{ row.title }}</el-link>
              </template>
            </el-table-column>
            <el-table-column prop="authorNickname" label="作者" width="90" show-overflow-tooltip />
            <el-table-column label="发布时间" width="100">
              <template #default="{ row }">{{ formatTime(row.publishTime) }}</template>
            </el-table-column>
            <template #empty><el-empty description="暂无数据" :image-size="60" /></template>
          </el-table>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card>
          <template #header><span>最新评论</span></template>
          <el-table :data="recent.latestComments" size="small" v-loading="recentLoading">
            <el-table-column prop="content" label="内容" min-width="120" show-overflow-tooltip />
            <el-table-column prop="username" label="用户" width="90" show-overflow-tooltip />
            <el-table-column label="时间" width="100">
              <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
            </el-table-column>
            <template #empty><el-empty description="暂无数据" :image-size="60" /></template>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ChatDotSquare,
  Document,
  Plus,
  User,
  UserFilled,
  View
} from '@element-plus/icons-vue'
import { getStatsOverview, getStatsRecent } from '../../api/admin'

const router = useRouter()

const overview = ref({})
const recent = ref({ latestUsers: [], latestArticles: [], latestComments: [] })
const recentLoading = ref(false)
const cards = ref([])

function buildCards(o) {
  return [
    { label: '用户数', value: Number(o.userCount) || 0, icon: User, color: '#409eff' },
    { label: '文章数', value: Number(o.articleCount) || 0, icon: Document, color: '#67c23a' },
    { label: '评论数', value: Number(o.commentCount) || 0, icon: ChatDotSquare, color: '#e6a23c' },
    { label: '总浏览量', value: Number(o.totalViews) || 0, icon: View, color: '#909399' },
    { label: '今日新增用户', value: Number(o.todayNewUsers) || 0, icon: UserFilled, color: '#409eff' },
    { label: '今日新增文章', value: Number(o.todayNewArticles) || 0, icon: Plus, color: '#67c23a' },
    { label: '今日新增评论', value: Number(o.todayNewComments) || 0, icon: ChatDotSquare, color: '#e6a23c' }
  ]
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(5, 16) : ''
}

onMounted(async () => {
  try {
    overview.value = (await getStatsOverview()) || {}
    cards.value = buildCards(overview.value)
  } catch { /* 拦截器已提示 */ }
  recentLoading.value = true
  try {
    const data = (await getStatsRecent()) || {}
    recent.value = {
      latestUsers: data.latestUsers || [],
      latestArticles: data.latestArticles || [],
      latestComments: data.latestComments || []
    }
  } catch { /* 拦截器已提示 */ } finally {
    recentLoading.value = false
  }
})
</script>

<style scoped>
.stat-col {
  margin-bottom: 16px;
}
.stat-card :deep(.el-statistic__head) {
  margin-bottom: 6px;
}
.recent-row .el-col {
  margin-bottom: 16px;
}
</style>
