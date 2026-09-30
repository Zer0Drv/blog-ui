<template>
  <div class="archives">
    <h2 class="page-title">文章归档</h2>
    <el-skeleton v-if="loading" :rows="8" animated />
    <el-empty v-else-if="!months.length" description="暂无归档文章" />
    <el-timeline v-else class="timeline">
      <el-timeline-item
        v-for="m in months"
        :key="m.month"
        placement="top"
      >
        <!-- 月标题：2026年09月（N） -->
        <template #dot>
          <el-icon class="dot-icon"><Calendar /></el-icon>
        </template>
        <h3 class="month-title">{{ formatMonth(m.month) }}（{{ m.count }}）</h3>
        <el-card shadow="hover" class="month-card">
          <div
            v-for="a in m.articles || []"
            :key="a.id"
            class="archive-item"
            @click="router.push(`/article/${a.id}`)"
          >
            <span class="date">{{ formatDay(a.publishTime) }}</span>
            <span class="name">{{ a.title }}</span>
          </div>
        </el-card>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar } from '@element-plus/icons-vue'
import { getArchives } from '../api/browse'

const router = useRouter()

const months = ref([])
const loading = ref(true)

// month 格式 yyyy-MM → 2026年09月
function formatMonth(month) {
  const [y, m] = String(month || '').split('-')
  return y && m ? `${y}年${m}月` : month
}

function formatDay(t) {
  return t ? String(t).replace('T', ' ').slice(0, 10) : ''
}

onMounted(async () => {
  try {
    months.value = (await getArchives()) || []
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.archives {
  max-width: 860px;
  margin: 0 auto;
}
.page-title {
  margin: 0 0 20px;
  color: #303133;
}
.timeline {
  padding-left: 4px;
}
.dot-icon {
  color: #409eff;
}
.month-title {
  margin: 0 0 10px;
  font-size: 16px;
  color: #303133;
}
.month-card {
  margin-bottom: 8px;
}
.archive-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 4px;
  cursor: pointer;
  border-radius: 4px;
}
.archive-item:hover {
  background: #f5f7fa;
}
.archive-item:hover .name {
  color: #409eff;
}
.date {
  flex-shrink: 0;
  color: #909399;
  font-size: 13px;
}
.name {
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
