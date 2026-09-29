import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ElMessage } from 'element-plus'
import { notifyCommentResult } from '../comment-notify'

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

describe('notifyCommentResult（评论结果提示）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('message 为 success 时提示成功文案，返回可见', () => {
    const visible = notifyCommentResult({ code: '200', message: 'success' }, '评论成功')

    expect(ElMessage.success).toHaveBeenCalledWith('评论成功')
    expect(ElMessage.warning).not.toHaveBeenCalled()
    expect(visible).toBe(true)
  })

  it('命中敏感词（message 非 success）时按后端文案 warning，返回不可见', () => {
    const visible = notifyCommentResult({ code: '200', message: '内容命中敏感词，进入审核' }, '评论成功')

    expect(ElMessage.warning).toHaveBeenCalledWith('内容命中敏感词，进入审核')
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(visible).toBe(false)
  })

  it('res 为空或缺 message 时按成功处理', () => {
    expect(notifyCommentResult(null, '评论成功')).toBe(true)
    expect(notifyCommentResult({}, '回复成功')).toBe(true)
    expect(ElMessage.success).toHaveBeenCalledTimes(2)
    expect(ElMessage.warning).not.toHaveBeenCalled()
  })
})
