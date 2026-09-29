<template>
  <el-card class="comment-section">
    <template #header>
      <div class="section-header">
        <span class="section-title">评论 {{ total }}</span>
        <el-radio-group v-model="sort" size="small" @change="onSortChange">
          <el-radio-button value="time_desc">最新</el-radio-button>
          <el-radio-button value="time_asc">最早</el-radio-button>
          <el-radio-button value="hot">最热</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <!-- 顶部发表评论 -->
    <div v-if="auth.isLoggedIn" class="editor-row">
      <el-input
        v-model="newContent"
        type="textarea"
        :rows="3"
        maxlength="1000"
        show-word-limit
        placeholder="写下你的评论..."
      />
      <div v-if="commentCaptcha.visible" class="captcha-row">
        <CaptchaInput ref="commentCaptchaRef" v-model="commentCaptcha.value" scene="comment" />
      </div>
      <div class="editor-actions">
        <el-button type="primary" :loading="submitting" :disabled="!newContent.trim()" @click="submitRoot">
          发表评论
        </el-button>
      </div>
    </div>
    <div v-else class="login-tip">
      <el-button link type="primary" @click="goLogin">登录</el-button>
      <span>后参与评论</span>
    </div>

    <el-skeleton v-if="loading" :rows="4" animated />
    <template v-else>
      <el-empty v-if="!comments.length" description="暂无评论，来抢沙发" :image-size="80" />
      <div v-for="c in comments" :key="c.id" class="comment">
        <el-avatar :size="36" :src="avatarUrl(c.user)" class="avatar">
          {{ (c.user?.nickname || c.user?.username || '匿').slice(0, 1) }}
        </el-avatar>
        <div class="comment-body">
          <div class="comment-head">
            <span class="nickname">{{ c.user?.nickname || c.user?.username }}</span>
            <span class="time">{{ formatTime(c.createTime) }}</span>
          </div>
          <p class="content">{{ c.content }}</p>
          <div class="actions">
            <el-button
              link
              size="small"
              :type="c.liked ? 'primary' : 'info'"
              @click="toggleLike(c)"
            >
              <el-icon><Pointer /></el-icon>
              {{ c.likeCount || 0 }}
            </el-button>
            <el-button link size="small" type="info" @click="openReply(c, null)">回复</el-button>
            <el-button
              v-if="canDelete(c)"
              link
              size="small"
              type="danger"
              @click="onDelete(c, null)"
            >删除</el-button>
          </div>

          <!-- 回复输入框（主评论） -->
          <div v-if="replyTarget && replyTarget.rootId === c.id && !replyTarget.reply" class="reply-box">
            <el-input
              v-model="replyContent"
              type="textarea"
              :rows="2"
              maxlength="1000"
              :placeholder="replyTarget.placeholder"
            />
            <div class="editor-actions">
              <el-button size="small" @click="replyTarget = null">取消</el-button>
              <el-button
                size="small"
                type="primary"
                :loading="submitting"
                :disabled="!replyContent.trim()"
                @click="submitReply(c)"
              >回复</el-button>
            </div>
          </div>

          <!-- 楼中楼回复 -->
          <div v-if="replyList(c).length" class="replies">
            <div v-for="r in replyList(c)" :key="r.id" class="reply">
              <el-avatar :size="24" :src="avatarUrl(r.user)" class="avatar">
                {{ (r.user?.nickname || r.user?.username || '匿').slice(0, 1) }}
              </el-avatar>
              <div class="comment-body">
                <div class="comment-head">
                  <span class="nickname">{{ r.user?.nickname || r.user?.username }}</span>
                  <template v-if="r.replyToUser">
                    <span class="reply-tip">回复</span>
                    <span class="reply-to">@{{ r.replyToUser.nickname || r.replyToUser.username }}</span>
                  </template>
                  <span class="time">{{ formatTime(r.createTime) }}</span>
                </div>
                <p class="content">{{ r.content }}</p>
                <div class="actions">
                  <el-button
                    link
                    size="small"
                    :type="r.liked ? 'primary' : 'info'"
                    @click="toggleLike(r)"
                  >
                    <el-icon><Pointer /></el-icon>
                    {{ r.likeCount || 0 }}
                  </el-button>
                  <el-button link size="small" type="info" @click="openReply(c, r)">回复</el-button>
                  <el-button
                    v-if="canDelete(r)"
                    link
                    size="small"
                    type="danger"
                    @click="onDelete(r, c)"
                  >删除</el-button>
                </div>
                <!-- 回复输入框（二级回复） -->
                <div v-if="replyTarget && replyTarget.reply && replyTarget.reply.id === r.id" class="reply-box">
                  <el-input
                    v-model="replyContent"
                    type="textarea"
                    :rows="2"
                    maxlength="1000"
                    :placeholder="replyTarget.placeholder"
                  />
                  <div class="editor-actions">
                    <el-button size="small" @click="replyTarget = null">取消</el-button>
                    <el-button
                      size="small"
                      type="primary"
                      :loading="submitting"
                      :disabled="!replyContent.trim()"
                      @click="submitReply(c)"
                    >回复</el-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 展开/分页 -->
            <div v-if="!expanded[c.id] && (c.replyCount || 0) > replyList(c).length" class="expand-row">
              <el-button link type="primary" size="small" @click="expandReplies(c)">
                共 {{ c.replyCount }} 条回复，点击查看
              </el-button>
            </div>
            <div v-else-if="expanded[c.id]" class="expand-row">
              <el-pagination
                v-model:current-page="expanded[c.id].page"
                :total="expanded[c.id].total"
                :page-size="replySize"
                layout="prev, pager, next"
                small
                :hide-on-single-page="true"
                @current-change="loadReplies(c)"
              />
              <el-button link type="info" size="small" @click="collapseReplies(c)">收起</el-button>
            </div>
          </div>
          <div v-else-if="(c.replyCount || 0) > 0" class="expand-row">
            <el-button link type="primary" size="small" @click="expandReplies(c)">
              共 {{ c.replyCount }} 条回复，点击查看
            </el-button>
          </div>
        </div>
      </div>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="size"
          layout="prev, pager, next"
          background
          :hide-on-single-page="true"
          @current-change="load"
        />
      </div>
    </template>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Pointer } from '@element-plus/icons-vue'
