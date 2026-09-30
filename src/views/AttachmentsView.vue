<template>
  <div class="attachments-page">
    <el-card>
      <template #header>
        <div class="header">
          <span>附件库</span>
          <div class="header-right">
            <el-input
              v-model="keyword"
              placeholder="按文件名搜索"
              clearable
              style="width: 200px"
              @keyup.enter="onFilter"
              @clear="onFilter"
            />
            <el-button @click="onFilter">搜索</el-button>
            <el-upload
              :show-file-list="false"
              accept="image/jpeg,image/png,image/gif,image/webp"
              :http-request="onUpload"
            >
              <el-button type="primary" :loading="uploading">上传图片</el-button>
            </el-upload>
          </div>
        </div>
      </template>

      <div class="body">
        <!-- 分组侧栏 -->
        <aside class="groups">
          <div class="group-head">
            <span>分组</span>
            <el-button size="small" link type="primary" @click="onCreateGroup">新建</el-button>
          </div>
          <div
            class="group-item"
            :class="{ active: groupId === null }"
            @click="onPickGroup(null)"
          >全部</div>
          <div
            v-for="g in groups"
            :key="g.id"
            class="group-item"
            :class="{ active: groupId === g.id }"
            @click="onPickGroup(g.id)"
          >
            <span class="group-name" :title="g.name">{{ g.name }}</span>
            <span class="group-count">{{ g.count }}</span>
            <el-dropdown trigger="click" @command="cmd => onGroupCommand(cmd, g)">
              <el-icon class="group-more" @click.stop><MoreFilled /></el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">重命名</el-dropdown-item>
                  <el-dropdown-item command="delete">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <el-empty v-if="!groups.length" description="暂无分组" :image-size="60" />
        </aside>

        <!-- 图片网格 -->
        <div v-loading="loading" class="grid-wrap">
          <div class="grid">
            <el-card
              v-for="item in rows"
              :key="item.id"
              shadow="hover"
              class="grid-item"
              :body-style="{ padding: '8px' }"
            >
              <el-image
                :src="resolveUploadUrl(item.url)"
                fit="cover"
                lazy
                class="grid-img"
                :preview-src-list="[resolveUploadUrl(item.url)]"
                preview-teleported
              />
              <div class="grid-name" :title="item.filename">{{ item.filename || item.url }}</div>
              <div class="grid-ops">
                <el-dropdown trigger="click" @command="gid => onMove(item, gid)">
                  <el-button size="small" link type="primary">移入分组</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :command="null">未分组</el-dropdown-item>
                      <el-dropdown-item v-for="g in groups" :key="g.id" :command="g.id">
                        {{ g.name }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-button size="small" link type="primary" @click="onCopy(item)">复制链接</el-button>
                <el-button size="small" link type="danger" @click="onDelete(item)">删除</el-button>
              </div>
            </el-card>
          </div>
          <el-empty v-if="!loading && !rows.length" description="暂无附件，点击右上角上传" />

          <div class="pager">
            <el-pagination
              v-model:current-page="page"
              :page-size="24"
              :total="total"
              layout="total, prev, pager, next"
              background
              @current-change="loadAttachments"
            />
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled } from '@element-plus/icons-vue'
import {
  createAttachmentGroup,
  deleteAttachment,
  deleteAttachmentGroup,
  moveAttachment,
  pageAttachmentGroups,
  pageAttachments,
  renameAttachmentGroup
} from '../api/attachment'
import { resolveUploadUrl, uploadImage } from '../api/upload'

const groups = ref([])
const rows = ref([])
const total = ref(0)
const page = ref(1)
const groupId = ref(null)
const keyword = ref('')
const loading = ref(false)
const uploading = ref(false)

async function loadGroups() {
  try {
    groups.value = await pageAttachmentGroups() || []
  } catch { /* 拦截器已提示 */ }
}

