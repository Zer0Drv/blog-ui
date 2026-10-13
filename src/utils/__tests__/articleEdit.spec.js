import { describe, it, expect } from 'vitest'
import {
  stripHtml,
  formatLocalDateTime,
  formatClock,
  buildAutosaveBody,
  validateArticle,
  needsSwitchConfirm,
  shouldOfferServerDraft,
  parseLocalDraft,
  validatePublishTime,
  canEditArticle,
  draftToFormPatch,
  articleToFormState,
  PUBLISH_LEAD_MS
} from '../articleEdit'

describe('stripHtml', () => {
  it('去除标签保留文本', () => {
    expect(stripHtml('<p>你好<b>世界</b></p>')).toBe('你好世界')
  })

  it('纯标签内容去后为空串', () => {
    expect(stripHtml('<p><br></p>')).toBe('')
  })

  it('非字符串输入兜底为空串', () => {
    expect(stripHtml(null)).toBe('')
    expect(stripHtml(undefined)).toBe('')
  })
})

describe('formatLocalDateTime', () => {
  it('输出 yyyy-MM-ddTHH:mm:ss 且单位数补零', () => {
    const d = new Date(2026, 0, 5, 9, 7, 3)
    expect(formatLocalDateTime(d)).toBe('2026-01-05T09:07:03')
  })
})

describe('formatClock', () => {
  it('时间戳 → HH:mm', () => {
    const t = new Date(2026, 5, 15, 9, 5).getTime()
    expect(formatClock(t)).toBe('09:05')
  })

  it('接受字符串数字', () => {
    const t = String(new Date(2026, 5, 15, 23, 45).getTime())
    expect(formatClock(t)).toBe('23:45')
  })
})

describe('buildAutosaveBody', () => {
  it('草稿保留可见性选择并排除明文口令', () => {
    const body = buildAutosaveBody({ title: 't', visibility: 'PRIVATE', accessPassword: 'secret' }, '正文')
    expect(body.visibility).toBe('PRIVATE')
    expect(body).not.toHaveProperty('accessPassword')
    expect(draftToFormPatch(body).visibility).toBe('PRIVATE')
  })
  const form = {
    title: '  标题  ',
    summary: '摘要',
    cover: '/files/cover.png',
    categoryId: 3
  }

  it('正文纯文本为空返回 null（空串 / 纯空白 / 纯标签）', () => {
    expect(buildAutosaveBody(form, '')).toBeNull()
    expect(buildAutosaveBody(form, '   \n  ')).toBeNull()
    expect(buildAutosaveBody(form, '<p><br></p>')).toBeNull()
  })

  it('标题 trim、正文保留原文、categoryId 空值归一 null', () => {
    const body = buildAutosaveBody(form, '正文内容')
    expect(body).toEqual({
      title: '标题',
      content: '正文内容',
      summary: '摘要',
      cover: '/files/cover.png',
      categoryId: 3
    })
    expect(buildAutosaveBody({ ...form, categoryId: undefined }, 'x').categoryId).toBeNull()
    expect(buildAutosaveBody({ ...form, categoryId: 0 }, 'x').categoryId).toBeNull()
  })
})

describe('validateArticle', () => {
  it('标题为空 → not ok + 提示语', () => {
    expect(validateArticle({ title: '  ' }, '正文')).toEqual({ ok: false, message: '请填写标题' })
  })

  it('正文为空（含纯标签） → not ok + 提示语', () => {
    expect(validateArticle({ title: 't' }, '')).toEqual({ ok: false, message: '正文不能为空' })
    expect(validateArticle({ title: 't' }, '<p><br></p>')).toEqual({ ok: false, message: '正文不能为空' })
  })

  it('标题正文齐全 → ok', () => {
    expect(validateArticle({ title: 't' }, '正文')).toEqual({ ok: true })
  })

  it('slug 固定链接：留空合法，非法格式拦截，合法放行', () => {
    // 留空 / 空白 → 后端自动生成或保持现状
    expect(validateArticle({ title: 't' }, '正文')).toEqual({ ok: true })
    expect(validateArticle({ title: 't', slug: '' }, '正文')).toEqual({ ok: true })
    expect(validateArticle({ title: 't', slug: '  ' }, '正文')).toEqual({ ok: true })
    // 合法形态
    expect(validateArticle({ title: 't', slug: 'my-first-post' }, '正文')).toEqual({ ok: true })
    expect(validateArticle({ title: 't', slug: 'post-42' }, '正文')).toEqual({ ok: true })
    // 非法形态：大写 / 下划线 / 首尾连字符 / 中文
    for (const slug of ['Hello', 'my_post', '-lead', 'trail-', '中文slug', 'a--b']) {
      const r = validateArticle({ title: 't', slug }, '正文')
      expect(r.ok).toBe(false)
      expect(r.message).toContain('slug')
    }
  })
})

