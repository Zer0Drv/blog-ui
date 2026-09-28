<template>
  <div class="admin-users">
    <el-card>
      <template #header>
        <div class="header">
          <span>用户管理</span>
          <div class="header-right">
            <el-select
              v-model="role"
              placeholder="全部角色"
              clearable
              style="width: 120px"
              @change="onFilter"
            >
              <el-option label="用户" value="USER" />
              <el-option label="作者" value="AUTHOR" />
              <el-option label="管理员" value="ADMIN" />
            </el-select>
            <el-select
              v-model="status"
              placeholder="全部状态"
              clearable
              style="width: 120px"
              @change="onFilter"
            >
              <el-option label="正常" value="0" />
              <el-option label="已封禁" value="1" />
            </el-select>
            <el-input
              v-model="keyword"
              placeholder="用户名 / 昵称 / 邮箱"
              clearable
              style="width: 220px"
              @keyup.enter="onFilter"
              @clear="onFilter"
            >
              <template #append>
                <el-button @click="onFilter">搜索</el-button>
              </template>
            </el-input>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" min-width="120" show-overflow-tooltip />
        <el-table-column prop="nickname" label="昵称" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.nickname || '-' }}</template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.email || '-' }}</template>
        </el-table-column>
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="roleType(row.role)" size="small">{{ roleText(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="Number(row.status) === 1 ? 'danger' : 'success'" size="small">
              {{ Number(row.status) === 1 ? '已封禁' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <template v-if="row.role !== 'ADMIN'">
              <el-button
                v-if="Number(row.status) !== 1"
                size="small"
                link
                type="danger"
                @click="onBan(row)"
              >封禁</el-button>
              <el-button
                v-else
                size="small"
                link
                type="success"
                @click="onUnban(row)"
              >解封</el-button>
              <el-select
                :model-value="row.role"
                size="small"
                style="width: 96px; margin-left: 8px"
                :loading="row._roleLoading"
                @change="val => onChangeRole(row, val)"
              >
                <el-option label="用户" value="USER" />
                <el-option label="作者" value="AUTHOR" />
              </el-select>
            </template>
            <el-tooltip v-else content="管理员账号不可操作" placement="left">
              <span class="admin-tip">-</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无用户" />
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[10, 20, 50]"
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
import { banUser, pageAdminUsers, unbanUser, updateUserRole } from '../../api/admin'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const keyword = ref('')
const role = ref('')
const status = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const data = await pageAdminUsers({
      page: page.value,
      size: size.value,
      keyword: keyword.value || undefined,
      role: role.value || undefined,
      status: status.value === '' ? undefined : status.value
    })
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

async function onBan(row) {
  try {
    await ElMessageBox.confirm(
      `确认封禁用户「${row.nickname || row.username}」？封禁后将无法登录。`,
      '警告',
      { type: 'warning', confirmButtonText: '封禁', cancelButtonText: '取消' }
    )
  } catch { return }
  try {
    await banUser(row.id)
    ElMessage.success('已封禁')
    load()
  } catch { /* 拦截器已提示 */ }
}

async function onUnban(row) {
  try {
    await ElMessageBox.confirm(`确认解封用户「${row.nickname || row.username}」？`, '提示', {
      type: 'info',
      confirmButtonText: '解封',
      cancelButtonText: '取消'
    })
  } catch { return }
  try {
    await unbanUser(row.id)
    ElMessage.success('已解封')
    load()
  } catch { /* 拦截器已提示 */ }
}

async function onChangeRole(row, val) {
  const action = val === 'AUTHOR' ? '设为作者' : '取消作者'
  try {
    await ElMessageBox.confirm(
      `确认将用户「${row.nickname || row.username}」${action}？`,
      '提示',
      { type: 'warning' }
    )
  } catch { return }
  row._roleLoading = true
  try {
    await updateUserRole(row.id, val)
    row.role = val
    ElMessage.success('角色已更新')
  } catch {
    load()
  } finally {
    row._roleLoading = false
  }
}

function roleText(r) {
  return { USER: '用户', AUTHOR: '作者', ADMIN: '管理员' }[r] || r
}

function roleType(r) {
  return { USER: 'info', AUTHOR: 'primary', ADMIN: 'danger' }[r] || 'info'
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
.header-right {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.admin-tip {
  color: #909399;
  margin-left: 8px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
