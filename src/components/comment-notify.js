import { ElMessage } from 'element-plus'

// createComment 返回完整 R 体：message 非 success 时（如命中敏感词进入审核）按后端提示 warning，
// 否则提示 successText。返回评论是否直接可见（审核中不可见，调用方不刷新列表/计数）。
export function notifyCommentResult(res, successText) {
  if (res?.message && res.message !== 'success') {
    ElMessage.warning(res.message)
    return false
  }
  ElMessage.success(successText)
  return true
}
