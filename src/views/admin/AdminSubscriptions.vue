<template>
  <el-card v-loading="loading">
    <template #header><div class="header"><span>订阅推送统计</span><el-button @click="load">刷新</el-button></div></template>
    <el-descriptions :column="2" border>
      <el-descriptions-item v-for="(label, key) in labels" :key="key" :label="label">{{ stats[key] || 0 }}</el-descriptions-item>
    </el-descriptions>
    <p>公开文章发布后自动排队，定时文章到点后推送；失败最多重试 3 次。开发邮件表示未配置 SMTP，仅记日志。</p>
  </el-card>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import { getSubscriptionStats } from '../../api/subscription'
const stats = ref({}), loading = ref(false)
const labels = { subscribers: '订阅用户', pendingArticles: '待处理文章', notifications: '站内通知投递', emailsSent: '邮件发送', emailsDev: '开发邮件', failed: '失败记录' }
async function load() {
  loading.value = true
  try { stats.value = await getSubscriptionStats() }
  catch { /* 拦截器已提示 */ } finally { loading.value = false }
}
onMounted(load)
</script>
<style scoped>.header { display: flex; align-items: center; justify-content: space-between; }</style>
