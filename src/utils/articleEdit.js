// 编辑器页纯逻辑下沉：不依赖 Vue / Element Plus，全部可直测。
// 每个函数都有 ArticleEditView.vue 的真实出处，迁移时保持行为完全等价。

// 新文章（无 id）自动保存的 localStorage 轨道 key
export const DRAFT_NEW_KEY = 'draft:new'
// 自动保存延迟：30s 防抖计时
export const AUTOSAVE_DELAY = 30 * 1000
// 定时发布最小提前量：现状 5 分钟
export const PUBLISH_LEAD_MS = 5 * 60 * 1000

function pad2(n) {
  return String(n).padStart(2, '0')
}

// 去 HTML 标签（不 trim，是否去空白由调用方决定）
export function stripHtml(s) {
  return String(s ?? '').replace(/<[^>]+>/g, '')
}

// 本地时间 yyyy-MM-ddTHH:mm:ss（后端 Jackson 默认 ISO 格式）
export function formatLocalDateTime(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

// 时间戳（ms，字符串数字亦可）→ HH:mm
export function formatClock(t) {
  const d = new Date(Number(t))
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// 完整草稿字段，允许临时空标题/正文。明文口令仅在远程保存时单独添加，不能进入本地草稿。
export function buildAutosaveBody(form, content) {
  return {
    title: form.title.trim(),
    content,
    summary: form.summary,
    slug: form.slug || '',
    cover: form.cover,
    categoryId: form.categoryId || null,
    tagIds: [...(form.tagIds || [])],
    editorType: form.editorType || 'MARKDOWN',
    ...(form.visibility ? { visibility: form.visibility } : {})
  }
}

// 保存/发布前校验：不发 ElMessage，由调用方按 message 提示
export function validateArticle(form, content) {
  if (!form.title.trim()) return { ok: false, message: '请填写标题' }
  if (!stripHtml(content).trim()) return { ok: false, message: '正文不能为空' }
  // slug 固定链接（Zer0Drv/blog#14）：留空合法（后端自动生成/保持现状），
  // 非空先按格式拦截一轮，唯一性冲突由后端业务码提示
  const slug = (form.slug || '').trim()
  if (slug && !SLUG_PATTERN.test(slug)) {
    return { ok: false, message: 'slug 仅允许小写字母、数字与连字符（如 my-first-post）' }
  }
  if (form.visibility === 'PASSWORD') {
    const password = form.accessPassword || ''
    if (!password && !form.hasAccessPassword) return { ok: false, message: '请设置访问口令' }
    if (password && (password.length < 4 || password.length > 64 || new TextEncoder().encode(password).length > 72)) {
      return { ok: false, message: '访问口令需为 4~64 个字符，且 UTF-8 编码不超过 72 字节' }
    }
  }
  return { ok: true }
}

// 模式切换是否需确认：看「切出方」编辑器是否有内容。
// Markdown 侧只 trim 文本；富文本侧去标签后再 trim（<p><br></p> 视为空）。
export function needsSwitchConfirm(prevType, md, html) {
  if (prevType === 'MARKDOWN') return Boolean(String(md ?? '').trim())
  return Boolean(stripHtml(html).trim())
}

// 服务端草稿恢复冲突「谁新」判定：savedAt(ms) 严格晚于文章 updateTime 才提示恢复。
// updateTime 容忍后端 'yyyy-MM-dd HH:mm:ss' 空格格式（转 T 按本地时间解析），缺失按 0。
export function shouldOfferServerDraft(draft, articleUpdateTime) {
  if (!draft?.exists) return false
  const articleTime = articleUpdateTime
    ? new Date(String(articleUpdateTime).replace(' ', 'T')).getTime()
    : 0
  return Number(draft.savedAt) > articleTime
}

// 解析 localStorage 草稿：缺失 / JSON 损坏 / 非对象一律返回 null（调用方直接忽略）
export function parseLocalDraft(raw) {
  if (!raw) return null
  try {
    const draft = JSON.parse(raw)
    return draft && typeof draft === 'object' ? draft : null
  } catch {
    return null
  }
}

// 定时发布时间校验：须严格晚于 now + leadMs（恰等于 lead 边界拒绝，与现状 `<=` 一致）
export function validatePublishTime(time, now = Date.now(), leadMs = PUBLISH_LEAD_MS) {
  if (!time) return { ok: false, message: '请选择定时发布时间' }
  const t = time instanceof Date ? time.getTime() : new Date(time).getTime()
  if (Number.isNaN(t) || t <= now + leadMs) {
    return { ok: false, message: '定时发布时间需晚于当前时间至少 5 分钟' }
  }
  return { ok: true }
}

// 编辑权限预检：ADMIN 或本人文章（后端保存时也会拒绝，这里提前拦截避免加载完整内容）
export function canEditArticle(user, article) {
  return ['ADMIN', 'SUPER_ADMIN'].includes(user?.role) || String(article?.author?.id) === String(user?.id)
}

// 草稿（服务端 autosave / localStorage）→ 表单补丁：只含草稿里存在的字段；
// categoryId 空值归一为 null（现状 `!== undefined` 判断 + `|| null`）。
// content 不区分编辑器类型，由调用方按当前 editorType 落到 md/html 槽位。
export function draftToFormPatch(draft) {
  const patch = {}
  if (draft.title != null) patch.title = draft.title
  if (draft.summary != null) patch.summary = draft.summary
  if (draft.cover != null) patch.cover = draft.cover
  if (draft.slug != null) patch.slug = draft.slug
  if (Array.isArray(draft.tagIds)) patch.tagIds = [...draft.tagIds]
  if (['MARKDOWN', 'RICHTEXT'].includes(draft.editorType)) patch.editorType = draft.editorType
  if (['PUBLIC', 'PASSWORD', 'PRIVATE'].includes(draft.visibility)) patch.visibility = draft.visibility
  if (draft.categoryId !== undefined) patch.categoryId = draft.categoryId || null
  if (draft.content != null) patch.content = draft.content
  return patch
}

// slug 固定链接格式（与后端 ArticleSlugger 口径一致：小写字母/数字段 + 段间单连字符）
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

// 文章 → 表单状态。editorType 缺省兜底 'MARKDOWN'；
// 正文槽位沿用现状对原始值 a.editorType 的判断（仅严格等于 'MARKDOWN' 进 md 槽，
// 其余——包括 editorType 缺失——进 html 槽），未命中的槽位为 null 表示不动。
export function articleToFormState(a) {
  const toMd = a.editorType === 'MARKDOWN'
  return {
    title: a.title || '',
    summary: a.summary || '',
    slug: a.slug || '',
    cover: a.cover || '',
    categoryId: a.categoryId || null,
    tagIds: (a.tags || []).map(t => t.id),
    editorType: a.editorType || 'MARKDOWN',
    visibility: a.visibility || 'PUBLIC',
    hasAccessPassword: a.passwordConfigured ?? a.hasAccessPassword ?? a.visibility === 'PASSWORD',
    accessPassword: '',
    mdContent: toMd ? a.content || '' : null,
    htmlContent: toMd ? null : a.content || ''
  }
}
