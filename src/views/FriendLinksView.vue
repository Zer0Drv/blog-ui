<template>
  <div class="friend-links-page">
    <h1 class="page-title">友情链接</h1>
    <p class="page-sub">感谢以下站点与本站互相链接</p>

    <div v-loading="loading" class="link-grid">
      <a
        v-for="link in links"
        :key="link.id"
        class="link-card"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <el-avatar v-if="link.logo" :src="link.logo" :size="44" shape="square" class="link-logo" />
        <div v-else class="link-logo placeholder">{{ link.name?.charAt(0) || '链' }}</div>
        <div class="link-info">
          <span class="link-name">{{ link.name }}</span>
          <span v-if="link.description" class="link-desc">{{ link.description }}</span>
        </div>
      </a>
    </div>
    <el-empty v-if="!loading && links.length === 0" description="暂无友情链接" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getFriendLinks } from '../api/friendlink'

// P1 友情链接公开页（issue #17）：仅展示启用状态，排序由后端保证（sort 升序）
const links = ref([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    links.value = (await getFriendLinks()) || []
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.friend-links-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 20px 48px;
}
.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 8px;
}
.page-sub {
  font-size: 14px;
  color: #909399;
  margin: 0 0 24px;
}
.link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  min-height: 80px;
}
.link-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  text-decoration: none;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.link-card:hover {
  border-color: #409eff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.15);
}
.link-logo {
  flex-shrink: 0;
}
.link-logo.placeholder {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.link-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.link-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.link-desc {
  font-size: 13px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
