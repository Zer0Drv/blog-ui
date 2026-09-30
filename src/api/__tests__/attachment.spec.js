import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock http 实例，断言请求路径与参数
const http = {
  get: vi.fn(() => Promise.resolve()),
  post: vi.fn(() => Promise.resolve()),
  put: vi.fn(() => Promise.resolve()),
  delete: vi.fn(() => Promise.resolve())
}

vi.mock('../http', () => ({ default: http }))

const {
  pageAttachments,
  pageAttachmentGroups,
  createAttachmentGroup,
  renameAttachmentGroup,
  deleteAttachmentGroup,
  moveAttachment,
  deleteAttachment
} = await import('../attachment')

describe('attachment api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pageAttachments 带分页/分组/关键字参数', async () => {
    await pageAttachments({ page: 1, size: 24, groupId: 3, keyword: 'logo' })
    expect(http.get).toHaveBeenCalledWith('/attachments', {
      params: { page: 1, size: 24, groupId: 3, keyword: 'logo' }
    })
  })

  it('pageAttachmentGroups 请求分组列表', async () => {
    await pageAttachmentGroups()
    expect(http.get).toHaveBeenCalledWith('/attachments/groups')
  })

  it('createAttachmentGroup 提交分组名', async () => {
    await createAttachmentGroup('封面图')
    expect(http.post).toHaveBeenCalledWith('/attachments/groups', { name: '封面图' })
  })

  it('renameAttachmentGroup 更新分组名', async () => {
    await renameAttachmentGroup(7, '新名字')
    expect(http.put).toHaveBeenCalledWith('/attachments/groups/7', { name: '新名字' })
  })

  it('deleteAttachmentGroup 按 id 删除', async () => {
    await deleteAttachmentGroup(7)
    expect(http.delete).toHaveBeenCalledWith('/attachments/groups/7')
  })

  it('moveAttachment 移入分组', async () => {
    await moveAttachment(9, 3)
    expect(http.put).toHaveBeenCalledWith('/attachments/9', { groupId: 3 })
  })

  it('moveAttachment 传 null 移出分组', async () => {
    await moveAttachment(9, null)
    expect(http.put).toHaveBeenCalledWith('/attachments/9', { groupId: null })
  })

  it('deleteAttachment 逻辑删除附件', async () => {
    await deleteAttachment(9)
    expect(http.delete).toHaveBeenCalledWith('/attachments/9')
  })
})
