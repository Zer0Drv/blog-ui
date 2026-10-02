<template>
  <div class="notifications">
    <el-card>
      <template #header>
        <div class="header">
          <span class="title">通知中心</span>
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="!items.length"
            :loading="markingAll"
            @click="onMarkAllRead"
          >全部已读</el-button>
        </div>
      </template>

      <el-tabs v-model="activeType" @tab-change="onTypeChange">
        <el-tab-pane v-for="t in typeTabs" :key="t.value" :label="t.label" :name="t.value" />
      </el-tabs>

      <el-skeleton v-if="loading" :rows="6" animated />
      <template v-else>
        <el-empty v-if="!items.length" description="暂无通知" />
        <div
          v-for="n in items"
          :key="n.id"
          class="notify-item"
          :class="{ unread: !n.readFlag }"
          @click="onClick(n)"
        >
          <el-avatar :size="36" :src="resolveUploadUrl(n.actor?.avatar) || undefined">
            {{ (n.actor?.nickname || n.actor?.username || '系')[0] }}
          </el-avatar>
          <div class="notify-body">
            <div class="notify-line">
              <span class="actor">{{ n.actor?.nickname || n.actor?.username || '系统' }}</span>
              <span class="action">{{ actionText(n.type) }}</span>
              <span v-if="!n.readFlag" class="dot" />
            </div>
            <div v-if="n.summary" class="summary">{{ n.summary }}</div>
            <div class="time">{{ formatTime(n.createTime) }}</div>
          </div>
        </div>
        <div class="pager">
          <el-pagination
            v-model:current-page="page"
            :total="total"
            :page-size="size"
            layout="total, prev, pager, next"
            background
            @current-change="load"
          />
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { pageNotifications, markRead, markAllRead } from '../api/notification'
import { resolveUploadUrl } from '../api/upload'
import { useRealtimeStore } from '../stores/realtime'
import { onProfileUpdated } from '../utils/profileSync'
import { notifyUnreadChanged } from '../utils/unreadSync'

const router = useRouter()
const realtime = useRealtimeStore()

const typeTabs = [
  { label: '全部', value: '' },
  { label: '回复', value: 'COMMENT_REPLY' },
  { label: '@', value: 'MENTION' },
  { label: '点赞', value: 'ARTICLE_LIKE' },
  { label: '关注', value: 'FOLLOW' },
  { label: '私信', value: 'PRIVATE_MESSAGE' }
]

const activeType = ref('')
const items = ref([])
const total = ref(0)
const page = ref(1)
const size = 10
const loading = ref(false)
const markingAll = ref(false)

function actionText(type) {
  return {
    COMMENT_REPLY: '回复了你的评论',
    MENTION: '在评论中提到了你',
    ARTICLE_LIKE: '点赞了你的文章',
    COMMENT_LIKE: '点赞了你的评论',
    FOLLOW: '关注了你',
    PRIVATE_MESSAGE: '给你发来私信',
    SYSTEM: '系统通知'
  }[type] || '有新动态'
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

async function load() {
  loading.value = true
  try {
    const data = await pageNotifications(activeType.value, page.value, size)
    items.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

function onTypeChange() {
  page.value = 1
  load()
}

// 单条点击：未读先标记，再按类型跳转
async function onClick(n) {
  if (!n.readFlag) {
    try {
      await markRead(n.id)
      n.readFlag = 1
      notifyUnreadChanged() // 通知导航栏立即刷新未读徽标
    } catch { /* 拦截器已提示 */ }
  }
  if (n.type === 'PRIVATE_MESSAGE') {
    router.push('/messages')
  } else if (n.type === 'FOLLOW' && n.actor?.id) {
    // 关注通知跳关注者主页
    router.push(`/users/${n.actor.id}`)
  } else if (n.articleId) {
    router.push(`/article/${n.articleId}`)
  }
}

async function onMarkAllRead() {
  markingAll.value = true
  try {
    await markAllRead()
    items.value.forEach(n => { n.readFlag = 1 })
    notifyUnreadChanged() // 通知导航栏立即刷新未读徽标
    ElMessage.success('已全部标记为已读')
  } catch { /* 拦截器已提示 */ } finally {
    markingAll.value = false
  }
}

// WS 推送的新通知：命中当前 tab（全部/对应类型）且在第 1 页时插入列表顶部；
// 总数即时 +1（未读项带红点样式）；其余情况等下次 load/切页自然带出
function onRealtimeNotification(n) {
  if (!n) return
  total.value += 1
  if (page.value === 1 && (!activeType.value || n.type === activeType.value)) {
    items.value.unshift(n)
    if (items.value.length > size) items.value.pop()
  }
}

// 资料变更（头像/昵称等）时重新拉取通知列表，actor 头像即时刷新
const offProfileUpdated = onProfileUpdated(load)

onMounted(() => {
  realtime.on('notification', onRealtimeNotification)
  load()
})

onUnmounted(() => {
  realtime.off('notification', onRealtimeNotification)
  offProfileUpdated()
})
</script>

<style scoped>
.notifications {
  max-width: 860px;
  margin: 0 auto;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title {
  font-weight: 600;
  color: #303133;
}
.notify-item {
  display: flex;
  gap: 12px;
  padding: 14px 12px;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
  border-radius: 4px;
}
.notify-item:hover {
  background: #f5f7fa;
}
.notify-item.unread {
  background: #ecf5ff;
}
.notify-item.unread:hover {
  background: #d9ecff;
}
.notify-body {
  flex: 1;
  min-width: 0;
}
.notify-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #303133;
}
.actor {
  font-weight: 600;
}
.action {
  color: #606266;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f56c6c;
  margin-left: auto;
}
.summary {
  margin-top: 4px;
  color: #909399;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.time {
  margin-top: 4px;
  color: #c0c4cc;
  font-size: 12px;
}
.pager {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
