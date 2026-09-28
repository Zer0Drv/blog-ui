<template>
  <div class="admin-sensitive-words">
    <el-card>
      <template #header>
        <div class="header">
          <span>敏感词库</span>
          <div class="header-right">
            <el-input
              v-model="newWord"
              placeholder="输入新敏感词，回车添加"
              clearable
              maxlength="64"
              style="width: 260px"
              @keyup.enter="onAdd"
            >
              <template #append>
                <el-button :loading="adding" @click="onAdd">新增</el-button>
              </template>
            </el-input>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column prop="word" label="敏感词" min-width="200" show-overflow-tooltip />
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无敏感词" />
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[50, 100, 200]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="load"
          @size-change="onFilter"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { addSensitiveWord, deleteSensitiveWord, pageSensitiveWords } from '../../api/admin'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(50)
const loading = ref(false)
const newWord = ref('')
const adding = ref(false)

async function load() {
  loading.value = true
  try {
    const data = await pageSensitiveWords({ page: page.value, size: size.value })
    rows.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

function onFilter() {
  page.value = 1
  load()
}

async function onAdd() {
  const word = newWord.value.trim()
  if (!word) {
    ElMessage.warning('请输入敏感词')
    return
  }
  adding.value = true
  try {
    await addSensitiveWord(word)
    ElMessage.success('已添加')
    newWord.value = ''
    page.value = 1
    load()
  } catch { /* 拦截器已提示 */ } finally {
    adding.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除敏感词「${row.word}」？`, '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch { return }
  try {
    await deleteSensitiveWord(row.id)
    ElMessage.success('已删除')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    load()
  } catch { /* 拦截器已提示 */ }
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

onMounted(load)
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
