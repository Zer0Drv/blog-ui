import { describe, it, expect, vi, beforeEach } from 'vitest'

// 捕获 http.js 注册的拦截器回调，直接驱动以断言错误码透传
const handlers = {}

vi.mock('axios', () => ({
  default: {
    create: () => ({
      interceptors: {
        request: { use: fn => { handlers.request = fn } },
        response: { use: (ok, bad) => { handlers.ok = ok; handlers.bad = bad } }
      }
    })
  }
}))

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() }
}))

// 动态导入确保 mock 先生效
const http = (await import('../http')).default

describe('http 拦截器', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('导出 axios 实例', () => {
    expect(http).toBeTruthy()
  })

  it('正常响应剥离 R 体返回 data', () => {
    const resp = { data: { code: '200', data: { a: 1 } }, config: {} }
    expect(handlers.ok(resp)).toEqual({ a: 1 })
  })

  it('rawResponse 时保留完整 R 体', () => {
    const body = { code: '200', data: { a: 1 }, message: 'ok' }
    expect(handlers.ok({ data: body, config: { rawResponse: true } })).toBe(body)
  })

  it('业务错误：reject 的 Error 携带后端 code（如 40050 CAPTCHA_REQUIRED）', async () => {
    const resp = { data: { code: '40050', message: '操作过于频繁，请完成图形验证' }, config: {} }
    const err = await handlers.ok(resp).catch(e => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('操作过于频繁，请完成图形验证')
    expect(err.code).toBe('40050')
    const { ElMessage } = await import('element-plus')
    expect(ElMessage.error).toHaveBeenCalledWith('操作过于频繁，请完成图形验证')
  })

  it('HTTP 层错误：reject 前把 response.data.code 挂到 err 上', async () => {
    const err = {
      response: { status: 400, data: { code: '40050', message: '验证码错误或已过期' } },
      message: 'Request failed with status code 400'
    }
    await expect(handlers.bad(err)).rejects.toBe(err)
    expect(err.code).toBe('40050')
  })

  it('HTTP 层错误：响应体无 code 时 err.code 为 undefined', async () => {
    const err = { response: { status: 500, data: {} }, message: 'Server Error' }
    await expect(handlers.bad(err)).rejects.toBe(err)
    expect(err.code).toBeUndefined()
  })
})
