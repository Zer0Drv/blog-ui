<template>
  <div class="user-profile">
    <el-card v-if="profile" class="profile-card">
      <div class="profile-body">
        <el-avatar :size="72" :src="resolveUploadUrl(profile.avatar) || undefined">
          {{ (profile.nickname || profile.username || '?')[0] }}
        </el-avatar>
        <div class="profile-info">
          <h2 class="nickname">{{ profile.nickname || profile.username }}</h2>
          <p class="bio">{{ profile.bio || '这个人很懒，什么都没留下' }}</p>
          <div class="stats">
            <span>粉丝 {{ profile.followerCount || 0 }}</span>
            <span>关注 {{ profile.followingCount || 0 }}</span>
            <span>文章 {{ profile.articleCount || 0 }}</span>
          </div>
        </div>
        <!-- 本人主页不显示关注按钮 -->
        <el-button
          v-if="!isSelf"
          :type="profile.followed ? 'default' : 'primary'"
          :plain="!!profile.followed"
          :loading="following"
          @click="toggleFollow"
        >{{ profile.followed ? '已关注' : '+ 关注' }}</el-button>
      </div>
    </el-card>
    <el-skeleton v-else-if="profileLoading" :rows="3" animated />

    <h3 class="section-title">TA 的文章</h3>
    <el-skeleton v-if="articlesLoading" :rows="6" animated />
    <template v-else>
      <el-empty v-if="!articles.length" description="暂无文章" />
      <el-card
        v-for="a in articles"
        :key="a.id"
        class="article-card"
        shadow="hover"
        @click="router.push(`/article/${a.id}`)"
      >
        <div class="card-body">
          <img v-if="a.cover" :src="resolveUploadUrl(a.cover)" class="cover" alt="cover" />
          <div class="info">
            <h3 class="title">{{ a.title }}</h3>
            <p class="summary">{{ a.summary }}</p>
            <div class="meta">
              <span>{{ formatTime(a.publishTime || a.createTime) }}</span>
              <el-tag v-if="a.categoryName" size="small" type="info">{{ a.categoryName }}</el-tag>
            </div>
          </div>
        </div>
      </el-card>
      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="loadArticles"
          @size-change="onSizeChange"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getUserProfile, follow, unfollow, pageUserArticles } from '../api/social'
import { resolveUploadUrl } from '../api/upload'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const userId = computed(() => route.params.id)
const profile = ref(null)
const profileLoading = ref(true)
const following = ref(false)

const articles = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const articlesLoading = ref(false)

const isSelf = computed(() => auth.user && profile.value && String(auth.user.id) === String(profile.value.id))

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

async function loadProfile() {
  profileLoading.value = true
  try {
    profile.value = await getUserProfile(userId.value)
  } catch { /* 拦截器已提示 */ } finally {
    profileLoading.value = false
  }
}

async function loadArticles() {
  articlesLoading.value = true
  try {
    const data = await pageUserArticles(userId.value, page.value, size.value)
    articles.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally {
    articlesLoading.value = false
  }
}

function onSizeChange() {
  page.value = 1
  loadArticles()
}

async function toggleFollow() {
  if (!auth.isLoggedIn) {
    ElMessage.info('请先登录')
    router.push('/login')
    return
  }
  following.value = true
  try {
    if (profile.value.followed) {
      await unfollow(userId.value)
      profile.value.followed = false
      profile.value.followerCount = Math.max(0, (profile.value.followerCount || 0) - 1)
      ElMessage.success('已取消关注')
    } else {
      await follow(userId.value)
      profile.value.followed = true
      profile.value.followerCount = (profile.value.followerCount || 0) + 1
      ElMessage.success('关注成功')
    }
  } catch { /* 拦截器已提示 */ } finally {
    following.value = false
  }
}

async function init() {
  page.value = 1
  await Promise.all([
    loadProfile(),
    loadArticles(),
    auth.isLoggedIn && !auth.user ? auth.fetchMe().catch(() => {}) : Promise.resolve()
  ])
}

// 同一组件复用时（/users/:id 间切换）重新加载
watch(userId, init)
onMounted(init)
</script>

<style scoped>
.user-profile {
  max-width: 860px;
  margin: 0 auto;
}
.profile-card {
  margin-bottom: 20px;
}
.profile-body {
  display: flex;
  gap: 20px;
  align-items: center;
}
.profile-info {
  flex: 1;
  min-width: 0;
}
.nickname {
  margin: 0 0 6px;
  color: #303133;
}
.bio {
  margin: 0 0 10px;
  color: #909399;
  font-size: 13px;
}
.stats {
  display: flex;
  gap: 20px;
  color: #606266;
  font-size: 13px;
}
.section-title {
  color: #303133;
}
.article-card {
  margin-bottom: 14px;
  cursor: pointer;
}
.card-body {
  display: flex;
  gap: 16px;
}
.cover {
  width: 160px;
  height: 110px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
.info {
  min-width: 0;
}
.title {
  margin: 0 0 8px;
  font-size: 18px;
  color: #303133;
}
.summary {
  margin: 0 0 10px;
  color: #909399;
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #909399;
  font-size: 12px;
  flex-wrap: wrap;
}
.pager {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