async function loadAttachments() {
  loading.value = true
  try {
    const data = await pageAttachments({
      page: page.value,
      size: 24,
      groupId: groupId.value || undefined,
      keyword: keyword.value.trim() || undefined
    })
    rows.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

function onFilter() {
  page.value = 1
  loadAttachments()
}

function onPickGroup(id) {
  groupId.value = id
  onFilter()
}

/* ---------- 分组管理 ---------- */
async function onCreateGroup() {
  let name
  try {
    const res = await ElMessageBox.prompt('请输入分组名', '新建分组', {
      inputPattern: /\S+/,
      inputErrorMessage: '分组名不能为空',
      inputValidator: v => (v && v.trim().length <= 64) || '分组名不能超过 64 字'
    })
    name = res.value.trim()
  } catch { return }
  try {
    await createAttachmentGroup(name)
    ElMessage.success('分组已创建')
    loadGroups()
  } catch { /* 拦截器已提示 */ }
}

async function onGroupCommand(cmd, g) {
  if (cmd === 'rename') {
    let name
    try {
      const res = await ElMessageBox.prompt('请输入新的分组名', '重命名分组', {
        inputValue: g.name,
        inputPattern: /\S+/,
        inputErrorMessage: '分组名不能为空'
      })
      name = res.value.trim()
    } catch { return }
    try {
      await renameAttachmentGroup(g.id, name)
      ElMessage.success('已重命名')
      loadGroups()
    } catch { /* 拦截器已提示 */ }
  } else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(`确认删除分组「${g.name}」？组内仍有附件时无法删除。`, '警告', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
    } catch { return }
    try {
      await deleteAttachmentGroup(g.id)
      ElMessage.success('分组已删除')
      if (groupId.value === g.id) groupId.value = null
      loadGroups()
      loadAttachments()
    } catch { /* 拦截器已提示（40071 分组内仍有附件） */ }
  }
}

/* ---------- 附件操作 ---------- */
async function onUpload({ file }) {
  uploading.value = true
  try {
    await uploadImage(file)
    ElMessage.success('上传成功')
    onFilter()
    loadGroups()
  } catch { /* 拦截器已提示 */ } finally {
    uploading.value = false
  }
}

async function onMove(item, gid) {
  try {
    await moveAttachment(item.id, gid)
    ElMessage.success('已移动')
    loadAttachments()
    loadGroups()
  } catch { /* 拦截器已提示 */ }
}

async function onCopy(item) {
  const full = resolveUploadUrl(item.url)
  try {
    await navigator.clipboard.writeText(full)
    ElMessage.success('链接已复制')
  } catch {
    // 剪贴板不可用时兜底（非 https 等场景）
    ElMessage.warning('复制失败，请手动复制：' + full)
  }
}

async function onDelete(item) {
  try {
    await ElMessageBox.confirm('确认删除该附件？删除后不可恢复（不会删除已上传的文件）。', '警告', {
      type: 'error',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch { return }
  try {
    await deleteAttachment(item.id)
    ElMessage.success('已删除')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    loadAttachments()
    loadGroups()
  } catch { /* 拦截器已提示 */ }
}

onMounted(() => {
  loadGroups()
  loadAttachments()
})
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-right {
  display: flex;
  gap: 10px;
  align-items: center;
}
.body {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.groups {
  width: 180px;
  flex-shrink: 0;
  border-right: 1px solid #e4e7ed;
  padding-right: 16px;
}
.group-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #909399;
  font-size: 13px;
  margin-bottom: 6px;
}
.group-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.group-item:hover {
  background: #f5f7fa;
}
.group-item.active {
  background: #ecf5ff;
  color: #409eff;
}
.group-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.group-count {
  color: #909399;
  font-size: 12px;
}
.group-more {
  visibility: hidden;
}
.group-item:hover .group-more {
  visibility: visible;
}
.grid-wrap {
  flex: 1;
  min-width: 0;
}
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.grid-item {
  width: 170px;
}
.grid-img {
  width: 154px;
  height: 100px;
  border-radius: 4px;
  display: block;
}
.grid-name {
  margin-top: 6px;
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.grid-ops {
  margin-top: 4px;
  display: flex;
  gap: 4px;
  align-items: center;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
