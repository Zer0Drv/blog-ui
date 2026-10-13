import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ElMessage } from 'element-plus'
import { importArticle } from '../../api/article'
import { IMPORT_ACCEPT, validateImportFile, useArticleImport } from '../useArticleImport'

// composable 无生命周期依赖，直接调用即可；api 层 mock 顶替
vi.mock('../../api/article', () => ({ importArticle: vi.fn() }))

const item = (id, warnings = []) => ({ id, title: `草稿${id}`, warnings, externalImages: [] })

describe('validateImportFile 前端预校验', () => {
  it('扩展名白名单：md/markdown/txt/html/htm/zip 放行，其余拒绝', () => {
    for (const name of ['a.md', 'a.markdown', 'a.txt', 'a.html', 'a.htm', 'a.zip', 'A.MD', 'A.ZIP']) {
      expect(validateImportFile(new File(['x'], name)).ok, name).toBe(true)
    }
    for (const name of ['a.pdf', 'a.exe', 'a', 'a.md.zipx']) {
      const v = validateImportFile(new File(['x'], name))
      expect(v.ok, name).toBe(false)
      expect(v.message).toBe('仅支持 .md/.markdown/.txt/.html/.htm/.zip 文件')
    }
  })

  it('大小限制：单文件 ≤2MB，zip ≤5MB', () => {
    const md = new File(['x'], 'a.md')
    Object.defineProperty(md, 'size', { value: 2 * 1024 * 1024 + 1 })
    expect(validateImportFile(md).message).toBe('文件大小不能超过 2MB')

    const zip = new File(['x'], 'a.zip')
    Object.defineProperty(zip, 'size', { value: 5 * 1024 * 1024 + 1 })
    expect(validateImportFile(zip).message).toBe('zip 文件大小不能超过 5MB')

    const zipOk = new File(['x'], 'a.zip')
    Object.defineProperty(zipOk, 'size', { value: 3 * 1024 * 1024 })
    expect(validateImportFile(zipOk).ok).toBe(true)
  })

  it('IMPORT_ACCEPT 供 file input 的 accept 属性直接使用', () => {
    expect(IMPORT_ACCEPT).toBe('.md,.markdown,.txt,.html,.htm,.zip')
  })
})

describe('useArticleImport 结果分发', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'warning').mockImplementation(() => {})
  })

  it('非法文件：错误提示且不发起请求', async () => {
    const { handleFile } = useArticleImport()
    await handleFile(new File(['x'], 'a.pdf'))
    expect(ElMessage.error).toHaveBeenCalledWith('仅支持 .md/.markdown/.txt/.html/.htm/.zip 文件')
    expect(importArticle).not.toHaveBeenCalled()
  })

  it('空文件入参直接忽略', async () => {
    const { handleFile } = useArticleImport()
    await handleFile(null)
    expect(importArticle).not.toHaveBeenCalled()
  })

  it('单篇成功：成功提示 + 警告透传 + onImported 回调', async () => {
    importArticle.mockResolvedValue({ imported: [item(7, ['w1', 'w2'])], failed: [] })
    const onImported = vi.fn()
    const onBatchDone = vi.fn()
    const { handleFile } = useArticleImport({ onImported, onBatchDone })

    await handleFile(new File(['# hi'], 'a.md'))

    expect(ElMessage.success).toHaveBeenCalledWith('导入成功，已创建草稿')
    expect(ElMessage.warning).toHaveBeenCalledWith('w1；w2')
    expect(onImported).toHaveBeenCalledWith(item(7, ['w1', 'w2']))
    expect(onBatchDone).not.toHaveBeenCalled()
  })

  it('多篇成功：汇总提示 + onBatchDone 回调', async () => {
    importArticle.mockResolvedValue({ imported: [item(1), item(2), item(3)], failed: [] })
    const onImported = vi.fn()
    const onBatchDone = vi.fn()
    const { handleFile } = useArticleImport({ onImported, onBatchDone })

    await handleFile(new File(['PK'], 'a.zip'))

    expect(ElMessage.success).toHaveBeenCalledWith('导入成功，已创建 3 篇草稿')
    expect(onBatchDone).toHaveBeenCalledTimes(1)
    expect(onImported).not.toHaveBeenCalled()
  })

  it('含失败明细：警告提示前 5 条 + onBatchDone 回调', async () => {
    const failed = Array.from({ length: 7 }, (_, i) => ({ name: `f${i}.md`, message: '坏' }))
    importArticle.mockResolvedValue({ imported: [item(1)], failed })
    const onBatchDone = vi.fn()
    const { handleFile } = useArticleImport({ onBatchDone })

    await handleFile(new File(['PK'], 'a.zip'))

    const message = ElMessage.warning.mock.calls[0][0]
    expect(message).toContain('导入完成：成功 1 篇，失败 7 篇')
    // 只拼前 5 条失败明细
    expect(message).toContain('f4.md')
    expect(message).not.toContain('f5.md')
    expect(onBatchDone).toHaveBeenCalledTimes(1)
  })

  it('接口异常（拦截器已提示）：静默收尾，importing 复位', async () => {
    importArticle.mockRejectedValue(new Error('网络错误'))
    const onImported = vi.fn()
    const { handleFile, importing } = useArticleImport({ onImported })

    await handleFile(new File(['# hi'], 'a.md'))

    expect(onImported).not.toHaveBeenCalled()
    expect(importing.value).toBe(false)
  })
})
