<template>
  <el-card class="unsubscribe">
    <h1>取消新文章订阅</h1>
    <p v-if="done">已取消站内与邮件订阅，后续新文章将不再推送。</p>
    <template v-else>
      <p>确认后将关闭本站的新文章推送。重新订阅可在个人设置中开启。</p>
      <el-button type="primary" :loading="loading" :disabled="!validToken" @click="confirm">确认退订</el-button>
      <p v-if="!validToken">退订链接无效。</p>
    </template>
  </el-card>
</template>
<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { unsubscribe } from '../api/subscription'
const route = useRoute()
const done = ref(false), loading = ref(false)
const validToken = computed(() => typeof route.query.token === 'string' && /^[a-f0-9]{32}$/.test(route.query.token))
async function confirm() {
  if (!validToken.value) return
  loading.value = true
  try { await unsubscribe(route.query.token); done.value = true }
  catch { /* 拦截器已提示 */ } finally { loading.value = false }
}
</script>
<style scoped>.unsubscribe { max-width: 560px; margin: 40px auto; }</style>