describe('needsSwitchConfirm 四象限', () => {
  it('Markdown 有内容 → 需确认', () => {
    expect(needsSwitchConfirm('MARKDOWN', '# 标题', '')).toBe(true)
  })

  it('Markdown 仅空白 → 直接切换', () => {
    expect(needsSwitchConfirm('MARKDOWN', '  \n ', '<p>x</p>')).toBe(false)
  })

  it('富文本有纯文本内容 → 需确认', () => {
    expect(needsSwitchConfirm('RICHTEXT', '', '<p>hi</p>')).toBe(true)
  })

  it('富文本仅空标签 → 直接切换', () => {
    expect(needsSwitchConfirm('RICHTEXT', 'md 内容不影响', '<p><br></p>')).toBe(false)
  })
})

describe('shouldOfferServerDraft 谁新判定矩阵', () => {
  const updateTime = '2026-05-15 10:00:00'
  const articleMs = new Date(2026, 4, 15, 10, 0, 0).getTime()

  it('savedAt 晚于 updateTime → 提示恢复', () => {
    expect(shouldOfferServerDraft({ exists: true, savedAt: articleMs + 1000 }, updateTime)).toBe(true)
  })

  it('savedAt 早于 updateTime → 不提示', () => {
    expect(shouldOfferServerDraft({ exists: true, savedAt: articleMs - 1000 }, updateTime)).toBe(false)
  })

  it('savedAt 恰等于 updateTime → 不提示（严格大于）', () => {
    expect(shouldOfferServerDraft({ exists: true, savedAt: articleMs }, updateTime)).toBe(false)
  })

  it('草稿缺失 / exists=false → 不提示', () => {
    expect(shouldOfferServerDraft(null, updateTime)).toBe(false)
    expect(shouldOfferServerDraft(undefined, updateTime)).toBe(false)
    expect(shouldOfferServerDraft({ exists: false, savedAt: articleMs + 99999 }, updateTime)).toBe(false)
  })

  it('updateTime 为空按 0 处理：任何正 savedAt 都提示', () => {
    expect(shouldOfferServerDraft({ exists: true, savedAt: 1 }, undefined)).toBe(true)
    expect(shouldOfferServerDraft({ exists: true, savedAt: 1 }, '')).toBe(true)
  })

  it('空格格式日期按本地时间解析', () => {
    // 与 updateTime 同一时刻的 T 格式 savedAt → 不新；晚 1ms → 新
    expect(shouldOfferServerDraft({ exists: true, savedAt: articleMs }, '2026-05-15T10:00:00')).toBe(false)
    expect(shouldOfferServerDraft({ exists: true, savedAt: articleMs + 1 }, '2026-05-15 10:00:00')).toBe(true)
  })
})

describe('parseLocalDraft', () => {
  it('缺失 → null', () => {
    expect(parseLocalDraft(null)).toBeNull()
    expect(parseLocalDraft('')).toBeNull()
  })

  it('JSON 损坏 → null', () => {
    expect(parseLocalDraft('{broken')).toBeNull()
  })

  it('非对象 JSON → null', () => {
    expect(parseLocalDraft('123')).toBeNull()
    expect(parseLocalDraft('null')).toBeNull()
    expect(parseLocalDraft('"str"')).toBeNull()
  })

  it('合法草稿对象原样返回', () => {
    const draft = { title: 't', content: 'c', savedAt: 123 }
    expect(parseLocalDraft(JSON.stringify(draft))).toEqual(draft)
  })
})

