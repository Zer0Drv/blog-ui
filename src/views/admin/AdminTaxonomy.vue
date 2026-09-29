<template>
  <div>
    <el-tabs v-model="tab">
      <!-- 标签管理 -->
      <el-tab-pane label="标签" name="tags">
        <div class="toolbar">
          <el-input v-model="tagName" placeholder="新标签名称" class="name-input" clearable @keyup.enter="onAddTag" />
          <el-button type="primary" :disabled="!tagName.trim()" @click="onAddTag">新增标签</el-button>
        </div>
        <el-table :data="tags" v-loading="tagsLoading">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="名称" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="onRenameTag(row)">重命名</el-button>
              <el-button link type="danger" @click="onDeleteTag(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 分类管理 -->
      <el-tab-pane label="分类" name="categories">
        <div class="toolbar">
          <el-button type="primary" @click="openCategoryDialog()">新增分类</el-button>
        </div>
        <el-table :data="categories" v-loading="categoriesLoading" row-key="id" default-expand-all>
          <el-table-column prop="name" label="名称" min-width="200" />
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="sort" label="排序" width="80" />
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openCategoryDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="onDeleteCategory(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 分类编辑弹窗 -->
    <el-dialog v-model="categoryDialog.visible" :title="categoryDialog.id ? '编辑分类' : '新增分类'" width="420px">
      <el-form label-position="top">
        <el-form-item label="名称">
          <el-input v-model="categoryDialog.name" maxlength="32" />
        </el-form-item>
        <el-form-item label="父分类（可选）">
          <el-select v-model="categoryDialog.parentId" clearable placeholder="顶级分类" class="full">
            <el-option
              v-for="c in flatCategories.filter(c => c.id !== categoryDialog.id)"
              :key="c.id"
              :label="c.label"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序（越小越靠前）">
          <el-input-number v-model="categoryDialog.sort" :min="0" :max="9999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="categoryDialog.saving" @click="onSaveCategory">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listTags, createTag, updateTag, deleteTag } from '../../api/tag'
import { listCategories, createCategory, updateCategory, deleteCategory } from '../../api/category'

const tab = ref('tags')

/* ---------- 标签 ---------- */
const tags = ref([])
const tagsLoading = ref(false)
const tagName = ref('')

async function loadTags() {
  tagsLoading.value = true
  try {
    tags.value = await listTags() || []
  } catch { /* 拦截器已提示 */ } finally {
    tagsLoading.value = false
  }
}

async function onAddTag() {
  const name = tagName.value.trim()
  if (!name) return
  try {
    await createTag(name)
    ElMessage.success('已创建')
    tagName.value = ''
    loadTags()
  } catch { /* 拦截器已提示 */ }
}

async function onRenameTag(row) {
  try {
    const { value } = await ElMessageBox.prompt('新的标签名称', '重命名', {
      inputValue: row.name,
      inputValidator: v => (v && v.trim()) ? true : '名称不能为空'
    })
    await updateTag(row.id, value.trim())
    ElMessage.success('已更新')
    loadTags()
  } catch { /* 取消或失败（拦截器已提示） */ }
}

async function onDeleteTag(row) {
  try {
    await ElMessageBox.confirm(`确定删除标签「${row.name}」？文章上的关联会被移除。`, '删除确认', { type: 'warning' })
    await deleteTag(row.id)
    ElMessage.success('已删除')
    loadTags()
  } catch { /* 取消或失败 */ }
}

/* ---------- 分类 ---------- */
const categories = ref([])
const categoriesLoading = ref(false)
const categoryDialog = ref({ visible: false, id: null, name: '', parentId: null, sort: 0, saving: false })

// 树形 categories 拍平为下拉选项（带缩进示意层级）
const flatCategories = computed(() => {
  const out = []
  const walk = (nodes, depth) => {
    for (const n of nodes || []) {
      out.push({ id: n.id, label: `${'　'.repeat(depth)}${n.name}` })
      walk(n.children, depth + 1)
    }
  }
  walk(categories.value, 0)
  return out
})

async function loadCategories() {
  categoriesLoading.value = true
  try {
    categories.value = await listCategories() || []
  } catch { /* 拦截器已提示 */ } finally {
    categoriesLoading.value = false
  }
}

function openCategoryDialog(row) {
  categoryDialog.value = row
    ? { visible: true, id: row.id, name: row.name, parentId: row.parentId || null, sort: row.sort || 0, saving: false }
    : { visible: true, id: null, name: '', parentId: null, sort: 0, saving: false }
}

async function onSaveCategory() {
  const d = categoryDialog.value
  if (!d.name.trim()) {
    ElMessage.warning('名称不能为空')
    return
  }
  d.saving = true
  try {
    const body = { name: d.name.trim(), parentId: d.parentId, sort: d.sort }
    if (d.id) {
      await updateCategory(d.id, body)
    } else {
      await createCategory(body)
    }
    ElMessage.success('已保存')
    d.visible = false
    loadCategories()
  } catch { /* 拦截器已提示 */ } finally {
    d.saving = false
  }
}

async function onDeleteCategory(row) {
  try {
    await ElMessageBox.confirm(`确定删除分类「${row.name}」？`, '删除确认', { type: 'warning' })
    await deleteCategory(row.id)
    ElMessage.success('已删除')
    loadCategories()
  } catch { /* 取消或失败 */ }
}

onMounted(() => {
  loadTags()
  loadCategories()
})
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.name-input {
  max-width: 240px;
}
.full {
  width: 100%;
}
</style>
