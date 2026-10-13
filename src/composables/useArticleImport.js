import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { importArticle } from '../api/article'

// 导入支持的扩展名：.md/.markdown/.txt/.html/.htm 单文件 + .zip 批量
export const IMPORT_ACCEPT_EXT = ['.md', '.markdown', '.txt', '.html', '.htm', '.zip']
export const IMPORT_ACCEPT = IMPORT_ACCEPT_EXT.join(',')

// 与后端 ArticleTransferService 对齐：单文件 ≤2MB，zip ≤5MB
const IMPORT_MAX_SIZE = 2 * 1024 * 1024
const IMPORT_ZIP_MAX_SIZE = 5 * 1024 * 1024

/**
 * 前端预校验（后端仍会再校验）：扩展名白名单 + 大小限制
 * @returns {{ok: boolean, message?: string}}
 */
export function validateImportFile(file) {
  const name = (file?.name || '').toLowerCase()
  if (!IMPORT_ACCEPT_EXT.some(ext => name.endsWith(ext))) {
    return { ok: false, message: '仅支持 .md/.markdown/.txt/.html/.htm/.zip 文件' }
  }
  const isZip = name.endsWith('.zip')
  const max = isZip ? IMPORT_ZIP_MAX_SIZE : IMPORT_MAX_SIZE
  if (file.size > max) {
    return { ok: false, message: isZip ? 'zip 文件大小不能超过 5MB' : '文件大小不能超过 2MB' }
  }
  return { ok: true }
}

/**
 * 文章导入共享逻辑（issue #16）：我的文章来源与编辑器页共用。
 * 单篇成功 → onImported(item)（一般由调用方跳新草稿编辑页）；
 * 批量（多篇成功或含失败明细）→ onBatchDone()（一般由调用方刷新列表）。
 * 失败明细限前 5 条拼进提示，避免 zip 大批量刷爆消息条。
 */
export function useArticleImport(options = {}) {
  const importing = ref(false)

  async function handleFile(file) {
    if (!file) return
    const v = validateImportFile(file)
    if (!v.ok) {
      ElMessage.error(v.message)
      return
    }
    importing.value = true
    try {
      const data = await importArticle(file)
      const imported = data?.imported || []
      const failed = data?.failed || []
      if (failed.length > 0) {
        const detail = failed.slice(0, 5).map(f => `${f.name}（${f.message}）`).join('；')
        ElMessage.warning(`导入完成：成功 ${imported.length} 篇，失败 ${failed.length} 篇。${detail}`)
        options.onBatchDone?.()
        return
      }
      if (imported.length === 1) {
        ElMessage.success('导入成功，已创建草稿')
        const warnings = imported[0].warnings || []
        if (warnings.length > 0) {
          ElMessage.warning(warnings.join('；'))
        }
        options.onImported?.(imported[0])
      } else if (imported.length > 1) {
        ElMessage.success(`导入成功，已创建 ${imported.length} 篇草稿`)
        options.onBatchDone?.()
      }
    } catch { /* 拦截器已提示 */ } finally {
      importing.value = false
    }
  }

  return { importing, handleFile }
}