describe('validatePublishTime（lead 现状 5 分钟）', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0).getTime()

  it('未选时间 → not ok + 提示语', () => {
    expect(validatePublishTime(null, now)).toEqual({ ok: false, message: '请选择定时发布时间' })
  })

  it('恰 5 分钟边界 → 拒绝（<= 语义）', () => {
    const t = new Date(now + PUBLISH_LEAD_MS)
    expect(validatePublishTime(t, now)).toEqual({ ok: false, message: '定时发布时间需晚于当前时间至少 5 分钟' })
  })

  it('不足 5 分钟 → 拒绝', () => {
    expect(validatePublishTime(new Date(now + 60 * 1000), now).ok).toBe(false)
  })

  it('超过 5 分钟 1ms → 放行', () => {
    expect(validatePublishTime(new Date(now + PUBLISH_LEAD_MS + 1), now)).toEqual({ ok: true })
  })

  it('leadMs 可注入', () => {
    expect(validatePublishTime(new Date(now + 1000), now, 500)).toEqual({ ok: true })
  })
})

describe('canEditArticle', () => {
  const article = { author: { id: 7 } }

  it('ADMIN 可编辑任意文章', () => {
    expect(canEditArticle({ role: 'ADMIN', id: 99 }, article)).toBe(true)
  })

  it('本人文章可编辑（id 类型不一致按字符串比较）', () => {
    expect(canEditArticle({ role: 'AUTHOR', id: '7' }, article)).toBe(true)
  })

  it('他人文章不可编辑', () => {
    expect(canEditArticle({ role: 'AUTHOR', id: 8 }, article)).toBe(false)
  })
})

describe('draftToFormPatch', () => {
  it('只补丁草稿中存在的字段', () => {
    expect(draftToFormPatch({ title: 't', savedAt: 1 })).toEqual({ title: 't' })
  })

  it('categoryId：undefined 不补丁，null/0 归一为 null，正数保留', () => {
    expect('categoryId' in draftToFormPatch({})).toBe(false)
    expect(draftToFormPatch({ categoryId: null }).categoryId).toBeNull()
    expect(draftToFormPatch({ categoryId: 0 }).categoryId).toBeNull()
    expect(draftToFormPatch({ categoryId: 5 }).categoryId).toBe(5)
  })

  it('content 原样透传（空串也补丁）', () => {
    expect(draftToFormPatch({ content: '' })).toEqual({ content: '' })
    expect(draftToFormPatch({ content: '## md' })).toEqual({ content: '## md' })
  })
})

describe('articleToFormState', () => {
  it('口令不回填明文，已有保护文章可保留原口令', () => {
    const state = articleToFormState({ visibility: 'PASSWORD' })
    expect(state.hasAccessPassword).toBe(true)
    expect(state.accessPassword).toBe('')
    expect(validateArticle({ ...state, title: 't' }, '正文').ok).toBe(true)
    expect(validateArticle({ title: 't', visibility: 'PASSWORD' }, '正文').ok).toBe(false)
    expect(validateArticle({ title: 't', visibility: 'PASSWORD', accessPassword: '密'.repeat(25) }, '正文').ok).toBe(false)
  })
  it('字段兜底与 tags → tagIds 映射', () => {
    const s = articleToFormState({})
    expect(s).toEqual({
      title: '',
      summary: '',
      slug: '',
      cover: '',
      categoryId: null,
      tagIds: [],
      editorType: 'MARKDOWN',
      mdContent: null,
      visibility: 'PUBLIC',
      hasAccessPassword: false,
      accessPassword: '',
      htmlContent: ''
    })
    const withTags = articleToFormState({ tags: [{ id: 1 }, { id: 2 }], editorType: 'MARKDOWN', content: '# x' })
    expect(withTags.tagIds).toEqual([1, 2])
  })

  it('slug 固定链接回填（Zer0Drv/blog#14）', () => {
    expect(articleToFormState({ slug: 'my-post' }).slug).toBe('my-post')
    expect(articleToFormState({}).slug).toBe('')
  })

  it('MARKDOWN 文章正文进 md 槽位', () => {
    const s = articleToFormState({ editorType: 'MARKDOWN', content: '# hi' })
    expect(s.mdContent).toBe('# hi')
    expect(s.htmlContent).toBeNull()
  })

  it('RICHTEXT 文章正文进 html 槽位', () => {
    const s = articleToFormState({ editorType: 'RICHTEXT', content: '<p>hi</p>' })
    expect(s.mdContent).toBeNull()
    expect(s.htmlContent).toBe('<p>hi</p>')
  })

  it('editorType 缺失：表单兜底 MARKDOWN，但正文沿用现状进 html 槽位', () => {
    const s = articleToFormState({ content: 'raw' })
    expect(s.editorType).toBe('MARKDOWN')
    expect(s.mdContent).toBeNull()
    expect(s.htmlContent).toBe('raw')
  })
})
