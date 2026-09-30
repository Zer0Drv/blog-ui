<template>
  <el-dialog
    :model-value="visible"
    title="选择附件"
    width="760px"
    @update:model-value="v => emit('update:visible', v)"
    @open="onOpen"
  >
    <el-tabs v-model="tab">
      <el-tab-pane label="从附件库选择" name="library">
        <div class="filter-bar">
          <el-select
            v-model="groupId"
            placeholder="全部分组"
            clearable
            style="width: 150px"
            @change="onFilter"
          >
            <el-option v-for="g in groups" :key="g.id" :label="`${g.name}（${g.count}）`" :value="g.id" />
          </el-select>
          <el-input
            v-model="keyword"
            placeholder="按文件名搜索"
            clearable
            style="width: 200px"
            @keyup.enter="onFilter"
            @clear="onFilter"
          />
          <el-button @click="onFilter">搜索</el-button>
        </div>
        <div v-loading="loading" class="grid">
          <el-card
            v-for="item in rows"
            :key="item.id"
            shadow="hover"
            class="grid-item"
            :body-style="{ padding: '8px' }"
            @click="onPick(item)"
          >
            <el-image :src="resolveUploadUrl(item.url)" fit="cover" lazy class="grid-img" />
            <div class="grid-name" :title="item.filename">{{ item.filename || item.url }}</div>
          </el-card>
          <el-empty v-if="!loading && !rows.length" description="暂无附件" class="grid-empty" />
        </div>
        <div class="pager">
          <el-pagination
            v-model:current-page="page"
            :page-size="24"
            :total="total"
            layout="prev, pager, next"
            background
            @current-change="loadAttachments"
          />
        </div>
      </el-tab-pane>
      <el-tab-pane label="上传新图" name="upload">
        <el-upload
          drag
          :show-file-list="false"
          accept="image/jpeg,image/png,image/gif,image/webp"
          :http-request="onUpload"
        >
          <div class="upload-tip">点击或拖拽图片到此处上传</div>
        </el-upload>
        <div v-if="uploading" class="uploading">上传中...</div>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { pageAttachmentGroups, pageAttachments } from '../api/attachment'
import { resolveUploadUrl, uploadImage } from '../api/upload'

const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible', 'select'])

const tab = ref('library')
const groups = ref([])
const rows = ref([])
const total = ref(0)
const page = ref(1)
const groupId = ref(null)
const keyword = ref('')
const loading = ref(false)
const uploading = ref(false)

function onOpen() {
  loadGroups()
  onFilter()
}

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

function onPick(item) {
  emit('select', item.url)
  emit('update:visible', false)
}

async function onUpload({ file }) {
  uploading.value = true
  try {
    const data = await uploadImage(file)
    ElMessage.success('上传成功')
    emit('select', data.url)
    emit('update:visible', false)
  } catch { /* 拦截器已提示 */ } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 120px;
}
.grid-item {
  width: 120px;
  cursor: pointer;
}
.grid-img {
  width: 104px;
  height: 72px;
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
.grid-empty {
  width: 100%;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.upload-tip {
  padding: 40px 0;
  color: #909399;
}
.uploading {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