import { listComments, listReplies, createComment, deleteComment } from '../api/comment'
import { likeComment, unlikeComment } from '../api/interaction'
import { resolveUploadUrl } from '../api/upload'
import { useAuthStore } from '../stores/auth'
import { notifyCommentResult } from './comment-notify'

const props = defineProps({
  articleId: { type: [String, Number], required: true }
})
// 评论数变化时通知父组件（delta 可为负数）
const emit = defineEmits(['change'])

const auth = useAuthStore()
const router = useRouter()

const comments = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const sort = ref('time_desc')
const loading = ref(false)

const newContent = ref('')
const replyContent = ref('')
const submitting = ref(false)
const replyTarget = ref(null) // {rootId, reply|null, placeholder}

const replySize = 10
// 已展开的主评论：rootId -> {list, page, total}
const expanded = reactive({})

// 评论限流（CAPTCHA_REQUIRED）后才显示的图形验证码
const commentCaptcha = reactive({ visible: false, value: { captchaId: '', captchaCode: '' } })
const commentCaptchaRef = ref()

function avatarUrl(user) {
  return user?.avatar ? resolveUploadUrl(user.avatar) : ''
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

function replyList(c) {
  return expanded[c.id] ? expanded[c.id].list : (c.replies || [])
}

function canDelete(c) {
  if (!auth.user) return false
  return auth.user.role === 'ADMIN' || auth.user.id === c.user?.id
}

function goLogin() {
  router.push('/login')
}

// notifyCommentResult 抽至 ./comment-notify.js（便于单测；返回评论是否直接可见）

async function load() {
  loading.value = true
  try {
    const data = await listComments(props.articleId, sort.value, page.value, size.value)
    comments.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

function onSortChange() {
  page.value = 1
  Object.keys(expanded).forEach(k => delete expanded[k])
  load()
}

async function expandReplies(c) {
  expanded[c.id] = { list: [], page: 1, total: c.replyCount || 0 }
  await loadReplies(c)
}

function collapseReplies(c) {
  delete expanded[c.id]
}

async function loadReplies(c) {
  const state = expanded[c.id]
  if (!state) return
  try {
    const data = await listReplies(c.id, state.page, replySize)
    state.list = data.records || []
    state.total = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ }
}

function openReply(root, reply) {
  if (!auth.isLoggedIn) {
    ElMessage.info('请先登录后再评论')
    goLogin()
    return
  }
  const target = reply || root
  replyTarget.value = {
    rootId: root.id,
    reply: reply || null,
    placeholder: `回复 @${target.user?.nickname || target.user?.username}：`
  }
  replyContent.value = ''
}

async function submitRoot() {
  if (!auth.isLoggedIn) {
    goLogin()
    return
  }
  submitting.value = true
  try {
    const res = await createComment({ articleId: Number(props.articleId), content: newContent.value.trim() })
    const visible = notifyCommentResult(res, '评论成功')
    newContent.value = ''
    if (visible) {
      emit('change', 1)
      page.value = 1
      await load()
    }
  } catch { /* 拦截器已提示 */ } finally {
    submitting.value = false
  }
}

async function submitReply(root) {
  const target = replyTarget.value?.reply || root
  submitting.value = true
  try {
    await createComment({
      articleId: Number(props.articleId),
      content: replyContent.value.trim(),
      parentId: root.id,
      replyToUserId: target.user?.id
    })
    ElMessage.success('回复成功')
    replyContent.value = ''
    replyTarget.value = null
    root.replyCount = (root.replyCount || 0) + 1
    emit('change', 1)
    if (expanded[root.id]) {
      expanded[root.id].page = 1
      await loadReplies(root)
    } else if ((root.replies || []).length < 3) {
      // 前 3 条内直接本地追加，避免整页刷新
      await reloadRootReplies(root)
    }
  } catch { /* 拦截器已提示 */ } finally {
    submitting.value = false
  }
}

// 未展开时刷新主评论附带的前 3 条回复（通过整页数据同步最简单可靠）
async function reloadRootReplies(root) {
  await load()
}

async function toggleLike(c) {
  if (!auth.isLoggedIn) {
    ElMessage.info('请先登录')
    goLogin()
    return
  }
  try {
    if (c.liked) {
      await unlikeComment(c.id)
      c.liked = false
      c.likeCount = Math.max(0, (c.likeCount || 0) - 1)
    } else {
      await likeComment(c.id)
      c.liked = true
      c.likeCount = (c.likeCount || 0) + 1
    }
  } catch { /* 拦截器已提示 */ }
}

async function onDelete(c, root) {
  try {
    await ElMessageBox.confirm('确定删除该评论吗？', '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await deleteComment(c.id)
    ElMessage.success('已删除')
    if (root) {
      // 删除二级回复：本地移除并同步 replyCount
      root.replyCount = Math.max(0, (root.replyCount || 0) - 1)
      const list = replyList(root)
      const idx = list.findIndex(r => r.id === c.id)
      if (idx >= 0) list.splice(idx, 1)
      if (expanded[root.id]) expanded[root.id].total = Math.max(0, expanded[root.id].total - 1)
      emit('change', -1)
    } else {
      // 删除主评论：连带回复一并删除，整页刷新
      emit('change', -(1 + (c.replyCount || 0)))
      await load()
    }
  } catch { /* 拦截器已提示 */ }
}

onMounted(async () => {
  if (auth.isLoggedIn && !auth.user) {
    try { await auth.fetchMe() } catch { /* 忽略 */ }
  }
  load()
})
</script>

<style scoped>
.comment-section {
  margin-top: 20px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-title {
  font-weight: 600;
  color: #303133;
}
.editor-row {
  margin-bottom: 20px;
}
.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.captcha-row {
  margin-top: 8px;
  max-width: 320px;
}
.login-tip {
  color: #909399;
  font-size: 13px;
  margin-bottom: 16px;
}
.comment {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid #f0f2f5;
}
.comment:first-of-type {
  border-top: none;
}
.avatar {
  flex-shrink: 0;
  background: #c0c4cc;
  color: #fff;
}
.comment-body {
  flex: 1;
  min-width: 0;
}
.comment-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.nickname {
  color: #606266;
  font-weight: 600;
  font-size: 13px;
}
.reply-tip {
  color: #909399;
  font-size: 12px;
}
.reply-to {
  color: #409eff;
  font-size: 13px;
}
.time {
  color: #909399;
  font-size: 12px;
}
.content {
  margin: 6px 0;
  color: #303133;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}
.actions {
  display: flex;
  gap: 4px;
}
.reply-box {
  margin-top: 8px;
}
.replies {
  margin-top: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px 12px;
}
.reply {
  display: flex;
  gap: 10px;
  padding: 8px 0;
}
.reply + .reply {
  border-top: 1px solid #ebeef5;
}
.expand-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 6px;
}
.pager {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
