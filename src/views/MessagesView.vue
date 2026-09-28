<template>
  <div class="messages-page">
    <el-card class="messages-card">
      <div class="messages-layout">
        <!-- 左侧会话列表 -->
        <aside class="conv-col">
          <div class="conv-header">私信</div>
          <el-skeleton v-if="convsLoading" :rows="4" animated class="conv-skeleton" />
          <template v-else>
            <div v-if="!conversations.length" class="conv-empty">暂无会话</div>
            <div
              v-for="c in conversations"
              :key="c.peer?.id"
              class="conv-item"
              :class="{ active: activePeer?.id === c.peer?.id }"
              @click="selectConversation(c.peer)"
            >
              <el-badge :value="c.unreadCount" :hidden="!c.unreadCount" :max="99">
                <el-avatar :size="40" :src="resolveUploadUrl(c.peer?.avatar) || undefined">
                  {{ (c.peer?.nickname || c.peer?.username || '?')[0] }}
                </el-avatar>
              </el-badge>
              <div class="conv-info">
                <div class="conv-name">{{ c.peer?.nickname || c.peer?.username }}</div>
                <div class="conv-last">{{ c.lastMessage?.content || '' }}</div>
              </div>
            </div>
          </template>
        </aside>

        <!-- 右侧聊天窗 -->
        <section class="chat-col">
          <template v-if="activePeer">
            <div class="chat-header">
              {{ activePeer.nickname || activePeer.username }}
            </div>
            <div ref="msgBoxRef" class="chat-body">
              <el-skeleton v-if="msgsLoading" :rows="4" animated />
              <template v-else>
                <el-empty v-if="!messages.length" description="暂无消息，打个招呼吧" />
                <div
                  v-for="m in messages"
                  :key="m.id"
                  class="msg-row"
                  :class="{ mine: isMine(m) }"
                >
                  <el-avatar
                    v-if="!isMine(m)"
                    :size="32"
                    :src="resolveUploadUrl(activePeer.avatar) || undefined"
                    class="msg-avatar"
                  >{{ (activePeer.nickname || activePeer.username || '?')[0] }}</el-avatar>
                  <div class="msg-bubble">
                    <div class="msg-content">{{ m.content }}</div>
                    <div class="msg-time">{{ formatTime(m.createTime) }}</div>
                  </div>
                </div>
              </template>
            </div>
            <div class="chat-input">
              <el-input
                v-model="draft"
                type="textarea"
                :rows="2"
                maxlength="1000"
                placeholder="输入消息，Enter 发送（Shift+Enter 换行）"
                @keydown.enter.exact.prevent="send"
              />
              <el-button
                type="primary"
                :loading="sending"
                :disabled="!draft.trim()"
                @click="send"
              >发送</el-button>
            </div>
          </template>
          <div v-else class="chat-placeholder">
            <el-empty description="选择左侧会话开始聊天" />
          </div>
        </section>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { listConversations, pageMessages, sendMessage, markConversationRead } from '../api/message'
import { resolveUploadUrl } from '../api/upload'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const conversations = ref([])
const convsLoading = ref(true)
const activePeer = ref(null)

const messages = ref([])
const msgsLoading = ref(false)
const msgBoxRef = ref(null)

const draft = ref('')
const sending = ref(false)

let pollTimer = null

function isMine(m) {
  return String(m.senderId) === String(auth.user?.id)
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

async function loadConversations() {
  try {
    conversations.value = await listConversations() || []
  } catch { /* 拦截器已提示 */ } finally {
    convsLoading.value = false
  }
}

// 消息分页返回 create_time 倒序，前端倒转为正序展示
async function loadMessages(silent = false) {
  if (!activePeer.value) return
  if (!silent) msgsLoading.value = true
  try {
    const data = await pageMessages(activePeer.value.id, 1, 20)
    messages.value = (data.records || []).slice().reverse()
    if (!silent) await nextTick()
    scrollToBottom()
  } catch { /* 拦截器已提示 */ } finally {
    msgsLoading.value = false
  }
}

function scrollToBottom() {
  const el = msgBoxRef.value
  if (el) el.scrollTop = el.scrollHeight
}

// 切换会话：拉消息 + 清未读 + 刷新会话列表未读数
async function selectConversation(peer) {
  if (!peer || activePeer.value?.id === peer.id) return
  activePeer.value = peer
  draft.value = ''
  await loadMessages()
  markConversationRead(peer.id)
    .then(() => {
      const c = conversations.value.find(x => x.peer?.id === peer.id)
      if (c) c.unreadCount = 0
    })
    .catch(() => {})
}

async function send() {
  const content = draft.value.trim()
  if (!content || !activePeer.value || sending.value) return
  sending.value = true
  try {
    await sendMessage(activePeer.value.id, content)
    draft.value = ''
    await loadMessages(true)
    scrollToBottom()
    loadConversations()
  } catch { /* 拦截器已提示 */ } finally {
    sending.value = false
  }
}

// 5s 轮询：拉当前会话新消息 + 会话列表（未读数/最后消息）
async function poll() {
  if (!activePeer.value) return
  await loadMessages(true)
  loadConversations()
}

onMounted(async () => {
  if (!auth.user) {
    try { await auth.fetchMe() } catch { /* 忽略 */ }
  }
  await loadConversations()
  if (conversations.value.length) selectConversation(conversations.value[0].peer)
  pollTimer = setInterval(poll, 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.messages-page {
  max-width: 960px;
  margin: 0 auto;
}
.messages-layout {
  display: flex;
  height: 600px;
}
.conv-col {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid #ebeef5;
  overflow-y: auto;
}
.conv-header {
  padding: 12px 16px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
}
.conv-skeleton {
  padding: 12px;
}
.conv-empty {
  padding: 24px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}
.conv-item {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  align-items: center;
}
.conv-item:hover {
  background: #f5f7fa;
}
.conv-item.active {
  background: #ecf5ff;
}
.conv-info {
  flex: 1;
  min-width: 0;
}
.conv-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}
.conv-last {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.chat-header {
  padding: 12px 16px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
}
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.chat-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.msg-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  align-items: flex-start;
}
.msg-row.mine {
  justify-content: flex-end;
}
.msg-bubble {
  max-width: 70%;
}
.msg-row.mine .msg-content {
  background: #409eff;
  color: #fff;
  border-radius: 10px 2px 10px 10px;
}
.msg-content {
  background: #f4f4f5;
  color: #303133;
  padding: 8px 12px;
  border-radius: 2px 10px 10px 10px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-time {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 4px;
}
.msg-row.mine .msg-time {
  text-align: right;
}
.chat-input {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid #ebeef5;
  align-items: flex-end;
}
.chat-input .el-textarea {
  flex: 1;
}
</style>
